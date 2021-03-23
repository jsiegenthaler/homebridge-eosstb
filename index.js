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
delete axiosWS.defaults.headers.common;
axiosWS.defaults.headers.post = {}; // ensure no default post header


// setup the cookieJar
axiosCookieJarSupport(axiosWS);
const cookieJar = new tough.CookieJar();


// ++++++++++++++++++++++++++++++++++++++++++++
// config start
// ++++++++++++++++++++++++++++++++++++++++++++

// different settop box names per country
const settopBoxName = {
    'at':     'Entertain Box 4K',
    'be-fr':  'Telenet TV-Box',
    'be-nl':  'Telenet TV-Box',
    'ch':     'UPC TV Box',
    'gb':     'Virgin Media 360',
    'ie':     'Virgin Media 360',
    'nl':     'Mediabox Next (4K)'
};

// base url varies by country
const countryBaseUrlArray = {
    'at': 		'https://prod.oesp.magentatv.at/oesp/v4/AT/deu/web', // v3 and v4 works
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/fr/web',
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web', // v3 and v4 works
    'gb':       'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web',
    'ie':       'https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web',
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web'
};

// mqtt endpoints varies by country
const mqttUrlArray = {
    'at':		'wss://obomsg.prod.at.horizon.tv:443/mqtt',
    'be-fr':  	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'ch': 		'wss://obomsg.prod.ch.horizon.tv:443/mqtt',
    'gb':       'wss://obomsg.prod.gb.horizon.tv/mqtt', // gb only works without a port number!
    'ie':       'wss://obomsg.prod.ie.horizon.tv/mqtt', // ie only works without a port number!
    'nl': 		'wss://obomsg.prod.nl.horizon.tv:443/mqtt'
		
};

// profile url endpoints varies by country
// https://prod.spark.upctv.ch/deu/web/personalization-service/v1/customer/{household_id}/devices
// without terminating / 
const personalizationServiceUrlArray = {
    'at':		'https://prod.spark.magentatv.at/deu/web/personalization-service/v1/customer/{householdId}',
    'be-fr':  	'https://prod.spark.telenettv.be/fr/web/personalization-service/v1/customer/{householdId}',
    'be-nl': 	'https://prod.spark.telenettv.be/nld/web/personalization-service/v1/customer/{householdId}',
    'ch': 		'https://prod.spark.upctv.ch/eng/web/personalization-service/v1/customer/{householdId}',
    'gb':       'https://prod.spark.virginmedia.com/eng/web/personalization-service/v1/customer/{householdId}',
    'ie':       'https://prod.spark.virginmedia.ie/eng/web/personalization-service/v1/customer/{householdId}',
    'nl': 		'https://prod.spark.ziggogo.tv/nld/web/personalization-service/v1/customer/{householdId}'
};


// special channel names
// These names are not broadcast in the master channel list as they are normally apps
const specialChannelNames = {
    'at':		'',
    'be-fr':  	'',
    'be-nl': 	'',
    'ch': 		[ { channelId: 'SV09690', channelName: 'Netflix' } ],
    'gb':       '',
    'ie':       '',
    'nl': 		''
};


// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
// https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
// const GB_AUTH_URL = 'https://id.virginmedia.com/sign-in/?protocol=oidc';
const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';



// general constants
const NO_INPUT_ID = 999; // an input id that does not exist. Must be > 0 as a uint32 is expected
const NO_CHANNEL_ID = 'NO_ID'; // id for a channel not in the channel list
const NO_CHANNEL_NAME = 'NO_NAME'; // name for a channel not in the channel list
const MAX_INPUT_SOURCES = 95; // max input services. Default = 95. Cannot be more than 96 (100 - all other services)
const SESSION_WATCHDOG_INTERVAL_MS = 15000; // session watchdog interval in millisec. Default = 15000 (15s)
const MQTT_WATCHDOG_INTERVAL_MS = 10000; // mqtt watchdog interval in millisec. Default = 10000 (10s)
const MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S = 120; // channel list refresh check interval, in seconds. Default = 120


// state constants
const sessionState = { NOT_CREATED: 0, LOADING: 1, LOGGING_IN: 2, AUTHENTICATING: 3, VERIFYING: 4, AUTHENTICATED: 5, CREATED: 6 };
const mediaStateName = ["PLAY", "PAUSE", "STOP", "UNKNOWN3", "LOADING", "INTERRUPTED"];
const powerStateName = ["OFF", "ON"];
Object.freeze(sessionState);
Object.freeze(mediaStateName);
Object.freeze(powerStateName);



// exec spawns child process to run a bash script
var exec = require("child_process").exec;
const { waitForDebugger } = require('inspector');
const { ENGINE_METHOD_CIPHERS } = require('constants');
var PLUGIN_ENV = ''; // controls the development environment, appended to UUID to make unique device when developing

// variables for session and all devices
let mqttClient = {};
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



// wait function
const wait=ms=>new Promise(resolve => setTimeout(resolve, ms)); 

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
		// only load if configured and mandatory items exist. Homebridge checks for platform itself, and name is not critical
		if (!config) { log.warn('%s config missing. Initialization aborted.', PLUGIN_NAME); return; }
		const configWarningText = '%s config incomplete: "{configItemName}" missing. Initialization aborted.';
		if (!config.country) { log.warn( configWarningText.replace('{configItemName}','country'), PLUGIN_NAME); return; }
		if (!config.username) { log.warn( configWarningText.replace('{configItemName}','username'), PLUGIN_NAME); return; }
		if (!config.password) { log.warn( configWarningText.replace('{configItemName}','password'), PLUGIN_NAME); return; }

		this.log = log;
		this.config = config;
		this.api = api;
    	this.accessories = []; // store restored cached accessories in this.accessories
		this.stbDevices = []; // all the device objects

		// session flags
		currentSessionState = sessionState.NOT_CREATED;

		
		/**
    	* Platforms should wait until the "didFinishLaunching" event has fired before registering any new accessories.
    	*/
		this.api.on('didFinishLaunching', () => {
			if (this.config.debugLevel > 2) { this.log.warn('API event: didFinishLaunching'); }
			this.log('%s v%s', PLUGIN_NAME, PLUGIN_VERSION);


			// detect if running on dev device
			//	customStoragePath: 'C:\\Users\\jochen\\.homebridge'
			if ( this.api.user.customStoragePath.includes( 'jochen' ) ) { PLUGIN_ENV = '_DEV' }
			if (PLUGIN_ENV) { this.log.warn('%s running in %s environment with debugLevel %s', PLUGIN_NAME, PLUGIN_ENV, this.config.debugLevel); }
	
			// do all common setup here

			// Step 1: create a session, async function, processing continues
			this.createSession(this.config.country); 
			// be needs 10 seconds to connect... set to 10s for safety
			wait(10*1000).then(() => { 
				if (this.session) {
					// show feedback for session found and discovery started
					this.log('Discovery started');

					// show feedback for customer data found
					if (!this.session.customer) {
						this.log('Failed to find customer data. The backend systems may be down')
					} else {
						this.log('Found customer data: %s %s %s', this.session.customer.customerId, (this.session.customer.givenName || ''), (this.session.customer.familyName || '') );
						if (this.config.debugLevel > 2) { this.log.warn('Session data: %s', this.session); }
						if (this.config.debugLevel > 2) { this.log.warn('Customer data: %s', this.session.customer); }
					}

					// Step 2: get the master channel list. Also works for VirginMedia TiVo devices
					this.loadMasterChannelList(); // async function, processing continues
		
					// Step 3: after session is created, get the Personalization Data, but only if this.session.customer.physicalDeviceId exists
					if (this.session.customer.physicalDeviceId) {
						this.getPersonalizationData('profiles'); // async function
						this.getPersonalizationData('devices'); // async function
					} else {
						// show warning if no physicalDeviceId found
						this.log('Failed to find physicalDeviceId in your customer data. Are you sure you have a compatible set-top box?')
						if (this.config.country == 'gb') { this.log('You may have an older TiVo box. TiVo boxes are not supported by %s', PLUGIN_NAME); }
					}

					// wait for personalization data to load then see how many devices were found
					wait(5*1000).then(() => { 

						// show feedback for devices found
						if (!this.devices || !this.devices[0].settings) {
							this.log('Failed to find any devices. The backend systems may be down, or you have no supported devices on your customer account')
						} else {
							// at least one device found
							var logText = "Found %s device";
							if (this.devices.length > 1) { logText = logText + "s"; }
							this.log(logText, this.devices.length);
							this.log('Discovery completed');

							// user config tip showing all found devices
							// as a workaround until I make a config setup json
							let tipText = '';
							for (let i = 0; i < this.devices.length; i++) {
								if (!tipText == '') { tipText = tipText + ',\n'; }
								tipText = tipText + ' {\n';
								tipText = tipText + '   "deviceId": "' + this.devices[i].deviceId + '",\n';
								tipText = tipText + '   "deviceNameAtRestart": "' + this.devices[i].settings.deviceFriendlyName + '"\n';
								tipText = tipText + ' }';
							}
							this.log('Config tip: Add these lines to your Homebridge ' + PLATFORM_NAME + ' config if you wish to customise your device config: \n"devices": [\n' + tipText + '\n]');

							// setup each device in turn, as we can only setup the accessory after the session is created and the physicalDevices are retrieved
							for (let i = 0; i < this.devices.length; i++) {
								const deviceName = this.devices[i].settings.deviceFriendlyName;
								// setup each device (runs once per device)
								this.log("Device %s: [%s] %s", i+1, deviceName, this.devices[i].deviceId);

								// generate a constant uuid that will never change over the life of the accessory
								const uuid = api.hap.uuid.generate(this.devices[i].deviceId + PLUGIN_ENV);

								// check the accessory was not restored from cache
								var accessory = this.accessories.find(accessory => accessory.UUID === uuid)
								if (!accessory) {
									this.log("Accessory not found in Homebridge cache, creating new accessory for", this.devices[i].deviceId + PLUGIN_ENV);

									// create a new accessory
									//const device = this.devices[i];
									//const accessoryName = device.settings.deviceFriendlyName;
									//const accessory = new this.api.platformAccessory(accessoryName, uuid);

									// data stored on the context object will persist through restarts
									//accessory.context.devices = this.devices;
									//accessory.context.session = this.session;

									// register the accessory
									//api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

									// configure the accessory
									this.stbDevices[i] = new stbDevice(this.log, this.config, this.api, accessory, this, i, true);

								} else {
									// The entire Accessory, Service and Characteristic structure is restored, so you don't need to re-create the services and characteristics.
									// but I think not for External accessories...
									this.log("Accessory found in cache:", accessory.displayName, this.devices[i].deviceId + PLUGIN_ENV);
									accessory.context.devices = this.devices;
									accessory.context.session = this.session;
									this.stbDevices[i] = new stbDevice(this.log, this.config, this.api, accessory, this, i, false);
								}	

							}

							// now get the Jwt Token which triggers the mqtt client
							this.getJwtToken(this.session.username, this.session.oespToken, this.session.customer.householdId);

						}
					});
				}
			});

			// the session watchdog creates a session when none exists, and recreates one if it ever fails
			// required in case the session ever fails due to no internet or an error
			this.checkSessionInterval = setInterval(this.sessionWatchdog.bind(this),SESSION_WATCHDOG_INTERVAL_MS);
			
			// the mqtt watchdog attempts a reconnect when the mqtt connection fails
			// required as the server disconnects the client after a period of inactivity
			this.checkMqttInterval = setInterval(this.mqttWatchdog.bind(this),MQTT_WATCHDOG_INTERVAL_MS);

			// check for a channel list update every MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S seconds
			// the next update time is held in 
			this.checkChannelListInterval = setInterval(this.loadMasterChannelList.bind(this),MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S * 1000);

			
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


  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START session handler (web)
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// select the right session to create
	async createSession(country) {
		switch(country.toLowerCase()) {
			case 'be-nl': case 'be-fr':
				this.getSessionBE(); break;
			case 'gb':
				this.getSessionGB(); break;
			case 'ie':
				this.getSessionIE(); break;
			default:
				this.getSession();
			}
	}

	// get session
	async getSession() {
		this.log('Creating %s session...', PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;

		const axiosConfig = {
			method: 'POST',
			url: countryBaseUrlArray[this.config.country] + '/session',
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
		
		this.log('Step 1 of 1 logging in with username %s', this.config.username);
		this.log.debug('Step 1 of 1: post login to',axiosConfig.url);
		axiosWS(axiosConfig)
			.then(response => {	
				this.log('Step 1 of 1: response:',response.status, response.statusText);
				this.session = response.data;
				if (this.session.customer) { currentSessionState = sessionState.AUTHENTICATED; }
				this.log('Session created');
				currentSessionState = sessionState.CREATED;
				return true;
			})
			.catch(error => {
				currentSessionState = sessionState.NOT_CREATED;
				if (!error.response) {
					this.log('Failed to create session - check your internet connection.');
				} else if (error.response.status >= 400 && error.response.status < 500) {
					this.log('Failed to create session - check your %s username and password: %s %s', PLATFORM_NAME, error.response.status, error.response.statusText);
				} else if (error.response.status >= 500 && error.response.status < 600) {
					this.log('Failed to create session - try again later: %s %s', error.response.status, error.response.statusText);
				} else {
					this.log('Failed to create session:', error.response.status, error.response.statusText);
				}
				this.log.debug('getSession: error:', error);
				currentSessionState = sessionState.NOT_CREATED;
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
		*/
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

		// ensure the default POST headers are cleared
		axiosWS.defaults.headers.post = {};

		// Step 1: # get authentication details
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country] + '/authorization';
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
						this.log('Step 3 of 7 logging in with username %s', this.config.username);
						this.log.debug('Step 3 of 7: post login to',BE_AUTH_URL);
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
								this.log('Step 3 of 7: response:',response.status, response.statusText);
								//this.log('Step 3 response.headers.location:',response.headers.location); 
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
									this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
									currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
								} else if (url.indexOf('error=session_expired') > 0 ) {
									this.log.warn('Step 3 of 7: Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
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
												currentSessionState = sessionState.NOT_CREATED;
												return false;						
											}

											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 of 7: Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else {

												// Step 5: # obtain authorizationCode
												this.log('Step 5 of 7: extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('Step 5 of 7: location url empty!');
													currentSessionState = sessionState.NOT_CREATED;
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
															var sessionUrl = countryBaseUrlArray[this.config.country] + '/session';
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
																	currentSessionState = sessionState.CREATED;
																	return true;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 of 7: Unable to get OESP token:", error.response.status, error.response.statusText);
																	this.log.debug("Step 7 of 7: Unable to get OESP token:",error);
																	currentSessionState = sessionState.NOT_CREATED;
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 of 7: Unable to authorize with oauth code:", error.response.status, error.response.statusText);
															this.log.debug("Step 6 of 7: Unable to authorize with oauth code:",error);
															currentSessionState = sessionState.NOT_CREATED;
														});	
													};
												};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 of 7: Unable to oauth authorize:", error.response.status, error.response.statusText);
											this.log.debug("Step 4 of 7: Unable to oauth authorize:",error);
											currentSessionState = sessionState.NOT_CREATED;
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 of 7: Unable to login:", error.response.status, error.response.statusText);
								this.log.debug("Step 3 of 7: Unable to login:",error);
								currentSessionState = sessionState.NOT_CREATED;
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 of 7: Could not get authorizationUri", error.response.status, error.response.statusText);
						this.log.debug("Step 2 of 7: Could not get authorizationUri:",error);
						currentSessionState = sessionState.NOT_CREATED;
					});
			})
			// Step 1 http errors
			.catch(error => {
				if (!error.response) {
					this.log('Step 1 of 7: Failed to create BE session - check your internet connection.');
				} else {
					this.log('Step 1 of 7: Failed to create BE session:', error.response.status, error.response.statusText);
				}
				this.log.debug('Step 1 of 7: getSessionBE: error:', error);
				currentSessionState = sessionState.NOT_CREATED;
			});

		currentSessionState = sessionState.NOT_CREATED;
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
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers, '\nWithCredentials:', req.withCredentials, 
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
		let apiAuthorizationUrl = countryBaseUrlArray[this.config.country] + '/authorization';
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
				this.log.debug('Step 1 of 7 results: authState',authState);
				this.log.debug('Step 1 of 7 results: authAuthorizationUri',authAuthorizationUri);
				this.log.debug('Step 1 of 7 results: authValidtyToken',authValidtyToken);

				// Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
				this.log('Step 2 of 7 get AUTH cookie');
				this.log.debug('Step 2 of 7 get AUTH cookie from',authAuthorizationUri);
				axiosWS.get(authAuthorizationUri, {
						jar: cookieJar,
						ignoreCookieErrors: true // ignore the error triggered by the Domain=mint.dummydomain cookie
					})
					.then(response => {	
						this.log('Step 2 of 7 response:',response.status, response.statusText);
						//this.log.warn('Step 2 of 7 response.data',response.data); // an html logon page
		
						// Step 3: # login
						this.log('Step 3 of 7 logging in with username %s', this.config.username);
						//this.log('Cookies for the auth url:',cookieJar.getCookies(GB_AUTH_URL));
						currentSessionState = sessionState.LOGGING_IN;

						// we just want to POST to 
						// 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
						const GB_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
						this.log.debug('Step 3 of 7 POST request will contain this data: {"username":"' + this.config.username + '","credential":"' + this.config.password + '"}');
						axiosWS(GB_AUTH_URL,{
						//axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
							jar: cookieJar,
							ignoreCookieErrors: true, // ignore the error triggered by the Domain=mint.dummydomain cookie
							data: '{"username":"' + this.config.username + '","credential":"' + this.config.password + '"}',
							method: "POST",
							// minimum headers are "accept": "*/*",
							headers: {
								"accept": "application/json; charset=UTF-8, */*",
							//	"accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
							//	"authorization": 'Atmosphere atmosphere_app_id="AEM_UK"',
							//	"content-type": "application/json; charset=UTF-8",
							//	"sec-ch-ua": '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
							//	"sec-ch-ua-mobile": "?0",
							//	"sec-fetch-dest": "empty",
							//	"sec-fetch-mode": "cors",
							//	"sec-fetch-site": "same-origin",	
							//	"referrer": "https://id.virginmedia.com/sign-in/?protocol=oidc",
							//	"referrerPolicy": "strict-origin-when-cross-origin",
							//	"mode": "cors",											
							},
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK. GB returns 200
							},
							})
							.then(response => {	
								this.log('Step 3 of 7 response:',response.status, response.statusText);
								this.log.debug('Step 3 of 7 response.headers:',response.headers); 
								this.log.debug('Step 3 of 7 response.data:',response.data);

								//this.log('Step 3 of 7 response.headers:',response.headers);
								var url = response.headers['x-redirect-location']
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionGB: Step 3: x-redirect-location url empty!');
									currentSessionState = sessionState.NOT_CREATED;
									return false;						
								}								
								//location is h??=... if success
								//location is https?? if not authorised
								//location is https:... error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7 Unable to login: wrong credentials');
								} else if (url.indexOf('error=session_expired') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7 Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									currentSessionState = sessionState.NOT_CREATED;	// flag the session as dead
								} else {
									this.log.debug('Step 3 of 7 login successful');

									// Step 4: # follow redirect url
									this.log('Step 4 of 7 follow redirect url');
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 of 7 response:',response.status, response.statusText);
											this.log.debug('Step 4 of 7 response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											this.log.debug('Step 4 of 7 response.data:',response.data);
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('getSessionGB: Step 4 of 7 location url empty!');
												currentSessionState = sessionState.NOT_CREATED;
												return false;						
											}								
			
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 of 7 Unable to login: wrong credentials');
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 of 7 Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else {

												// Step 5: # obtain authorizationCode
												this.log('Step 5 of 7 extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 5: location url empty!');
													currentSessionState = sessionState.NOT_CREATED;
													return false;						
												}								
				
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 of 7 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 of 7 authorizationCode OK');
													this.log.debug('Step 5 of 7 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log('Step 6 of 7 post auth data with valid code');
													this.log.debug('Step 6 of 7 post auth data with valid code to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													var payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 of 7 response:',response.status, response.statusText);
															this.log.debug('Step 6 of 7 response.data:',response.data);
															
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															this.log.debug('Step 6 of 7 refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log('Step 7 of 7 post refreshToken request');
															this.log.debug('Step 7 of 7 post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country] + '/session';
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 of 7 response:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																	
																	this.log.debug('Step 7 of 7 response.headers:',response.headers); 
																	this.log.debug('Step 7 of 7 response.data:',response.data); 
																	this.log.debug('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.session = response.data;
																	
																	// get device data from the session
																	this.session = response.data;
																	currentSessionState = sessionState.CREATED;
																	this.log('Session created');
																	return true;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 of 7 Unable to get OESP token:",error.response.status, error.response.statusText);
																	this.log.debug("Step 7 of 7 error:",error);
																	currentSessionState = sessionState.NOT_CREATED;
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 of 7 Unable to authorize with oauth code, http error:",error);
															currentSessionState = sessionState.NOT_CREATED;
														});	
												};
											};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 of 7 Unable to oauth authorize:",error.response.status, error.response.statusText);
											this.log.debug("Step 4 of 7 error:",error);
											currentSessionState = sessionState.NOT_CREATED;
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 of 7 Unable to login:",error.response.status, error.response.statusText);
								this.log.debug("Step 3 of 7 error:",error);
								currentSessionState = sessionState.NOT_CREATED;
							});
					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 of 7 Unable to get authorizationUri:",error.response.status, error.response.statusText);
						this.log.debug("Step 2 of 7 error:",error);
						currentSessionState = sessionState.NOT_CREATED;
					});
			})
			// Step 1 http errors
			.catch(error => {
				this.log('Failed to create GB session - check your internet connection.');
				this.log.warn("Step 1 of 7 Could not get apiAuthorizationUrl:",error.response.status, error.response.statusText);
				this.log.debug("Step 1 of 7 error:",error);
				currentSessionState = sessionState.NOT_CREATED;
			});

		currentSessionState = sessionState.NOT_CREATED;
	}



	// get session for IE only (special logon sequence)
	getSessionIE() {
		// this code is a copy of the gb session code, adapted for ie
		this.log('Creating %s IE session...',PLATFORM_NAME);
		currentSessionState = sessionState.LOADING;

		//var cookieJarGB = new cookieJar();

		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
		// axios interceptors to log request and response for debugging
		// works on all following requests in this sub
		axiosWS.interceptors.request.use(req => {
			this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
			this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
			'\nMethod:',req.method, '\nURL:', req.url, 
			'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers, '\nWithCredentials:', req.withCredentials, 
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
		// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


		// Step 1: # get authentication details
		// normal /authorization does not work for IE:
		// [{"type":"state","code":"authorizationNotSupported","reason":"invalid"}]

		// first step posts here:
		// https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web/session?token=true
		//let apiAuthorizationUrl = countryBaseUrlArray[this.config.country] + '/authorization';
		// Step 1: # get session page (might not be needed)
		this.log('Step 1 of 7 getting session page');
		axiosWS('https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web/session',{
			jar: cookieJar,
			ignoreCookieErrors: true,
			method: "GET",
			headers: {
				"accept": "application/json",
				"content-type": "application/json",
				"sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
				"sec-ch-ua-mobile": "?0",
				"x-client-id": "1.4.30.5||Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36"
			},
			referrer: "https://www.virginmediatv.ie/",
			referrerPolicy: "strict-origin-when-cross-origin",
			mode: "cors",
			credentials: "omit",
			maxRedirects: 0, // do not follow redirects
			})		
			.then(response => {	
				this.log('Step 1 of 7 response:',response.status, response.statusText);
				this.log.warn('Step 1 of 7 response.data',response.data);
				this.log.warn('Step 1 of 7 response.headers',response.headers);
				
				// get the data we need for further steps
				let auth, authState, authAuthorizationUri, authValidtyToken;
				/*
				let auth = response.data;
				let authState = auth.session.state;
				let authAuthorizationUri = auth.session.authorizationUri;
				let authValidtyToken = auth.session.validityToken;
				//this.log.debug('Step 1 of 7 results: authState',authState);
				//this.log.debug('Step 1 of 7 results: authAuthorizationUri',authAuthorizationUri);
				//this.log.debug('Step 1 of 7 results: authValidtyToken',authValidtyToken);
				*/

				// Step 3: # login, POST to
				// https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web/session?token=true
				currentSessionState = sessionState.LOGGING_IN;
				const IE_LOGIN_URL = 'https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web/session?token=true';
				this.log('Step 2 of 7 logging in with username %s', this.config.username);
				axiosWS(IE_LOGIN_URL,{
					//jar: cookieJar,
					//ignoreCookieErrors: true,
					//{username: "sadadasd", password: "asdasdadads"}
					//data: { username: this.config.username + '","password":"' + this.config.password + '"}',
					data: { username: this.config.username , password: this.config.password },
					method: "POST",
					headers: {
						"accept": "application/json",
						"content-type": "application/json",
						"Connection": "keep-alive",
						"Origin": "https://www.virginmediatv.ie",
						"Referer": "https://www.virginmediatv.ie/",
						"sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
						"sec-ch-ua-mobile": "?0",
						"sec-fetch-dest": "empty",
						"sec-fetch-mode": "cors",
						"sec-fetch-site": "cross-site",
						"x-client-id": "1.4.30.5||Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36"
					},
					//maxRedirects: 0, // do not follow redirects
					})
					.then(response => {	
						this.log('Step 2 of 7 response:',response.status, response.statusText);
						this.log.warn('Step 2 of 7 response.headers',response.headers);
						this.log.warn('Step 2 of 7 response.data',response.data);
		
						// Step 3: # login
						this.log('Step 3 of 7 some next step...');
						//this.log('Cookies for the auth url:',cookieJar.getCookies(GB_AUTH_URL));


						/*
						// we just want to POST to 
						// 'https://web-api-pepper.horizon.tv/oesp/v3/IE/eng/web/session/session?token=true';
						const IE_AUTH_URL = 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
						//this.log.debug('Step 3 of 7 POST request will contain this data: {"username":"' + this.config.username + '","password":"' + this.config.password + '"}');
						axiosWS(IE_AUTH_URL,{
							jar: cookieJar,
							ignoreCookieErrors: true,
							data: '{"username":"' + this.config.username + '","password":"' + this.config.password + '"}',
							method: "POST",
						*/
							// minimum headers are "accept": "*/*",
						
						//	headers: {
						//		"accept": "application/json; charset=UTF-8, */*",
								
						//	},
						/*
							maxRedirects: 0, // do not follow redirects
							validateStatus: function (status) {
								return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK. GB returns 200
							},
							})
							.then(response => {	
								this.log('Step 3 of 7 response:',response.status, response.statusText);
								this.log.debug('Step 3 of 7 response.headers:',response.headers); 
								this.log.debug('Step 3 of 7 response.data:',response.data);

								//this.log('Step 3 of 7 response.headers:',response.headers);
								var url = response.headers['x-redirect-location']
								if (!url) {		// robustness: fail if url missing
									this.log.warn('getSessionGB: Step 3: x-redirect-location url empty!');
									currentSessionState = sessionState.NOT_CREATED;
									return false;						
								}								
								//location is h??=... if success
								//location is https?? if not authorised
								//location is https:... error=session_expired if session has expired
								if (url.indexOf('authentication_error=true') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7 Unable to login: wrong credentials');
								} else if (url.indexOf('error=session_expired') > 0 ) { // >0 if found
									this.log.warn('Step 3 of 7 Unable to login: session expired');
									cookieJar.removeAllCookies();	// remove all the locally cached cookies
									currentSessionState = sessionState.NOT_CREATED;	// flag the session as dead
								} else {
									this.log.debug('Step 3 of 7 login successful');

									// Step 4: # follow redirect url
									this.log('Step 4 of 7 follow redirect url');
									axiosWS.get(url,{
										jar: cookieJar,
										maxRedirects: 0, // do not follow redirects
										validateStatus: function (status) {
											return ((status >= 200 && status < 300) || status == 302) ; // allow 302 redirect as OK
											},
										})
										.then(response => {	
											this.log('Step 4 of 7 response:',response.status, response.statusText);
											this.log.debug('Step 4 of 7 response.headers.location:',response.headers.location); // is https://www.telenet.be/nl/login_success_code=... if success
											this.log.debug('Step 4 of 7 response.data:',response.data);
											//this.log('Step 4 response.headers:',response.headers);
											url = response.headers.location;
											if (!url) {		// robustness: fail if url missing
												this.log.warn('getSessionGB: Step 4 of 7 location url empty!');
												currentSessionState = sessionState.NOT_CREATED;
												return false;						
											}								
			
											// look for login_success?code=
											if (url.indexOf('login_success?code=') < 0 ) { // <0 if not found
												this.log.warn('Step 4 of 7 Unable to login: wrong credentials');
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else if (url.indexOf('error=session_expired') > 0 ) {
												this.log.warn('Step 4 of 7 Unable to login: session expired');
												cookieJar.removeAllCookies();	// remove all the locally cached cookies
												currentSessionState = sessionState.NOT_CREATED;;	// flag the session as dead
											} else {

												// Step 5: # obtain authorizationCode
												this.log('Step 5 of 7 extract authorizationCode');
												url = response.headers.location;
												if (!url) {		// robustness: fail if url missing
													this.log.warn('getSessionGB: Step 5: location url empty!');
													currentSessionState = sessionState.NOT_CREATED;
													return false;						
												}								
				
												var codeMatches = url.match(/code=(?:[^&]+)/g)[0].split('=');
												var authorizationCode = codeMatches[1];
												if (codeMatches.length !== 2 ) { // length must be 2 if code found
													this.log.warn('Step 5 of 7 Unable to extract authorizationCode');
												} else {
													this.log('Step 5 of 7 authorizationCode OK');
													this.log.debug('Step 5 of 7 authorizationCode:',authorizationCode);

													// Step 6: # authorize again
													this.log('Step 6 of 7 post auth data with valid code');
													this.log.debug('Step 6 of 7 post auth data with valid code to',apiAuthorizationUrl);
													currentSessionState = sessionState.AUTHENTICATING;
													var payload = {'authorizationGrant':{
														'authorizationCode':authorizationCode,
														'validityToken':authValidtyToken,
														'state':authState
													}};
													axiosWS.post(apiAuthorizationUrl, payload, {jar: cookieJar})
														.then(response => {	
															this.log('Step 6 of 7 response:',response.status, response.statusText);
															this.log.debug('Step 6 of 7 response.data:',response.data);
															
															auth = response.data;
															//var refreshToken = auth.refreshToken // cleanup? don't need extra variable here
															this.log.debug('Step 6 of 7 refreshToken:',auth.refreshToken);

															// Step 7: # get OESP code
															this.log('Step 7 of 7 post refreshToken request');
															this.log.debug('Step 7 of 7 post refreshToken request to',apiAuthorizationUrl);
															payload = {'refreshToken':auth.refreshToken,'username':auth.username};
															var sessionUrl = countryBaseUrlArray[this.config.country] + '/session';
															axiosWS.post(sessionUrl + "?token=true", payload, {jar: cookieJar})
																.then(response => {	
																	this.log('Step 7 of 7 response:',response.status, response.statusText);
																	currentSessionState = sessionState.VERIFYING;
																	
																	this.log.debug('Step 7 of 7 response.headers:',response.headers); 
																	this.log.debug('Step 7 of 7 response.data:',response.data); 
																	this.log.debug('Cookies for the session:',cookieJar.getCookies(sessionUrl));

																	// get device data from the session
																	this.session = response.data;
																	
																	// get device data from the session
																	this.session = response.data;
																	currentSessionState = sessionState.CREATED;
																	this.log('Session created');
																	return true;
																})
																// Step 7 http errors
																.catch(error => {
																	this.log.warn("Step 7 of 7 Unable to get OESP token:",error.response.status, error.response.statusText);
																	this.log.warn("Step 7 of 7 error:",error);
																	currentSessionState = sessionState.NOT_CREATED;
																});
														})
														// Step 6 http errors
														.catch(error => {
															this.log.warn("Step 6 of 7 Unable to authorize with oauth code, http error:",error);
															currentSessionState = sessionState.NOT_CREATED;
														});	
												};
											};
										})
										// Step 4 http errors
										.catch(error => {
											this.log.warn("Step 4 of 7 Unable to oauth authorize:",error.response.status, error.response.statusText);
											this.log.warn("Step 4 of 7 error:",error);
											currentSessionState = sessionState.NOT_CREATED;
										});
								};
							})
							// Step 3 http errors
							.catch(error => {
								this.log.warn("Step 3 of 7 Unable to login:",error.response.status, error.response.statusText);
								this.log.warn("Step 3 of 7 error:",error);
								currentSessionState = sessionState.NOT_CREATED;
							});

							*/

					})
					// Step 2 http errors
					.catch(error => {
						this.log.warn("Step 2 of 7 Unable to login:",error.response.status, error.response.statusText);
						this.log.warn("Step 2 of 7 error:",error);
						currentSessionState = sessionState.NOT_CREATED;
					});
			})
			// Step 1 http errors
			.catch(error => {
				this.log('Failed to create IE session - check your internet connection.');
				this.log.warn("Step 1 of 7 Could not get session page:",error.response.status, error.response.statusText);
				this.log.debug("Step 1 of 7 error:",error);
				currentSessionState = sessionState.NOT_CREATED;
			});

		currentSessionState = sessionState.NOT_CREATED;
	}	


	// load all available TV channels at regular intervals into an array
	async loadMasterChannelList(callback) {
		// called by loadMasterChannelList (state handler), thus runs at polling interval

		// exit immediately if the session was not created due to maybe bad username & password
		if (!this.session) { 
			if (this.config.debugLevel > 1) { this.log.warn('loadMasterChannelList: Session does not yet exist, exiting'); }
			return;
		 }

		// exit immediately if channel list has not expired
		if (this.channelListExpiryDate > Date.now()) {
			if (this.config.debugLevel > 0) {
				this.log.warn('loadMasterChannelList: Master channel list has not expired yet. Next refresh will occur after %s', this.channelListExpiryDate.toLocaleString());
			}
			return false;
		}

		if (this.config.debugLevel > 0) {
			this.log.warn('loadMasterChannelList: Refreshing master channel list...');
		}

		// only continue if a session was created. If the internet conection is down then we have no session
		//if (currentSessionState != sessionState.CREATED) { return; }
		
		// channels can be retrieved for the country without having a mqtt session going  but then the list is not relevant for the user's locationId
		// so you should add the user's locationId as a parameter, and this needs the oespToken
		// syntax:
		// https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/channels?byLocationId=41043&includeInvisible=true&includeNotEntitled=true&personalised=true&sort=channelNumber
		let url = countryBaseUrlArray[this.config.country] + '/channels';
		url = url + '?byLocationId=' + this.session.locationId // locationId needed to get user-specific list
		url = url + '&includeInvisible=true' // includeInvisible
		url = url + '&includeNotEntitled=true' // includeNotEntitled
		url = url + '&personalised=true' // personalised
		url = url + '&sort=channelNumber' // sort
		if (this.config.debugLevel > 2) {
			this.log.warn('loadMasterChannelList: loading inputs from',url);
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
					this.log.warn('loadMasterChannelList: Processing %s channels...', response.data.totalResults);
				}
				this.channelListExpiryDate = new Date(response.data.expires);
			
				// load the channel list with all channels found
				this.masterChannelList = [];
				const channels = response.data.channels;
				for(let i=0; i<channels.length; i++) {
					const channel = channels[i];
					this.masterChannelList.push({
						channelId: channel.stationSchedules[0].station.serviceId, 
						channelNumber: channel.channelNumber, 
						channelName: channel.title, 
						channelListIndex: i
					});
				}
					
				if (this.config.debugLevel > 0) {
					this.log.warn('loadMasterChannelList: Master channel list refreshed with %s channels, valid until %s', response.data.totalResults, this.channelListExpiryDate.toLocaleString());
				}
				return true;

			})
			.catch(error => {
				let errText, errReason;
				errText = 'Failed to load the master channel list - check your internet connection.'
				if (error.isAxiosError) { errReason = error.code + ': ' + (error.hostname || ''); }
				this.log('%s %s', errText, (errReason || ''));

				if (!error.isAxiosError) { 
					this.log.warn(`loadMasterChannelList error:`, error);	
				}

				this.log.debug(`loadMasterChannelList error:`, error);
				return error;
			});
	}

	sessionWatchdog() {
		// the session watchdog creates a session when none exists
		// runs every few seconds. 
		// If session exists: Exit immediately
		// If no session exists: prepares the session, then prepares the device
		if (this.config.debugLevel > 2) { this.log.warn('sessionWatchdog'); }


		// exit immediately if session has any state other than NOT_CREATED
		if (currentSessionState !== sessionState.NOT_CREATED) { return; }

		// create a session, passing the country value
		this.createSession(this.config.country);

		// async wait a few seconds for the session to load, then continue
		wait(10*1000).then(() => { 

			// only continue with mqtt if a session was actually created
			if (currentSessionState !== sessionState.CREATED) { return; }

			// must refresh Personalization Data before creating mqtt session
			this.getPersonalizationData('profiles'); // async function
			this.getPersonalizationData('devices'); // async function

			// wait for personalization data to load then see how many devices were found
			wait(3*1000).then(() => { 
				// now get the Jwt Token which triggers the mqtt client
				this.getJwtToken(this.session.username, this.session.oespToken, this.session.customer.householdId);
			});

		}).catch((error) => { 
			this.log.error("sessionWatchdog: Error", error); 
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
		if (currentSessionState !== sessionState.CREATED) {
			this.log.warn('Cannot get JWT token: currentSessionState incorrect:', currentSessionState);
			return false;
		}
		if (!oespToken) {
			this.log.warn('Cannot get JWT token: oespToken not set');
			return false;
		}

		const jwtAxiosConfig = {
			method: 'GET',
			url: countryBaseUrlArray[this.config.country] + '/tokens/jwt',
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
				this.log.warn('getJwtToken error:', error);
				return false;
			});			
	}


	// start the mqtt client and handle mqtt messages
	startMqttClient(parent, mqttUsername, mqttPassword) {
		if (this.config.debugLevel > 0) { 
			this.log('Starting mqttClient...'); 
		}
		if (currentSessionState !== sessionState.CREATED) {
			this.log.warn('Cannot start mqttClient: currentSessionState incorrect:', currentSessionState);
			return false;
		}


		// create mqtt client instance and connect to the mqttUrl
		const mqttUrl = mqttUrlArray[this.config.country];
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: mqttUrl:', mqttUrl ); 
		}
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: Creating mqttClient object with username %s, password %s', mqttUsername ,mqttPassword ); 
		}
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: mqttClientId,
			username: mqttUsername,
			password: mqttPassword
		});
		if (this.config.debugLevel > 2) { 
			this.log.warn('startMqttClient: mqttUrl connect request sent' ); 
		}

		
		// mqtt client event: connect
		mqttClient.on('connect', function () {
			parent.log("mqttClient: Connected:", mqttClient.connected);

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
			parent.mqttSetHgoOnlineRunning(mqttUsername);

			
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
				parent.getUiStatus(device.deviceId);
			});

			// ++++++++++++++++++++ mqttConnected +++++++++++++++++++++
			


			// mqtt client event: message received
			mqttClient.on('message', function (topic, payload) {
				// store some mqtt diagnostic data
				parent.lastMqttMessageReceived = Date.now();

				parent.mqttSessionActive = true;
				let mqttMessage = JSON.parse(payload);
				if (parent.config.debugLevel > 0) {
					parent.log.warn('mqttClient: Received Message: \r\nTopic: %s\r\nMessage: \r\n%s', topic, mqttMessage);
				}

				// variables for just in this function
				var deviceId, currPowerState, currMediaState, currChannelId, currSourceType;

				// and request the UI status for each device
				// 14.03.2021 does not respond, disabling for now...
				/*
				parent.devices.forEach((device) => {
					// send a getuiStatus request
					parent.getUiStatus(device.deviceId);
				});
				*/

				// handle personalizationService messages
				// Topic: Topic: 107xxxx_ch/personalizationService
				// Message: { action: 'OPS.getProfilesUpdate', source: '3C36E4-EOSSTB-00365657xxxx', ... }
				// Message: { action: 'OPS.getDeviceUpdate', source: '3C36E4-EOSSTB-00365657xxxx', deviceId: '3C36E4-EOSSTB-00365657xxxx' }
				if (topic.includes(mqttUsername + '/personalizationService')) {
					if (mqttMessage.action == 'OPS.getProfilesUpdate') {
						if (parent.config.debugLevel > 0) { parent.log('mqttClient: got personalizationService message, calling getPersonalizationData for profiles'); }
						parent.getPersonalizationData('profiles'); // async function
						//parent.refreshAccessoryChannelList();
					} else if (mqttMessage.action == 'OPS.getDeviceUpdate') {
						if (parent.config.debugLevel > 0) { parent.log('mqttClient: got personalizationService message, calling getPersonalizationData for devices'); }
						deviceId = mqttMessage.deviceId;
						parent.getPersonalizationData('devices/' + deviceId); // async function
					}
				}

				
				// handle status messages for the STB
				// Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx/status
				// Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-00365657xxxx","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
				if (topic.includes('/status')) {
					if (mqttMessage.deviceType == 'STB') {
						if (parent.config.debugLevel > 0) { parent.log.warn('mqttClient: STB status: Detecting Power State: Received Message of deviceType %s for %s', mqttMessage.deviceType, mqttMessage.source); }
						// sometimes a rogue empty message appears without a mac or ipAddress, so ensure a mac is always present
						if (mqttMessage.mac.length > 0) {
							deviceId = mqttMessage.source;
							// mac address is present, we have a valid message
							if (mqttMessage.state == 'ONLINE_RUNNING') { 				// ONLINE_RUNNING: power is on
								currPowerState = Characteristic.Active.ACTIVE; 
							} else { 													// default off for ONLINE_STANDBY or OFFLINE_NETWORK_STANDBY or OFFLINE
								currPowerState = Characteristic.Active.INACTIVE;
								currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
							}
						}
					}
				}

				
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

							// get channelId (current playing channel) from linear TV
							// playerState.sourceType
							// linear = normal TV
							// reviewbuffer = delayed buffered TV playback
							// replay = replay TV
							// nDVR = playback from saved program (Digital Video Recorder)
							// Careful: source is not always present in the data
							if (playerState.source) {
								currChannelId = playerState.source.channelId || NO_INPUT_ID;
								if (parent.config.debugLevel > 0) {
									let currentChannelName; // let is scopt to the current {} block
									let curChannel = parent.masterChannelList.find(channel => channel.channelId === currChannelId); 
									if (curChannel) { currentChannelName = curChannel.channelName; }
									parent.log.warn('mqttClient: Detected mqtt channelId: %s [%s]', currChannelId, currentChannelName);
								}
							}
							break;

						case 'apps':
							//parent.log('mqttClient: apps: Detected mqtt app channelId: %s', cpeUiStatus.appsState.id);
							//parent.log("mqttClient: apps: Detected mqtt app appName %s", cpeUiStatus.appsState.appName);
							// we get id and appName here, load to the channel list...
							// useful for YouTube and Netflix
							// check if the channel exists in the master channel list, if not, push it, using the user-defined name if one exists
							currChannelId = cpeUiStatus.appsState.id;
							var foundIndex = parent.masterChannelList.findIndex(channel => channel.channelId === currChannelId); 
							if (foundIndex == -1) {
								parent.log("App %s discovered. Adding to the master channel list at index %s with channelId %s", cpeUiStatus.appsState.appName, parent.masterChannelList.length, currChannelId);
								// for easy identification, make the channelNumber app10000 + the index number
								parent.masterChannelList.push({
									channelId: currChannelId, 
									channelNumber: 'app' + (10000 + parent.masterChannelList.length), 
									channelName: cpeUiStatus.appsState.appName, 
									channelListIndex: parent.masterChannelList.length
								});
								
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
				parent.mqttDeviceStateHandler(deviceId, currPowerState, currMediaState, currChannelId, currSourceType);
				
			}); // end of mqtt client event: message received



			// mqtt client event: close
			// Emitted after a disconnection.
			mqttClient.on('close', function () {
				parent.log.warn('mqttClient: Connection closed');
				parent.log.warn('mqttClient: Connected:', mqttClient.connected);
				mqttClient.end();
				parent.mqttSessionActive = false;
				return false;
			});

			// mqtt client event: reconnect
			// Emitted when a reconnect starts.
			mqttClient.on('reconnect', function () {
				parent.log.warn('mqttClient: Connected:', mqttClient.connected);
				parent.log.warn('mqttClient: Reconnecting');
			});
			
			// mqtt client event: disconnect 
			// Emitted after receiving disconnect packet from broker. MQTT 5.0 feature.
			mqttClient.on('disconnect', function () {
				parent.log.warn('mqttClient: Connected:', mqttClient.connected);
				parent.log.warn('mqttClient: Disconnecting');
			});
			
			// mqtt client event: offline
			// Emitted when the client goes offline.
			mqttClient.on('offline', function () {
				parent.log.warn('mqttClient: Connected:', mqttClient.connected);
				parent.log.warn('mqttClient: Client is offline');
			});

			// mqtt client event: error
			// Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs.
			mqttClient.on('error', function(err) {
				parent.log.warn('mqttClient: Error:', err);
				mqttClient.end();
				return false;
			});

		}); // end of mqttClient.on('connect'... event

	} // end of startMqttClient


	mqttWatchdog() {
		// the mqtt watchdog reconnects the mqtt connection if it should ever fail
		// needed as the server disconnects the session eventually
		if (this.config.debugLevel > 2) { this.log.debug('mqttWatchdog'); }

		// exit immediately if session has any state other than CREATED
		if (currentSessionState !== sessionState.CREATED) { 
			this.log.debug("mqttWatchdog: Session does not exist");
			return; 
		}

		// attempt reconnect only if object exists and current connection is reported as not connected
		if (mqttClient) { 
			this.log.debug("mqttWatchdog: mqttClient connected:", mqttClient.connected);
			if (mqttClient.connected == false) { 

				// attempt a reconnect, uses the same options as connect()
				this.log.debug("mqttWatchdog: Attempting reconnect. mqttClient.connected:", mqttClient.connected);
				mqttClient.reconnect;
		
				// async wait a few seconds for the connection to exist, then log the result
				wait(2*1000).then(() => { 

					this.log.debug("mqttWatchdog: After reconnect attempt. mqttClient.connected:", mqttClient.connected);
					if (mqttClient.connected) { return; }
		
				}).catch((error) => { 
					this.log.error("mqttWatchdog: Error", error); 
				});
			}
	
		} else {
			this.log.debug("mqttWatchdog: mqttClient object does not exist");
		}
	}


	// handle the state change of the device, calling the updateDeviceState of the relevant device
	mqttDeviceStateHandler(deviceId, powerState, mediaState, channelId, sourceType) {
		if (this.config.debugLevel > 1) { 
			this.log.warn('deviceStateHandler: deviceId %s, powerState %s, mediaState %s, channelId %s, sourceType %s', deviceId, powerState, mediaState, channelId, sourceType); 
		}
		if (this.devices) {
			const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
			if (deviceIndex > -1) { 
				this.stbDevices[deviceIndex].updateDeviceState(powerState, mediaState, channelId, sourceType); 
			}
		}
	}


	// publish an mqtt message, with logging, to help in debugging
	mqttPublishMessage(Topic, Message, Options) {
		// Syntax: {'test1': {qos: 0}, 'test2': {qos: 1}}
		if (this.config.debugLevel > 0) { this.log.warn('mqttPublishMessage: Publish Message:\r\nTopic: %s\r\nMessage: %s\r\nOptions: %s', Topic, Message, Options); }
		mqttClient.publish(Topic, Message, Options)
	}

	// subscribe to an mqtt message, with logging, to help in debugging
	mqttSubscribeToTopic(Topic, Qos) {
		if (this.config.debugLevel > 0) { this.log.warn('mqttSubscribeToTopic: Subscribe to topic:', Topic); }
		mqttClient.subscribe(Topic, function (err) {
			if(err){
				this.log('mqttClient connect: subscribe to %s Error %s:', Topic, err);
				return true;
			}
		});
	}

	// start the HGO session
	mqttSetHgoOnlineRunning(mqttUsername) {
		if (this.config.debugLevel > 0) { this.log.warn('mqttSetHgoOnlineRunning'); }
		if (mqttUsername) {
			this.mqttPublishMessage(
				mqttUsername + '/' + mqttClientId + '/status', 
				'{"source":"' +  mqttClientId + '","state":"ONLINE_RUNNING","deviceType":"HGO"}',
				'{"qos":1,"retain":"true"}'
			);
		}
	}

	// send a channel change request to the settopbox via mqtt
	switchChannel(deviceId, deviceName, channelId, channelName) {
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
	}

	// set the media state of the settopbox via mqtt
	// controlled by speed
	// speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
	setMediaState(deviceId, deviceName, channelId, speed) {
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
	}

	// setPlayerPosition via mqtt
	// move forwards or backwards through the buffer
	// Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx
	// Message: {"id":"8b8g26joaa","type":"CPE.setPlayerPosition","source":"qcanbxjfg4cq3n99i2lmi94f9nl47v","status":{"relativePosition":410985}}
	// Retain: false, QOS: 0
	setPlayerPosition(deviceId, deviceName, relativePosition) {
		if (this.config.debugLevel > 0) { this.log.warn('setPlayerPosition: deviceId:', deviceId); }
		if (mqttUsername) {
			this.mqttPublishMessage(
			mqttUsername + '/' + deviceId, 
			'{"id":"' + makeId(10) + '","type":"CPE.setPlayerPosition","source":{"clientId":"' + mqttClientId 
			+ '","status":{"relativePosition":' + relativePosition + '}}"' ,
			'{"qos":0}'
			);
		}
	}


	// return to live TV
	returnToLiveTv(deviceId, deviceName) {
		if (this.config.debugLevel > 0) { this.log.warn('returnToLiveTv'); }
		if (mqttUsername) {
			this.mqttPublishMessage(
			mqttUsername + '/' + deviceId, 
			'{"id":"' + makeId(10) + '","type":"CPE.KeyEvent","source":"' + mqttClientId 
			+ '","status":{"w3cKey":"TV","eventType":"keyDownUp"}}',
			'{"qos":0}'
			);
		}
	}

	// send a remote control keypress to the settopbox via mqtt
	sendKey(deviceId, deviceName, keyName) {
		if (this.config.debugLevel > 0) { this.log.warn('sendKey keyName %s, deviceName %s, deviceId %s', keyName, deviceName, deviceId); }
		if (mqttUsername) {
			this.log('Send key %s to %s', keyName, deviceName);
			this.log.debug('Send key %s to %s %s', keyName, deviceName, deviceId);
			this.mqttPublishMessage(
				mqttUsername + '/' + deviceId, 
				'{"id":"' + makeId(10) + '","type":"CPE.KeyEvent","source":"' + mqttClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}',
				'{"qos":0}'
			);
		}
		
	}


	// get the settopbox UI status from the settopbox via mqtt
	getUiStatus(deviceId) {
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
	}



	// get the Personalization Data via web request GET
	async getPersonalizationData(requestType, callback) {
		if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData requestType:', requestType); }
		const url = personalizationServiceUrlArray[this.config.country].replace("{householdId}", this.session.customer.householdId) + '/' + requestType;
		const config = {headers: {"x-cus": this.session.customer.householdId, "x-oesp-token": this.session.oespToken, "x-oesp-username": this.session.username}};
		if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: GET %s', url); }
		// this.log('getPersonalizationData: GET %s', url);
		axiosWS.get(url, config)
			.then(response => {	
				if (this.config.debugLevel > 0) { this.log.warn('getPersonalizationData: %s: response: %s %s', requestType, response.status, response.statusText); }
				if (this.config.debugLevel > 2) { this.log.warn('getPersonalizationData: %s: response: %s', requestType, response.data); }
				if (requestType.includes('profiles')) { 
					this.profiles = response.data; // set this.profiles to the profile data we just received
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
								this.mqttDeviceStateHandler(deviceId); // update one device
							}
						});

					} else {
						// data for a single device, find and update the device
						const deviceId = response.data.deviceId;
						const deviceIndex = this.devices.findIndex(device => device.deviceId == deviceId)
						if (deviceIndex > -1) { 
							this.stbDevices[deviceIndex].device = response.data; 
							this.mqttDeviceStateHandler(deviceId); // update one device
						}
				
					}
					if (this.config.debugLevel > 2) { this.log.warn('getPersonalizationData: %s: response.data.settings: %s', requestType, response.data.settings); }

				}
				return false;
			})
			.catch(error => {
				this.log.warn('getPersonalizationData for %s failed: %s %s', requestType, error.response.status, error.response.statusText);
				/*
				switch (error.response.status) {
					case 403:
						this.log.warn('getPersonalizationData failed with %s %s. The device may have relinquished the connection to another controller.',error.response.status, error.response.statusText);
					default:
						this.log.warn('getPersonalizationData failed:', error.response.status, error.response.statusText);
				}
				*/
				this.log.debug('getPersonalizationData for %s: error:', requestType, error);
				return false, error;
			});		
		return false;
	}

	// set the Personalization Data for the current device via web request PUT
	async setPersonalizationDataForDevice(deviceId, deviceSettings, callback) {
		if (this.config.debugLevel > 0) { this.log.warn('setPersonalizationDataForDevice: deviceSettings:', deviceSettings); }
		const url = personalizationServiceUrlArray[this.config.country].replace("{householdId}", this.session.customer.householdId) + '/devices/' + deviceId;
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
	// build the device. Runs once on restart
	constructor(log, config, api, accessory, platform, accessoryIndex, createNewAccessory) {
		this.log = log;
		this.config = config;
		this.api = api;
		this.accessory = accessory;
		this.platform = platform;
		this.device = platform.devices[accessoryIndex];
		this.accessoryIndex = accessoryIndex;

		this.deviceId = this.device.deviceId

		// set default name on restart
		this.name = this.device.settings.deviceFriendlyName + PLUGIN_ENV; // append _DEV environment

		// allow user override via config
		if (this.config.devices) {
			const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice && configDevice.name) { this.name = configDevice.name; }
		}


		// show some user feedback
		const maxDevices = platform.devices.length;
		this.log("Setting up device %s of %s: %s", accessoryIndex + 1, maxDevices, this.name);

		
		// ++++++++++++++++ plugin setup ++++++++++++++++
		// setup arrays
		this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
		this.channelListHomeKit = [];	// loaded channels, as shown in the Home app. Limited to 96
		this.inputServices = [];		// loaded input services, used by the accessory, as shown in the Home app. Limited to 96
		this.configuredInputs = [];		// a list of inputs that have been renamed by the user. EXPERIMENTAL

		//setup variables
		this.mqttSessionActive = false;		// true when the mqtt session is active
		this.lastPowerKeySent;				// stores when the power key was sent last to help in de-bounce
		this.targetMediaState = Characteristic.TargetMediaState.STOP; // default until received by mqtt
		this.createAccessoryAttempt;
		this.creatingAccessory; 		// true during device setup
		this.accessoryConfigured;		// true when the accessory is configured

		// initial states. Will be updated by mqtt messages
		this.currentPowerState = Characteristic.Active.INACTIVE;
		this.previousPowerState = Characteristic.Active.INACTIVE;
		this.currentChannelId = NO_CHANNEL_ID;
		this.currentMediaState = Characteristic.CurrentMediaState.STOP;
		this.targetMediaState = Characteristic.CurrentMediaState.STOP;
		this.currentSourceType = 'UNKNOWN';
		this.volDownLastKeyPress = [];

		// do an initial profile channel update, required to configure the accessory
		this.refreshAccessoryChannelList(this.deviceId)


		// ++++++++++++++++ plugin setup done ++++++++++++++++
		this.creatingAccessory = false;
		this.accessoryConfigured = false;
		this.prepareAccessory();
		this.log('%s: Initialization completed', this.name);

		//this.setupDevice(0); 

		//		for (let i = 0; i < 10; i++) {
			//setTimeout(this.setupDevice.bind(this, i),i * 1000); // attempt every 1 second
//		};


		
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

	}


	setupDevice() {
		// setup the accessory device (may be more than one)
		// call this after the session has been loaded and the list of devices has been retrieved
		if (this.config.debugLevel > 2) {
			this.log.warn('setupDevice %s: currentSessionState %s this.creatingAccessory %s this.accessoryConfigured %s', this.deviceIndex, currentSessionState, this.creatingAccessory, this.accessoryConfigured);
		}

		// exit immediately if session has any state other than NOT_CREATED
		if (currentSessionState !== sessionState.CREATED) { 
			if (this.config.debugLevel > 2) { this.log.warn('setupDevice %s: session not created yet, exiting', this.deviceIndex); }
			return; 
		}

		/*
		// exit immediately if device setup is still running
		if (this.creatingAccessory) { 
			if (this.config.debugLevel > 2) { this.log.warn('setupDevice %s: attempt %s: device setup not yet completed, exiting', this.deviceIndex, attemptIndex, this.creatingAccessory); }
			return; 
		}

		// exit immediately if accessory has already been created
		if (this.accessoryConfigured) { 
			if (this.config.debugLevel > 2) { this.log.warn('setupDevice %s: attempt %s: accessory already configured %s, exiting', this.deviceIndex, attemptIndex, this.accessoryConfigured); }
			return; 
		}
		*/

		this.creatingAccessory = true;
		wait(3*1000).then(() => { 
			if (!this.accessoryConfigured) { 
				this.prepareAccessory();
				this.log('%s: Initialization completed', this.name);

			}
		});

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


		// set default to no input
		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(NO_INPUT_ID)
		this.creatingAccessory = false;
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
			case '3C36E4':
				manufacturer = 'ARRIS [' + (this.device.platformType || '') + ']';
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

		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService
			.setCharacteristic(Characteristic.ConfiguredName, this.name)
			.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
			.setCharacteristic(Characteristic.CurrentMediaState, Characteristic.CurrentMediaState.STOP)
			.setCharacteristic(Characteristic.TargetMediaState, Characteristic.TargetMediaState.STOP);
				
		this.televisionService.getCharacteristic(Characteristic.ConfiguredName)
			.on('get', this.getDeviceName.bind(this))
			.on('set', (newName, callback) => { this.setDeviceName(newName, callback); });

		this.televisionService.getCharacteristic(Characteristic.Active)
			.on('get', this.getPower.bind(this))
			.on('set', this.setPower.bind(this));

		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInput.bind(this))
			.on('set', (newInputIdentifier, callback) => { this.setInput(this.channelListHomeKit[newInputIdentifier], callback); });

		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));

		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		this.televisionService.getCharacteristic(Characteristic.CurrentMediaState)
			.on('get', this.getCurrentMediaState.bind(this));

		this.televisionService.getCharacteristic(Characteristic.TargetMediaState)
			.on('get', this.getTargetMediaState.bind(this))
			.on('set', (newMediaState, callback) => { this.setTargetMediaState(newMediaState, callback); });

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

		// limit the amount of max channels to load. Hard limit 96.
		// Total services = absolute max 99 services (all types)
		// robustness: hard limit to 96 (channels 0...94) in case user does a stupid config
		var maxSources = Math.min(MAX_INPUT_SOURCES, 95);

		// get a custom configDevice if one exists, used for adding channelNumber
		let configDevice;
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			 // update maxSources only if found
			if (configDevice) { 
				this.log.debug("prepareInputSourceServices: config found for configDevice.maxChannels:", configDevice.maxChannels);
				// get any custom maxChannels, set per device. Caution: maxChannels max not exist!
				maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
			}
		}

		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// must create all input sources before accessory is published (no way to dynamically add later)
		this.log.debug("prepareInputSourceServices: maxSources", maxSources);

		this.log.debug("prepareInputSourceServices: loading channels from this.channelListHomeKit, length:", this.channelListHomeKit.length);
		for (let i = 0; i < maxSources; i++) {
			if (this.config.debugLevel > 2) {
				this.log.warn('prepareInputSourceServices Adding service',i);
			}

			// default values to hide the input if nothing exists in this.channelListHomeKit
			var chName = 'HIDDEN';
			var chId = 'HIDDEN_' + i;
			var visState = Characteristic.CurrentVisibilityState.HIDDEN;
			var configState = Characteristic.IsConfigured.NOT_CONFIGURED;

			// get names and channel id from the array
			if (i < this.channelListHomeKit.length) {
				chName = this.channelListHomeKit[i].channelName;
				chId = this.channelListHomeKit[i].channelId;
				visState = Characteristic.CurrentVisibilityState.SHOWN;
				configState = Characteristic.IsConfigured.CONFIGURED;
				  

				// show channel number if user chose to do so
				if (configDevice && configDevice.showChannelNumber) {
					chName = ('0' + (i + 1)).slice(-2) + " " + chName;
				}
			}

			
			

			// some channels are deliberately hidden, so assign a fictional channelId and disable them
			if (chName == 'HIDDEN') {
				chId = 'HIDDEN_' + i;
				visState = Characteristic.CurrentVisibilityState.HIDDEN;
				configState = Characteristic.IsConfigured.NOT_CONFIGURED;
			}

			//this.log.warn('prepareInputSourceServices Adding service %s chId %s chName %s visState %s configState %s',i, chId, chName, visState, configState);

			//const inputService = new Service.InputSource(i, 'inputSource_' + 1 + '_' + chId);
			// Service.InputSource(Identifier, subType, name);
			this.log.debug("prepareInputSourceServices: Adding input %s with chId %s, chName %s", i, chId, chName);
			const inputService = new Service.InputSource(i, 'input_' + chId, chId);
			inputService
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.ConfiguredName, chName || `Input ${i < 9 ? `0${i + 1}` : i + 1}`)
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION)
				.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
				.setCharacteristic(Characteristic.IsConfigured, configState)
				.setCharacteristic(Characteristic.CurrentVisibilityState, visState)
				//.setCharacteristic(Characteristic.TargetVisibilityState, visState);

			inputService.getCharacteristic(Characteristic.ConfiguredName)
				.on('get', (callback) => { this.getInputName(i, callback); })
				.on('set', (value, callback) => { this.setInputName(i, value, callback); });

			/*
			// on hold for now
			inputService.getCharacteristic(Characteristic.TargetVisibilityState)
				.on('get', (callback) => { this.getInputVisibilityState(i, callback) })
				.on('set', (value, callback) => { this.setInputVisibilityState(i, value, callback); });
			*/

			this.inputServices.push(inputService);
			this.accessory.addService(inputService);
			this.televisionService.addLinkedService(inputService);

		} // end of for loop getting the inputSource
	}
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of preparing accessory and services
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
















	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// START regular device update functions
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++

	// update the device state changed to async
	async updateDeviceState(powerState, mediaState, channelId, sourceType, callback) {
		// runs at the very start, and then every few seconds, so don't log it unless debugging
		// doesn't get the data direct from the settop box, but rather: gets it from the this.currentPowerState and this.currentChannelId variables
		// which are received by the mqtt messages, which occurs very often
		if (this.config.debugLevel > 0) {
			this.log.warn('%s: updateDeviceState: powerState %s, mediaState %s [%s], channelId %s, sourceType %s', 
				this.name, 
				powerState, 
				mediaState, mediaStateName[mediaState], 
				channelId,
				sourceType
			);
		}

		// grab the input variables
		this.previousPowerState = this.currentPowerState;
		if (powerState != null) { this.currentPowerState = powerState; }
		if (mediaState != null) { this.currentMediaState = mediaState; }
		if (channelId != null) { this.currentChannelId = channelId; }
		if (sourceType != null) { this.currentSourceType = sourceType; }

		// debugging, helps a lot to see channelName
		if (this.config.debugLevel > 0) {
			let currentChannelName; // let is scopt to the current {} block
			let curChannel;
			if (this.platform.masterChannelList) {
				curChannel = this.platform.masterChannelList.find(channel => channel.channelId === channelId); 
			}
			if (curChannel) { currentChannelName = curChannel.channelName; }
			this.log.warn('%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentChannelId %s [%s], currentSourceType %s', 
				this.name, 
				this.currentPowerState, 
				this.currentMediaState, mediaStateName[this.currentMediaState], 
				this.currentChannelId, currentChannelName,
				this.currentSourceType
			);
		}

		// only continue if a session was created. If the internet conection is down then we have no session
		if (currentSessionState != sessionState.CREATED) { return null; }

		// change only if configured, and update only if changed
		if (this.televisionService) {

			// set device name if changed, it may have changed due to personalisation update
			// new name is always in this.device.settings.deviceFriendlyName; 
			//this.log('updateDeviceState this.name %s, this.device.settings.deviceFriendlyName %s', this.name, this.device.settings.deviceFriendlyName );
			var oldDeviceName = this.name;
			var currentDeviceName = this.device.settings.deviceFriendlyName + PLUGIN_ENV;;

			var syncName = true; // default true		
			if (this.config.devices) {
				const configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
				if (configDevice && configDevice.syncName == false ) { syncName = configDevice.syncName; }
			}
			if (syncName == true && oldDeviceName !== currentDeviceName) {
				this.log('%s: Device name changed from %s to %s', 
					this.name,
					oldDeviceName, 
					currentDeviceName);
				this.name = currentDeviceName;
				this.televisionService.getCharacteristic(Characteristic.ConfiguredName).updateValue(currentDeviceName);
			}
			
			// check for change of power state
			// The accessory changes state immediately, and the box takes time to catch up
			// so store an old box state so we have something to log
			//this.log("Previous device power state: %s %s", this.previousPowerState, powerStateName[this.previousPowerState]);
			//this.log("Current device power state: %s %s", this.televisionService.getCharacteristic(Characteristic.Active).value, powerStateName[this.televisionService.getCharacteristic(Characteristic.Active).value]);
			//this.log("Wanted device power state: %s %s", this.currentPowerState, powerStateName[this.currentPowerState]);
			//var oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
			if (this.previousPowerState !== this.currentPowerState) {
				this.log('%s: Power changed from %s %s to %s %s', 
					this.name,
					this.previousPowerState, powerStateName[this.previousPowerState],
					this.currentPowerState, powerStateName[this.currentPowerState]);
				this.televisionService.getCharacteristic(Characteristic.Active).updateValue(this.currentPowerState);
			}
			
			// check for change of active identifier (channel)
			const oldActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
			var currentActiveIdentifier = this.inputServices.findIndex( InputSource => InputSource.subtype == 'input_' + this.currentChannelId );
			this.log.debug("updateDeviceState: oldActiveIdentifier %s, currentActiveIdentifier %s, this.currentChannelId %s", oldActiveIdentifier, currentActiveIdentifier, this.currentChannelId)
			if (currentActiveIdentifier == -1) { currentActiveIdentifier = NO_INPUT_ID; } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
			if (oldActiveIdentifier !== currentActiveIdentifier) {
				// get names from loaded channel list. Using Ch Up/Ch Down buttons on the remote rolls around the profile channel list
				// what happens if the TV is change to another profile?
				var oldName = NO_CHANNEL_NAME, newName = oldName; // default to UNKNOWN
				if (oldActiveIdentifier != NO_INPUT_ID && this.channelListHomeKit[oldActiveIdentifier]) {
					oldName = this.channelListHomeKit[oldActiveIdentifier].channelName
				}
				if (currentActiveIdentifier != NO_INPUT_ID) {
					newName = this.channelListHomeKit[currentActiveIdentifier].channelName
				}
				this.log('%s: Channel changed from %s %s to %s %s', 
					this.name,
					oldActiveIdentifier + 1, oldName,
					currentActiveIdentifier + 1, newName);
				this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(currentActiveIdentifier);
			}

			// check for change of current media state
			var oldMediaState = this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).value;
			if (oldMediaState !== this.currentMediaState) {
				this.log('%s: Media state changed from %s %s to %s %s', 
					this.name,
					oldMediaState, mediaStateName[oldMediaState],
					this.currentMediaState, mediaStateName[this.currentMediaState]);
			}
			this.televisionService.getCharacteristic(Characteristic.CurrentMediaState).updateValue(this.currentMediaState);

		}
		return null;
	}


	// refresh the Accessory channel list that shows in the Home app
	async refreshAccessoryChannelList(callback) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: refreshAccessoryChannelList', this.name); }
		this.log("%s: Refreshing profile channel list...", this.name);
		
		// exit if no session exists
		if (currentSessionState != sessionState.CREATED) { 
			this.log.warn('%s: refreshAccessoryChannelList: Session not yet created, exiting', this.name);
			return; 
		}

		// exit if no master channel list loaded yet (on platform level)
		if (!this.platform.channelListExpiryDate) { 
			this.log.warn('%s: refreshAccessoryChannelList: master channel list not yet loaded, exiting', this.name);
			return; 
		}

		// limit the amount of max channels to load. Hard limit 96.
		var maxSources = Math.min(MAX_INPUT_SOURCES, 95);

		//this.loadedProfileId = this.platform.profiles.findIndex(profile => profile.name === this.config.profile);
		/*
		this.log("%s: Loading profile: %s", this.name, this.config.profile);
		this.log("%s: config: %s", this.name, this.config);
		this.log("%s: config.devices: %s", this.name, this.config.devices);
		this.log("%s: looking for: %s", this.name, this.device.deviceId);
		*/

		if (this.config.debugLevel > 1) { this.log.warn("%s: Starting automatic channel list selection", this.name); }
		var chIds = [];
		var selectedProfileId = -1;
		var configDevice = {};
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
			if (configDevice) {
				// config for this device was found, get the profile name if it exists in the published profiles
				selectedProfileId = this.platform.profiles.findIndex(profile => profile.name === configDevice.profile);
				if (selectedProfileId > -1) {
					if (this.config.debugLevel > 1) { this.log.warn("%s: Valid profile found in config: '%s'", this.name, configDevice.profile); }
				}

				// get any custom maxChannels, set per device. Caution: maxChannels max not exist!
				maxSources = Math.min(configDevice.maxChannels || maxSources, maxSources);
			}
		}
		

		// if no configured profile found (does not exist or wrong name), use some smart logic to pick the best profile
		// first built a clean, sorted, subscribed channel list
		var subscribedChList = [];
		if (selectedProfileId == -1) {
			if (this.config.debugLevel > 1) { this.log.warn("%s: No profile found in config. Building a clean subscribed channel list", this.name); }
			// get a clean list of entitled channels (will not be in correct order)
			// some entitlements are not in the masterchannelList, these must be ignored
			if (this.config.debugLevel > 1) { this.log.warn("%s: Checking %s entitlements within %s channels in the master channel list", this.name, this.platform.session.entitlements.length, this.platform.masterChannelList.length); }
			this.platform.session.entitlements.forEach((chId) => {
				//this.log("Looking to load this chId %s", chId);
				// chId can be crid:~~2F~~2Fupcch.tv~~2FSV09170, so split at ~~2F to get SV09170
				const chIdParts = chId.split("~~2F");
				chId = chIdParts[chIdParts.length-1];
				// see if we can find this in the masterChannelList, if so add it
				var foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === chId);
				if ( foundIndex > -1 ) { subscribedChList.push( chId ); }
			});
			// the channels are not in the right sort order, so sort correctly
			this.platform.masterChannelList.forEach((channel) => {
				var foundIndex = subscribedChList.findIndex(chId => chId === channel.channelId);
				if ( foundIndex > -1 ) { chIds.push( channel.channelId ); }
			});
		}

		// smart default channel list selection
		// if the subscribed channel list fits, use it
		// otherwise, use the first found profile channel list that fits
		// otherwise, use the subscribed channel list, even if it doesn't fit
		if (selectedProfileId == -1) {
			if (this.config.debugLevel > 1) { this.log.warn("%s: Selecting best fit channel list", this.name); }
			if (subscribedChList.length <= maxSources) {
				// if the subscribed channel list fits, use it
				if (this.config.debugLevel > 1) { this.log.warn("%s: Selecting full subscribed channel list", this.name); }
				selectedProfileId = 0; // default channel list
			} else {
				// otherwise, use the first found profile channel list theat fits
				// check all available profiles and choose the first found with <90 channels
				if (this.config.debugLevel > 1) { this.log.warn("%s: Looking for best fit profile channel list within %s user profiles", this.name, this.platform.profiles.length-1); }
				for(let i=1; i<this.platform.profiles.length; i++) {
					if (this.config.debugLevel > 1) { this.log.warn("%s: Checking profile %s '%s' containing %s channels", this.name, i, this.platform.profiles[i].name, this.platform.profiles[i].favoriteChannels.length); }
					if (this.platform.profiles[i].favoriteChannels.length <= maxSources) {
						// found a profile that can be used
						if (this.config.debugLevel > 1) { this.log.warn("%s: Selecting profile '%s' with %s channels", this.name, this.platform.profiles[i].name, this.platform.profiles[i].favoriteChannels.length); }
						selectedProfileId = i;
						break;
					}
				}
			}

		}
		// default: if nothing can be found, use SharedProfile 0
		if (selectedProfileId == -1) {
			 selectedProfileId = 0;  // fallback to SharedProfile
			if (this.config.debugLevel > 1) { this.log.warn("%s: Defaulting to first %s channels from profile '%s'", this.name, maxSources, this.platform.profiles[selectedProfileId].name); }
		}
		// and now assign and display the selected profile id
		this.loadedProfileId = selectedProfileId;
		this.log("%s: Automatic channel list selector chose profile %s '%s'", this.name, this.loadedProfileId, this.platform.profiles[this.loadedProfileId].name);


		// determine what channels we need to load: user profile or shared Profile (master list)
		if (this.loadedProfileId > 0) {
			chIds = this.platform.profiles[this.loadedProfileId].favoriteChannels;
		} else {	
			// Default subscribed channels in Shared Profile, alread loaded to chIds
		}
		this.log("%s: Profile '%s' contains %s channels", this.name, this.platform.profiles[this.loadedProfileId].name, chIds.length);


		// recently viewed apps
		if (this.config.debugLevel > 1) { 
			this.log.warn("%s: refreshAccessoryChannelList: recentlyUsedApps", this.name, this.platform.profiles[this.loadedProfileId].recentlyUsedApps);
		}

		// get any renamed channels
		const renamedChannels = this.config.channelNames;

		// grab the current ActiveIdentifier, it might change during the channel refresh
		var currentActiveIdentifier = NO_INPUT_ID, currentChannelName = NO_CHANNEL_NAME;
		if (this.accessoryConfigured) { 
			currentActiveIdentifier = this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier).value;
		}
		if (currentActiveIdentifier != NO_INPUT_ID) {
			currentChannelName = this.inputServices[currentActiveIdentifier].getCharacteristic(Characteristic.ConfiguredName).value;
		}
		if (this.config.debugLevel > 1) { 
			this.log.warn("%s: refreshAccessoryChannelList: before channel refresh: this.currentChannelId %s currentActiveIdentifier %s currentChannelName %s", this.name, this.currentChannelId, currentActiveIdentifier, currentChannelName);
		}

		// limit the amount to load
		const chs = Math.min(chIds.length, maxSources);
		this.log("%s: Refreshing channels 1 to %s", this.name, chs);
		if (chs < maxSources) {
			this.log("%s: Hiding     channels %s to %s", this.name, chs + 1, maxSources);
		}

		// loop and load all channels from the chIds
		chIds.forEach((chId, i) => {
			// for ShareProfile, the i (loop index) is already the foundIndex, and chId is the entire channel record
			var chName;
			var foundIndex = -1; 
			
			// normalise the chId
			// can be "crid:~~2F~~2Fupcch.tv~~2FSV09170" or just "SVO9170"
			// split at ~~2F
			const oldChId = chId;
			const chIdParts = oldChId.split("~~2F");
			chId = chIdParts[chIdParts.length-1];
			if (oldChId.includes("~~2F")) { this.log("chId %s modified to chId %s", oldChId, chId); }

			// find the channel to load.
			var channel = {};
			var customChannel = [];
			
			// first look in the config channelNames list for any user-defined custom channel name
			if (configDevice && configDevice.channelNames) {
					customChannel = configDevice.channelNames.find(channel => channel.channelId === chId);
					if (!customChannel) { customChannel = []; }
			}
			if (customChannel.length > 0) {
				this.log("%s: Found %s in config channel list, setting name to %s", this.name, chId, customChannel.channelName);
			} else if (this.loadedProfileId > 0) {
				// user profile: look in the master channel list for the favorite channel
				this.log.debug("%s: Index %s: User profile: chId was taken from user profile list", this.name, i);
				//foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === chId); 
			} else {
				// shared profile: the channel is in the masterChannelList at index i
				this.log.debug("%s: Index %s: Shared profile: chId will be taken from master channel list", this.name, i);
				//channel = this.platform.masterChannelList[i]; 
			}

			// check if the chId exists in the master channel list, if not, push it, using the user-defined name if one exists, and channelNumber >10000
			this.log.debug("%s: Index %s: Finding chId %s in master channel list", this.name, i, chId);
			channel =this.platform.masterChannelList.find(channel => channel.channelId === chId); 
			//foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === chId); 
			if (!channel) {
				const newChName = customChannel.channelName || "Channel " + chId; 
				this.log("%s: Unknown channel %s [%s] discovered. Adding to the master channel list", this.name, chId, newChName);
				this.platform.masterChannelList.push({
					channelId: chId, 
					channelNumber: 10000 + this.platform.masterChannelList.length, 
					channelName: newChName, 
					channelListIndex: this.platform.masterChannelList.length
				});
				// refresh channel as the not found channel will now be in the masterChannelList
				channel =this.platform.masterChannelList.find(channel => channel.channelId === chId); 
				//foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === chId);  // update the index
			} else {
				// show some useful debug data
				this.log.debug("%s: Index %s: Found %s in master channel list", this.name, i, chId);
			}

			

			// load this channel as an input
			if (i < maxSources) {
				// get the channel
				//var channel = this.platform.masterChannelList[foundIndex];

				//this.log("channel to load (must be a single channel)", channel);

				// add the user-defined name if one exists
				if (customChannel && customChannel.channelName) { channel.channelName = customChannel.channelName; }

				// show debug and add to array
				this.log.debug("%s: Index %s: Refreshing channel %s: [%s] %s", this.name, i, ('0' + (i + 1)).slice(-2), chId, channel.channelName);
				this.channelListHomeKit[i] = channel;

				// show channel number if user chose to do so
				 if (configDevice && configDevice.showChannelNumber) {
					channel.channelName = ('0' + (i + 1)).slice(-2) + " " + channel.channelName;
				}

				// update accesory only when configured
				if (this.accessoryConfigured) { 
					const inputService = this.inputServices[i];
					// update existing services
					inputService.updateCharacteristic(Characteristic.ConfiguredName, channel.channelName);
					inputService.updateCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
					inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);
					inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.TargetVisibilityState.SHOWN);
					// check if the currentChannelName is still in the same place, if not, update the ActiveIdentifier
					if (channel.channelName == currentChannelName && currentActiveIdentifier != i) {
						this.log.warn("Updating ActiveIdentifier from %s to %s", currentActiveIdentifier, i);
						this.televisionService.updateCharacteristic(Characteristic.ActiveIdentifier, i);
					}
				}
			}
		});



				// add the recently used apps, if we are loading from a user profile
				/*
				if (this.loadedProfileId > 0) {
					// apps have a channel number starting with "app"
					var appsToload = this.platform.profiles[this.loadedProfileId].recentlyUsedApps;
					appsToload.forEach( (appId, i) => {
						this.log("loading app", i, appId);
						if (i < maxSources) {
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
		//this.log("channelListHomeKit pre filter:", this.channelListHomeKit);
		//var loadedChs = Math.min(chs, MAX_INPUT_SOURCES);
		//this.log("channelListHomeKit, filtering to first %s items", loadedChs);
		//this.channelListHomeKit = this.channelListHomeKit.filter((channel, index) => index < loadedChs)
		//this.log("channelListHomeKit post filter:", this.channelListHomeKit);
		for(let i=chs; i<maxSources; i++) {
			this.log.debug("Hiding channel", ('0' + (i + 1)).slice(-2));
			// array must stay same size and have elements that can be queried, but channelId and channelListIndex must never match valid entries
			// channelid mjust be unique
			this.channelListHomeKit[i] = {channelId: 'chId_' + i, channelNumber: 'none', channelName: 'HIDDEN', channelListIndex: 10000 + i}
			// this.channelListHomeKit.splice(i, 1); // remove array content at index i, results in empty items!
			
			// get service and hide it if it exists
			const inputService = this.inputServices[i];
			if (inputService) {
				//inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue("Input " + i + 1);
				//inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.NOT_CONFIGURED);
				inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDEN);
			}

		}

		this.log("%s: HomeKit channel list refreshed from profile '%s' with %s channels", this.name, this.platform.profiles[this.loadedProfileId].name, Math.min(chIds.length, maxSources));
		return false;

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
			this.log.warn('%s: getPower', this.name); 
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
			this.log.warn('%s: getDeviceName', this.name); 
			this.log.warn('%s: getDeviceName returning %s', this.name, this.name);
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
			// Device requires min 3 max 14 char names
			const MIN_NAME_LENGTH = 3; 
			const MAX_NAME_LENGTH = 14;

			// check name length and truncate and log if >MAX_NAME_LENGTH
			if (deviceName.length<MIN_NAME_LENGTH) {
				deviceName = (deviceName + deviceName + deviceName).slice(0,MIN_NAME_LENGTH);
				this.log("%s: Device name must be at least %s characters long, expanding to %s", this.name, MIN_NAME_LENGTH, deviceName);
			}
			if (deviceName.length>MAX_NAME_LENGTH) {
				deviceName = deviceName.slice(0,MAX_NAME_LENGTH);
				this.log("%s: Device name is limited to %s characters, truncating to %s", this.name, MAX_NAME_LENGTH, deviceName);
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
		this.log('Send Mute to %s ', this.name );

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
				this.log('Mute command not configured');
			}
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
		this.log('Send Volume %s to %s', (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up', this.name );

		// triple rapid VolDown presses triggers setMute
		var tripleVolDownPress = 100000; // default high value to prevent a tripleVolDown detection when no triple key pressed
		if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
			this.volDownLastKeyPress[2] = this.volDownLastKeyPress[1] || 0;
			this.volDownLastKeyPress[1] = this.volDownLastKeyPress[0] || 0;
			this.volDownLastKeyPress[0] = Date.now();
			tripleVolDownPress = this.volDownLastKeyPress[0] - this.volDownLastKeyPress[2];
			// check time difference between current keyPress and 2 keyPresses ago
			this.log.debug('setVolume: Timediff between volDownKeyPress[0] now and volDownKeyPress[2]: %s ms', this.volDownLastKeyPress[0] - this.volDownLastKeyPress[2]);
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
					this.log('%s: Set volume: Volume commands not configured', this.name);
				}
			}
		}
	}



	// get input (TV channel)
	async getInput(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in HomeKit and HomeKit requests a refresh
		// this.currentChannelId is updated by the polling mechanisn
		// must return a valid index, and must never return null
		if (this.config.debugLevel > 0) { this.log.warn('%s: getInput currentChannelId %s',this.name, this.currentChannelId); }

		// find the this.currentChannelId in the accessory inputs and return the inputindex once found
		// this allows HomeKit to show the selected current channel
		// as we cannot guarrantee the list order due to personalizationServices changing it at any time
		// we must search by input_channelId within the current accessory InputSource.subtype
		var currentChannelName = NO_CHANNEL_NAME;
		var currentActiveInput = this.inputServices.findIndex( InputSource => InputSource.subtype == 'input_' + this.currentChannelId );
		if (currentActiveInput == -1) { currentActiveInput = NO_INPUT_ID } // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
		if ((currentActiveInput > -1) && (currentActiveInput != NO_INPUT_ID)) { 
			currentChannelName = this.inputServices[currentActiveInput].getCharacteristic(Characteristic.ConfiguredName).value; 
		}
		if (this.config.debugLevel > 2) { 
			this.log.warn('%s: getInput returning input %s [%s %s]', this.name, currentActiveInput, this.currentChannelId, currentChannelName);
		}

		callback(null, currentActiveInput);
	}

	// set input (change the TV channel)
	async setInput(input, callback) {
		if (this.config.debugLevel > 2) { this.log.warn('%s: setInput input %s %s',this.name, input.channelId, input.channelName); }
		callback(null); // for rapid response
		var currentChannelName = NO_CHANNEL_NAME;
		const channel = this.platform.masterChannelList.find(channel => channel.channelId === this.currentChannelId);
		if (channel) { currentChannelName = channel.channelName; }
		this.log('%s: Change channel from %s %s to %s %s', this.name, this.currentChannelId, currentChannelName, input.channelId, input.channelName);
		this.platform.switchChannel(this.deviceId, this.name, input.channelId, input.channelName);
	}



	// get input name (the TV channel name)
	async getInputName(inputId, callback) {
		// fired by the user changing a channel name in Home app accessory setup
		// we cannot handle this as we don't know which channel got renamed
		// as user could name multiple channels to xxx
		if (this.config.debugLevel > 2) { this.log.warn('%s: getInputName inputId %s', this.name, inputId); }

		// need to read from stored cache, currently not implemented, TO-DO
		var chName = NO_CHANNEL_NAME; // must have a value
		if (this.channelListHomeKit[inputId]) {
			chName = this.channelListHomeKit[inputId].channelName;
		}
		if (this.config.debugLevel > 2) { 
			this.log.warn('%s: getInputName returning %s [%s]', this.name, chName, inputId);
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

		if (this.config.debugLevel > 2) { this.log.warn('%s: setInputName inputId %s inputName %s', this.name, inputId, newInputName); }
		const oldInputName = this.channelListHomeKit[inputId].channelName;
		this.log('%s: Renamed channel %s from %s to %s (valid only for HomeKit) (NOT YET IMPLEMENTED)', this.name, inputId+1, oldInputName, newInputName);
		callback(null);
	};



	// get input visibility state (of the TV channel in HomeKit)
	async getInputVisibilityState(inputId, callback) {
		if (this.config.debugLevel > 2) { this.log.warn('%s: getInputVisibilityState inputId %s', this.name, inputId); }
		var visState = Characteristic.CurrentVisibilityState.SHOWN;
		var visStateName = 'SHOWN';
		if (this.channelListHomeKit[inputId].channelName == 'HIDDEN') {
			visState = Characteristic.CurrentVisibilityState.HIDDEN;
			visStateName = 'HIDDEN';
		}
		// 0=SHOWN, 1=HIDDEN
		//this.log.warn('%s: getInputVisibilityState inputId %s returning %s %s', this.name, inputId, visState, visStateName);
		if (this.config.debugLevel > 2) {
			this.log.warn('%s: getInputVisibilityState returning %s [%s]', this.name, visState, visStateName);
		}
		callback(null, visState);
	}

	// set input visibility state (show or hide the TV channel)
	async setInputVisibilityState(inputId, inputVisState, callback) {
		if (this.config.debugLevel > 2) { this.log.warn('%s: setInputVisibilityState inputId %s inputVisState %s:', this.name, inputId, inputVisState); }
		//var foundIndex = this.platform.masterChannelList.findIndex(channel => channel.channelId === this.currentChannelId);
		//if (foundIndex > -1) { currentChannelName = this.platform.masterChannelList[foundIndex].channelName; }
		//this.log('Change channel from %s %s to %s %s', this.currentChannelId, currentChannelName, input.channelId, input.channelName);
		callback(null); // for rapid response
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
			this.log.warn('%s: getCurrentMediaState', this.name); 
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
			this.log.warn('%s: getTargetMediaState', this.name); 
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

	// set remote key
	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 1) { this.log.warn('%s: setRemoteKey remoteKey:',this.name, remoteKey); }
		callback(null); // for rapid response
		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 12, 13 & 14 are not defined by Apple

		// get any user-defined button remaps
		var configDevice, backButtonRemap, playPauseButtonRemap, infoButtonRemap, arrowUpRemap, arrowDownRemap;
		if (this.config.devices) {
			configDevice = this.config.devices.find(device => device.deviceId === this.deviceId);
		}
		if (configDevice) {
			backButtonRemap = configDevice.backButton;
			playPauseButtonRemap = configDevice.playPauseButton;
			infoButtonRemap = configDevice.infoButton;
			arrowUpRemap = configDevice.arrowUpButton;
			arrowDownRemap = configDevice.arrowDownButton;
		}

		var keyName;
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				keyName = 'MediaRewind'; break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				keyName = 'MediaFastForward'; break;
			case Characteristic.RemoteKey.NEXT_TRACK: // 2
				keyName = 'DisplaySwap'; break;
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				keyName = 'DisplaySwap'; break;

			case Characteristic.RemoteKey.ARROW_UP: // 4
				keyName = arrowUpRemap || 'ArrowUp'; 
				break;

			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				keyName = arrowDownRemap || 'ArrowDown'; 
				break;

			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				keyName = 'ArrowLeft'; break;
			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				keyName = 'ArrowRight'; break;
			case Characteristic.RemoteKey.SELECT: // 8
				keyName = 'Enter'; break;
			case Characteristic.RemoteKey.BACK: // 9
				keyName = backButtonRemap || "Escape"; 
				break;

			case Characteristic.RemoteKey.EXIT: // 10
				keyName = backButtonRemap || "Escape"; 
				break;

			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				keyName = playPauseButtonRemap || "MediaPause"; // others: MediaPlayPause
				break; 

			case Characteristic.RemoteKey.INFORMATION: // 15
				// this is the button that should be used to access the settop box menu. Options:
				// ContextMenu: 	same as the [...] button on the remote
				// Info: 			displays the INFO screenm same as the [...] button + Info on the remote
				// Help: 			displays the SETTINGS INFO page
				// Guide: 			displays the TV GUIDE page, same as the Guide button on the remote
				// MediaTopMenu: 	displays the top menu (home) page, same as the HOME button on the remote. DEFAULT
				keyName = infoButtonRemap || "MediaTopMenu"; // use for Menu button
				break; 

			}
		if (keyName) { this.platform.sendKey(this.deviceId, this.name, keyName); }
	}

  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	// END of accessory get/set charteristic handlers
  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++
	
};