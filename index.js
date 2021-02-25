'use strict';

// ****************** start of EOS settings

// name and version
const PLUGIN_NAME = 'homebridge-eosstb';
const PLATFORM_NAME = 'eosstb';
const PLUGIN_VERSION = '0.1.10';

// required node modules
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const mqtt = require('mqtt');  
const qs = require('qs')
//const _ = require('underscore');
const mqttClientId = makeId(30).toLowerCase();

const axios = require('axios').default;
axios.defaults.xsrfCookieName = undefined;

const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');


// create a new instance called axiosWS
// add withCredentials: true to ensure credential cookie support
// remove default header in axios that causes trouble with Telenet
const axiosWS = axios.create({
	withCredentials: true, // IMPORTANT!
});
delete axiosWS.defaults.headers.common["Accept"];

// setup the cookieJar
axiosCookieJarSupport(axiosWS);
const cookieJar = new tough.CookieJar();


// ++++++++++++++++++++++++++++++++++++++++++++
// eosstb config
// ++++++++++++++++++++++++++++++++++++++++++++

// different settop box names per country
const settopBoxName = {
    'at':     'Entertain Box 4K',
    'be-fr':  'Telenet TV-Box',
    'be-nl':  'Telenet TV-Box',
    'ch':     'UPC TV Box',
    'gb':     'Virgin Media 360',
    'nl':     'Mediabox Next (4K)'
};

// base url varies by country
const countryBaseUrlArray = {
    'at': 		'https://prod.oesp.magentatv.at/oesp/v4/AT/deu/web', // v3 and v4 works
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/fr/web',
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web', // v3 and v4 works
    'gb':       'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web',
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web'
};

// mqtt endpoints varies by country
const mqttUrlArray = {
    'at':		'wss://obomsg.prod.at.horizon.tv:443/mqtt',
    'be-fr':  	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'ch': 		'wss://obomsg.prod.ch.horizon.tv:443/mqtt',
    'gb':       'wss://obomsg.prod.gb.horizon.tv:443/mqtt',
    'nl': 		'wss://obomsg.prod.nl.horizon.tv:443/mqtt'
};

// profile url endpoints varies by country
// https://prod.spark.upctv.ch/deu/web/personalization-service/v1/customer/{household_id}/devices
const personalizationServiceUrlArray = {
    'at':		'https://prod.spark.magentatv.at/deu/web/personalization-service/v1/customer/{householdId}/profiles',
    'be-fr':  	'https://prod.spark.telenettv.be/fr/web/personalization-service/v1/customer/{householdId}/profiles',
    'be-nl': 	'https://prod.spark.telenettv.be/nld/web/personalization-service/v1/customer/{householdId}/profiles',
    'ch': 		'https://prod.spark.upctv.ch/eng/web/personalization-service/v1/customer/{householdId}/profiles',
    'gb':       'https://prod.spark.virginmedia.com/eng/web/personalization-service/v1/customer/{householdId}/profiles',
    'nl': 		'https://prod.spark.ziggogo.tv/nld/web/personalization-service/v1/customer/{householdId}/profiles'
};



// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
const GB_AUTH_URL = 'https://id.virginmedia.com/sign-in/?protocol=oidc';



// general constants
const NO_INPUT = 999; // an input id that does not exist. Must be > 0 as a uint32 is expected
const MAX_INPUT_SOURCES = 90; // max input services. Default = 90. Cannot be more than 97 (100 - all other services)
const STB_STATE_POLLING_INTERVAL_MS = 10000; // pollling interval in millisec. Default = 5000
const SESSION_WATCHDOG_INTERVAL_MS = 10000; // session watchdog interval in millisec. Default = 10000
const LOAD_CHANNEL_REFRESH_CHECK_INTERVAL_S = 60; // load all channels refresh check interval, in seconds. Default = 60
// session state constants
const sessionState = { NOT_CREATED: 0, LOADING: 1, LOGGING_IN: 2, AUTHENTICATING: 3, VERIFYING: 4, AUTHENTICATED: 5, CREATED: 6 };
const mediaState = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerState = ["OFF", "ON"];
Object.freeze(sessionState);
Object.freeze(mediaState);
Object.freeze(powerState);



// global variables (urgh)
// exec spawns child process to run a bash script
var exec = require("child_process").exec;

let mqttClient = {};
let myUpcUsername;
let myUpcPassword;

let mqttUsername;
let mqttPassword;

let deviceId;
let currentSessionState;
let mqttIsSubscribed;
let currentChannelId;
let currentPowerState;
let currentMediaState;
let targetMediaState;
let channelListExpiryDate;
let volDownLastKeyPress;
let Accessory, Characteristic, Service, Categories, UUID;

// used for request, to be deprecated
const sessionRequestOptions = {
	method: 'POST',
	uri: '',
	body: {
		username: myUpcUsername,
		password: myUpcPassword
	},
	json: true
};

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

// wait function
const wait=ms=>new Promise(resolve => setTimeout(resolve, ms)); 

// ++++++++++++++++++++++++++++++++++++++++++++
// eosstb config
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
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, eosstbPlatform, true);
};

class eosstbPlatform {
	// build the platform. Runs once on restart
	constructor(log, config, api) {
		// only load if configured
		if (!config || !Array.isArray(config.devices)) {
			log('No configuration found for %s', PLUGIN_NAME);
			return;
		}
		this.log = log;
		this.config = config;
		this.api = api;
		this.devices = config.devices || [];

		this.api.on('didFinishLaunching', () => {
			if (this.config.debugLevel > 0) {
				this.log.warn('API event: didFinishLaunching');
			}
			for (let i = 0, len = this.devices.length; i < len; i++) {
				let deviceName = this.devices[i];
				if (!deviceName.name) {
					this.log.warn('Device Name Missing')
				} else {
					new eosstbDevice(this.log, deviceName, this.api);
				}
			}
		});
	}

	configureAccessory(platformAccessory) {
		this.log.debug('configurePlatformAccessory');
	}

	removeAccessory(platformAccessory) {
		this.log.debug('removePlatformAccessory');
		this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
	}
}

class eosstbDevice {
	// build the device. Runs once on restart
	constructor(log, config, api) {
		this.log = log;
		this.api = api;
		this.config = config;

		// setup arrays
		this.name = this.config.name || settopBoxName[this.config.country]; // market specific box name as default
		this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.channelListAll = []; 		// all possible channels, including those not subscribe to. Normally much more than can fit in the Home app.
		this.channelListLoaded = [];	// loaded channels, as shown in the Home app. Limited to 96
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 96
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL
		this.profiles = [];				// all possible user profiles. Index 0 is the mandatory Shared Profile

		// set one of the three suitable accessory categories, see https://developers.homebridge.io/#/categories
		switch(this.config.accessoryCategory) {
			case 'television': case 'tv': case 'TV': case 'TELEVISION':
				this.accessoryCategory = Categories.TELEVISION;
				break;
			case 'receiver': case 'audio-receiver': case 'AUDIO_RECEIVER':
				this.accessoryCategory = Categories.AUDIO_RECEIVER;
				break;
			default:
				this.accessoryCategory = Categories.TV_SET_TOP_BOX;
		}

		//setup variables
		this.accessoryConfigured = false;	// true when the accessory is configured
		this.sessionCreated = false;		// true when the session is created
		this.mqttSessionActive = false;		// true when the mqtt session is active
		
		this.targetMediaState = Characteristic.TargetMediaState.STOP; // default until received by mqtt


		// initial states. Will be updated by mqtt message and code
		mqttIsSubscribed = false;
		currentSessionState = sessionState.NOT_CREATED;
		currentPowerState = Characteristic.Active.INACTIVE;
		currentChannelId = 'UNKNOWN';
		currentMediaState = Characteristic.CurrentMediaState.PLAY;
		targetMediaState = Characteristic.CurrentMediaState.PLAY;
		volDownLastKeyPress = [];


		//check if prefs directory ends with a /, if not then add it
		//this.prefDir = path.join(api.user.storagePath(), 'eos'); // not in use yet
		//not used yet
		/*
		if (this.prefDir.endsWith('/') === false) {
			this.prefDir = this.prefDir + '/';
		}

		//check if the directory exists, if not then create it
		if (fs.existsSync(this.prefDir) === false) {
			fs.mkdir(this.prefDir, { recursive: false }, (error) => {
				if (error) {
					this.log.error('Device: %s %s, create directory: %s, error: %s', this.name, this.prefDir, error);
				} else {
					this.log.debug('Device: %s %s, create directory successful: %s', this.name, this.prefDir);
				}
			});
		}
		*/


		// Configuration
		myUpcUsername = this.config.username || '';
		myUpcPassword = this.config.password || '';

		// use defaults of plugin/platform name & version
		// until device is discovered
		this.householdId = '';
		this.manufacturer = this.config.manufacturer || PLUGIN_NAME;
		this.modelName = this.config.modelName || this.stbType || PLATFORM_NAME;
		this.serialNumber = this.config.serialNumber || this.physicalDeviceId || 'unknown';
		this.firmwareRevision = this.config.firmwareRevision || PLUGIN_VERSION; // must be numeric. Non-numeric values are not displayed
		this.apiVersion = ''; // not used

		// prepare the accessory
		this.prepareAccessory();

		// the session watchdog creates a session when none exists, and recreates one if it ever fails
		// retry every few seconds in case the session ever fails due to no internet or an error
		this.checkSessionInterval = setInterval(this.sessionWatchdog.bind(this),SESSION_WATCHDOG_INTERVAL_MS);
		
		// update device state regularly
		// Check & Update Accessory Status every STB_STATE_POLLING_INTERVAL_MS (Default: 5000 ms)
		// this is the last step in the setup. From now on polling will occur every 5 seconds
		//this.checkStateInterval = setInterval(this.updateDeviceState.bind(this),STB_STATE_POLLING_INTERVAL_MS);

		// refresh channel list every x seconds as channel lists do not change often
		// need to change this to setTimeout allows us to run a function once after the interval of time.
		// setTimeout(sayHi, 1000); 1000 = The delay before run, in milliseconds (1000 ms = 1 second), by default 0.
		this.checkChannelInterval = setInterval(this.loadChannelListAll.bind(this),LOAD_CHANNEL_REFRESH_CHECK_INTERVAL_S * 1000);

	}


	sessionWatchdog() {
		// the session watchdog creates a session when none exists
		// runs every few seconds. 
		// If session exists: Exit immediately
		// If no session exists: prepares the session, then prepares the device
		if (this.config.debugLevel > 2) {
			this.log.warn('sessionWatchdog');
		}

		// exit immediately if session has any state other than NOT_CREATED
		if (currentSessionState !== sessionState.NOT_CREATED) { return; }

		// create a session, session type varies by country
		switch(this.config.country) {
			case 'be-nl': case 'be-fr':
				this.log('sessionWatchdog: calling getSessionBE');
				this.getSessionBE(); break;
			case 'gb':
				this.getSessionGB(); break;
			default:
				this.getSession();
		}




		// prepare the accessory using the data found during the session
		//this.prepareAccessory();


		// async wait a few seconds session to load, then continue
		// capture all accessory loading errors
		wait(4*1000).then(() => { 

			// only continue if a session was created
			if (!this.sessionCreated) { return; }

			if (this.config.debugLevel > 2) {
				this.log.warn('Session data retrieved from Session',this.sessionData);
			}
			// timeToIdleSeconds: 7200, // should use this for session control

			/*
			// use defaults of plugin/platform name & version
			// override with device details when loaded
			// allow user to override with config if he wants
			this.householdId = '';
			this.manufacturer = this.config.manufacturer || PLUGIN_NAME;
			this.modelName = this.config.modelName || this.stbType || PLATFORM_NAME;
			this.serialNumber = this.config.serialNumber || this.physicalDeviceId || 'unknown';
			this.firmwareRevision = this.config.firmwareRevision || PLUGIN_VERSION; // must be numeric. Non/numeric values are not displayed
			this.apiVersion = ''; // not used

			// prepare the accessory using the data found during the session
			this.prepareAccessory();
			*/

			// perform an initial load of all channels and set the initial device state
			this.loadChannelListAll();
			this.getUiStatus();
			this.updateDeviceState();



		}).catch((error) => { 
			this.log('Failed to create accessory - please enable Homebridge debugging to view all errors.');
			this.log.error("Error waiting for session",error); 
		});

	}


  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	//Prepare accessory (runs from session watchdog)
	prepareAccessory() {
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareAccessory');
		}

		// exit immediately if already configured (runs from session watchdog)
		if (this.accessoryConfigured) { return }

		const accessoryName = this.name;
		const accessoryUUID = UUID.generate(accessoryName);
		const accessoryCategory = this.accessoryCategory;
		this.accessory = new Accessory(accessoryName, accessoryUUID, accessoryCategory);

		// counld I add a contact sensor to give notifications: Roomname Devicename  Control Session was opened/closed
		this.prepareAccessoryInformationService();	// service 1 of 100
		this.prepareTelevisionService();			// service 2 of 100
		this.prepareTelevisionSpeakerService();		// service 3 of 100
		//this.prepareSmartSpeakerService();		// service 4 of 100 EXPERIMENTAL		
		this.prepareInputSourceServices();			// service 4...100 of 100

		this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
		this.accessoryConfigured = true;
	}


	//Prepare AccessoryInformation service
	prepareAccessoryInformationService() {
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareAccessoryInformationService');
		}

		this.accessory.removeService(this.accessory.getService(Service.AccessoryInformation));
		const informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.modelName)
			.setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
			.setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision)

		this.accessory.addService(informationService);
	}

	//Prepare Television service
	prepareTelevisionService() {
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareTelevisionService');
		}
		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService.setCharacteristic(Characteristic.ConfiguredName, this.name);
		this.televisionService.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

		this.televisionService.getCharacteristic(Characteristic.Active)
			.on('get', this.getPower.bind(this))
			.on('set', this.setPower.bind(this));

		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInput.bind(this))
			.on('set', (inputIdentifier, callback) => {
				this.setInput(this.channelListLoaded[inputIdentifier], callback);
			});

		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));

		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		this.televisionService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (mediaState, callback) => {
				this.setTargetMediaState(mediaState, callback);
			});

		this.accessory.addService(this.televisionService);
	}

	//Prepare TelevisionSpeaker service
	prepareTelevisionSpeakerService() {
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareTelevisionSpeakerService');
		}
		this.speakerService = new Service.TelevisionSpeaker(this.name + ' Speaker', 'speakerService');
		this.speakerService
			.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
		this.speakerService.getCharacteristic(Characteristic.VolumeSelector)  // the volume selector allows the iOS device keys to be used to change volume
			.on('set', (direction, callback) => { this.setVolume(direction, callback); });
		this.speakerService.getCharacteristic(Characteristic.Volume)
			//.on('get', this.getVolume.bind(this)) // not supported by most TVs, this plugin uses relative volume only
			.on('set', this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
			//.on('get', this.getMute.bind(this)) // not supported by most TVs, this plugin uses mute toggle only
			.on('set', this.setMute.bind(this));

		this.accessory.addService(this.speakerService);
		this.televisionService.addLinkedService(this.speakerService);
	}
	
	//Prepare SmartSpeaker service
	prepareSmartSpeakerService() {
		// EXPERIMENTAL: can I use this to receive siri commands to Play and Pause?
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareTelevisionSpeakerService');
		}
		this.smartSpeakerService = new Service.SmartSpeaker(this.name + ' SmartSpeaker', 'speakerService');
		this.smartSpeakerService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		this.smartSpeakerService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (wantedMediaState, callback) => {
				this.setTargetMediaState(wantedMediaState, callback);
			});

		this.accessory.addService(this.smartSpeakerService);
		this.televisionService.addLinkedService(this.smartSpeakerService);
	}

	//Prepare InputSource services
	prepareInputSourceServices() {
		// This is the channel list, each input is a service, max 100 services less the services created so far
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareInputSourceServices');
		}
		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// absolute max 99 services (less those already loaded)
		// robustness: hard limit to 96 (channels 0...95) in case user does a stupid config
		let maxSources = Math.min(this.config.maxChannels || MAX_INPUT_SOURCES, MAX_INPUT_SOURCES, 96);
		for (let i = 0; i < maxSources; i++) {
			if (this.config.debugLevel > 2) {
				this.log.warn('prepareInputSourceServices Adding service',i);
			}

			this.inputService = new Service.InputSource(i, `inputSource_${i}`);

			this.inputService
				// setup the input source as not configured and hidden initially until loaded by ????
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.ConfiguredName, `Input ${i < 9 ? `0${i + 1}` : i + 1}`) // store Input 01...Input 99.
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TUNER)
				//.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TUNER)
				.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.NOT_CONFIGURED) // initially not configured NOT_CONFIGURED. Testing with CONFIGURED
				.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDDEN) // SHOWN or HIDDDEN
				//.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			this.inputService
				.getCharacteristic(Characteristic.ConfiguredName)
				.on('set', (value, callback) => {
					// fired by the user changing a channel name in Home app accessory setup
					// we cannot handle this as we don't know which channel got renamed, as a user can change them all to the same name
					this.setInputName(value, callback);
					//callback(null);
				});

			this.inputServices.push(this.inputService);
			this.configuredInputs.push(this.inputService); // used to store user-vonfigured inputs (renamed))
			this.accessory.addService(this.inputService);
			this.televisionService.addLinkedService(this.inputService);

		} // end of for loop getting the inputSource
	}
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++




  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler (web and mqtt)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++



	// get session (new)
	async getSession() {
		// a new version of getSession, not yet active
		if (this.config.debugLevel > 0) {
			this.log.warn('getSession');
		}
		this.log('Creating %s session...',PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;

		const axiosConfig = {
			method: 'POST',
			url: countryBaseUrlArray[this.config.country].concat('/session'),
			jar: cookieJar,
			data: {
				'username':this.config.username,
				'password':this.config.password
			}
		};

		// robustness: fail if url missing
		if (!axiosConfig.url) {
			this.log.warn('getSession: axiosConfig.url empty!');
			currentSessionState = sessionState.NOT_CREATED;
			return false;						
		}
		
		axiosWS(axiosConfig)
			.then(response => {	
				//this.log('getSession response',response.status, response.statusText);
				//this.log('getSession: response',response);

				// get device data from the session
				this.sessionData = response.data;
				this.customer = response.data.customer;
				//this.log('getSession: 3 customer',this.customer);
				this.householdId = response.data.customer.householdId;
				this.stbType = response.data.customer.stbType;
				this.smartCardId = response.data.customer.smartCardId;
				this.physicalDeviceId = response.data.customer.physicalDeviceId;
				deviceId = response.data.customer.physicalDeviceId;
				if (response.data.customer.physicalDeviceId) {
					currentSessionState = sessionState.AUTHENTICATED;
				}

				if (this.config.debugLevel > 2) {
					this.log.warn('getSession: response.data.customer',response.data.customer);			
				}

				// get the Jwt Token
				this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
				this.log('Session created');
				this.sessionCreated = true
				currentSessionState = sessionState.CREATED;
				return true;
			})
			.catch(error => {
				currentSessionState = sessionState.NOT_CREATED;
				this.sessionCreated = false;
				if (!error.response) {
					this.log('Failed to create session - check your internet connection.');
				} else if (error.response.status == 400) {
					this.log('Failed to create session - check your %s %s username and password.',this.config.name,PLATFORM_NAME);
					this.log.debug('getSession: Failed to create session: error.response.statusText:',error.response.status,error.response.statusText);
				}
				this.log.debug('getSession: Failed to create session: error:',error);
				return false;
			});		
		currentSessionState = sessionState.NOT_CREATED;
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
		axios.interceptors.request.use(req => {
			this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
			'\nMethod:',req.method, '\nURL:', req.url, 
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers, '\nWithCredentials:', req.withCredentials, 
			//'\nParams:', req.params, '\nData:', req.data
			);
			this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
			return req; // must return request
		});
		axios.interceptors.response.use(res => {
			this.log('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
			'\nHeaders:', res.headers, 
			//'\nData:', res.data, 
			//'\nLast Request:', res.request
			);
			this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
			return res; // must return response
		});
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


		// Step 1: # get authentication details
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country] + '/authorization';
		this.log.warn('Step 1: get authentication details from',apiAuthorizationUrl);
		axiosWS.get(apiAuthorizationUrl)
			.then(response => {	
				this.log.warn('Step 1 got apiAuthorizationUrl response');
				this.log('Step 1 response.status:',response.status, response.statusText);
				
				// get the data we need for further steps
				let auth = response.data;
				let authState = auth.session.state;
				let authAuthorizationUri = auth.session.authorizationUri;
				let authValidtyToken = auth.session.validityToken;

				// Step 2: # follow authorizationUri to get AUTH cookie
				this.log.warn('Step 2 get AUTH cookie from',authAuthorizationUri);
				axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						// unsure what minimum headers will here
						headers: {
							Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
						},
					})
					.then(response => {	
						this.log('Step 2 response.status:',response.status, response.statusText);
		
						// Step 3: # login
						this.log.warn('Step 3 post login to',BE_AUTH_URL);
						currentSessionState = sessionState.LOGGING_IN;
						//this.log('Cookies for the auth url:',cookieJar.getCookies(BE_AUTH_URL));
						var payload = qs.stringify({
							j_username: this.config.username,
							j_password: this.config.password,
							rememberme: 'true'
						});
						axiosWS.post(BE_AUTH_URL,payload,{
							jar: cookieJar,
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
								},
							})
							.then(response => {	
								this.log('Step 3 response.status:',response.status, response.statusText);
								this.log('Step 3 response.headers.location:',response.headers.location); 
								//this.log('Step 3 response.headers:',response.headers);
								var url = response.headers.location;
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionBE: Step 3: location url empty!');
									currentSessionState = sessionState.NOT_CREATED;
									return false;						
								}

								//location is https://login.prd.telenet.be/openid/login?response_type=code&state=... if success
								//location is https://login.prd.telenet.be/openid/login?authentication_error=true if not authorised
								//location is https://login.prd.telenet.be/openid/login?error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 Unable to login: wrong credentials');
								} else if (url.indexOf('error=session_expired') > 0 ) {
									this.log.warn('Step 3 Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									this.sessionCreated = false;	// flag the session as dead
								} else {
									this.log.warn('Step 3 login successful');

									// Step 4: # follow redirect url
									this.log.warn('Step 4 follow redirect url');
									this.log('Cookies for the redirect url:',cookieJar.getCookies(url));
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 response.status:',response.status, response.statusText);
											this.log('Step 4 response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('getSessionBE: Step 4: location url empty!');
												currentSessionState = sessionState.NOT_CREATED;
												return false;						
											}

											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 Unable to login: wrong credentials');
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												this.sessionCreated = false;	// flag the session as dead
											} else {

												// Step 5: # obtain authorizationCode
												this.log.warn('Step 5 extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionBE: Step 5: location url empty!');
													currentSessionState = sessionState.NOT_CREATED;
													return false;						
												}
	
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log.warn('Step 6 post auth data to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													this.log('Cookies for the session:',cookieJar.getCookies(apiAuthorizationUrl));
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 response.status:',response.status, response.statusText);
																
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															this.log('Step 6 refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log.warn('Step 7 post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country].concat('/session');
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 response.status:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																	this.log.warn('Successfully authenticated'); 
																		
																	this.log('Step 7 response.headers:',response.headers); 
																	this.log('Step 7 response.data:',response.data); 
																	this.log('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.customer = response.data.customer;
																	this.householdId = response.data.customer.householdId;
																	this.stbType = response.data.customer.stbType;
																	this.smartCardId = response.data.customer.smartCardId;
																	this.physicalDeviceId = response.data.customer.physicalDeviceId;
																	deviceId = response.data.customer.physicalDeviceId;
																	if (response.data.customer.physicalDeviceId) {
																		currentSessionState = sessionState.AUTHENTICATED;
																	}

																	// now get the Jwt token
																	// all subscriber data is in the response.data.customer
																	// can get smartCardId, physicalDeviceId, stbType, and more
																	this.log('Getting jwtToken for householdId',response.data.customer.householdId);
																	this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
																	currentSessionState = sessionState.CREATED;
																	this.log('Session created');
																	return false;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 Unable to get OESP token, http error:",error);
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 Unable to authorize with oauth code, http error:",error);
														});	
													};
												};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 Unable to oauth authorize, http error:",error);
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 Unable to login, http error:",error);
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 Could not get authorizationUri, http error:",error);
					});
			})
			// Step 1 http errors
			.catch(error => {
				currentSessionState = sessionState.NOT_CREATED;
				this.sessionCreated = false;
				this.log('Failed to create BE session - check your internet connection.');
				this.log.warn("Step 1 Could not get apiAuthorizationUrl, http error:",error);
			});

		currentSessionState = sessionState.NOT_CREATED;
		this.log.warn('end of getSessionBE, no session created');
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
		axiosWS.interceptors.request.use(req => {
			this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
			'\nMethod:',req.method, '\nURL:', req.url, 
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers, '\nWithCredentials:', req.withCredentials, 
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
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++



		// Step 1: # get authentication details
		// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country] + '/authorization';
		this.log.warn('Step 1: get authentication details from',apiAuthorizationUrl);
		axiosWS.get(apiAuthorizationUrl)
			.then(response => {	
				this.log.warn('Step 1 got apiAuthorizationUrl response');
				this.log('Step 1 response.status:',response.status, response.statusText);
				
				// get the data we need for further steps
				let auth = response.data;
				let authState = auth.session.state;
				let authAuthorizationUri = auth.session.authorizationUri;
				let authValidtyToken = auth.session.validityToken;
				this.log.warn('Step 1 results: authState',authState);
				this.log.warn('Step 1 results: authAuthorizationUri',authAuthorizationUri);
				this.log.warn('Step 1 results: authValidtyToken',authValidtyToken);

				// Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
				this.log.warn('Step 2 get AUTH cookie from',authAuthorizationUri);
				axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						ignoreCookieErrors: true // ignore the error triggered by the Domain=mint.dummydomain cookie
					})
					.then(response => {	
						this.log('Step 2 response.status:',response.status, response.statusText);
		
						// Step 3: # login
						this.log.warn('Step 3 post login to',GB_AUTH_URL);
						//this.log('Cookies for the auth url:',cookieJar.getCookies(GB_AUTH_URL));
						currentSessionState = sessionState.LOGGING_IN;
						// +++++++++++need to form payload here properly
						var payload = qs.stringify({
							username: this.config.username,
							credential: this.config.password
						});
						axiosWS.post(GB_AUTH_URL,payload,{
							jar: cookieJar,
							ignoreCookieErrors: true, // ignore the error triggered by the Domain=mint.dummydomain cookie
							params: qs.stringify({
								protocol: 'oidc',
								rememberme: 'true'
							}),
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
								},
							})
							.then(response => {	
								this.log('Step 3 response.status:',response.status, response.statusText);
								this.log('Step 3 response.headers.location:',response.headers.location); 
								//this.log('Step 3 response.headers:',response.headers);
								var url = response.headers.location;
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionGB: Step 3: location url empty!');
									currentSessionState = sessionState.NOT_CREATED;
									return false;						
								}								
								//location is h??=... if success
								//location is https?? if not authorised
								//location is https:... error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 Unable to login, wrong credentials');
								} else if (url.indexOf('error=session_expired') > 0 ) { // >0 if found
									this.log.warn('Step 3 Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									this.sessionCreated = false;	// flag the session as dead
								} else {
									this.log.warn('Step 3 login successful');

									// Step 4: # follow redirect url
									this.log.warn('Step 4 follow redirect url');
									this.log('Cookies for the redirect url:',cookieJar.getCookies(url));
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 response.status:',response.status, response.statusText);
											this.log('Step 4 response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('getSessionGB: Step 4: location url empty!');
												currentSessionState = sessionState.NOT_CREATED;
												return false;						
											}								
			
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 Unable to login: wrong credentials');
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												this.sessionCreated = false;	// flag the session as dead
											} else {

												// Step 5: # obtain authorizationCode
												this.log.warn('Step 5 extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 5: location url empty!');
													currentSessionState = sessionState.NOT_CREATED;
													return false;						
												}								
				
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log.warn('Step 6 post auth data to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													this.log('Cookies for the session:',cookieJar.getCookies(apiAuthorizationUrl));
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 response.status:',response.status, response.statusText);
															
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															this.log('Step 6 refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log.warn('Step 7 post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country].concat('/session');
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 response.status:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																	this.log.warn('Successfully authenticated'); 
																	
																	this.log('Step 7 response.headers:',response.headers); 
																	this.log('Step 7 response.data:',response.data); 
																	this.log('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.customer = response.data.customer;
																	this.householdId = response.data.customer.householdId;
																	this.stbType = response.data.customer.stbType;
																	this.smartCardId = response.data.customer.smartCardId;
																	this.physicalDeviceId = response.data.customer.physicalDeviceId;
																	deviceId = response.data.customer.physicalDeviceId;
																	if (response.data.customer.physicalDeviceId) {
																		currentSessionState = sessionState.AUTHENTICATED;
																	}

																	// now get the Jwt token
																	// all subscriber data is in the response.data.customer
																	// can get smartCardId, physicalDeviceId, stbType, and more
																	this.log('Getting jwtToken for householdId',response.data.customer.householdId);
																	this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
																	currentSessionState = sessionState.CREATED;
																	this.log('Session created');
																	return false
													
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 Unable to get OESP token, http error:",error);
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 Unable to authorize with oauth code, http error:",error);
														});	
												};
											};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 Unable to oauth authorize, http error:",error);
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 Unable to login, http error:",error);
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 Could not get authorizationUri, http error:",error);
					});
			})
			// Step 1 http errors
			.catch(error => {
				currentSessionState = sessionState.NOT_CREATED;
				this.sessionCreated = false;
				this.log('Failed to create GB session - check your internet connection.');
				this.log.warn("Step 1 Could not get apiAuthorizationUrl, http error:",error);
			});

		currentSessionState = sessionState.NOT_CREATED;
		this.log.warn('end of getSessionGB, no session created');
	}



	// get a Java Web Token
	getJwtToken(oespToken, householdId){
		// get a JSON web token from the supplied oespToken and householdId
		if (this.config.debugLevel > 0) {
			this.log.warn('getJwtToken');
		}
		// robustness checks
		if (currentSessionState !== sessionState.AUTHENTICATED) {
			this.log.warn('Cannot get JWT token: currentSessionState incorrect:', currentSessionState);
			return false;
		}
		if (!oespToken) {
			this.log.warn('Cannot get JWT token: oespToken not set');
			return false;
		}

		const jwtAxiosConfig = {
			method: 'GET',
			url: countryBaseUrlArray[this.config.country].concat('/tokens/jwt'),
			headers: {
				'X-OESP-Token': oespToken,
				'X-OESP-Username': myUpcUsername
			}
		};

		axiosWS(jwtAxiosConfig)
			.then(response => {	
				mqttUsername = householdId;
				mqttPassword = response.data.token;
				if (this.config.debugLevel > 0) {
					this.log.warn('getJwtToken: calling startMqttClient');
				}
				this.startMqttClient(this);  // this starts the mqtt session
			})
			.catch(error => {
				this.log.warn('getJwtToken error:', error);
				return false;
			});			
	}


	// start the mqtt client and handle mqtt messages
	startMqttClient(parent) {
		this.log('Starting mqttClient...');
		if (currentSessionState !== sessionState.CREATED) {
			this.log.warn('Cannot start mqttClient: currentSessionState incorrect:', currentSessionState);
			return false;
		}

		let mqttUrl = mqttUrlArray[this.config.country];

		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: mqttClientId,
			username: mqttUsername,
			password: mqttPassword
		});

		// mqtt client event: connect
		mqttClient.on('connect', function () {
			parent.log('mqttClient: Connected');

			// subscribe to householdId/personalizationService
			//do not think we need this....
			// https://prod.spark.upctv.ch/eng/web/personalization-service/v1/customer/1076582_ch/profiles
			parent.mqttSubscribeToTopic(mqttUsername + '/personalizationService');
			//parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus');
			//parent.mqttSubscribeToTopic(mqttUsername + '/recordingStatus/lastUserAction');
			//parent.mqttSubscribeToTopic(mqttUsername + '/purchaseService');

			// subscribe to householdId, how to handle errors?
			parent.mqttSubscribeToTopic(mqttUsername, function (err) {
				if(err){
					parent.log('mqttClient subscribe error caught, exiting');
					return true;
				}
			});
			// subscribe to householdId/+/status
			// get status of all devices from this householdId, including type HGO (web browser)
			parent.mqttSubscribeToTopic(mqttUsername + '/+/status');
			//parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings');
			//parent.mqttSubscribeToTopic(mqttUsername + '/+/localRecordings/capacity');

			// initiate the cpe connection
			parent.mqttInitiateCpeConnection();
			
			// mqtt client event: message received
			mqttClient.on('message', function (topic, payload) {
				// many messages occur. Be careful with logging otherwise logs will be flooded
				this.mqttSessionActive = true;
				let mqttMessage = JSON.parse(payload);
				if (parent.config.debugLevel > 0) {
					parent.log.warn('mqttClient: Received Message: \r\nTopic: %s\r\nMessage: \r\n%s',topic,mqttMessage);
				}
				
				// check if mqttMessage.deviceType exists
				// multiple devices can exist!
				if (mqttMessage.deviceType) {
					// got some deviceType, mqtt is running, subscribe once onlz
					if (mqttIsSubscribed == false) {

						// subscribe to our own generated unique householdId/mqttClientId and everything for our box
						parent.mqttSubscribeToTopic(mqttUsername + '/' + mqttClientId);
						// subscribe to our householdId/deviceId
						parent.mqttSubscribeToTopic(mqttUsername + '/' + deviceId);
						// subscribe to our householdId/deviceId/status
						parent.mqttSubscribeToTopic(mqttUsername + '/' + deviceId + '/status');

						// try again
						parent.getUiStatus();

						mqttIsSubscribed = true;

					}
				}
				

				// check if topic is personalizationService. if so, update profile channels
				// Topic: Topic: 1076582_ch/personalizationService
				// Message: { action: 'OPS.getProfilesUpdate', source: '3C36E4-EOSSTB-003656579806' }
				if (topic.includes(mqttUsername + '/personalizationService')) {
					if (mqttMessage.action == 'OPS.getProfilesUpdate') { 			// a change happened to the profile
						parent.log('mqttClient: got OPS.getProfilesUpdate, calling getProfilesUpdate');
						parent.log("startMqttClient: on message: calling getProfilesUpdate");
						parent.getProfilesUpdate();									// update the profile
						parent.getUiStatus();

					}
				}

				
				// check if mqttMessage.deviceType = STB, make sure it is for the wanted deviceId
				// Topic: 1076582_ch/3C36E4-EOSSTB-003656579806/status
				// Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-003656579806","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
				if (topic.includes(deviceId + '/status')) {
					parent.log.debug('mqttClient: Detecting Power State: Received Message of deviceType %s for %s', mqttMessage.deviceType, mqttMessage.source);
					if (mqttMessage.state == 'ONLINE_RUNNING') { 				// ONLINE_RUNNING: power is on
						currentPowerState = Characteristic.Active.ACTIVE; 
					} else { 													// default off for ONLINE_STANDBY or OFFLINE
						currentPowerState = Characteristic.Active.INACTIVE;
					}
				}

				
				// check if mqttMessage.type exists, look for CPE.uiStatus, make sure it is for the wanted deviceId
				// type exists in Topic: 1076582_ch/jrtmev583ijsntldvrk1fl95c6nrai
				// CPE.uiStatus shows us the currently selected channel on the stb, and occurs in many topics
				// Topic: 1076582_ch/vy9hvvxo8n6r1t3f4e05tgg590p8s0
				// Message: {"version":"1.3.10","type":"CPE.uiStatus","source":"3C36E4-EOSSTB-003656579806","messageTimeStamp":1607205483257,"status":{"uiStatus":"mainUI","playerState":{"sourceType":"linear","speed":1,"lastSpeedChangeTime":1607203130936,"source":{"channelId":"SV09259","eventId":"crid:~~2F~~2Fbds.tv~~2F394850976,imi:3ef107f9a95f37e5fde84ee780c834b502be1226"}},"uiState":{}},"id":"fms4mjb9uf"}
				if (parent.config.debugLevel > 1) {
					parent.log.debug('mqttClient: Detecting: Message.type %s Message.source %s', mqttMessage.type, mqttMessage.source);
				}
				if ((mqttMessage.type == 'CPE.uiStatus') && (mqttMessage.source == deviceId)) {
					parent.log.debug('mqttClient: Detecting currentChannelId: Received Message of deviceType %s for %s. Message type %s', mqttMessage.deviceType, mqttMessage.source, mqttMessage.type);
					if (parent.config.debugLevel > 1) {
						parent.log.warn('mqttClient: mqttMessage.status',mqttMessage.status);
					}
					if (mqttMessage.status.uiStatus == 'mainUI') {
						// grab the status part of the mqttMessage object as we cannot go any deeper with json
						let playerState = mqttMessage.status.playerState;
						if (parent.config.debugLevel > 0) {
							parent.log('mqttClient: Detected mqtt playerState.speed:', playerState.speed);
						}

						// get playerState.speed (shows if playing or paused)
						// speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
						if (parent.televisionService) {
							if (playerState.speed == 0) { 			// speed 0 is PAUSE
								currentMediaState = Characteristic.CurrentMediaState.PAUSE;
							} else if (playerState.speed == 1) { 	// speed 1 is PLAY
								currentMediaState = Characteristic.CurrentMediaState.PLAY;
							} else {								// default for all speeds (-64 -30 -6 2 6 30 64) is LOADING
								currentMediaState = Characteristic.CurrentMediaState.LOADING;
							}
						}

						// get channelId (current playing channel)
						if (playerState) {
							currentChannelId = playerState.source.channelId;
							if (parent.config.debugLevel > 0) {
								parent.log('mqttClient: Detected mqtt channelId: %s', currentChannelId);
							}
						}
					}
				}

				// call a UI update on every mqtt message received
				parent.updateDeviceState();
				
			}); // mqtt client event: message received

			// mqtt client event: error
			mqttClient.on('error', function(err) {
				parent.log.error('mqttClient: Error:', err);
				mqttClient.end();
				return false;
			}); // end of mqtt client event: error

			// mqtt client event: disconnect
			mqttClient.on('disconnect', function () {
				parent.log('mqttClient: Disconnected');
			});
			
			// mqtt client event: close
			mqttClient.on('close', function () {
				parent.log.warn('mqttClient: Connection closed');
				mqttClient.end();
				this.mqttSessionActive = false;
				return false;
			});
		}); // end of mqttClient.on('connect' ...

	} // end of startMqttClient


	// publish an mqtt message, with logging, to help in debugging
	mqttPublishMessage(Topic,Message,Options) {
		// Syntax: {'test1': {qos: 0}, 'test2': {qos: 1}}
		if (this.config.debugLevel > 0) {
			this.log.warn('mqttClient: Publish Message:\r\nTopic: %s\r\nMessage: %s\r\nOptions: %s', Topic, Message, Options);
		}
		if (mqttIsSubscribed = true) {
			mqttClient.publish(Topic, Message, Options)
		}
	}

	// subscribe to an mqtt message, with logging, to help in debugging
	mqttSubscribeToTopic(Topic,Qos) {
		this.log('mqttClient: Subscribe to topic:',Topic);
		mqttClient.subscribe(Topic, function (err) {
			if(err){
				this.log('mqttClient connect: subscribe to %s Error %s:',Topic,err);
				return true;
			}
		});
	}

	// initiate mqtt cpe session
	mqttInitiateCpeConnection() {
		if (this.config.debugLevel > 0) {
			this.log.warn('mqttInitiateCpeConnection');
		}
		if (mqttUsername) {
			this.mqttPublishMessage(
			mqttUsername + '/' + mqttClientId + '/status', 
			'{"source":"' +  mqttClientId + '","state":"ONLINE_RUNNING","deviceType":"HGO"}',
			'{"qos":"1","retain":"true"}'
			);
		}
	}

	// send a channel change request to the settopbox via mqtt
	switchChannel(channelId) {
		if (this.config.debugLevel > 0) {
			this.log.warn('switchChannel channelId:', channelId);
		}
		if (mqttUsername) {
			this.mqttPublishMessage(
			mqttUsername + '/' + deviceId, 
			'{"id":"' + makeId(10) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId + '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' + channelId + '"},"relativePosition":0,"speed":1}}',
			'{"qos":"0"}'
			);
		}
	}

	// set the media state of the settopbox via mqtt
	setMediaState(channelId, speed) {
		if (this.config.debugLevel > 0) {
			this.log.warn('switchChannel channelId:', channelId);
		}
		if (mqttUsername) {
			this.mqttPublishMessage(
			mqttUsername + '/' + deviceId, 
			'{"id":"' + makeId(10) + '","type":"CPE.pushToTV","source":{"clientId":"' + mqttClientId 
			+ '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' 
			+ channelId + '"},"relativePosition":0,"speed":' + speed + '}}',
			'{"qos":"0"}'
			);
		}
	}
	// send a remote control keypress to the settopbox via mqtt
	sendKey(keyName) {
		if (this.config.debugLevel > 0) {
			this.log.warn('sendKey keyName:', keyName);
		}
		if (mqttUsername) {
			this.log('Send key:', keyName);
			this.mqttPublishMessage(
				mqttUsername + '/' + deviceId, 
				'{"id":"' + makeId(10) + '","type":"CPE.KeyEvent","source":"' + mqttClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}',
				'{"qos":"0"}'
			);
		}
		
	}


	// get the settopbox UI status from the settopbox via mqtt
	// this needs to run regularly
	getUiStatus() {
		// this connects us to the settop box, and must be the first mqtt message
		// gets called at every mqtt uistatus message
		if (this.config.debugLevel > 1) {
			this.log.warn('getUiStatus');
			this.log.warn('getUiStatus deviceId %s mqttClientId %s',deviceId,mqttClientId);
		}
		if (mqttUsername) {
			var mqttTopic = mqttUsername + '/' + deviceId;
			var mqttMessage =  '{"id":"' + makeId(10).toLowerCase() + '","type":"CPE.getUiStatus","source":"' + mqttClientId + '"}';
			this.mqttPublishMessage(
				mqttUsername + '/' + deviceId,
				'{"id":"' + makeId(10).toLowerCase() + '","type":"CPE.getUiStatus","source":"' + mqttClientId + '"}',
				'{"qos"":"1"}'
			);
		}
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler (web and mqtt)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++





	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state changed to async
	async updateDeviceState(callback) {
		// runs at the very start, and then every few seconds, so don't log it unless debugging
		// doesn't get the data direct from the settop box, but rather: gets it from the currentPowerState and currentChannelId variables
		// which are received by the mqtt messages, which occurs very often
		if (this.config.debugLevel > 1) {
			this.log.warn('updateDeviceState: currentPowerState: %s currentChannelId: %s currentMediaState: %s %s', 
				currentPowerState, currentChannelId, currentMediaState, mediaState[currentMediaState]
			);
		}

		// only continue if a session was created. If the internet conection is doen then we have no session
		if (!this.sessionCreated) { return null; }

		// change only if configured, and update only if changed
		if (this.televisionService) {

			// set power state if changed
			var oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
			if (oldPowerState !== currentPowerState) {
				this.log('Power changed from %s %s to %s %s', 
					oldPowerState, powerState[oldPowerState],
					currentPowerState, powerState[currentPowerState]);
				this.televisionService.getCharacteristic(Characteristic.Active).updateValue(currentPowerState);
			}
			
			// set active channel if changed
			var oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
			var currentActiveIdentifier = this.channelListLoaded.findIndex(channel => channel.channelId === currentChannelId);
			if (currentActiveIdentifier == -1) { currentActiveIdentifier = NO_INPUT } // if nothing found, set to NO_INPUT to clear the name from the Home app tile
			if (oldActiveIdentifier !== currentActiveIdentifier) {
				// get names from loaded channel list. Using Ch Up/Ch Down buttons on the remote rolls around the profile channel list
				// what happens if the TV is change to another profile?
				var oldName, newName;
				if (oldActiveIdentifier == NO_INPUT) {
					oldName = 'UNKNOWN';
				} else {
					oldName = this.channelListLoaded[oldActiveIdentifier].channelName
				}
				if (currentActiveIdentifier == NO_INPUT) {
					newName = 'UNKNOWN';
				} else {
					newName = this.channelListLoaded[currentActiveIdentifier].channelName
				}
				this.log('Channel changed from %s %s to %s %s', 
					oldActiveIdentifier + 1, oldName,
					currentActiveIdentifier + 1, newName);
				this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
			}

			// set current media state if changed
			var oldMediaState = this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).value;
			if (oldMediaState !== currentMediaState) {
				this.log('Media state changed from %s %s to %s %s', 
					oldMediaState, mediaState[oldMediaState],
					currentMediaState, mediaState[currentMediaState]);
				this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(currentMediaState);
			}

		}
		return null;
	}


	// get the user profiles via web request and update channelListLoaded
	async getProfilesUpdate() {
		if (this.config.debugLevel > 1) {
			this.log.warn('getProfilesUpdate');
		}
		
		// exit if no session exists
		if (currentSessionState != sessionState.CREATED) { 
			this.log.warn('getProfilesUpdate: Session not yet created, exiting');
			return; 
		}

		// exit if no Channel List loaded yet
		if (!channelListExpiryDate) { 
			this.log.warn('getProfilesUpdate: Channel List not yet loaded, exiting');
			return; 
		}

		var url = personalizationServiceUrlArray[this.config.country].replace("{householdId}", this.sessionData.customer.householdId);
		axiosWS.get(url, {
				headers: {
					Accept: 'application/json',
					"x-cus": this.sessionData.customer.householdId,
					"x-oesp-token": this.sessionData.oespToken,
					"x-oesp-username": this.sessionData.username
				},
			})
			.then(response => {	
				if (this.config.debugLevel > 2) {
					this.log('getProfilesUpdate: got response:',response.status, response.statusText);
				}
				
				this.profiles = response.data;
				this.log('Discovered %s profiles',this.profiles.length);

				// load profile channels, limited to the amount of channels applicable, but can never exceed 96
				// need to cater for not-available channels. maybe??
				this.loadedProfileId = this.profiles.findIndex(profile => profile.name === this.config.profile);
				if (this.loadedProfileId == -1) { this.loadedProfileId = 0 } // if nothing found, use default shared profile (index 0)
				this.log("Loading profile:", this.loadedProfileId, this.profiles[this.loadedProfileId].name);
				let maxSources = Math.min(this.config.maxChannels || MAX_INPUT_SOURCES, MAX_INPUT_SOURCES, 96);

				// determine what channels we need to load: user profile or shared Profile (master list)
				var channelsToLoad = [];
				if (this.loadedProfileId == 0) {
					channelsToLoad = this.channelListAll;
				} else {	
					channelsToLoad = this.profiles[this.loadedProfileId].favoriteChannels;
				}

				// limit the amount to load
				const chs = Math.min(channelsToLoad.length, maxSources);
				this.log.debug("Adding channels 1 to %s", chs);
				this.log.debug("Hiding channels %s to %s", chs + 1, maxSources);

				// get the favoriteChannels in the wanted profile, if a wanted profile exists
				channelsToLoad.forEach((favChannelId, i) => {
					// for ShareProfile, the i (loop index) is already the foundIndex, and favChannelId is the entire channel record
					var foundIndex = i; 
					// for the favorites, the item is the channelId
					if (this.loadedProfileId > 0) {
						foundIndex = this.channelListAll.findIndex(channel => channel.channelId === favChannelId); 
					}
					// get the channel
					var channel = this.channelListAll[foundIndex];

					// load this channel as an input if a channel was found. 
					// update the input services with the name, and set to configured & shown
					// Channel name: number name, make number single digit to conserve space
					if (i < maxSources) {
						this.log.debug("Adding channel %s: %s", i + 1, channel.channelNumber + " " + channel.channelName);
						this.channelListLoaded[i] = channel;
						var chName = channel.channelName;
						if (this.config.showChannelNumber) { // show channel number if user chose to do so
							chName = 1 + 1 + " " + chName
						}
						const inputService = this.inputServices[i];
						inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue(chName);
						inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.CONFIGURED);
						inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(Characteristic.CurrentVisibilityState.SHOWN);
					}

				});
				
				// for any remaining inputs that may have been previously visible, set to not configured and hidden
				//this.log("channelListLoaded pre filter:", this.channelListLoaded);
				//var loadedChs = Math.min(chs, MAX_INPUT_SOURCES);
				//this.log("channelListLoaded, filtering to first %s items", loadedChs);
				//this.channelListLoaded = this.channelListLoaded.filter((channel, index) => index < loadedChs)
				//this.log("channelListLoaded post filter:", this.channelListLoaded);

				for(let i=chs; i<maxSources; i++) {
					this.log("Hiding channel", i + 1);
					// array must stay same size and have elements that can be queried, but channelId and index must never be valid
					this.channelListLoaded[i] = {channelId: 'none', channelNumber: 'none', channelName: 'HIDDEN', channelListIndex: 10000 + i}
					const inputService = this.inputServices[i];
					inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue("Input " + i + 1);
					inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.NOT_CONFIGURED);
					inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(Characteristic.CurrentVisibilityState.HIDDEN);
				}


				// EXPERIMENTAL store in configuredInputs if empty. configuredInputs can be changed by the user
				//if (!this.configuredInputs) {
				//	this.configuredInputs = this.inputs;
				//}

				this.log('Channel List refreshed from %s with %s channels', this.profiles[this.loadedProfileId].name, Math.min(this.channelListLoaded.length, maxSources));
				
				return true;
			})
			.catch(error => {
				this.log('getProfilesUpdate: error:',error);
				return false;
			});		
		return false;
	}

	// load all available TV channels at regular intervals into an array
	async loadChannelListAll(callback) {
		// called by loadChannelListAll (state handler), thus runs at polling interval

		// exit immediately if channel list has not expired
		if (channelListExpiryDate > Date.now()) {
			if (this.config.debugLevel > 2) {
				this.log.warn();('loadChannelListAll: Master channel list has not expired yet. Next refresh will occur after %s', channelListExpiryDate.toLocaleString());
			}
			return false;
		}

		this.log('Refreshing master channel list...');

		// only continue if a session was created. If the internet conection is doen then we have no session
		if (!this.sessionCreated) { return; }
		
		// channels can be retrieved for the country without having a mqtt session going
		let url = countryBaseUrlArray[this.config.country].concat('/channels');
		if (this.config.debugLevel > 2) {
			this.log.warn('loadChannelListAll: loading inputs from',url);
		}
			
		// call the webservice to get all available channels
		axios.get(url)
			.then(response => {
				if (this.config.debugLevel > 2) {
					this.log.warn('Processing %s channels...', response.data.totalResults);
				}
				channelListExpiryDate = new Date(response.data.expires);
			
				// load the channelList with all channels
				this.channelListAll = [];
				const channels = response.data.channels;
				for(let i=0; i<channels.length; i++) {
					const channel = channels[i];
					this.channelListAll.push({channelId: channel.stationSchedules[0].station.serviceId, channelNumber: channel.channelNumber, channelName: channel.title, channelListIndex: i});
				}
					
				this.log('Master channel list refreshed with %s channels, valid until %s', response.data.totalResults, channelListExpiryDate.toLocaleString());

				if (this.config.debugLevel > 2) {
					this.log.warn('loadChannelListAll: loaded inputs:',this.inputServices);
				}

				// now update the profiles. This loads the channels stored in the profiles into the inputs
				this.getProfilesUpdate()
				return true;

			})
			.catch(error => {
				this.log('Failed to load the master channel list - check your internet connection and your username and password.');
				this.log.warn(`loadChannelListAll error:`,error.Message);
				return error;
			});
		return false;
	}


	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++




  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of accessory get/set state handlers
	// HomeKit polls for status regularly at intervals from 2min to 15min
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// get power state
	async getPower(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when HomeKit wants to refresh the TV tile in HomeKit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		if (this.config.debugLevel > 0) {
			this.log('getPower currentPowerState:',currentPowerState, powerState[currentPowerState]);
		}
		callback(null, currentPowerState); // return current state: 0=off, 1=on
	}

	// set power state
	async setPower(targetPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in HomeKit
		// fired when the user clicks the TV tile in HomeKit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.config.debugLevel > 0) {
			this.log.warn('setPower targetPowerState:',targetPowerState, powerState[targetPowerState]);
		}
		callback(null); // for rapid response
		if(currentPowerState !== targetPowerState){
			this.sendKey('Power');
		}
	}

	// get mute state
	async getMute(callback) {
		// not supported, but might use somehow in the future
		if (this.config.debugLevel > 0) {
			this.log.warn("getMute");
		}
		callback(null);
	}

	// set mute state
	async setMute(muteState, callbackMute) {
		// sends the mute command
		// works for TVs that accept a mute toggle command
		if (this.config.debugLevel > 0) {
			this.log.warn('setMute muteState:', muteState);
		}

		if (callbackMute && typoeof(callbackMute) === 'function') { 
			callbackMute();
		}
//		callbackMute(null); // for rapid response

		// mute state is a boolean, either true or false
		// const NOT_MUTED = 0, MUTED = 1;
		this.log('Set mute: %s', (muteState) ? 'Muted' : 'Not muted');

		// Execute command to toggle mute
		if (this.config.muteCommand) {	
			var self = this;
			// assumes the end device toggles between mute on and mute off with each command
			exec(this.config.muteCommand, function (error, stdout, stderr) {
				// Error detection. error is true when an exec error occured
				if (!error) {
					self.log('setMute succeeded:',stdout);
				} else {
					self.log.warn('setMute Error:',stderr.trim());
				}
			});
		} else {
			this.log('Mute command not configured');
		}
	}

	// get volume
	async getVolume(callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn("getVolume");
		}
		callback(null);
	}

	// set volume
	async setVolume(volumeSelectorValue, callback) {
		// set the volume of the TV using bash scripts
		// the ARRIS box remote control commmunicates with the stereo via IR commands, not over mqtt
		// so volume must be handled over a different method
		// here we send execute a bash command on the raspberry pi using the samsungctl command
		// to control the authors samsung stereo at 192.168.0.152
		if (this.config.debugLevel > 0) {
			this.log.warn('setVolume volumeSelectorValue:',volumeSelectorValue);
		}
		callback(null); // for rapid response

		// volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
		this.log('Set volume: %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 10000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			volDownLastKeyPress[2] = volDownLastKeyPress[1] || 0;
			volDownLastKeyPress[1] = volDownLastKeyPress[0] || 0;
			volDownLastKeyPress[0] = Date.now();
			tripleVolDownPress = volDownLastKeyPress[0] - volDownLastKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('setVolume: Timediff between volDownKeyPress[0] now and volDownKeyPress[2]: %s ms', volDownLastKeyPress[0] - volDownLastKeyPress[2]);
		}
			
		// check for triple press of volDown, send setmute if tripleVolDownPress less than 1000ms
		if (tripleVolDownPress < 1000) {
			this.log('Triple-press of volume down detected. Setting Mute');
			this.setMute(true);
			return;
		} else {
			// Execute command to change volume, but only if command exists
			if ((this.config.volUpCommand) && (this.config.volDownCommand)) {

				var self = this;
				exec((volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? this.config.volDownCommand : this.config.volUpCommand, function (error, stdout, stderr) {
					// Error detection. error is true when an exec error occured
					if (error) {
						self.log.warn('setVolume Error:',stderr.trim());
					}
				});
			} else {
				this.log('Set volume: Volume commands not configured');
			}
		}
	}

	// get input (TV channel)
	async getInput(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// currentChannelId is updated by the polling mechanisn
		// must return a valid index, and must never return null
		if (this.config.debugLevel > 0) {
			this.log('getInput currentChannelId:', currentChannelId);
		}

		// find the currentChannelId in the inputs and return the currentActiveInput once found
		// this allows HomeKit to show the selected current channel
		// { id: 'SV09038', name: 'SRF 1 HD', index: 0 }	{ id: 'SV00044', name: 'RTL plus', index: 44 }
		var currentActiveInput = this.inputServices.findIndex(input => input.channelId === currentChannelId);
		if (currentActiveInput == -1) { currentActiveInput = NO_INPUT } // if nothing found, set to NO_INPUT to clear the name from the Home app tile

		callback(null, currentActiveInput);
	}

	// set input (change the TV channel)
	async setInput(input, callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn('setInput input:',input.channelId, input.channelName);
		}
		callback(null); // for rapid response
		var currentChannelName = 'UNKNOWN';
		var foundIndex = this.channelListAll.findIndex(channel => channel.channelId === currentChannelId);
		if (foundIndex > -1) { currentChannelName = this.channelListAll[foundIndex].channelName; }
		this.log('Change channel from %s %s to %s %s', currentChannelId, currentChannelName, input.channelId, input.channelName);
		this.switchChannel(input.channelId);
	}

	// set input name (change the TV channel name)
	async setInputName(inputName, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		// we cannot handle this as we don't know which channel got renamed
		// as user could name multiple channels to xxx
		if (this.config.debugLevel > 0) {
			this.log.warn('setInputName inputName:',inputName);
		}
		callback(null);
	};

	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state, callback) {
		// fired by the View TV Settings command in the HomeKit TV accessory Settings
		if (this.config.debugLevel > 0) {
			this.log.warn('setPowerModeSelection state:',state);
		}
		callback(null); // for rapid response
		this.log('Menu command: View TV Settings');
		// only send the keys if the power is on
		if (currentPowerState == Characteristic.Active.ACTIVE) {
			this.sendKey('Help'); // puts SETTINGS.INFO on the screen
			setTimeout(() => { this.sendKey('ArrowRight'); }, 600); // move right to select SETTINGS.PROFILES, send after 600ms
		} else {
			this.log('Power is Off. View TV Settings command not sent');
		}
	}

	// get current media state
	async getCurrentMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.config.debugLevel > 0) {
			this.log('getCurrentMediaState currentMediaState:', currentMediaState, mediaState[currentMediaState]);
		}
		callback(null, currentMediaState);
	}

	// get target media state
	async getTargetMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		// must never return null, so send STOP as default value
		if (this.config.debugLevel > 0) {
			this.log('getTargetMediaState targetMediaState:', targetMediaState, mediaState[targetMediaState]);
		}
		callback(null, currentMediaState);
	}

	// set target media state
	async setTargetMediaState(targetState, callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
		if (this.config.debugLevel > 0) {
			this.log.warn('setTargetMediaState targetMediaState:',targetState, mediaState[targetState]);
		}
		callback(null); // for rapid response
		switch (targetState) {
			case Characteristic.TargetMediaState.PLAY:
				this.log('setTargetMediaState: Set media to PLAY for', currentChannelId);
				this.setMediaState(currentChannelId, 1)
				break;
			case Characteristic.TargetMediaState.PAUSE:
				this.log('setTargetMediaState: Set media to PAUSE for', currentChannelId);
				this.setMediaState(currentChannelId, 0)
				break;
			case Characteristic.TargetMediaState.STOP:
				this.log('setTargetMediaState: Set media to STOP for', currentChannelId);
				this.setMediaState(currentChannelId, 0)
				break;
			}
	}

	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn('setRemoteKey remoteKey:',remoteKey);
		}
		callback(null); // for rapid response
		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 12, 13 & 14 are not defined by Apple
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				this.sendKey('MediaRewind'); break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				this.sendKey('MediaFastForward'); break;
			case Characteristic.RemoteKey.NEXT_TRACK: // 2
				this.sendKey('DisplaySwap'); break;
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				this.sendKey('DisplaySwap'); break;
			case Characteristic.RemoteKey.ARROW_UP: // 4
				this.sendKey('ArrowUp'); break;
			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				this.sendKey('ArrowDown'); break;
			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				this.sendKey('ArrowLeft'); break;
			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				this.sendKey('ArrowRight'); break;
			case Characteristic.RemoteKey.SELECT: // 8
				this.sendKey('Enter'); break;
			case Characteristic.RemoteKey.BACK: // 9
				this.sendKey(this.config.backButton || "Escape"); break;
			case Characteristic.RemoteKey.EXIT: // 10
				this.sendKey(this.config.backButton || "Escape"); break;
			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				this.sendKey(this.config.playPauseButton || "MediaPause"); break; // others: MediaPlayPause
			case Characteristic.RemoteKey.INFORMATION: // 15
				// this is the button that should be used to access the settop box menu. Options:
				// ContextMenu: 	same as the [...] button on the remote
				// Info: 			displays the INFO screenm same as the [...] button + Info on the remote
				// Help: 			displays the SETTINGS INFO page
				// Guide: 			displays the TV GUIDE page, same as the Guide button on the remote
				// MediaTopMenu: 	displays the top menu (home) page, same as the HOME button on the remote. DEFAULT
				this.sendKey(this.config.infoButton || "MediaTopMenu"); break; // use for Menu button
			}
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};