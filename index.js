'use strict';

// ****************** start of EOS settings

// name and version
const PLUGIN_NAME = 'homebridge-eosstb';
const PLATFORM_NAME = 'eosstb';
const PLUGIN_VERSION = '0.0.5';


const mqtt = require('mqtt');  
const request = require('request-promise');
const qs = require('qs')
const _ = require('underscore');
const varClientId = makeId(30);

// having trouble with fetch due to cookies...
//const nodeFetch = require('node-fetch')
//const tough = require('tough-cookie')
//const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
//const fetch = require('fetch-cookie')(nodeFetch, new tough.CookieJar(), false) // default value is true
// false - doesn't ignore errors, throws when an error occurs in setting cookies and breaks the request and execution
// true - silently ignores errors and continues to make requests/redirections

// try axios instead of fetch
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



// different settop box names per country
const settopBoxName = {
    'nl':     'Mediabox Next (4K)',
    'ch':     'UPC TV Box',
    'be-nl':  'Telenet TV-Box',
    'be-fr':  'Telenet TV-Box',
    'at':     'Entertain Box 4K',
    'gb':     'Virgin Media 360'
};

// base url varies by country
const countryBaseUrlArray = {
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web', // v3 and v4 works
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/nld/web',
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v4/BE/fr/web',
    'at': 		'https://prod.oesp.magentatv.at/oesp/v4/AT/deu/web', // v3 and v4 works
    'gb':       'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web'
};

// session and jwt are based on countryBaseUrlArray
//const sessionUrl = 	'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/session';
//const channelsUrl = 'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/channels';
//const jwtUrl = 			'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/tokens/jwt';


// different mqtt endpoints per country
const mqttUrlArray = {
    'nl': 		'wss://obomsg.prod.nl.horizon.tv:443/mqtt',
    'ch': 		'wss://obomsg.prod.ch.horizon.tv:443/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'be-fr':  	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'at':		'wss://obomsg.prod.at.horizon.tv:443/mqtt',
    'gb':       'wss://obomsg.prod.gb.horizon.tv:443/mqtt'
};

// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = 'https://login.prd.telenet.be/openid/login.do';

// oidc logon url used in VirginMedia for gb sessions
const GB_AUTH_URL = 'https://id.virginmedia.com/sign-in/?protocol=oidc';

// settop box identifiers
let stbType = '';
let smartCardId = '';
let physicalDeviceId = '';

// general constants
const NO_INPUT = 999999; // an input id that does not exist
const MAX_INPUT_SOURCES = 90; // max input services. Default = 90. Cannot be more than 97 (100 - all other services)
const STB_STATE_POLLING_INTERVAL_MS = 5000; // pollling interval in millisec. Default = 5000


// exec spawns child process to run a bash script
var exec = require("child_process").exec;

let mqttClient = {};
let myUpcUsername;
let myUpcPassword;

let mqttUsername;
let mqttPassword;
let settopboxId;
let settopboxState;
let uiStatus;
let currentChannelId;
let currentPowerState;

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



function makeId(length) {
	let result	= '';
	let characters	= 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let charactersLength = characters.length;
	for ( let i = 0; i < length; i++ ) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
};


// ****************** end of EOS settings

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');


let Accessory, Characteristic, Service, Categories, UUID;

module.exports = (api) => {
	Accessory = api.platformAccessory;
	Characteristic = api.hap.Characteristic;
	Service = api.hap.Service;
	Categories = api.hap.Categories;
	UUID = api.hap.uuid;
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, eosstbPlatform, true);
};

class eosstbPlatform {
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
			this.log.warn('API event: didFinishLaunching');
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
	constructor(log, config, api) {
		this.log = log;
		this.api = api;
		this.config = config;

		//device configuration
		this.name = this.config.name || settopBoxName[this.config.country]; // market specific box name as default
		this.debugLevel = this.config.debugLevel;
		this.inputs = [];
		this.enabledServices = [];
		this.inputServices = [];
		this.playing = true;
		switch(this.config.accessoryCategory) {
			case 'receiver': case 'AUDIO_RECEIVER':
				this.accessoryCategory = Categories.AUDIO_RECEIVER;
				break;
			case 'television': case 'tv': case 'TV': case 'TELEVISION':
				this.accessoryCategory = Categories.TELEVISION;
				break;
			default:
				this.accessoryCategory = Categories.TV_SET_TOP_BOX;
		}

		//setup variables
		this.currentPowerState = false;
		this.mqtttSessionActive = false;
		this.prefDir = path.join(api.user.storagePath(), 'eos');

		//check if prefs directory ends with a /, if not then add it
		//not used zet
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

		

		//create a session
		switch(this.config.country) {
			case 'be-nl': case 'be-fr':
				this.getSessionBE(); break;
			case 'gb':
				this.getSessionBE(); break;
			default:
				this.getSession();
		}


		//get Device info from config or default
		this.manufacturer = config.manufacturer || 'ARRIS';
		this.modelName = config.modelName || 'DCX960';
		this.serialNumber = config.serialNumber || 'Unknown';
		this.firmwareRevision = config.firmwareRevision || '123';
		this.apiVersion = null;
		// Configuration
		myUpcUsername = this.config.username || '';
		myUpcPassword = this.config.password || '';


		// prepare the accessory using the data found during the session
		this.prepareAccessory();

		// load the inputs... or should this be inside prepareAccessory?
		this.setInput();
		
		//update device state
		// Check & Update Accessory Status every STB_STATE_POLLING_INTERVAL_MS (Default: 5000 ms)
		// this is the last step in the setup, now polling will occur every 5 seconds
		this.checkStateInterval = setInterval(this.updateDeviceState.bind(this),STB_STATE_POLLING_INTERVAL_MS);
	}



	//Prepare accessory
	prepareAccessory() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareAccessory');
		}
		//this.log('Categories.TV_SET_TOP_BOX',Categories.TV_SET_TOP_BOX);
		const accessoryName = this.name;
		const accessoryUUID = UUID.generate(accessoryName);
		this.accessory = new Accessory(accessoryName, accessoryUUID, this.accessoryCategory);

		this.prepareInformationService();	// service 1 of 100
		this.prepareTelevisionService();	// service 2 of 100
		this.prepareSpeakerService();		// service 3 of 100
		this.prepareInputServices();		// service 4...100 of 100

		this.startPrepareAccessory = false;
		this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
	}

	//Prepare information service
	prepareInformationService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareInformationService');
		}
		//this.getDeviceInfo();

		let manufacturer = this.manufacturer;
		let modelName = this.modelName;
		let serialNumber = this.serialNumber;
		let firmwareRevision = this.firmwareRevision;

		this.accessory.removeService(this.accessory.getService(Service.AccessoryInformation));
		const informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, manufacturer)
			.setCharacteristic(Characteristic.Model, modelName)
			.setCharacteristic(Characteristic.SerialNumber, serialNumber)
			.setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision);

		this.accessory.addService(informationService);
	}

	//Prepare television service
	prepareTelevisionService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareTelevisionService');
		}
		this.televisionService = new Service.Television(this.name, 'televisionService');
		this.televisionService.setCharacteristic(Characteristic.ConfiguredName, this.name);
		this.televisionService.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

		this.televisionService.getCharacteristic(Characteristic.Active)
			.on('get', this.getPower.bind(this))
			.on('set', this.setPower.bind(this));

		this.televisionService.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInputState.bind(this))
			.on('set', (inputIdentifier, callback) => {
				this.setInputState(this.inputs[inputIdentifier], callback);
			});

		this.televisionService.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.setRemoteKey.bind(this));

		this.televisionService.getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.setPowerModeSelection.bind(this));

		this.accessory.addService(this.televisionService);
	}

	//Prepare speaker service
	prepareSpeakerService() {
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareSpeakerService');
		}
		this.speakerService = new Service.TelevisionSpeaker(this.name + ' Speaker', 'speakerService');
		this.speakerService
			.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
		this.speakerService.getCharacteristic(Characteristic.VolumeSelector)  // the volume selector allows the iOS device keys to be used to change volume
			.on('set', (direction, callback) => {	this.setVolume(direction, callback); });
		this.speakerService.getCharacteristic(Characteristic.Volume)
			.on('get', this.getVolume.bind(this))
			.on('set', this.setVolume.bind(this));
		this.speakerService.getCharacteristic(Characteristic.Mute)
			//.on('get', this.getMute.bind(this))
			.on('set', this.setMute.bind(this));

		this.accessory.addService(this.speakerService);
		this.televisionService.addLinkedService(this.speakerService);
	}


	//Prepare input services
	prepareInputServices() {
		// This is the channel list, each input is a service, max 100 services less the services created so far
		if (this.config.debugLevel > 1) {
			this.log.warn('prepareInputServices');
		}
		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// absolute max 100 services (less those already loaded)
		let maxSources = this.config.maxChannels || MAX_INPUT_SOURCES;
		for (let i = 0; i < Math.min(maxSources, MAX_INPUT_SOURCES); i++) {
			this.inputService = new Service.InputSource(i, `inputSource_${i}`);

			this.inputService
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.ConfiguredName, `Input ${i < 9 ? `0${i + 1}` : i + 1}`)
				.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED) // initially not configured NOT_CONFIGURED. Testing with CONFIGURED
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TUNER)
				.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TUNER)
				// hidden until config is loaded my mqtt
				// CurrentVisibilityState and TargetVisibilityState: SHOWN = 0; HIDDEN = 1;
				.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN) // testing. should be HIDDDEN
				//.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN);

			this.inputService
				.getCharacteristic(Characteristic.ConfiguredName)
				.on('set', (value, callback) => {
					callback(null, value);
				}
			);

			// from my eos code
			if (this.config.debugLevel > 1) {
				this.log.warn('prepareInputServices Adding service',this.inputService.getCharacteristic(Characteristic.ConfiguredName));
			}

			this.inputServices.push(this.inputService);
			this.enabledServices.push(this.inputService);
			this.accessory.addService(this.inputService);
			this.televisionService.addLinkedService(this.inputService);

		} // end of for loop getting the inputSource
	}
	/* END: Prepare the Services */



  	//+++++++++++++++++++++++++++++++++++++++++++++++++++++


	async getSession() {
		if (this.config.debugLevel > 1) {
			this.log.warn('getSession');
		}
		this.log('Creating session');

		sessionRequestOptions.uri = countryBaseUrlArray[this.config.country].concat('/session');
		//this.log.warn('getSession sessionRequestOptions.uri:',sessionRequestOptions.uri);
		
		sessionRequestOptions.body.username = this.config.username;
		sessionRequestOptions.body.password = this.config.password;
		//this.log.warn('getSession: sessionRequestOptions',sessionRequestOptions);
		
		request(sessionRequestOptions)
			.then((json) => {
				//this.log(json);
				var sessionJson = json;
				//this.log('getSession: sessionJson.customer',sessionJson.customer);

				// get device data from the session
				stbType = sessionJson.customer.stbType;
				smartCardId = sessionJson.customer.smartCardId;
				physicalDeviceId = sessionJson.customer.physicalDeviceId;
				if (this.config.debugLevel > 0) {
					this.log.warn('getSession: sessionJson.customer',sessionJson.customer);			
				}

				// change from getJwtTokenReq to getJwtToken
				this.getJwtToken(sessionJson.oespToken, sessionJson.customer.householdId);
				this.log('Session created');
				return true;
			})
			.catch((err) => {
				this.log.warn('getSession Error:', err.message); // likely invalid credentials
				this.log.warn('getSession Error:', err);
			});
		//return sessionJson || false;
	}




	getSessionBE() {
		// only for be-nl and be-fr users, as the session logon using openid is different
		// looks like also for gb users:
		// https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
		if (this.config.debugLevel > 1) {
			this.log.warn('getSessionBE');
		}


		// axios interceptors to log request and response for debugging
		// works on all following requests (everywhere or in this sub?)
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
										//method: 'get',
										//url: url,
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
																	stbType	 = response.data.customer.stbType;
																	smartCardId = response.data.customer.smartCardId;
																	physicalDeviceId = response.data.customer.physicalDeviceId;

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
				this.log.warn("Step 1 Could not get apiAuthorizationUrl, http error:",error);
			});

		this.log.warn('end of getSessionBE');

		//return sessionJson || false;
	}





	getJwtToken(oespToken, householdId){
		// get a JSON web token from the supplied oespToken and householdId
		if (this.config.debugLevel > 1) {
			this.log.warn('getJwtToken version');
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
				this.startMqttClient(this);
			})
			.catch(error => {
				this.log.warn('getJwtToken error:', error);
				return false;
			});			
	}



	getJwtTokenReq(oespToken, householdId){
		// Request version, no ongr used as I'm migrating awaz from Request
		// get a JSON web token from the supplied oespToken and householdId
		this.log.warn('in getJwtTokenReq');
		const jwtRequestOptions = {
			method: 'GET',
			uri: countryBaseUrlArray[this.config.country].concat('/tokens/jwt'),
			headers: {
				'X-OESP-Token': oespToken,
				'X-OESP-Username': myUpcUsername
			},
			json: true
		};
		this.log.warn('jwtRequestOptions',jwtRequestOptions);

		request(jwtRequestOptions)
			.then(json => {
				jwtJson = json;
				mqttUsername = householdId;
				mqttPassword = jwtJson.token;
				this.startMqttClient(this);
			})
			.catch(function (err) {
				//this.log('getJwtTokenReq: ', err.message);
				return false;
			});
	}





	startMqttClient(parent) {
		if (parent.config.debugLevel > 1) {
			parent.log.warn('startMqttClient');		
		}
		let mqttUrl = mqttUrlArray[this.config.country];
		parent.log.warn('startMqttClient: connecting to',mqttUrl);		
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: varClientId,
			username: mqttUsername,
			password: mqttPassword
		});

		// mqtt client event: connect
		mqttClient.on('connect', function () {
			parent.log.debug('mqttClient: connect event');

			mqttClient.subscribe(mqttUsername, function (err) {
				if(err){
					parent.log('mqttClient subscribe: Error:',err);
					return false;
				} else {
					parent.log('Subscribed to',mqttUsername);
				}
			});

			mqttClient.subscribe(mqttUsername +'/+/status', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to status: Error:',err);
					return false;
				} else {
					parent.log('Subscribed to topic',mqttUsername +'/+/status');
				}
			});

			mqttClient.subscribe(mqttUsername +'/personalizationService', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to personalizationService: Error:',err);
					return false;
				} else {
					parent.log('Subscribed to topic',mqttUsername +'/personalizationService');
				}
			});
			
			/*
			mqttClient.subscribe(mqttUsername +'/watchlistService', function (err) {
				if(err){
					parent.log('mqttClient connect: subscribe to watchlistService: Error:',err);
					return false;
				} else {
					parent.log('Subscribed to topic',mqttUsername +'/watchlistService');
				}
			});
			*/
			
			// mqtt client event: message received
			mqttClient.on('message', function (topic, payload) {
				parent.log.warn('mqttClient message event');
				this.mqtttSessionActive = true;
				let payloadValue = JSON.parse(payload);
				
				// check if this status message is for the desired EOSSTB
				if(topic.startsWith(mqttUsername) && topic.includes('-EOSSTB-')){
					parent.log('mqtt EOSSTB topic detected:',topic)
				};
				//if(topic.includes(parent.config.settopboxId)){
				//	parent.log('Wanted EOSSTB topic detected:',topic)
				//};
				
				//parent.log('mqttClient: Received Message: Topic:',topic);
				//parent.log('mqttClient.on.message payload',payload);
				//if(topic = mqttUsername +'/personalizationService'){
				parent.log('mqttClient: Received Message: Topic:',topic);
				//parent.log('mqttClient: Received Message: Message:',payloadValue);
				//	let playerStatus = payloadValue.status
				//	parent.log('mqttClient: Received Message: Message:',payloadValue.status);
					//let playerSource = playerStatus.playerState.source
					//parent.log('mqttClient: Received Message: Message:',playerSource);
				//	}
				
				//parent.log('mqttClient: Received Message: Topic:',topic);
				//parent.log('mqttClient: Received Message: Message:',payloadValue);
				
				//parent.log('mqttClient message: payloadValue.type',payloadValue.type);
				//parent.log('mqttClient message: payloadValue.status',payloadValue.status);
				// debugging power state
				//parent.log('mqttClient message: payloadValue:',payloadValue);
				//parent.log('mqttClient message: payloadValue.status',payloadValue.status);
				//parent.log('mqttClient message: payloadValue.deviceType',payloadValue.deviceType);
				//parent.log('mqttClient message: payloadValue.source',payloadValue.source); // use as serial number
				//parent.log('mqttClient message: payloadValue.mac',payloadValue.mac);
				//parent.log('mqttClient message: payloadValue.state',payloadValue.state);

				// check if payloadValue.deviceType exists
				// deviceType exists in Topic: 1076582_ch/2E59F6E9-8E23-41D2-921D-C13CA269A3BC/status
				// Topic: 1076582_ch/3C36E4-EOSSTB-003656579806/status  
				// multiple devices can exist! how to handle them?
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
								parent.log('Auto-configured settopboxId to',settopboxId);
							} else {
								settopboxId = parent.config.settopboxId;
								parent.log('settopboxId configured, using', settopboxId);
							}
						};
						parent.log('Using settopBoxId',settopboxId);

						
						// set serial number to the box
						//parent.log('mqttClient: Received Message STB status: SerialNumber',parent.informationService.getCharacteristic(Characteristic.SerialNumber).value);
						//if (parent.informationService.getCharacteristic(Characteristic.SerialNumber).value === 'unknown') {
						//		parent.log('mqttClient: Calling updateInformationService with',payloadValue.source);
						//		parent.informationService.updateCharacteristic(Characteristic.SerialNumber,payloadValue.source);
						//};
						//parent.informationService.getCharacteristic(Characteristic.SerialNumber).updateValue(payloadValue.source);
						
						// detect power state
						/*
						settopboxState = payloadValue.state;
						parent.log('Detecting settopbox currentPowerState');
						if (settopboxState == 'ONLINE_RUNNING') // ONLINE_RUNNING means power is turned on
							currentPowerState = 1;
						else if ((settopboxState == 'ONLINE_STANDBY') || (settopboxState == 'OFFLINE')) // ONLINE_STANDBY or OFFLINE: power is off
							currentPowerState = 0;
						parent.log('Settopbox power is',(currentPowerState ? "On" : "Off"));
						*/

						// subscribe to our own generated unique varClientId
						mqttClient.subscribe(mqttUsername + '/' + varClientId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to varClientId Error:',err);
								return false;
							} else {
								parent.log('Subscribed to topic',mqttUsername + '/' + varClientId);
							}
						});

						mqttClient.subscribe(mqttUsername + '/' + settopboxId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopboxId Error:',err);
								return false;
							} else {
								parent.log('Subscribed to topic',mqttUsername + '/' + settopboxId);
							}
						});

						mqttClient.subscribe(mqttUsername + '/' + settopboxId +'/status', function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopbox status Error:',err);
								return false;
							} else {
								parent.log('Subscribed to topic',mqttUsername + '/' + settopboxId +'/status');
							}
						});

						parent.log.debug('mqttClient: Received Message STB status: currentPowerState:',currentPowerState);

						// disabled whilst debugging load
						parent.getUiStatus(); // get only if power is on?
					} // end of if deviceType=STB
				}


				// check if payloadValue.type exists, look for CPE.uiStatus, make sure it is for the wanted settopboxId
				// CPE.uiStatus shows us the currently selected channel on the stb, and occurs in many topics
				// Topic: 1076582_ch/3C36E4-EOSSTB-003656579806/status
				// Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-003656579806","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
				if((payloadValue.deviceType == 'STB') && (payloadValue.source == settopboxId)) {
						parent.log.debug('mqttClient: Received Message of deviceType STB for',payloadValue.source,'Detecting currentPowerState');
						if ((payloadValue.state == 'ONLINE_RUNNING') && (currentPowerState != 1)){ // ONLINE_RUNNING: power is on
							currentPowerState = 1;
							parent.log('Settopbox power:',(currentPowerState ? "On" : "Off"));
						}          
						else if (((payloadValue.state == 'ONLINE_STANDBY') || (payloadValue.state == 'OFFLINE')) // ONLINE_STANDBY or OFFLINE: power is off
							&& (currentPowerState != 0)){
							currentPowerState = 0;
							parent.log('Settopbox power:',(currentPowerState ? "On" : "Off"));
						};
						//parent.log('Settopbox power is',(currentPowerState ? "On" : "Off"));
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
						parent.log.debug('mqttClient: Received Message of type CPE.uiStatus for',payloadValue.source,'Detecting currentChannelId');
						if(payloadValue.status.uiStatus == 'mainUI'){
							parent.log.debug('mqttClient: Received Message CPE.uiStatus for mainUI');
							// grab the status part of the payloadValue object as we cannot go any deeper with json
							let playerStateSource = payloadValue.status.playerState.source;
							// store the current channelId of the TV in currentChannelId
							// as this routine is listening to mqtt messages sent by the polling, this will
							// update the currentChannelId if the user changes it with the physical TV remote control
							currentChannelId = playerStateSource.channelId;
							parent.log.debug('mqttClient: Received Message CPE.uiStatus: Current channel:', currentChannelId);
					};
				};
				

				if (parent.config.debugLevel > 1) {
					parent.log.warn('mqttClient: Received Message end of event: currentPowerState:',currentPowerState, 'currentChannelId:',currentChannelId);
				}
				parent.getUiStatus();

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
		if (this.config.debugLevel > 1) {
			this.log.warn('switchChannel', channelId);
		}
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.pushToTV","source":{"clientId":"' + varClientId + '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' + channelId + '"},"relativePosition":0,"speed":1}}');
	}


	// request profile details via mqtt
	// incomplete, not working
	getProfilesUpdate() {
		if (this.config.debugLevel > 1) {
			this.log('getProfilesUpdate');
		}
		let mqttCmd = '{"action":"OPS.getProfilesUpdate","source":"' + varClientId + '"}';
		this.log('sending:', mqttCmd);
		mqttClient.publish(mqttUsername +'/personalizationService', mqttCmd);

	//		mqttClient.publish(mqttUsername +'/personalizationService', '{"action":"OPS.getProfilesUpdate","source":"' + varClientId + '"}');
	}
	

	// send a remote control keypress to the settopbox via mqtt
	sendKey(keyName) {
		if (this.config.debugLevel > 1) {
			this.log.warn('sendKey keyName:', keyName);
		}
		this.log('Send key:', keyName);
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.KeyEvent","source":"' + varClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}');
		
		// added here to get profiles when I hit a button
		//this.getProfilesUpdate;
	}


	// get the settopbox UI status from the settopbox via mqtt
	getUiStatus() {
		if (this.config.debugLevel > 1) {
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




	/* State Handlers */
	updateDeviceState(error, status) {
		// runs at the very start, and then every 5 seconds, so don't log it unless debugging
		// doesn't get the data direct from the settop box, but rather gets it from the currentPowerState and currentChannelId
		// which are received by the mqtt messages, which occurs very often
		if (this.config.debugLevel > 1) {
			this.log.warn('updateDeviceState: currentChannelId:', currentChannelId, 'currentPowerState:', currentPowerState);
		}
		
		this.setInput(); // set televisionService inputs.

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




	async getPower(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when Homekit wants to refresh the TV tile in Homekit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		if (this.config.debugLevel > 1) {
			this.log.warn('getPower currentPowerState:',currentPowerState);
		}
		callback(null, currentPowerState); // return current state: 0=off, 1=on
	}


	async setPower(wantedPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in Homekit
		// fired when the user clicks the TV tile in Homekit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		if (this.config.debugLevel > 1) {
			this.log.warn('setPower wantedPowerState:',wantedPowerState);
		}
		if(wantedPowerState !== currentPowerState){
			this.sendKey('Power');
		}
		callback(null);
	}


	async getMute(callback) {
		// not supported, but might use somehow in the future
		if (this.config.debugLevel > 1) {
			this.log.warn("getMute");
		}
		callback(true);
	}


	async setMute(state, callback) {
		// sends the mute command
		// works for TVs that accept a mute toggle command
		if (this.config.debugLevel > 1) {
			this.log.warn('setMute state:', state);
		}

		// Execute command to toggle mute
		if (this.config.muteCommand) {
			const NOT_MUTED = 0, MUTED = 1;
			this.log('Set mute: %s', (state === MUTED) ? 'Muted' : 'Not muted');
			var self = this;
			exec(this.config.muteCommand, function (error, stdout, stderr) {
				// Error detection. error is true when an exec error occured
				if (error) {
						self.log.warn('setMute Error:',stderr.trim());
				} else {
						self.log('setMute succeeded:',stdout);
				}
			});
		} else {
			this.log('Mute command not configured');
		}
	
		callback(true);
	}

	
	async getVolume(callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn("getVolume");
		}
		callback(true);
	}


	// set the volume of the TV using bash scripts
	// the ARRIS box remote control commmunicates with the stereo via IR commands, not over mqtt
	// so volume must be handled over a different method
	// here we send execute a bash command on the raspberry pi using the samsungctl command
	// to control the authors samsung stereo at 192.168.0.152
	async setVolume(volume, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setVolume volume:',volume);
		}

		// Execute command to change volume, but only if command exists
		if ((this.config.volUpCommand) && (this.config.volDownCommand)) {
			// direction: only 2 values possible: INCREMENT: 0,	DECREMENT: 1,
			this.log('Set volume: %s', (volume === Characteristic.VolumeSelector.DECREMENT) ? 'Down' : 'Up');
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


	async getInput(callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('getInput');
		}
	}

	async setInput(inputIdentifier, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setInput inputIdentifier:',inputIdentifier);
		}

		// called by updateDeviceState (state handler), thus runs at polling interval
		// set the televisionService inputs if they are empty
		if (this.inputServices && this.inputServices.length) {
			//this.log('setInput: loading channels: this.inputServices',this.inputServices);
			// channels can be retrieved for the country without having a mqtt session going
			let channelsUrl = countryBaseUrlArray[this.config.country].concat('/channels');
			if (this.config.debugLevel > 1) {
				this.log.warn('setInput: loading inputs from channelsUrl:',channelsUrl);
			}
			
			request({ url: channelsUrl, json: true}).then(availableInputs => {
				const sanitizedInputs = [];
				//this.log('setInput: availableInputs.channels',availableInputs.channels.length);
				//this.log('channel data',availableInputs.channels[197]);

				let i = 0;
				let maxSources = this.config.maxChannels || MAX_INPUT_SOURCES;
				availableInputs.channels.forEach(function (channel) {
					if (i < Math.min(maxSources, MAX_INPUT_SOURCES)){ // limit to the amount of channels applicable
						sanitizedInputs.push({id: channel.stationSchedules[0].station.serviceId, name: channel.title, index: i});
					}
					i++;
				});

				this.inputs = sanitizedInputs;
				
				// need to cater for not-available channels. maybe??
				this.inputs.forEach((input, i) => {
					const inputService = this.inputServices[i];
					// possible characteristics:
					/*
					characteristics: [
						[Name],
						[ConfiguredName],
						[InputSourceType],
						[IsConfigured],
						[CurrentVisibilityState],
						[Identifier]
					],
					optionalCharacteristics: [ [Identifier], [InputDeviceType], [TargetVisibilityState]
					*/
					inputService.getCharacteristic(Characteristic.ConfiguredName).updateValue( `${i < 9 ? `0${i + 1}` : i + 1}` + ". " + input.name);
					inputService.getCharacteristic(Characteristic.IsConfigured).updateValue(Characteristic.IsConfigured.CONFIGURED);
					inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(Characteristic.CurrentVisibilityState.SHOWN); // SHOWN = 0; HIDDEN = 1;
					
					// InputDeviceType 
					// OTHER = 0; TV = 1; RECORDING = 2; TUNER = 3; PLAYBACK = 4; AUDIO_SYSTEM = 5; UNKNOWN_6 = 6; 
					// introduce in iOS 14; "UNKNOWN_6" is not stable API, changes as soon as the type is known
					/*
					this.log('setInput index',i);
					this.log('setInput Name',i,inputService.getCharacteristic(Characteristic.Name).value);
					this.log('setInput ConfiguredName',i,inputService.getCharacteristic(Characteristic.ConfiguredName).value);
					this.log('setInput InputSourceType',i,inputService.getCharacteristic(Characteristic.InputSourceType).value);
					this.log('setInput IsConfigured',i,inputService.getCharacteristic(Characteristic.IsConfigured).value);
					this.log('setInput CurrentVisibilityState',i,inputService.getCharacteristic(Characteristic.CurrentVisibilityState).value);
					this.log('setInput Identifier',i,inputService.getCharacteristic(Characteristic.Identifier).value);
					this.log('setInput InputDeviceType',i,inputService.getCharacteristic(Characteristic.InputDeviceType).value);
					this.log('setInput TargetVisibilityState',i,inputService.getCharacteristic(Characteristic.TargetVisibilityState).value);
					*/
				});

				if (this.config.debugLevel > 1) {
					this.log.warn('setInput: loaded inputs:',this.inputs);
				}
			},
			error => {
				this.log.warn(`Failed to get available inputs from ${this.config.name}. Please verify the EOS settopbox is connected to the LAN`);
			}
			);
		}
		//callback();
	}


	async getInputState(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in Homekit and Homekit requests a refresh
		// currentChannelId is updated by the polling mechanisn
		if (this.config.debugLevel > 1) {
			this.log.warn('getInputState');
		}
		var isDone = false;
		this.inputs.filter((input, index) => {
			// getInputState input 
			// { id: 'SV09038', name: 'SRF 1 HD', index: 0 }
			// { id: 'SV00044', name: 'RTL plus', index: 44 }
			//this.log(`getInputState: ${input.index} ${input.name} (${input.id})`);
			if (input.id === currentChannelId) {
				this.log('Current channel:', index, input.name, input.id);
				isDone = true;
				return callback(null, index);
				}
			});
		if (!isDone)
			return callback(null, null);
	}


	async setInputState(input, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setInputState input:',input.id, input.name);
		}
		this.log(`Change channel to ${input.name}  (${input.id})`);
		this.switchChannel(input.id);
		callback();
	}


	// fired by the View TV Settings command in the Homekit TV accessory Settings
	async setPowerModeSelection(state, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setPowerModeSelection state:',state);
		}
		this.log('Menu command: View TV Settings');
		this.sendKey('Help'); // puts SETTINGS.INFO on the screen
		setTimeout(() => { this.sendKey('ArrowRight'); }, 600); // move right to select SETTINGS.PROFILES, send after 600ms
		callback(true);
	}


	async setVolumeSelector(state, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setVolumeSelector state:',state);
		}
		callback(null);
	}


	async setRemoteKey(remoteKey, callback) {
		if (this.config.debugLevel > 1) {
			this.log.warn('setRemoteKey remoteKey:',remoteKey);
		}
		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		// keys 12, 13 ^ 14 are not defined by Apple
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
				this.sendKey(this.config.playPauseButton || "MediaPause"); break;
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
	
};