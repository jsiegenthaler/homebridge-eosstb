'use strict';

// ****************** start of EOS settings

// name and version
const packagejson = require('./package.json');
const PLUGIN_NAME = packagejson.name;
const PLATFORM_NAME = packagejson.platformname;
const PLUGIN_VERSION = packagejson.version;

// required node modules
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const mqtt = require('mqtt');  
const qs = require('qs')
//const _ = require('underscore');

const axios = require('axios').default;
axios.defaults.xsrfCookieName = undefined; // change  xsrfCookieName: 'XSRF-TOKEN' to  xsrfCookieName: undefined, we do not want this default,

// axios-cookiejar-support v1.0.1 syntax
//const axiosCookieJarSupport = require('axios-cookiejar-support').default;

// axios-cookiejar-support v2.0.2 syntax
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support'); // as of axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md

const tough = require('tough-cookie');
const cookieJar = new tough.CookieJar();

// create a new instance called axiosWS
const axiosWS = axios.create({
	// axios-cookiejar-support v1.0.1 required config
	//withCredentials: true, // deprecated since axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
	//jar: true //deprecated since axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md

	// axios-cookiejar-support v2.0.2 required config
	jar: cookieJar //added in axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
});
// remove default header in axios that causes trouble with Telenet
delete axiosWS.defaults.headers.common["Accept"];
delete axiosWS.defaults.headers.common;
axiosWS.defaults.headers.post = {}; // ensure no default post header, upsets some logon routines
// setup the cookieJar support with axiosWS
axiosCookieJarSupport(axiosWS);



// ++++++++++++++++++++++++++++++++++++++++++++
// config start
// ++++++++++++++++++++++++++++++++++++++++++++


// base url varies by country
const countryBaseUrlArray = {
    'at': 		'https://prod.oesp.magentatv.at/oesp/v4/AT/deu/web', // v3 and v4 works
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/fr/web',
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web', // v2, v3 and v4 work
	'cz':		'https://web-api-pepper.horizon.tv/oesp/v4/CZ/ces/web/', // v2, v3 and v4 work
	'de':		'https://web-api-pepper.horizon.tv/oesp/v4/DE/deu/web', // v2, v3 and v4 work
    'gb':       'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web',
	'hu':		'https://web-api-pepper.horizon.tv/oesp/v4/HU/hun/web',  // v2, v3 and v4 work
	'ie':       'https://prod.oesp.virginmediatv.ie/oesp/v4/IE/eng/web/',
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web',
	'pl':		'https://web-api-pepper.horizon.tv/oesp/v4/PL/pol/web', // v2, v3 and v4 work
	'sk':		'https://web-api-pepper.horizon.tv/oesp/v4/SK/slk/web', // v2, v3 and v4 work
	'ro':		'https://web-api-pepper.horizon.tv/oesp/v4/RO/ron/web' // v2, v3 and v4 work
};

// mqtt endpoints varies by country
const mqttUrlArray = {
    'at':		'wss://obomsg.prod.at.horizon.tv/mqtt',
    'be-fr':  	'wss://obomsg.prod.be.horizon.tv/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv/mqtt',
    'ch': 		'wss://obomsg.prod.ch.horizon.tv/mqtt',
	'cz':		'wss://obomsg.prod.cz.horizon.tv/mqtt',
	'de':		'wss://obomsg.prod.de.horizon.tv/mqtt',
    'gb':       'wss://obomsg.prod.gb.horizon.tv/mqtt',
	'hu':		'wss://obomsg.prod.hu.horizon.tv/mqtt',
    'ie':       'wss://obomsg.prod.ie.horizon.tv/mqtt',
    'nl': 		'wss://obomsg.prod.nl.horizon.tv/mqtt',
    'pl': 		'wss://obomsg.prod.pl.horizon.tv/mqtt',
	'sk':		'wss://obomsg.prod.sk.horizon.tv/mqtt',
	'ro':		'wss://obomsg.prod.ro.horizon.tv/mqtt'
};

// profile url endpoints varies by country
// https://prod.spark.upctv.ch/deu/web/personalization-service/v1/customer/{household_id}/devices
// without terminating / 
const personalizationServiceUrlArray = {
    'at':		'https://prod.spark.magentatv.at/deu/web/personalization-service/v1/customer/{householdId}',
    'be-fr':  	'https://prod.spark.telenettv.be/fr/web/personalization-service/v1/customer/{householdId}',
    'be-nl': 	'https://prod.spark.telenettv.be/nld/web/personalization-service/v1/customer/{householdId}',
    'ch': 		'https://prod.spark.upctv.ch/eng/web/personalization-service/v1/customer/{householdId}',
	'cz':		'',
	'de':		'',
    'gb':       'https://prod.spark.virginmedia.com/eng/web/personalization-service/v1/customer/{householdId}',
	'hu':		'',
    'ie':       'https://prod.spark.virginmediatv.ie/eng/web/personalization-service/v1/customer/{householdId}',
    'nl': 		'https://prod.spark.ziggogo.tv/nld/web/personalization-service/v1/customer/{householdId}',
    'pl': 		'https://prod.spark.upctv.pl/pol/web/personalization-service/v1/customer/{householdId}',
	'sk':		'',
	'ro':		''
};



// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
// https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
// const GB_AUTH_URL = 'https://id.virginmedia.com/sign-in/?protocol=oidc';
const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';



// general constants
const NO_INPUT_ID = 99; // an input id that does not exist. Must be > 0 as a uint32 is expected
const NO_CHANNEL_ID = 'NO_ID'; // id for a channel not in the channel list
const NO_CHANNEL_NAME = 'UNKNOWN'; // name for a channel not in the channel list
const MAX_INPUT_SOURCES = 95; // max input services. Default = 95. Cannot be more than 96 (100 - all other services)
const SESSION_WATCHDOG_INTERVAL_MS = 15000; // session watchdog interval in millisec. Default = 15000 (15s)
const MQTT_WATCHDOG_INTERVAL_MS = 10000; // mqtt watchdog interval in millisec. Default = 10000 (10s)
const MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S = 600; // channel list refresh check interval, in seconds. Default = 600
const RECORDING_STATE_ONGOING = 1; // Custom characteristic
const SETTOPBOX_NAME_MINLEN = 3; // min len of the set-top box name
const SETTOPBOX_NAME_MAXLEN = 14; // max len of the set-top box name

// state constants
const sessionState = { DISCONNECTED: 0, LOADING: 1, LOGGING_IN: 2, AUTHENTICATING: 3, VERIFYING: 4, AUTHENTICATED: 5, CONNECTED: 6 };
const mediaStateName = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerStateName = ["OFF", "ON"];
const closedCaptionsStateName = ["DISABLED", "ENABLED"];
const visibilityStateName = ["SHOWN", "HIDDEN"];
const pictureModeName = ["OTHER", "STANDARD", "CALIBRATED", "CALIBRATED_DARK", "VIVID", "GAME", "COMPUTER", "CUSTOM"];
const recordingState = { IDLE: 0, ONGOING_NDVR: 1, ONGOING_LOCALDVR: 2 };
const recordingStateName = ["IDLE", "ONGOING_NDVR", "ONGOING_LOCALDVR"];
const statusFaultName = ["NO_FAULT", "GENERAL_FAULT"];
const inUseName = ["NOT_IN_USE", "IN_USE"];
const programModeName = ["NO_PROGRAM_SCHEDULED", "PROGRAM_SCHEDULED", "PROGRAM_SCHEDULED_MANUAL_MODE_"];
const statusActiveName = ["NOT_ACTIVE", "ACTIVE"];
const inputSourceTypeName = ["OTHER", "HOME_SCREEN", "TUNER", "HDMI", "COMPOSITE_VIDEO", "S_VIDEO", "COMPONENT_VIDEO", "DVI", "AIRPLAY", "USB", "APPLICATION"];
const inputDeviceTypeName = ["OTHER", "TV", "RECORDING", "TUNER", "PLAYBACK", "AUDIO_SYSTEM"];


Object.freeze(sessionState);
Object.freeze(mediaStateName);
Object.freeze(powerStateName);
Object.freeze(closedCaptionsStateName);
Object.freeze(visibilityStateName);
Object.freeze(pictureModeName);
Object.freeze(recordingStateName);
Object.freeze(statusFaultName);
Object.freeze(inUseName);
Object.freeze(programModeName);
Object.freeze(statusActiveName);
Object.freeze(inputSourceTypeName);
Object.freeze(inputDeviceTypeName);




// exec spawns child process to run a bash script
var exec = require("child_process").exec;
const { waitForDebugger } = require('inspector');
const { ENGINE_METHOD_CIPHERS } = require('constants');
const { LOADIPHLPAPI } = require('dns');
var PLUGIN_ENV = ''; // controls the development environment, appended to UUID to make unique device when developing

// variables for session and all devices
let mqttClient = {};
let mqttClientId = '';
let mqttUsername;
//let mqttPassword;
let currentSessionState;

let Accessory, Characteristic, Service, Categories, UUID;



// make a randon id of the desired length
function makeId(length) {
	let result	= '';
	let characters	= 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for ( let i = 0; i < length; i++ ) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
};

// clean a name so it is acceptable for HomeKit
function cleanNameForHomeKit(name) {
	// HomeKit does not allow non-alphanumeric characters apart from [ .,-]
	// Use only alphanumeric, space, and apostrophe characters.
	// Start and end with an alphabetic or numeric character. 
	// Don't include emojis.
	// https://developer.apple.com/design/human-interface-guidelines/homekit/overview/setup/
	// [^A-Za-zÀ-ÖØ-öø-ÿ0-9 .,-] allows all accented characters
	// https://stackoverflow.com/questions/6664582/regex-accent-insensitive

	// HomeKit however displays all these characters, so allow them
	let result = name;

	// replace + with plus, for 3+ HD in CH
	//result.replace('+', 'plus');
	//console.log("cleanNameForHomeKit after replacing + [%s]", result);

	// replace unwanted characters with whitespace
	//result = result.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ .,-]/gi, ' ');

	// for now just replace forward slash with whitespace
	result = result.replace('/', ' ');
	//console.log("cleanNameForHomeKit after replace [%s]", result);

	// replace any double whitespace with single whitespace
	//while(result.indexOf('  ')!=-1) { result.replace('  ',' '); }
	//console.log("cleanNameForHomeKit after replacing double whitespace [%s]", result);

	// trim to remove resultant leading and trailing whitespace
	result = result.trim();

	//ensure ends with a non-alphanumric character
	// testing shows 
	// OK     ending with . 
	// Not OK ending with ,-
	// append . if not ending in a alpha-numeric character
	/*
	if (RegExp(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ.]\z/gi).test(result)) {
		console.log("cleanNameForHomeKit last char not allowed, appending .");
		result = result + '.'; // append a .
	}
	*/
	//console.log("cleanNameForHomeKit result [%s]", result);
	return result;

}

// wait function
const wait=ms=>new Promise(resolve => setTimeout(resolve, ms)); 

// wait function with promise
function waitprom(ms) {
	return new Promise((resolve, reject) => {
	  setTimeout(() => {
		resolve(ms)
	  }, ms )
	})
  }  


// ++++++++++++++++++++++++++++++++++++++++++++
// config end
// ++++++++++++++++++++++++++++++++++++++++++++






// ++++++++++++++++++++++++++++++++++++++++++++
// platform setup
// ++++++++++++++++++++++++++++++++++++++++++++
module.exports = (api) => {
	Accessory = api.platformAccessory;
	Characteristic = api.hap.Characteristic;
	Service = api.hap.Service;
	Categories = api.hap.Categories;
	UUID = api.hap.uuid;
	const isDynamicPlatform = true;
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, stbPlatform, isDynamicPlatform);
};


class stbPlatform {
	// build the platform. Runs once on restart
	// All platform-specifie code goes in this class
	constructor(log, config, api) {
		this.log = log;
		this.config = config;
		this.api = api;
    	this.stbDevices = []; // store stbDevice in this.stbDevices

		// only load if configured and mandatory items exist. Homebridge checks for platform itself, and name is not critical
		if (!this.config) { this.log.warn('%s config missing. Initialization aborted.', PLUGIN_NAME); return; }
		const configWarningText = '%s config incomplete: "{configItemName}" missing. Initialization aborted.';
		if (!this.config.country) { this.log.warn( configWarningText.replace('{configItemName}','country'), PLUGIN_NAME); return; }
		if (!this.config.username) { this.log.warn( configWarningText.replace('{configItemName}','username'), PLUGIN_NAME); return; }
		if (!this.config.password) { this.log.warn( configWarningText.replace('{configItemName}','password'), PLUGIN_NAME); return; }


		// session flags
		currentSessionState = sessionState.DISCONNECTED;
		this.sessionWatchdogRunning = false;
		this.mqttClientConnecting = false;
		this.currentStatusFault = null;

		/*
		this.inputsFile = this.storagePath + '/' + 'inputs_' + this.host.split('.').join('');
		this.customInputsFile = this.storagePath + '/' + 'customInputs_' + this.host.split('.').join('');
		this.devInfoFile = this.storagePath + '/' + 'devInfo_' + this.host.split('.').join('');
		*/
		
		/**
    	* Platforms should wait until the "didFinishLaunching" event has fired before registering any new accessories.
    	*/
		this.api.on('didFinishLaunching', () => {
			if (this.config.debugLevel > 2) { this.log.warn('API event: didFinishLaunching'); }
			this.log('%s v%s', PLUGIN_NAME, PLUGIN_VERSION);

			// call the session watchdog now to create the session
			this.sessionWatchdog.bind(this);

			//this.runMe();

			// the session watchdog creates a session when none exists, and recreates one if the session ever fails due to internaet failure or anything else
			this.checkSessionInterval = setInterval(this.sessionWatchdog.bind(this),SESSION_WATCHDOG_INTERVAL_MS);
			
			// check for a channel list update every MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S seconds
			this.checkChannelListInterval = setInterval(this.refreshMasterChannelList.bind(this),MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S * 1000);
		});

	}

	/**
   	* REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
	* This is called BEFORE the didFinishLaunching event
   	*/
	configureAccessory(accessory) {
		// Note: Applies only to accesories linked to the Bridge. Does not apply to ExternalAccessories
		this.log("configurePlatformAccessory %s", accessory.displayName);
		this.accessories.push(accessory);
	}

	removeAccessory(accessory) {
		// Note: Applies only to accesories linked to the Bridge. Does not apply to ExternalAccessories
		this.log('removeAccessory');
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	}


	// persist config to disc
	persistConfig(deviceId, jsonData) {
		// we want to save channel names and visibilityState

		// storage path, constant
		const filename = path.join(this.api.user.storagePath(), 'persist', 'AccessoryInfo.' + PLATFORM_NAME + '.' + deviceId + '.json');
		this.log("filename", filename)

		//this.log("jsonData", jsonData)
		var jsonString = JSON.stringify(jsonData);
		this.log("jsonString", jsonString)


		// write to file
		fs.writeFile(filename, jsonString, function(err) {
			if (err) {
				this.log('persistConfig', err);
			}
		});
	}

	

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler (web)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// demo of a async function with proper  try/catch/finally error handling
	async runMe() {
		try {
			// do something here, errors are caught cleanly
			this.log("This command worked");
			
			// generate an error
			var text;
			if (text.includes("abc")) {
				this.log("should never log")
			}

			// It almost reads as synchronous code.  Just
			//  make sure never to forget await when calling an async function (or a function that returns a promise).  
			// I even created an async timeout(), so I can simply  await timeout(1000) to delay execution for 1 second.  And I make use of await events.once() a lot, to wait for a particular event.
			//await thisThrows();

		} catch (err) {
			// some error occured, handle it nicely
			this.log.error("runMe threw an error!")
			this.log.error(err);

		} finally {
			// do any final cleanup here
			this.log.warn('We do cleanup here. This is executed after the catch.');
		}
	}


	// the awesome watchDog
	async sessionWatchdog() {
		// the session watchdog creates a session when none exists, and creates stbDevices when none exist
		// runs every few seconds. 
		// If session exists: Exit immediately
		// If no session exists: prepares the session, then prepares the device

		// exit if a previous session is still running
		if (this.sessionWatchdogRunning) { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: a previous watchdog is still working, exiting without action'); 
			}
			return;

		// as we are called regularly by setInterval, exit immediately if session is still connected and mqtt is still connected
		} else if (currentSessionState == sessionState.CONNECTED && mqttClient.connected ) { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: sessionState %s, sessionConnected %s, mqttClientConnected %s, mqttClientConnecting %s. Session connected and mqtt connected, exiting without action', currentSessionState, (currentSessionState == sessionState.CONNECTED), mqttClient.connected || false, this.mqttClientConnecting); 
			}
			return; 

		// the watchdog can fire after session connected but before mqtt has connected, so check and exit
		} else if (currentSessionState == sessionState.CONNECTED && this.mqttClientConnecting && !mqttClient.connected) { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: sessionState %s, sessionConnected %s, mqttClientConnected %s, mqttClientConnecting %s. Session connected and mqtt is currently connecting, exiting without action', currentSessionState, (currentSessionState == sessionState.CONNECTED), mqttClient.connected || false, this.mqttClientConnecting); 
			}
			return; 

		// the session is connected, the mqtt client is not connected, continue to try and reconnect
		} else if (currentSessionState == sessionState.CONNECTED && !this.mqttClientConnecting && !mqttClient.connected) { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: sessionState %s, sessionConnected %s, mqttClientConnected %s, mqttClientConnecting %s. Session connected but mqtt not connected, continuing...', currentSessionState, (currentSessionState == sessionState.CONNECTED), mqttClient.connected || false, this.mqttClientConnecting); 
			}

		// otherwise the session might be in a state between disconnected and connected, so exit if not disconnected (as that means a session connection is currently in progress)
		} else if (currentSessionState != sessionState.DISCONNECTED) { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: sessionState %s, sessionConnected %s, mqttClientConnected %s, mqttClientConnecting %s. Session session is not disconnected, must be currently connecting, exiting without action', currentSessionState, (currentSessionState == sessionState.CONNECTED), mqttClient.connected || false, this.mqttClientConnecting); 
			}
			return;
		
		// session is not connected and is not in a state between connected and disconnected, so it is disconnected. Continue
		} else { 
			if (this.config.debugLevel > 1) { 
				this.log.warn('sessionWatchdog: sessionState %s, sessionConnected %s, mqttClientConnected %s, mqttClientConnecting %s. Session not connected and mqtt not connected, continuing...', currentSessionState, (currentSessionState == sessionState.CONNECTED), mqttClient.connected || false, this.mqttClientConnecting); 
			}

		}
		this.sessionWatchdogRunning = true;


		// detect if running on development environment
		//	customStoragePath: 'C:\\Users\\jochen\\.homebridge'
		if ( this.api.user.customStoragePath.includes( 'jochen' ) ) { PLUGIN_ENV = ' DEV' }
		if (PLUGIN_ENV) { this.log.warn('%s running in %s environment with debugLevel %s', PLUGIN_NAME, PLUGIN_ENV.trim(), this.config.debugLevel); }
	
		// Step 1: session does not exist, so create the session, passing the country value
		if (currentSessionState == sessionState.DISCONNECTED ) { 
			this.log('Session is not connected, starting session reconnect...');
			this.createSession(this.config.country.toLowerCase());
		} else if (currentSessionState == sessionState.CONNECTED && !mqttClient.connected) { 
			this.log('Session is still connected, but mqttCLient is disconnected, refreshing session and restarting mqttClient...');
		}

		// async wait a few seconds for the session to load, then continue
		// should be 15s as GB takes 12s for some users
		// increased to 30s on 30.08.2021 to help be-nl
		wait(30*1000).then(() => { 

			// only continue with mqtt if a session was actually created
			if (currentSessionState !== sessionState.CONNECTED) { return; }

			// discovery devices at every session connection
			this.log('Discovering platform and devices...');

			// show feedback for customer data found
			if (!this.session.customer) {
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
				this.log('Failed to find customer data. The backend systems may be down')
			} else {
				this.log('Found customer data: %s %s %s', this.session.customer.customerId, (this.session.customer.givenName || ''), (this.session.customer.familyName || '') );
				if (this.config.debugLevel > 2) { 
					this.log.warn('Session data: %s', this.session); 
					this.log.warn('Session data profileSettings: %s', this.session.profileSettings); 
				}
				if (this.config.debugLevel > 2) { this.log.warn('Customer data: %s', this.session.customer); }
			}

			// Step 3: after session is created, get the masterChannelList get the Personalization Data, but only if this.session.customer.physicalDeviceId exists
			if (this.session.customer.physicalDeviceId) {
				this.log('Loading master channel list and personalization data')
				this.refreshMasterChannelList(); // async function, processing continues
				this.getPersonalizationData('profiles'); // async function
				this.getPersonalizationData('devices'); // async function
			} else {
				// show warning if no physicalDeviceId found
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
				this.log('Failed to find physicalDeviceId in your customer data. Are you sure you have a compatible set-top box?')
				if (this.config.country.toLowerCase() == 'gb') { this.log('You may have an older TiVo box. TiVo boxes are not supported by %s', PLUGIN_NAME); }
			}

			// wait for master channel list and personalization data to load then see how many devices were found
			wait(5*1000).then(() => { 

				// show feedback for devices found
				if (!this.devices || !this.devices[0].settings) {
					this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
					this.log('Failed to find any devices. The backend systems may be down, or you have no supported devices on your customer account')
				} else {
					// at least one device found
					var logText = "Found %s device";
					if (this.devices.length > 1) { logText = logText + "s"; }
					this.log(logText, this.devices.length);
					this.log('Discovery completed');


					// user config tip showing all found devices
					// display only when no config.devices not found
					let tipText = '', deviceFoundInConfig = true;
					for (let i = 0; i < this.devices.length; i++) {
						if (!tipText == '') { tipText = tipText + ',\n'; }
						tipText = tipText + ' {\n';
						tipText = tipText + '   "deviceId": "' + this.devices[i].deviceId + '",\n';
						tipText = tipText + '   "name": "' + this.devices[i].settings.deviceFriendlyName + '"\n';
						tipText = tipText + ' }';
						if (this.config.devices) {
							let configDeviceIndex = this.config.devices.findIndex(devConfig => devConfig.deviceId == this.devices[i].deviceId);
							if (configDeviceIndex == -1) {
								this.log("Device not found in config: %s", this.devices[i].deviceId);
								deviceFoundInConfig = false;
							}
						} else {
							deviceFoundInConfig = false;
						}
					}
					if (!deviceFoundInConfig) {
						this.log('Config tip: Add these lines to your Homebridge ' + PLATFORM_NAME + ' config if you wish to customise your device config: \n"devices": [\n' + tipText + '\n]');
					}


					// debug: observe the structure!!
					//this.log("sessionWatchdog: before searching the cache: this.stbDevices", this.stbDevices);

					// setup/restore each device in turn as an accessory, as we can only setup the accessory after the session is created and the physicalDevices are retrieved
					this.log("Finding devices in cache...");
					for (let i = 0; i < this.devices.length; i++) {

						// setup each device (runs once per device)
						const deviceName = this.devices[i].settings.deviceFriendlyName;
						this.log("Device %s: %s %s", i+1, deviceName, this.devices[i].deviceId);

						// generate a constant uuid that will never change over the life of the accessory
						const uuid = this.api.hap.uuid.generate(this.devices[i].deviceId + PLUGIN_ENV);

						// check if the accessory already exists, create if it does not
						// a stbDevice contains various data: HomeKit accessory, EOS platform, EOS device, EOS profile
						let foundStbDevice = this.stbDevices.find(stbDevice => (stbDevice.accessory || {}).UUID === uuid)
						if (!foundStbDevice) {
							this.log("Device not found in cache, creating new accessory for %s", this.devices[i].deviceId);

							// create the accessory
							// constructor(log, config, api, device, platform) {
							this.log("Setting up device %s of %s: %s", i+1, this.devices.length, deviceName);
							let newStbDevice = new stbDevice(this.log, this.config, this.api, this.devices[i], this);
							this.stbDevices.push(newStbDevice);

						} else {
							this.log("Device found in cache: [%s] %s", foundStbDevice.name, foundStbDevice.deviceId);
						}	

					};

					// debug: observe the structure!!
					//this.log("sessionWatchdog: after searching the cache: this.stbDevices", this.stbDevices);

					// wait 3sec for session and devices to be loaded loaded
					// now get the Jwt Token which triggers the mqtt client
					wait(3*1000).then(() => { 
						this.mqttClientConnecting = true;
						this.getJwtToken(this.session.username, this.session.oespToken, this.session.customer.householdId);
						this.sessionWatchdogRunning = false;
					})

				}
			});

		}).catch((error) => { 
			this.log.error("sessionWatchdog: Error", error); 
			this.sessionWatchdogRunning = false;
		});

	}



	// select the right session to create
	async createSession(country) {
		this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
		switch(country) {
			case 'be-nl': case 'be-fr':
				this.getSessionBE(); break;
			case 'gb':
				this.getSessionGB(); break;
			default: // ch, nl, ie, at
				this.getSession();
			}
	}

	// get session ch, nl, ie, at
	async getSession() {
		this.log('Creating %s session...', PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;

		const axiosConfig = {
			method: 'POST',
			url: countryBaseUrlArray[this.config.country.toLowerCase()] + '/session',
			jar: cookieJar,
			data: {
				username: this.config.username,
				password: this.config.password
			}
		};

		// robustness: fail if url missing
		if (!axiosConfig.url) {
			this.log.warn('getSession: axiosConfig.url empty!');
			currentSessionState = sessionState.DISCONNECTED;
			this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
			return false;						
		}
		
		this.log('Step 1 of 1: logging in with username %s', this.config.username);
		this.log.debug('Step 1 of 1: post login to',axiosConfig.url);
		axiosWS(axiosConfig)
			.then(response => {	
				this.log('Step 1 of 1: response:',response.status, response.statusText);
				this.session = response.data;
				if (this.session.customer) { currentSessionState = sessionState.AUTHENTICATED; }
				this.log('Session created');
				currentSessionState = sessionState.CONNECTED;
				this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
				return true;
			})
			.catch(error => {
				let errText, errReason;
				errText = 'Failed to create session'
				if (error.response && error.response.status >= 400 && error.response.status < 500) {
					errReason = '- check your ' + PLATFORM_NAME + ' username and password: ' + error.response.status + ' ' + (error.response.statusText || '');
				} else if (error.response && error.response.status >= 500 && error.response.status < 600) {
					errReason = '- try again later: ' + error.response.status + ' ' + (error.response.statusText || '');
				} else if (error.response && error.response.status) {
					errReason = '- check your internet connection: ' + error.response.status + ' ' + (error.response.statusText || '');
				} else {
					errReason = '- check your internet connection: ' + error.code + ' ' + (error.hostname || '');
				}
				this.log('%s %s', errText, (errReason || ''));
				this.log.debug('getSession: error:', error);
				currentSessionState = sessionState.DISCONNECTED;
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
				return false;
			});	
		return false;
	}


	// get session for BE only (special logon sequence)
	async getSessionBE() {
		// only for be-nl and be-fr users, as the session logon using openid is different
		// looks like also for gb users:
		// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
		this.log('Creating %s BE session...',PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;


		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
		// axios interceptors to log request and response for debugging
		// works on all following requests in this sub
		/*
		axiosWS.interceptors.request.use(req => {
			this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
			'\nMethod:',req.method, '\nURL:', req.url, 
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,  
			//'\nParams:', req.params, '\nData:', req.data
			);
			this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
			return req; // must return request
		});
		axiosWS.interceptors.response.use(res => {
			this.log('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
			'\nHeaders:', res.headers, 
			//'\nData:', res.data, 
			//'\nLast Request:', res.request
			);
			this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
			return res; // must return response
		});
		*/
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


		// ensure the required POST header is set
		axiosWS.defaults.headers.post = { 'Content-Type': 'application/x-www-form-urlencoded' }; // needed for axios-cookiejar-support v2.0.x


		// Step 1: # get authentication details
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country.toLowerCase()] + '/authorization';
		this.log('Step 1 of 7: get authentication details');
		this.log.debug('Step 1 of 7: get authentication details from',apiAuthorizationUrl);
		axiosWS.get(apiAuthorizationUrl)
			.then(response => {	
				this.log('Step 1 of 7: response:',response.status, response.statusText);
				
				// get the data we need for further steps
				let auth = response.data;
				let authState = auth.session.state;
				let authAuthorizationUri = auth.session.authorizationUri;
				let authValidtyToken = auth.session.validityToken;

				// Step 2: # follow authorizationUri to get AUTH cookie
				this.log('Step 2 of 7: get AUTH cookie');
				this.log.debug('Step 2 of 7: get AUTH cookie from',authAuthorizationUri);
				axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						// unsure what minimum headers will here
						headers: {
							Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
						},
					})
					.then(response => {	
						this.log('Step 2 of 7: response:',response.status, response.statusText);
		
						// Step 3: # login
						this.log('Step 3 of 7: logging in with username %s', this.config.username);
						this.log.debug('Step 3 of 7: post login to auth url:',BE_AUTH_URL);
						this.log.debug('Step 3 of 7: Cookies for the auth url:',cookieJar.getCookies(BE_AUTH_URL));
						currentSessionState = sessionState.LOGGING_IN;
						var payload = qs.stringify({
							j_username: this.config.username,
							j_password: this.config.password,
							rememberme: 'true'
						});
						this.log.debug('Step 3 of 7: using payload',payload);
						axiosWS.post(BE_AUTH_URL,payload,{
							jar: cookieJar,
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
								},
							})
							.then(response => {	
								this.log('Step 3 of 7: response:',response.status, response.statusText);
								this.log.debug('Step 3 response.headers.location:',response.headers.location); 
								this.log.debug('Step 3 response.headers:',response.headers);
								var url = response.headers.location;
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionBE: Step 3: location url empty!');
									currentSessionState = sessionState.DISCONNECTED;
									return false;						
								}

								//location is https://login.prd.telenet.be/openid/login?response_type=code&state=... if success
								//location is https://login.prd.telenet.be/openid/login?authentication_error=true if not authorised
								//location is https://login.prd.telenet.be/openid/login?error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
									currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
									this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
								} else if (url.indexOf('error=session_expired') > 0 ) {
									this.log.warn('Step 3 of 7: Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
									this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
								} else {

									// Step 4: # follow redirect url
									this.log('Step 4 of 7: follow redirect url');
									//this.log('Cookies for the redirect url:',cookieJar.getCookies(url));
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 of 7: response:',response.status, response.statusText);
											//this.log('Step 4 response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('Step 4 of 7: location url empty!');
												currentSessionState = sessionState.DISCONNECTED;
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
												return false;						
											}

											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
												currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 of 7: Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
											} else {

												// Step 5: # obtain authorizationCode
												this.log('Step 5 of 7: extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('Step 5 of 7: location url empty!');
													currentSessionState = sessionState.DISCONNECTED;
													this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
													return false;						
												}
	
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 of 7: Unable to extract authorizationCode');
												} else {
													this.log('Step 5 of 7: authorizationCode OK');
													this.log.debug('Step 5 of 7: authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log('Step 6 of 7: post auth data');
													this.log.debug('Step 6 of 7: post auth data to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													//this.log('Cookies for the session:',cookieJar.getCookies(apiAuthorizationUrl));
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 of 7: response:',response.status, response.statusText);
																
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															//this.log('Step 6 refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log('Step 7 of 7: post refreshToken request');
															this.log.debug('Step 7 of 7: post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country.toLowerCase()] + '/session';
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 of 7: response:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																		
																	//this.log('Step 7 response.headers:',response.headers); 
																	//this.log('Step 7 response.data:',response.data); 
																	//this.log('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.session = response.data;
																	this.log('Session created');
																	currentSessionState = sessionState.CONNECTED;
																	this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
																	return true;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 of 7: Unable to get OESP token:", error.response.status, error.response.statusText);
																	this.log.debug("Step 7 of 7: Unable to get OESP token:",error);
																	currentSessionState = sessionState.DISCONNECTED;
																	this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 of 7: Unable to authorize with oauth code:", error.response.status, error.response.statusText);
															this.log.debug("Step 6 of 7: Unable to authorize with oauth code:",error);
															currentSessionState = sessionState.DISCONNECTED;
															this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														});	
													};
												};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 of 7: Unable to oauth authorize:", error.response.status, error.response.statusText);
											this.log.debug("Step 4 of 7: Unable to oauth authorize:",error);
											currentSessionState = sessionState.DISCONNECTED;
											this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 of 7: Unable to login:", error.response.status, error.response.statusText);
								this.log.debug("Step 3 of 7: Unable to login:",error);
								currentSessionState = sessionState.DISCONNECTED;
								this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 of 7: Could not get authorizationUri", error.response.status, error.response.statusText);
						this.log.debug("Step 2 of 7: Could not get authorizationUri:",error);
						currentSessionState = sessionState.DISCONNECTED;
						this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
					});
			})
			// Step 1 http errors
			.catch(error => {
				if (!error.response) {
					this.log('Step 1 of 7: Failed to create BE session - check your internet connection.');
				} else {
					this.log('Step 1 of 7: Failed to create BE session: %s', error.response.status, error.response.statusText);
				}
				this.log.debug('Step 1 of 7: getSessionBE: error:', error);
				currentSessionState = sessionState.DISCONNECTED;
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
			});

		currentSessionState = sessionState.DISCONNECTED;
		this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
	}


	// get session for GB only (special logon sequence)
	getSessionGB() {
		// this code is a copy of the be session code, adapted for gb
		this.log('Creating %s GB session...',PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;

		//var cookieJarGB = new cookieJar();

		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
		// axios interceptors to log request and response for debugging
		// works on all following requests in this sub
		/*
		axiosWS.interceptors.request.use(req => {
			this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
			this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
			'\nMethod:',req.method, '\nURL:', req.url, 
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,
			//'\nParams:', req.params, '\nData:', req.data
			);
			return req; // must return request
		});
		axiosWS.interceptors.response.use(res => {
			this.log('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
			'\nHeaders:', res.headers, 
			//'\nData:', res.data, 
			//'\nLast Request:', res.request
			);
			this.log('+++INTERCEPTED AFTER HTTP RESPONSE COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
			return res; // must return response
		});
		*/
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


		// Step 1: # get authentication details
		// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country.toLowerCase()] + '/authorization';
		this.log('Step 1 of 7: get authentication details');
		this.log.debug('Step 1 of 7: get authentication details from',apiAuthorizationUrl);
		axiosWS.get(apiAuthorizationUrl)
			.then(response => {	
				this.log('Step 1 of 7 response:',response.status, response.statusText);
				this.log.debug('Step 1 of 7 response.data',response.data);
				
				// get the data we need for further steps
				let auth = response.data;
				let authState = auth.session.state;
				let authAuthorizationUri = auth.session.authorizationUri;
				let authValidtyToken = auth.session.validityToken;
				this.log.debug('Step 1 of 7: results: authState',authState);
				this.log.debug('Step 1 of 7: results: authAuthorizationUri',authAuthorizationUri);
				this.log.debug('Step 1 of 7: results: authValidtyToken',authValidtyToken);

				// Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
				this.log('Step 2 of 7: get AUTH cookie');
				this.log.debug('Step 2 of 7: get AUTH cookie from',authAuthorizationUri);
				axiosWS.get(authAuthorizationUri, {
						jar: cookieJar
						// However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
						//ignoreCookieErrors: true // ignore the error triggered by the Domain=mint.dummydomain cookie, 
					})
					.then(response => {	
						this.log('Step 2 of 7: response:',response.status, response.statusText);
						//this.log.warn('Step 2 of 7 response.data',response.data); // an html logon page
		
						// Step 3: # login
						this.log('Step 3 of 7: logging in with username %s', this.config.username);
						//this.log('Cookies for the auth url:',cookieJar.getCookies(GB_AUTH_URL));
						currentSessionState = sessionState.LOGGING_IN;

						// we just want to POST to 
						// 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
						const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
						this.log.debug('Step 3 of 7: POST request will contain this data: {"username":"' + this.config.username + '","credential":"' + this.config.password + '"}');
						axiosWS(GB_AUTH_URL,{
						//axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
							jar: cookieJar,
							// However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
							//ignoreCookieErrors: true // ignore the error triggered by the Domain=mint.dummydomain cookie, 
							data: '{"username":"' + this.config.username + '","credential":"' + this.config.password + '"}',
							method: "POST",
							// minimum headers are "accept": "*/*",
							headers: {
								"accept": "application/json; charset=UTF-8, */*",
							},
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK. GB returns 200
							},
							})
							.then(response => {	
								this.log('Step 3 of 7: response:',response.status, response.statusText);
								this.log.debug('Step 3 of 7: response.headers:',response.headers); 
								this.log.debug('Step 3 of 7: response.data:',response.data);

								//this.log('Step 3 of 7 response.headers:',response.headers);
								var url = response.headers['x-redirect-location']
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionGB: Step 3: x-redirect-location url empty!');
									currentSessionState = sessionState.DISCONNECTED;
									this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
									return false;						
								}								
								//location is h??=... if success
								//location is https?? if not authorised
								//location is https:... error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
								} else if (url.indexOf('error=session_expired') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7: Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									currentSessionState = sessionState.DISCONNECTED;	// flag the session as dead
									this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
								} else {
									this.log.debug('Step 3 of 7: login successful');

									// Step 4: # follow redirect url
									this.log('Step 4 of 7: follow redirect url');
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 of 7 response:',response.status, response.statusText);
											this.log.debug('Step 4 of 7: response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											this.log.debug('Step 4 of 7: response.data:',response.data);
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('getSessionGB: Step 4 of 7 location url empty!');
												currentSessionState = sessionState.DISCONNECTED;
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
												return false;						
											}								
			
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
												currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 of 7: Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
												this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
											} else {

												// Step 5: # obtain authorizationCode
												this.log('Step 5 of 7: extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 5: location url empty!');
													currentSessionState = sessionState.DISCONNECTED;
													this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
													return false;						
												}								
				
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 of 7: Unable to extract authorizationCode');
												} else {
													this.log('Step 5 of 7: authorizationCode OK');
													this.log.debug('Step 5 of 7: authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log('Step 6 of 7: post auth data with valid code');
													this.log.debug('Step 6 of 7: post auth data with valid code to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													var payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 of 7: response:',response.status, response.statusText);
															this.log.debug('Step 6 of 7: response.data:',response.data);
															
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															this.log.debug('Step 6 of 7: refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log('Step 7 of 7: post refreshToken request');
															this.log.debug('Step 7 of 7: post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country.toLowerCase()] + '/session';
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 of 7: response:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																	
																	this.log.debug('Step 7 of 7: response.headers:',response.headers); 
																	this.log.debug('Step 7 of 7: response.data:',response.data); 
																	this.log.debug('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.session = response.data;
																	
																	// get device data from the session
																	this.session = response.data;
																	currentSessionState = sessionState.CONNECTED;
																	this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
																	this.log('Session created');
																	return true;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 of 7: Unable to get OESP token:",error.response.status, error.response.statusText);
																	this.log.debug("Step 7 of 7: error:",error);
																	currentSessionState = sessionState.DISCONNECTED;
																	this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 of 7: Unable to authorize with oauth code, http error:",error);
															currentSessionState = sessionState.DISCONNECTED;
															this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														});	
												};
											};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 of 7: Unable to oauth authorize:",error.response.status, error.response.statusText);
											this.log.debug("Step 4 of 7: error:",error);
											currentSessionState = sessionState.DISCONNECTED;
											this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 of 7: Unable to login:",error.response.status, error.response.statusText);
								this.log.debug("Step 3 of 7: error:",error);
								currentSessionState = sessionState.DISCONNECTED;
								this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 of 7: Unable to get authorizationUri:",error.response.status, error.response.statusText);
						this.log.debug("Step 2 of 7: error:",error);
						currentSessionState = sessionState.DISCONNECTED;
						this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
					});
			})
			// Step 1 http errors
			.catch(error => {
				this.log('Failed to create GB session - check your internet connection');
				this.log.warn("Step 1 of 7: Could not get apiAuthorizationUrl:",error.response.status, error.response.statusText);
				this.log.debug("Step 1 of 7: error:",error);
				currentSessionState = sessionState.DISCONNECTED;
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
			});

		currentSessionState = sessionState.DISCONNECTED;
		this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
	}


	// load all available TV channels at regular intervals into an array
	async refreshMasterChannelList(callback) {
		// called by refreshMasterChannelList (state handler), thus runs at polling interval

		// exit immediately if the session does not exist
		if (currentSessionState != sessionState.CONNECTED) { 
			if (this.config.debugLevel > 1) { this.log.warn('refreshMasterChannelList: Session does not exist, exiting'); }
			return;
		 }

		// exit immediately if channel list has not expired
		if (this.masterChannelListExpiryDate > Date.now()) {
			if (this.config.debugLevel > 1) {
				this.log.warn('refreshMasterChannelList: Master channel list has not expired yet. Next refresh will occur after %s', this.masterChannelListExpiryDate.toLocaleString());
			}
			return false;
		}

		if (this.config.debugLevel > 1) {
			this.log.warn('refreshMasterChannelList: Refreshing master channel list...');
		}

		// only continue if a session was created. If the internet conection is down then we have no session
		//if (currentSessionState != sessionState.CONNECTED) { return; }
		
		// channels can be retrieved for the country without having a mqtt session going  but then the list is not relevant for the user's locationId
		// so you should add the user's locationId as a parameter, and this needs the oespToken
		// syntax:
		// https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/channels?byLocationId=41043&includeInvisible=true&includeNotEntitled=true&personalised=true&sort=channelNumber
		let url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/channels';
		url = url + '?byLocationId=' + this.session.locationId // locationId needed to get user-specific list
		url = url + '&includeInvisible=true' // includeInvisible
		url = url + '&includeNotEntitled=true' // includeNotEntitled
		url = url + '&personalised=true' // personalised
		url = url + '&sort=channelNumber' // sort
		if (this.config.debugLevel > 2) {
			this.log.warn('refreshMasterChannelList: loading inputs from',url);
		}

		// call the webservice to get all available channels
		const axiosConfig = {
			method: 'GET',
			url: url,
			headers: {
				'X-OESP-Token': this.session.oespToken,		
				'X-OESP-Username': this.session.username
			}
		};
		axiosWS(axiosConfig)
			.then(response => {
				if (this.config.debugLevel > 2) {
					this.log.warn('refreshMasterChannelList: Processing %s channels...', response.data.totalResults);
				}
				this.masterChannelListExpiryDate = new Date(response.data.expires);
			
				// load the channel list with all channels found
				this.masterChannelList = [];
				const channels = response.data.channels;
				for(let i=0; i<channels.length; i++) {
					const channel = channels[i];
					this.masterChannelList.push({
						channelId: channel.stationSchedules[0].station.serviceId, 
						channelNumber: channel.channelNumber, 
						channelName: cleanNameForHomeKit(channel.title)
						//channelListIndex: i
					});
				}
					
				if (this.config.debugLevel > 0) {
					this.log.warn('refreshMasterChannelList: Master channel list refreshed with %s channels, valid until %s', response.data.totalResults, this.masterChannelListExpiryDate.toLocaleString());
				}
				return true;

			})
			.catch(error => {
				let errText, errReason;
				errText = 'Failed to refresh the master channel list - check your internet connection:'
				if (error.isAxiosError) { errReason = error.code + ': ' + (error.hostname || ''); }
				this.log('%s %s', errText, (errReason || ''));
				this.log.debug(`refreshMasterChannelList error:`, error);

				return error;
			});
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler (web)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++








  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler mqtt
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// get a Java Web Token
	getJwtToken(oespUsername, oespToken, householdId){
		// get a JSON web token from the supplied oespToken and householdId
		if (this.config.debugLevel > 1) { this.log.warn('getJwtToken'); }
		// robustness checks
		if (currentSessionState !== sessionState.CONNECTED) {
			this.log.warn('Cannot get JWT token: currentSessionState incorrect:', currentSessionState);
			return false;
		}
		if (!oespToken) {
			this.log.warn('Cannot get JWT token: oespToken not set');
			return false;
		}

		const jwtAxiosConfig = {
			method: 'GET',
			url: countryBaseUrlArray[this.config.country.toLowerCase()] + '/tokens/jwt',
			headers: {
				'X-OESP-Token': oespToken,
				'X-OESP-Username': oespUsername, 
			}
		};
		this.log.debug("getJwtToken: jwtAxiosConfig:", jwtAxiosConfig)
		axiosWS(jwtAxiosConfig)
			.then(response => {	
				this.log.debug("getJwtToken: response.data:", response.data)
				mqttUsername = householdId;
				//mqttPassword = response.data.token;
				if (this.config.debugLevel > 1) { this.log.warn('getJwtToken: calling startMqttClient'); }
				this.startMqttClient(this, householdId, response.data.token);  // this starts the mqtt session
				
			})
			.catch(error => {
				this.log.error('getJwtToken error:', error);
				return false;
			});			
	}


	// start the mqtt client and handle mqtt messages
	startMqttClient(parent, mqttUsername, mqttPassword) {
		if (this.config.debugLevel > 0) { 
			this.log('Starting mqttClient...'); 
		}
		if (currentSessionState !== sessionState.CONNECTED) {
			this.log.warn('Cannot start mqttClient: currentSessionState incorrect:', currentSessionState);
			return false;
		}


		// create mqtt client instance and connect to the mqttUrl
		const mqttUrl = mqttUrlArray[this.config.country.toLowerCase()];
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: mqttUrl:', mqttUrl ); 
		}
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: Creating mqttClient object with username %s, password %s', mqttUsername ,mqttPassword ); 
		}

		// make a new mqttClientId on every session start, much robuster, then connect
		mqttClientId = makeId(30).toLowerCase();
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: mqttClientId,
			username: mqttUsername,
			password: mqttPassword
		});
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: mqttUrl connect request sent' ); 
		}

		//mqttClient.setMaxListeners(20); // default is 10 sometimes causes issues when the listeners reach 11

		//parent.log(mqttClient); //for debug

		
		// mqtt client event: connect
		mqttClient.on('connect', function () {
			try {
				parent.log("mqttClient: Connected: %s", mqttClient.connected);
				parent.mqttClientConnecting = false;

				// https://prod.spark.upctv.ch/eng/web/personalization-service/v1/customer/107xxxx_ch/profiles
				parent.mqttSubscribeToTopic(mqttUsername + '/personalizationService');

				// experimental support
				parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus'); // not needed
				parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus/lastUserAction'); // not needed
				/*
				// the next 2 are not needed
				parent.mqttSubscribeToTopic(mqttUsername + '/purchaseService'); // not needed
				parent.mqttSubscribeToTopic(mqttUsername + '/watchlistService'); // not needed
				*/

				// initiate the EOS session by turning on the HGO platform
				parent.mqttSetHgoOnlineRunning(mqttUsername, mqttClientId);

				
				parent.mqttSubscribeToTopic(mqttUsername); // subscribe to householdId
				parent.mqttSubscribeToTopic(mqttUsername + '/+/status'); // subscribe to householdId/+/status

				// experimental support
				parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings'); // not needed
				parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings/capacity'); // not needed

				// subscribe to all devices after the mqttSetHgoOnlineRunning is sent
				parent.devices.forEach((device) => {
					// subscribe to our own generated unique householdId/mqttClientId and everything for our box
					parent.mqttSubscribeToTopic(mqttUsername + '/' + mqttClientId);
					// subscribe to our householdId/deviceId
					parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId);
					// subscribe to our householdId/deviceId/status
					parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/status');
				});

				// and request the UI status for each device
				parent.devices.forEach((device) => {
					// send a getuiStatus request
					parent.getUiStatus(device.deviceId, mqttClientId);
				});

				// and request current recordingState
				parent.getRecordingState();  // async function

				// ++++++++++++++++++++ mqttConnected +++++++++++++++++++++
			
		  
				// mqtt client event: message received
				mqttClient.on('message', function (topic, payload) {
					try {

						// store some mqtt diagnostic data
						parent.lastMqttMessageReceived = Date.now();

						let mqttMessage = JSON.parse(payload);
						if (parent.config.debugLevel > 0) {
							parent.log.warn('mqttClient: Received Message: \r\nTopic: %s\r\nMessage: \r\n%s', topic, mqttMessage);
						}

						// variables for just in this function
						var deviceId, stbState, currPowerState, currMediaState, currChannelId, currSourceType, currRecordingState, currStatusActive, currInputDeviceType, currInputSourceType;

						// and request the UI status for each device
						// 14.03.2021 does not respond, disabling for now...
						/*
						parent.devices.forEach((device) => {
							// send a getuiStatus request
							parent.getUiStatus(device.deviceId, mqttClientId);
						});
						*/

						// handle personalizationService messages
						// Topic: Topic: 107xxxx_ch/personalizationService
						// Message: { action: 'OPS.getProfilesUpdate', source: '3C36E4-EOSSTB-00365657xxxx', ... }
						// Message: { action: 'OPS.getDeviceUpdate', source: '3C36E4-EOSSTB-00365657xxxx', deviceId: '3C36E4-EOSSTB-00365657xxxx' }
						if (topic.includes(mqttUsername + '/personalizationService')) {
							if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: %s: action', mqttMessage.action); }
							if (mqttMessage.action == 'OPS.getProfilesUpdate') {
								if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: %s, calling getPersonalizationData for profiles', mqttMessage.action); }
								parent.getPersonalizationData('profiles'); // async function

							} else if (mqttMessage.action == 'OPS.getDeviceUpdate') {
								if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: %s, calling getPersonalizationData for devices', mqttMessage.action); }
								deviceId = mqttMessage.deviceId;
								parent.getPersonalizationData('devices/' + deviceId); // async function
							}
						}

						// handle recordingState messages
						// Topic: Topic: 107xxxx_ch/recordingStatus
						// Message: {"id":"crid:~~2F~~2Fgn.tv~~2F2004781~~2FEP019440730003,imi:2d369682b865679f2e5182ea52a93410171cfdc8","event":"scheduleEvent","transactionId":"/CH/eng/web/networkdvrrecordings - 013f12fc-23ef-4b77-a244-eeeea0c6901c"}
						if (topic.includes(mqttUsername + '/recordingStatus')) {
							if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: event: %s', mqttMessage.event); }
							parent.getRecordingState(); // async function
						}

						// handle status messages for the STB
						// Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx/status
						// Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-00365657xxxx","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
						if (topic.includes('/status')) {
							if (mqttMessage.deviceType == 'STB') {
								if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: STB status: Detecting Power State: Received Message of deviceType %s for %s', mqttMessage.deviceType, mqttMessage.source); }
								// sometimes a rogue empty message appears without a mac or ipAddress, so ensure a mac is always present
								// mac.length = 0 when the box is physically offline
								if (mqttMessage.mac.length > 0) {
									deviceId = mqttMessage.source;
									stbState = mqttMessage.state;
								} else {
									deviceId = mqttMessage.source;
									stbState = mqttMessage.state;
								}
								// Box setting: StandbyPowerConsumption = FastStart / ActiveStart / EcoSlowstart
								// In FastStart the box goes to ONLINE_STANDBY when turned off, and can be turned on again over mqtt
								// In ActiveStart the box goes to ONLINE_STANDBY when turned off, and maybe changes after time? test this. 
								switch (stbState) {
									case 'ONLINE_RUNNING':	// ONLINE_RUNNING: power is on
										currStatusActive = Characteristic.Active.ACTIVE; // bool, 0 = not active, 1 = active
										currPowerState = Characteristic.Active.ACTIVE; 
										break;
									case 'ONLINE_STANDBY': // ONLINE_STANDBY: power is off, device is on standby, still reachable over the network, can be turned on via mqtt. 
										currStatusActive = Characteristic.Active.ACTIVE; // bool, 0 = not active, 1 = active
										currPowerState = Characteristic.Active.INACTIVE;
										currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
										break;
									case 'OFFLINE_NETWORK_STANDBY': // OFFLINE_NETWORK_STANDBY: power is off, device is still reachable on the network
										currStatusActive = Characteristic.Active.ACTIVE; // bool, 0 = not active, 1 = active
										currPowerState = Characteristic.Active.INACTIVE;
										currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
										break;
									case 'OFFLINE':			// OFFLINE: power is off, device is not reachable over the network
										currStatusActive = Characteristic.Active.INACTIVE; // bool, 0 = not active, 1 = active
										currPowerState = Characteristic.Active.INACTIVE;
										currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
										break;
								}
								if (parent.config.debugLevel > 0) { 
									parent.log.warn('mqttClient: %s %s ', deviceId, stbState);
								}

							}
						}

						//parent.log.warn('mqttClient: CPE.uiStatus: stbState %s, currStatusActive %s, currPowerState %s, currMediaState %s', stbState, currStatusActive, currPowerState, currMediaState); 
						
						// handle CPE UI status messages for the STB
						// topic can be many, so look for mqttMessage.type
						// Topic: 107xxxx_ch/vy9hvvxo8n6r1t3f4e05tgg590p8s0
						// Message: {"version":"1.3.10","type":"CPE.uiStatus","source":"3C36E4-EOSSTB-00365657xxxx","messageTimeStamp":1607205483257,"status":{"uiStatus":"mainUI","playerState":{"sourceType":"linear","speed":1,"lastSpeedChangeTime":1607203130936,"source":{"channelId":"SV09259","eventId":"crid:~~2F~~2Fbds.tv~~2F394850976,imi:3ef107f9a95f37e5fde84ee780c834b502be1226"}},"uiState":{}},"id":"fms4mjb9uf"}
						if (mqttMessage.type == 'CPE.uiStatus') {
							if (parent.config.debugLevel > 0) { 
								parent.log.warn('mqttClient: CPE.uiStatus: Detecting currentChannelId: Received Message of type %s for %s', mqttMessage.type, mqttMessage.source); 
							}
							if (parent.config.debugLevel > 0) {
								parent.log.warn('mqttClient: mqttMessage.status', mqttMessage.status);
								parent.log.warn('mqttClient: mqttMessage.status.uiStatus:', mqttMessage.status.uiStatus);
							}
							// if we have this message, then the power is on. Sometimes the message arrives before the status topic with the power state
							currStatusActive = Characteristic.Active.ACTIVE; // ensure statusActive is set to Active
							currPowerState = Characteristic.Active.ACTIVE;  // ensure power is set to ON

							parent.lastMqttUiStatusMessageReceived = Date.now();
							deviceId = mqttMessage.source;
							const cpeUiStatus = mqttMessage.status;
							// normal TV: 	cpeUiStatus = mainUI
							// app: 		cpeUiStatus = apps (YouTube, Netflix, etc)
							if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: CPE.uiStatus: cpeUiStatus:', cpeUiStatus); }
							if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: CPE.uiStatus: cpeUiStatus.uiStatus:', cpeUiStatus.uiStatus); }
							switch (cpeUiStatus.uiStatus) {
								case 'mainUI':
									// grab the status part of the mqttMessage object as we cannot go any deeper with json
									const playerState = cpeUiStatus.playerState;
									currSourceType = playerState.sourceType;
									if (parent.config.debugLevel > 1) { parent.log.warn('mqttClient: mainUI: Detected mqtt playerState.speed:', playerState.speed); }

									// get playerState.speed (shows if playing or paused)
									// speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
									if (playerState.speed == 0) { 			// speed 0 is PAUSE
										currMediaState = Characteristic.CurrentMediaState.PAUSE;
									} else if (playerState.speed == 1) { 	// speed 1 is PLAY
										currMediaState = Characteristic.CurrentMediaState.PLAY;
									} else {								// default for all speeds (-64 -30 -6 2 6 30 64) is LOADING
										currMediaState = Characteristic.CurrentMediaState.LOADING;
									}

									// get sourceType to set the currInputSourceType and currInputDeviceType
									// playerState.sourceType
									// linear = normal TV
									// reviewbuffer = delayed buffered TV playback
									// replay = replay TV
									// nDVR = playback from saved program (Digital Video Recorder)
									switch (playerState.sourceType) {
										case 'linear':	// ONLINE_RUNNING: power is on
										case 'reviewbuffer': 
											currInputSourceType = Characteristic.InputSourceType.TUNER;
											currInputDeviceType = Characteristic.InputDeviceType.TV; // linear TV
											break;
										case 'replay': // replay TV
										case 'nDVR':
											currInputSourceType = Characteristic.InputSourceType.OTHER;
											currInputDeviceType = Characteristic.InputDeviceType.PLAYBACK; // replay TV
											break;
									}
	

									// get channelId (current playing channel) from linear TV
									// Careful: source is not always present in the data
									if (playerState.source) {
										currChannelId = playerState.source.channelId || NO_CHANNEL_ID; // must be a string
										if (parent.config.debugLevel > 0) {
											let currentChannelName; // let is scoped to the current {} block
											let curChannel = parent.masterChannelList.find(channel => channel.channelId === currChannelId); 
											if (curChannel) { currentChannelName = curChannel.channelName; }
											parent.log.warn('mqttClient: Detected mqtt channelId: %s [%s]', currChannelId, currentChannelName);
										}
									} else {
										// if playerState.source is null, then the settop box could be playing a radio station
										// the code will pass a null through the code but no change will occur, so deliberately set a NO_CHANNEL_ID
										currChannelId = NO_CHANNEL_ID;
									}

									break;

								case 'apps':
									//parent.log('mqttClient: apps: Detected mqtt app channelId: %s', cpeUiStatus.appsState.id);
									//parent.log("mqttClient: apps: Detected mqtt app appName %s", cpeUiStatus.appsState.appName);
									// we get id and appName here, load to the channel list...
									// useful for YouTube and Netflix
									currInputSourceType = Characteristic.InputSourceType.APPLICATION;
									currInputDeviceType = Characteristic.InputDeviceType.OTHER; // apps
									switch (cpeUiStatus.appsState.id) {
				
										case 'com.bbc.app.launcher': case 'com.bbc.app.crb':
											// ignore the following apps to ensure shannel name is not overridden:
											// com.bbc.app.launcher 	button launcher app??
											// com.bbc.app.crb 			Connected Red Button app, this is the Red Button special control on the remote
											currChannelId = null; 
											parent.log("App %s [%s] detected. Ignoring", cpeUiStatus.appsState.id, cpeUiStatus.appsState.appName);
											break;
	
										default:
											// check if the app channel exists in the master channel list, if not, push it, using the user-defined name if one exists
											currChannelId = cpeUiStatus.appsState.id;
											var foundIndex = parent.masterChannelList.findIndex(channel => channel.channelId === currChannelId); 
											if (foundIndex == -1 ) {
												parent.log("App %s detected. Adding to the master channel list at index %s with channelId %s", cpeUiStatus.appsState.appName, parent.masterChannelList.length, currChannelId);
												// for easy identification, make the channelNumber app10000 + the index number
												parent.masterChannelList.push({
													channelId: currChannelId, 
													channelNumber: 'app' + (10000 + parent.masterChannelList.length), 
													channelName: cleanNameForHomeKit(cpeUiStatus.appsState.appName)
												});
											}
									}

								default:

							}
						}

						// handle CPE pushToTV messages for the STB
						// seen on VirginMedia connections in GB
						// Topic: 10950xxxx_gb/qc76wses7wfqhox2uqqteoedbyqgtt
						// Message: {	type: 'CPE.pushToTV.rsp',	source: '3C36E4-EOSSTB-003597101009',	id: 'TrgPON8eV8',	version: '1.3.12',	status: [Object]  }: 
						if (mqttMessage.type == 'CPE.pushToTV.rsp') {
							if (parent.config.debugLevel > 0) { 
								parent.log.warn('mqttClient: CPE.pushToTV.rsp: Detecting currentChannelId: Received Message of type %s for %s', mqttMessage.type, mqttMessage.source); 
							}
							if (parent.config.debugLevel > 0) {
								parent.log.warn('mqttClient: mqttMessage.status', mqttMessage.status);
							}
						}


						// update the device on every message
						parent.mqttDeviceStateHandler(deviceId, currPowerState, currMediaState, currRecordingState, currChannelId, currSourceType, null, Characteristic.StatusFault.NO_FAULT, null, currStatusActive, currInputDeviceType, currInputSourceType);
				
						//end of try
					} catch (err) {
						// catch all mqtt errors
						parent.log.error("Error trapped in mqttClient message event:", err.message);
						parent.log.error(err);
						parent.log.error("mqttmessage:");
						parent.log.error(mqttMessage);
					}
				
				}); // end of mqtt client event: message received



				// mqtt client event: close
				// Emitted after a disconnection.
				mqttClient.on('close', function () {
					try {
						//     mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, currStatusFault) 
						parent.log('mqttClient: Connection closed');
						currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
						parent.mqttDeviceStateHandler(null,	null, null,	null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
					} catch (err) {
						parent.log.error("Error trapped in mqttClient close event:", err.message);
						parent.log.error(err);
					}
				});

				// mqtt client event: reconnect
				// Emitted when a reconnect starts.
				mqttClient.on('reconnect', function () {
					try {
						//     mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, currStatusFault) 
						parent.log('mqttClient: Reconnect started');
						parent.mqttDeviceStateHandler(null,	null, null,	null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
					} catch (err) {
						parent.log.error("Error trapped in mqttClient reconnect event:", err.message);
						parent.log.error(err);
					}
				});
				
				// mqtt client event: disconnect 
				// Emitted after receiving disconnect packet from broker. MQTT 5.0 feature.
				mqttClient.on('disconnect', function () {
					try {
						//     mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, currStatusFault) 
						parent.log('mqttClient: Disconnect command received');
						currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
						parent.mqttDeviceStateHandler(null,	null, null,	null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
					} catch (err) {
						parent.log.error("Error trapped in mqttClient disconnect event:", err.message);
						parent.log.error(err);
					}
				});
				
				// mqtt client event: offline
				// Emitted when the client goes offline.
				mqttClient.on('offline', function () {
					try {
						//     mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, currStatusFault) 
						parent.log('mqttClient: Client is offline');
						currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
						parent.mqttDeviceStateHandler(null,	null, null,	null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
					} catch (err) {
						parent.log.error("Error trapped in mqttClient offline event:", err.message);
						parent.log.error(err);
					}
				});

				// mqtt client event: error
				// Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs.
				mqttClient.on('error', function(err) {
					try {
						//     mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, currStatusFault) 
						parent.log.warn('mqttClient: Error', err.code);
						if (parent.config.debugLevel > 2) { 
							parent.log.warn('mqttClient: Error details:', err); 
						}
						currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
						parent.mqttDeviceStateHandler(null,	null, null,	null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
						mqttClient.end();
						return false;
					} catch (err) {
						parent.log.error("Error trapped in mqttClient error event:", err.message);
						parent.log.error(err);
					}
				});


			} catch (err) {
				parent.log.error("Error trapped in mqttClient connect event:", err.message);
				parent.log.error(err);
				currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
			}
		}); // end of mqttClient.on('connect'... event

	} // end of startMqttClient


	// handle the state change of the device, calling the updateDeviceState of the relevant device
	mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType) {
		try {
			if (this.config.debugLevel > 1) { 
				this.log.warn('mqttDeviceStateHandler: calling updateDeviceState with deviceId %s, powerState %s, mediaState %s, channelId %s, sourceType %s, profileDataChanged %s, statusFault %s, programMode %s, statusActive %s, currInputDeviceType %s, currInputSourceType %s', deviceId, powerState, mediaState, channelId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType); 
			}
			if (this.devices) {
				const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
				if (deviceIndex > -1 && this.stbDevices.length > 0) { 
					this.stbDevices[deviceIndex].updateDeviceState(powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType); 
				}
			}
		} catch (err) {
			this.log.error("Error trapped in mqttDeviceStateHandler:", err.message);
			this.log.error(err);
		}
	}


	// publish an mqtt message, with logging, to help in debugging
	mqttPublishMessage(Topic, Message, Options) {
		try {
			// Syntax: {'test1': {qos: 0}, 'test2': {qos: 1}}
			if (this.config.debugLevel > 0) { this.log.warn('mqttPublishMessage: Publish Message:\r\nTopic: %s\r\nMessage: %s\r\nOptions: %s', Topic, Message, Options); }
			mqttClient.publish(Topic, Message, Options)
		} catch (err) {
			this.log.error("Error trapped in mqttPublishMessage:", err.message);
			this.log.error(err);
		}
	}

	// subscribe to an mqtt message, with logging, to help in debugging
	mqttSubscribeToTopic(Topic, Qos) {
		if (this.config.debugLevel > 0) { this.log.warn('mqttSubscribeToTopic: Subscribe to topic:', Topic); }
		mqttClient.subscribe(Topic, function (err) {
			if(err){
				//this.log('mqttClient connect: subscribe to %s Error %s:', Topic, err);
				return true;
			}
		});
	}

	// start the HGO session
	mqttSetHgoOnlineRunning(mqttUsername, mqttClientId) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('mqttSetHgoOnlineRunning'); }
			if (mqttUsername) {
				this.mqttPublishMessage(
					mqttUsername + '/' + mqttClientId + '/status', 
					'{"source":"' +  mqttClientId + '","state":"ONLINE_RUNNING","deviceType":"HGO"}',
					'{"qos":1,"retain":"true"}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in mqttSetHgoOnlineRunning:", err.message);
			this.log.error(err);
		}
	}

	// send a channel change request to the settopbox via mqtt
	switchChannel(deviceId, deviceName, channelId, channelName) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('switchChannel: channelId %s %s on %s %s', channelId, channelName, deviceId, deviceName); }
			this.log('Change channel to %s [%s] on %s %s', channelId, channelName, deviceName, deviceId);
			if (mqttUsername) {
				this.mqttPublishMessage(
					mqttUsername + '/' + deviceId, 
					'{"id":"' + makeId(10) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId 
					+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' 
					+ channelId + '"},"relativePosition":0,"speed":1}}',
					'{"qos":0}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in switchChannel:", err.message);
			this.log.error(err);
		}
	}

	// set the media state of the settopbox via mqtt
	// controlled by speed
	// speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
	setMediaState(deviceId, deviceName, channelId, speed) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('setMediaState: set state to %s for channelId %s on %s %s', speed, channelId, deviceId, deviceName); }
			if (mqttUsername) {
				this.mqttPublishMessage(
					mqttUsername + '/' + this.device.deviceId, 
					'{"id":"' + makeId(10) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId 
					+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' 
					+ channelId + '"},"relativePosition":0,"speed":' + speed + '}}',
					'{"qos":0}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in setMediaState:", err.message);
			this.log.error(err);
		}
	}

	// setPlayerPosition via mqtt
	// move forwards or backwards through the buffer
	// Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx
	// Message: {"id":"8b8g26joaa","type":"CPE.setPlayerPosition","source":"qcanbxjfg4cq3n99i2lmi94f9nl47v","status":{"relativePosition":410985}}
	// Retain: false, QOS: 0
	setPlayerPosition(deviceId, deviceName, relativePosition) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('setPlayerPosition: deviceId:', deviceId); }
			if (mqttUsername) {
				this.mqttPublishMessage(
				mqttUsername + '/' + deviceId, 
				'{"id":"' + makeId(10) + '","type":"CPE.setPlayerPosition","source":{"clientId":"' + mqttClientId 
				+ '","status":{"relativePosition":' + relativePosition + '}}"' ,
				'{"qos":0}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in setPlayerPosition:", err.message);
			this.log.error(err);
		}
	}


	// return to live TV
	returnToLiveTv(deviceId, deviceName) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('returnToLiveTv'); }
			if (mqttUsername) {
				this.mqttPublishMessage(
				mqttUsername + '/' + deviceId, 
				'{"id":"' + makeId(10) + '","type":"CPE.KeyEvent","source":"' + mqttClientId 
				+ '","status":{"w3cKey":"TV","eventType":"keyDownUp"}}',
				'{"qos":0}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in returnToLiveTv:", err.message);
			this.log.error(err);
		}
	}

	// send a remote control keySequence to the settopbox via mqtt
	async sendKey(deviceId, deviceName, keySequence) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('sendKey: keySequence %s, deviceName %s, deviceId %s', keySequence, deviceName, deviceId); }
			if (mqttUsername) {

				let keyArray = keySequence.trim().split(' ');
				if (keyArray.length > 1) { this.log('sendKey: processing keySequence %s for %s %s', keySequence, deviceName, deviceId); }
				// supported key1 key2 key3 wait() wait(100)
				for (let i = 0; i < keyArray.length; i++) {
					const keyName = keyArray[i].trim();
					this.log('sendKey: processing key %s of %s: %s', i+1, keyArray.length, keyName);
					
					// if a wait appears, use it
					let waitDelay; // default
					if (keyName.toLowerCase().startsWith('wait(')) {
						this.log.debug('sendKey: reading delay from %s', keyName);
						waitDelay = keyName.toLowerCase().replace('wait(', '').replace(')','');
						if (waitDelay == ''){ waitDelay = 100; } // default 100ms
						this.log.debug('sendKey: delay read as %s', waitDelay);
					}
					// else if not first key and previous key was not wait, and next key is not wait, then set a default delay of 100 ms
					 else if (i>0 && i<keyArray.length-1 && !(keyArray[i-1] || '').toLowerCase().startsWith('wait(') && !(keyArray[i+1] || '').toLowerCase().startsWith('wait(')) {
						this.log.debug('sendKey: not first key and neiher previous key %s nor next key %s is wait(). Setting default wait of 100 ms', keyArray[i-1], keyArray[i+1]);
						waitDelay = 100;
					} 
		
					// add a wait if waitDelay is defined
					if (waitDelay) {
						this.log('sendKey: waiting %s ms', waitDelay);
						await waitprom(waitDelay);
						this.log.debug('sendKey: wait %s done', waitDelay);
					}
		
					// send the key if not a wait()
					if (!keyName.toLowerCase().startsWith('wait(')) {
						this.log('sendKey: sending key %s to %s %s', keyName, deviceName, deviceId);

						this.mqttPublishMessage(
							mqttUsername + '/' + deviceId, 
							'{"id":"' + makeId(10) + '","type":"CPE.KeyEvent","source":"' + mqttClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}',
							'{"qos":0}'
						);
						this.log.debug('sendKey: send %s done', keyName);

					}
		
				} // end for loop

			}
		} catch (err) {
			this.log.error("Error trapped in sendKey:", err.message);
			this.log.error(err);
		}
	}


	// get the settopbox UI status from the settopbox via mqtt
	getUiStatus(deviceId, mqttClientId) {
		try {
			if (this.config.debugLevel > 0) {
				this.log.warn('getUiStatus');
				this.log.warn('getUiStatus deviceId %s', deviceId);
			}
			if (mqttUsername) {
				var mqttTopic = mqttUsername + '/' + deviceId;
				var mqttMessage =  '{"id":"' + makeId(10).toLowerCase() + '","type":"CPE.getUiStatus","source":"' + mqttClientId + '"}';
				this.mqttPublishMessage(
					mqttUsername + '/' + deviceId,
					'{"id":"' + makeId(10).toLowerCase() + '","type":"CPE.getUiStatus","source":"' + mqttClientId + '"}',
					'{"qos":1,"retain":"true"}'
				);
			}
		} catch (err) {
			this.log.error("Error trapped in getUiStatus:", err.message);
			this.log.error(err);
		}
	}


	// get the recording state via web request GET
	async getRecordingState(callback) {
		try {
			this.log("Refreshing recording state");
			if (this.config.debugLevel > 0) { this.log.warn('getRecordingState'); }

			// headers for the connection
			const config = {headers: {"x-cus": this.session.customer.householdId, "x-oesp-token": this.session.oespToken, "x-oesp-username": this.session.username}};

			// get all planned recordings. We only need to know if any results exist. 
			// 0 results = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED
			// >0 results = Characteristic.ProgramMode.PROGRAM_SCHEDULED
			// https://obo-prod.oesp.upctv.ch/oesp/v4/CH/eng/web/networkdvrrecordings?plannedOnly=true&range=1-20
			//const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?isAdult=false&plannedOnly=false&range=1-20'; // works
			var currProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED; // default
			var url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?plannedOnly=true&range=1-20'; // limit to 20 recordings for performance
			if (this.config.debugLevel > 0) { this.log.warn('getRecordingState: planned recordings: GET %s', url); }
			axiosWS.get(url, config)
				.then(response => {	
					if (this.config.debugLevel > 1) { this.log.warn('getRecordingState: planned recordings response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 2) { 
						this.log.warn('getRecordingState: planned recordings response data:');
						this.log.warn(response.data);
					}
					//this.log.warn('getRecordingState: planned recordings totalResults:', response.data.totalResults);
					if (response.data.totalResults > 0) { 
						currProgramMode = Characteristic.ProgramMode.PROGRAM_SCHEDULED;
					} else {
						currProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED;
					}
					if (this.config.debugLevel > 1) { this.log.warn('getRecordingState: planned recordings %s, currProgramMode set to %s [%s]', response.data.recordings.length, currProgramMode, programModeName[currProgramMode]); }
				})
				.catch(error => {
					let errText, errReason;
					errText = 'getRecordingState get planned recordings for %s failed: '
					if (error.isAxiosError) { 
						errReason = error.code + ': ' + (error.hostname || ''); 
					} else if (error.response) {
						errReason = (error.response || {}).status + ' ' + ((error.response || {}).statusText || ''); 
					} else {
						errReason = error; 
					}
					this.log('%s', (errReason || ''));
					this.log.debug(`getRecordingState get planned recordings error:`, error);
				});	


			// get all saved recordings
			// https://obo-prod.oesp.upctv.ch/oesp/v4/CH/eng/web/networkdvrrecordings?isAdult=false&plannedOnly=false&range=1-20
			//const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?isAdult=false&plannedOnly=false&range=1-20'; // works
			url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?plannedOnly=false&range=1-20'; // works
			if (this.config.debugLevel > 0) { this.log.warn('getRecordingState: GET %s', url); }
			axiosWS.get(url, config)
				.then(response => {	
					if (this.config.debugLevel > 1) { this.log.warn('getRecordingState: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 2) { 
						this.log.warn('getRecordingState: response data:');
						this.log.warn(response.data);
					}

					// find if any recordings are ongoing, and if local or network
					// loop all cpes, find and local recordings per cpe first.
					// if none found, find network recordings second
					if (response.data.recordings) { 
						// a recording carries these properties:
						// for type='single'
						// recordingState: 'ongoing', 'recorded', 'planned' or ??, for all types
						// recordingType: 'nDVR', 'localDVR', 'LDVR', 
						// cpeId: '3C36E4-EOSSTB-003597101009', only for local DVRs

						// for type='season':
						// mostRelevantEpisode.recordingState: 'ongoing',
						// mostRelevantEpisode.recordingType: 'nDVR',
						// logging
						if (this.config.debugLevel > 2) { 
							response.data.recordings.forEach((recording) => {
								this.log.warn('Recording showTitle "%s", cpeId %s, type %s, recordingState %s, recordingType %s, mostRelevantEpisode:',  recording.showTitle, recording.cpeId, recording.type, recording.recordingState, recording.recordingType, )
								this.log.warn(recording.mostRelevantEpisode )
							});
						}

						// get each device. for every recordingState update, update all devices
						// only the main device can have a HDD and thus should receive the ONGOING_LOCALDVR state
						// loop through all devices, handling devices with HDDs and devices without HDDs
						this.devices.forEach((device) => {
							var recType, recState, systemRecordingState;

							if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s...", device.deviceId); }
							if (device.capabilities.hasHDD) {
								// device has HDD, look for local recordings
								if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s. Device has a HDD:", device.deviceId); }

								if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s with HDD. Searching for ongoing local recordings for this device...", device.deviceId); }
								// first look for non-season recordings: (type = "single" or "show")
								let recordingLocal = response.data.recordings.find(recording => recording.cpeId == device.deviceId && recording.recordingState == 'ongoing');
								if (recordingLocal) {
									// found ongoing local non-season recording
									recType = recordingLocal.recordingType;
									if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: ongoing local non-season recording found for device %s with status %s %s", recordingLocal.cpeId, recordingLocal.recordingState, recordingLocal.recordingType); }

								} else {
									// if none found then look for season recordings:
									if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s with HDD. Searching for ongoing local season recordings for this device...", device.deviceId); }
									let recordingLocalSeason = response.data.recordings.find(recording => recording.cpeId == device.deviceId && recording.type == 'season' && recording.mostRelevantEpisode.recordingState == 'ongoing');
									if (recordingLocalSeason) {
										// found local ongoing season recording
										recType = recordingLocalSeason.mostRelevantEpisode.recordingType;
										if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: ongoing local season recording found with status %s %s", recordingLocalSeason.mostRelevantEpisode.recordingState, recordingLocalSeason.mostRelevantEpisode.recordingType); }

									} else {
										if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: No ongoing local recordings found"); }
										recType = 'idle';
									}

								}

							}

							// check network recordings
							if (!recType || recType == 'idle') {
								// device has no HDD, check network recordings
								if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s. Searching for ongoing network recordings for this device...", device.deviceId); }
								// first look for non-season recordings: (type = "single" or "show")
								let recordingNetwork = response.data.recordings.find(recording => !recording.cpeId && recording.recordingState == 'ongoing');
								if (recordingNetwork) {
									// found ongoing network non-season recording
									recType = recordingNetwork.recordingType;
									if (this.config.debugLevel >= 0) { this.log.warn("getRecordingState: ongoing network non-season recording found with status %s %s", recordingNetwork.recordingState, recordingNetwork.recordingType); }

								} else {
									// if none found then look for season or show recordings: (type = "season") type = show also exists
									if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Checking device %s. Searching for ongoing network season recordings for this device...", device.deviceId); }
									let recordingNetworkSeason = response.data.recordings.find(recording => recording.type == 'season' && recording.mostRelevantEpisode.recordingState == 'ongoing');
									if (recordingNetworkSeason) {
										recType = recordingNetworkSeason.mostRelevantEpisode.recordingType;
										if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: ongoing network season recording found with status %s %s", recordingNetworkSeason.mostRelevantEpisode.recordingState, recordingNetworkSeason.mostRelevantEpisode.recordingType); }

									} else {
										if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: No ongoing network recordings found"); }
										recType = 'idle';
									}
								}
							}

							// local has prio over network
							if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Setting recState for %s according to recType %s", device.deviceId, recType); }
							if (recType == 'localDVR' || recType == 'LDVR') { 
								recState = recordingState.ONGOING_LOCALDVR;
							} else if (recType == 'nDVR') { 
								recState = recordingState.ONGOING_NDVR;
							} else {
								recState = recordingState.IDLE;
							}

							// update the device state. Set StatusFault to nofault as connection is working
							if (this.config.debugLevel > 2) { this.log.warn("getRecordingState: Updating device state for %s to recState %s %s", device.deviceId, recState, recType); }
							//mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault, programMode) {
							this.mqttDeviceStateHandler(device.deviceId, null, null, recState, null, null, null, Characteristic.StatusFault.NO_FAULT, currProgramMode );
							});

					}


					return false;
				})
				.catch(error => {
					let errText, errReason;
					errText = 'getRecordingState for %s failed: '
					if (error.isAxiosError) { 
						errReason = error.code + ': ' + (error.hostname || ''); 
					} else if (error.response) {
						errReason = (error.response || {}).status + ' ' + ((error.response || {}).statusText || ''); 
					} else {
						errReason = error; 
					}
					this.log('%s', (errReason || ''));
					this.log.debug(`getRecordingState error:`, error);

					return false, error;
				});		
			return false;

		} catch (err) {
			this.log.error("Error trapped in getRecordingState:", err.message);
			this.log.error(err);
		}
	}


	// get the Personalization Data via web request GET
	async getPersonalizationData(requestType, callback) {
		this.log("Refreshing personalization data for %s", requestType);
		if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData requestType:', requestType); }

		const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.customer.householdId) + '/' + requestType;
		const config = {headers: {"x-cus": this.session.customer.householdId, "x-oesp-token": this.session.oespToken, "x-oesp-username": this.session.username}};
		if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: GET %s', url); }
		// this.log('getPersonalizationData: GET %s', url);
		axiosWS.get(url, config)
			.then(response => {	
				if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: %s: response: %s %s', requestType, response.status, response.statusText); }
				if (this.config.debugLevel > 2) { 
					this.log.warn('getPersonalizationData: %s: response data:', requestType);
					this.log.warn(response.data);
				}
				if (requestType.includes('profiles')) { 
					this.profiles = response.data; // set this.profiles to the profile data we just received

					// for every profiles data update, update all devices as closedCaptions may have changed
					// but only if stbDevices has been created...
					if (this.stbDevices.length > 0) {
						this.devices.forEach((device) => {
							device.profiles = this.profiles; // update the device with the profiles array
							// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault) {
							this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, true, Characteristic.StatusFault.NO_FAULT );
						});
					}

				}
				else if (requestType.includes('devices')) { 
					// devices can be an array or a single device
					if (Array.isArray(response.data)) {
						this.devices = response.data; // store the entire device array at platform level
			
						// update all the devices in the array. Don't trust the index order in the Personalization Data message
						this.devices.forEach((device) => {
							const deviceId = device.deviceId;
							const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
							if (deviceIndex > -1 && this.stbDevices[deviceIndex]) { 
								this.stbDevices[deviceIndex].device = device;
								this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, null, Characteristic.StatusFault.NO_FAULT ); // update one device
							}
						});

					} else {
						// data for a single device, find and update the device
						const deviceId = response.data.deviceId;
						const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
						if (deviceIndex > -1) { 
							this.stbDevices[deviceIndex].device = response.data; 
							this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, null, Characteristic.StatusFault.NO_FAULT ); // update one device
						}
				
					}

				}
				return false;
			})
			.catch(error => {
				let errText, errReason;
				errText = 'Failed to refresh personalization data for ' + requestType + ' - check your internet connection:'
				if (error.isAxiosError) { errReason = error.code + ': ' + (error.hostname || ''); }
				this.log('%s %s', errText, (errReason || ''));
				this.log.debug(`refreshMasterChannelList error:`, error);

				return false, error;
			});		
		return false;
	}

	// set the Personalization Data for the current device via web request PUT
	async setPersonalizationDataForDevice(deviceId, deviceSettings, callback) {
		if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: deviceSettings:', deviceSettings); }
		const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.customer.householdId) + '/devices/' + deviceId;
		const data = {"settings": deviceSettings};
		const config = {headers: {"x-cus": this.session.customer.householdId, "x-oesp-token": this.session.oespToken, "x-oesp-username": this.session.username}};
		if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: PUT %s', url); }
		axiosWS.put(url, data, config)
			.then(response => {	
				if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: response: %s %s', response.status, response.statusText); }
				return false;
			})
			.catch(error => {
				this.log.warn('setPersonalizationDataForDevice failed: %s %s', error.response.status, error.response.statusText);
				this.log.debug('setPersonalizationDataForDevice: error:', error);
				return true, error;
			});		
		return false;
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler mqtt
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++



}





































class stbDevice {
	// build the device
	constructor(log, config, api, device, platform) {
		this.log = log;
		this.config = config;
		this.api = api;
		this.device = device;
		this.platform = platform;

		this.deviceId = this.device.deviceId
		this.profileId = -1; // default -1

		// set default name on restart
		this.name = this.device.settings.deviceFriendlyName + PLUGIN_ENV; // append DEV environment

		// allow user override of device name via config
		if (this.config.devices) {
			const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice && configDevice.name) { this.name = configDevice.name; }
		}

		
		// ++++++++++++++++ plugin setup ++++++++++++++++
		// setup arrays
		this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.channelList = [];	// loaded channels, as shown in the Home app. Limited to 96
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 96
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL

		//setup variables
		this.lastPowerKeySent;				// stores when the power key was sent last to help in de-bounce
		this.targetMediaState = Characteristic.TargetMediaState.STOP; // default until received by mqtt
		this.accessoryConfigured;		// true when the accessory is configured

		// initial states. Will be updated by mqtt messages
		this.currentPowerState = Characteristic.Active.INACTIVE;
		this.previousPowerState = Characteristic.Active.INACTIVE;
		this.currentChannelId = NO_CHANNEL_ID;
		this.currentClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
		this.previousClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
		this.currentMediaState = Characteristic.CurrentMediaState.STOP;
		this.targetMediaState = Characteristic.CurrentMediaState.STOP;
		this.currentPictureMode = Characteristic.PictureMode.STANDARD;
		this.previousPictureMode = null;
		this.currentRecordingState = recordingState.IDLE;
		this.previousRecordingState = null;
		this.customPictureMode = 0; // default 0
		this.currentSourceType = 'UNKNOWN';
		// custom characteristics, default values must be legal values otherwise Homebridge shows a warning
		this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
		this.currentInUse = Characteristic.InUse.NOT_IN_USE;
		this.currentProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED;
		this.currentStatusActive = Characteristic.Active.ACTIVE;; // bool,  use o=NotStatusActive, 1=StatusActive
		this.currentInputSourceType = Characteristic.InputSourceType.TUNER;
		this.currentInputDeviceType = Characteristic.InputDeviceType.TV;


		this.lastRemoteKeyPressed = -1;	// holds the last key pressed, -1 = no key
		this.lastRemoteKeyPress0 = [];	// holds the time value of the last remote button press for key index i
		this.lastRemoteKeyPress1 = [];	// holds the time value of the last-1 remote button press for key index i
		this.lastRemoteKeyPress2 = [];	// holds the time value of the last-2 remote button press for key index i
		this.lastVolDownKeyPress = [];  // holds the time value of the last button press for the volume down button


		// do an initial accessory channel update, required to configure the accessory
		this.refreshChannelList(this.deviceId); // async function

		// plugin setup done, session and channels loaded, can load 

		// wait 5s for the accessory channel list to load then continue
		wait(3*1000).then(() => { 
			this.accessoryConfigured = false;
			this.prepareAccessory();
			this.log('%s: Initialization completed', this.name);
		})

	}


  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// Prepare accessory
	prepareAccessory() {
		if (this.config.debugLevel > 2) { this.log.warn('prepareAccessory'); }
		// exit immediately if being configured or already configured (runs from session watchdog)
		if (this.accessoryConfigured) { return }

		this.log('%s: Initializing accessory...', this.name);

		// start configuring
		// accessory name is customerDefinedName + last 4 characters of physicalDeviceId
		// const accessoryName = this.devices[deviceId].customerDefinedName + " " + this.devices[deviceId].physicalDeviceId.slice(this.devices[deviceId].physicalDeviceId.length - 4);
		const accessoryName = this.name;
		// generate accessoryUUID from a constant that won't change in the lifetime of the device, this is the device.deviceId 3C36E4-EOSSTB-00365657xxxx
		// must be different between debug (development) instance and release instance
		const uuidSeed = this.device.deviceId + PLUGIN_ENV;
		const accessoryUUID = UUID.generate(uuidSeed); 
		//this.UUID = accessoryUUID; // fix bug in v1.1.x where it wouldn't find box 2

		// set one of the three suitable accessory categories, see https://developers.homebridge.io/#/categories
		// get a custom configDevice if one exists
		var configDevice = {};
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (!configDevice) { configDevice = {} }
		}
		let accessoryCategory = Categories.TV_SET_TOP_BOX; // default TV_SET_TOP_BOX
		if (configDevice.accessoryCategory) {
			// allow various media devices
			switch(configDevice.accessoryCategory.toLowerCase()) {
				case 'speaker':
					accessoryCategory = Categories.SPEAKER;				break;
				case 'settopbox': case 'stb':
					accessoryCategory = Categories.TV_SET_TOP_BOX;		break;
				case 'television': case 'tv':
					accessoryCategory = Categories.TELEVISION;			break;
				case 'receiver': case 'audio-receiver': case 'avr':
					accessoryCategory = Categories.AUDIO_RECEIVER;		break;
			}
		}

		// creates a new accessory with a AccessoryInformation service
		this.accessory = new Accessory(accessoryName, accessoryUUID, accessoryCategory);

		// store custom data
		this.accessory.context.devices = this.devices;
		this.accessory.context.session = this.session;

		this.prepareAccessoryInformationService();		// service 1 of 100
		this.prepareTelevisionService();				// service 2 of 100
		this.prepareTelevisionSpeakerService();			// service 3 of 100
		this.prepareInputSourceServices();				// service 4...100 of 100
		this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);

		// set displayOrder
		this.televisionService.getCharacteristic(Characteristic.DisplayOrder)
			.value = Buffer.from(this.displayOrder).toString('base64');

		// set default to no input
		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(NO_INPUT_ID)
		this.accessoryConfigured = true;
	}


	//Prepare AccessoryInformation service
	prepareAccessoryInformationService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareAccessoryInformationService');
		}

		var manufacturer, model, serialnumber, firmwareRevision;

		// get a custom configDevice if one exists
		var configDevice = {};
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (!configDevice) { configDevice = {} }
		}

		const ver = PLUGIN_VERSION.split("-");
		const deviceType = this.device.deviceId.split("-");

		switch (deviceType[0]) {
			// 000378-EOSSTB-003893xxxxxx Ireland
			case '3C36E4': case '000378':
				manufacturer = 'ARRIS [' + (this.device.platformType || '') + ']'; // NL uses EOS as platformType
				model = 'DCX960 [' + (this.device.deviceType || '') + ']'; // NL has no deviceType in their device settings
				serialnumber = this.device.deviceId; // same as shown on TV
				firmwareRevision = configDevice.firmwareRevision || ver[0]; // must be numeric. Non-numeric values are not displayed
				break;
			default:
				manufacturer = this.device.platformType || PLATFORM_NAME;
				model = this.device.deviceType || PLUGIN_NAME;
				serialnumber = this.device.deviceId; // same as shown on TV
				firmwareRevision = configDevice.firmwareRevision || ver[0]; // must be numeric. Non-numeric values are not displayed
		}
		this.log("%s: Set Manufacturer to %s", this.name, manufacturer);
		this.log("%s: Set Model to %s", this.name, model);
		this.log("%s: Set Serial Number to %s", this.name, serialnumber);
		this.log("%s: Set Firmware to %s", this.name, firmwareRevision);

		// remove the service that got created when the accessory was created and make a new one
		this.accessory.removeService(this.accessory.getService(Service.AccessoryInformation));
		const informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, manufacturer)
			.setCharacteristic(Characteristic.Model, model)
			.setCharacteristic(Characteristic.SerialNumber, serialnumber)
			.setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision);
		this.accessory.addService(informationService);

		// debug: show content of service
		//let svc = this.accessory.getService(Service.AccessoryInformation);
		//this.log("svc", svc); 

	}

	//Prepare Television service
	prepareTelevisionService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareTelevisionService');
		}


		// check syncName, default to true if not found
		var syncName = true;
		if (this.config.devices) {
			const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			syncName = (configDevice || {}).syncName;
			if (syncName == null) { syncName = true }
		}

		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService
			.setCharacteristic(Characteristic.ConfiguredName, this.name)
			.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
			.setCharacteristic(Characteristic.CurrentMediaState, Characteristic.CurrentMediaState.STOP)
			.setCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.STOP)
			.setCharacteristic(Characteristic.ClosedCaptions, Characteristic.ClosedCaptions.DISABLED)
			.setCharacteristic(Characteristic.PictureMode, Characteristic.PictureMode.STANDARD)
			// extra characteristics added here are accessible in Shortcuts and Automations (both personal and home)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT) // NO_FAULT or GENERAL_FAULT
			.setCharacteristic(Characteristic.InUse, Characteristic.InUse.NOT_IN_USE) // NOT_IN_USE or IN_USE
			.setCharacteristic(Characteristic.ProgramMode, Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED) // NO_PROGRAM_SCHEDULED or PROGRAM_SCHEDULED or PROGRAM_SCHEDULED_MANUAL_MODE_
			.setCharacteristic(Characteristic.StatusActive, Characteristic.Active.ACTIVE) // bool, 0 = NotStatusActive, 1=StatusActive
			.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
			;
				
		// characteristics actively controlled in the current Apple Home app 
		
		// power
		this.televisionService.getCharacteristic(Characteristic.Active)
			.on('get', this.getPower.bind(this))
			.on('set', this.setPower.bind(this));
		
		// accessory name
		this.televisionService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', this.getDeviceName.bind(this))
			.on('set', (newName, callback) => { this.setDeviceName(newName, callback); });

		// limit name length only if syncing name is enabled
		if (syncName == true) {
			this.televisionService.getCharacteristic(Characteristic.ConfiguredName)
				.setProps({ 
					maxLen: SETTOPBOX_NAME_MAXLEN // generates a "Could not edit accessory" "Please enter a shorter name" error in Home app for the accessory name
				});
		}

		// active channel
		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInput.bind(this))
			.on('set', (inputIdentifier, callback) => { this.setInput(this.channelList[inputIdentifier-1], callback); });

		// the View TV Settings menu item
		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		// display order of the channels
		this.televisionService.getCharacteristic(Characteristic.DisplayOrder)
			.on('get', this.getDisplayOrder.bind(this))
			.on('set', (newDisplayOrder, callback) => { this.setDisplayOrder(newDisplayOrder, callback); });



		// characteristics that cannot be controlled in the current Apple Home app 
		
		// closed captions / subtitles
		this.televisionService.getCharacteristic(Characteristic.ClosedCaptions)
			.on('get', this.getClosedCaptions.bind(this))
			//.on('set', (newClosedCaptionsState, callback) => { this.setClosedCaptions(newClosedCaptionsState, callback); }); // not supported

		// picture mode, controls the screen display
		this.televisionService.getCharacteristic(Characteristic.PictureMode)
			.on('get', this.getPictureMode.bind(this))
			//.on('set', (newPictureMode, callback) => { this.setPictureMode(newPictureMode, callback); }); // not supported

		// current media state (play, pause etc)
		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		// wanted media state (play, pause etc)
		this.televisionService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (newMediaState, callback) => { this.setTargetMediaState(newMediaState, callback); });

		// extra characteristics added here are accessible in Shortcuts and Automations (both personal and home)
		// gneral fault
		this.televisionService.getCharacteristic(Characteristic.StatusFault)
			.on('get', this.getStatusFault.bind(this));
		
		// set-top box in use
		this.televisionService.getCharacteristic(Characteristic.InUse)
			.on('get', this.getInUse.bind(this));

		// current program mode (recording scheduled, not scheduled)
		this.televisionService.getCharacteristic(Characteristic.ProgramMode)
			.on('get', this.getProgramMode.bind(this));

		// current StatusActive state
		this.televisionService.getCharacteristic(Characteristic.StatusActive)
			.on('get', this.getStatusActive.bind(this));

		// current InputDeviceType state
		this.televisionService.getCharacteristic(Characteristic.InputDeviceType)
			.on('get', this.getInputDeviceType.bind(this));




		// actively controled charateristics in the current Apple TV Remote app
		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));


		// add to the accessory
		this.accessory.addService(this.televisionService);

	}

	//Prepare TelevisionSpeaker service
	prepareTelevisionSpeakerService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareTelevisionSpeakerService');
		}
		this.speakerService = new Service.TelevisionSpeaker(this.name + ' Speaker', 'speakerService');
		this.speakerService
			.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
		this.speakerService.getCharacteristic(Characteristic.VolumeSelector)  // the volume selector allows the iOS device keys to be used to change volume
			.on('set', (direction, callback) => { this.setVolume(direction, callback); });
		this.speakerService.getCharacteristic(Characteristic.Volume)
			.on('set', this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
			.on('set', this.setMute.bind(this));

		this.accessory.addService(this.speakerService);
		this.televisionService.addLinkedService(this.speakerService);
	}
	

	//Prepare InputSource services
	prepareInputSourceServices() {
		// This is the channel list, each input is a service, max 100 services less the services created so far
		// Accessory must be setup before publishing, otherwise HomeKit will nuke all the old services, and then re-discover them again, causing issues
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareInputSourceServices');
		}

		// limit the amount of max channels to load
		// Total services = absolute max 99 services (all types)
		// robustness: hard limit to 95 (channels 0...94) in case user does a stupid config
		var maxSources = MAX_INPUT_SOURCES;
		let configDevice;
		if (this.config.devices) {
			// get a custom configDevice if one exists, used for adding channelNumber
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			 // update maxSources only if found
			if (configDevice) { 
				this.log.debug("prepareInputSourceServices: config found for configDevice.maxChannels:", configDevice.maxChannels);
				// get any custom maxChannels, set per device. Caution: maxChannels may not exist!
				maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
			}
		}

		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// must create all input sources before accessory is published (no way to dynamically add later)
		this.log.debug("prepareInputSourceServices: maxSources", maxSources);
		this.log.debug("prepareInputSourceServices: loading channels from this.channelList, length:", this.channelList.length);
		this.displayOrder = [];

		// index 0 is identifier 1, etc, needed for displayOrder
		for (let i = 1; i <= maxSources; i++) {
			if (this.config.debugLevel > 2) {
				this.log.warn('prepareInputSourceServices Adding service',i, this.channelList[i-1].channelName);
			}

			// default values to hide the input if nothing exists in this.channelList
			var chFixedName = `Input ${i < 10 ? `0${i}` : i}`; // fixed if not profile 0
			var chName = 'HIDDEN';
			var chId = 'HIDDEN_' + i;
			var visState = Characteristic.CurrentVisibilityState.HIDDEN;
			var configState = Characteristic.IsConfigured.NOT_CONFIGURED;

			// get names and channel id from the array
			//this.log("this.channelList.length", this.channelList.length);
			//this.log(this.channelList);
			// index 0 = channel 1
			if (i <= this.channelList.length && this.channelList[i-1]) {
				chName = this.channelList[i-1].channelName;
				chId = this.channelList[i-1].channelId;
				visState = this.channelList[i-1].channelVisibilityState;
				configState = Characteristic.IsConfigured.CONFIGURED;
			}

			// some channels are deliberately hidden, so assign a fictional channelId and disable them
			if (chName == 'HIDDEN' || chName == ('0' + i).slice(-2) + " HIDDEN") {
				chId = 'HIDDEN_' + i;
				visState = Characteristic.CurrentVisibilityState.HIDDEN;
				configState = Characteristic.IsConfigured.NOT_CONFIGURED;
			}

			// Fixed Name can only be set to channel name for SharedProfile where the channel order can never be changed
			// for custom profies, Name has to be generic as channel list order can be changed any time
			// and HomeKit doesn't keep Name up to date
			if (this.profileId == 0) { chFixedName = chName; }

			//const inputService = new Service.InputSource(i, 'inputSource_' + 1 + '_' + chId);
			// Service.InputSource(Identifier, subType, name);
			this.log.debug("prepareInputSourceServices: Adding input %s with chId %s, chName [%s], configState %s, visState %s", i, chId, chName, configState, visState);
			const inputService = new Service.InputSource(i, 'input_' + chId, chId);
			inputService
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.Name, chFixedName)
				.setCharacteristic(Characteristic.ConfiguredName, chName || `Input ${i < 9 ? `0${i}` : i}`)
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION) 
				.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
				.setCharacteristic(Characteristic.IsConfigured, configState)
				.setCharacteristic(Characteristic.CurrentVisibilityState, visState)
				.setCharacteristic(Characteristic.TargetVisibilityState, visState);

			inputService.getCharacteristic(Characteristic.ConfiguredName)
				.on('get', (callback) => { this.getInputName(i, callback); })
				.on('set', (value, callback) => { this.setInputName(i, value, callback); });

			inputService.getCharacteristic(Characteristic.CurrentVisibilityState)
				.on('get', (callback) => { this.getInputVisibilityState(i, callback) });

			inputService.getCharacteristic(Characteristic.TargetVisibilityState)
				.on('get', (callback) => { this.getInputVisibilityState(i, callback) })
				.on('set', (value, callback) => { this.setInputVisibilityState(i, value, callback); });

			this.inputServices.push(inputService);

			// add DisplayOrder, see :
			// https://github.com/homebridge/HAP-NodeJS/issues/644
			// https://github.com/ebaauw/homebridge-zp/blob/master/lib/ZpService.js  line 916: this.displayOrder.push(0x01, 0x04, identifier & 0xff, 0x00, 0x00, 0x00)
			//this.displayOrder.push(0x01, 0x04, i & 0xff, 0x00, 0x00, 0x00);
			//                       type  len   inputId  empty empty empty
			//this.displayOrder.push(0x01, 0x04,       i, 0x00, 0x00, 0x00);
			// inputId is the inputIdentifier (not the index), starting index 0 = identifier 1
			// types:
			// 	0x00 end of TLV item
			// 	0x01 identifier...new TLV item for displayOrder
			// length:	Number of following bytes, excluding type and len fields
			// value:	A number of <len> bytes. Can be mepty if length=0
			// 0x01 0x01 xx is a valid TLV8 as it contains only 1 data byte.
			// the data must be a single 8-bit byte, hence the logical AND with 0xff
			this.displayOrder.push(0x01, 0x01, i & 0xff); // 0x01 0x01 0xXX

			this.accessory.addService(inputService);
			this.televisionService.addLinkedService(inputService);

		} // end of for loop getting the inputSource

		// close off the TLV8 by sending 0x00 0x00
		this.displayOrder.push(0x00, 0x00); // close off the displayorder array with 0x00 0x00
		//this.log("this.displayOrder")
		//this.log(this.displayOrder)

	}
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
















	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state changed to async
	//async updateDeviceState(powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, callback) {
	async updateDeviceState(powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault, programMode, statusActive, inputDeviceType, inputSourceType, callback) {
			try {
			// runs at the very start, and then every few seconds, so don't log it unless debugging
			// doesn't get the data direct from the settop box, but rather: gets it from the this.currentPowerState and this.currentChannelId variables
			// which are received by the mqtt messages, which occurs very often
			if (this.config.debugLevel > 0) {
				this.log.warn('%s: updateDeviceState: powerState %s, mediaState %s [%s], recordingState %s [%s], channelId %s, sourceType %s, profileDataChanged %s, statusFault %s [%s], programMode %s [%s]', 
					this.name, 
					powerState, 
					mediaState, mediaStateName[mediaState], 
					recordingState, recordingStateName[recordingState], 
					channelId,
					sourceType,
					profileDataChanged,
					statusFault, statusFaultName[statusFault], 
					programMode, programModeName[programMode]
				);
			}

			// get the config for the device, needed for a few status checks
			var configDevice;
			if (this.config.devices) {
				configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			}

			

			

			// grab the input variables
			if (powerState != null) { this.currentPowerState = powerState; }
			if (mediaState != null) { this.currentMediaState = mediaState; }
			if (recordingState != null) { this.currentRecordingState = recordingState; }
			if (channelId != null) { this.currentChannelId = channelId; }
			if (sourceType != null) { this.currentSourceType = sourceType; }
			this.profileDataChanged = profileDataChanged || false;
			if (statusFault != null) { this.currentStatusFault = statusFault; }
			if (programMode != null) { this.currentProgramMode = programMode; }
			if (statusActive != null) { this.currentStatusActive = statusActive; }
			if (inputDeviceType != null) { this.currentInputDeviceType = inputDeviceType; }
			if (inputSourceType != null) { this.currentInputSourceType = inputSourceType; }
			
			
			
			// set the inUse state as a combination of power state and recording state. Added from v1.2.1
			// 1 (IN_USE) when box is on or is recording 
			// 0 (NOT_IN_USE) when box is off and not recording
			if ((this.currentPowerState == Characteristic.Active.ACTIVE) || (this.currentRecordingState == 2)) {  // 2=ONGOING_LOCALDVR
				this.currentInUse = Characteristic.InUse.IN_USE;
			} else {
				this.currentInUse = Characteristic.InUse.NOT_IN_USE;
			}


			// profile data is stored on the platform
			// get the currentClosedCaptionsState from the currently selected profile (stored in this.profileid)
			//var configDevice = {};
			if ( this.platform.profiles[this.profileId] && this.platform.profiles[this.profileId].options.showSubtitles ) {
				this.currentClosedCaptionsState = Characteristic.ClosedCaptions.ENABLED;
			} else {
				this.currentClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
			}

			// debugging, helps a lot to see channelName
			if (this.config.debugLevel > 0) {
				let curChannel, currentChannelName;
				if (this.platform.masterChannelList) {
					curChannel = this.platform.masterChannelList.find(channel => channel.channelId === this.currentChannelId ); 
					if (curChannel) { currentChannelName = curChannel.channelName; }
				}
				this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentRecordingState %s [%s], currentChannelId %s [%s], currentSourceType %s, currentClosedCaptionsState %s [%s], currentPictureMode %s [%s], profileDataChanged %s, currentStatusFault %s [%s], currentProgramMode %s [%s], currentStatusActive %s', 
					this.name, 
					this.currentPowerState, 
					this.currentMediaState, mediaStateName[this.currentMediaState], 
					this.currentRecordingState, recordingStateName[this.currentRecordingState],
					this.currentChannelId, currentChannelName,
					this.currentSourceType,
					this.currentClosedCaptionsState, closedCaptionsStateName[this.currentClosedCaptionsState],
					this.currentPictureMode, pictureModeName[this.currentPictureMode],
					this.profileDataChanged,
					this.currentStatusFault, statusFaultName[this.currentStatusFault],
					this.currentProgramMode, programModeName[this.currentProgramMode],
					this.currentStatusActive
				);
			}

			// only continue if a session was created. If the internet conection is down then we have no session
			if (currentSessionState != sessionState.CONNECTED) { return null; }


			// change only if configured, and update only if changed
			if (this.televisionService) {

				
				// set device name if changed, it may have changed due to personalisation update
				// new name is always in this.device.settings.deviceFriendlyName; 
				//this.log('updateDeviceState this.name %s, this.device.settings.deviceFriendlyName %s', this.name, this.device.settings.deviceFriendlyName );
				var oldDeviceName = this.name;
				var currentDeviceName = this.device.settings.deviceFriendlyName + PLUGIN_ENV;;

				var syncName = true; // default true		
				if (configDevice && configDevice.syncName == false ) { syncName = configDevice.syncName; }
				if (syncName == true && oldDeviceName !== currentDeviceName) {
					this.log("%s: Device name changed from '%s' to '%s'", 
						this.name,
						oldDeviceName, 
						currentDeviceName);
					this.name = currentDeviceName;
					this.televisionService.getCharacteristic(Characteristic.ConfiguredName).updateValue(currentDeviceName);
				}
				
				// check for change of StatusFault state
				if (this.previousStatusFault !== this.currentStatusFault) {
					this.log('%s: Status Fault changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousStatusFault, statusFaultName[this.previousStatusFault],
						this.currentStatusFault, statusFaultName[this.currentStatusFault]);
				}
				this.televisionService.getCharacteristic(Characteristic.StatusFault).updateValue(this.currentStatusFault);
				this.previousStatusFault = this.currentStatusFault;
	

				// check for change of StatusActive state
				if (this.previousStatusActive !== this.currentStatusActive) {
					this.log('%s: Status Active changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousStatusActive, statusActiveName[this.previousStatusActive],
						this.currentStatusActive, statusActiveName[this.currentStatusActive]);
				}
				this.televisionService.getCharacteristic(Characteristic.StatusActive).updateValue(this.currentStatusActive);
				this.previousStatusActive = this.currentStatusActive;


				// check for change of power state
				// The accessory changes state immediately, and the box takes time to catch up
				// so store an old box state so we have something to log
				//this.log("Previous device power state: %s %s", this.previousPowerState, powerStateName[this.previousPowerState]);
				//this.log("Current device power state: %s %s", this.televisionService.getCharacteristic(Characteristic.Active).value, powerStateName[this.televisionService.getCharacteristic(Characteristic.Active).value]);
				//this.log("Wanted device power state: %s %s", this.currentPowerState, powerStateName[this.currentPowerState]);
				//var oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
				if (this.previousPowerState !== this.currentPowerState) {
					this.log('%s: Power changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousPowerState, powerStateName[this.previousPowerState],
						this.currentPowerState, powerStateName[this.currentPowerState]);
				}
				this.televisionService.getCharacteristic(Characteristic.Active).updateValue(this.currentPowerState);
				this.previousPowerState = this.currentPowerState;


				// check for change of InUse state
				if (this.previousInUse !== this.currentInUse) {
					this.log('%s: In Use changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousInUse, inUseName[this.previousInUse],
						this.currentInUse, inUseName[this.currentInUse]);
				}
				this.televisionService.getCharacteristic(Characteristic.InUse).updateValue(this.currentInUse);
				this.previousInUse = this.currentInUse;


				// check for change of closed captions state
				//this.log("Previous closed captions state: %s %s", this.previousClosedCaptionsState, closedCaptionsStateName[this.previousClosedCaptionsState]);
				//this.log("Current closed captions state: %s %s", this.televisionService.getCharacteristic(Characteristic.ClosedCaptions).value, closedCaptionsStateName[this.televisionService.getCharacteristic(Characteristic.ClosedCaptions).value]);
				//this.log("Wanted closed captions state: %s %s", this.currentClosedCaptionsState, closedCaptionsStateName[this.currentClosedCaptionsState]);
				if (this.previousClosedCaptionsState !== this.currentClosedCaptionsState) {
					this.log('%s: Closed Captions state changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousClosedCaptionsState, closedCaptionsStateName[this.previousClosedCaptionsState],
						this.currentClosedCaptionsState, closedCaptionsStateName[this.currentClosedCaptionsState]);
				}
				this.televisionService.getCharacteristic(Characteristic.ClosedCaptions).updateValue(this.currentClosedCaptionsState);
				this.previousClosedCaptionsState = this.currentClosedCaptionsState;


				// check for change of picture mode or recordingState (both stored in picture mode)
				if ((configDevice || {}).customPictureMode == 'recordingState') {
					// PictureMode is used for recordingState function, this is a custom characteristic, not supported by HomeKit. we can use values 0...7
					//this.log("previousRecordingState", this.previousRecordingState);
					//this.log("currentRecordingState", this.currentRecordingState);
					if (this.previousRecordingState !== this.currentRecordingState) {
						this.log('%s: Recording State changed from %s [%s] to %s [%s]', 
							this.name,
							this.previousRecordingState, recordingStateName[this.previousRecordingState],
							this.currentRecordingState, recordingStateName[this.currentRecordingState]);
					}
					//this.log("configDevice.customPictureMode found %s, setting PictureMode to %s", (configDevice || {}).customPictureMode, this.currentRecordingState);
					this.customPictureMode = this.currentRecordingState;
					this.previousRecordingState = this.currentRecordingState;
				} else {
					// PictureMode is used for default function: pictureMode
					//this.log("previousPictureMode", this.previousPictureMode);
					//this.log("currentPictureMode", this.currentPictureMode);
					if (this.previousPictureMode !== this.currentPictureMode) {
						this.log('%s: Picture Mode changed from %s [%s] to %s [%s]', 
							this.name,
							this.previousPictureMode, pictureModeName[this.previousPictureMode],
							this.currentPictureMode, pictureModeName[this.currentPictureMode]);
					}
					//this.log("configDevice.customPictureMode not found %s, setting PictureMode to %s", (configDevice || {}).customPictureMode, this.currentPictureMode);
					this.customPictureMode = this.currentPictureMode;
					this.previousPictureMode = this.currentPictureMode;
				}
				//this.log("setting PictureMode to %s", this.customPictureMode);
				this.televisionService.getCharacteristic(Characteristic.PictureMode).updateValue(this.customPictureMode);


				// check for change of ProgramMode state
				if (this.previousProgramMode !== this.currentProgramMode) {
					this.log('%s: Program Mode changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousProgramMode, programModeName[this.previousProgramMode],
						this.currentProgramMode, programModeName[this.currentProgramMode]);
				}
				this.televisionService.getCharacteristic(Characteristic.ProgramMode).updateValue(this.currentProgramMode);
				this.previousProgramMode = this.currentProgramMode;


				// check for change of InputSourceType state
				// this is part of inputService which is an array... need to adapt code to get it to work properly
				/*
				if (this.previousInputSourceType !== this.currentInputSourceType) {
					this.log('%s: Input Source Type changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousInputSourceType, inputSourceTypeName[this.previousInputSourceType],
						this.currentInputSourceType, inputSourceTypeName[this.currentInputSourceType]);
				}
				//this.televisionService.inputService.getCharacteristic(Characteristic.InputSourceType).updateValue(this.currentInputSourceType); // generates Homebridge warning
				this.previousInputSourceType = this.currentInputSourceType;
				*/


				// check for change of InputDeviceType state
				if (this.previousInputDeviceType !== this.currentInputDeviceType) {
					this.log('%s: Input Device Type changed from %s [%s] to %s [%s]', 
						this.name,
						this.previousInputDeviceType, inputDeviceTypeName[this.previousInputDeviceType],
						this.currentInputDeviceType, inputDeviceTypeName[this.currentInputDeviceType]);
				}
				this.televisionService.getCharacteristic(Characteristic.InputDeviceType).updateValue(this.currentInputDeviceType);
				this.previousInputDeviceType = this.currentInputDeviceType;


				// check for change of active identifier (channel)
				// temporarily wrapped this in a try-catch to capture any errors
				//this.log("Before error trap");
				try {
					var searchChannelId = this.currentChannelId;
					//this.log("DEBUG: checking searchChannelId", searchChannelId);
					var currentActiveIdentifier  = 0;
					// if the current channel id is an app, search by channel name name, and not by channel id
					if (searchChannelId && searchChannelId.includes('.app.')) {
						// the current channel is an app, eg Netflix
						this.log("This channel is an app, looking for this app in the masterChannelList: ", searchChannelId)
						// get the name from the master channel list
						var masterChannelApp = this.platform.masterChannelList.find(channel => channel.channelId === searchChannelId ); 
						//this.log("found masterChannelApp", masterChannelApp)
						// now look again in the master channel list to find this channel with the same name but not an app id
						if (masterChannelApp) {
							//this.log("looking for channel with same name in the masterChannelList: looking for %s", masterChannelApp.channelName)
							//var masterChannelByName = this.platform.masterChannelList.find(channel => channel.channelName == masterChannelApp.channelName ); 
							//this.log("found masterChannel", masterChannelByName)
							//this.log("looking for channel with same name but different channelId in the masterChannelList: looking for %s where channelId is not %s", masterChannelApp.channelName, masterChannelApp.channelId)
							var masterChannel = this.platform.masterChannelList.find(channel => channel.channelName == masterChannelApp.channelName && channel.channelId != masterChannelApp.channelId ); 
							if (masterChannel) {
								searchChannelId = masterChannel.channelId;
							}
						}
					}
	
				} catch (err) {
					this.log.error("Error trapped in updateDeviceState while setting searchChannelId:", err.message);
					this.log.error(err);
					this.log.error("Further debug info:");
					this.log.error("this.currentChannelId", this.currentChannelId);
					this.log.error("searchChannelId", searchChannelId);
				}		
				//this.log("After error trap. searchChannelId:", searchChannelId);

				// search by subtype in the inputServices array, index 0 = input 1
				const oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
				//this.log("updateDeviceState: oldActiveIdentifier %s, currentActiveIdentifier %s, searchChannelId %s", oldActiveIdentifier, currentActiveIdentifier, searchChannelId)
				currentActiveIdentifier = this.inputServices.findIndex( InputSource => InputSource.subtype == 'input_' + searchChannelId ) + 1;
				//this.log("found searchChannelId at currentActiveIdentifier ", currentActiveIdentifier)


				if (currentActiveIdentifier <= 0) { currentActiveIdentifier = NO_INPUT_ID; } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
				if (oldActiveIdentifier !== currentActiveIdentifier) {
					// get names from loaded channel list. Using Ch Up/Ch Down buttons on the remote rolls around the profile channel list
					// what happens if the TV is changed to another profile?
					var oldName = NO_CHANNEL_NAME, newName = oldName; // default to UNKNOWN
					if (oldActiveIdentifier != NO_INPUT_ID && this.channelList[oldActiveIdentifier-1]) {
						oldName = this.channelList[oldActiveIdentifier-1].channelName
					}

					if (currentActiveIdentifier != NO_INPUT_ID) {
						newName = this.channelList[currentActiveIdentifier-1].channelName
					}
					this.log('%s: Channel changed from %s [%s] to %s [%s]', 
						this.name,
						oldActiveIdentifier, oldName,
						currentActiveIdentifier, newName);
					this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
					this.previousActiveIdentifier = this.currentActiveIdentifier;
				}


				// check for change of current media state
				var oldMediaState = this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).value;
				if (oldMediaState !== this.currentMediaState) {
					this.log('%s: Media state changed from %s [%s] to %s [%s]', 
						this.name,
						oldMediaState, mediaStateName[oldMediaState],
						this.currentMediaState, mediaStateName[this.currentMediaState]);
				}
				this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.currentMediaState);
				this.previousMediaState = this.currentMediaState;

				// check for change of profile
				if (this.profileDataChanged) {
					this.log('%s: Profile data changed', this.name);
					this.refreshChannelList();
					
				}


			}
			return null;

		} catch (err) {
			this.log.error("Error trapped in updateDeviceState:", err.message);
			this.log.error(err);
			this.log.error("Further debug info:");
			this.log.error("this.currentPowerState", this.currentPowerState);
			this.log.error("this.currentMediaState", this.currentMediaState);
			this.log.error("this.currentChannelId", this.currentChannelId);
			this.log.error("this.currentSourceType", this.currentSourceType);
			this.log.error("this.currentRecordingState", this.currentRecordingState);
			this.log.error("this.profileDataChanged", this.profileDataChanged);
		}		

	}


	// refresh the channel list that shows in the Home app
	async refreshChannelList(callback) {
		try {
			if (this.config.debugLevel > 1) { this.log.warn('%s: refreshChannelList', this.name); }
			this.log("%s: Refreshing channel list...", this.name);
			
			// exit if no session exists
			if (currentSessionState != sessionState.CONNECTED) { 
				this.log.warn('%s: refreshChannelList: Session not yet created, exiting', this.name);
				return; 
			}

			// exit if no master channel list loaded yet (on platform level)
			if (!this.platform.masterChannelListExpiryDate) { 
				this.log.warn('%s: refreshChannelList: master channel list not yet loaded, exiting', this.name);
				return; 
			}

			// limit the amount of max channels to load.
			var maxSources = MAX_INPUT_SOURCES;

			//this.profileId = this.platform.profiles.findIndex(profile => profile.name === this.config.profile);
			/*
			this.log("%s: Loading profile: %s", this.name, this.config.profile);
			this.log("%s: config: %s", this.name, this.config);
			this.log("%s: config.devices: %s", this.name, this.config.devices);
			this.log("%s: looking for: %s", this.name, this.device.deviceId);
			*/

			if (this.config.debugLevel > 1) { this.log.warn("%s: Getting profile data from config", this.name); }
			var chIds = [];
			var configDevice = {};
			if (this.config.devices) {
				configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
				if (configDevice) {
					// homebridge config for this device was found, get the profile item (=profile name) if it exists in the published profiles
					var foundProfileId = this.platform.profiles.findIndex(profile => profile.name === configDevice.profile);
					if (foundProfileId > -1) {
						if (this.config.debugLevel > 1) { this.log.warn("%s: Valid profile found in config: '%s'", this.name, configDevice.profile); }
						this.profileId = foundProfileId;
					}
					// get any custom maxChannels, set per device. Caution: maxChannels may not exist!
					maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
				}
			}



			// if no configured profile found (config item does not exist or name not found)
			// or the selected profile has zero channels added to the "Profile channels list" 
			// then build a clean, sorted, subscribed channel list
			var subscribedChList = [];
			if (this.config.debugLevel > 1) { this.log.warn("%s: Using profileId %s", this.name, this.profileId); }
			if (this.config.debugLevel > 1) { this.log.warn("%s: Checking if subscribed channel list is needed", this.name); }
			if (this.profileId <= 0 || this.platform.profiles[this.profileId].favoriteChannels.length == 0 ) {
				if (this.config.debugLevel > 1) { this.log.warn("%s: Building subscribed channel list", this.name); }
				// get a clean list of entitled channels (will not be in correct order)
				// some entitlements are not in the masterchannelList, these must be ignored
				if (this.config.debugLevel > 1) { this.log.warn("%s: Checking %s entitlements within %s channels in the master channel list", this.name, this.platform.session.entitlements.length, this.platform.masterChannelList.length); }
				
				this.platform.session.entitlements.forEach((chId) => {
					// chId can be crid:~~2F~~2Fupcch.tv~~2FSV09170, so split at ~~2F to get SV09170
					// channels can exist multiple times in the entitlements
					const chIdParts = chId.split("~~2F");
					chId = chIdParts[chIdParts.length-1];
					if (this.config.debugLevel > 2) { 
						this.log.warn("%s: Checking entitlements ", this.name, chId); 
					}
					// see if we can find this in the masterChannelList, but not in the subscribedChList
					// if exists in masterChannelList, and not in subscribedChList, add to subscribedChList
					var masterChListIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === chId);
					var subsChListIndex = subscribedChList.findIndex(subsChId => subsChId === chId);
					if ( masterChListIndex > -1 && subsChListIndex == -1 ) { 
						if (this.config.debugLevel > 2) { 
							this.log.warn("%s: entitlement channelId does not exist in unsorted subscribedChList, adding %s at index %s", this.name, chId, subscribedChList.length); 
						}
						subscribedChList.push( chId ); 
					}
				});

				// the channels are not in the right sort order, so sort correctly in same order as masterChannelList
				this.platform.masterChannelList.forEach((channel) => {
					var foundIndex = subscribedChList.findIndex(chId => chId === channel.channelId);
					if ( foundIndex > -1 ) { 
						if (this.config.debugLevel > 2) { 
							this.log.warn("%s: channelId does not exist in sorted chIds, adding %s %s at index %s", this.name, channel.channelId, channel.channelName, chIds.length); 
						}
						chIds.push( channel.channelId ); 
					} 
				});
				if (this.config.debugLevel > 2) { 
					this.log.warn("%s: Sorted chids created with %s entries", this.name, chIds.length); 
				}


			}



			// smart default channel list selection
			// a profile can contain zero channels, this is OK
			// load from profile channels list if one exists, otherwise from the subscribed channel list
			// if the subscribed channel list fits  (>0 and <=maxSources), use it
			// otherwise, use the first found profile channel list that fits
			// always default to the subscribedChList if nothing else fits
			if (this.profileId == -1) {
				this.log("%s: No valid profile found in config. Selecting best-fitting profile", this.name);
				if (subscribedChList.length > 0 && subscribedChList.length <= maxSources) {
					// the subscribed channel list fits, use it
					if (this.config.debugLevel > 1) { this.log.warn("%s: Selecting full subscribed channel list", this.name); }
					this.profileId = 0; // default channel list
				} else {
					// otherwise, use the first found profile channel list theat fits
					// check all available profiles and choose the first found with <90 channels
					if (this.config.debugLevel > 1) { this.log.warn("%s: Looking for best fit profile channel list within %s user profiles", this.name, this.platform.profiles.length-1); }
					for(let i=1; i<this.platform.profiles.length; i++) {
						if (this.config.debugLevel > 1) { this.log.warn("%s: Checking profile %s '%s' containing %s channels", this.name, i, this.platform.profiles[i].name, this.platform.profiles[i].favoriteChannels.length); }
						if (this.platform.profiles[i].favoriteChannels.length > 0 && this.platform.profiles[i].favoriteChannels.length <= maxSources) {
							// found a profile that can be used
							if (this.config.debugLevel > 1) { this.log.warn("%s: Selecting profile '%s' with %s channels", this.name, this.platform.profiles[i].name, this.platform.profiles[i].favoriteChannels.length); }
							this.profileId = i;
							break;
						}
					}
				}
			}


			// if no profile can be found, default to SharedProfile 0
			// ensures choice is 0, or >0, but never -1
			this.profileId = Math.max(this.profileId,0); 
			this.log("%s: Using profile %s '%s'", this.name, this.profileId, this.platform.profiles[this.profileId].name);

		


			// determine what channel list we need to load: "Profiles channels list" or master list
			// profile can have zero channels in it, this is OK, but if so load the master channel list
			var channelsLoadedFromProfileName;
			if (this.profileId == 0) {
				// subscribed channels in Shared Profile, already loaded to chIds
				channelsLoadedFromProfileName = this.platform.profiles[this.profileId].name;
				this.log("%s: Profile '%s' contains %s channels", this.name, channelsLoadedFromProfileName, chIds.length);
			} else if ( this.platform.profiles[this.profileId].favoriteChannels.length > 0 ) {
				chIds = this.platform.profiles[this.profileId].favoriteChannels;
				channelsLoadedFromProfileName = this.platform.profiles[this.profileId].name;
				this.log("%s: Profile '%s' contains %s channels", this.name, channelsLoadedFromProfileName, chIds.length);
			} else {	
				// Default subscribed channels in Shared Profile, already loaded to chIds
				channelsLoadedFromProfileName = this.platform.profiles[0].name;
				this.log("%s: Profile '%s' contains 0 channels. Channel list will be loaded from profile '%s'", this.name, this.platform.profiles[this.profileId].name, channelsLoadedFromProfileName);
			}

			// recently viewed apps
			if (this.config.debugLevel > 1) { 
				this.log.warn("%s: refreshChannelList: recentlyUsedApps", this.name, this.platform.profiles[this.profileId].recentlyUsedApps);
			}


			// grab the current ActiveIdentifier, and currentChannel, it might change during the channel refresh
			/*
			var currentActiveIdentifier = NO_INPUT_ID, currentChannel, currentChannelName = NO_CHANNEL_NAME;
			if (this.accessoryConfigured) { 
				currentActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
			}
			if (currentActiveIdentifier != NO_INPUT_ID) {
				currentChannel = this.inputServices[currentActiveIdentifier];
				currentChannelName = this.inputServices[currentActiveIdentifier].getCharacteristic(Characteristic.ConfiguredName).value;
			}
			if (this.config.debugLevel > 0) { 
				this.log.warn("%s: refreshChannelList: before channel refresh: this.currentChannelId %s currentActiveIdentifier %s currentChannelName %s", this.name, this.currentChannelId, currentActiveIdentifier, currentChannelName);
			}
			*/


			//const currentInpIndex = this.inputServices.findIndex(channel => channel.subtype == 'input_' + this.currentChannelId);
			//this.log("Found before channel load: this.currentChannelId %s found at currentInpIndex %s", this.currentChannelId, currentInpIndex);


			// clear the array
			this.channelList = [];

			// limit the amount to load
			const chs = Math.min(chIds.length, maxSources);
			this.log("%s: Refreshing channels 1 to %s", this.name, chs);
			if (chs < maxSources) {
				this.log("%s: Hiding     channels %s to %s", this.name, chs + 1, maxSources);
			}


			// loop and load all channels from the chIds in the order defined by the array
			chIds.forEach((chId, i) => {
				//this.log("In for-each loop, processing index %s %s", i, chId)
				// normalise the chId
				// can be "crid:~~2F~~2Fupcch.tv~~2FSV09170" or just "SVO9170" so split at ~~2F
				const oldChId = chId;
				const chIdParts = chId.split("~~2F");
				chId = chIdParts[chIdParts.length-1];
				if (oldChId.includes("~~2F")) { this.log("chId %s modified to chId %s", oldChId, chId); }

				// find the channel to load.
				var channel = {};
				var customChannel = {};
				
				// first look in the config channels list for any user-defined custom channel name
				if (this.config.channels) {
					customChannel = this.config.channels.find(channel => channel.channelId === chId);
					if ((customChannel || {}).channelName) { 
						customChannel.channelName = cleanNameForHomeKit(customChannel.channelName)
						this.log("%s: Found %s in config channels, setting name to %s", this.name, chId, customChannel.channelName);
					} else {					
						customChannel = {}; 
					}
				}

				// check if the chId exists in the master channel list, if not, push it, using the user-defined name if one exists, and channelNumber >10000
				this.log.debug("%s: Index %s: Finding chId %s in master channel list", this.name, i, chId);
				channel = this.platform.masterChannelList.find(channel => channel.channelId === chId); 
				if (!channel) {
					const newChName = customChannel.channelName || "Channel " + chId; 
					this.log("%s: Unknown channel %s [%s] discovered. Adding to the master channel list", this.name, chId, newChName);
					this.platform.masterChannelList.push({
						channelId: chId, 
						channelNumber: 10000 + this.platform.masterChannelList.length, 
						channelName: newChName
						//channelListIndex: this.platform.masterChannelList.length
					});
					// refresh channel as the not found channel will now be in the masterChannelList
					channel = this.platform.masterChannelList.find(channel => channel.channelId === chId); 
				} else {
					// show some useful debug data
					this.log.debug("%s: Index %s: Found %s in master channel list", this.name, i, chId);
				}

				// load this channel as an input
				//this.log("loading input %s of %s", i + 1, maxSources)
				if (i < maxSources) {

					// add the user-defined name if one exists
					if (customChannel && customChannel.channelName) { channel.channelName = customChannel.channelName; }

					// show channel number if user chose to do so
					// must only happen once!
					if ((configDevice || {}).showChannelNumbers) {
						// a config exists. Add channel number prefix only if the prefix does not exist
						const chPrefix = ('0' + (i + 1)).slice(-2) + " ";
						if (!channel.channelConfiguredName || channel.channelConfiguredName.slice(0, 3) != chPrefix) {
							//this.log("Adding prefix to configured name", chPrefix)
							channel.channelConfiguredName = chPrefix + channel.channelName;
						}
					} else {
						channel.channelConfiguredName = channel.channelName;
					}

					// add channel visibility and configured name, these don't exist on the master channel list
					// these should be read from file...
					channel.channelVisibilityState = Characteristic.CurrentVisibilityState.SHOWN;

					// show debug and add to array
					//this.log.debug("%s: Index %s: Refreshing channel %s: [%s] %s", this.name, i, ('0' + (i + 1)).slice(-2), chId, channel.channelName);
					this.log.debug("%s: Index %s: Refreshing channel %s: %s [%s]", this.name, i, ('0' + (i + 1)).slice(-2), chId, channel.channelName);
					this.channelList[i] = channel;

					// update accesory only when configured
					if (this.accessoryConfigured) { 
						// update existing services
						//this.log.debug("Adding %s %s to input index %s",channel.channelId, channel.channelName, i);
						this.log.debug("Adding %s %s to input %s at index %s",channel.channelId, channel.channelName, i+1, i);
						this.inputServices[i].name = channel.channelConfiguredName;
						this.inputServices[i].subtype = 'input_' + channel.channelId;

						// Name can only be set for SharedProfile where order can never be changed
						if (this.profileid == 0) {
							this.inputServices[i].updateCharacteristic(Characteristic.Name, channel.channelName); // stays unchanged at Input 01 etc
						}
						this.inputServices[i].updateCharacteristic(Characteristic.ConfiguredName, channel.channelConfiguredName);
						this.inputServices[i].updateCharacteristic(Characteristic.CurrentVisibilityState, channel.channelVisibilityState);
						this.inputServices[i].updateCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
						//inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.TargetVisibilityState.SHOWN);
					}
				}
			});

			// after loading all the channels, reset the ActiveIdentifier (uint32) to the right Identifier (uint32), as it may have moved slots
			const currentInput = this.inputServices.find(channel => channel.subtype == 'input_' + this.currentChannelId);
			if (currentInput) { 
				this.televisionService.updateCharacteristic(Characteristic.ActiveIdentifier, currentInput.getCharacteristic(Characteristic.Identifier).value);
			} else {
				// not found, set to NO_INPUT_ID
				if (this.televisionService) {
					this.televisionService.updateCharacteristic(Characteristic.ActiveIdentifier, NO_INPUT_ID);
				}
			}


			// save to disk
			// not yet active
			// this.platform.persistConfig(this.deviceId, this.channelList);


					// add the recently used apps, if we are loading from a user profile
					/*
					if (this.profileId > 0) {
						// apps have a channel number starting with "app"
						var appsToload = this.platform.profiles[this.profileId].recentlyUsedApps;
						appsToload.forEach( (appId, i) => {
							this.log("loading app", i, appId);
							if (i <= maxSources) {
								// get the channel
								var foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === appId);
								//this.log("foundIndex", foundIndex);
								if (foundIndex >= 0) {
									var channel = this.platform.masterChannelList[foundIndex];
									this.log("loading app", channel);
		
									// update existing services

									const inputService = this.inputServices[i];
									inputService
										.updateCharacteristic(Characteristic.ConfiguredName, channel.channelName)
										.updateCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
										.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
										.updateCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);
		
								}
							}
						});
					}
					*/
					

					
			// for any remaining inputs that may have been previously visible, set to not configured and hidden
			//this.log("channelList pre filter:", this.channelList);
			//var loadedChs = Math.min(chs, MAX_INPUT_SOURCES);
			//this.log("channelList, filtering to first %s items", loadedChs);
			//this.channelList = this.channelList.filter((channel, index) => index < loadedChs)
			//this.log("channelList post filter:", this.channelList);
			for(let i=chs; i<maxSources; i++) {
				//this.log.debug("Hiding channel", ('0' + (i + 1)).slice(-2));
				this.log.debug("Hiding channel", ('0' + (i+1)).slice(-2));
				// array must stay same size and have elements that can be queried, but channelId and channelListIndex must never match valid entries
				this.channelList[i] = {
					channelId: 'chId_' + i,  // channelid mjust be unique
					channelNumber: 'none', 
					channelName: 'HIDDEN', 
					//channelListIndex: 10000 + i,
					channelVisibilityState: Characteristic.CurrentVisibilityState.HIDDEN,
					channelConfiguredName: 'HIDDEN'
				}
				
				// get service and hide it if it exists
				const inputService = this.inputServices[i];
				if (inputService) {
					//inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue("Input " + i + 1);
					//inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.NOT_CONFIGURED);
					inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDEN);
				}

			}

			this.log("%s: Channel list refreshed from profile '%s' with %s channels", this.name, channelsLoadedFromProfileName, Math.min(chIds.length, maxSources));
			return false;

		} catch (err) {
			this.log.error("Error trapped in refreshChannelList:", err.message);
			this.log.error(err);
		}		
	}

	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END regular device update functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++











  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of accessory get/set state handlers
	// HomeKit polls for status regularly at intervals from 2min to 15min
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// get power state
	async getPower(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		// this.currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', this.currentPowerState);
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getPower returning %s [%s]', this.name, this.currentPowerState, powerStateName[this.currentPowerState]); 
		}
		callback(null, this.currentPowerState); // return current state: 0=off, 1=on
	}

	// set power state
	async setPower(targetPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in HomeKit
		// fired when the user clicks the TV tile in HomeKit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPower targetPowerState:', this.name, targetPowerState, powerStateName[targetPowerState]); }
		callback(null); // for rapid response
		if(this.currentPowerState !== targetPowerState){
			this.platform.sendKey(this.deviceId, this.name, 'Power');
			this.lastPowerKeySent = Date.now();
		}
	}

	

	// get device name (the accessory visible name)
	async getDeviceName(callback) {
		// fired by the user changing a the accessory name in Home app accessory setup
		// a user can rename any box at any time
		if (this.config.debugLevel > 1) { 
			this.log.warn("%s: getDeviceName returning '%s'", this.name, this.name);
		}
		callback(null, this.name);
	};

	// set device name (change the accessory visible name)
	async setDeviceName(deviceName, callback) {
		// fired by the user changing the accessory name in Home app accessory setup
		
		// check if user wants to sync the box name
		var syncName = true; // default true
		if (this.config.devices) {
			const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice && configDevice.syncName == false) { syncName = configDevice.syncName; }
		}

		// sync name to physical device if enabled
		if (syncName && syncName == true) {

			// check name length and truncate and log if >MAX_NAME_LENGTH
			if (deviceName.length<SETTOPBOX_NAME_MINLEN) {
				deviceName = (deviceName + deviceName + deviceName).slice(0, SETTOPBOX_NAME_MINLEN);
				this.log("%s: Device name must be at least %s characters long, expanding to %s", this.name, SETTOPBOX_NAME_MINLEN, deviceName);
			}
			if (deviceName.length > SETTOPBOX_NAME_MAXLEN) {
				deviceName = deviceName.slice(0, SETTOPBOX_NAME_MAXLEN);
				this.log("%s: Device name is limited to %s characters, truncating to %s", this.name, SETTOPBOX_NAME_MAXLEN, deviceName);
			}

			// ensure DEV is appended to deviceName to allow DEV and PROD environments to have the same device
			if (PLUGIN_ENV != '' && !deviceName.endsWith(PLUGIN_ENV)) {
				this.log.warn('%s: setDeviceName: [blocked in DEV environment] %s', this.name, deviceName);
			} else {
				if (this.config.debugLevel > 1) { this.log.warn('%s: setDeviceName: deviceName %s', this.name, deviceName); }
				const deviceSettings = {"deviceFriendlyName": deviceName};
				this.platform.setPersonalizationDataForDevice(this.deviceId, deviceSettings);
			}
		}

		callback(null);
	};

	

	// get mute state
	async getMute(callback) {
		// not supported, but might use somehow in the future
		if (this.config.debugLevel > 1) { this.log.warn("getMute"); }
		callback(null);
	}

	// set mute state
	async setMute(muteState, callback) {
		// sends the mute command. Mute is boolean
		// works for TVs that accept a mute toggle command
		if (this.config.debugLevel > 1) { this.log.warn('%s: setMute muteState: %s', this.name, muteState); }

		if (callback && typeof(callback) === 'function') {  callback(); } // for rapid response

		// mute state is a boolean, either true or false: const NOT_MUTED = 0, MUTED = 1;
		this.log('Send key Mute to %s ', this.name );

		// Execute command to toggle mute
		if (this.config.devices) {
			const device = this.config.devices.find(device => device.deviceId == this.deviceId)
			if (device && device.muteCommand) {
				var self = this;
				// assumes the end device toggles between mute on and mute off with each command
				exec(device.muteCommand, function (error, stdout, stderr) {
					// Error detection. error is true when an exec error occured
					if (error) { self.log.warn('setMute Error:',stderr.trim()); }
				});
			} else {
				this.log('%s: Mute command not configured', this.name);
			}
		} else {
			this.log('%s: Mute command not configured', this.name);
		}
	}



	// get volume
	async getVolume(callback) {
		if (this.config.debugLevel > 1) { this.log.warn("getVolume"); }
		callback(null);
	}

	// set volume
	async setVolume(volumeSelectorValue, callback) {
		// set the volume of the TV using bash scripts
		// the ARRIS box remote control commmunicates with the stereo via IR commands, not over mqtt
		// so volume must be handled over a different method
		// here we send execute a bash command on the raspberry pi using the samsungctl command
		// to control the authors samsung stereo at 192.168.0.152
		if (this.config.debugLevel > 1) { this.log.warn('%s: setVolume volumeSelectorValue:', this.name, volumeSelectorValue); }
		callback(null); // for rapid response

		// volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
		this.log('Send key Volume %s to %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up', this.name );

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.lastVolDownKeyPress[2] = this.lastVolDownKeyPress[1] || 0;
			this.lastVolDownKeyPress[1] = this.lastVolDownKeyPress[0] || 0;
			this.lastVolDownKeyPress[0] = Date.now();
			tripleVolDownPress = this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('setVolume: Timediff between volDownKeyPress[0] now and volDownKeyPress[2]: %s ms', this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2]);
		}
			
		// check for triple press of volDown, send setMute if tripleVolDownPress less than triplePressTime of 800ms
		const tripleVolDownPressThreshold = (this.config.triplePressTime || 800);
		this.log.debug("setVolume: volumeSelectorValue %s, current tripleVolDownPress %s, comparing to tripleVolDownPressThreshold %s", volumeSelectorValue, tripleVolDownPress, tripleVolDownPressThreshold)
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT && tripleVolDownPress < tripleVolDownPressThreshold) {
			this.log('%s: Volume Down triple-press detected. Setting Mute', this.name);
			this.setMute(true);
			return false;
		} else {
			// Execute command to change volume, but only if command exists
			if (this.config.devices) {
				const device = this.config.devices.find(device => device.deviceId == this.deviceId)
				if (device && device.volUpCommand && device.volDownCommand) {
					var self = this;
					exec((volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? device.volDownCommand : device.volUpCommand, function (error, stdout, stderr) {
						// Error detection. error is true when an exec error occured
						if (error) { self.log.warn('%s: setVolume Error: %s', self.name, stderr.trim()); }
					});
				} else {
					this.log('%s: Volume commands not configured', this.name);
				}
			} else {
				this.log('%s: Volume commands not configured', this.name);
			}
		}
	}





	// get input (TV channel)
	async getInput(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// this.currentChannelId is updated by the polling mechanisn
		// must return a valid index, and must never return null
		//if (this.config.debugLevel > 1) { this.log.warn('%s: getInput currentChannelId %s',this.name, this.currentChannelId); }

		// find the this.currentChannelId in the accessory inputs and return the inputindex once found
		// this allows HomeKit to show the selected current channel
		// as we cannot guarrantee the list order due to personalizationServices changing it at any time
		// we must search by input_channelId within the current accessory InputSource.subtype
		var currentChannelName = NO_CHANNEL_NAME;
		var currentInputIndex = this.inputServices.findIndex( InputSource => InputSource.subtype == 'input_' + this.currentChannelId );
		if (currentInputIndex == -1) { currentInputIndex = NO_INPUT_ID-1 } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
		if ((currentInputIndex > -1) && (currentInputIndex != NO_INPUT_ID-1)) { 
			currentChannelName = this.inputServices[currentInputIndex].getCharacteristic(Characteristic.ConfiguredName).value; 
		}
		const currentActiveInput = currentInputIndex + 1;
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getInput returning input %s %s [%s]', this.name, currentActiveInput, this.currentChannelId, currentChannelName);
		}

		callback(null, currentActiveInput);
	}

	// set input (change the TV channel)
	async setInput(input, callback) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: setInput input %s %s',this.name, input.channelId, input.channelName); }
		callback(null); // for rapid response
		var currentChannelName = NO_CHANNEL_NAME;
		const channel = this.platform.masterChannelList.find(channel => channel.channelId === this.currentChannelId);
		if (channel) { currentChannelName = channel.channelName; }
		this.log('%s: Change channel from %s [%s] to %s [%s]', this.name, this.currentChannelId, currentChannelName, input.channelId, input.channelName);
		this.platform.switchChannel(this.deviceId, this.name, input.channelId, input.channelName);
	}



	// get input name (the TV channel name)
	async getInputName(inputId, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		//if (this.config.debugLevel > 1) { this.log.warn('%s: getInputName inputId %s', this.name, inputId); }

		// need to read from stored cache, currently not implemented, TO-DO
		var chName = NO_CHANNEL_NAME; // must have a value
		if (this.channelList[inputId-1]) {
			chName = this.channelList[inputId-1].channelConfiguredName;
		}
		if (this.config.debugLevel > 1) { 
			this.log.warn("%s: getInputName for input %s returning '%s'", this.name, inputId, chName);
		}
		callback(null, chName);
	};

	// set input name (change the TV channel name)
	async setInputName(inputId, newInputName, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		// we cannot handle this as we don't know which channel got renamed
		// as user could name multiple channels to xxx
		// iOS does not like / or ! in the channel name:
		// channel 3 renamed from BBC Four/Cbeebies HD to BBC Four Cbeebies HD (valid only for HomeKit)

		if (this.config.debugLevel > 1) { this.log.warn('%s: setInputName for input %s to inputName %s', this.name, inputId, newInputName); }

		// store in channelList array and write to disk at every change
		this.channelList[inputId-1].channelConfiguredName = newInputName;
		//not yet active
		//this.platform.persistConfig(this.deviceId, this.channelList);

		const oldInputName = this.channelList[inputId-1].channelName;
		// maybe suppress 
		if (this.config.debugLevel > 2) {
			this.log('%s: Renamed channel %s from %s to %s (valid only for HomeKit)', this.name, inputId+1, oldInputName, newInputName);
		}
		callback(null);
	};



	// get input visibility state (of the TV channel in HomeKit)
	async getInputVisibilityState(inputId, callback) {
		//if (this.config.debugLevel > 1) { this.log.warn('%s: getInputVisibilityState inputId %s', this.name, inputId); }
		//var visibilityState = Characteristic.CurrentVisibilityState.SHOWN;
		//if (this.channelList[inputId-1].channelName == 'HIDDEN') {
		//	visibilityState = Characteristic.CurrentVisibilityState.HIDDEN;
		// }
		// from v1.1.7, index 0 is input 1 and so on
		const visibilityState = this.inputServices[inputId-1].getCharacteristic(Characteristic.CurrentVisibilityState).value;
		if (this.config.debugLevel > 2) {
			this.log.warn('%s: getInputVisibilityState for input %s returning %s [%s]', this.name, inputId, visibilityState, visibilityStateName[visibilityState]);
		}
		callback(null, visibilityState);
	}

	// set input visibility state (show or hide the TV channel)
	async setInputVisibilityState(inputId, visibilityState, callback) {
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: setInputVisibilityState for input %s inputVisibilityState %s [%s]', this.name, inputId, visibilityState, visibilityStateName[visibilityState]); 
		}
		this.inputServices[inputId-1].getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(visibilityState);

		// store in channelList array and write to disk at every change
		this.channelList[inputId-1].channelVisibilityState = visibilityState;
		//not yet active
		//this.platform.persistConfig(this.deviceId, this.channelList);

		callback(null); // for rapid response
	}


	// get closed captions state
	async getClosedCaptions(callback) {
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getClosedCaptions returning %s [%s]', this.name, this.currentClosedCaptionsState, closedCaptionsStateName[this.currentClosedCaptionsState]); 
		}
		callback(null, this.currentClosedCaptionsState); // return current state
	}

	// set closed captions state
	async setClosedCaptions(targetClosedCaptionsState, callback) {
		// fired when ??
		// targetClosedCaptionsState is the wanted state
		if (this.config.debugLevel > 1) { this.log.warn('%s: setClosedCaptions targetClosedCaptionsState:', this.name, targetClosedCaptionsState, closedCaptionsStateName[targetClosedCaptionsState]); }
		if(this.currentClosedCaptionsState !== targetClosedCaptionsState){
			this.log("setClosedCaptions: not Yet implemented");
		}
		callback(null);
	}


	// get picture mode state
	async getPictureMode(callback) {
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		if (this.config.debugLevel > 1) { 
			//this.log.warn('%s: getPictureMode', this.name); 
			// get the config for the device, needed for a few status checks
			var configDevice;
			if (this.config.devices) {
				configDevice = this.config.devices.find(device => device.deviceId == this.deviceId);
			}
			if ((configDevice || {}).customPictureMode == 'recordingState') {
				this.log.warn('%s: getPictureMode returning %s [%s]', this.name, this.customPictureMode, recordingStateName[this.customPictureMode]); 
			} else {
				this.log.warn('%s: getPictureMode returning %s [%s]', this.name, this.customPictureMode, pictureModeName[this.customPictureMode]); 
			}
		}
		callback(null, this.customPictureMode); // return current state
	}

	// set picture mode state
	async setPictureMode(targetPictureMode, callback) {
		// fired when ??
		// targetClosedCaptionsState is the wanted state
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPictureMode targetPictureMode:', this.name, targetPictureMode, pictureModeName[targetPictureMode]); }
		if(this.customPictureMode !== targetPictureMode){
			this.log("setPictureMode: not Yet implemented");
		}
		callback(null);
	}


	

	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state, callback) {
		// fired by the View TV Settings command in the HomeKit TV accessory Settings
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPowerModeSelection state:',this.name, state); }
		callback(false); // for rapid response
		this.log('Menu command: View TV Settings');
		// only send the keys if the power is on
		if (this.currentPowerState == Characteristic.Active.ACTIVE) {
			this.platform.sendKey(this.deviceId, this.name, 'Help'); // puts SETTINGS.INFO on the screen
			setTimeout(() => { this.platform.sendKey(this.deviceId, this.name, 'ArrowRight'); }, 600); // move right to select SETTINGS.PROFILES, send after 600ms
		} else {
			this.log('Power is Off. View TV Settings command not sent');
		}
	}

	// get current media state
	async getCurrentMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getCurrentMediaState returning %s [%s]', this.name, this.currentMediaState, mediaStateName[this.currentMediaState]);
		}
		callback(null, this.currentMediaState);
	}

	// get target media state
	async getTargetMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// must never return null, so send STOP as default value
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getTargetMediaState returning %s [%s]', this.name, this.targetMediaState, mediaStateName[this.targetMediaState]);
		}
		callback(null, this.currentMediaState);
	}

	// set target media state
	async setTargetMediaState(targetState, callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.config.debugLevel > 1) { this.log.warn('%s: setTargetMediaState this.targetMediaState:',this.name, targetState, mediaStateName[targetState]); }
		callback(null); // for rapid response
		switch (targetState) {
			case Characteristic.TargetMediaState.PLAY:
				this.log('setTargetMediaState: Set media to PLAY for', this.currentChannelId);
				this.platform.setMediaState(this.deviceId, this.name, this.currentChannelId, 1)
				break;
			case Characteristic.TargetMediaState.PAUSE:
				this.log('setTargetMediaState: Set media to PAUSE for', this.currentChannelId);
				this.platform.setMediaState(this.deviceId, this.name, this.currentChannelId, 0)
				break;
			case Characteristic.TargetMediaState.STOP:
				this.log('setTargetMediaState: Set media to STOP for', this.currentChannelId);
				this.platform.setMediaState(this.deviceId, this.name, this.currentChannelId, 0)
				break;
			}
	}


	// get display order
	async getDisplayOrder(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh

		// log the display order
		let dispOrder = this.televisionService.getCharacteristic(Characteristic.DisplayOrder).value;
		if (this.config.debugLevel > 1) { this.log.warn("%s: getDisplayOrder returning '%s'", this.name, dispOrder); }

		callback(null, dispOrder);
	}

	// set display order
	async setDisplayOrder(displayOrder, callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// this.currentChannelId is updated by the polling mechanisn
		// must return a valid index, and must never return null
		if (this.config.debugLevel > 1) { this.log.warn('%s: setDisplayOrder displayOrder',this.name, displayOrder); }
		callback(null);
	}

	// get status fault
	async getStatusFault(callback) {
		// useful in Shortcuts and Automations
		// log the status fault 
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getStatusFault returning %s [%s]', this.name, this.currentStatusFault, statusFaultName[this.currentStatusFault]);
		}
		callback(null, this.currentStatusFault);
	}

	// get in use
	async getInUse(callback) {
		// useful in Shortcuts and Automations
		// log the in use value
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getInUse returning %s [%s]', this.name, this.currentInUse, inUseName[this.currentInUse]);
		}
		callback(null, this.currentInUse);
	}

	// get program mode (recording scheduled, not scheduled)
	async getProgramMode(callback) {
		// useful in Shortcuts and Automations
		// log the program mode value 
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getProgramMode returning %s [%s]', this.name, this.currentProgramMode, programModeName[this.currentProgramMode]);
		}
		callback(null, this.currentProgramMode);
	}

	// get StatusActive state
	async getStatusActive(callback) {
		// useful in Shortcuts and Automations
		// log the StatusActive value 
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getStatusActive returning %s [%s]', this.name, this.currentStatusActive, statusActiveName[this.currentStatusActive]);
		}
		callback(null, this.currentStatusActive);
	}

	// get InputSourceType state
	async getInputSourceType(callback) {
		// useful in Shortcuts and Automations
		// log the InputSourceType value 
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getInputSourceType returning %s [%s]', this.name, this.currentInputSourceType, inputSourceTypeName[this.currentInputSourceType]);
		}
		callback(null, 0);
	}

	// get InputDeviceType state
	async getInputDeviceType(callback) {
		// useful in Shortcuts and Automations
		// log the InputDeviceType value 
		if (this.config.debugLevel > 1) { 
			this.log.warn('%s: getInputDeviceType returning %s [%s]', this.name, this.currentInputDeviceType, inputDeviceTypeName[this.currentInputDeviceType]);
		}
		callback(null, 0);
	}



	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: setRemoteKey remoteKey:',this.name, remoteKey); }
		callback(null); // for rapid response

		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 0...15 exist, but keys 12, 13 & 14 are not defined by Apple

		// all the keys have to mapped to a key that the EOSSTB understands
		// keys:
		// https://github.com/jsiegenthaler/homebridge-eosstb/wiki/KeyEvents


		this.log.debug("%s: setRemoteKey: -- New key press! -- current key %s, last key %s", this.name, remoteKey, this.lastRemoteKeyPressed);

		// ------------- double and triple press function ---------------
		// supports up to three layers of keys:
		// single press, double press and triple press
		// currently (October 2021) single and double are working, triple is reserved for the future.
		var tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed

		var lastKeyPressTime = this.lastRemoteKeyPress0[remoteKey] || 0; // find the time the current key was last pressed
		//this.log.debug("%s: setRemoteKey: remoteKey %s, lastKeyPressTime %s",this.name, remoteKey, lastKeyPressTime);

		// get the config for this device
		var configDevice
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
		}

		const DEFAULT_DOUBLE_PRESS_DELAY_TIME = 300; // default, in case config missing

		// do the button layer mapping
		// get any user-defined button remaps
		var keyName;
		var keyNameLayer = []; // holds the keynames for each layer
		var buttonLayer = 0; // default layer 0

		// constants to define the key layers
		const SINGLE_TAP = 0;	// button layer 0 is used for single tap
		const DOUBLE_TAP = 1;	// button layer 1 is used for double tap
		const TRIPLE_TAP = 2;	// button layer 2 is used for triple tap
		const DEFAULT_KEYNAME = 3;	// this index holds the default keyname, in case a config item is ever missing

		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				// no button exists in the Apple TV Remote for REWIND (as of iOS 14 & 15)
				// but exists in the eosstb remote, so add it ready for the future
				keyNameLayer[DEFAULT_KEYNAME] = 'MediaRewind';
				break;

			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				// no button exists in the Apple TV Remote for FAST_FORWARD (as of iOS 14 & 15)
				// but exists in the eosstb remote, so add it ready for the future
				keyNameLayer[DEFAULT_KEYNAME] = 'MediaFastForward';
				break;

			case Characteristic.RemoteKey.NEXT_TRACK: // 2
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				// no button exists in the Apple TV Remote for NEXT_TRACK or PREVIOUS_TRACK (as of iOS 14 & 15)
				keyNameLayer[DEFAULT_KEYNAME] = null; // no corresponding keys can be identified. not supported in Apple Remote GUI
				break;

			case Characteristic.RemoteKey.ARROW_UP: // 4
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowUp";
				keyNameLayer[SINGLE_TAP] = configDevice.arrowUpButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.arrowUpButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.arrowUpButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowDown";
				keyNameLayer[SINGLE_TAP] = configDevice.arrowDownButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.arrowDownButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.arrowDownButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowLeft";
				keyNameLayer[SINGLE_TAP] = configDevice.arrowLeftButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.arrowLeftButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.arrowLeftButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowRight";
				keyNameLayer[SINGLE_TAP] = configDevice.arrowRightButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.arrowRightButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.arrowRightButtonTripleTap;
				break;

			case Characteristic.RemoteKey.SELECT: // 8
				keyNameLayer[DEFAULT_KEYNAME] = "Enter";
				keyNameLayer[SINGLE_TAP] = configDevice.selectButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.selectButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.selectButtonTripleTap;
				break;

			case Characteristic.RemoteKey.BACK: // 9
			case Characteristic.RemoteKey.EXIT: // 10 
				// both BACK and EXIT are handled the same
				keyNameLayer[DEFAULT_KEYNAME] = "Escape";
				keyNameLayer[SINGLE_TAP] = configDevice.backButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.backButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.backButtonTripleTap;
				break;

			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				keyNameLayer[DEFAULT_KEYNAME] = "MediaPlayPause";
				keyNameLayer[SINGLE_TAP] = configDevice.playPauseButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.playPauseButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.playPauseButtonTripleTap;
				break; 

			case Characteristic.RemoteKey.INFORMATION: // 15
				keyNameLayer[DEFAULT_KEYNAME] = "MediaTopMenu";
				keyNameLayer[SINGLE_TAP] = configDevice.infoButton;
				keyNameLayer[DOUBLE_TAP] = configDevice.infoButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = configDevice.infoButtonTripleTap;
				break; 
			}





		// bump the array up one slot
		/*
		this.log("Shifting the array up one, and storing current time in index 0");
		lastkeyPress[remoteKey][2] = lastkeyPress[remoteKey][1] || 0;
		lastkeyPress[remoteKey][1] = lastkeyPress[remoteKey][0] || 0;
		lastkeyPress[remoteKey][0] = Date.now();
		*/

		const CURRENT_PRESS = 0;	// index of the current button press
		const PREVIOUS_PRESS = 1;	// index of the previous button press
		const TWO_PRESSES_AGO = 2;	// index of the button press two presses ago (before the previous press)

		// bump the array up one level and store current timestamp in lastRemoteKeyPress0
		// use 3 arrays as I couldn't get 2-dimensional arrays working
		this.lastRemoteKeyPress2[remoteKey] = this.lastRemoteKeyPress1[remoteKey];
		this.lastRemoteKeyPress1[remoteKey] = this.lastRemoteKeyPress0[remoteKey];
		this.lastRemoteKeyPress0[remoteKey] = Date.now();

		var lastPressTime = [];
		lastPressTime[TWO_PRESSES_AGO] = (this.lastRemoteKeyPress2[remoteKey] || (Date.now() - 999999)); // default to a long time ago if empty.
		lastPressTime[PREVIOUS_PRESS] = this.lastRemoteKeyPress1[remoteKey] || Date.now() - 999999; // default to same time yesterday if empty
		lastPressTime[CURRENT_PRESS] = this.lastRemoteKeyPress0[remoteKey];

		var doublePressTime = this.config.doublePressTime || DEFAULT_DOUBLE_PRESS_DELAY_TIME; // default to DEFAULT_DOUBLE_PRESS_DELAY_TIME if nothing found
		//var triplePressTime = this.config.triplePressTime || 450; // for possible future use


		// write lastkeyPress to the array
		//this.lastRemoteKeyPress0[remoteKey] = lastkeyPress;
		//this.log("remoteKey %s, lastRemoteKeyPress has been updated, now:", remoteKey, this.lastRemoteKeyPress);


			// if same key, check for double or triple press
			// check timing, activating triple-press then double-press button layers
			// if historical key presses exist in buffer
			/*
			// disabled triplePress until I get doublePress working
			if (lastPressTime[CURRENT_PRESS] - lastPressTime[TWO_PRESSES_AGO] < triplePressTime) {
				this.log('setRemoteKey remoteKey %s, triple press detected', remoteKey);
				this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
				this.readyToSendRemoteKeyPress = true; // enable immediate send
			*/
			
		// check time difference between current keyPress and last keyPress
		this.log.debug('%s: setRemoteKey: remoteKey %s, time since same-key last keypress: %s ms, doublePressTime: %s', this.name, remoteKey, lastPressTime[CURRENT_PRESS] - lastPressTime[PREVIOUS_PRESS], doublePressTime);

		// if the current key has the same keyName in single and double press layers, then 
		// there is no need to wait for a double-press detection. The key can be sent immediately.
		if (keyNameLayer[SINGLE_TAP] == (keyNameLayer[DOUBLE_TAP] || keyNameLayer[SINGLE_TAP]) ){
			// single and double press layers are the same, send immediately
			this.log.debug("%s: setRemoteKey: remoteKey %s, same single- and double-press layers, sending now", this.name, remoteKey);
			this.pendingKeyPress = -1; // clear any pending key press
			this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
			this.readyToSendRemoteKeyPress = true; // enable immediate send

		// check if this was a double-pressed key within the double-press time limit, and is for the same key
		} else if (lastPressTime[CURRENT_PRESS] - lastPressTime[PREVIOUS_PRESS] < doublePressTime && (this.pendingKeyPress == remoteKey) ) {
			// double press detected, send immediately
			this.log.debug('%s: setRemoteKey: remoteKey %s, double press detected, sending now', this.name, remoteKey);
			buttonLayer = DOUBLE_TAP;
			this.pendingKeyPress = -1; // clear any pending key press
			this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
			this.readyToSendRemoteKeyPress = true; // enable immediate send

		} else {
			// not a double press, queue as a pending press, to be sent after delay
			this.log.debug('%s: setRemoteKey: remoteKey %s, single press detected, waiitng for possible next key press before sending', this.name, remoteKey);
			buttonLayer = SINGLE_TAP;
			this.pendingKeyPress = remoteKey;
			this.sendRemoteKeyPressAfterDelay = true;	// enable send after delay
			this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
		}


		// get the right keyName based on the buttonLayer, fallback to default if needed
		this.log.debug('%s: setRemoteKey: setting keyName for buttonLayer %s: SingleTap=%s, DoubleTap=%s, TripleTap=%s, Default=%s', this.name, buttonLayer, keyNameLayer[SINGLE_TAP], keyNameLayer[DOUBLE_TAP], keyNameLayer[TRIPLE_TAP], keyNameLayer[DEFAULT_KEYNAME]);
		keyName = keyNameLayer[buttonLayer] || keyNameLayer[DEFAULT_KEYNAME];



		this.log.debug('%s: setRemoteKey: remoteKey %s, buttonLayer %s, keyName %s, pendingKeyPress %s, sendRemoteKeyPressAfterDelay %s, readyToSendRemoteKeyPress %s', this.name, remoteKey, buttonLayer, keyName, this.pendingKeyPress, this.sendRemoteKeyPressAfterDelay, this.readyToSendRemoteKeyPress);




		// handle the key code (can be a sequence)
		// send only if keyName is not null
		if (keyName) {
			if (this.readyToSendRemoteKeyPress){ 
				// send immediately
				this.log('%s: setRemoteKey: sending key %s now', this.name, keyName);
				this.platform.sendKey(this.deviceId, this.name, keyName);
				this.pendingKeyPress = -1; // clear any pending key press
			} else {
				// immediate send is not enabled. 
				// start a delay equal to doublePressTime, then send only if the readyToSendRemoteKeyPress is true
				var delayTime = this.config.doublePressTime || DEFAULT_DOUBLE_PRESS_DELAY_TIME;
				this.log.debug('%s: setRemoteKey: sending key %s after delay of %s milliseconds', this.name, keyName, delayTime);
				setTimeout(() => { 
					// check if can be sent. Only send if sendRemoteKeyPressAfterDelay is still set. It may have been reset by another key press
					this.log.debug('%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s', this.name, keyName);
					if (this.sendRemoteKeyPressAfterDelay){ 
						this.log('%s: setRemoteKey: setTimeout delay completed, sending %s', this.name, keyName);
						this.platform.sendKey(this.deviceId, this.name, keyName);
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, key %s sent, resetting readyToSendRemoteKeyPress', this.name, keyName);
						this.readyToSendRemoteKeyPress = true; // reset the enable flag
						this.pendingKeyPress = -1; // clear any pending key press
					} else {
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s: sendRemoteKeyPressAfterDelay is false, doing nothing', this.name, keyName);
					}
				},
				delayTime); // send after delayTime
			}
		}

		this.lastRemoteKeyPressed = remoteKey; // store the current key as last key pressed

	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};