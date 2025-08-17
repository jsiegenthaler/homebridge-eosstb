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
const debug = require('debug')('eosstb'); // https://github.com/debug-js/debug
// good example of debug usage https://github.com/mqttjs/MQTT.js/blob/main/lib/client.js
const semver = require('semver')		// https://github.com/npm/node-semver

const mqtt = require('mqtt');  			// https://github.com/mqttjs
const qs = require('qs');				// https://github.com/ljharb/qs
const WebSocket = require('ws');		// https://github.com/websockets/ws   for the mqtt websocket


// needed for sso logon with pkce OAuth 2.0
const { randomBytes, createHash } = require("node:crypto");


// axios-cookiejar-support v2.0.2 syntax
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support'); // as of axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
const tough = require('tough-cookie');
const cookieJar = new tough.CookieJar();


const axios = require('axios') //.default;	// https://github.com/axios/axios
axios.defaults.xsrfCookieName = undefined; // change  xsrfCookieName: 'XSRF-TOKEN' to  xsrfCookieName: undefined, we do not want this default,
const axiosWS = axios.create({
	jar: cookieJar, //added in axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
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
// without any trailing /
// refer https://github.com/Sholofly/lghorizon-python/blob/features/telenet/lghorizon/const.py
const countryBaseUrlArray = {
	//https://spark-prod-be.gnp.cloud.telenet.tv/be/en/config-service/conf/web/backoffice.json
	'be-fr': 'https://spark-prod-be.gnp.cloud.telenet.tv', // changed 15.06.2024, be still needs 2 x language variangs: be-fr and be-nl
	'be-nl': 'https://spark-prod-be.gnp.cloud.telenet.tv', // changed 15.06.2024, be still needs 2 x language variangs: be-fr and be-nl
	// https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json
	//'ch': 		'https://prod.spark.sunrisetv.ch', 
	'ch': 'https://spark-prod-ch.gnp.cloud.sunrisetv.ch', // verified 14.01.2024
	'gb': 'https://spark-prod-gb.gnp.cloud.virgintvgo.virginmedia.com', // verified 14.01.2024
	'ie': 'https://spark-prod-ie.gnp.cloud.virginmediatv.ie', // verified 14.01.2024
	'nl': 'https://prod.spark.ziggogo.tv', // verified 14.01.2024
	//'pl':		'https://prod.spark.upctv.pl',
	'pl': 'https://spark-prod-pl.gnp.cloud.upctv.pl',  // verified 14.01.2024
	//'sk':		'https://prod.spark.upctv.sk',
	'sk': 'https://spark-prod-sk.gnp.cloud.upctv.sk',  // verified 14.01.2024
};

// mqtt endpoints varies by country, unchanged after backend change on 13.10.2022
/*
const mqttUrlArray = {
	'be-fr':  	'wss://obomsg.prod.be.horizon.tv/mqtt',
	'be-nl': 	'wss://obomsg.prod.be.horizon.tv/mqtt',
	'ch': 		'wss://messagebroker-prod-ch.gnp.cloud.dmdsdp.com/mqtt', // from 11.02.2024
	'gb':       'wss://obomsg.prod.gb.horizon.tv/mqtt',
	'ie':       'wss://obomsg.prod.ie.horizon.tv/mqtt',
	'nl': 		'wss://obomsg.prod.nl.horizon.tv/mqtt',
	'pl': 		'wss://obomsg.prod.pl.horizon.tv/mqtt',
	'sk':		'wss://obomsg.prod.sk.horizon.tv/mqtt'
};*/


// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
// still in use after logon session changes on 13.10.2022 for other countries
// the url that worked in v1.7: 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web'
// this may also work: https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/authorization
const GB_AUTH_OESP_URL = 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web';
// https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';



// general constants
const NO_INPUT_ID = 99; // an input id that does not exist. Must be > 0 as a uint32 is expected. inteder
const NO_CHANNEL_ID = 'ID_UNKNOWN'; // id for a channel not in the channel list, string
const NO_CHANNEL_NAME = 'UNKNOWN'; // name for a channel not in the channel list
const MAX_INPUT_SOURCES = 95; // max input services. Default = 95. Cannot be more than 96 (100 - all other services)
const SESSION_WATCHDOG_INTERVAL_MS = 15000; // session watchdog interval in millisec. Default = 15000 (15s)
const MASTER_CHANNEL_LIST_VALID_FOR_S = 1800; // master channel list stays valid for 1800s (30min) from last refresh from July 2023. Triggers reauthentication rpocess as well
const MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S = 60; // master channel list refresh check interval, in seconds. Default = 60 (1mim) from July 2023
const SETTOPBOX_NAME_MINLEN = 3; // min len of the set-top box name
const SETTOPBOX_NAME_MAXLEN = 14; // max len of the set-top box name



// state constants. Need to add an array for any characteristic that is not an array, or the array is not contiguous
const sessionState = { DISCONNECTED: 0, LOADING: 1, LOGGING_IN: 2, AUTHENTICATING: 3, VERIFYING: 4, AUTHENTICATED: 5, CONNECTED: 6 }; // custom
const powerStateName = ["OFF", "ON"]; // custom
const recordingState = { IDLE: 0, ONGOING_NDVR: 1, ONGOING_LOCALDVR: 2 }; // custom
const statusActiveName = ["NOT_ACTIVE", "ACTIVE"]; // ccustom, haracteristic is boolean, not an array

Object.freeze(sessionState);
Object.freeze(powerStateName);
Object.freeze(recordingState);
Object.freeze(statusActiveName);




// exec spawns child process to run a bash script
var exec = require("child_process").exec;
const { waitForDebugger } = require('inspector');
const { ENGINE_METHOD_CIPHERS } = require('constants');
const { LOADIPHLPAPI } = require('dns');
const { connected } = require('process');
var PLUGIN_ENV = ''; // controls the development environment, appended to UUID to make unique device when developing

// variables for session and all devices
let mqttClient = {};
let mqttClientId = '';
let mqttUsername;
let currentSessionState;
let isShuttingDown = false; // to handle reboots cleanly

let Accessory, Characteristic, Service, Categories, UUID;



// make a randon id of the desired length
function makeId(length) {
	let result = '';
	let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
};



// format an id to conform with the web client ids
// 32 char, lower case, formatted as follows:
// "d3e9aa58-6ddc-4c1a-b6a4-8fc1526c6f19"
//  12345678-9012-3456-7890-123456789012
//  1------8 9-12-1316-1720-21--------32
function makeFormattedId(length) {
	let id = '';
	let result = '';
	let characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		id += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	// expects 32 char id length
	result = result + id.substring(0, 8) + '-';
	result = result + id.substring(8, 12) + '-';
	result = result + id.substring(12, 16) + '-';
	result = result + id.substring(16, 20) + '-';
	result = result + id.substring(20, id.length);
	return result;
};


// get unix timestamp in seconds
function getTimestampInSeconds() {
	return Math.floor(Date.now() / 1000)
};


// transform current media state of 0,1,2,4,5 to 1,2,3,4,5 to work with Object.keys
function currentMediaStateName(currentMediaState) {
	let i = (currentMediaState + 1); // get the bew index
	if (i > 3) { i = i - 1 }; // modify if > 3 to get 1,2,3,4,5
	return Object.keys(Characteristic.CurrentMediaState)[i];
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
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// wait function with promise
async function waitprom(ms) {
	return new Promise((resolve) => {
		setTimeout(() => { resolve(ms) }, ms)
	})
}


// generate PKCE code verifier pair for OAuth 2.0
function generatePKCEPair() {
	const NUM_OF_BYTES = 22; // Total of 44 characters (1 Byte = 2 char) (standard states that: 43 chars <= verifier <= 128 chars)
	const HASH_ALG = "sha256";
	const code_verifier = randomBytes(NUM_OF_BYTES).toString('hex');
	const code_verifier_hash = createHash(HASH_ALG).update(code_verifier).digest('base64');
	const code_challenge = code_verifier_hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // Clean base64 to make it URL safe
	return { verifier: code_verifier, code_challenge }
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
		this.masterChannelList = [];

		// show some useful version info
		this.log.info('%s v%s, node %s, homebridge v%s', packagejson.name, packagejson.version, process.version, this.api.serverVersion)

		// only load if configured and mandatory items exist. Homebridge checks for platform itself, and name is not critical
		if (!this.config) { this.log.warn('%s config missing. Initialization aborted.', PLUGIN_NAME); return; }
		const configWarningText = '%s config incomplete: "{configItemName}" missing. Initialization aborted.';
		if (!this.config.country) { this.log.warn(configWarningText.replace('{configItemName}', 'country'), PLUGIN_NAME); return; }
		if (!this.config.username) { this.log.warn(configWarningText.replace('{configItemName}', 'username'), PLUGIN_NAME); return; }
		if (!this.config.password) { this.log.warn(configWarningText.replace('{configItemName}', 'password'), PLUGIN_NAME); return; }

		// session flags
		currentSessionState = sessionState.DISCONNECTED;
		mqttClient.connected = false;
		this.sessionWatchdogRunning = false;
		this.watchdogCounter = 0;
		this.mqttClientConnecting = false;
		this.currentStatusFault = null;


		/*
		this.inputsFile = this.storagePath + '/' + 'inputs_' + this.host.split('.').join('');
		this.customInputsFile = this.storagePath + '/' + 'customInputs_' + this.host.split('.').join('');
		this.devInfoFile = this.storagePath + '/' + 'devInfo_' + this.host.split('.').join('');
		*/

		/*
		* Platforms should wait until the "didFinishLaunching" event has fired before registering any new accessories.
		*/
		//this.api.on('didFinishLaunching', () => {
		this.api.on('didFinishLaunching', async () => {
			if (this.config.debugLevel > 2) { this.log.warn('API event: didFinishLaunching'); }
			debug('stbPlatform:apievent :: didFinishLaunching')

			// call the session watchdog once to create the session initially
			setTimeout(this.sessionWatchdog.bind(this), 500); // wait 500ms then call this.sessionWatchdog

			// the session watchdog creates a session when none exists, and recreates one if the session ever fails due to internet failure or anything else
			if ((this.config.watchdogDisabled || false) == true) {
				this.log.warn('WARNING: Session watchdog disabled')
			} else {
				this.checkSessionInterval = setInterval(this.sessionWatchdog.bind(this), SESSION_WATCHDOG_INTERVAL_MS);
			}

			// check for a channel list update every MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S seconds
			this.checkChannelListInterval = setInterval(() => {
				// check if master channel list has expired. If it has, refresh auth token, then refresh channel list
				if (this.config.debugLevel >= 1) { this.log.warn('stbPlatform: checkChannelListInterval Start'); }
				if (this.masterChannelListExpiryDate <= Date.now()) {
					// must check and refresh auth token before each call to refresh master channel list
					this.refreshAccessToken()
						.then(response => {
							if (this.config.debugLevel >= 1) { this.log.warn('stbPlatform: refreshAccessToken completed OK'); }
							return this.refreshMasterChannelList()
						})
						.then(response => {
							if (this.config.debugLevel >= 1) { this.log.warn('stbPlatform: refreshMasterChannelList completed OK'); }
							return true
						})
						.catch(error => {
							if (error.code) {
								this.log.warn('stbPlatform: checkChannelListInterval Error', (error.syscall || '') + ' ' + (error.code || '') + ' ' + (error.config.url || error.hostname || ''));
							} else {
								this.log.warn('stbPlatform: checkChannelListInterval Error', error);
							}
						})
					if (this.config.debugLevel >= 1) { this.log.warn('stbPlatform: checkChannelListInterval end'); }
				}
			}, MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S * 1000) // need to pass ms

			debug('stbPlatform:apievent :: didFinishLaunching end of code block')
			//this.log('stbPlatform: end of code block');
		});


		/*
		* "shutdown" event is fired when homebridge shuts down
		*/
		this.api.on('shutdown', () => {
			debug('stbPlatform:apievent :: shutdown')
			if (this.config.debugLevel > 2) { this.log.warn('API event: shutdown'); }
			isShuttingDown = true;
			this.endMqttSession()
				.then(() => {
					this.log('Goodbye');
				}
				);
			debug('stbPlatform :apievent :: shutdown end of code block')
		});

	} // end of constructor


	// test wait function with promise
	async testprom() {
		return new Promise((resolve, reject) => {
			this.log('testprom: in the testprom async function')
			resolve('testprom response: some success text in the class') // must have a resolve to return something
		})
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
		fs.writeFile(filename, jsonString, function (err) {
			if (err) {
				this.log('persistConfig', err);
			}
		});
	}



	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler (web)
	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// the awesome watchDog
	async sessionWatchdog(callback) {
		// the session watchdog creates a session when none exists, and creates stbDevices when none exist
		// runs every few seconds. 
		// If session exists or is still being connected: Exit immediately
		// If no session exists: prepares the session, then prepares the device
		this.watchdogCounter++; // increment global counter by 1
		let watchdogInstance = 'sessionWatchdog(' + this.watchdogCounter + ')'; // set a log prefix for this instance of the watchdog to allow differentiation in the logs
		let statusOverview = '';
		callback = true;
		//this.log('++++ SESSION WATCHDOG STARTED ++++');

		// standard debugging
		let debugPrefix = '\x1b[33msessionWatchdog :: ' // 33=yellow
		debug(debugPrefix + 'started')
		if (this.config.debugLevel > 2) { this.log.warn('%s: Started watchdog instance %s', watchdogInstance, this.watchdogCounter); }

		//robustness: if session state ever gets disconnected due to session creation problems, ensure the mqtt status is always disconnected
		if (currentSessionState == sessionState.DISCONNECTED) {
			this.mqttClientConnecting = false;
		}


		if (this.config.debugLevel > 0) {
			statusOverview = statusOverview + ' sessionState=' + Object.keys(sessionState)[currentSessionState]
			statusOverview = statusOverview + ' mqttClient.connected=' + mqttClient.connected
			statusOverview = statusOverview + ' sessionWatchdogRunning=' + this.sessionWatchdogRunning
		}

		// exit if shutting down
		if (isShuttingDown) {
			if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Homebridge is shutting down, exiting %s without action', watchdogInstance); }
			return;
		}

		// exit if a previous session is still running
		if (this.sessionWatchdogRunning) {
			if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Previous sessionWatchdog still working, exiting %s without action', watchdogInstance); }
			return;

			// as we are called regularly by setInterval, check connection status and exit without action if required
		} else if (currentSessionState == sessionState.CONNECTED) {
			// session is connected, check mqtt state

			if (mqttClient.connected) {
				if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Session and mqtt connected, exiting %s without action', watchdogInstance); }
				return;
			} else if (this.mqttClientConnecting) {
				if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Session connected but mqtt still connecting, exiting %s without action', watchdogInstance); }
				return;
			} else {
				if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Session connected but mqtt not connected, %s will try to reconnect mqtt now...', watchdogInstance); }
			}

		} else if (currentSessionState != sessionState.DISCONNECTED) {
			// session is not disconnected, meaning it is between connected and disconnected, ie: a connection is in progress
			if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Session still connecting, exiting %s without action', watchdogInstance); }
			return;

		} else {
			// session is not connected and is not in a state between connected and disconnected, so it is disconnected. ContinuecurrentMediaStateName(
			if (this.config.debugLevel > 2) { this.log.warn(watchdogInstance + ': Session and mqtt not connected, %s will try to connect now...', watchdogInstance); }

		}

		// the watchdog will now attempt to reconnect the session. Flag that the watchdog is running
		this.sessionWatchdogRunning = true;
		if (this.config.debugLevel > 2) { this.log.warn('%s: Status: sessionWatchdogRunning=%s', watchdogInstance, this.sessionWatchdogRunning); }


		// detect if running on development environment
		// customStoragePath: 'C:\\Users\\jochen\\.homebridge'
		if (this.api.user.customStoragePath.includes('jochen')) { PLUGIN_ENV = ' DEV' }
		if (PLUGIN_ENV) { this.log.debug('%s: %s running in %s environment with debugLevel %s', watchdogInstance, PLUGIN_NAME, PLUGIN_ENV.trim(), (this.config || {}).debugLevel || 0); }


		// if session does not exist, create the session, passing the country value
		let errorTitle;
		if (currentSessionState == sessionState.DISCONNECTED) {
			this.log('Session %s. Starting session connection process', Object.keys(sessionState)[currentSessionState]);
			if (this.config.debugLevel > 2) { this.log.warn('%s: Attempting to create session', watchdogInstance); }

			// asnyc startup sequence with chain of promises
			this.log.debug('%s: ++++ step 1: calling config service', watchdogInstance)
			errorTitle = 'Failed to get config';
			debug(debugPrefix + 'calling getConfig')
			await this.getConfig(this.config.country.toLowerCase()) // returns config, stores config in this.config
				.then((session) => {
					this.log.debug('%s: ++++++ step 2: config was retrieved', watchdogInstance)
					this.log.debug('%s: ++++++ step 2: calling createSession with country code %s ', watchdogInstance, this.config.country.toLowerCase())
					this.log('Creating session...');
					errorTitle = 'Failed to create session';
					debug(debugPrefix + 'calling createSession')
					return this.createSession(this.config.country.toLowerCase()) // returns householdId, stores session in this.session
				})
				.then((sessionHouseholdId) => {
					this.log.debug('%s: ++++++ step 3: session was created, connected to sessionHouseholdId %s', watchdogInstance, sessionHouseholdId)
					this.log.debug('%s: ++++++ step 3: calling getPersonalizationData with sessionHouseholdId %s ', watchdogInstance, sessionHouseholdId)
					this.log('Discovering platform...');
					errorTitle = 'Failed to discover platform';
					debug(debugPrefix + 'calling getPersonalizationData')
					return this.getPersonalizationData(this.session.householdId) // returns customer object, with devices and profiles, stores object in this.customer
				})
				.then((objCustomer) => {
					this.log.debug('%s: ++++++ step 4: personalization data was retrieved, customerId %s customerStatus %s', watchdogInstance, objCustomer.customerId, objCustomer.customerStatus)
					this.log.debug('%s: ++++++ step 4: calling getEntitlements with customerId %s ', watchdogInstance, objCustomer.customerId)
					debug(debugPrefix + 'calling getEntitlements')
					return this.getEntitlements(this.customer.customerId) // returns customer object
				})
				.then((objEntitlements) => {
					this.log.debug('%s: ++++++ step 5: entitlements data was retrieved, objEntitlements.token %s', watchdogInstance, objEntitlements.token)
					this.log.debug('%s: ++++++ step 5: calling refreshMasterChannelList', watchdogInstance)
					debug(debugPrefix + 'calling refreshMasterChannelList')
					return this.refreshMasterChannelList() // returns entitlements object
				})
				.then((objChannels) => {
					this.log.debug('%s: ++++++ step 6: masterchannelList data was retrieved, channels found: %s', watchdogInstance, objChannels.length)
					// Recording needs entitlements of PVR or LOCALDVR
					const pvrFeatureFound = this.entitlements.features.find(feature => (feature === 'PVR' || feature === 'LOCALDVR'));
					this.log.debug('%s: ++++++ step 6: foundPvrEntitlement %s', watchdogInstance, pvrFeatureFound);
					if (pvrFeatureFound) {
						this.log.debug('%s: ++++++ step 6: calling getRecordingState with householdId %s', watchdogInstance, this.session.householdId)
						this.getRecordingState(this.session.householdId) // returns true when successful
					}
					return true
				})
				.then((objRecordingStateFound) => {
					this.log.debug('%s: ++++++ step 7: recording state data was retrieved, objRecordingStateFound: %s', watchdogInstance, objRecordingStateFound)
					// Recording needs entitlements of PVR or LOCALDVR
					const pvrFeatureFound = this.entitlements.features.find(feature => (feature === 'PVR' || feature === 'LOCALDVR'));
					this.log.debug('%s: ++++++ step 7: foundPvrEntitlement %s', watchdogInstance, pvrFeatureFound);
					if (pvrFeatureFound) {
						this.log.debug('%s: ++++++ step 7: calling getRecordingBookings with householdId %s', watchdogInstance, this.session.householdId)
						this.getRecordingBookings(this.session.householdId) // returns true when successful
					}
					return true
				})
				.then((objRecordingBookingsFound) => {
					this.log.debug('%s: ++++++ step 8: recording bookings data was retrieved, objRecordingBookingsFound: %s', watchdogInstance, objRecordingBookingsFound)
					this.log.debug('%s: ++++++ step 8: calling discoverDevices', watchdogInstance)
					errorTitle = 'Failed to discover devices';
					debug(debugPrefix + 'calling discoverDevices')
					return this.discoverDevices() // returns stbDevices object 
				})
				.then((objStbDevices) => {
					this.log('Discovery completed');
					this.log.debug('%s: ++++++ step 9: devices found:', watchdogInstance, this.devices.length)
					this.log.debug('%s: ++++++ step 9: calling getMqttToken', watchdogInstance)
					errorTitle = 'Failed to start mqtt session';
					debug(debugPrefix + 'calling getMqttToken')
					return this.getMqttToken(this.session.username, this.session.accessToken, this.session.householdId);
				})
				.then((mqttToken) => {
					this.log.debug('%s: ++++++ step 10: getMqttToken token was retrieved, token %s', watchdogInstance, mqttToken)
					this.log.debug('%s: ++++++ step 10: start mqtt client', watchdogInstance)
					debug(debugPrefix + 'calling statMqttClient')
					return this.statMqttClient(this, this.session.householdId, mqttToken);  // returns true
				})
				.catch(errorReason => {
					// log any errors and set the currentSessionState
					this.log.warn(errorTitle + ' - %s', errorReason);
					currentSessionState = sessionState.DISCONNECTED;
					this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
					return true
				});
			debug(debugPrefix + 'end of promise chain')
			this.log.debug('%s: ++++++ End of promise chain', watchdogInstance)
			//this.log.debug('%s: ++++ create session promise chain completed', watchdogInstance)
		}

		if (this.config.debugLevel > 2) { this.log.warn('%s: Exiting sessionWatchdog', watchdogInstance,); }
		debug(debugPrefix + 'exiting sessionWatchdog')
		//this.log('Exiting sessionWatchdog')
		this.sessionWatchdogRunning = false;
		return true

	}


	// discover all devices
	async discoverDevices() {
		return new Promise((resolve, reject) => {
			this.log('Discovering devices...');

			// show feedback for devices found
			if (!this.devices || !this.devices[0].settings) {
				this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
				this.sessionWatchdogRunning = false;
				//this.log('Failed to find any devices. The backend systems may be down, or you have no supported devices on your customer account')
				reject('No devices found. The backend systems may be down, or you have no supported devices on your customer account')

			} else {
				// at least one device found
				var logText = "Found %s device";
				if (this.devices.length > 1) { logText = logText + "s"; }
				this.log(logText, this.devices.length);


				// user config tip showing all found devices
				// display only when no config.devices not found
				this.log.debug('Showing config tip...');
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


				// setup/restore each device in turn as an accessory, as we can only setup the accessory after the session is created and the physicalDevices are retrieved
				this.log.debug("Finding devices in cache...");
				for (let i = 0; i < this.devices.length; i++) {

					// setup each device (runs once per device)
					const deviceName = this.devices[i].settings.deviceFriendlyName;
					this.log("Device %s: %s %s", i + 1, deviceName, this.devices[i].deviceId);

					// generate a constant uuid that will never change over the life of the accessory
					const uuid = this.api.hap.uuid.generate(this.devices[i].deviceId + PLUGIN_ENV);

					// check if the accessory already exists, create if it does not
					// a stbDevice contains various data: HomeKit accessory, EOS platform, EOS device, EOS profile
					let foundStbDevice = this.stbDevices.find(stbDevice => (stbDevice.accessory || {}).UUID === uuid)
					if (!foundStbDevice) {
						this.log("Device %s: Not found in cache, creating new accessory for %s", i + 1, this.devices[i].deviceId);

						// create the accessory
						// 	constructor(log, config, api, device, customer, entitlements, platform) {
						this.log("Setting up device %s of %s: %s", i + 1, this.devices.length, deviceName);
						//let newStbDevice = new stbDevice(this.log, this.config, this.api, this.devices[i], this.customer, this.entitlements, this);
						// simplified the call by removing customer and entitlements as they are part of platform anyway
						let newStbDevice = new stbDevice(this.log, this.config, this.api, this.devices[i], this);
						this.stbDevices.push(newStbDevice);

					} else {
						this.log("Device found in cache: [%s] %s", foundStbDevice.name, foundStbDevice.deviceId);
					}

				};
				resolve(this.stbDevices); // resolve the promise with the stbDevices object
			}

			//this.log.debug('discoverDevices: end of code block')
		})
	}


	// get a new access token
	async refreshAccessToken() {
		return new Promise((resolve, reject) => {

			// exit immediately if access token has not expired
			if (this.session.accessTokenExpiry > Date.now()) {
				if (this.config.debugLevel >= 1) { this.log.warn('refreshAccessToken: Access token has not expired yet. Next refresh will occur after %s', this.session.accessTokenExpiry.toLocaleString()); }
				resolve(true);
				return
			}

			if (this.config.debugLevel >= 1) { this.log.warn('refreshAccessToken: Access token has expired at %s. Requesting refresh', this.session.accessTokenExpiry.toLocaleString()); }

			// needed to suppress the XSRF-TOKEN which upsets the auth refresh
			axiosWS.defaults.xsrfCookieName = undefined; // change  xsrfCookieName: 'XSRF-TOKEN' to  xsrfCookieName: undefined, we do not want this default,

			const axiosConfig = {
				method: 'POST',
				// https://prod.spark.sunrisetv.ch/auth-service/v1/authorization/refresh
				//url: countryBaseUrlArray[this.config.country.toLowerCase()] + '/auth-service/v1/authorization/refresh',
				url: this.configsvc.authorizationService.URL + '/v1/authorization/refresh',
				headers: {
					"accept": "*/*", // mandatory
					"content-type": "application/json; charset=UTF-8", // mandatory
					'x-oesp-username': this.session.username,
					"x-tracking-id": this.customer.hashedCustomerId, // hashed customer id

				},
				jar: cookieJar,
				data: {
					refreshToken: this.session.refreshToken,
					username: this.config.username
				}
			};

			if (this.config.debugLevel >= 1) { this.log.warn('refreshAccessToken: Post auth refresh request to', axiosConfig.url); }
			axiosWS(axiosConfig)
				.then(response => {
					if (this.config.debugLevel >= 2) {
						this.log('refreshAccessToken: auth refresh response:', response.status, response.statusText);
						this.log('refreshAccessToken: response data (saved to this.session):');
						this.log(response.data);
						//this.log(response.headers); 
					}
					this.session = response.data;

					// add an expiry date for the access token: 2 min (120000ms) after created date
					this.session.accessTokenExpiry = new Date(new Date().getTime() + 2 * 60000);

					// check if householdId exists, if so, we have authenticated ok
					if (this.session.householdId) { currentSessionState = sessionState.AUTHENTICATED; }
					this.log.debug('Session username:', this.session.username);
					this.log.debug('Session householdId:', this.session.householdId);
					this.log.debug('Session accessToken:', this.session.accessToken);
					this.log.debug('Session accessTokenExpiry:', this.session.accessTokenExpiry);
					this.log.debug('Session refreshToken:', this.session.refreshToken);
					this.log.debug('Session refreshTokenExpiry:', this.session.refreshTokenExpiry);
					// Robustness: Observed that new APLSTB Apollo box on NL did not always return username during session logon, so store username from settings if missing
					if (this.session.username == '') {
						this.log.debug('Session username empty, setting to %s', this.config.username);
						this.session.username = this.config.username;
					} else {
						this.log.debug('Session username exists: %s', this.session.username);
					}
					currentSessionState = sessionState.CONNECTED;
					this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
					resolve(this.session.householdId) // resolve the promise with the householdId
				})
				.catch(error => {
					this.log.debug('refreshAccessToken: error:', error);
					reject(error); // reject the promise and return the error
				});
		})
	}


	// select the right session to create
	async createSession(country) {
		return new Promise((resolve, reject) => {
			this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
			//switch using authmethod with backup of country
			switch (this.config.authmethod || this.config.country) {
				case 'D': // OAuth 2.0 with PKCE
					this.getSessionOAuth2Pkce()
						.then((getSessionResponse) => { resolve(getSessionResponse); }) // return the getSessionResponse for the promise
						.catch(error => { reject(error); }); // on any error, reject the promise and pass back the error
					break;
				case 'be-nl': case 'be-fr': case 'B':
					this.getSessionBE()
						.then((getSessionResponse) => { resolve(getSessionResponse); }) // return the getSessionResponse for the promise
						.catch(error => { reject(error); }); // on any error, reject the promise and pass back the error
					break;
				case 'gb': case 'C':
					this.getSessionGB()
						.then((getSessionResponse) => { resolve(getSessionResponse); }) // return the getSessionResponse for the promise
						.catch(error => { reject(error); }); // on any error, reject the promise and pass back the error
					break;
				default: // ch, nl, ie, at, method A
					this.getSession()
						.then((getSessionResponse) => { resolve(getSessionResponse); }) // resolve with the getSessionResponse for the promise
						.catch(error => { reject(error); }); // on any error, reject the promise and pass back the error
			}
		})
	}


	// get session for OAuth 2.0 PKCE (special logon sequence)
	getSessionOAuth2Pkce() {
		return new Promise((resolve, reject) => {
			this.log('Creating %s OAuth 2.0 PKCE session...', PLATFORM_NAME);
			this.log.warn('++++ PLEASE NOTE: This is current test code with lots of debugging. Do not expect it to work yet. ++++');
			currentSessionState = sessionState.LOADING;


			// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
			// axios interceptors to log request and response for debugging
			// works on all following requests in this sub
			/*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:', req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,
				'\nParams:', req.params, '\nData:', req.data
				);
				this.log.warn(req); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nUrl:', res.url, 
				//'\nData:', res.data, 
				'\nLast Request:', res.request
				);
				//this.log.warn(res); 
				this.log('+++INTERCEPTED AFTER HTTP RESPONSE COOKIEJAR:'); 
				if (cookieJar) { this.log(cookieJar); }// watch out for empty cookieJar
				return res; // must return response
			});
			*/
			// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

			// good description of PKCE
			// https://www.authlete.com/developers/pkce/
			// creake a PKCE code pair and save it
			this.pkcePair = generatePKCEPair();
			//this.log('PKCE pair:', pkcePair); 


			// Step 1: # get authentication details
			// Recorded sequence step 1: https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
			// const GB_AUTH_OESP_URL = 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web';
			// https://spark-prod-gb.gnp.cloud.virgintvgo.virginmedia.com/auth-service/v1/sso/authorization?code_challenge=aHsoE2kJlwA4qGOcx1OCH7i__1bBdV1l6yLOKUvW24U&language=en
			let apiAuthorizationUrl = this.configsvc.authorizationService.URL + '/v1/sso/authorization?'
				+ 'code_challenge=' + this.pkcePair.code_challenge
				+ '&language=en';

			this.log('Step 1 of 7: get authentication details');
			if (this.config.debugLevel > 1) { this.log.warn('Step 1 of 7: get authentication details from', apiAuthorizationUrl); }
			axiosWS.get(apiAuthorizationUrl)
				.then(response => {
					this.log('Step 1 of 7: response:', response.status, response.statusText);
					this.log('Step 1 of 7: response.data', response.data);

					// get the data we need for further steps
					let auth = response.data;
					let authState = auth.state;
					let authAuthorizationUri = auth.authorizationUri;
					let authValidtyToken = auth.validityToken;
					this.log('Step 1 of 7: results: authState', authState);
					this.log('Step 1 of 7: results: authAuthorizationUri', authAuthorizationUri);
					this.log('Step 1 of 7: results: authValidtyToken', authValidtyToken);

					// Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
					this.log('Step 2 of 7: get AUTH cookie');
					this.log.debug('Step 2 of 7: get AUTH cookie ULM-JSESSIONID from', authAuthorizationUri);
					axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						// unsure what minimum headers will here
						headers: {
							Accept: 'application/json, text/plain, */*'
							//Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
						},
					})
						.then(response => {
							this.log('Step 2 of 7: response:', response.status, response.statusText);
							this.log.warn('Step 2 of 7 response.data', response.data); // an html logon page

							// Step 3: # login
							this.log('Step 3 of 7: logging in with username %s', this.config.username);
							currentSessionState = sessionState.LOGGING_IN;

							// we want to POST to 
							// 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
							// see https://auth0.com/intro-to-iam/what-is-openid-connect-oidc
							const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
							this.log.debug('Step 3 of 7: POST request will contain this data: {"username":"' + this.config.username + '","credential":"' + this.config.password + '"}');
							axiosWS(GB_AUTH_URL, {
								//axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
								jar: cookieJar,
								// However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
								data: '{"username":"' + this.config.username + '","credential":"' + this.config.password + '"}',
								method: "POST",
								// minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
								headers: {
									"accept": "*/*", // mandatory
									"content-type": "application/json; charset=UTF-8", // mandatory
								},
								maxRedirects: 0, // do not follow redirects
								validateStatus: function (status) {
									return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK. GB returns 200
								},
							})
								.then(response => {
									this.log('Step 3 of 7: response:', response.status, response.statusText);
									this.log.warn('Step 3 of 7: response.headers:', response.headers);
									// responds with a userId, this will need to be used somewhere...
									this.log.warn('Step 3 of 7: response.data:', response.data); // { userId: 28786528, runtimeId: 79339515 }


									var url = response.headers['x-redirect-location'] // must be lowercase
									if (!url) {		// robustness: fail if url missing
										this.log.warn('getSessionGB: Step 3: x-redirect-location url empty!');
										currentSessionState = sessionState.DISCONNECTED;
										this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
										return false;
									}
									//location is h??=... if success
									//location is https?? if not authorised
									//location is https:... error=session_expired if session has expired
									if (url.indexOf('authentication_error=true') > 0) { // >0 if found
										//this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
										reject('Step 3 of 7: Unable to login: wrong credentials'); // reject the promise and return the error
									} else if (url.indexOf('error=session_expired') > 0) { // >0 if found
										//this.log.warn('Step 3 of 7: Unable to login: session expired');
										cookieJar.removeAllCookies();	// remove all the locally cached cookies
										reject('Step 3 of 7: Unable to login: session expired'); // reject the promise and return the error
									} else {
										this.log.debug('Step 3 of 7: login successful');

										// Step 4: # follow redirect url
										this.log('Step 4 of 7: follow redirect url');
										axiosWS.get(url, {
											jar: cookieJar,
											maxRedirects: 0, // do not follow redirects
											validateStatus: function (status) {
												return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK
											},
										})
											.then(response => {
												this.log('Step 4 of 7: response:', response.status, response.statusText);
												this.log.warn('Step 4 of 7: response.headers.location:', response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
												this.log.warn('Step 4 of 7: response.data:', response.data);
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 4 of 7 location url empty!');
													currentSessionState = sessionState.DISCONNECTED;
													this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
													return false;
												}

												// look for login_success?code=
												if (url.indexOf('login_success?code=') < 0) { // <0 if not found
													//this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
													reject('Step 4 of 7: Unable to login: wrong credentials'); // reject the promise and return the error
												} else if (url.indexOf('error=session_expired') > 0) {
													//this.log.warn('Step 4 of 7: Unable to login: session expired');
													cookieJar.removeAllCookies();	// remove all the locally cached cookies
													reject('Step 4 of 7: Unable to login: session expired'); // reject the promise and return the error
												} else {

													// Step 5: # obtain authorizationCode
													this.log('Step 5 of 7: extract authorizationCode');
													/*
													url = response.headers.location;
													if (!url) {		// robustness: fail if url missing
														this.log.warn('getSessionGB: Step 5: location url empty!');
														currentSessionState = sessionState.DISCONNECTED;
														this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														return false;						
													}				
													*/

													var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
													var authorizationCode = codeMatches[1];
													if (codeMatches.length !== 2) { // length must be 2 if code found
														this.log.warn('Step 5 of 7: Unable to extract authorizationCode');
													} else {
														this.log('Step 5 of 7: authorizationCode OK');
														this.log.debug('Step 5 of 7: authorizationCode:', authorizationCode);

														// Step 6: # authorize again
														this.log('Step 6 of 7: post auth data with valid code');
														this.log.debug('Step 6 of 7: post auth data with valid code to', apiAuthorizationUrl);
														currentSessionState = sessionState.AUTHENTICATING;
														var payload = {
															'authorizationGrant': {
																'authorizationCode': authorizationCode,
																'validityToken': authValidtyToken,
																'state': authState
															}
														};
														axiosWS.post(apiAuthorizationUrl, payload, { jar: cookieJar })
															.then(response => {
																this.log('Step 6 of 7: response:', response.status, response.statusText);
																this.log.debug('Step 6 of 7: response.data:', response.data);

																auth = response.data;
																this.log.debug('Step 6 of 7: refreshToken:', auth.refreshToken);

																// Step 7: # get OESP code
																this.log('Step 7 of 7: post refreshToken request');
																this.log.debug('Step 7 of 7: post refreshToken request to', apiAuthorizationUrl);
																payload = { 'refreshToken': auth.refreshToken, 'username': auth.username };
																// must resolve to
																// 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/session';',
																var sessionUrl = GB_AUTH_OESP_URL + '/session';
																axiosWS.post(sessionUrl + "?token=true", payload, { jar: cookieJar })
																	.then(response => {
																		this.log('Step 7 of 7: response:', response.status, response.statusText);
																		currentSessionState = sessionState.VERIFYING;

																		this.log.debug('Step 7 of 7: response.headers:', response.headers);
																		this.log.debug('Step 7 of 7: response.data:', response.data);
																		this.log.debug('Cookies for the session:', cookieJar.getCookies(sessionUrl));
																		if (this.config.debugLevel > 2) {
																			this.log('getSessionGB: response data (saved to this.session):');
																			this.log(response.data);
																		}

																		// get device data from the session
																		this.session = response.data;
																		// New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
																		if (this.session.username == '') { this.session.username = this.config.username; }

																		currentSessionState = sessionState.CONNECTED;
																		this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
																		this.log('Session created');
																		resolve(this.session.householdId) // resolve the promise with the householdId
																	})
																	// Step 7 http errors
																	.catch(error => {
																		this.log.debug("Step 7 of 7: error:", error);
																		reject("Step 7 of 7: Unable to get OESP token: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
																	});
															})
															// Step 6 http errors
															.catch(error => {
																reject("Step 6 of 7: Unable to authorize with oauth code, http error: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
															});
													};
												};
											})
											// Step 4 http errors
											.catch(error => {
												this.log.debug("Step 4 of 7: error:", error);
												this.log.warn("Step 4 of 7: error:", error);
												reject("Step 4 of 7: Unable to oauth authorize: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
											});
									};
								})
								// Step 3 http errors
								.catch(error => {
									this.log.debug("Step 3 of 7: error:", error);
									this.log.warn("Step 3 of 7: error:", error);
									reject("Step 3 of 7: Unable to login: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
								});
						})
						// Step 2 http errors
						.catch(error => {
							this.log.debug("Step 2 of 7: error:", error);
							reject("Step 2 of 7: Could not get authorizationUri: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
						});
				})
				// Step 1 http errors
				.catch(error => {
					this.log.debug("Step 1 of 7: error:", error);
					reject("Step 1 of 7: Failed to create session - check your internet connection"); // reject the promise and return the error
				});

			currentSessionState = sessionState.DISCONNECTED;
			this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
		})
	}



	// get session ch, nl, ie, at
	// using new auth method, as of 13.10.2022
	async getSession() {
		return new Promise((resolve, reject) => {
			this.log('Creating %s session...', PLATFORM_NAME);
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
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nData:', res.data, 
				//'\nLast Request:', res.request
				);
				//this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
				return res; // must return response
			});
			*/
			// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


			const axiosConfig = {
				method: 'POST',
				//url: countryBaseUrlArray[this.config.country.toLowerCase()] + '/auth-service/v1/authorization',
				url: this.configsvc.authorizationService.URL + '/v1/authorization',
				headers: {
					"accept": "*/*", // added 07.08.2023
					"content-type": "application/json; charset=utf-8", // added 07.08.2023
					"x-device-code": "web", // mandatory
					//'x-oesp-username': this.session.username , // added 07.08.2023
					//"x-profile": profile.profileId,  // added 07.08.2023
					//"x-tracking-id": this.customer.hashedCustomerId, // hashed customer id  // added 07.08.2023
				},
				jar: cookieJar,
				data: {
					username: this.config.username,
					password: this.config.password,
					stayLoggedIn: false // could also set to true
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
			if (this.config.debugLevel > 1) { this.log.warn('Step 1 of 1: post login to', axiosConfig.url); }
			axiosWS(axiosConfig)
				.then(response => {
					this.log('Step 1 of 1: response:', response.status, response.statusText);
					if (this.config.debugLevel > 2) {
						this.log('getSession: response data (saved to this.session):');
						this.log(response.data);
					}
					this.session = response.data;

					// add an expiry date for the access token: 2 min (120000ms) after created date
					this.session.accessTokenExpiry = new Date(new Date().getTime() + 2 * 60000);

					// check if householdId exists, if so, we have authenticated ok
					if (this.session.householdId) { currentSessionState = sessionState.AUTHENTICATED; }
					this.log.debug('Session username:', this.session.username);
					this.log.debug('Session householdId:', this.session.householdId);
					this.log.debug('Session accessToken:', this.session.accessToken);
					this.log.debug('Session accessTokenExpiry:', this.session.accessTokenExpiry);
					this.log.debug('Session refreshToken:', this.session.refreshToken);
					this.log.debug('Session refreshTokenExpiry:', this.session.refreshTokenExpiry);
					// Robustness: Observed that new APLSTB Apollo box on NL did not always return username during session logon, so store username from settings if missing
					if (this.session.username == '') {
						this.log.debug('Session username empty, setting to %s', this.config.username);
						this.session.username = this.config.username;
					} else {
						this.log.debug('Session username exists: %s', this.session.username);
					}
					currentSessionState = sessionState.CONNECTED;
					this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
					this.log('Session %s', Object.keys(sessionState)[currentSessionState]);
					resolve(this.session.householdId) // resolve the promise with the householdId
				})
				.catch(error => {
					let errReason;
					if (error.response && error.response.status >= 400 && error.response.status < 500) {
						errReason = 'check your ' + PLATFORM_NAME + ' username and password: ' + error.response.status + ' ' + (error.response.statusText || '');
					} else if (error.response && error.response.status >= 500 && error.response.status < 600) {
						errReason = 'try again later: ' + error.response.status + ' ' + (error.response.statusText || '');
					} else if (error.response && error.response.status) {
						errReason = 'check your internet connection: ' + error.response.status + ' ' + (error.response.statusText || '');
					} else if (error.code) {
						errReason = 'check your internet connection: ' + error.code + ' ' + (error.hostname || '');
					} else {
						errReason = 'unexpected error: ' + error;
					}
					//this.log('%s %s', errText, (errReason || ''));
					this.log.debug('getSession: error:', error);
					reject(errReason); // reject the promise and return the error
				});
		})
	}



	// get session for BE only (special logon sequence)
	async getSessionBE() {
		return new Promise((resolve, reject) => {
			// only for be-nl and be-fr users, as the session logon using openid is different
			// looks like also for gb users:
			this.log('Creating %s BE session...', PLATFORM_NAME);
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
			//let apiAuthorizationUrl = countryBaseUrlArray[this.config.country.toLowerCase()] + '/auth-service/v1/sso/authorization';
			let apiAuthorizationUrl = this.configsvc.authorizationService.URL + '/v1/sso/authorization';
			this.log('Step 1 of 6: get authentication details');
			if (this.config.debugLevel > 1) { this.log.warn('Step 1 of 6: get authentication details from', apiAuthorizationUrl); }
			axiosWS.get(apiAuthorizationUrl)
				.then(response => {
					this.log('Step 1 of 6: response:', response.status, response.statusText);

					// get the data we need for further steps
					let auth = response.data;
					let authState = auth.state;
					let authAuthorizationUri = auth.authorizationUri;
					let authValidtyToken = auth.validityToken;

					// Step 2: # follow authorizationUri to get AUTH cookie
					this.log('Step 2 of 6: get AUTH cookie');
					this.log.debug('Step 2 of 6: get AUTH cookie from', authAuthorizationUri);
					axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						// unsure what minimum headers will here
						headers: {
							Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
						},
					})
						.then(response => {
							this.log('Step 2 of 6: response:', response.status, response.statusText);

							// Step 3: # login
							this.log('Step 3 of 6: logging in with username %s', this.config.username);
							this.log.debug('Step 3 of 6: post login to auth url:', BE_AUTH_URL);
							this.log.debug('Step 3 of 6: Cookies for the auth url:', cookieJar.getCookies(BE_AUTH_URL));
							currentSessionState = sessionState.LOGGING_IN;
							var payload = qs.stringify({
								j_username: this.config.username,
								j_password: this.config.password,
								rememberme: 'true'
							});
							this.log.debug('Step 3 of 6: using payload', payload);
							axiosWS.post(BE_AUTH_URL, payload, {
								jar: cookieJar,
								maxRedirects: 0, // do not follow redirects
								validateStatus: function (status) {
									return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK
								},
							})
								.then(response => {
									this.log('Step 3 of 6: response:', response.status, response.statusText);
									this.log.debug('Step 3 response.headers.location:', response.headers.location);
									this.log.debug('Step 3 response.headers:', response.headers);
									var url = response.headers.location;
									if (!url) {		// robustness: fail if url missing
										this.log.warn('getSessionBE: Step 3: location url empty!');
										currentSessionState = sessionState.DISCONNECTED;
										return false;
									}

									// locations unsure after change of login method in October 2022
									//location is https://login.prd.telenet.be/openid/login?response_type=code&state=... if success
									//location is https://login.prd.telenet.be/openid/login?authentication_error=true if not authorised
									//location is https://login.prd.telenet.be/openid/login?error=session_expired if session has expired
									if (url.indexOf('authentication_error=true') > 0) { // >0 if found
										//this.log.warn('Step 3 of 6: Unable to login: wrong credentials');
										reject("Step 3 of 6: Unable to login: wrong credentials"); // reject the promise and return the error
										//currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
										//this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
									} else if (url.indexOf('error=session_expired') > 0) {
										//this.log.warn('Step 3 of 6: Unable to login: session expired');
										cookieJar.removeAllCookies();	// remove all the locally cached cookies
										reject("Step 3 of 6: Unable to login: session expired"); // reject the promise and return the error
									} else {

										// Step 4: # follow redirect url
										this.log('Step 4 of 6: follow redirect url');
										//this.log('Cookies for the redirect url:',cookieJar.getCookies(url));
										axiosWS.get(url, {
											jar: cookieJar,
											maxRedirects: 0, // do not follow redirects
											validateStatus: function (status) {
												return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK
											},
										})
											.then(response => {
												this.log('Step 4 of 6: response:', response.status, response.statusText);
												this.log.debug('Step 4 response.headers.location:', response.headers.location);
												this.log.debug('Step 4 response.headers:', response.headers);
												this.log.debug('Step 4 response:', response);
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													//this.log.warn('Step 4 of 6: location url empty!');
													reject("Step 4 of 6: location url empty!"); // reject the promise and return the error
													return
													// look for login_success.html?code=
												} else if (url.indexOf('login_success.html?code=') < 0) { // <0 if not found
													//this.log.warn('Step 4 of 6: Unable to login: wrong credentials');
													reject("Step 4 of 6: Unable to login: wrong credentials"); // reject the promise and return the error
												} else if (url.indexOf('error=session_expired') > 0) {
													//this.log.warn('Step 4 of 6: Unable to login: session expired');
													cookieJar.removeAllCookies();	// remove all the locally cached cookies
													reject("Step 4 of 6: Unable to login: session expired"); // reject the promise and return the error
												} else {

													// Step 5: # obtain authorizationCode
													this.log('Step 5 of 6: extract authorizationCode');
													url = response.headers.location;
													if (!url) {		// robustness: fail if url missing
														//this.log.warn('Step 5 of 6: location url empty!');
														reject("Step 5 of 6: location url empty!"); // reject the promise and return the error
													}

													var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
													var authorizationCode = codeMatches[1];
													if (codeMatches.length !== 2) { // length must be 2 if code found
														//this.log.warn('Step 5 of 6: Unable to extract authorizationCode');
														reject("Step 5 of 6: Unable to extract authorizationCode"); // reject the promise and return the error
													} else {
														this.log('Step 5 of 6: authorizationCode OK');
														this.log.debug('Step 5 of 6: authorizationCode:', authorizationCode);

														// Step 6: # authorize again
														this.log('Step 6 of 6: post auth data');
														this.log.debug('Step 6 of 6: post auth data to', apiAuthorizationUrl);
														currentSessionState = sessionState.AUTHENTICATING;
														payload = {
															'authorizationGrant': {
																'authorizationCode': authorizationCode,
																'validityToken': authValidtyToken,
																'state': authState
															}
														};
														//this.log('Cookies for the session:',cookieJar.getCookies(apiAuthorizationUrl));
														axiosWS.post(apiAuthorizationUrl, payload, {
															jar: cookieJar,
															// minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
															headers: {
																"accept": "*/*", // mandatory
																"content-type": "application/json; charset=UTF-8", // mandatory
															}
														})
															.then(response => {
																this.log('Step 6 of 6: response:', response.status, response.statusText);
																if (this.config.debugLevel > 2) {
																	this.log('getSessionBE: response data (saved to this.session):');
																	this.log(response.data);
																}

																// get device data from the session
																this.session = response.data;
																// New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
																if (this.session.username == '') { this.session.username = this.config.username; }
																this.log('Session created');
																currentSessionState = sessionState.CONNECTED;
																this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
																resolve(this.session.householdId) // resolve the promise with the householdId
															})
															// Step 6 http errors
															.catch(error => {
																//this.log.warn("Step 6 of 6: Unable to authorize with oauth code:", error.response.status, error.response.statusText);
																this.log.debug("Step 6 of 6: Unable to authorize with oauth code:", error);
																reject("Step 6 of 6: Unable to authorize with oauth code: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
															});
													};
												};
											})
											// Step 4 http errors
											.catch(error => {
												//this.log.warn("Step 4 of 6: Unable to oauth authorize:", error.response.status, error.response.statusText);
												this.log.debug("Step 4 of 6: Unable to oauth authorize:", error);
												//reject("Step 4 of 6: Unable to oauth authorize: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
												reject("Step 4 of 6: Unable to oauth authorize: " + error); // reject the promise and return the error
											});
									};
								})
								// Step 3 http errors
								.catch(error => {
									this.log.debug("Step 3 of 6: Unable to login:", error);
									this.log("Step 3 of 6: Unable to login:", error);
									reject("Step 3 of 6: Unable to login: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
								});
						})
						// Step 2 http errors
						.catch(error => {
							this.log.debug("Step 2 of 6: Could not get authorizationUri:", error);
							//this.log.warn("Step 2 of 6: Could not get authorizationUri", error.response.status, error.response.statusText);
							reject("Step 2 of 6: Could not get authorizationUri: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
						});
				})
				// Step 1 http errors
				.catch(error => {
					if (!error.response) {
						this.log('Step 1 of 6: Failed to create BE session - check your internet connection.');
					} else {
						this.log('Step 1 of 6: Failed to create BE session: %s', error.response.status, error.response.statusText);
					}
					this.log.debug('Step 1 of 6: getSessionBE: error:', error);
					reject("Step 1 of 6: Failed to create BE session: check your internet connection"); // reject the promise and return the error
				});

			currentSessionState = sessionState.DISCONNECTED;
			this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
		})
	}


	// get session for GB only (special logon sequence)
	getSessionGB() {
		return new Promise((resolve, reject) => {
			this.log('Creating %s GB session...', PLATFORM_NAME);
			currentSessionState = sessionState.LOADING;


			// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
			// axios interceptors to log request and response for debugging
			// works on all following requests in this sub
			/*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:', req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,
				'\nParams:', req.params, '\nData:', req.data
				);
				this.log.warn(req); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nUrl:', res.url, 
				//'\nData:', res.data, 
				'\nLast Request:', res.request
				);
				//this.log.warn(res); 
				this.log('+++INTERCEPTED AFTER HTTP RESPONSE COOKIEJAR:'); 
				if (cookieJar) { this.log(cookieJar); }// watch out for empty cookieJar
				return res; // must return response
			});
			*/
			// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


			// Step 1: # get authentication details
			// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
			// https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/authorization
			// Recorded sequence step 1: https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
			// const GB_AUTH_OESP_URL = 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web';
			let apiAuthorizationUrl = GB_AUTH_OESP_URL + '/authorization';
			this.log('Step 1 of 7: get authentication details');
			if (this.config.debugLevel > 1) { this.log.warn('Step 1 of 7: get authentication details from', apiAuthorizationUrl); }
			axiosWS.get(apiAuthorizationUrl)
				.then(response => {
					this.log('Step 1 of 7: response:', response.status, response.statusText);
					//this.log('Step 1 of 7: response.data',response.data);

					// get the data we need for further steps
					let auth = response.data;
					let authState = auth.session.state;
					let authAuthorizationUri = auth.session.authorizationUri;
					let authValidtyToken = auth.session.validityToken;
					//this.log('Step 1 of 7: results: authState',authState);
					//this.log('Step 1 of 7: results: authAuthorizationUri',authAuthorizationUri);
					//this.log('Step 1 of 7: results: authValidtyToken',authValidtyToken);

					// Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
					this.log('Step 2 of 7: get AUTH cookie');
					this.log.debug('Step 2 of 7: get AUTH cookie ULM-JSESSIONID from', authAuthorizationUri);
					axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						// unsure what minimum headers will here
						headers: {
							Accept: 'application/json, text/plain, */*'
							//Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
						},
					})
						.then(response => {
							this.log('Step 2 of 7: response:', response.status, response.statusText);
							//this.log.warn('Step 2 of 7 response.data',response.data); // an html logon page

							// Step 3: # login
							this.log('Step 3 of 7: logging in with username %s', this.config.username);
							currentSessionState = sessionState.LOGGING_IN;

							// we want to POST to 
							// 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
							const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
							this.log.debug('Step 3 of 7: POST request will contain this data: {"username":"' + this.config.username + '","credential":"' + this.config.password + '"}');
							axiosWS(GB_AUTH_URL, {
								//axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
								jar: cookieJar,
								// However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
								data: '{"username":"' + this.config.username + '","credential":"' + this.config.password + '"}',
								method: "POST",
								// minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
								headers: {
									"accept": "*/*", // mandatory
									"content-type": "application/json; charset=UTF-8", // mandatory
								},
								maxRedirects: 0, // do not follow redirects
								validateStatus: function (status) {
									return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK. GB returns 200
								},
							})
								.then(response => {
									this.log('Step 3 of 7: response:', response.status, response.statusText);
									//this.log.debug('Step 3 of 7: response.headers:',response.headers); 
									//this.log.debug('Step 3 of 7: response.data:',response.data);

									// X-Redirect-Location
									// https://id.virginmedia.com/oidc/authorize?response_type=code&state=8ce19449-6cc9-4a65-bcbc-cea7e1884733&nonce=49b0119d-1673-41c5-97b7-eb6092c60b40&client_id=9b471ffe-7ff5-497b-9059-8dcb7c0d66f5&redirect_uri=https://virgintvgo.virginmedia.com/obo_en/login_success&claims={"id_token":{"ukHouseholdId":null}}
									var url = response.headers['x-redirect-location'] // must be lowercase
									if (!url) {		// robustness: fail if url missing
										this.log.warn('getSessionGB: Step 3: x-redirect-location url empty!');
										currentSessionState = sessionState.DISCONNECTED;
										this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
										return false;
									}
									//location is h??=... if success
									//location is https?? if not authorised
									//location is https:... error=session_expired if session has expired
									if (url.indexOf('authentication_error=true') > 0) { // >0 if found
										//this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
										reject('Step 3 of 7: Unable to login: wrong credentials'); // reject the promise and return the error
									} else if (url.indexOf('error=session_expired') > 0) { // >0 if found
										//this.log.warn('Step 3 of 7: Unable to login: session expired');
										cookieJar.removeAllCookies();	// remove all the locally cached cookies
										reject('Step 3 of 7: Unable to login: session expired'); // reject the promise and return the error
									} else {
										this.log.debug('Step 3 of 7: login successful');

										// Step 4: # follow redirect url
										this.log('Step 4 of 7: follow redirect url');
										axiosWS.get(url, {
											jar: cookieJar,
											maxRedirects: 0, // do not follow redirects
											validateStatus: function (status) {
												return ((status >= 200 && status < 300) || status == 302); // allow 302 redirect as OK
											},
										})
											.then(response => {
												this.log('Step 4 of 7: response:', response.status, response.statusText);
												this.log.debug('Step 4 of 7: response.headers.location:', response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
												this.log.debug('Step 4 of 7: response.data:', response.data);
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 4 of 7 location url empty!');
													currentSessionState = sessionState.DISCONNECTED;
													this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
													return false;
												}

												// look for login_success?code=
												if (url.indexOf('login_success?code=') < 0) { // <0 if not found
													//this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
													reject('Step 4 of 7: Unable to login: wrong credentials'); // reject the promise and return the error
												} else if (url.indexOf('error=session_expired') > 0) {
													//this.log.warn('Step 4 of 7: Unable to login: session expired');
													cookieJar.removeAllCookies();	// remove all the locally cached cookies
													reject('Step 4 of 7: Unable to login: session expired'); // reject the promise and return the error
												} else {

													// Step 5: # obtain authorizationCode
													this.log('Step 5 of 7: extract authorizationCode');
													/*
													url = response.headers.location;
													if (!url) {		// robustness: fail if url missing
														this.log.warn('getSessionGB: Step 5: location url empty!');
														currentSessionState = sessionState.DISCONNECTED;
														this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														return false;						
													}				
													*/

													var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
													var authorizationCode = codeMatches[1];
													if (codeMatches.length !== 2) { // length must be 2 if code found
														this.log.warn('Step 5 of 7: Unable to extract authorizationCode');
													} else {
														this.log('Step 5 of 7: authorizationCode OK');
														this.log.debug('Step 5 of 7: authorizationCode:', authorizationCode);

														// Step 6: # authorize again
														this.log('Step 6 of 7: post auth data with valid code');
														this.log.debug('Step 6 of 7: post auth data with valid code to', apiAuthorizationUrl);
														currentSessionState = sessionState.AUTHENTICATING;
														var payload = {
															'authorizationGrant': {
																'authorizationCode': authorizationCode,
																'validityToken': authValidtyToken,
																'state': authState
															}
														};
														axiosWS.post(apiAuthorizationUrl, payload, { jar: cookieJar })
															.then(response => {
																this.log('Step 6 of 7: response:', response.status, response.statusText);
																this.log.debug('Step 6 of 7: response.data:', response.data);

																auth = response.data;
																this.log.debug('Step 6 of 7: refreshToken:', auth.refreshToken);

																// Step 7: # get OESP code
																this.log('Step 7 of 7: post refreshToken request');
																this.log.debug('Step 7 of 7: post refreshToken request to', apiAuthorizationUrl);
																payload = { 'refreshToken': auth.refreshToken, 'username': auth.username };
																// must resolve to
																// 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/session';',
																var sessionUrl = GB_AUTH_OESP_URL + '/session';
																axiosWS.post(sessionUrl + "?token=true", payload, { jar: cookieJar })
																	.then(response => {
																		this.log('Step 7 of 7: response:', response.status, response.statusText);
																		currentSessionState = sessionState.VERIFYING;

																		this.log.debug('Step 7 of 7: response.headers:', response.headers);
																		this.log.debug('Step 7 of 7: response.data:', response.data);
																		this.log.debug('Cookies for the session:', cookieJar.getCookies(sessionUrl));
																		if (this.config.debugLevel > 2) {
																			this.log('getSessionGB: response data (saved to this.session):');
																			this.log(response.data);
																		}

																		// get device data from the session
																		this.session = response.data;
																		// New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
																		if (this.session.username == '') { this.session.username = this.config.username; }

																		currentSessionState = sessionState.CONNECTED;
																		this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
																		this.log('Session created');
																		resolve(this.session.householdId) // resolve the promise with the householdId
																	})
																	// Step 7 http errors
																	.catch(error => {
																		//this.log.warn("Step 7 of 7: Unable to get OESP token:",error.response.status, error.response.statusText);
																		this.log.debug("Step 7 of 7: error:", error);
																		reject("Step 7 of 7: Unable to get OESP token: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
																	});
															})
															// Step 6 http errors
															.catch(error => {
																//this.log.warn("Step 6 of 7: Unable to authorize with oauth code, http error:",error);
																reject("Step 6 of 7: Unable to authorize with oauth code, http error: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
															});
													};
												};
											})
											// Step 4 http errors
											.catch(error => {
												//this.log.warn("Step 4 of 7: Unable to oauth authorize:",error.response.status, error.response.statusText);
												this.log.debug("Step 4 of 7: error:", error);
												reject("Step 4 of 7: Unable to oauth authorize: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
											});
									};
								})
								// Step 3 http errors
								.catch(error => {
									//this.log.warn("Step 3 of 7: Unable to login:",error.response.status, error.response.statusText);
									this.log.debug("Step 3 of 7: error:", error);
									reject("Step 3 of 7: Unable to login: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
								});
						})
						// Step 2 http errors
						.catch(error => {
							//this.log.warn("Step 2 of 7: Unable to get authorizationUri:",error.response.status, error.response.statusText);
							this.log.debug("Step 2 of 7: error:", error);
							reject("Step 2 of 7: Could not get authorizationUri: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
						});
				})
				// Step 1 http errors
				.catch(error => {
					//this.log('Failed to create GB session - check your internet connection');
					//this.log.warn("Step 1 of 7: Could not get apiAuthorizationUrl:",error.response.status, error.response.statusText);
					this.log.debug("Step 1 of 7: error:", error);
					reject("Step 1 of 7: Failed to create GB session - check your internet connection"); // reject the promise and return the error
				});

			currentSessionState = sessionState.DISCONNECTED;
			this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
		})
	}


	// load all available TV channels at regular intervals into an array
	// new version using endpoints available from 13.10.2022
	// the masterChannelList contains all possible channels, both subscribed and non-subscribed channels
	async refreshMasterChannelList(callback) {
		return new Promise((resolve, reject) => {
			// called by refreshMasterChannelList (state handler), thus runs at polling interval

			// exit immediately if the session does not exist
			if (currentSessionState != sessionState.CONNECTED) {
				if (this.config.debugLevel > 1) { this.log.warn('refreshMasterChannelList: Session does not exist, exiting'); }
				resolve(true);
				return
			}

			// exit immediately if channel list has not expired
			if (this.masterChannelListExpiryDate > Date.now()) {
				if (this.config.debugLevel >= 1) { this.log.warn('refreshMasterChannelList: Master channel list has not expired yet. Next refresh will occur after %s', this.masterChannelListExpiryDate.toLocaleString()); }
				resolve(true);
				return
			}

			this.log('Refreshing master channel list');


			// channels can be retrieved for the country without having a mqtt session going  but then the list is not relevant for the user's locationId
			// so you should add the user's locationId as a parameter, and this needs the accessToken
			// syntax:
			// https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/channels?byLocationId=41043&includeInvisible=true&includeNotEntitled=true&personalised=true&sort=channelNumber
			// https://prod.spark.sunrisetv.ch/eng/web/linear-service/v2/channels?cityId=401&language=en&productClass=Orion-DASH
			/*
			let url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/channels';
			url = url + '?byLocationId=' + this.session.locationId // locationId needed to get user-specific list
			url = url + '&includeInvisible=true' // includeInvisible
			url = url + '&includeNotEntitled=true' // includeNotEntitled
			url = url + '&personalised=true' // personalised
			url = url + '&sort=channelNumber' // sort
			*/
			//url = 'https://prod.spark.sunrisetv.ch/eng/web/linear-service/v2/channels?cityId=401&language=en&productClass=Orion-DASH'
			//let url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/linear-service/v2/channels';
			let url = this.configsvc.linearService.URL + '/v2/channels';
			url = url + '?cityId=' + this.customer.cityId; //+ this.customer.cityId // cityId needed to get user-specific list
			url = url + '&language=en'; // language
			url = url + '&productClass=Orion-DASH'; // productClass, must be Orion-DASH
			//url = url + '&includeNotEntitled=false' // includeNotEntitled testing to see if this parameter is accepted
			if (this.config.debugLevel > 0) { this.log.warn('refreshMasterChannelList: GET %s', url); }
			// call the webservice to get all available channels
			const axiosConfig = {
				method: 'GET',
				url: url,
				headers: {
					accept: '*/*',
					"x-oesp-token": this.session.accessToken, // to try and avoid the 401 auth issues
					'x-oesp-username': this.session.username
				}
			};
			axiosWS(axiosConfig)
				.then(response => {
					if (this.config.debugLevel > 0) { this.log.warn('refreshMasterChannelList: response: %s %s', response.status, response.statusText); }
					//this.log(response.data);

					// the header contains the following:
					// Cache-Control: max-age=600, public, stale-if-error=43200
					// this could be used to set expiry date...


					// set the masterChannelListExpiryDate to expire at now + MASTER_CHANNEL_LIST_VALID_FOR_S
					this.masterChannelListExpiryDate = new Date(new Date().getTime() + ((this.config.masterChannelListValidFor || MASTER_CHANNEL_LIST_VALID_FOR_S) * 1000));
					//this.log('MasterChannelList valid until',this.masterChannelListExpiryDate.toLocaleString())

					// load the channel list with all channels found
					this.masterChannelList = [];
					const channels = response.data;
					this.log.debug('Channels to process:', channels.length);
					for (let i = 0; i < channels.length; i++) {
						const channel = channels[i];
						if (this.config.debugLevel > 2) { this.log('Processing channel:', i, channel.logicalChannelNumber, channel.id, channel.name); } // for debug purposes
						// log the detail of logicalChannelNumber 60 nicktoons, for which I have no subscription, as a test of entitlements
						//if (this.config.debugLevel > 0) { if (channel.logicalChannelNumber == 60){ this.log('DEV: Logging Channel 60 to check entitlements :',channel); } }
						//if (this.config.debugLevel > 0) { if (channel.logicalChannelNumber == 60){ this.log('DEV: Logging Channel 60 to check entitlements :',channel); } }
						this.masterChannelList.push({
							id: channel.id,
							name: cleanNameForHomeKit(channel.name),
							logicalChannelNumber: channel.logicalChannelNumber,
							linearProducts: channel.linearProducts
						});
					}

					if (this.config.debugLevel > 0) {
						this.log.warn('refreshMasterChannelList: Master channel list refreshed with %s channels, valid until %s', this.masterChannelList.length, this.masterChannelListExpiryDate.toLocaleString());
					}
					resolve(this.masterChannelList); // resolve the promise with the masterChannelList object

				})
				.catch(error => {
					let errReason;
					errReason = 'Failed to refresh the master channel list - check your internet connection:'
					if (error.isAxiosError) {
						errReason = error.code + ': ' + (error.hostname || '');
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
					}
					//this.log('%s %s', errText, (errReason || ''));
					this.log.warn(`refreshMasterChannelList error:`, error);
					reject(errReason);
				});
		})
	}



	// load all recording states and bookings
	// called when a mqtt topic is received indicating a recording settings change
	async refreshRecordings(householdId, callback) {
		return new Promise((resolve, reject) => {
			this.log('Refreshing recordings');

			// can only refresh recordings if entitled to recordings
			const pvrFeatureFound = this.entitlements.features.find(feature => (feature === 'PVR' || feature === 'LOCALDVR'));
			this.log.debug('refreshRecordings: foundPvrEntitlement %s', pvrFeatureFound);
			if (pvrFeatureFound) {
				// execute the calls with a promise chain
				const errorTitle = 'Failed to refresh recordings';
				this.log.debug('refreshRecordings: ++++++ step 1: calling getRecordingState with householdId %s ', householdId)
				this.getRecordingState(householdId)
					.then(() => {
						this.log.debug('refreshRecordings: ++++++ step 2: calling getRecordingBookings with householdId %s ', householdId)
						this.getRecordingBookings(householdId) // returns customer object, with devices and profiles, stores object in this.customer
						resolve(true); // resolve the promise
						return;
					})
					.catch(errorReason => {
						// log any errors and set the currentSessionState
						this.log.warn(errorTitle + ' - %s', errorReason);
						reject(errorReason);
						return;
					});
			} else {
				this.log.debug('refreshRecordings: no recordings entitlement found');
			}
			resolve(true); // resolve the promise

		})
	}


	// get the config (containing all endpoints) for the country
	// added 14.01.2024
	async getConfig(countryCode, callback) {
		return new Promise((resolve, reject) => {
			this.log("Retrieving config for countryCode %s", countryCode);

			// https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json
			// https://spark-prod-be.gnp.cloud.telenet.tv/be/en/config-service/conf/web/backoffice.json
			// use countryCode.substr(0, 2) to allow be-fr to map to be for the backoffice url
			const ctryCodeForUrl = countryCode.substr(0, 2);

			//const url = 'https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json'
			const url = countryBaseUrlArray[countryCode] + '/' + ctryCodeForUrl + '/en/config-service/conf/web/backoffice.json';
			if (this.config.debugLevel > 0) { this.log.warn('getConfig: GET %s', url); }
			axiosWS.get(url)
				.then(response => {
					if (this.config.debugLevel > 0) { this.log.warn('getConfig: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 2) {
						this.log.warn('getConfig: response data (saved to this.configsvc):');
						this.log.warn(response.data);
					}
					this.configsvc = response.data; // store the entire config data for future use in this.configsvc
					resolve(this.configsvc); // resolve the promise with the configsvc object
				})
				.catch(error => {
					let errReason;
					errReason = 'Could not get config data for ' + countryCode + ' - check your internet connection'
					if (error.isAxiosError) {
						errReason = error.code + ': ' + (error.hostname || '');
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
					}
					this.log.debug(`getConfig error:`, error);
					reject(errReason);
				});
		})
	}




	// get Personalization Data via web request GET
	// this is for the web session type as of 13.10.2022
	// may not have the full data from GB...
	async getPersonalizationData(householdId, callback) {
		return new Promise((resolve, reject) => {
			this.log("Refreshing personalization data for householdId %s", householdId);

			//const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.householdId) + '/' + requestType;
			//const url='https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/' + householdId + '?with=profiles%2Cdevices';
			// https://spark-prod-ch.gnp.cloud.sunrisetv.ch/eng/web/personalization-service
			//const url=countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/personalization-service/v1/customer/' + householdId + '?with=profiles%2Cdevices';
			const url = this.configsvc.personalizationService.URL + '/v1/customer/' + householdId + '?with=profiles%2Cdevices';

			// headers are in the web client
			let config = {}
			if (this.config.country.toLowerCase() == 'gb') {
				// gb needs x-cus, x-oesp-token and x-oesp-username
				config = {
					headers: {
						"x-cus": this.session.householdId,
						"x-oesp-token": this.session.accessToken,
						"x-oesp-username": this.session.username
					}
				}
			} else {
				// other countries on new backend from Oct 2022 need just x-oesp-username
				config = {
					headers: {
						"x-oesp-username": this.session.username
					}
				}
			};
			if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: GET %s', url); }
			// this.log('getPersonalizationData: GET %s', url);
			axiosWS.get(url, config)
				.then(response => {
					if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 2) { // DEBUG
						this.log.warn('getPersonalizationData: response data (saved to this.customer):');
						this.log.warn(response.data);
					}

					// devices are an array named assignedDevices
					this.customer = response.data; // store the entire personalization data for future use in this.customer
					this.devices = response.data.assignedDevices; // store the entire device array at platform level

					// update all the devices in the array. Don't trust the index order in the Personalization Data message
					//this.log('getPersonalizationData: this.stbDevices.length:', this.stbDevices.length)
					if (this.stbDevices.length > 0) {
						this.devices.forEach((device) => {
							if (this.config.debugLevel > 2) { // DEBUG
								this.log.warn('getPersonalizationData: device settings for device %s:', device.deviceId);
								this.log.warn(device.settings);
								this.log.warn('getPersonalizationData: device capabilities for device %s:', device.deviceId);
								this.log.warn(device.capabilities);
							}
							const deviceId = device.deviceId;
							const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
							if (deviceIndex > -1 && this.stbDevices[deviceIndex]) {
								this.stbDevices[deviceIndex].device = device;
								this.stbDevices[deviceIndex].customer = this.customer; // store entire customer object

								//   mqttDeviceStateHandler(deviceId, 			powerState, mediaState, recordingState, channelId, 	eventId, 	sourceType, profileDataChanged, statusFault, 	programMode, statusActive, currInputDeviceType, currInputSourceType) {
								this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, null, true, Characteristic.StatusFault.NO_FAULT); // update this device
							}
						});

					}


					// profiles are an array named profiles, store entire array in this.profiles
					//this.profiles = response.data.profiles; // set this.profiles to the profile data we just received
					//this.log('getPersonalizationData: this.profiles:')
					//this.log(this.profiles)
					///let testProfile1 = this.profiles.find(profile => profile.name === 'Test');
					//this.log("getPersonalizationData: freshly stored profile data: Profile '%s' last modified at %s", testProfile1.name, testProfile1.lastModified); 
					//this.log(testProfile1)
					/*
					// for every personalization data update, update all devices device.customer per device with the new this.customer data
					// but only if stbDevices has been created...
					this.log('getPersonalizationData: this.stbDevices.length:', this.stbDevices.length)
					if (this.stbDevices.length > 0) {
						this.devices.forEach((device) => {
							device.customer = this.customer; // update the device with the refreshed customer data, including the profiles array
							this.log('getPersonalizationData: new customer data stored in device.customer:')
							//this.log(device.profiles)
							let testProfile = device.customer.profiles.find(profile => profile.name === 'Test');
							this.log("getPersonalizationData: Profile '%s' last modified at %s", testProfile.name, testProfile.lastModified); 
							this.log(testProfile)


							// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, sourceType, profileDataChanged, statusFault) {
							this.log('about to call mqttDeviceStateHandler')
							this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, true, Characteristic.StatusFault.NO_FAULT );
						});
					}
					*/
					// now we have the cityId data, load the MasterChannelList
					//this.refreshMasterChannelList(); // async function, processing continues, must load after customer data is loaded

					//this.log.warn('getPersonalizationData: all done, returnng customerStatus: %s', this.customer.customerStatus);
					resolve(this.customer); // resolve the promise with the customer object
				})
				.catch(error => {
					let errReason;
					errReason = 'Could not refresh personalization data for ' + householdId + ' - check your internet connection'
					if (error.isAxiosError) {
						errReason = error.code + ': ' + (error.hostname || '');
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
					}
					//this.log('%s %s', errText, (errReason || ''));
					this.log.debug(`getPersonalizationData error:`, error);
					reject(error);
				});
		})
	}


	// set the Personalization Data for the current device via web request PUT
	async setPersonalizationDataForDevice(deviceId, deviceSettings, callback) {
		if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: deviceSettings:', deviceSettings); }
		// https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/1012345_ch/devices/3C36E4-EOSSTB-003656123456
		//const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/personalization-service/v1/customer/' + this.session.householdId + '/devices/' + deviceId;
		const url = this.configsvc.personalizationService.URL + '/v1/customer/' + this.session.householdId + '/devices/' + deviceId;

		const data = { "settings": deviceSettings };
		// gb needs x-cus, x-oesp-token and x-oesp-username
		let config = {}
		if (this.config.country.toLowerCase() == 'gb') {
			// gb needs x-cus, x-oesp-token and x-oesp-username
			config = {
				headers: {
					"x-cus": this.session.householdId,
					"x-oesp-token": this.session.accessToken,
					"x-oesp-username": this.session.username
				}
			}
		} else {
			// other countries on new backend from Oct 2022 need just x-oesp-username
			config = {
				headers: {
					"x-oesp-username": this.session.username
				}
			}
		};
		if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: PUT %s', url); }
		axiosWS.put(url, data, config)
			.then(response => {
				// returns 204 No Content when succesfull
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


	// get the entitlements for the householdId
	// this is for the web session type as of 13.10.2022
	async getEntitlements(householdId, callback) {
		return new Promise((resolve, reject) => {
			this.log("Refreshing entitlements for householdId %s", householdId);

			//const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.householdId) + '/' + requestType;
			//const url='https://prod.spark.sunrisetv.ch/eng/web/purchase-service/v2/customers/107xxxx_ch/entitlements?enableDaypass=true'
			//const url=countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/purchase-service/v2/customers/' + householdId + '/entitlements?enableDaypass=true';
			const url = this.configsvc.purchaseService.URL + '/v2/customers/' + householdId + '/entitlements?enableDaypass=true';
			//const config = {headers: {"x-cus": this.session.householdId, "x-oesp-token": this.session.accessToken, "x-oesp-username": this.session.username}};
			let config = {}
			if (this.config.country.toLowerCase() == 'nl') {
				config = {
					headers: {
						"x-cus": householdId,
						"ACCESTOKEN": this.session.accessToken,
						"x-oesp-username": this.session.username
					}
				};

			} else {
				config = {
					headers: {
						"x-cus": householdId,
						"x-oesp-token": this.session.accessToken,
						"x-oesp-username": this.session.username
					}
				};
			}

			if (this.config.debugLevel > 0) { this.log.warn('getEntitlements: GET %s', url); }
			// this.log('getEntitlements: GET %s', url);
			axiosWS.get(url, config)
				.then(response => {
					if (this.config.debugLevel > 0) { this.log.warn('getEntitlements: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 2) {
						this.log.warn('getEntitlements: response data (saved to this.entitlements):');
						this.log.warn(response.data);
					}
					this.entitlements = response.data; // store the entire entitlements data for future use in this.customer.entitlements
					if (this.config.debugLevel > 0) {
						this.log.warn('getEntitlements: entitlements found:', this.entitlements.entitlements.length);
					}
					//his.log('getEntitlements: returning entitlements object');
					resolve(this.entitlements); // resolve the promise with the customer object
				})
				.catch(error => {
					let errReason;
					errReason = 'Could not refresh entitlements data for ' + householdId + ' - check your internet connection'
					if (error.isAxiosError) {
						errReason = error.code + ': ' + (error.hostname || '');
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
					}
					this.log.debug(`getEntitlements error:`, error);
					reject(errReason);
				});
		})
	}



	// get the recording state via web request GET
	async getRecordingState(householdId, callback) {
		return new Promise((resolve, reject) => {
			this.log("Refreshing recording state for householdId %s", householdId);

			// getRecordingState: backend will return a 402 Payment Required error if an attempt was made to get recording status when the customer is not entitled:
			// 	httpStatusCode: 402,
			// 	statusCode: 1031,
			//	message: 'Customer disabled',
			//	details: 'Customer entitlements token must contain one of the features: PVR, LOCALDVR',
			// so handle the 402 error cleanly

			// headers for the connection
			const config = {
				headers: {
					"x-cus": this.session.householdId,
					//"x-oesp-token": this.session.accessToken,  // no longer needed
					"x-oesp-username": this.session.username
				},
				validateStatus: function (status) {
					return ((status >= 200 && status < 300) || status == 402); // allow 402 'Payment Required' as OK
				}
			};

			// get all recordings. We only need to know if any are ongoing. 
			// https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings/state?channelIds=SV09039
			// https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=desc&profileId=4eb38207-d869-4367-8973-9467a42cad74&language=en
			// const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?isAdult=false&plannedOnly=false&range=1-20'; // works
			// parameter plannedOnly=false did not work
			//const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/recording-service/customers/' + householdId + '/recordings/state'; // limit to 20 recordings for performance
			const url = this.configsvc.recordingService.URL + '/customers/' + householdId + '/recordings/state'; // limit to 20 recordings for performance
			if (this.config.debugLevel > 0) { this.log.warn('getRecordingState: GET %s', url); }
			axiosWS.get(url, config)
				.then(response => {
					// log at level 1, 2
					if (this.config.debugLevel > 0) { this.log.warn('getRecordingState: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 1) {
						this.log.warn('getRecordingState: response data:');
						this.log.warn(response.data);
					}


					// only process if we have a 200 OK
					if (response.status == 200) {
						// a recording carries these properties:
						// for type='single'
						// recordingState: 'ongoing', 'recorded', 'planned' or ??, for all types
						// recordingType: 'nDVR', 'localDVR', 'LDVR', 
						// cpeId: '3C36E4-EOSSTB-003597101009', only for local DVRs

						// for type='season':
						// mostRelevantEpisode.recordingState: 'ongoing',
						// mostRelevantEpisode.recordingType: 'nDVR',
						// logging at level 2
						if (this.config.debugLevel > 1) {
							this.log.warn('getRecordingState: Recordings length %s:', response.data.data.length)
							response.data.data.forEach((recording) => {
								this.log.warn('getRecordingState: Recording channelId %s, recordingState %s, eventId: %s', recording.channelId, recording.recordingState, recording.eventId)
								//this.log.warn(recording.mostRelevantEpisode)
							});
						}
						let currRecordingState = recordingState.IDLE; // default
						let localOngoingRecordings = 0, networkOngoingRecordings = 0;

						// look for planned network single recordings: (type = "single" = one object, type = "season" = array)
						if (this.config.debugLevel > 0) { this.log.warn("getRecordingState: searching for ongoing network recordings"); }
						let recordingNetworkOngoing = [].concat(response.data.data.find(recording => recording.recordingState == 'ongoing') ?? []);
						//let recordingNetworkSeasonOngoing = [].concat(response.data.data.find(recording => recording.source == 'season' && recording.mostRelevantEpisode.recordingState == 'ongoing') ?? []);
						//networkOngoingRecordings = recordingNetworkSingleOngoing.length + recordingNetworkSeasonOngoing.length;
						networkOngoingRecordings = recordingNetworkOngoing.length;

						// find if any local device recordings are ongoing, for each device, as each device can have a HDD
						this.devices.forEach((device) => {
							if (this.config.debugLevel > 0) { this.log.warn("getRecordingState: Checking device %s for ongoing local HDD recordings", device.deviceId); }
							if (device.capabilities.hasHDD) {
								// device has HDD, look for local recordings
								// look for ongoing local single recordings: (type = "single" = one object, type = "season" = array)
								if (this.config.debugLevel > 0) { this.log.warn("getRecordingState: %s: searching for ongoing local recordings for this device", device.deviceId); }
								let recordingLocalSingleOngoing = [].concat(response.data.data.find(recording => recording.cpeId == device.deviceId && recording.source == 'single' && recording.recordingState == 'ongoing') ?? []);
								let recordingLocalSeasonOngoing = [].concat(response.data.data.find(recording => recording.cpeId == device.deviceId && recording.source == 'season' && recording.mostRelevantEpisode.recordingState == 'ongoing') ?? []);
								localOngoingRecordings = recordingLocalSingleOngoing.length + recordingLocalSeasonOngoing.length;
							}

							// log state
							if (localOngoingRecordings > 0) {
								currRecordingState = recordingState.ONGOING_LOCALDVR;
							} else if (networkOngoingRecordings > 0) {
								currRecordingState = recordingState.ONGOING_NDVR;
							}

							// update the device state. Set StatusFault to nofault as connection is working
							this.log('%s: Recording state: ongoing recordings found: local %s, network %s, current Recording State %s [%s]', device.settings.deviceFriendlyName + PLUGIN_ENV, localOngoingRecordings, networkOngoingRecordings, currRecordingState, Object.keys(recordingState)[currRecordingState]);
							//   mqttDeviceStateHandler(deviceId, 			powerState, mediaState, recordingState, 	channelId, 	eventId, 	sourceType, profileDataChanged, statusFault, 	programMode, statusActive, currInputDeviceType, currInputSourceType) {
							this.mqttDeviceStateHandler(device.deviceId, null, null, currRecordingState, null, null, null, null, Characteristic.StatusFault.NO_FAULT); // update this device						

						});
					}
					resolve(this.currentRecordingState); // resolve the promise
				})

				.catch(error => {
					let errReason;
					errReason = 'Could not get recording state for ' + householdId + ' - check your internet connection'
					if (error.isAxiosError) {
						// form nice error response for axios errors
						errReason = 'getRecordingState'
							+ ': ' + error.code
							+ ' ' + (error.hostname || '');
						+ ': ' + error.response.status + ' ' + error.response.statusText
							+ ': ' + error.config.url
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
						this.log.debug('getRecordingState error:', error);
					} else {
						// otherwise log the entire error object
						this.log.warn('getRecordingState error:');
						this.log.warn(error)
					}
					reject(errReason);
				});
		})
	}



	// get the recording bookings via web request GET
	async getRecordingBookings(householdId, callback) {
		return new Promise((resolve, reject) => {
			this.log("Refreshing recording bookings for householdId %s", householdId);

			// getRecordingState: backend will return a 402 Payment Required error if an attempt was made to get recording status when the customer is not entitled:
			// 	httpStatusCode: 402,
			// 	statusCode: 1031,
			//	message: 'Customer disabled',
			//	details: 'Customer entitlements token must contain one of the features: PVR, LOCALDVR',
			// so handle the 402 error cleanly

			// headers for the connection
			const config = {
				headers: {
					"x-cus": householdId,
					//"x-oesp-token": this.session.accessToken,  // no longer needed
					"x-oesp-username": this.session.username
				},
				validateStatus: function (status) {
					return ((status >= 200 && status < 300) || status == 402); // allow 402 'Payment Required' as OK
				}
			};

			// get all planned recordings. We only need to know if any results exist. 
			// 0 results = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED
			// >0 results = Characteristic.ProgramMode.PROGRAM_SCHEDULED
			// https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings/state?channelIds=SV09039
			// https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=desc&profileId=4eb38207-d869-4367-8973-9467a42cad74&language=en
			// parameter plannedOnly=false did not work

			// get all booked series recordings: these are planned future recordings
			// I need a test user to get me the html endpoints for local HDD recording state
			// https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/bookings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=asc&language=en
			//const url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/recording-service/customers/' + householdId + '/bookings?limit=10&sort=time&sortOrder=asc'; // limit to 10 recordings for performance
			const url = this.configsvc.recordingService.URL + '/customers/' + householdId + '/bookings?limit=10&sort=time&sortOrder=asc'; // limit to 10 recordings for performance
			if (this.config.debugLevel > 0) { this.log.warn('getRecordingBookings: GET %s', url); }
			axiosWS.get(url, config)
				.then(response => {
					// log at level 1, 2
					if (this.config.debugLevel > 0) { this.log.warn('getRecordingBookings: response: %s %s', response.status, response.statusText); }
					if (this.config.debugLevel > 1) {
						this.log.warn('getRecordingBookings: response data:');
						this.log.warn(response.data);
					}

					// only process if we have a 200 OK
					if (response.status == 200) {
						// a recording carries these properties:
						// for type='single'
						// recordingState: 'ongoing', 'recorded', 'planned' or ??, for all types
						// recordingType: 'nDVR', 'localDVR', 'LDVR', 
						// cpeId: '3C36E4-EOSSTB-003597101009', only for local DVRs

						// for type='season':
						// mostRelevantEpisode.recordingState: 'ongoing',
						// mostRelevantEpisode.recordingType: 'nDVR',
						// logging at level 2
						if (this.config.debugLevel > 1) {
							this.log.warn('getRecordingBookings: Recordings length %s:', response.data.data.length)
							response.data.data.forEach((recording) => {
								this.log.warn('getRecordingBookings: Recording title "%s", type %s, recordingState %s, recordingType %s, mostRelevantEpisode:', recording.title, recording.type, recording.recordingState, recording.recordingType)
								this.log.warn(recording.mostRelevantEpisode)
							});
						}
						let currProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED; // default
						let localPlannedRecordings = 0, networkPlannedRecordings = 0;

						// look for planned network recordings: (type = "single" = one object, type = "season" = array)
						if (this.config.debugLevel > 0) { this.log.warn("getRecordingBookings: searching for planned network recordings"); }
						let recordingNetworkSinglePlanned = [].concat(response.data.data.find(recording => recording.type == 'single' && recording.recordingState == 'planned') ?? []);
						let recordingNetworkSeasonPlanned = [].concat(response.data.data.find(recording => recording.type == 'season' && recording.mostRelevantEpisode.recordingState == 'planned') ?? []);
						networkPlannedRecordings = recordingNetworkSinglePlanned.length + recordingNetworkSeasonPlanned.length;


						// find if any local recordings are booked, for each device, as each device can have a HDD
						this.devices.forEach((device) => {
							if (this.config.debugLevel > 0) { this.log.warn("getRecordingBookings: Checking device %s for planned local HDD recordings", device.deviceId); }
							if (device.capabilities.hasHDD) {
								// device has HDD, look for local recordings
								// look for planned local single recordings: (type = "single")
								if (this.config.debugLevel > 0) { this.log.warn("getRecordingBookings: %s: searching for planned local recordings for this device", device.deviceId); }
								let recordingLocalSinglePlanned = [].concat(response.data.data.find(recording => recording.cpeId == device.deviceId && recording.type == 'single' && recording.recordingState == 'planned') ?? []);
								let recordingLocalSeasonPlanned = [].concat(response.data.data.find(recording => recording.cpeId == device.deviceId && recording.type == 'season' && recording.mostRelevantEpisode.recordingState == 'planned') ?? []);
								localPlannedRecordings = recordingLocalSinglePlanned.length + recordingLocalSeasonPlanned.length;
							}

							// log state
							if (localPlannedRecordings + networkPlannedRecordings > 0) {
								currProgramMode = Characteristic.ProgramMode.PROGRAM_SCHEDULED;
							}


							// update the device state. Set StatusFault to nofault as connection is working
							this.log('%s: Recording bookings: planned recordings found: local %s, network %s, current Program Mode %s [%s]', device.settings.deviceFriendlyName + PLUGIN_ENV, localPlannedRecordings, networkPlannedRecordings,
								currProgramMode, Object.keys(Characteristic.ProgramMode)[currProgramMode + 1]);
							//   mqttDeviceStateHandler(deviceId, 			powerState, mediaState, recordingState, 	channelId, 	eventId, 	sourceType, profileDataChanged, statusFault, 							programMode, statusActive, currInputDeviceType, currInputSourceType) {
							this.mqttDeviceStateHandler(device.deviceId, null, null, null, null, null, null, null, Characteristic.StatusFault.NO_FAULT, currProgramMode); // update this device						

						});
					}
					resolve(this.currentRecordingState); // resolve the promise
				})

				.catch(error => {
					let errReason;
					errReason = 'Could not get recording bookings for ' + householdId + ' - check your internet connection'
					if (error.isAxiosError) {
						// form nice error response for axios errors
						errReason = 'getRecordingBookings'
							+ ': ' + error.code
							+ ' ' + (error.hostname || '');
						+ ': ' + error.response.status + ' ' + error.response.statusText
							+ ': ' + error.config.url
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
						this.log.debug('getRecordingBookings error:', error);
					} else {
						// otherwise log the entire error object
						this.log.warn('getRecordingBookings error:');
						this.log.warn(error)
					}
					reject(errReason);
				});
		})
	}



	// get getExperimentalEndpoint for the householdId
	async getExperimentalEndpoint(householdId, callback) {
		//return new Promise((resolve, reject) => {
		this.log("getExperimentalEndpoint: householdId %s", householdId);

		//const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.householdId) + '/' + requestType;
		//const url='https://prod.spark.sunrisetv.ch/eng/web/purchase-service/v2/customers/107xxxx_ch/entitlements?enableDaypass=true'
		// 'https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web'
		let url
		//url=countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/purchase-service/v2/customers/' + householdId + '/entitlements?enableDaypass=true';
		//url='https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web/eng/session'
		//url='https://prod.spark.upctv.ch/ch/en/session-service'
		url = this.configsvc.sessionService.URL;
		const config = {
			headers: {
				"x-cus": householdId,
				"x-oesp-token": this.session.accessToken,
				"x-oesp-username": this.session.username
			}
		};
		this.log.warn('getExperimentalEndpoint: GET %s', url);
		// this.log('getEntitlements: GET %s', url);
		axiosWS.get(url, config)
			.then(response => {
				this.log.warn('getExperimentalEndpoint: response: %s %s', response.status, response.statusText);
				this.log.warn(response.data);
				return true
				//resolve(true); // resolve the promise with the customer object
			})
			.catch(error => {
				let errReason;
				errReason = 'Could not get experimental data for ' + householdId + ' - check your internet connection'
				if (error.isAxiosError) {
					errReason = error.code + ': ' + (error.hostname || '');
					// if no connection then set session to disconnected to force a session reconnect
					if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
				}
				this.log.warn(`getExperimentalEndpoint error:`, error);
				//reject(errReason);
				return false;
			});
		//})
	}

	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler (web)
	//+++++++++++++++++++++++++++++++++++++++++++++++++++++








	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler mqtt
	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// get the mqtt token
	async getMqttToken(oespUsername, accessToken, householdId) {
		return new Promise((resolve, reject) => {
			this.log.debug("Getting mqtt token for householdId %s", householdId);
			// get a JSON web token from the supplied accessToken and householdId
			if (this.config.debugLevel > 1) { this.log.warn('getMqttToken'); }
			// robustness checks
			if (currentSessionState !== sessionState.CONNECTED) {
				this.log.warn('Cannot get mqtt token: currentSessionState incorrect:', currentSessionState);
				return false;
			}
			if (!accessToken) {
				this.log.warn('Cannot get mqtt token: accessToken not set');
				return false;
			}

			//this.log.warn('getMqttToken disabled while I build channel list');
			//return false;

			const mqttAxiosConfig = {
				method: 'GET',
				// examples of auth-service/v1/mqtt/token urls:
				// https://prod.spark.ziggogo.tv/auth-service/v1/mqtt/token
				// https://prod.spark.sunrisetv.ch/auth-service/v1/mqtt/token
				//url: countryBaseUrlArray[this.config.country.toLowerCase()] + '/auth-service/v1/mqtt/token', // new from October 2022
				url: this.configsvc.authorizationService.URL + '/v1/mqtt/token',
				headers: {
					'X-OESP-Token': accessToken,
					'X-OESP-Username': oespUsername,
				}
			};
			this.log.debug("getMqttToken: mqttAxiosConfig:", mqttAxiosConfig)
			axiosWS(mqttAxiosConfig)
				.then(response => {
					if (this.config.debugLevel > 0) {
						this.log.warn("getMqttToken: response.data:", response.data)
					}
					mqttUsername = householdId; // used in sendKey to ensure that mqtt is connected
					resolve(response.data.token); // resolve with the token
				})
				.catch(error => {
					this.log.debug('getMqttToken error details:', error);
					// set session flag to disconnected to force a session reconnect
					currentSessionState = sessionState.DISCONNECTED;
					reject('Failed to get mqtt token: ', error.code + ' ' + (error.hostname || ''));
				});
		})
	}


	// start the mqtt client and handle mqtt messages
	// a sync procedure, no promise returned
	// https://github.com/mqttjs/MQTT.js#readme
	// http://www.steves-internet-guide.com/mqtt-publish-subscribe/
	statMqttClient(parent, mqttUsername, mqttPassword) {
		return new Promise((resolve, reject) => {
			try {
				if (this.config.debugLevel > 0) {
					this.log('Starting mqttClient...');
				}
				if (currentSessionState !== sessionState.CONNECTED) {
					this.log.warn('Cannot start mqttClient: currentSessionState incorrect:', currentSessionState);
					return false;
				}


				// create mqtt client instance and connect to the mqttUrl
				//const mqttBroker = mqttUrlArray[this.config.country.toLowerCase()];
				const mqttBrokerUrl = this.configsvc.mqttBroker.URL;
				if (this.config.debugLevel > 0) {
					this.log.warn('statMqttClient: mqttBrokerUrl:', mqttBrokerUrl);
				}
				if (this.config.debugLevel > 0) {
					this.log.warn('statMqttClient: Creating mqttClient with username %s, password %s', mqttUsername, mqttPassword);
				}

				// make a new mqttClientId on every session start (much robuster), then connect
				//mqttClientId = makeId(32);
				mqttClientId = makeFormattedId(32);

				// from 24 Jan 2024 we need to set the sub protocols mqtt, mqttv3.1, mqttv3.11 to connect
				// the required header looks like this:
				// "sec-websocket-protocol": "mqtt, mqttv3.1, mqttv3.11",
				// make a new custom websocket so we can ensure the correct mqtt protocols are used in the headers
				// see https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
				const createCustomWebsocket = (url, websocketSubProtocols, options) => {
					//this.log.warn('statMqttClient: createCustomWebsocket: ', websocketSubProtocols[0] ); 
					const subProtocols = [
						'mqtt',
						'mqttv3.1',
						'mqttv3.11'
					];
					//this.log.warn('statMqttClient: createCustomWebsocket: about to return' ); 
					return new WebSocket(url, subProtocols);
				};

				// https://github.com/mqttjs/MQTT.js#connect
				mqttClient = mqtt.connect(mqttBrokerUrl, {
					createWebsocket: createCustomWebsocket,
					clientId: mqttClientId,
					connectTimeout: 10 * 1000, // 10s
					username: mqttUsername,
					password: mqttPassword
				});
				if (this.config.debugLevel > 0) {
					this.log.warn('statMqttClient: mqttBroker connect request sent using mqttClientId %s', mqttClientId);
				}

				//mqttClient.setMaxListeners(20); // default is 10 sometimes causes issues when the listeners reach 11
				//parent.log(mqttClient); //for debug


				// mqtt client event: connect
				// https://github.com/mqttjs/MQTT.js#event-connect
				mqttClient.on('connect', function () {
					try {
						parent.log("mqttClient: %s", mqttClient.connected ? 'Connected' : 'Disconnected'); // Conditional (ternary) operator: condition ? trueValue : FalseValue
						parent.mqttClientConnecting = false;

						// https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/107xxxx_ch/profiles
						parent.mqttSubscribeToTopic(mqttUsername + '/personalizationService');

						// subscribe to recording status, used to update the accessory charateristics
						parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus');
						parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus/lastUserAction');

						// purchaseService and watchlistService are not needed, but add if desired if we want to monitor these services
						parent.mqttSubscribeToTopic(mqttUsername + '/purchaseService');
						parent.mqttSubscribeToTopic(mqttUsername + '/watchlistService');
						//parent.mqttSubscribeToTopic(mqttUsername + '/#'); // everything! multilevel wildcard

						// bookmarkService is not needed
						//parent.mqttSubscribeToTopic(mqttUsername + '/bookmarkService');

						// this is needed to trigger the backend to send us channel change messages when the channel is changed on the box
						parent.setHgoOnlineRunning(mqttUsername, mqttClientId);
						parent.mqttSubscribeToTopic(mqttUsername + '/' + mqttClientId); // subscribe to mqttClientId to get channel data

						// subscribe to all householdId messages
						parent.mqttSubscribeToTopic(mqttUsername); // subscribe to householdId
						parent.mqttSubscribeToTopic(mqttUsername + '/status'); // experiment, may not be needed
						//parent.mqttSubscribeToTopic(mqttUsername + '/+/status'); // subscribe to householdId/+/status = wildcard, and status for any topis, dont subscribe to this, its all clientIds, floods with messages

						// experimental support of recording status
						// + is a wildcard, and will subscribe to localRecordings from any topic
						// + Symbol represents a single-level wildcard in a MQTT topic and # symbol represents the multi-level wild card in a MQTT Topic.
						// refer https://www.hivemq.com/blog/mqtt-essentials-part-5-mqtt-topics-best-practices/
						parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings');
						parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings/capacity');

						// subscribe to all devices after the setHgoOnlineRunning is sent
						parent.devices.forEach((device) => {
							// subscribe to our householdId/deviceId
							parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId);
							// subscribe to our householdId/deviceId/status
							parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/status');
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/#'); // wildcard # = any topic for the box, but does not reveal any more than what we know
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/audioStatus'); // a guess
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/radioStatus'); // a guess
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/source'); // a guess
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/radio'); // a guess
							//parent.mqttSubscribeToTopic(mqttUsername + '/' + device.deviceId + '/audio'); // a guess
						});

						// initiate the EOS session by turning on the HGO platform
						// and request the initial UI status for each device
						// hmm do we really need this now that HGO has been deprecated as web client?
						parent.devices.forEach((device) => {
							// send a getuiStatus request
							parent.getUiStatus(device.deviceId, mqttClientId);
						});

						// ++++++++++++++++++++ mqttConnected +++++++++++++++++++++


						// mqtt client event: message received
						// https://github.com/mqttjs/MQTT.js#event-message
						mqttClient.on('message', function (topic, message) {
							try {

								// store some mqtt diagnostic data
								parent.lastMqttMessageReceived = Date.now();

								let mqttMessage = JSON.parse(message);
								if (parent.config.debugLevel > 0) {
									parent.log.warn('mqttClient: Received Message: \r\nTopic: %s\r\nMessage: (next log entry)', topic,);
									parent.log.warn(mqttMessage);
								}

								// variables for just in this function
								var deviceId, stbState, currPowerState, currMediaState, currChannelId, currEventId, currSourceType, profileDataChanged, currRecordingState, currStatusActive, currInputDeviceType, currInputSourceType;

								// handle personalizationService messages
								// Topic: Topic: 107xxxx_ch/personalizationService
								// Message: { action: 'OPS.getProfilesUpdate', source: '3C36E4-EOSSTB-00365657xxxx', ... }
								// Message: { action: 'OPS.getDeviceUpdate', source: '3C36E4-EOSSTB-00365657xxxx', deviceId: '3C36E4-EOSSTB-00365657xxxx' }
								if (topic.includes(mqttUsername + '/personalizationService')) {
									if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: %s: action', mqttMessage.action); }
									if (mqttMessage.action == 'OPS.getProfilesUpdate' || mqttMessage.action == 'OPS.getDeviceUpdate') {
										if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: %s, calling getPersonalizationData', mqttMessage.action); }
										deviceId = mqttMessage.source;
										profileDataChanged = true;
										parent.getPersonalizationData(parent.session.householdId); // async function
									}
								}

								// handle recordingState messages
								// Topic: Topic: 107xxxx_ch/recordingStatus
								// Message: {"id":"crid:~~2F~~2Fgn.tv~~2F2004781~~2FEP019440730003,imi:2d369682b865679f2e5182ea52a93410171cfdc8","event":"scheduleEvent","transactionId":"/CH/eng/web/networkdvrrecordings - 013f12fc-23ef-4b77-a244-eeeea0c6901c"}
								if (topic.includes(mqttUsername + '/recordingStatus')) {
									if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: event: %s', mqttMessage.event); }
									parent.refreshRecordings(parent.session.householdId); // request a refresh of recording data
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
										// "Fast start":  when turned off, goes to ONLINE_STANDBY and stays there. Box can be turned on via mqtt
										// "Active start": when turned off, stays at ONLINE_STANDBY for 5min, then goes to OFFLINE_NETWORK_STANDBY. box can be turned on via ??
										// "Eco (slow start)": when turned off, stays at ONLINE_STANDBY for 5min, then goes to OFFLINE. Box cannot be turned on by mqtt. Physical remote turns on via IR
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
											case 'OFFLINE_NETWORK_STANDBY': // OFFLINE_NETWORK_STANDBY: power is off, device is still reachable on the network but cannot be turned on by mqtt
												currStatusActive = Characteristic.Active.INACTIVE; // bool, 0 = not active, 1 = active
												currPowerState = Characteristic.Active.INACTIVE;
												currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
												break;
											case 'OFFLINE':			// OFFLINE: power is off, device is not reachable over the network, cannot be turned on by mqtt
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
											// nDVR = playback from saved program (network Digital Video Recorder)
											// lDVR = playback from saved program (local Digital Video Recorder)
											// '' (empty string) = when radio is playing
											switch (playerState.sourceType) {
												case 'linear':	// linear: normal tv
												case 'reviewbuffer': 	// delayed playback
													currInputDeviceType = Characteristic.InputDeviceType.TV; // linear TV
													currInputSourceType = Characteristic.InputSourceType.TUNER;
													break;
												case 'replay': 	// replay TV
												case 'nDVR':	// network DVR
												case 'localDVR':	// local DVR
												case 'lDVR':	// local DVR
												case 'LDVR':	// local DVR
													currInputDeviceType = Characteristic.InputDeviceType.PLAYBACK; // replay TV
													currInputSourceType = Characteristic.InputSourceType.OTHER;
													break;
												case '':		// '' (empty string), happens when radio is playing
													currInputDeviceType = Characteristic.InputDeviceType.TUNER; // use tuner for radio
													currInputSourceType = Characteristic.InputSourceType.OTHER;
													break;
											}


											// get channelId (current playing channel eg SV09038) from linear TV
											// Careful: source is not always present in the data
											if (playerState.source) {
												currChannelId = playerState.source.channelId || NO_CHANNEL_ID; // must be a string
												currEventId = playerState.source.eventId; // the title (program) id
												if (parent.config.debugLevel > 0 && parent.masterChannelList) {
													let currentChannelName; // let is scoped to the current {} block
													let curChannel = parent.masterChannelList.find(channel => channel.id === currChannelId);
													if (curChannel) { currentChannelName = curChannel.name; }
													parent.log.warn('mqttClient: Detected mqtt channelId: %s [%s]', currChannelId, currentChannelName);
												}
											} else {
												// if playerState.source is null, then the settop box could be playing a radio station
												// the code will pass a null through the code but no change will occur, so deliberately set a NO_CHANNEL_ID
												// when playing radio playerState.sourceType='' and playerState.source is null, and a relativePosition=0 appears, this could be maybe used for Radio detection
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
													// ignore the following apps to ensure channel name is not overridden:
													// com.bbc.app.launcher 	button launcher app??
													// com.bbc.app.crb 			Connected Red Button app, this is the Red Button special control on the remote
													currChannelId = null;
													parent.log("App %s [%s] detected. Ignoring", cpeUiStatus.appsState.id, cpeUiStatus.appsState.appName);
													break;

												default:
													// check if the app channel exists in the master channel list, if not, push it, using the user-defined name if one exists
													currChannelId = cpeUiStatus.appsState.id;
													var foundIndex = parent.masterChannelList.findIndex(channel => channel.id === currChannelId);
													if (foundIndex == -1) {
														parent.log("App %s detected. Adding to the master channel list at index %s with channelId %s", cpeUiStatus.appsState.appName, parent.masterChannelList.length, currChannelId);
														const entitlementId = parent.entitlements.entitlements[0].id;
														// for easy identification, make the logicalChannelNumber and channelNumber app10000 + the index number
														parent.masterChannelList.push({
															id: currChannelId,
															name: cleanNameForHomeKit(cpeUiStatus.appsState.appName),
															logicalChannelNumber: 10000 + parent.masterChannelList.length, // integer
															linearProducts: entitlementId // must be a valid entitlement id 
															//channelNumber: 'app' + (10000 + parent.masterChannelList.length)
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
								// there's also a pullFromTV
								// {"source":"7028f103-8494-4f79-9b76-beb67a2e5caa","type":"CPE.pullFromTV","runtimeType":"pull"}
								if (mqttMessage.type == 'CPE.pushToTV.rsp') {
									if (parent.config.debugLevel > 0) {
										parent.log.warn('mqttClient: CPE.pushToTV.rsp: Detecting currentChannelId: Received Message of type %s for %s', mqttMessage.type, mqttMessage.source);
									}
									if (parent.config.debugLevel > 0) {
										parent.log.warn('mqttClient: mqttMessage.status', mqttMessage.status);
									}
								}


								// update the device on every message
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventid, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.mqttDeviceStateHandler(deviceId, currPowerState, currMediaState, currRecordingState, currChannelId, currEventId, currSourceType, profileDataChanged, Characteristic.StatusFault.NO_FAULT, null, currStatusActive, currInputDeviceType, currInputSourceType);

								//end of try
							} catch (err) {
								// catch all mqtt errors
								parent.log.error("Error trapped in mqttClient message event:", err.message);
								parent.log.error(err);
							}

						}); // end of mqtt client event: message received



						// mqtt client event: close
						// Emitted after a disconnection.
						// https://github.com/mqttjs/MQTT.js#event-close
						mqttClient.on('close', function () {
							try {
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.log('mqttClient: Connection closed');
								currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
								if (!isShuttingDown) {
									parent.mqttDeviceStateHandler(null, null, null, null, null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
								}
							} catch (err) {
								parent.log.error("Error trapped in mqttClient close event:", err.message);
								parent.log.error(err);
							}
						});

						// mqtt client event: reconnect
						// Emitted when a reconnect starts.
						// https://github.com/mqttjs/MQTT.js#event-reconnect
						mqttClient.on('reconnect', function () {
							try {
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.log('mqttClient: Reconnect started');
								parent.mqttDeviceStateHandler(null, null, null, null, null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
							} catch (err) {
								parent.log.error("Error trapped in mqttClient reconnect event:", err.message);
								parent.log.error(err);
							}
						});

						// mqtt client event: disconnect 
						// Emitted after receiving disconnect packet from broker. MQTT 5.0 feature.
						// https://github.com/mqttjs/MQTT.js#event-disconnect
						mqttClient.on('disconnect', function () {
							try {
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.log('mqttClient: Disconnect command received');
								currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
								parent.mqttDeviceStateHandler(null, null, null, null, null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
							} catch (err) {
								parent.log.error("Error trapped in mqttClient disconnect event:", err.message);
								parent.log.error(err);
							}
						});

						// mqtt client event: offline
						// Emitted when the client goes offline.
						// https://github.com/mqttjs/MQTT.js#event-disconnect
						mqttClient.on('offline', function () {
							try {
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.log('mqttClient: Client is offline');
								currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
								parent.mqttDeviceStateHandler(null, null, null, null, null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
							} catch (err) {
								parent.log.error("Error trapped in mqttClient offline event:", err.message);
								parent.log.error(err);
							}
						});

						// mqtt client event: error
						// Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs.
						// https://github.com/mqttjs/MQTT.js#event-error
						mqttClient.on('error', function (err) {
							try {
								// mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType)
								parent.log.warn('mqttClient: Error', (err.syscall || '') + ' ' + (err.code || '') + ' ' + (err.hostname || ''));
								parent.log.debug('mqttClient: Error object:', err);
								currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
								parent.mqttDeviceStateHandler(null, null, null, null, null, null, null, null, Characteristic.StatusFault.GENERAL_FAULT); // set statusFault to GENERAL_FAULT
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


				if (this.config.debugLevel > 0) {
					this.log.warn("statMqttClient: end of code block");
				}
				resolve(mqttClient.connected); // return the promise with the connected state

			} catch (err) {
				this.log.error(err);
				reject('Cannot connect to mqtt broker', err); // reject the promise
			}

		})
	} // end of statMqttClient


	// end the mqtt session cleanly
	endMqttSession() {
		return new Promise((resolve, reject) => {
			if (this.config.debugLevel > -1) {
				this.log('Shutting down mqttClient...');
			}
			// https://github.com/mqttjs/MQTT.js#end
			// mqtt.Client#end([force], [options], [callback])
			if (mqttClient.connected) { mqttClient.end() };
			resolve(true);
		})
	}


	// handle the state change of the device, calling the updateDeviceState of the relevant device
	// handles multiple devices by deviceId, should the user have more than one device
	mqttDeviceStateHandler(deviceId, powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType) {
		try {
			if (this.config.debugLevel > 1) {
				this.log.warn('mqttDeviceStateHandler: calling updateDeviceState with deviceId %s, powerState %s, mediaState %s, channelId %s, eventId %s, sourceType %s, profileDataChanged %s, statusFault %s, programMode %s, statusActive %s, currInputDeviceType %s, currInputSourceType %s', deviceId, powerState, mediaState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType);
			}
			const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
			// robustness: update the device only if it has been loaded and found in this.stbDevices
			if (deviceIndex > -1 && this.stbDevices.length > 0) {
				//this.log.warn('mqttDeviceStateHandler: stbDevices found, calling updateDeviceState');
				this.stbDevices[deviceIndex].updateDeviceState(powerState, mediaState, recordingState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, currInputDeviceType, currInputSourceType);
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

	// subscribe to an mqtt topic, with logging, to help in debugging
	mqttSubscribeToTopic(Topic) {
		if (this.config.debugLevel > 0) { this.log.warn('mqttSubscribeToTopic: Subscribe to topic:', Topic); }
		mqttClient.subscribe(Topic, function (err) {
			if (err) {
				//this.log('mqttClient connect: subscribe to %s Error %s:', Topic, err);
				return true;
			}
		});
	}

	// unsubscribe to an mqtt topic, with logging, to help in debugging
	mqttUnsubscribeToTopic(Topic) {
		if (this.config.debugLevel > 0) { this.log.warn('mqttUnsubscribeToTopic: Unsubscribe to topic:', Topic); }
		mqttClient.unsubscribe(Topic, function (err) {
			if (err) {
				//this.log('mqttClient connect: unsubscribe to %s Error %s:', Topic, err);
				return true;
			}
		});
	}

	// start the HGO session (switch on)
	setHgoOnlineRunning(mqttUsername, mqttClientId) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('setHgoOnlineRunning'); }
			if (mqttUsername) {
				this.mqttPublishMessage(
					// the web client uses qos:2, so we should as well
					// {"source":"fd29b575-5f2b-49a0-8efe-62a844ac2b40","state":"ONLINE_RUNNING","deviceType":"HGO","mac":"","ipAddress":""}
					mqttUsername + '/' + mqttClientId + '/status',  // Topic, 
					'{"source":"' + mqttClientId + '","state":"ONLINE_RUNNING","deviceType":"HGO","mac":"","ipAddress":""}', // Message, Options
					{ qos: 2, retain: true } //Options (json object)
				);
			}
		} catch (err) {
			this.log.error("Error trapped in setHgoOnlineRunning:", err.message);
			this.log.error(err);
		}
	}

	// send a channel change request to the settopbox via mqtt
	// using the CPE.pushToTV message
	// the friendlyDeviceName appears on the TV in a popup window
	switchChannel(deviceId, deviceName, channelId, channelName) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('switchChannel: channelId %s %s on %s %s', channelId, channelName, deviceId, deviceName); }
			this.log('Change channel to %s [%s] on %s %s', channelId, channelName, deviceName, deviceId);
			if (mqttUsername) {
				this.mqttPublishMessage(
					// the web client uses qos:2, so we should as well
					mqttUsername + '/' + deviceId,
					// cannot get radio to work, sourceType is unclear
					// [09/11/2022, 12:55:00] [EOSSTB] Processing channel: 518 1001 SV01301 Radio SRF 1
					// [09/11/2022, 12:55:00] [EOSSTB] Processing channel: 519 1002 SV01327 Radio SRF 1 ZH
					// [09 /11/2022, 12:55:00] [EOSSTB] Processing channel: 520 1003 SV01322 Radio SRF 1 BE
					// [09/11/2022, 12:55:00] [EOSSTB] Processing channel: 521 1004 SV01323 Radio SRF 1 BS
					'{"id":"' + makeFormattedId(32) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId
					+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"'
					+ channelId + '"},"relativePosition":0,"speed":1}}',
					//+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"ott","source":{"channelId":"' 
					//+ 'SV01301' + '"},"relativePosition":0,"speed":1}}',
					{ qos: 2, retain: true }
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
					// the web client uses qos:2, so we should as well
					mqttUsername + '/' + deviceId,
					'{"id":"' + makeFormattedId(32) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId
					+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"'
					+ channelId + '"},"relativePosition":0,"speed":' + speed + '}}',
					{ qos: 2, retain: true }
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
					// the web client uses qos:2, so we should as well
					mqttUsername + '/' + deviceId,
					'{"id":"' + makeFormattedId(32) + '","type":"CPE.setPlayerPosition","source":{"clientId":"' + mqttClientId
					+ '","status":{"relativePosition":' + relativePosition + '}}"',
					{ qos: 2, retain: true }
				);
			}
		} catch (err) {
			this.log.error("Error trapped in setPlayerPosition:", err.message);
			this.log.error(err);
		}
	}

	// send a remote control keySequence to the settopbox via mqtt
	async sendKey(deviceId, deviceName, keySequence) {
		try {
			if (this.config.debugLevel > 0) { this.log.warn('sendKey: keySequence %s, deviceName %s, deviceId %s', keySequence, deviceName, deviceId); }
			if (mqttUsername) {
				let hasJustBooted = false; // indicates if the box just booted up during this keyMacro
				let keyCanBeSkippedAfterBootup = false; // indicates if the current key can be skipped
				let firstNonSkippableKeyFound = false; // indicates if a non-skippable key was found
				let defaultWaitDelayActive = false;	// indicates if the default wait delay is being used

				let keyArray = keySequence.trim().split(' ');
				if (keyArray.length > 1) { this.log('sendKey: processing keySequence for %s: "%s"', deviceName, keySequence); }
				// supported key1 key2 key3 wait() wait(100)
				for (let i = 0; i < keyArray.length; i++) {
					const keyName = keyArray[i].trim();
					this.log('sendKey: processing key %s of %s: %s', i + 1, keyArray.length, keyName);
					const defaultWaitDelay = 200; // default 200ms
					const maxWaitDelay = 20000; // default 200ms
					const waitReadyDelayStep = 500; // the ms wait time in each waitReady loop
					const maxWaitReadyLoops = maxWaitDelay / waitReadyDelayStep; // the max loop iterations to wait for ready
					const currKeyIsEscapeOrTvOrWait =
						keyName.toLowerCase().startsWith('wait(') 		// current key is a wait
						|| keyName.toLowerCase() == 'escape'			// or current key is an Escape
						|| keyName.toLowerCase() == 'tv';				// or current key is TV
					if (!firstNonSkippableKeyFound && !currKeyIsEscapeOrTvOrWait) {
						firstNonSkippableKeyFound = true;				// first non-escape or non-wait key found
					}
					keyCanBeSkippedAfterBootup = false; 				// reset for each key
					defaultWaitDelayActive = false;						// reset for each key


					// for all keys except Power:
					// check if box is ready (up and running), if not, loop until we hit maxWaitDelay, waiting waitReadyDelayStep ms each loop
					// loop only while i < maxWaitReadyLoops and current media state = STOP
					// The device changes CurrentMediaState from STOP to PLAY when it has powered up and is streaming TV
					// CurrentMediaState=STOP only occurs when the set-top box is turned off, so is a good indicator that it is streaming content
					// TEST THIS WITH NETFLIX!
					const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
					if (keyName.toLowerCase() != 'power') {
						// detect CurrentMediaState=STOP to show box has just booted
						if (this.stbDevices[deviceIndex].currentMediaState == Characteristic.CurrentMediaState.STOP) {
							this.log('sendKey: key %s: waiting for ready for %s', i + 1, deviceName);
							for (let j = 0;
								j < maxWaitReadyLoops
								&& this.stbDevices[deviceIndex].currentMediaState == Characteristic.CurrentMediaState.STOP;
								j++) {
								hasJustBooted = true; 				// indicates that the box just booted up during this keyMacro
								await waitprom(waitReadyDelayStep); // wait waitReadyDelayStep ms on each loop
								this.log.debug('sendKey: key %s: loop %s: wait %s ms done, hasJustBooted %s, currentMediaState %s', i + 1, j, hasJustBooted, waitReadyDelayStep, currentMediaStateName(this.stbDevices[deviceIndex].currentMediaState));
							}
							this.log.debug('sendKey: key %s: waiting one more delay of %s ms', i + 1, waitReadyDelayStep);
							await waitprom(waitReadyDelayStep); // wait waitReadyDelayStep ms one last time to ensure we have one wait after change from STOP to PLAY
							this.log('sendKey: key %s: waiting for ready done, hasJustBooted %s, currentMediaState %s', i + 1, hasJustBooted, currentMediaStateName(this.stbDevices[deviceIndex].currentMediaState));
						}
					}


					// check if current key can be skipped.
					// leading Escape and wait keys can be skipped after a bootup to speed up the selection of a radio channel using a scene
					// any skipping must stop when the first non-Escape and non-wait key is found
					this.log.debug('sendKey: key %s: keyArray.length %s, prevKey %s, currKey %s, nextKey %s', i + 1, keyArray.length, keyArray[i - 1], keyArray[i], keyArray[i + 1])
					if (hasJustBooted 						// box has just booted
						&& currKeyIsEscapeOrTvOrWait		// current key is escape or tv or wait
						&& !firstNonSkippableKeyFound		// have not yet found the first non-skippable key
					) {
						keyCanBeSkippedAfterBootup = true; 		// we can skip this key as it is a wait or escape 
					}


					// to help with debug
					this.log.debug('sendKey: key %s: hasJustBooted %s, currKeyIsEscapeOrTvOrWait %s, firstNonSkippableKeyFound %s, keyCanBeSkippedAfterBootup %s', i + 1, hasJustBooted, currKeyIsEscapeOrTvOrWait, firstNonSkippableKeyFound, keyCanBeSkippedAfterBootup);


					// process any wait command if found
					// but ignore if keyCanBeSkippedAfterBootup
					let waitDelay;
					if (keyName.toLowerCase().startsWith('wait(') && !keyCanBeSkippedAfterBootup) {
						this.log.debug('sendKey: key %s: reading delay from %s', i + 1, keyName);
						// accepts wait(), wait(n)
						waitDelay = keyName.toLowerCase().replace('wait(', '').replace(')', '');
						if (waitDelay == '') { waitDelay = defaultWaitDelay; } // default wait
						if (waitDelay > maxWaitDelay) { waitDelay = maxWaitDelay; } // max wait
						this.log.debug('sendKey: key %s: delay read as %s', i + 1, waitDelay);
					}
					// else if not key can be skipped, and not first key and previous key was not wait, and current key is not wait, then set a default delay of defaultWaitDelay ms
					else if (!keyCanBeSkippedAfterBootup
						&& i > 0
						//&& i<keyArray.length-1 
						&& !(keyArray[i - 1] || '').toLowerCase().startsWith('wait(') && !(keyArray[i] || '').toLowerCase().startsWith('wait(')
					) {
						this.log.debug('sendKey: key %s: not keyCanBeSkippedAfterBootup and not first key and neither previous key %s nor current key %s is wait(). Setting default wait of %s ms', i + 1, keyArray[i - 1], keyArray[i], defaultWaitDelay);
						defaultWaitDelayActive = true;
						waitDelay = defaultWaitDelay;
					}


					// add a wait if a waitDelay is set
					//this.log('sendKey: key %s: waitDelay', i+1, waitDelay);
					if (waitDelay) {
						if (!defaultWaitDelayActive) { this.log('sendKey: key %s: waiting %s ms', i + 1, waitDelay); } // reduce logging in minimum mode if default wait
						await waitprom(waitDelay);
						this.log.debug('sendKey: key %s: wait done', i + 1);
					}


					// send the key
					if (hasJustBooted && keyCanBeSkippedAfterBootup) {
						// when a box has just booted, leading Escapes and waits can be skipped until the first non-Escape and non-wait comand
						this.log('sendKey: key %s: box has just booted, skipping key %s', i + 1, keyName);
					} else if (!keyName.toLowerCase().startsWith('wait(')) {
						// send the key if not a wait
						this.log('sendKey: key %s: sending key %s to %s %s', i + 1, keyName, deviceName, deviceId);
						// the web client uses qos:2, so we should as well
						// 1076582_ch/3C36E4-EOSSTB-003656579806..
						//{"source":"6a93bac6-5402-42a7-9d8a-c7a93e00e68e","id":"864cf658-2d7b-46eb-a065-6d44c129989f","status":{"w3cKey":"Escape","eventType":"keyDownUp"},"type":"CPE.KeyEvent","runtimeType":"key"}

						this.mqttPublishMessage(
							mqttUsername + '/' + deviceId,
							// format prior to 17.01.2022
							//'{"id":"' + makeFormattedId(32) + '","type":"CPE.KeyEvent","source":"' + mqttClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}',
							// format from 17.01.2022, client v
							//{"source":"6a93bac6-5402-42a7-9d8a-c7a93e00e68e","id":"864cf658-2d7b-46eb-a065-6d44c129989f","status":{"w3cKey":"Escape","eventType":"keyDownUp"},"type":"CPE.KeyEvent","runtimeType":"key"}
							'{"source":"' + mqttClientId + '","id":"' + makeFormattedId(32) + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"},"type":"CPE.KeyEvent","runtimeType":"key"}',
							{ qos: 2, retain: true }
						);
						this.log.debug('sendKey: key %s: send %s done', i + 1, keyName);

						// set the Target Media State after key has been sent
						// check if we need to set target media state to one of PLAY, PAUSE and STOP
						// MediaPlayPause: toggles between PLAY and PAUSE depending on current value of TargetMediaState
						// MediaPlay: sets PLAY
						// MediaPause: sets PAUSE
						// MediaStop: sets STOP
						if (!keyCanBeSkippedAfterBootup && (['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop'].indexOf(keyName) >= 0)) {
							let targetMediaState;
							switch (keyName) {
								case 'MediaPlayPause':
									// toggle from PLAY to PAUSE and vice versa
									if (this.stbDevices[deviceIndex].targetMediaState == Characteristic.TargetMediaState.PLAY) {
										targetMediaState = Characteristic.TargetMediaState.PAUSE;
									} else if (this.stbDevices[deviceIndex].targetMediaState == Characteristic.TargetMediaState.PAUSE) {
										targetMediaState = Characteristic.TargetMediaState.PLAY;
									}
									break;

								case 'MediaPlay':
									targetMediaState = Characteristic.TargetMediaState.PLAY;
									break;

								case 'MediaPause':
									targetMediaState = Characteristic.TargetMediaState.PAUSE;
									break;

								case 'MediaStop':
									targetMediaState = Characteristic.TargetMediaState.STOP;
									break;
							}
							// set the target media state via the setTargetMediaState function
							this.stbDevices[deviceIndex].setTargetMediaState(targetMediaState, true);
						}
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
				// the web client uses qos:2, so we should as well
				this.mqttPublishMessage(
					mqttUsername + '/' + deviceId,
					'{"source":"' + mqttClientId + '","id":"' + makeFormattedId(32) + '","type":"CPE.getUiStatus","runtimeType":"getUiStatus"}',
					{ qos: 2, retain: true }
				);
			}
		} catch (err) {
			this.log.error("Error trapped in getUiStatus:", err.message);
			this.log.error(err);
		}
	}


	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler mqtt
	//+++++++++++++++++++++++++++++++++++++++++++++++++++++



}





































class stbDevice {
	// build the device
	// called using
	// let newStbDevice = new stbDevice(this.log, this.config, this.api, this.devices[i], this.customer, this.entitlements, this);
	//constructor(log, config, api, device, customer, entitlements, platform) {
	constructor(log, config, api, device, platform) {
		this.log = log;
		this.config = config;
		this.api = api;
		this.device = device;
		this.platform = platform;
		this.customer = this.platform.customer;
		this.entitlements = this.platform.entitlements;

		this.deviceId = this.device.deviceId
		this.profileId = -1; // default -1

		// set default name on restart, max 14 char
		// In dev environment, truncate user defined name to ensure DEV is included as a tag for dev environment
		this.name = this.device.settings.deviceFriendlyName.substring(0, SETTOPBOX_NAME_MAXLEN - PLUGIN_ENV.length) + PLUGIN_ENV; // append DEV environment

		// allow user override of device name via config, but limit to max 14 char
		if (this.config.devices) {
			const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice && configDevice.name) { this.name = configDevice.name.substring(0, SETTOPBOX_NAME_MAXLEN); }
		}


		// ++++++++++++++++ plugin setup ++++++++++++++++
		// setup arrays
		this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.channelList = [];			// subscribed channels, filtered from the masterchannelLust, to be loaded into the Home app. Limited to 96
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 95
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL

		//setup variables
		this.lastPowerKeySent;			// stores when the power key was sent last to help in de-bounce
		this.accessoryConfigured;		// true when the accessory is configured

		// initial states. Will be updated by mqtt messages
		this.currentPowerState = Characteristic.Active.INACTIVE;
		this.previousPowerState = Characteristic.Active.INACTIVE;
		this.currentChannelId = NO_CHANNEL_ID; // string eg SV09038
		this.lastKeyMacroChannelId = null; // string eg $KeyMacro1
		this.currentClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
		this.previousClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
		this.currentMediaState = Characteristic.CurrentMediaState.STOP;
		this.targetMediaState = Characteristic.TargetMediaState.STOP;
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


		// do an initial accessory channel list update, required to configure the accessory
		// then prepare the accessory
		this.refreshDeviceChannelList(this.deviceId) // async function
			.then(() => {
				// plugin setup done, session and channels loaded, can load the accessory
				this.accessoryConfigured = false;
				this.prepareAccessory();
				this.log('%s: Initialization completed', this.name);
			})

		//this.log('%s: end of stbDevice constructor', this.name);
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
			switch (configDevice.accessoryCategory.toLowerCase()) {
				case 'speaker':
					accessoryCategory = Categories.SPEAKER; break;
				case 'settopbox': case 'stb':
					accessoryCategory = Categories.TV_SET_TOP_BOX; break;
				case 'television': case 'tv':
					accessoryCategory = Categories.TELEVISION; break;
				case 'receiver': case 'audio-receiver': case 'avr':
					accessoryCategory = Categories.AUDIO_RECEIVER; break;
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
			// the first 6 characters is the OUI identifying the manufacturer, refer https://standards-oui.ieee.org/
			// 000378-EOSSTB-003893xxxxxx 	Ireland
			// 3C36E4-EOSSTB-003792xxxxxx  	Belgium
			// 3C36E4-EOSSTB-003713xxxxxx 	Great Britain with productType: 'TV360'
			// 000378-EOSSTB-003938xxxxxx 	Great Britain with productType: 'TV360', HUMAX EOS1008R
			// 000378-EOS2STB-008420xxxxxx 	Belgium
			// E0B7B1-APLSTB-300152xxxxxx 	Ziggo NL APOLLO GATEWAY
			case '3C36E4': case 'E0B7B1': // OUI for ARRIS
				manufacturer = 'ARRIS Group, Inc.';
				// devices seen: 
				switch (deviceType[1]) {
					case 'APLSTB': // new Apollo box seen in Ziggo NL in January 2023, label shows VIP5002W - ZG
						model = 'VIP5002W';;
						break;
					case 'EOSSTB':	// most common DCX960 box
						model = 'DCX960';
						break;
					default:
						model = '?';
						break;
				}
				break;

			case '000378': // OUI for HUMAX 
				manufacturer = 'HUMAX Co., Ltd.';
				// devices seen: EOS1008R & 2008C-STB-TN
				switch (deviceType[1]) {
					case 'EOS2STB':	// new EOS2STB released March 2022 is a HUMAX 2008C-STB-TN
						model = '2008C-STB-TN';
						break;
					case 'EOSSTB':	// new EOS2STB released March 2022 is a HUMAX 2008C-STB-TN
						model = 'EOS1008R';
						break;
					default:		// default 
						model = '?';
						break;
				}
				break;
		}

		// add platform type to manufacturer
		// CH & NL uses EOS as platformType, GB uses HORIZON
		if (manufacturer) { manufacturer = manufacturer + ' [' + (this.device.platformType || '') + ']'; }

		// GB has a productType, CH & NL have no productType but they have deviceType.
		// GB devices have deviceType=GATEWAY and productType=TV360
		if (model) { model = model + ' [' + (this.device.productType || this.device.deviceType || '') + ']'; }

		// fallback to current device, then to platform
		manufacturer = manufacturer || this.device.platformType || PLATFORM_NAME;
		model = model || this.device.productType || this.device.deviceType || PLUGIN_NAME;
		serialnumber = serialnumber || this.device.deviceId; // EOSSTB and EOS2STB both use deviceId as serial number
		firmwareRevision = firmwareRevision || configDevice.firmwareRevision || ver[0]; // must be numeric. Non-numeric values are not displayed

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
			.setCharacteristic(Characteristic.StatusActive, Characteristic.Active.ACTIVE) // bool, 0 = false = NotStatusActive, non-zero = true = StatusActive
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
			.on('set', (inputIdentifier, callback) => { this.setInput(this.channelList[inputIdentifier - 1], callback); });

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
			.on('set', (newMediaState, callback) => { this.setTargetMediaState(newMediaState, false, callback); });

		// extra characteristics added here are accessible in Shortcuts and Automations (both personal and home)
		// general fault
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




		// Custom characteristics
		// these are visible in Shortcuts with the name "Custom"
		var hapCharacteristic = {};
		const BASE_UUID = "-0000-3C36-E400-3C36E4FF0012"; // a random UUID used only for my plugin's characteristics, based on 3C36E4-EOSSTB-003656123456
		// 											 export const BASE_UUID = "-0000-1000-8000-0026BB765291"; // Apple HomeKit base UUID

		// add a custom hap characteristic for the current channel id, appears as Custom in shortcuts
		// var hapCharacteristic = new Characteristic(characteristic.displayName, characteristic.UUID, characteristic.props);
		hapCharacteristic = new Characteristic("Current Channel Id", "00000001" + BASE_UUID, {
			format: Characteristic.Formats.STRING,
			perms: [Characteristic.Perms.PAIRED_READ, Characteristic.Perms.NOTIFY]
		})
		hapCharacteristic.value = ''; // add a default empty value 
		hapCharacteristic.on('get', this.getCurrentChannelId.bind(this));
		this.televisionService.addCharacteristic(hapCharacteristic); // add the Characteristic to the televisionService
		// once added, it can be retrieved with
		//this.televisionService.getCharacteristic('Current Channel Id')

		// add a custom hap characteristic for the current channel name, appears as Custom in shortcuts
		// var hapCharacteristic = new Characteristic(characteristic.displayName, characteristic.UUID, characteristic.props);
		hapCharacteristic = new Characteristic("Current Channel Name", "00000002" + BASE_UUID, {
			format: Characteristic.Formats.STRING,
			perms: [Characteristic.Perms.PAIRED_READ, Characteristic.Perms.NOTIFY]
		})
		hapCharacteristic.value = ''; // add a default empty value 
		hapCharacteristic.on('get', this.getCurrentChannelName.bind(this));
		this.televisionService.addCharacteristic(hapCharacteristic); // add the Characteristic to the televisionService
		// once added, it can be retrieved with
		//this.televisionService.getCharacteristic('Current Channel Name')


		//this.log('DEBUG:  this.televisionService')
		//this.log(this.televisionService)

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
			// get a custom configDevice if one exists
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
				this.log.warn('prepareInputSourceServices Adding service %s of %s: %s', i, maxSources, (this.channelList[i - 1] || {}).name);
			}

			// default values to hide the input if nothing exists in this.channelList
			var chFixedName = `Input ${i < 10 ? `0${i}` : i}`; // fixed if not profile 0
			var chName = 'HIDDEN_' + ('0' + (i + 1)).slice(-2);
			var chId = 'HIDDEN_' + i;
			var visState = Characteristic.CurrentVisibilityState.HIDDEN;
			var configState = Characteristic.IsConfigured.NOT_CONFIGURED;

			// get names and channel id from the array
			//this.log("this.channelList.length", this.channelList.length);
			//this.log(this.channelList);
			// index 0 = channel 1
			if (i <= this.channelList.length && this.channelList[i - 1]) {
				chName = this.channelList[i - 1].name;
				chId = this.channelList[i - 1].id;
				visState = this.channelList[i - 1].visibilityState;
				configState = Characteristic.IsConfigured.CONFIGURED;
			}

			// some channels are deliberately hidden, so assign a fictional channelId and disable them
			if (chName.includes('HIDDEN_')) { // name contains 'HIDDEN_'
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
	//async updateDeviceState(powerState, mediaState, recState, channelId, eventId, sourceType, profileDataChanged, callback) {
	async updateDeviceState(powerState, mediaState, recState, channelId, eventId, sourceType, profileDataChanged, statusFault, programMode, statusActive, inputDeviceType, inputSourceType, callback) {
		try {
			// runs at the very start, and then every few seconds, so don't log it unless debugging
			// doesn't get the data direct from the settop box, but rather: gets it from the this.currentPowerState and this.currentChannelId variables
			// which are received by the mqtt messages, which occurs very often
			if (this.config.debugLevel > 0) {
				this.log.warn('%s: updateDeviceState: powerState %s, mediaState %s [%s], recState %s [%s], channelId %s, eventId %s, sourceType %s, profileDataChanged %s, statusFault %s [%s], programMode %s [%s], statusActive %s [%s], inputDeviceType %s [%s], inputSourceType %s [%s]',
					this.name,
					powerState,
					mediaState, currentMediaStateName(mediaState),
					recState, Object.keys(recordingState)[recState], // custom characteristic
					channelId,
					eventId,
					sourceType,
					profileDataChanged,
					statusFault, Object.keys(Characteristic.StatusFault)[statusFault + 1],
					programMode, Object.keys(Characteristic.ProgramMode)[programMode + 1],
					statusActive, statusActiveName[statusActive],
					inputDeviceType, Object.keys(Characteristic.InputDeviceType)[inputDeviceType + 1],
					inputSourceType, Object.keys(Characteristic.InputSourceType)[inputSourceType + 1],
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
			if (recState != null) { this.currentRecordingState = recState; }
			if (channelId != null) { this.currentChannelId = channelId; }
			if (eventId != null) { this.currentEventId = eventId; }
			if (sourceType != null) { this.currentSourceType = sourceType; }
			this.profileDataChanged = profileDataChanged || false;
			if (statusFault != null) { this.currentStatusFault = statusFault; }
			if (programMode != null) { this.currentProgramMode = programMode; }
			if (statusActive != null) { this.currentStatusActive = statusActive; }
			if (inputDeviceType != null) { this.currentInputDeviceType = inputDeviceType; }
			if (inputSourceType != null) { this.currentInputSourceType = inputSourceType; }

			// force the keyMacro channel if a keyMacro was last selected as the input
			if (this.lastKeyMacroChannelId) {
				this.currentChannelId = this.lastKeyMacroChannelId;
			}




			// set the inUse state as a combination of power state and recording state. Added from v1.2.1
			// 1 (IN_USE) when box is on or is recording to local HDD
			// 0 (NOT_IN_USE) when box is off and not recording to local HDD
			if ((this.currentPowerState == Characteristic.Active.ACTIVE) || (this.currentRecordingState == 2)) { // 2 = ONGOING_LOCALDVR
				this.currentInUse = Characteristic.InUse.IN_USE;
			} else {
				this.currentInUse = Characteristic.InUse.NOT_IN_USE;
			}


			// profile data is stored on the platform
			// get the currentClosedCaptionsState from the currently selected profile (stored in this.profileid)
			if (this.customer.profiles[this.profileId] && this.customer.profiles[this.profileId].options.showSubtitles) {
				this.currentClosedCaptionsState = Characteristic.ClosedCaptions.ENABLED;
			} else {
				this.currentClosedCaptionsState = Characteristic.ClosedCaptions.DISABLED;
			}

			// debugging, helps a lot to see channelName
			if (this.config.debugLevel > 0) {
				let curChannel, currentChannelName;
				if (this.platform.masterChannelList) {
					curChannel = this.platform.masterChannelList.find(channel => channel.id === this.currentChannelId);  // this.currentChannelId is a string eg SV09038
					if (curChannel) { currentChannelName = curChannel.name; }
				}
				this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentRecordingState %s [%s], currentChannelId %s [%s], currentSourceType %s, currentClosedCaptionsState %s [%s], currentPictureMode %s [%s], profileDataChanged %s, currentStatusFault %s [%s], currentProgramMode %s [%s], currentStatusActive %s',
					this.name,
					this.currentPowerState,
					this.currentMediaState, currentMediaStateName(this.currentMediaState),
					this.currentRecordingState, Object.keys(recordingState)[this.currentRecordingState],
					this.currentChannelId, currentChannelName,
					this.currentSourceType,
					this.currentClosedCaptionsState, Object.keys(Characteristic.ClosedCaptions)[this.currentClosedCaptionsState + 1],
					this.currentPictureMode, Object.keys(Characteristic.PictureMode)[this.currentPictureMode + 1],
					this.profileDataChanged,
					this.currentStatusFault, Object.keys(Characteristic.StatusFault)[this.currentStatusFault + 1],
					this.currentProgramMode, Object.keys(Characteristic.ProgramMode)[this.currentProgramMode + 1],
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
				var currentDeviceName = this.device.settings.deviceFriendlyName.substring(0, SETTOPBOX_NAME_MAXLEN - PLUGIN_ENV.length) + PLUGIN_ENV; // append DEV environment, limit to 14 chaR

				var syncName = true; // default true		
				if (configDevice && configDevice.syncName == false) { syncName = configDevice.syncName; }
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
						this.previousStatusFault, Object.keys(Characteristic.StatusFault)[this.previousStatusFault + 1],
						this.currentStatusFault, Object.keys(Characteristic.StatusFault)[this.currentStatusFault + 1])
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
						this.previousInUse, Object.keys(Characteristic.InUse)[this.previousInUse + 1],
						this.currentInUse, Object.keys(Characteristic.InUse)[this.currentInUse + 1])
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
						this.previousClosedCaptionsState, Object.keys(Characteristic.ClosedCaptions)[this.previousClosedCaptionsState + 1],
						this.currentClosedCaptionsState, Object.keys(Characteristic.ClosedCaptions)[this.currentClosedCaptionsState + 1])
				}
				this.televisionService.getCharacteristic(Characteristic.ClosedCaptions).updateValue(this.currentClosedCaptionsState);
				this.previousClosedCaptionsState = this.currentClosedCaptionsState;


				// check for change of picture mode or recordingState (both stored in picture mode)
				// customPictureMode deprecated from v2.0.0 and removed from config.json, as its function is handled by inUse.
				// Nov 2022: disabled code, will remove in a future version
				if ((configDevice || {}).customPictureMode == 'recordingState' && 1 == 0) {
					// PictureMode is used for recordingState function, this is a custom characteristic, not supported by HomeKit. we can use values 0...7
					//this.log("previousRecordingState", this.previousRecordingState);
					//this.log("currentRecordingState", this.currentRecordingState);
					if (this.previousRecordingState !== this.currentRecordingState) {
						this.log('%s: Recording State changed from %s [%s] to %s [%s]',
							this.name,
							this.previousRecordingState, Object.keys(recordingState)[this.previousRecordingState],
							this.currentRecordingState, Object.keys(recordingState)[this.currentRecordingState]);
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
							this.previousPictureMode, Object.keys(Characteristic.PictureMode)[this.previousPictureMode + 1],
							this.currentPictureMode, Object.keys(Characteristic.PictureMode)[this.currentPictureMode + 1])
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
						this.previousProgramMode, Object.keys(Characteristic.ProgramMode)[this.previousProgramMode + 1],
						this.currentProgramMode, Object.keys(Characteristic.ProgramMode)[this.currentProgramMode + 1]);
				}
				this.televisionService.getCharacteristic(Characteristic.ProgramMode).updateValue(this.currentProgramMode);
				this.previousProgramMode = this.currentProgramMode;



				// check for change of active identifier (channel)
				// temporarily wrapped this in a try-catch to capture any errors
				//this.log("Before error trap");
				try {
					var searchChannelId = this.currentChannelId; // this.currentChannelId is a string eg SV09038
					var currentActiveIdentifier = NO_INPUT_ID;
					// if the current channel id is an app, search by channel name name, and not by channel id
					if (searchChannelId && searchChannelId.includes('.app.')) {
						// the current channel is an app, eg Netflix
						this.log("This channel is an app, looking for this app in the masterChannelList: ", searchChannelId)
						// get the name from the master channel list
						var masterChannelApp = this.platform.masterChannelList.find(channel => channel.id === searchChannelId);
						//this.log("found masterChannelApp", masterChannelApp)
						// now look again in the master channel list to find this channel with the same name but not an app id
						if (masterChannelApp) {
							//this.log("looking for channel with same name in the masterChannelList: looking for %s", masterChannelApp.name)
							//var masterChannelByName = this.platform.masterChannelList.find(channel => channel.name == masterChannelApp.name ); 
							//this.log("found masterChannel", masterChannelByName)
							//this.log("looking for channel with same name but different channelId in the masterChannelList: looking for %s where channelId is not %s", masterChannelApp.name, masterChannelApp.id)
							var masterChannel = this.platform.masterChannelList.find(channel => channel.name == masterChannelApp.name && channel.id != masterChannelApp.id);
							if (masterChannel) {
								searchChannelId = masterChannel.id;
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

				// search by subtype in the inputServices array, index 0 = input 1, subtype: 'input_SV09038',
				const oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
				//this.log("updateDeviceState: oldActiveIdentifier %s, currentActiveIdentifier %s, searchChannelId %s", oldActiveIdentifier, currentActiveIdentifier, searchChannelId)
				//this.log("this.inputServices")
				//this.log(this.inputServices)
				currentActiveIdentifier = this.inputServices.findIndex(InputSource => InputSource.subtype == 'input_' + searchChannelId) + 1;
				//this.log("found searchChannelId %s at currentActiveIdentifier %s", 'input_' + searchChannelId , currentActiveIdentifier)
				if (currentActiveIdentifier <= 0) { currentActiveIdentifier = NO_INPUT_ID; } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
				//this.log("found searchChannelId at currentActiveIdentifier ", currentActiveIdentifier)

				if (oldActiveIdentifier !== currentActiveIdentifier) {
					// get names from loaded channel list. Using Ch Up/Ch Down buttons on the remote rolls around the profile channel list
					// what happens if the TV is changed to another profile?
					var oldName = NO_CHANNEL_NAME, newName = oldName; // default to UNKNOWN
					if (oldActiveIdentifier != NO_INPUT_ID && this.channelList[oldActiveIdentifier - 1]) {
						oldName = this.channelList[oldActiveIdentifier - 1].name
					}

					if (currentActiveIdentifier != NO_INPUT_ID) {
						newName = this.channelList[currentActiveIdentifier - 1].name
					}
					this.log('%s: Channel changed from %s [%s] to %s [%s]',
						this.name,
						oldActiveIdentifier, oldName,
						currentActiveIdentifier, newName);
					this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
					this.previousActiveIdentifier = this.currentActiveIdentifier;
				}



				// +++++++++++++++ Input Service characteristics ++++++++++++++
				/*
				inputService
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.Name, chFixedName)
				.setCharacteristic(Characteristic.ConfiguredName, chName || `Input ${i < 9 ? `0${i}` : i}`)
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION) 
				.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
				.setCharacteristic(Characteristic.IsConfigured, configState)
				.setCharacteristic(Characteristic.CurrentVisibilityState, visState)
				.setCharacteristic(Characteristic.TargetVisibilityState, visState);
				*/
				// check for change of InputDeviceType state: (a characteristic of Input Source)

				//this.log('looking for input subtype ', 'input_' + this.currentChannelId)
				let currInputIndex = this.inputServices.findIndex(InputSource => InputSource.subtype == 'input_' + this.currentChannelId);
				let currInputNumber = currInputIndex + 1;
				if (currInputIndex < 0) { currInputIndex = null; currInputNumber = null; }
				//this.log('found input index %s input %s subtype %s', currInputIndex, currInputIndex+1, (this.inputServices[currInputIndex] || {}).subtype)
				if (this.previousInputDeviceType !== this.currentInputDeviceType) {
					this.log('%s: Input Device Type changed on input %s %s from %s [%s] to %s [%s]',
						this.name,
						currInputNumber,
						this.currentChannelId,
						this.previousInputDeviceType, Object.keys(Characteristic.InputDeviceType)[this.previousInputDeviceType + 1],
						this.currentInputDeviceType, Object.keys(Characteristic.InputDeviceType)[this.currentInputDeviceType + 1]
					);
				}
				//this.televisionService.getCharacteristic(Characteristic.InputDeviceType).updateValue(this.currentInputDeviceType);
				if (currInputIndex) { this.inputServices[currInputIndex].getCharacteristic(Characteristic.InputDeviceType).updateValue(this.currentInputDeviceType); }
				this.previousInputDeviceType = this.currentInputDeviceType;

				// check for change of InputSourceType state: (a characteristic of Input Source)
				if (this.previousInputSourceType !== this.currentInputSourceType) {
					this.log('%s: Input Source Type changed on input %s %s from %s [%s] to %s [%s]',
						this.name,
						currInputNumber,
						this.currentChannelId,
						this.previousInputSourceType, Object.keys(Characteristic.InputSourceType)[this.previousInputSourceType + 1],
						this.currentInputSourceType, Object.keys(Characteristic.InputSourceType)[this.currentInputSourceType + 1]);
				}
				// [12/11/2022, 12:22:37] [homebridge-eosstb] This plugin generated a warning from the characteristic 'Input Source Type': Characteristic not in required or optional characteristic section for service Television. Adding anyway.. See https://homebridge.io/w/JtMGR for more info.
				if (currInputIndex) { this.inputServices[currInputIndex].getCharacteristic(Characteristic.InputSourceType).updateValue(this.currentInputSourceType); } // generates Homebridge warning
				this.previousInputSourceType = this.currentInputSourceType;
				//this.log('++++DEBUG: this.inputServices[currInputIndex]')
				//this.log(this.inputServices[currInputIndex])

				// +++++++++++++++ end of Input Service characteristics ++++++++++++++


				// check for change of current media state
				var prevCurrentMediaState = this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).value;
				if (prevCurrentMediaState !== this.currentMediaState) {
					this.log('%s: Current Media state changed from %s [%s] to %s [%s]',
						this.name,
						prevCurrentMediaState, currentMediaStateName(prevCurrentMediaState),
						this.currentMediaState, currentMediaStateName(this.currentMediaState));

					// set targetMediaState to same as currentMediaState as long as currentMediaState is <= 2 (supports 0 PLAY, 1 PAUSE, 2 STOP)
					if (this.currentMediaState <= Characteristic.TargetMediaState.STOP) {
						this.targetMediaState = this.currentMediaState
						this.televisionService.getCharacteristic(Characteristic.TargetMediaState).updateValue(this.targetMediaState);
					}
				}
				this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.currentMediaState);
				this.previousMediaState = this.currentMediaState;

				// check for change of profile
				if (this.profileDataChanged) {
					this.log('%s: Profile data changed', this.name);
					this.refreshDeviceChannelList();
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
	async refreshDeviceChannelList(callback) {
		try {
			if (this.config.debugLevel > 1) { this.log.warn('%s: refreshDeviceChannelList', this.name); }
			this.log("%s: Refreshing device channel list...", this.name);
			//this.log("%s: Refreshing channel list: CURRENTLY DISABLED AS MASTER CHANNEL LIST not yet BUILT", this.name);
			//return;

			// exit if no session exists
			if (currentSessionState != sessionState.CONNECTED) {
				this.log.warn('%s: refreshDeviceChannelList: Session not yet created, exiting', this.name);
				return;
			}

			// exit if no master channel list loaded yet (on platform level)
			if (!this.platform.masterChannelList) {
				this.log.warn('%s: refreshDeviceChannelList: master channel list not yet loaded, exiting', this.name);
				return;
			}

			// limit the amount of max channels to load as Apple HomeKit is limited to 100 services per accessory.
			// if a config exists for this device, read the users configured maxSources, if it exists
			var maxSources = MAX_INPUT_SOURCES;
			var configDevice = {};
			if (this.config.devices) {
				configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
				if (configDevice) {
					// homebridge config for this device exists, read maxSources (if exists)
					maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
				}
			}


			// get a user configured Profile, if it exists, otherwise we will use the default Profile for the channel list
			var wantedProfile;
			if (this.config.debugLevel > 1) { this.log.warn("%s: Getting profile data from config", this.name); }
			if (configDevice) {
				// homebridge config for this device was found, get the profile item if the name exists in the published profiles
				wantedProfile = this.customer.profiles.find(profile => profile.name === configDevice.profile);
				if (wantedProfile) {
					if (this.config.debugLevel > 1) { this.log.warn("%s: Configured profile found: '%s'", this.name, configDevice.profile); }
				}
			}
			// fallback to default profile if no user profile found
			if (!wantedProfile) {
				// no profile found, use the default profile
				wantedProfile = this.customer.profiles.find(profile => profile.profileId === this.device.defaultProfileId);
				if (this.config.debugLevel > 1) { this.log.warn("%s: No user-configured profile found, reverting to default profile: '%s'", this.name, wantedProfile.name) }
			}
			//this.log("%s: Using profile %s", this.name, wantedProfile.name)
			//this.log("%s: profile dump:", this.name)
			//this.log(wantedProfile)


			// now load the mostWatched list for this profile
			this.getMostWatchedChannels(wantedProfile.profileId); // async function

			// get the wanted profile configured on the stb
			this.profileId = wantedProfile.profileId
			//this.log.warn("%s: Profile '%s' last modified at %s", this.name, wantedProfile.name, wantedProfile.lastModified); 


			// load the subscribedChIds array from the favoriteChannels of the wantedProfile, in the order shown
			// Note: favoriteChannels is allowed to be empty!
			// Note: the shared profile contains no favorites
			const lastModeDate = new Date(wantedProfile.lastModified);
			this.log("%s: Profile '%s' contains %s channels, profile last modified on %s", this.name, wantedProfile.name, wantedProfile.favoriteChannels.length, lastModeDate.toLocaleString());
			var subscribedChIds = []; // an array of channelIds: SV00302, SV09091, etc
			if (wantedProfile.favoriteChannels.length > 0) {
				if (this.config.debugLevel > 1) {
					this.log.warn("%s: Loading channels from profile '%s' into the subscribedChIds", this.name, wantedProfile.name)
					this.log.warn("%s: Most watched list length", this.name, (this.mostWatched || []).length)
				}
				// check channelOrder: new config item added in v2, config item may not exist for older users.
				//let debugChannelorder = (configDevice.channelOrder || 'channelOrder')
				//this.log.warn("%s: DEBUG debugChannelorder", this.name, debugChannelorder)
				if ((((configDevice || {}).channelOrder) || 'channelOrder') == 'mostWatched' && (this.mostWatched || []).length > 0) {
					// load by mostWatched sort order
					if (this.config.debugLevel > 1) {
						this.log.warn("%s: Loading channel using most watched sort order", this.name)
					}
					this.mostWatched.forEach((mostWatchedChannelId) => {
						//this.log.warn("%s: Loading channel using most watched sort order. Looking for channel %s", this.name, mostWatchedChannelId)
						// channel is just the channelId eg SV09322
						wantedProfile.favoriteChannels.forEach((channel) => {
							//this.log.warn("%s: checking channel", this.name, channel)
							if (channel == mostWatchedChannelId) {
								if (this.config.debugLevel > 2) {
									this.log.warn("%s: Loading channel using most watched sort order. Channel %s found, loading at index %s", this.name, channel, subscribedChIds.length)
								}
								subscribedChIds.push(channel);
							}
						});
					});
				} else {
					// load by standard sort order
					if (this.config.debugLevel > 1) {
						this.log.warn("%s: Loading channel using standard sort order", this.name)
					}
					wantedProfile.favoriteChannels.forEach((channel) => {
						if (this.config.debugLevel > 1) {
							this.log.warn("%s: Loading channel using standard sort order. Channel %s found, loading at index %s", this.name, channel, subscribedChIds.length)
						}
						subscribedChIds.push(channel);
					});
				}
			}
			if (this.config.debugLevel > 1) {
				this.log.warn("%s: subscribedChIds.length: %s", this.name, subscribedChIds.length)
				this.log.warn("%s: subscribedChIds %s", this.name, subscribedChIds)
				this.log.warn("%s: subscribedChIds.length", this.name, subscribedChIds.length)
			}



			// if the subscribedChIds is empty, load the channels from the master channel list
			// sorted by logicalChannelNumber, including only entitled channels
			//if (this.config.debugLevel > 1) { this.log.warn("%s: Checking if subscribed channel list is needed", this.name); }
			//this.log.warn("%s: this.customer.profiles", this.name, this.customer.profiles); 
			//wantedProfile = this.customer.profiles.find(profile => profile.profileId === this.device.defaultProfileId);
			if (subscribedChIds.length == 0) {
				if (this.config.debugLevel > 1) { this.log("%s: Profile '%s' contains 0 favorite channels. Channel list will be loaded from master channel list", this.name, wantedProfile.name); }
				// get a clean list of entitled channels (will not be in correct order)
				// some entitlements are not in the masterchannelList, these must be ignored
				//if (this.config.debugLevel > 1) { this.log.warn("%s: Checking %s entitlements within %s channels in the master channel list", this.name, this.platform.session.entitlements.length, this.platform.masterChannelList.length); }

				// entitlements needs to be reworked, currently load everything
				//this.log.warn("%s: Loading all channels into the subscribedChIds", this.name)
				//this.log.warn("%s: masterChannelList.length", this.name, this.platform.masterChannelList.length)
				//this.log.warn("%s: this.entitlements %s", this.name, this.entitlements)
				//this.log.warn("%s: this.platform.entitlements.entitlements %s", this.name, this.platform.entitlements.entitlements)
				this.platform.masterChannelList.forEach((channel) => {
					// check entitlements of this channel
					// channel.linearProducts is an array of entitlement codes assigned to a channel, each channel can have multiple entitlement codes
					// linearProducts: [ '601007005' ],
					// this.platform.entitlements.entitlements is an array of entitlement codes that the household has subscribed to
					// [{ casIndicator: 0, id: '600000001' }, { casIndicator: 0, id: '600000080' }, { casIndicator: 1, id: '600000070' }, { casIndicator: 1, id: '600000300' }]
					// control channel: SV09038 SRF 1 HD (entitled), with "linearProducts": [ '100000000', '100000001', '600000300'	],
					// control channel: SV06321 Nicktoons (not entitled), with linearProducts: [ '601007005' ],
					var isEntitled = false;
					this.log.debug("%s: checking entitlements for %s %s", this.name, channel.id, channel.name)
					this.log.debug("%s: channel.linearProducts %s", this.name, channel.linearProducts)
					this.platform.entitlements.entitlements.forEach((subscribedlEntitlement) => {
						if (channel.linearProducts.includes(subscribedlEntitlement.id)) {
							this.log.debug("%s: channel channelId %s, linearProducts includes subscribedlEntitlement.id %s, channel is entitled", this.name, channel.id, subscribedlEntitlement.id)
							isEntitled = true;
						}
					});
					if (isEntitled) {
						subscribedChIds.push(channel.id);
						this.log.debug("%s: %s %s is entitled, pushed to subscribedChIds, subscribedChIds.length now %s", this.name, channel.id, channel.name, subscribedChIds.length)
					}
				});
				this.log.debug("%s: subscribedChIds.length", this.name, subscribedChIds.length)
			}
			if (this.config.debugLevel > 1) {
				this.log("%s: Subscribed channel list loaded with %s channels", this.name, subscribedChIds.length)
			}




			// recently viewed apps
			if (this.config.debugLevel > 1) {
				this.log.warn("%s: refreshDeviceChannelList: recentlyUsedApps", this.name, wantedProfile.recentlyUsedApps);
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
				this.log.warn("%s: refreshDeviceChannelList: before channel refresh: this.currentChannelId %s currentActiveIdentifier %s currentChannelName %s", this.name, this.currentChannelId, currentActiveIdentifier, currentChannelName);
			}
			*/


			//const currentInpIndex = this.inputServices.findIndex(channel => channel.subtype == 'input_' + this.currentChannelId);
			//this.log("Found before channel load: this.currentChannelId %s found at currentInpIndex %s", this.currentChannelId, currentInpIndex);


			////////////////////////////////////////////////////////
			// load the input list
			////////////////////////////////////////////////////////

			// clear the array
			this.channelList = [];

			// check for any custom keymacros, they consume slots at the end of the channelList
			this.log.debug("%s: Checking for KeyMacros", this.name);
			let keyMacros = [];
			if (this.config.channels) {
				keyMacros = this.config.channels.filter(channel => {
					if (channel.channelKeyMacro) { return true; }
				})
				this.log.debug("%s: Found keyMacros: %s", this.name, keyMacros.length);
			}

			// limit the amount to load to all the channels and all the keyMacros
			// keyMacros will occupy top slots of channel list
			const maxChs = Math.min(subscribedChIds.length + keyMacros.length, maxSources);
			const firstKeyMacroSlot = Math.max(maxChs - keyMacros.length, 0); // never go below index 0
			//this.log("%s: Loading %s channels, starting at channel 1", this.name, subscribedChIds.length);
			this.log("%s: Loading %s key macros, starting at channel %s ", this.name, keyMacros.length, firstKeyMacroSlot + 1);

			// show log of what will be loaded, very useful for debugging
			this.log("%s: Refreshing channels 1 to %s", this.name, maxChs);
			if (maxChs < maxSources) {
				this.log("%s: Hiding     channels %s to %s", this.name, maxChs + 1, maxSources);
			}

			// loop and load all channels from the subscribedChIds in the order defined by the array
			//this.log("Loading all subscribed channels")
			for (let i = 0; i < maxChs; i++) {
				//subscribedChIds.forEach((subscribedChId, i) => {
				//this.log("In forEach loop, processing index %s %s", i, subscribedChId)

				// find the channel to load.
				var channel = {};
				var customChannel = {};
				let k = 0;

				// load a channel if we are in the range of channel numbers not assigned to keymacros
				if (i < firstKeyMacroSlot) {
					// this slot needs to be occupied by a channel

					// first look in the config channels list for any user-defined custom channel name
					if (this.config.channels) {
						customChannel = this.config.channels.find(channel => channel.id === subscribedChIds[i]);
						if ((customChannel || {}).name) {
							customChannel.name = cleanNameForHomeKit(customChannel.name)
							this.log("%s: Found %s in config channels, setting name to %s", this.name, customChannel.id, customChannel.name);
						} else {
							customChannel = {};
						}
					}


					// check if the subscribedChId exists in the master channel list, if not, push it, using the user-defined name if one exists, and channelNumber >10000
					this.log.debug("%s: Index %s: Finding %s in master channel list", this.name, i, subscribedChIds[i]);
					channel = this.platform.masterChannelList.find(channel => channel.id === subscribedChIds[i]);
					if (!channel) {
						const newChName = customChannel.name || "Channel " + subscribedChIds[i];
						this.log("%s: Unknown channel %s [%s] discovered. Adding to the master channel list", this.name, subscribedChIds[i], newChName);
						this.platform.masterChannelList.push({
							id: subscribedChIds[i],
							name: newChName,
							logicalChannelNumber: 10000 + this.platform.masterChannelList.length, // integer
							linearProducts: this.platform.entitlements.entitlements[0].id // must be a valid entitlement id
						});
						// refresh channel as the not found channel will now be in the masterChannelList
						channel = this.platform.masterChannelList.find(channel => channel.id === subscribedChIds[i]);
						channel.configuredName = channel.name; // set a configured name same as name 
					} else {
						// show some useful debug data
						this.log.debug("%s: Index %s: Found %s %s in master channel list", this.name, i, channel.id, channel.name);
					}
					this.log.debug("%s: Index %s: Loading channel %s %s", this.name, i, i + 1, channel.name);

				} else {

					// this slot needs to be occupied by a keyMacro
					k = i - firstKeyMacroSlot
					this.log.debug("%s: Index %s: Loading channel %s keyMacro %s %s", this.name, i, i + 1, k + 1, keyMacros[k].channelName);
					this.log.debug("%s: Index %s: Load this keyMacro: %s", this.name, i, keyMacros[k]);
					channel = {
						"id": '$KeyMacro' + (k + 1),
						"name": keyMacros[k].channelName,
						"logicalChannelNumber": 20000 + i,
						"linearProducts": 0,
						"keyMacro": keyMacros[k].channelKeyMacro,
					}
				}


				// load this channel/keyMacro as an input
				//this.log("loading input %s of %s", i + 1, maxChs)
				//this.log.warn("%s: Index %s: Checking if %s %s can be loaded", this.name, i, channel.id, channel.name);
				if (i < maxChs) {
					this.log.debug("%s: Index %s: Refreshing channel", this.name, i);

					// add the user-defined name if one exists
					if (customChannel && customChannel.name) { channel.name = customChannel.name; }

					// show channel number if user chose to do so
					// must only happen once!
					if ((configDevice || {}).showChannelNumbers) {
						// a config exists. Add channel number prefix only if the prefix does not exist
						const chPrefix = ('0' + (i + 1)).slice(-2) + " ";
						if (!channel.configuredName || channel.configuredName.slice(0, 3) != chPrefix) {
							//this.log("Adding prefix to configured name", chPrefix)
							channel.configuredName = chPrefix + channel.name;
						}
					} else {
						channel.configuredName = channel.name;
					}

					// add channel visibilitystate, doesn't exist on the master channel list
					// TODO these should be read from file...
					channel.visibilityState = Characteristic.CurrentVisibilityState.SHOWN;

					// show debug and add to array
					this.log.debug("%s: Index %s: Refreshing channel %s: %s [%s]", this.name, i, ('0' + (i + 1)).slice(-2), channel.id, channel.name);
					this.channelList[i] = channel;

					// update accesory only when configured, as this.inputServices[i] can only be updated when it exists
					if (this.accessoryConfigured) {
						// update existing services
						if (this.config.debugLevel > 2) {
							this.log.warn("Adding %s %s to input %s at index %s", channel.id, channel.name, i + 1, i);
						}
						this.inputServices[i].name = channel.configuredName;
						this.inputServices[i].subtype = 'input_' + channel.id; // string, input_SV09038 etc

						// Name can only be set for SharedProfile where order can never be changed
						if (this.profileid == 0) {
							this.inputServices[i].updateCharacteristic(Characteristic.Name, channel.name); // stays unchanged at Input 01 etc
						}
						this.inputServices[i]
							.updateCharacteristic(Characteristic.ConfiguredName, channel.configuredName)
							.updateCharacteristic(Characteristic.CurrentVisibilityState, channel.visibilityState)
							.updateCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
						//inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.TargetVisibilityState.SHOWN);
						//this.log.warn('this.inputServices[i]')
						//this.log.warn(this.inputServices[i])
					}
				}


			};

			// after loading all the channels, reset the ActiveIdentifier (uint32) to the right Identifier (uint32), as it may have moved slots
			// subtype: 'input_SV09038',
			const currentInput = this.inputServices.find(channel => channel.subtype == 'input_' + this.currentChannelId);
			//this.log("DEBUG: this.currentChannelId %s", this.currentChannelId)
			//this.log("DEBUG: currentInput %s", currentInput)
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
					if (i <= maxChs) {
						// get the channel
						var foundIndex = this.platform.masterChannelList.findIndex(channel => channel.id === appId);
						//this.log("foundIndex", foundIndex);
						if (foundIndex >= 0) {
							var channel = this.platform.masterChannelList[foundIndex];
							this.log("loading app", channel);
	
							// update existing services

							const inputService = this.inputServices[i];
							inputService
								.updateCharacteristic(Characteristic.ConfiguredName, channel.name)
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
			//this.log.debug("channelList, setting hidden items from %s to %s", maxChs + 1, maxSources);
			for (let i = maxChs; i < maxSources; i++) {
				//this.log.debug("Hiding channel", ('0' + (i + 1)).slice(-2));
				this.log.debug("Hiding channel %s of %s", ('0' + (i + 1)).slice(-2), maxSources);
				// array must stay same size and have elements that can be queried, but channelId must never match valid entries
				this.channelList[i] = {
					id: 'hiddenChId_' + i,  // channelid must be unique string, must be different from standard channel ids
					name: 'HIDDEN_' + ('0' + (i + 1)).slice(-2),
					logicalChannelNumber: null,
					linearProducts: null,
					configuredName: 'HIDDEN_' + ('0' + (i + 1)).slice(-2),
					visibilityState: Characteristic.CurrentVisibilityState.HIDDEN
				}

				// get service and hide it if it exists
				const inputService = this.inputServices[i];
				if (inputService) {
					//inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue("Input " + i + 1);
					//inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.NOT_CONFIGURED);
					inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDEN);
				}

			}

			this.log("%s: Channel list refreshed with %s channels (including %s key macros)", this.name, Math.min(maxChs, maxSources), keyMacros.length);
			return false;

		} catch (err) {
			this.log.error("Error trapped in refreshDeviceChannelList:", err.message);
			this.log.error(err);
		}
	}

	// get the most watched channels for the profileId
	// this is for the web session type as of 13.10.2022
	async getMostWatchedChannels(profileId, callback) {
		try {
			if (this.config.debugLevel > 1) { this.log("%s: getMostWatchedChannels started with %s", this.name, profileId); }
			const profile = this.customer.profiles.find(profile => profile.profileId === profileId);
			this.log("%s: Refreshing most watched channels for profile '%s'", this.name, (profile || {}).name);

			// 	https://prod.spark.sunrisetv.ch/eng/web/linear-service/v1/mostWatchedChannels?cityId=401&productClass=Orion-DASH"
			//let url = countryBaseUrlArray[this.config.country.toLowerCase()] + '/eng/web/linear-service/v1/mostWatchedChannels';
			let url = this.platform.configsvc.linearService.URL + '/v1/mostWatchedChannels';
			// add url standard parameters
			url = url + '?cityId=' + this.customer.cityId; //+ this.customer.cityId // cityId needed to get user-specific list
			url = url + '&productClass=Orion-DASH'; // productClass, must be Orion-DASH

			const config = {
				headers: {
					"x-oesp-username": this.platform.session.username, // not sure if needed
					"x-profile": profile.profileId
				}
			};
			if (this.config.debugLevel > 0) { this.log.warn('getMostWatchedChannels: GET %s', url); }
			// this.log('getMostWatchedChannels: GET %s', url);
			axiosWS.get(url, config)
				.then(response => {
					if (this.config.debugLevel > 0) { this.log.warn('getMostWatchedChannels: Profile %s: response: %s %s', profile.name, response.status, response.statusText); }
					if (this.config.debugLevel > 2) {
						this.log.warn('getMostWatchedChannels: %s: response data:', profile.name);
						this.log.warn(response.data);
					}
					this.mostWatched = response.data; // store the entire mostWatched data for future use in this.mostWatched
					this.log("%s: MostWatched list refreshed with %s channels", this.name, this.mostWatched.length);

					return false;
				})
				.catch(error => {
					let errText, errReason;
					errText = 'Failed to refresh most watched channel data for ' + profileId + ' ' + profile.name + ' - check your internet connection:'
					if (error.isAxiosError) {
						errReason = error.code + ': ' + (error.hostname || '');
						// if no connection then set session to disconnected to force a session reconnect
						if (error.code == 'ENOTFOUND') { currentSessionState = sessionState.DISCONNECTED; }
					}
					this.log.warn('%s %s', errText, (errReason || ''));
					this.log.debug(`getMostWatchedChannels error:`, error);
					return false, error;
				});
			return false;

		} catch (err) {
			this.log.error("Error trapped in getMostWatchedChannels:", err.message);
			this.log.error(err);
		}
	}

	getMaxSources(callback) {
		// limit the amount of max channels to load as Apple HomeKit is limited to 100 services per accessory.
		// if a config exists for this device, read the users configured maxSources, if it exists
		var maxSources = MAX_INPUT_SOURCES;
		var configDevice = {};
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice) {
				// homebridge config for this device exists, read maxSources (if exists)
				maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
			}
		}
		//this.log("%s: Setting maxSources to %s", this.name, maxSources);
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
		// fired when the Home app wants to refresh the TV tile. Refresh occurs when tile is displayed.
		// this.currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', this.currentPowerState);
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getPower returning %s [%s]', this.name, this.currentPowerState, powerStateName[this.currentPowerState]);
		}
		callback(null, this.currentPowerState); // return current state: 0=off, 1=on
	}

	// set power state
	async setPower(targetPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in the Home app
		// fired when the user clicks the TV tile in the Home app
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPower targetPowerState:', this.name, targetPowerState, powerStateName[targetPowerState]); }
		callback(null); // for rapid response
		if (this.currentPowerState !== targetPowerState) {
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
			if (deviceName.length < SETTOPBOX_NAME_MINLEN) {
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
				const deviceSettings = { "deviceFriendlyName": deviceName };
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

		if (callback && typeof (callback) === 'function') { callback(); } // for rapid response

		// mute state is a boolean, either true or false: const NOT_MUTED = 0, MUTED = 1;
		this.log('Send key Mute to %s ', this.name);

		// Execute command to toggle mute
		if (this.config.devices) {
			const device = this.config.devices.find(device => device.deviceId == this.deviceId)
			if (device && device.muteCommand) {
				var self = this;
				// assumes the end device toggles between mute on and mute off with each command
				exec(device.muteCommand, function (error, stdout, stderr) {
					// Error detection. error is true when an exec error occured
					if (error) { self.log.warn('setMute Error:', stderr.trim()); }
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
		// not supported, but might use somehow in the future
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
		this.log('Send key Volume %s to %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up', this.name);

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
		const DEFAULT_TRIPLE_PRESS_DELAY_TIME = 800; // default, in case config missing
		var triplePressTime = this.config.triplePressTime || DEFAULT_TRIPLE_PRESS_DELAY_TIME; // default to DEFAULT_TRIPLE_PRESS_DELAY_TIME if nothing found
		const tripleVolDownPressThreshold = (this.config.triplePressTime || triplePressTime);
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
		// fired when the icon is clicked in the Home app and HomeKit requests a refresh
		// fired when the Home app is opened
		// this.currentChannelId is updated by mqtt
		// must return a valid index, and must never return null
		//if (this.config.debugLevel > 1) { this.log.warn('%s: getInput currentChannelId %s',this.name, this.currentChannelId); }

		// find the this.currentChannelId (eg SV09038) in the accessory inputs and return the inputindex once found
		// this allows HomeKit to show the selected current channel
		// as we cannot guarrantee the list order due to personalizationServices changing it at any time
		// we must search by input_channelId within the current accessory InputSource.subtype
		//this.log.warn('%s: getInput looking for this.currentChannelId %s in this.inputServices', this.name, this.currentChannelId);
		var currentChannelName = NO_CHANNEL_NAME;
		var currentInputIndex = this.inputServices.findIndex(InputSource => InputSource.subtype == 'input_' + this.currentChannelId);
		if (currentInputIndex == -1) { currentInputIndex = NO_INPUT_ID - 1 } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
		if ((currentInputIndex > -1) && (currentInputIndex != NO_INPUT_ID - 1)) {
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
		input = input ?? {} // ensure input is never null or undefined
		if (this.config.debugLevel > 1) { this.log.warn('%s: setInput input %s %s', this.name, input.id, input.name); }
		callback(); // for rapid response
		// get current channel, also finds keyMacro channels
		let channel = this.channelList.find(channel => channel.id === this.currentChannelId);
		// if not found look in the master channel list
		if (!channel) { channel = this.platform.masterChannelList.find(channel => channel.id === this.currentChannelId); }

		// robustness: only try to switch channel if an input.id exists. Handle KeyMacros
		this.log('%s: Change channel from %s [%s] to %s [%s]', this.name, this.currentChannelId, (channel || {}).name || NO_CHANNEL_NAME, input.id, input.name);
		if (input.id && input.id.startsWith('$KeyMacro')) {
			this.lastKeyMacroChannelId = input.id; // remember last keyMacro id
			this.platform.sendKey(this.deviceId, this.name, input.keyMacro);

		} else if (input.id) {
			this.lastKeyMacroChannelId = null; // clear last keyMacro channelId
			this.platform.switchChannel(this.deviceId, this.name, input.id, input.name);
		} else {
			this.log.warn('%s: setInput called with no input.id', this.name);
		}
	}



	// get input name (the TV channel name)
	async getInputName(inputId, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		//if (this.config.debugLevel > 1) { this.log.warn('%s: getInputName inputId %s', this.name, inputId); }
		const inputName = (this.channelList[inputId - 1] || {}).configuredName || ''; // Empty string if not found
		if (this.config.debugLevel > 1) {
			this.log.warn("%s: getInputName for input %s returning '%s'", this.name, inputId, inputName);
		}
		callback(null, inputName);
	};

	// set input name (change the TV channel name)
	async setInputName(inputId, newInputName, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		// we cannot handle this as we don't know which channel got renamed
		// as user could name multiple channels to xxx
		// iOS does not like / or ! in the channel name:
		// channel 3 renamed from BBC Four/Cbeebies HD to BBC Four Cbeebies HD (valid only for HomeKit)
		// inputId is an integer of the input

		if (this.config.debugLevel > 1) { this.log.warn('%s: setInputName for input %s to inputName %s', this.name, inputId, newInputName); }

		// store in channelList array and write to disk at every change
		// ensure that this.channelList bounds are not exceeded!
		//if (this.config.debugLevel > 1) { this.log('%s: DEBUG setInputName inputId %s, this.channelList.length %s', this.name, inputId, this.channelList.length);	}
		// not yet working, sometimes causes errors when channelList is not full of data, so comented out
		/*
		this.log.warn('%s: setInputName inputId %s, this.channelList.length %s', this.name, inputId, this.channelList.length);
		if (inputId < this.channelList.length){
			//this.channelList[inputId-1].configuredName = newInputName;
			//const oldInputName = this.channelList[inputId-1].name;
		}
		*/

		//not yet active
		//this.platform.persistConfig(this.deviceId, this.channelList);

		// maybe suppress 
		if (this.config.debugLevel > 2) {
			//this.log('%s: Renamed channel %s from %s to %s (valid only for HomeKit)', this.name, inputId+1, oldInputName, newInputName);
			this.log('%s: Renamed channel %s to %s (valid only for HomeKit)', this.name, inputId + 1, newInputName);
		}
		callback();
	};


	// get current channel id (the TV channel identifier, a string)
	// added in v2.1.0
	// custom characteristic, returns a string, the event updates the characteristic value automatically
	async getCurrentChannelId(callback, currentChannelId) {
		// fired by the user reading the Custom characteristic in Shortcuts
		// fired when the accessory is first created and HomeKit requests a refresh
		// fired when the icon is clicked in the Home app and HomeKit requests a refresh
		// fired when the Home app is opened
		currentChannelId = this.currentChannelId || '';  // this.currentChannelId is a string eg SV09038. Empty string if not found
		if (this.config.debugLevel > 1) { this.log.warn("%s: getCurrentChannelId returning '%s'", this.name, currentChannelId); }
		callback(null, currentChannelId);
	};


	// get current channel name (the TV channel name)
	// added in v2.1.0
	// custom characteristic, returns a string, the event updates the characteristic value automatically
	async getCurrentChannelName(callback, currentChannelName) {
		// fired by the user reading the Custom characteristic in Shortcuts
		// fired when the accessory is first created and HomeKit requests a refresh
		// fired when the icon is clicked in the Home app and HomeKit requests a refresh
		// fired when the Home app is opened
		const curChannel = this.platform.masterChannelList.find(channel => channel.id === this.currentChannelId);  // this.currentChannelId is a string eg SV09038
		// consider setting to Radio if radio is playing
		currentChannelName = (curChannel || {}).name || ''; // Empty string if not found
		if (this.config.debugLevel > 1) { this.log.warn("%s: getCurrentChannelName returning '%s'", this.name, currentChannelName); }
		callback(null, currentChannelName);
	};


	// get input visibility state (of the TV channel in the accessory)
	async getInputVisibilityState(inputId, callback) {
		// fired when ??
		if (this.config.debugLevel > 1) { this.log.warn('%s: getInputVisibilityState inputId %s', this.name, inputId); }
		//var visibilityState = Characteristic.CurrentVisibilityState.SHOWN;
		//if (this.channelList[inputId-1].name == 'HIDDEN') {
		//	visibilityState = Characteristic.CurrentVisibilityState.HIDDEN;
		// }
		const visibilityState = this.inputServices[inputId - 1].getCharacteristic(Characteristic.CurrentVisibilityState).value;
		if (this.config.debugLevel > 2) {
			this.log.warn('%s: getInputVisibilityState input %s returning %s [%s]', this.name, inputId, visibilityState, Object.keys(Characteristic.CurrentVisibilityState)[visibilityState + 1]);
		}
		callback(null, visibilityState);
	}

	// set input visibility state (show or hide the TV channel)
	async setInputVisibilityState(inputId, visibilityState, callback) {
		// fired when ??
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: setInputVisibilityState for input %s inputVisibilityState %s [%s]', this.name, inputId, visibilityState, Object.keys(Characteristic.CurrentVisibilityState)[visibilityState + 1]);
		}
		this.inputServices[inputId - 1].getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(visibilityState);

		// store in channelList array and write to disk at every change
		this.channelList[inputId - 1].visibilityState = visibilityState;
		//not yet active
		//this.platform.persistConfig(this.deviceId, this.channelList);

		callback(); // for rapid response
	}


	// get closed captions state
	async getClosedCaptions(callback) {
		// fired when the Home app wants to refresh the TV tile. Refresh occurs when tile is displayed.
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getClosedCaptions returning %s [%s]', this.name, this.currentClosedCaptionsState, Object.keys(Characteristic.ClosedCaptions)[this.currentClosedCaptionsState + 1])
		}
		callback(null, this.currentClosedCaptionsState); // return current state
	}

	// set closed captions state
	async setClosedCaptions(targetClosedCaptionsState, callback) {
		// fired when ?? Apple HomeKit has no ability to control setClosedCaptions 
		// targetClosedCaptionsState is the wanted state
		if (this.config.debugLevel > 1) { this.log.warn('%s: setClosedCaptions targetClosedCaptionsState:', this.name, targetClosedCaptionsState, Object.keys(Characteristic.ClosedCaptions)[targetClosedCaptionsState + 1]); }
		if (this.currentClosedCaptionsState !== targetClosedCaptionsState) {
			this.log("setClosedCaptions: not yet implemented");
		}
		callback();
	}


	// get picture mode state
	async getPictureMode(callback) {
		// fired when the Home app wants to refresh the TV tile. Refresh occurs when tile is displayed.
		if (this.config.debugLevel > 1) {
			//this.log.warn('%s: getPictureMode', this.name); 
			// get the config for the device, needed for a few status checks
			var configDevice;
			if (this.config.devices) {
				configDevice = this.config.devices.find(device => device.deviceId == this.deviceId);
			}
			if ((configDevice || {}).customPictureMode == 'recordingState') {
				this.log.warn('%s: getPictureMode returning %s [%s]', this.name, this.customPictureMode, Object.keys(recordingState)[this.customPictureMode]);
			} else {
				this.log.warn('%s: getPictureMode returning %s [%s]', this.name, this.customPictureMode, Object.keys(Characteristic.PictureMode)[this.customPictureMode + 1]);
			}
		}
		callback(null, this.customPictureMode); // return current state
	}

	// set picture mode state
	async setPictureMode(targetPictureMode, callback) {
		// The current Home app (iOS 16.0) does not support setting this characteristic, thus is never fired
		// targetClosedCaptionsState is the wanted state
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPictureMode targetPictureMode:', this.name, targetPictureMode, Object.keys(Characteristic.PictureMode)[targetPictureMode + 1]); }
		if (this.customPictureMode !== targetPictureMode) {
			this.log("setPictureMode: not yet implemented");
		}
		callback();
	}




	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state, callback) {
		// fired by the View TV Settings command in the Home app TV accessory Settings
		if (this.config.debugLevel > 1) { this.log.warn('%s: setPowerModeSelection state:', this.name, state); }
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
		// The current Home app (iOS 16.0) does not support setting this characteristic, thus is never fired
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getCurrentMediaState returning %s [%s]', this.name, this.currentMediaState, currentMediaStateName(this.currentMediaState));
		}
		callback(null, this.currentMediaState);
	}

	// get target media state
	async getTargetMediaState(callback) {
		// The current Home app (iOS 16.0) does not support getting this characteristic, thus is never fired
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// must never return null, so send STOP as default value
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getTargetMediaState returning %s [%s]', this.name, this.targetMediaState, currentMediaStateName(this.targetMediaState));
		}
		callback(null, this.targetMediaState);
	}

	// set target media state
	async setTargetMediaState(targetMediaState, logChangeOnly, callback) {
		// The current Home app (iOS 16.0) does not support setting this characteristic, thus is never fired
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// can be controlled by the Apple TV Remote Control, and is called when changing Play / Pause / Stop 
		// logChangeOnly = TRUE: only the changes are logged, no media state change occurs. Needed when sending remote keypresses to prevent double commands
		if (this.config.debugLevel > 1) { this.log.warn('%s: setTargetMediaState targetMediaState:', this.name, targetMediaState, Object.keys(Characteristic.TargetMediaState)[targetMediaState + 1]); }

		var prevTargetMediaState = this.televisionService.getCharacteristic(Characteristic.TargetMediaState).value;
		if (prevTargetMediaState !== targetMediaState) {
			this.targetMediaState = targetMediaState;
			this.log('%s: Target Media state changed from %s [%s] to %s [%s]',
				this.name,
				prevTargetMediaState, Object.keys(Characteristic.TargetMediaState)[prevTargetMediaState + 1],
				targetMediaState, Object.keys(Characteristic.TargetMediaState)[targetMediaState + 1]);
		}
		if (!logChangeOnly) {
			// send the setMediaState command if we are not just logging the change
			const boxMediaStatePAUSE = 0, boxMediaStatePLAY = 1; // the set-top box matching media states
			let newBoxMediaState;
			switch (targetMediaState) {
				case Characteristic.TargetMediaState.PLAY:
					newBoxMediaState = boxMediaStatePLAY;
					break;
				case Characteristic.TargetMediaState.PAUSE:
					newBoxMediaState = boxMediaStatePAUSE;
					break;
				case Characteristic.TargetMediaState.STOP:
					newBoxMediaState = boxMediaStatePAUSE;
					break;
			}
			if (this.config.debugLevel > 1) { this.log('setTargetMediaState: Set media to %s for', Object.keys(Characteristic.TargetMediaState)[targetMediaState + 1], this.currentChannelId); }
			this.platform.setMediaState(this.deviceId, this.name, this.currentChannelId, newBoxMediaState);
		}
		if (callback && typeof (callback) === 'function') { callback(); } // for rapid response
	}


	// get display order
	async getDisplayOrder(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in the Home app and the Home app requests a refresh

		// log the display order
		let dispOrder = this.televisionService.getCharacteristic(Characteristic.DisplayOrder).value;
		if (this.config.debugLevel > 1) { this.log.warn("%s: getDisplayOrder returning '%s'", this.name, dispOrder); }
		callback(null, dispOrder);
	}

	// set display order
	async setDisplayOrder(displayOrder, callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in the Home app and the Home app requests a refresh
		if (this.config.debugLevel > 1) { this.log.warn('%s: setDisplayOrder displayOrder', this.name, displayOrder); }
		callback(null);
	}

	// get in use
	async getInUse(callback) {
		// useful in Shortcuts and Automations
		// log the inUse value
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getInUse returning %s [%s]', this.name, this.currentInUse, Object.keys(Characteristic.InUse)[this.currentInUse + 1]);
		}
		callback(null, this.currentInUse);
	}

	// get program mode (recording scheduled, not scheduled)
	async getProgramMode(callback) {
		// useful in Shortcuts and Automations
		// log the programMode value 
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getProgramMode returning %s [%s]', this.name, this.currentProgramMode, Object.keys(Characteristic.ProgramMode)[this.currentProgramMode + 1]);
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

	// get status fault
	async getStatusFault(callback) {
		// useful in Shortcuts and Automations
		// log the StatusFault 
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getStatusFault returning %s [%s]', this.name, this.currentStatusFault, Object.keys(Characteristic.StatusFault)[this.currentStatusFault + 1]);
		}
		callback(null, this.currentStatusFault);
	}

	// get InputSourceType state
	async getInputSourceType(callback) {
		// useful in Shortcuts and Automations
		// log the InputSourceType value 
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getInputSourceType returning %s [%s]', this.name, this.currentInputSourceType, Object.keys(Characteristic.InputSourceType)[this.currentInputSourceType + 1]);
		}
		callback(null, this.currentInputSourceType);
	}

	// get InputDeviceType state
	async getInputDeviceType(callback) {
		// useful in Shortcuts and Automations
		// log the InputDeviceType value 
		if (this.config.debugLevel > 1) {
			this.log.warn('%s: getInputDeviceType returning %s [%s]', this.name, this.currentInputDeviceType, Object.keys(Characteristic.InputDeviceType)[this.currentInputDeviceType + 1]);
		}
		callback(null, this.currentInputDeviceType);
	}



	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: setRemoteKey remoteKey:', this.name, remoteKey); }
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
		const DEFAULT_TRIPLE_PRESS_DELAY_TIME = 800; // default, in case config missing

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
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).arrowUpButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).arrowUpButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).arrowUpButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowDown";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).arrowDownButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).arrowDownButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).arrowDownButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowLeft";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).arrowLeftButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).arrowLeftButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).arrowLeftButtonTripleTap;
				break;

			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyNameLayer[DEFAULT_KEYNAME] = "ArrowRight";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).arrowRightButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).arrowRightButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).arrowRightButtonTripleTap;
				break;

			case Characteristic.RemoteKey.SELECT: // 8
				keyNameLayer[DEFAULT_KEYNAME] = "Enter";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).selectButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).selectButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).selectButtonTripleTap;
				break;

			case Characteristic.RemoteKey.BACK: // 9
			case Characteristic.RemoteKey.EXIT: // 10 
				// both BACK and EXIT are handled the same
				keyNameLayer[DEFAULT_KEYNAME] = "Escape";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).backButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).backButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).backButtonTripleTap;
				break;

			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				keyNameLayer[DEFAULT_KEYNAME] = "MediaPlayPause";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).playPauseButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).playPauseButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).playPauseButtonTripleTap;
				break;

			case Characteristic.RemoteKey.INFORMATION: // 15
				keyNameLayer[DEFAULT_KEYNAME] = "MediaTopMenu";
				keyNameLayer[SINGLE_TAP] = (configDevice || {}).infoButton;
				keyNameLayer[DOUBLE_TAP] = (configDevice || {}).infoButtonDoubleTap;
				keyNameLayer[TRIPLE_TAP] = (configDevice || {}).infoButtonTripleTap;
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
		var triplePressTime = this.config.triplePressTime || DEFAULT_TRIPLE_PRESS_DELAY_TIME; // default to DEFAULT_TRIPLE_PRESS_DELAY_TIME if nothing found


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
		if (keyNameLayer[SINGLE_TAP] == (keyNameLayer[DOUBLE_TAP] || keyNameLayer[SINGLE_TAP])) {
			// single and double press layers are the same, send immediately
			this.log.debug("%s: setRemoteKey: remoteKey %s, same single- and double-press layers, sending now", this.name, remoteKey);
			this.pendingKeyPress = -1; // clear any pending key press
			this.sendRemoteKeyPressAfterDelay = false;	// disable send after delay
			this.readyToSendRemoteKeyPress = true; // enable immediate send

			// check if this was a double-pressed key within the double-press time limit, and is for the same key
		} else if (lastPressTime[CURRENT_PRESS] - lastPressTime[PREVIOUS_PRESS] < doublePressTime && (this.pendingKeyPress == remoteKey)) {
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
			if (this.readyToSendRemoteKeyPress) {
				// send immediately
				this.log.debug('%s: setRemoteKey: sending key %s now', this.name, keyName);
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
					if (this.sendRemoteKeyPressAfterDelay) {
						this.log.debug('%s: setRemoteKey: setTimeout delay completed, sending %s', this.name, keyName);
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