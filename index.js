const mqtt = require('mqtt');  
const request = require('request-promise');
const _ = require('underscore');
const express = require('express');
const bodyParser = require('body-parser');
const varClientId = makeId(30);


const PLUGIN_NAME = 'homebridge-eosstb';
const PLATFORM_NAME = 'eosstb';
const PLUGIN_VERSION = '0.0.2';

const settopBoxName = {
    'nl': 		'Mediabox Next (4K)',
    'ch': 		'UPC TV Box',
    'be-nl': 	'Telenet TV-Box',
    'be-fr': 	'Telenet TV-Box',
    'at': 		'Entertain Box 4K'
};

const countryBaseUrlArray = {
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web',
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v3/BE/nld/web',
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v3/BE/fr/web',
    'at': 		'https://prod.oesp.magentatv.at/oesp/v3/AT/deu/web'
};

// session and ywt are based on countryCaseUrl
//const sessionUrl = 	'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/session';
//const channelsUrl = 'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/channels';
const jwtUrl = 				'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web/tokens/jwt';
const jwtUrlArray = {
    'nl': 		'https://web-api-prod-obo.horizon.tv/oesp/v4/NL/nld/web',
    'ch': 		'https://web-api-prod-obo.horizon.tv/oesp/v3/CH/eng/web',
    'be-nl': 	'https://web-api-prod-obo.horizon.tv/oesp/v3/BE/nld/web',
    'be-fr': 	'https://web-api-prod-obo.horizon.tv/oesp/v3/BE/fr/web',
    'at': 		'https://prod.oesp.magentatv.at/oesp/v3/AT/deu/web'
};



// const mqttUrl = 		'wss://obomsg.prod.ch.horizon.tv:443/mqtt';
// different mqtt endpoints per country
const mqttUrlArray = {
    'nl': 		'wss://obomsg.prod.nl.horizon.tv:443/mqtt',
    'ch': 		'wss://obomsg.prod.ch.horizon.tv:443/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'be-fr':  'wss://obomsg.prod.be.horizon.tv:443/mqtt',
    'at':			'wss://obomsg.prod.at.horizon.tv:443/mqtt'
};






// general constants
const NO_INPUT = 999999; // an input id that does not exist
const MAX_INPUT_SOURCES = 50; // max input services. Default = 50. Cannot be more than 97 (100 - all other services)
const STB_STATE_POLLING_INTERVAL_MS = 5000; // pollling interval in millisec. Default = 5000



// exec spawns child process to run a bash script
var exec = require("child_process").exec;

let mqttClient = {};

// Set Ziggo username and password
//const myUpcUsername = "Your username";
//const myUpcPassword = "Your password";

let myUpcUsername;
let myUpcPassword;
let console;

let Service;
let Characteristic;

let mqttUsername;
let mqttPassword;
let settopboxId;
let settopboxState;
let stations = [];
let uiStatus;
let currentChannel;
let currentChannelId;
let currentPowerState; // declare with value of 0

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






// --== MAIN SETUP ==--
function eosTvPlatform(log, config) {
	console = log;
	this.log = log;
	this.config = config;
}



/* Initialise Accessory */
function tvAccessory(log, config) {
	this.log = log;

	this.config = config;
	this.sysConfig = null;
	this.name = config.name || 'UPC TV Box';

	this.inputs = [];
	this.enabledServices = [];
	this.inputServices = [];
	this.playing = true;

	// Configuration
	myUpcUsername = this.config.username || '';
	myUpcPassword = this.config.password || ''; // was username, changed to password, then things stopped working. changed back

	// this.getChannels();
	this.getSession();
	this.setInputs();

	// Check & Update Accessory Status every 5 seconds (5000 ms)
	this.checkStateInterval = setInterval(this.updateTvState.bind(this),STB_STATE_POLLING_INTERVAL_MS);
}


module.exports = (homebridge) => {
	({ Service, Characteristic } = homebridge.hap);
	homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, eosTvPlatform);
};


eosTvPlatform.prototype = {
	accessories(callback) {
	callback([
		new tvAccessory(
		this.log,
		this.config
		),
	]);
	},
};


// all code is defined in the tvAccessory sub
tvAccessory.prototype = {
	/* Services */
	// max 100 services possible
	getServices() {
	this.prepareInformationService();			// service 1
	this.prepareTelevisionService();			// service 2
	this.prepareTelevisionSpeakerService();	// service 3
	this.prepareInputSourceServices();			// services 4 to max 100
	//this.volumeService(); // try and enable

	return this.enabledServices;
	},


	/* START: Prepare the Services */
	// informationService is the name, manufacturer etc of the accessory
	prepareInformationService() {
		// Create Information Service
		this.informationService = new Service.AccessoryInformation();

		let boxName = 'DCX960 ('.concat(settopBoxName[this.config.country]).concat(')'); // market specific box name
		
		this.informationService
			.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, 'ARRIS Global Limited')
			.setCharacteristic(Characteristic.SerialNumber, 'unknown') // this should be the mac or the ca address	
			.setCharacteristic(Characteristic.Model, boxName); // as returned by the system?
			//.setCharacteristic(Characteristic.FirmwareRevision, '1.2.3');

		this.enabledServices.push(this.informationService);
	}, // end of prepareInformationService


	// prepare the tv service
	prepareTelevisionService() {
		// Create Television Service (AVR)
		this.tvService = new Service.Television(this.name, 'tvService');

		this.tvService
			.setCharacteristic(Characteristic.ConfiguredName, this.name)
			.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

		this.tvService
			.getCharacteristic(Characteristic.Active)
			.on('get', this.getPowerState.bind(this))
			.on('set', this.setPowerState.bind(this));

    //this.tvService
    //  .setCharacteristic(Characteristic.ActiveIdentifier, NO_INPUT); // default to no input at the start

		this.tvService
			.getCharacteristic(Characteristic.ActiveIdentifier)
			.on('get', this.getInputState.bind(this))
			.on('set', (inputIdentifier, callback) => {
					this.setInputState(this.inputs[inputIdentifier], callback);
				}
			);

		this.tvService
			.getCharacteristic(Characteristic.RemoteKey)
			.on('set', this.remoteKeyPress.bind(this));

		// PowerModeSelection enables the View TV Settings option in the Homekit TV accessory
    this.tvService
      .getCharacteristic(Characteristic.PowerModeSelection)
			.on('set', this.viewTvSettings.bind(this));

		this.enabledServices.push(this.tvService);
	}, // end of prepareTelevisionService


	// prepare the tv speaker service, this includes the volume selector
	prepareTelevisionSpeakerService() {
		this.tvSpeakerService = new Service.TelevisionSpeaker(`${this.name} Speaker`, 'tvSpeakerService');
		this.tvSpeakerService
			.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
			.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
		this.tvSpeakerService.getCharacteristic(Characteristic.VolumeSelector) // the volume selector allows the iOS device keys to be used to change volume
			.on('set', (direction, callback) => {	this.setVolume(direction, callback); });
			//.on('set', this.setVolumeSelector.bind(this)); // from denon code
		this.tvSpeakerService.getCharacteristic(Characteristic.Volume)
			.on('get', this.getVolume.bind(this))
			.on('set', this.setVolume.bind(this));
		this.tvSpeakerService.getCharacteristic(Characteristic.Mute) // not supported in remote but maybe by Siri
			//.on('get', this.getMute.bind(this)) // not supported by tv
			.on('set', this.setMute.bind(this));
	
	
		this.tvService.addLinkedService(this.tvSpeakerService);
		this.enabledServices.push(this.tvSpeakerService);
	}, // end of prepareTelevisionSpeakerService


	// prepare the input selection service. 
	// This is the channel list, each input is a service, max 100 services less the services created so far
	prepareInputSourceServices() {
		// loop MAX_INPUT_SOURCES times to get the first MAX_INPUT_SOURCES channels
		// max 100 services
		for (let i = 0; i < MAX_INPUT_SOURCES; i++) {
			const inputService = new Service.InputSource(i, `inputSource_${i}`);

			inputService
				// identifier is the channel index number
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.ConfiguredName, `Input ${i < 9 ? `0${i + 1}` : i + 1}`)
				// initially not configured
				.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.NOT_CONFIGURED)
				// set default to application as no other type fits, except maybe tuner
				// TUNER = 2; APPLICATION = 10;
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TV)
				// hidden until config is loaded my mqtt
				.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDEN);

			inputService
				.getCharacteristic(Characteristic.ConfiguredName)
				.on('set', (value, callback) => {
					callback(null, value);
				}
			);

			this.tvService.addLinkedService(inputService);
			this.inputServices.push(inputService);
			this.enabledServices.push(inputService);
		} // end of for loop getting the inputSource
	}, // end of prepareInputSourceServices
	/* END: Prepare the Services */



	getSession() {
		this.log.debug('getSession');

		sessionRequestOptions.uri = countryBaseUrlArray[this.config.country].concat('/session');
		this.log.debug('getSession sessionRequestOptions.uri:',sessionRequestOptions.uri);
		
		sessionRequestOptions.body.username = this.config.username;
		sessionRequestOptions.body.password = this.config.password;
		this.log.debug('getSession sessionRequestOptions.body.username:', sessionRequestOptions.body.username);
		this.log.debug('getSession sessionRequestOptions.body.password:', sessionRequestOptions.body.password);
				
		request(sessionRequestOptions)
			.then((json) => {
				//this.log(json);
				sessionJson = json;

				this.getJwtToken(sessionJson.oespToken, sessionJson.customer.householdId);
				this.log.debug('getSession successful');			
			})
			.catch((err) => {
				this.log.error('getSession:', err.message);
			});
		//return sessionJson || false;
	}, // end of getSession


	getJwtToken(oespToken, householdId)	 {
		this.log('getJwtToken'); // for debugging

		let jwtCountryUrl	= countryBaseUrlArray[this.config.country].concat('/tokens/jwt');
		this.log.debug('jwtCountryUrl',jwtCountryUrl);
		
		const jwtRequestOptions = {
			method: 'GET',
			uri: jwtCountryUrl,
			headers: {
				'X-OESP-Token': oespToken,
				'X-OESP-Username': myUpcUsername
			},
			json: true
		};

		request(jwtRequestOptions)
			.then(json => {
				jwtJson = json;
				mqttUsername = householdId;
				mqttPassword = jwtJson.token;
				this.startMqttClient(this);
			})
			.catch(function (err) {
				//this.log('getJwtToken: ', err.message);
				return false;
			});
	}, // end of getJwtToken


	startMqttClient(parent) {
		parent.log('startMqttClient: currentPowerState:',currentPowerState);
		//parent.log('startMqttClient: connecting mqttt client');
		
		let mqttUrl = mqttUrlArray[this.config.country];
		parent.log('startMqttClient: mqttUrl:',mqttUrl);
		
		mqttClient = mqtt.connect(mqttUrl, {
			connectTimeout: 10*1000, //10 seconds
			clientId: varClientId,
			username: mqttUsername,
			password: mqttPassword
		});

		// mqtt client event: connect
		mqttClient.on('connect', function () {
			parent.log('mqttClient: connect event');
			
			mqttClient.subscribe(mqttUsername, function (err) {
				if(err){
					parent.log('mqttClient subscribe: Error:',err);
					return false;
				} else {
					parent.log('mqttClient: subscribed to',mqttUsername);
				}
			});

			mqttClient.subscribe(mqttUsername +'/+/status', function (err) {
				if(err){
					parent.log('mqttClient subscribe to status: Error:',err);
					return false;
				} else {
					parent.log('mqttClient: subscribed to',mqttUsername +'/+/status');
				}
			});

			// mqtt client event: message received
			mqttClient.on('message', function (topic, payload) {
				parent.log.debug('mqttClient: message event');
				//parent.log('mqttClient.on.message payload',payload);
				let payloadValue = JSON.parse(payload);
				parent.log.debug('mqttClient: Received Message: Topic:',topic);
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
				if(payloadValue.deviceType){
					// check if payloadValue.deviceType value = STB
					if(payloadValue.deviceType == 'STB'){
						settopboxId = payloadValue.source;
						settopboxState = payloadValue.state;
						//settopboxSource = payloadValue.state;
						
						// set serial number to the box
						parent.log('mqttClient: Received Message STB status: SerialNumber',parent.informationService.getCharacteristic(Characteristic.SerialNumber).value);
						if (parent.informationService.getCharacteristic(Characteristic.SerialNumber).value === 'unknown') {
								parent.log('mqttClient: Calling updateInformationService with',payloadValue.source);
								
								parent.informationService.updateCharacteristic(Characteristic.SerialNumber,'my new value');
								 
						}
						//parent.informationService.getCharacteristic(Characteristic.SerialNumber).updateValue(payloadValue.source);
						
						parent.log('mqttClient: Received Message STB status: reading currentPowerState');
						if (settopboxState == 'ONLINE_RUNNING') // ONLINE_RUNNING means power is turned on
							//parent.log('mqttClient.on.message setting currentPowerState to 1');
							currentPowerState = 1;

						else if (settopboxState == 'ONLINE_STANDBY') // ONLINE_STANDBY or OFFLINE: power is off
							//parent.log('mqttClient.on.message setting currentPowerState to 0');
							currentPowerState = 0;

						else if (settopboxState == 'OFFLINE') // ONLINE_STANDBY or OFFLINE: power is off
							//parent.log('mqttClient.on.message setting currentPowerState to 0');
							currentPowerState = 0;

						mqttClient.subscribe(mqttUsername + '/' + varClientId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to ClientId Error:',err);
								return false;
							}
						});

						mqttClient.subscribe(mqttUsername + '/' + settopboxId, function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopboxId Error:',err);
								return false;
							}
						});

						mqttClient.subscribe(mqttUsername + '/'+ settopboxId +'/status', function (err) {
							if(err){
								parent.log('mqttClient subscribe to settopbox status Error:',err);
								return false;
							}
						});

						parent.log.debug('mqttClient: Received Message STB status: currentPowerState:',currentPowerState);
						//parent.log('mqttClient: Received Message: calling getUiStatus()');
						//parent.getUiStatus();
					}
				}


				// check if payloadValue.type exists, look for CPE.uiStatus
				// type exists in Topic: 1076582_ch/jrtmev583ijsntldvrk1fl95c6nrai
				// CPE.uiStatus shows us the currently selected channel on the stb
				// this is broadcast when the webapp is connected
				// but after a while the webapp disconnects, so must find a way to connect??? and stay connected?
				if(payloadValue.type == 'CPE.uiStatus'){
						parent.log.debug('mqttClient: Received Message of type CPE.uiStatus');
						if(payloadValue.status.uiStatus == 'mainUI'){
						// grab the status part of the payloadValue object as we cannot go any deeper with json
						let playerStatus = payloadValue.status
						parent.log.debug('mqttClient: Received Message CPE.uiStatus');
						//parent.log('playerStatus', playerStatus);
						// store the current channelId of the TV in currentChannelId
						// as this routine is listeneing to mqtt messages sent by the polling, this will
						// update the currentChannelId if the user changes it with the physical TV remote control
						currentChannelId = payloadValue.status.playerState.source.channelId;
						parent.log.debug('mqttClient: Received Message CPE.uiStatus: Current channel:', currentChannelId);
					}
				}

				parent.log.debug('mqttClient: Received Message end of event: currentPowerState:',currentPowerState);
				parent.log.debug('mqttClient: Received Message end of event: currentChannelId:',currentChannelId);
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
				return false;
			});
		}); // end of mqttClient.on('connect' ...
		
	}, // end of startMqttClient


	// send a channel change request to the settopbox via mqtt
	switchChannel(channelId) {
		this.log.debug('Switch to', channelId);
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.pushToTV","source":{"clientId":"' + varClientId + '","friendlyDeviceName":"HomeKit"},"status":{"sourceType":"linear","source":{"channelId":"' + channelId + '"},"relativePosition":0,"speed":1}}');
	}, // end of switchChannel
	
	

	// send a remote control keypress to the settopbox via mqtt
	sendKey(keyName) {
		this.log('HomeKit send key:', keyName);
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.KeyEvent","source":"' + varClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}');
	}, // end of sendKey
	

	// get the settopbox UI status from the settopbox via mqtt
	getUiStatus() {
		//this.log('Get UI status');
		mqttClient.publish(mqttUsername + '/' + settopboxId, '{"id":"' + makeId(8) + '","type":"CPE.getUiStatus","source":"' + varClientId + '"}')
		//this.log('Get UI status mqttClient payload',mqttClient); // see the mqtt full detail if needed
		//let mqttPayloadValue = JSON.parse(mqttClient);
		//this.log('getUiStatus: mqtt connected:',mqttClient['connected']);
		//this.log('getUiStatus: mqtt disconnecting:',mqttClient['disconnecting']);
		//this.log('getUiStatus: mqtt reconnecting:',mqttClient['reconnecting']);

	}, // end of getUiStatus


	/* State Handlers */
	updateTvState(error, status) {
		// runs every 5 seconds, so don't log it unless debugging
		//this.log('updateTvState: status:', status);
		//this.log('updateTvState: currentChannelId:', currentChannelId);
		this.setInputs(); // set tvService inputs.

		if (this.tvService) {
			//this.log('checking state of tv service power'); 
			// update power status value (currentPowerState, 0=off, 1=on)
			if (this.tvService.getCharacteristic(Characteristic.Active).value !== currentPowerState) {
					this.log("updateTvState: Settop Box to Homekit: current power state: " + (currentPowerState ? "On" : "Off"));
					this.tvService.getCharacteristic(Characteristic.Active).updateValue(currentPowerState == 1);
			}
			
			// log the entire object to see the data!
			//this.log('TV ActiveIdentifier:',this.tvService.getCharacteristic(Characteristic.ActiveIdentifier)),

		//	if (status && currentChannelId) {
				this.inputs.filter((input, index) => {
					// check if current input is the same as currentChannelId
					// this.log('updateTvState: input:',input);
					// input: { id: 'SV09029', name: 'SRF info HD', index: 2 }
					if (input.id !== currentChannelId) {
						// Get and update HomeKit accessory with the current set TV input
				//		this.log('updateTvState: input.id, currentChannelId:',input.id, currentChannelId); 
				//		this.log('updateTvState: ActiveIdentifier.value, index, input.index:',this.tvService.getCharacteristic(Characteristic.ActiveIdentifier).value, index, input.index); 
						// disabled until we find the bug
						/*
						if (this.tvService.getCharacteristic(Characteristic.ActiveIdentifier).value !== input.index) {
							this.log(`updateTvState: Settop Box to Homekit: current channel: ${input.name} ${input.name} (${input.id})`);
							return this.tvService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(index);
						}
						*/
					}

				return null;
				});
		//	}
		} // end of if (this.tvService)
	}, // end of updateTvState


	setInputs() {
		// called by updateTvState (state handler), thus runs at polling interval
		// set the tvService inputs if they are empty

		if (this.inputServices && this.inputServices.length) {
			// this.log('setInputs: loading channels: this.inputServices.length',this.inputServices.length);
			// this.log('setInputs: loading channels: this.inputServices',this.inputServices);
			let channelsUrl = countryBaseUrlArray[this.config.country].concat('/channels');
			this.log('setInputs: channelsUrl:',channelsUrl);
			
			request({ url: channelsUrl, json: true}).then(availableInputs => {
				const sanitizedInputs = [];
				//this.log('setInputs: availableInputs.channels',availableInputs.channels.length);
				//this.log('channel data',availableInputs.channels[197]);
	
				let i = 0;
				availableInputs.channels.forEach(function (channel) {
					if (i < MAX_INPUT_SOURCES) // limit to the amount of channels applicable
					{
						sanitizedInputs.push({id: channel.stationSchedules[0].station.serviceId, name: channel.title, index: i});
					}
					i++;
				});

				this.inputs = sanitizedInputs;
				
				// need to cater for not-available channels
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
				
				// CurrentVisibilityState and TargetVisibilityState: SHOWN = 0; HIDDEN = 1;
				inputService.getCharacteristic(Characteristic.CurrentVisibilityState).updateValue(Characteristic.CurrentVisibilityState.SHOWN);
				
				// InputDeviceType 
				// OTHER = 0; TV = 1; RECORDING = 2; TUNER = 3; PLAYBACK = 4; AUDIO_SYSTEM = 5; UNKNOWN_6 = 6; 
				// introduce in iOS 14; "UNKNOWN_6" is not stable API, changes as soon as the type is known
				/*
				this.log('setInputs index',i);
				this.log('setInputs Name',i,inputService.getCharacteristic(Characteristic.Name).value);
				this.log('setInputs ConfiguredName',i,inputService.getCharacteristic(Characteristic.ConfiguredName).value);
				this.log('setInputs InputSourceType',i,inputService.getCharacteristic(Characteristic.InputSourceType).value);
				this.log('setInputs IsConfigured',i,inputService.getCharacteristic(Characteristic.IsConfigured).value);
				this.log('setInputs CurrentVisibilityState',i,inputService.getCharacteristic(Characteristic.CurrentVisibilityState).value);
				this.log('setInputs Identifier',i,inputService.getCharacteristic(Characteristic.Identifier).value);
				this.log('setInputs InputDeviceType',i,inputService.getCharacteristic(Characteristic.InputDeviceType).value);
				this.log('setInputs TargetVisibilityState',i,inputService.getCharacteristic(Characteristic.TargetVisibilityState).value
				*/
				});
			},
			error => {
				this.log.warn(`Failed to get available inputs from ${this.config.name}. Please verify the UPC TV Box is connected and accessible at ${this.config.ip}`);
			}
			);
		}
	}, // end of setInputs


	getPowerState(callback) {
		// fired when the user clicks away from the Remote Control, regardless of which TV was selected
		// fired when Homekit wants to refresh the TV tile in Homekit. Refresh occurs when tile is displayed.
		// currentPowerState is updated by the polling mechanisn
		//this.log('getPowerState current power state:', currentPowerState);
		callback(null, currentPowerState); // return current state: 0=off, 1=on
	}, // end of getPowerState

	setPowerState(wantedPowerState, callback) {
		// fired when the user clicks the power button in the TV accessory in Homekit
		// fired when the user clicks the TV tile in Homekit
		// fired when the first key is pressed after opening the Remote Control
		// wantedPowerState is the wanted power state: 0=off, 1=on
		//this.log('setPowerState current power state:', currentPowerState);
		//this.log('setPowerState  wanted power state:', wantedPowerState);

		if(wantedPowerState !== currentPowerState){
			// wanted power state is different to current power state, so send the power key to change state
			this.sendKey('Power');
		}

		callback();
	}, // end of setPowerState


	getInputState(callback) {
		// fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
		// fired when the icon is clicked in Homekit and Homekit requests a refresh
		// currentChannelId is updated by the polling mechanisn
		//this.log('getInputState');
		isDone = false;
		this.inputs.filter((input, index) => {
			// getInputState input { id: 'SV00044', name: 'RTL plus', index: 44 }
			//this.log('getInputState input', input);
			//this.log(`getInputState: ${input.index} ${input.name} (${input.id})`);
			if (input.id === currentChannelId) {
				this.log('Current channel:', index, input.name, input.id);
				isDone = true;
				return callback(null, index);
				}
			});

		if (!isDone)
			return callback(null, null);
	}, // end of getInputState


	setInputState(input, callback) {
		this.log.debug('setInputState');
		this.log(`HomeKit set channel to: ${input.name} (${input.id})`);
		this.switchChannel(input.id);
		callback();
	}, // end of setInputState


	//getVolume
	getVolume(callback) {
		this.log("getVolume");
		callback(true);
	}, // end of getVolume

	// set the volume of the TV using bash scripts
	// the ARRIS box remote control commmunicates with the stereo via IR commands, not over mqtt
	// so volume must be handled over a different method
	// here we send execute a bash command on the raspberry pi using the samsungctl command
	// to control the authors samsung stereo at 192.168.0.152
	setVolume(direction, callback) {
		// direction: only 2 values possible: INCREMENT: 0,	DECREMENT: 1,
		const INCREMENT = 0;
		const DECREMENT = 1;
		this.log('Volume control: %s', (direction === DECREMENT) ? 'Down' : 'Up');
		var self = this;

		// Execute command to change volume
		exec((direction === DECREMENT) ? this.config.volDownCommand : this.config.volUpCommand, function (error, stdout, stderr) {
			// Error detection. error is true when an exec error occured
			if (error) {
					self.log.warn('Volume control command failed:',stderr.trim());
			}
		});

		callback(true);
	}, // end of setVolume


	

	
	//setMute
	setMute(state, callback) {
		// sends the mute command when called// works for TVs that accept a mute toggle command
		const NOT_MUTED = 0;
		const MUTED = 1;
		this.log('setMute', state);
		var self = this;

		// Execute command to toggle mute
		exec(this.config.muteCommand, function (error, stdout, stderr) {
			// Error detection. error is true when an exec error occured
			if (error) {
					self.log.warn('Mute command failed:',stderr.trim());
			} else {
					self.log('Mute command succeeded:',stdout);
			}
		});

		callback(true);
	}, // end of setMute



	// fired by the View TV Settings command in the Homekit TV accessory Settings
	viewTvSettings(input, callback) {
		this.log('Sending menu command: View TV Settings');
		this.sendKey('Help'); // puts SETTINGS.INFO on the screen
		setTimeout(() => { this.sendKey('ArrowRight'); }, 500); // move right to select SETTINGS.PROFILES, send after 500ms
		callback(true);
	}, // end of viewTvSettings



	remoteKeyPress(remoteKey, callback) {
	this.log.debug('Remote Key Press:',remoteKey); // added log entry Jochen
		// remoteKey is the key pressed on the Apple TV Remote in the Control Center
		switch (remoteKey) {
			case Characteristic.RemoteKey.REWIND: // 0
				this.sendKey('MediaRewind');
				callback();
				break;
			case Characteristic.RemoteKey.FAST_FORWARD: // 1
				this.sendKey('MediaFastForward');
				callback();
				break;
			case Characteristic.RemoteKey.NEXT_TRACK: // 2
				this.sendKey('DisplaySwap');
				callback();
				break;
			case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3
				this.sendKey('DisplaySwap');
				callback();
				break;
			case Characteristic.RemoteKey.ARROW_UP: // 4
				this.sendKey('ArrowUp');
				callback();
				break;
			case Characteristic.RemoteKey.ARROW_DOWN: // 5
				this.sendKey('ArrowDown');
				callback();
				break;
			case Characteristic.RemoteKey.ARROW_LEFT: // 6
				this.sendKey('ArrowLeft');
				callback();
				break;
			case Characteristic.RemoteKey.ARROW_RIGHT: // 7
				this.sendKey('ArrowRight');
				callback();
				break;
			case Characteristic.RemoteKey.SELECT: // 8
				this.sendKey('Enter');
				callback();
				break;
			case Characteristic.RemoteKey.BACK: // 9
				//this.sendKey(this.config.backButton || "Escape");
				this.sendKey('Escape');
				callback();
				break;
			case Characteristic.RemoteKey.EXIT: // 10
				this.sendKey(this.config.backButton || "Escape");
				callback();
				break;
			case Characteristic.RemoteKey.PLAY_PAUSE: // 11
				this.sendKey(this.config.playPauseButton || "MediaPause");
				callback();
				break;
			case Characteristic.RemoteKey.INFORMATION: // 15
				// this is the button that can be used to access the menu
				// Options:
				// ContextMenu: the [...] button on the remote
				// Info: displays the INFO screenm same as the [...] button then Info on the remote
				// Help: displays the SETTINGS INFO page
				// Guide: displays the TV GUIDE page, same as the Guide button on the remote,
				// MediaTopMenu: displazs the top menu (home) page, same as the HOME button on the remote
				// nothing: settings, menu, 
				this.sendKey(this.config.infoButton || "MediaTopMenu");
				callback();
				break;
			default:
				callback();
				break;
		}
	}, // end of remoteKeyPress

}; // end of the tvAccessory.prototype
