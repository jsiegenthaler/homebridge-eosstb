'use strict';

// ****************** start of EOS settings

// name and version
const PLUGIN_NAME = 'homebridge-eosstb';
const PLATFORM_NAME = 'eosstb';
const PLUGIN_VERSION = '0.1.4';

// required node modules
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const mqtt = require('mqtt');  
const request = require('request-promise');
const qs = require('qs')
const _ = require('underscore');
const varClientId = makeId(30);

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

// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
const GB_AUTH_URL = 'https://id.virginmedia.com/sign-in/?protocol=oidc';



// general constants
const NO_INPUT = 999999; // an input id that does not exist
const MAX_INPUT_SOURCES = 90; // max input services. Default = 90. Cannot be more than 97 (100 - all other services)
const STB_STATE_POLLING_INTERVAL_MS = 5000; // pollling interval in millisec. Default = 5000
const SESSION_WATCHDOG_INTERVAL_MS = 2000; // session watchdog interval in millisec. Default = 2000
const LOAD_CHANNEL_REFRESH_INTERVAL_S = 30; // load all channels refresh interval, in seconds. Default = 30


// global variables (urgh)
// exec spawns child process to run a bash script
var exec = require("child_process").exec;

let mqttClient = {};
let myUpcUsername;
let myUpcPassword;

let mqttUsername;
let mqttPassword;
let settopboxId;
let currentChannelId;
let currentPowerState;
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

		//device configuration
		this.name = this.config.name || settopBoxName[this.config.country]; // market specific box name as default
		this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.inputs = [];
		this.enabledServices = [];
		this.inputServices = [];
		this.playing = true;
		// set one of the three suitable accessory categories
		// https://developers.homebridge.io/#/categories
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
		this.currentPowerState = false;
		this.mqtttSessionActive = false;
		this.accessoryConfigured = false;
		this.sessionCreated = false;
		this.CurrentMediaState = Characteristic.CurrentMediaState.LOADING; // 4

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
		

		// the session watchdog creates a session when none exists, and recreates one if it ever fails
		// retry every few seconds in case the session ever fails due to no internet or an error
		this.checkSessionInterval = setInterval(this.sessionWatchdog.bind(this),SESSION_WATCHDOG_INTERVAL_MS);
		
		// update device state regularly
		// Check & Update Accessory Status every STB_STATE_POLLING_INTERVAL_MS (Default: 5000 ms)
		// this is the last step in the setup. From now on polling will occur every 5 seconds
		this.checkStateInterval = setInterval(this.updateDeviceState.bind(this),STB_STATE_POLLING_INTERVAL_MS);

		// refresh channel list every 30 seconds as channel lists do not change often
		this.checkChannelInterval = setInterval(this.loadAllChannels.bind(this),LOAD_CHANNEL_REFRESH_INTERVAL_S * 1000);

	}


	sessionWatchdog() {
		// the session watchdog creates a session when none exists
		// runs every few seconds. 
		// If session exists: Exit immediately
		// If no session exists: prepares the session, then prepares the device
		if (this.config.debugLevel > 2) {
			this.log.warn('sessionWatchdog');
		}

		// exit immediately if session exists
		if (this.sessionCreated) { return; }

		// create a session, session type varies by country
		switch(this.config.country) {
			case 'be-nl': case 'be-fr':
				this.getSessionBE(); break;
			case 'gb':
				this.getSessionGB(); break;
			default:
				this.getSession();
		}

		// async wait a few seconds session to load, then continue
		// capture all accessory loading errors
		wait(4*1000).then(() => { 

			// only continue if a session was created
			if (!this.sessionCreated) { return; }

			this.log("Using stbtype",this.stbType); 
			this.log("Using smartCardId",this.smartCardId); 
			this.log("Using physicalDeviceId",this.physicalDeviceId); 

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

			// perform an initial load of all channels
			this.loadAllChannels();

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

		this.prepareAccessoryInformationService();	// service 1 of 100
		this.prepareTelevisionService();			// service 2 of 100
		this.prepareTelevisionSpeakerService();		// service 3 of 100
		//this.prepareSmartSpeakerService();			// service 4 of 100 TRIAL
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
				this.setInput(this.inputs[inputIdentifier], callback);
			});

		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));

		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		this.televisionService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (wantedMediaState, callback) => {
				this.setTargetMediaState(wantedMediaState, callback);
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
			.on('get', this.getVolume.bind(this))
			.on('set', this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
			.on('get', this.getMute.bind(this))
			.on('set', this.setMute.bind(this));

		this.accessory.addService(this.speakerService);
		this.televisionService.addLinkedService(this.speakerService);
	}
	
	//Prepare SmartSpeaker service
	prepareSmartSpeakerService() {
		// not in use yet, experimenting if I can use this to receive siri commands to Play and Pause
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
		if (this.config.debugLevel > 0) {
			this.log.warn('prepareInputSourceServices');
		}
		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// absolute max 100 services (less those already loaded)
		let maxSources = this.config.maxChannels || MAX_INPUT_SOURCES;
		for (let i = 0; i < Math.min(maxSources, MAX_INPUT_SOURCES); i++) {
			if (this.config.debugLevel > 1) {
				this.log.warn('prepareInputSourceServices Adding service',i);
			}

			this.inputService = new Service.InputSource(i, `inputSource_${i}`);

			this.inputService
				// setup the input source as not configured and hidden initially until loaded by loadAllChannels
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.ConfiguredName, `Input ${i < 9 ? `0${i + 1}` : i + 1}`)
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TUNER)
				//.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TUNER)
				.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.NOT_CONFIGURED) // initially not configured NOT_CONFIGURED. Testing with CONFIGURED
				.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDDEN) // SHOWN or HIDDDEN
				//.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			this.inputService
				.getCharacteristic(Characteristic.ConfiguredName)
				.on('set', (value, callback) => {
					callback(null, value);
				}
			);

			this.inputServices.push(this.inputService);
			this.enabledServices.push(this.inputService); // not used yet, keep for future use
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
	async getSessionNew() {
		// a new version of getSession, not yet active
		if (this.config.debugLevel > 0) {
			this.log.warn('getSession');
		}
		this.log('Creating session...');

		const axiosConfig = {
			method: 'GET',
			url: countryBaseUrlArray[this.config.country].concat('/session'),
			data: {
				'usernmae':this.config.username,
				'password':this.config.password
			}
		};

		axiosWS(axiosConfig)
			.then(response => {	
				this.log('getSession response',response.status, response.statusText);
				
				// get device data from the session
				this.householdId = response.data.customer.householdId;
				this.stbType = response.data.customer.stbType;
				this.smartCardId = response.data.customer.smartCardId;
				this.physicalDeviceId = response.data.customer.physicalDeviceId;

				if (this.config.debugLevel > 0) {
					this.log.warn('getSession: sessionJson.customer',sessionJson.customer);			
				}

				this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
				this.log('Session created');
				return true;
			})
			.catch(error => {
				this.log.warn('getSession error:', error);
				return false;
			});		
		//return sessionJson || false;
	}

	// get session (generic, vaild for CH, AT and NL countries)
	async getSession(callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn('getSession');
		}
		this.log('Creating %s session...',PLATFORM_NAME);

		// set the request options
		sessionRequestOptions.uri = countryBaseUrlArray[this.config.country].concat('/session');
		sessionRequestOptions.body.username = this.config.username;
		sessionRequestOptions.body.password = this.config.password;
		//this.log.warn('getSession: sessionRequestOptions',sessionRequestOptions);
		
		request(sessionRequestOptions)
			.then((json) => {
				var responseData = json;
				if (this.config.debugLevel > 0) {
					this.log.warn('getSession: responseData.customer',responseData.customer);			
				}

				// get device data from the session
				this.householdId = responseData.customer.householdId;
				this.stbType = responseData.customer.stbType;
				this.smartCardId = responseData.customer.smartCardId;
				this.physicalDeviceId = responseData.customer.physicalDeviceId;

				// get the Jwt Token
				this.getJwtToken(responseData.oespToken, this.householdId);
				this.log('Session created');
				this.sessionCreated = true
				return true;
			})
			.catch((err) => {
				this.sessionCreated = false;
				this.log('Failed to create session - check your internet connection.');
				this.log.debug('getSession Error:', err.message); // likely invalid credentials
			});
		return false;
	}

	// get session for BE only (special logon sequence)
	async getSessionBE() {
		// only for be-nl and be-fr users, as the session logon using openid is different
		// looks like also for gb users:
		// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
		this.log('Creating %s BE session...',PLATFORM_NAME);


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
								//location is https://login.prd.telenet.be/openid/login?response_type=code&state=... if success
								//location is https://login.prd.telenet.be/openid/login?authentication_error=true if not authorised
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 Unable to login, wrong credentials');
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
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 Unable to login, wrong credentials');
											} else {

												// Step 5: # obtain authorizationCode
												this.log.warn('Step 5 extract authorizationCode');
												url = response.headers.location;
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length != 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log.warn('Step 6 post auth data to',apiAuthorizationUrl);
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
																	this.log.warn('Successfully authenticated'); 

																	this.log('Step 7 response.headers:',response.headers); 
																	this.log('Step 7 response.data:',response.data); 
																	this.log('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.householdId = response.data.customer.householdId;
																	this.stbType = response.data.customer.stbType;
																	this.smartCardId = response.data.customer.smartCardId;
																	this.physicalDeviceId = response.data.customer.physicalDeviceId;

																	// now get the Jwt token
																	// all subscriber data is in the response.data.customer
																	// can get smartCardId, physicalDeviceId, stbType, and more
																	this.log('Getting jwtToken for householdId',response.data.customer.householdId);
																	this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
																	this.log('Session created');
													
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
				this.sessionCreated = false;
				this.log('Failed to create BE session - check your internet connection.');
				this.log.warn("Step 1 Could not get apiAuthorizationUrl, http error:",error);
			});

		this.log.warn('end of getSessionBE');
	}


	// get session for GB only (special logon sequence)
	getSessionGB() {
		// this code is a copy of the be session code, adapted for gb
		this.log('Creating %s GB session...',PLATFORM_NAME);

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
								//location is h??=... if success
								//location is https?? if not authorised
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 Unable to login, wrong credentials');
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
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 Unable to login, wrong credentials');
											} else {

												// Step 5: # obtain authorizationCode
												this.log.warn('Step 5 extract authorizationCode');
												url = response.headers.location;
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length != 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log.warn('Step 6 post auth data to',apiAuthorizationUrl);
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
																	this.log.warn('Successfully authenticated'); 

																	this.log('Step 7 response.headers:',response.headers); 
																	this.log('Step 7 response.data:',response.data); 
																	this.log('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.householdId = response.data.customer.householdId;
																	this.stbType = response.data.customer.stbType;
																	this.smartCardId = response.data.customer.smartCardId;
																	this.physicalDeviceId = response.data.customer.physicalDeviceId;

																	// now get the Jwt token
																	// all subscriber data is in the response.data.customer
																	// can get smartCardId, physicalDeviceId, stbType, and more
																	this.log('Getting jwtToken for householdId',response.data.customer.householdId);
																	this.getJwtToken(response.data.oespToken, response.data.customer.householdId);
																	this.log('Session created');
													
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
				this.sessionCreated = false;
				this.log('Failed to create GB session - check your internet connection.');
				this.log.warn("Step 1 Could not get apiAuthorizationUrl, http error:",error);
			});

		this.log.warn('end of getSessionGB');
	}



	// get a Java Web Token
	getJwtToken(oespToken, householdId){
		// get a JSON web token from the supplied oespToken and householdId
		if (this.config.debugLevel > 0) {
			this.log.warn('getJwtToken');
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
		this.log('Starting mqtt client...');
		let mqttUrl = mqttUrlArray[this.config.country];
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: varClientId,
			username: mqttUsername,
			password: mqttPassword
		});

		// mqtt client event: connect
		mqttClient.on('connect', function () {
			parent.log('mqtt client connecting');
			parent.log.debug('mqttClient: connect event');

			// subscribe to base householdId
			mqttClient.subscribe(mqttUsername, function (err) {
				if(!err){
					parent.log('mqttClient: Subscribed to',mqttUsername);
				} else {
					parent.log('mqttClient subscribe: Error:',err);
					return false;
				}
			});

			// subscribe to base householdId/+/status
			mqttClient.subscribe(mqttUsername + '/+/status', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to status: Error:',err);
					return false;
				} else {
					parent.log('mqttClient: Subscribed to topic',mqttUsername + '/+/status');
				}
			});

			// subscribe to base householdId/personalizationService
			mqttClient.subscribe(mqttUsername + '/personalizationService', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to personalizationService: Error:',err);
					return false;
				} else {
					parent.log('mqttClient: Subscribed to topic',mqttUsername + '/personalizationService');
				}
			});
			
			// once all subscriptions are in, send the first getUiStatus request
			parent.log.debug('mqttClient: requesting first getUiStatus call');
			parent.getUiStatus();

			/*
			mqttClient.subscribe(mqttUsername +'/watchlistService', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to watchlistService: Error:',err);
					return false;
				} else {
					parent.log('mqttClient: Subscribed to topic',mqttUsername +'/watchlistService');
				}
			});
			*/
			
			// mqtt client event: message received
			mqttClient.on('message', function (topic, payload) {
				// many messages occur. Be careful ith logging otherwise logs will be flooded
				this.mqtttSessionActive = true;
				let payloadValue = JSON.parse(payload);
				parent.log.warn('mqttClient: Received Message: Topic:',topic);
				if (parent.config.debugLevel > 2) {
					parent.log.warn('mqttClient: Received Message: Message:',payloadValue);
				}
				
				// check if this status message is for the desired EOSSTB
				if(topic.startsWith(mqttUsername) && topic.includes('-EOSSTB-')){
					parent.log('mqtt EOSSTB topic detected:',topic)
				};
				
				//parent.log('mqttClient message: payloadValue.type',payloadValue.type);
				//parent.log('mqttClient message: payloadValue.status',payloadValue.status);
				//parent.log('mqttClient message: payloadValue:',payloadValue);
				//parent.log('mqttClient message: payloadValue.status',payloadValue.status);
				//parent.log('mqttClient message: payloadValue.deviceType',payloadValue.deviceType);
				//parent.log('mqttClient message: payloadValue.source',payloadValue.source); // use as serial number
				//parent.log('mqttClient message: payloadValue.mac',payloadValue.mac);
				//parent.log('mqttClient message: payloadValue.state',payloadValue.state);

				// check if payloadValue.deviceType exists
				// deviceType exists in Topic: 1076582_ch/2E59F6E9-8E23-41D2-921D-C13CA269A3BC/status
				// Topic: 1076582_ch/3C36E4-EOSSTB-003656579806/status  
				// multiple devices exist!
				if (payloadValue.deviceType){
					// got some deviceType, but which one?
						
					// check if this is the wanted settopboxId and that payloadValue.deviceType value = STB
					// wanted = defined and correct, or not defined
					//if(((payloadValue.source == parent.config.settopboxId) || (typeof parent.config.settopboxId === 'undefined'))
					//	&& (payloadValue.deviceType == 'STB')) {
					if (payloadValue.deviceType == 'STB'){
						// got the STB device type, but which STB?
						
						// set or detect the settopboxId but only once
						if (typeof settopboxId === 'undefined'){
							if (typeof parent.config.settopboxId === 'undefined') {
								settopboxId = payloadValue.source;
								parent.log('mqttClient: Auto-configured settopboxId to',settopboxId);
							} else {
								settopboxId = parent.config.settopboxId;
								parent.log('settopboxId configured, using', settopboxId);
							}
						};
						parent.log('Using settopBoxId',settopboxId);

						
						// subscribe to our own generated unique varClientId
						mqttClient.subscribe(mqttUsername + '/' + varClientId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to varClientId Error:',err);
								return false;
							} else {
								parent.log('mqttClient: Subscribed to topic',mqttUsername + '/' + varClientId);
							}
						});

						mqttClient.subscribe(mqttUsername + '/' + settopboxId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopboxId Error:',err);
								return false;
							} else {
								parent.log('mqttClient: Subscribed to topic',mqttUsername + '/' + settopboxId);
							}
						});

						mqttClient.subscribe(mqttUsername + '/' + settopboxId +'/status', function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopbox status Error:',err);
								return false;
							} else {
								parent.log('mqttClient: Subscribed to topic',mqttUsername + '/' + settopboxId +'/status');
							}
						});

						parent.log.debug('mqttClient: Received Message STB status: currentPowerState:',currentPowerState);

					} // end of if deviceType=STB
				}


				// check if payloadValue.deviceType = STB, make sure it is for the wanted settopboxId
				// Topic: 1076582_ch/3C36E4-EOSSTB-003656579806/status
				// Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-003656579806","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
				if((payloadValue.deviceType == 'STB') && (payloadValue.source == settopboxId)) {
						parent.log.debug('mqttClient: Received Message of deviceType STB for',payloadValue.source,'Detecting currentPowerState');
						if ((payloadValue.state == 'ONLINE_RUNNING') && (currentPowerState != 1)){ // ONLINE_RUNNING: power is on
							currentPowerState = 1; 
							// for performance, set the state immediately, but only if the televisionService has been defined
							if (parent.accessoryConfigured) {
								parent.televisionService.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE);
							}
							parent.log('Settopbox power:',(currentPowerState ? "On" : "Off"));
						}          
						else if (((payloadValue.state == 'ONLINE_STANDBY') || (payloadValue.state == 'OFFLINE')) // ONLINE_STANDBY or OFFLINE: power is off
							&& (currentPowerState != 0)){
							currentPowerState = 0;
							// for performance, set the state immediately, but only if the televisionService has been defined
							if (parent.accessoryConfigured) {
								parent.televisionService.setCharacteristic(Characteristic.Active, Characteristic.Active.INACTIVE);
							}
							if (parent.config.debugLevel > 2) {
								parent.log.debug('mqttClient: Detected current power state:', currentPowerState);
								parent.log('Settopbox power:',(currentPowerState ? "On" : "Off"));
							}
						};
						parent.log('Power state:',payloadValue.state);

				};


				
				// check if payloadValue.type exists, look for CPE.uiStatus, make sure it is for the wanted settopboxId
				// type exists in Topic: 1076582_ch/jrtmev583ijsntldvrk1fl95c6nrai
				// CPE.uiStatus shows us the currently selected channel on the stb, and occurs in many topics
				// Topic: 1076582_ch/vy9hvvxo8n6r1t3f4e05tgg590p8s0
				// Message: {"version":"1.3.10","type":"CPE.uiStatus","source":"3C36E4-EOSSTB-003656579806","messageTimeStamp":1607205483257,"status":{"uiStatus":"mainUI","playerState":{"sourceType":"linear","speed":1,"lastSpeedChangeTime":1607203130936,"source":{"channelId":"SV09259","eventId":"crid:~~2F~~2Fbds.tv~~2F394850976,imi:3ef107f9a95f37e5fde84ee780c834b502be1226"}},"uiState":{}},"id":"fms4mjb9uf"}
				if (parent.config.debugLevel > 1) {
					parent.log.warn('mqttClient Detecting currentChannelId: payloadValue',payloadValue);
					parent.log.warn('mqttClient Detecting currentChannelId: payloadValue.type',payloadValue.type, 'payloadValue.source',payloadValue.source);
				}
				if((payloadValue.type == 'CPE.uiStatus') && (payloadValue.source == settopboxId)) {
						//parent.log('mqttClient: Received Message of type CPE.uiStatus for',payloadValue.source,'Detecting playerState');
						if(payloadValue.status.uiStatus == 'mainUI'){
							// grab the status part of the payloadValue object as we cannot go any deeper with json
							//let playerStateSource = payloadValue.status.playerState.source;
							let playerState = payloadValue.status.playerState;

							if (parent.config.debugLevel > 1) {
								parent.log('mqttClient: Detected current playerState.speed:', playerState.speed);
							}

							// set the CurrentMediaState to one of PLAY PAUSE STOP LOADING INTERRUPTED
							// but only if configured
							// speed can be one of: -64 -30 -6 -2 0 2 6 30 64
							// where 0 is pause, 1 is play, and 2/6/30/64 are speed. positive = fastforward, negative = rewind
							if (parent.accessoryConfigured) {
								switch (playerState.speed) {
									case 0:
										// speed 0 is PAUSE
										inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.CONFIGURED);
										if (this.CurrentMediaState != Characteristic.CurrentMediaState.PAUSE) {
											parent.log('mqttClient: setting CurrentMediaState to PAUSE');
											this.CurrentMediaState = Characteristic.CurrentMediaState.PAUSE;
											parent.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.CurrentMediaState);
											parent.televisionService.getCharacteristic(Characteristic.TargetMediaState).updateValue(this.CurrentMediaState);
											//parent.televisionService.setCharacteristic(Characteristic.TargetMediaState, this.CurrentMediaState);
										}
										break;
									default:
										// register all other speeds as PLAY (-64 -30 -6 1 2 6 30 64)
										if (this.CurrentMediaState != Characteristic.CurrentMediaState.PLAY) {
											parent.log('mqttClient: setting CurrentMediaState to PLAY');
											this.CurrentMediaState = Characteristic.CurrentMediaState.PLAY;
											parent.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.CurrentMediaState);
											parent.televisionService.getCharacteristic(Characteristic.TargetMediaState).updateValue(this.CurrentMediaState);
											//parent.televisionService.setCharacteristic(Characteristic.CurrentMediaState, this.CurrentMediaState);
											//parent.televisionService.setCharacteristic(Characteristic.TargetMediaState, this.CurrentMediaState);
										}
										break;
								}
							}

							currentChannelId = playerState.source.channelId;
							if (parent.config.debugLevel > 2) {
								parent.log.debug('mqttClient: Detected current channel:', currentChannelId);
							}
					};
				};
				

				if (parent.config.debugLevel > 1) {
					parent.log.warn('mqttClient: Received Message end of event: currentPowerState:',currentPowerState, 'currentChannelId:',currentChannelId);
				}

			}); // mqtt client event: message received

			// mqtt client event: error
			mqttClient.on('error', function(err) {
				parent.log.error('mqttClient: Error:', err);
				mqttClient.end();
				return false;
			}); // end of mqtt client event: error

			// mqtt client event: close
			mqttClient.on('close', function () {
				parent.log.warn('mqttClient: Connection closed');
				mqttClient.end();
				this.mqtttSessionActive = false;
				return false;
			});
		}); // end of mqttClient.on('connect' ...
		
	} // end of startMqttClient

	// send a channel change request to the settopbox via mqtt
	switchChannel(channelId) {
		if (this.config.debugLevel > 0) {
			this.log.warn('switchChannel', channelId);
		}
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.pushToTV","source":{"clientId":"' + varClientId + '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' + channelId + '"},"relativePosition":0,"speed":1}}');
	}

	// send a remote control keypress to the settopbox via mqtt
	sendKey(keyName) {
		if (this.config.debugLevel > 0) {
			this.log.warn('sendKey keyName:', keyName);
		}
		this.log('Send key:', keyName);
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.KeyEvent","source":"' + varClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}');
		
		// could update profiles on every button press...
		//this.getProfilesUpdate;
	}


	// get the settopbox UI status from the settopbox via mqtt
	// this needs to run regularly
	getUiStatus() {
		this.log.warn('getUiStatus');
		// this connects us to the settop box, and must be the first mqtt message
		// gets called at every mqtt uistatus message
		if (this.config.debugLevel > 2) {
			this.log.warn('getUiStatus');
			this.log.warn('getUiStatus settopboxId varClientId',settopboxId,varClientId);
		}
		
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.getUiStatus","source":"' + varClientId + '"}')
		//this.log('Get UI status mqttClient payload',mqttClient); // see the mqtt full detail if needed
		//let mqttPayloadValue = JSON.parse(mqttClient);
		//this.log('getUiStatus: mqtt connected:',mqttClient['connected']);
		//this.log('getUiStatus: mqtt disconnecting:',mqttClient['disconnecting']);
		//this.log('getUiStatus: mqtt reconnecting:',mqttClient['reconnecting']);

	}

	// request profile details via mqtt
	// incomplete, not working
	getProfilesUpdate() {
		if (this.config.debugLevel > 0) {
			this.log('getProfilesUpdate');
		}
		let mqttCmd = '{"action":"OPS.getProfilesUpdate","source":"' + varClientId + '"}';
		this.log('sending:', mqttCmd);
		mqttClient.publish(mqttUsername +'/personalizationService', mqttCmd);

	//		mqttClient.publish(mqttUsername +'/personalizationService', '{"action":"OPS.getProfilesUpdate","source":"' + varClientId + '"}');
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END session handler (web and mqtt)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++





	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state
	updateDeviceState(error, status) {
		// runs at the very start, and then every 5 seconds, so don't log it unless debugging
		// doesn't get the data direct from the settop box, but rather gets it from the currentPowerState and currentChannelId
		// which are received by the mqtt messages, which occurs very often
		if (this.config.debugLevel > 1) {
			this.log.warn('updateDeviceState');
		}

		// only continue if a session was created. If the internet conection is doen then we have no session
		if (!this.sessionCreated) {
			return null;
		}


		if (this.config.debugLevel > 0) {
			this.log.warn('updateDeviceState: currentChannelId:', currentChannelId, 'currentPowerState:', currentPowerState);
		}
		
		//this.loadAllChannels(); //load all the channels

		if (this.televisionService) {
			// update power status value (currentPowerState, 0=off, 1=on)
			if (this.televisionService.getCharacteristic(Characteristic.Active).value !== currentPowerState) {
					this.televisionService.getCharacteristic(Characteristic.Active).updateValue(currentPowerState == 1);
			}
			
			// log the entire object to see the data!
			//this.log('TV ActiveIdentifier:',this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)),

			this.inputs.filter((input, index) => {
				//this.log('updateDeviceState: input:',input, 'index', index); // log to view the inputs
				// input: { id: 'SV09029', name: 'SRF info HD', index: 2 }
				// loop through all inputs until the input.id is found that matches the currentChannelId 
				if (input.id === currentChannelId) {
					// Update HomeKit accessory with the current input if it has changed
					if (this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value !== index) {
						this.log(`Current channel: ${input.name} (${input.id})`);
						return this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(index);
					}
				}
			return null;
			});

		}
	}


	// load all available TV channels
	async loadAllChannels(callback) {
		// called by loadAllChannels (state handler), thus runs at polling interval
		// this could be changed to call the webservice at much less frequent intervals to reduce traffic

		if (this.config.debugLevel > 1) {
			this.log.warn('loadAllChannels');
		}

		// only continue if a session was created. If the internet conection is doen then we have no session
		if (!this.sessionCreated) {
			return;
		}
		
		// set the televisionService inputs if they are empty
		if (this.inputServices && this.inputServices.length) {
			//this.log('loadAllChannels: loading channels: this.inputServices',this.inputServices);
			// channels can be retrieved for the country without having a mqtt session going
			let channelsUrl = countryBaseUrlArray[this.config.country].concat('/channels');
			if (this.config.debugLevel > 1) {
				this.log.warn('loadAllChannels: loading inputs from channelsUrl:',channelsUrl);
			}
			
			// call the webservice to get all available channels
			request({ url: channelsUrl, json: true}).then(availableInputs => {
				const sanitizedInputs = [];
				//this.log('loadAllChannels: availableInputs.channels',availableInputs.channels.length);
				//this.log('channel data',availableInputs.channels[197]);

				let i = 0;
				let maxSources = this.config.maxChannels || MAX_INPUT_SOURCES;
				availableInputs.channels.forEach(function (channel) {
					if (i < Math.min(maxSources, MAX_INPUT_SOURCES)){ // limit to the amount of channels applicable
						sanitizedInputs.push({id: channel.stationSchedules[0].station.serviceId, name: channel.title, index: i});
					}
					i++;
				});
				// store all loaded  inputs
				this.inputs = sanitizedInputs;
				
				// need to cater for not-available channels. maybe??
				this.inputs.forEach((input, i) => {
					const inputService = this.inputServices[i];
					
					// update the input services with the name, and set to configured & shown
					inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue( `${i < 9 ? `0${i + 1}` : i + 1}` + ". " + input.name);
					inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.CONFIGURED);
					inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(Characteristic.CurrentVisibilityState.SHOWN);
					
				});
				this.log('Channel list refreshed');

				if (this.config.debugLevel > 1) {
					this.log.warn('loadAllChannels: loaded inputs:',this.inputs);
				}
			},
			error => {
				this.log.warn(`Failed to get available inputs from ${this.config.name}. Please verify the EOS set-top box is connected to the LAN`);
			}
			);
		}
		//callback();
	}

	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END regular device update polling functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++




  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START of accessory get/set state handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// get power state
	async getPower(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when Homekit wants to refresh the TV tile in Homekit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		if (this.config.debugLevel > 0) {
			this.log.warn('getPower currentPowerState:',currentPowerState);
		}
		callback(null, currentPowerState); // return current state: 0=off, 1=on
	}

	// set power state
	async setPower(wantedPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in Homekit
		// fired when the user clicks the TV tile in Homekit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.config.debugLevel > 0) {
			this.log.warn('setPower wantedPowerState:',wantedPowerState);
		}
		if(wantedPowerState !== currentPowerState){
			this.sendKey('Power');
		}
		callback(null);
	}

	// get mute state
	async getMute(callback) {
		// not supported, but might use somehow in the future
		if (this.config.debugLevel > 0) {
			this.log.warn("getMute");
		}
		callback(true);
	}

	// set mute state
	async setMute(state, callback) {
		// sends the mute command
		// works for TVs that accept a mute toggle command
		if (this.config.debugLevel > 0) {
			this.log.warn('setMute state:', state);
		}
		// mute state is a boolean, either true or false
		// const NOT_MUTED = 0, MUTED = 1;
		this.log('Set mute: %s', (state) ? 'Muted' : 'Not muted');

		// Execute command to toggle mute
		if (this.config.muteCommand) {
			var self = this;
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
	
		callback(true);
	}

	// get volume
	async getVolume(callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn("getVolume");
		}
		callback(true);
	}

	// set volume
	async setVolume(volumeSelectorValue, callback) {
		// set the volume of the TV using bash scripts
		// the ARRIS box remote control commmunicates with the stereo via IR commands, not over mqtt
		// so volume must be handled over a different method
		// here we send execute a bash command on the raspberry pi using the samsungctl command
		// to control the authors samsung stereo at 192.168.0.152
		if (this.config.debugLevel > 0) {
			this.log.warn('setVolume volume:',volume);
		}

		// volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
		this.log('Set volume: %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');

		// Execute command to change volume, but only if command exists
		if ((this.config.volUpCommand) && (this.config.volDownCommand)) {
			var self = this;
			exec((volume === Characteristic.VolumeSelector.DECREMENT) ? this.config.volDownCommand : this.config.volUpCommand, function (error, stdout, stderr) {
				// Error detection. error is true when an exec error occured
				if (error) {
					self.log.warn('setVolume Error:',stderr.trim());
				}
			});
		} else {
			this.log('Set volume: Volume commands not configured');
		}

		callback(true);
	}

	// get input (TV channel)
	async getInput(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in Homekit and Homekit requests a refresh
		// currentChannelId is updated by the polling mechanisn
		if (this.config.debugLevel > 0) {
			this.log.warn('getInput');
		}
		var isDone = false;
		this.inputs.filter((input, index) => {
			// getInput input 
			// { id: 'SV09038', name: 'SRF 1 HD', index: 0 }
			// { id: 'SV00044', name: 'RTL plus', index: 44 }
			//this.log(`getInput: ${input.index} ${input.name} (${input.id})`);
			// find the currentChannelId in the inputs and return the index once found
			// this allows Homekit to show the selected current channel
			if (input.id === currentChannelId) {
				this.log('Current channel:', index, input.name, input.id);
				isDone = true;
				return callback(null, index);
				}
			});
		if (!isDone)
			return callback(null, null);
	}

	// set input (TV channel)
	async setInput(input, callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn('setInput input:',input.id, input.name);
		}
		this.log(`Change channel to: ${input.name}  (${input.id})`);
		this.switchChannel(input.id);
		callback(true);
	}

	// set power mode selection (View TV Settings menu option)
	async setPowerModeSelection(state, callback) {
		// fired by the View TV Settings command in the Homekit TV accessory Settings
		if (this.config.debugLevel > 0) {
			this.log.warn('setPowerModeSelection state:',state);
		}
		this.log('Menu command: View TV Settings');
		this.sendKey('Help'); // puts SETTINGS.INFO on the screen
		setTimeout(() => { this.sendKey('ArrowRight'); }, 600); // move right to select SETTINGS.PROFILES, send after 600ms
		callback(true);
	}

	// get current media state
	async getCurrentMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other Homekit apps
		this.log('getCurrentMediaState state:', this.CurrentMediaState);
		return callback(null, this.CurrentMediaState);
	}

	// get target media state
	async getTargetMediaState(callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other Homekit apps
		this.log('getTargetMediaState');
		return callback(null, this.CurrentMediaState);
	}

	// set target media state
	async setTargetMediaState(targetMediaState, callback) {
		// fired by ??
		// cannot be controlled by Apple Home app, but could be controlled by other Homekit apps
		this.log.warn('setTargetMediaState state:',targetMediaState);
		switch (targetMediaState) {
			case Characteristic.TargetMediaState.PLAY:
				this.log.warn('setTargetMediaState setting PLAY');
				//this.sendKey(this.config.playPauseButton || "MediaPause");
				break;
			case Characteristic.TargetMediaState.PAUSE:
				this.log.warn('setTargetMediaState setting PAUSE');
				//this.sendKey(this.config.playPauseButton || "MediaPause");
				break;
			case Characteristic.TargetMediaState.STOP:
				this.log.warn('setTargetMediaState setting STOP');
				//this.sendKey(this.config.playPauseButton || "MediaPause");
				break;
			}
		return callback(null);
	}

	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 0) {
			this.log.warn('setRemoteKey remoteKey:',remoteKey);
		}
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
				// this is the button that can be used to access the menu
				// Options:
				// ContextMenu: the [...] button on the remote
				// Info: displays the INFO screenm same as the [...] button then Info on the remote
				// Help: displays the SETTINGS INFO page
				// Guide: displays the TV GUIDE page, same as the Guide button on the remote,
				// MediaTopMenu: displazs the top menu (home) page, same as the HOME button on the remote
				this.sendKey(this.config.infoButton || "MediaTopMenu"); break; // use for Menu button
			}
		callback(null);
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};