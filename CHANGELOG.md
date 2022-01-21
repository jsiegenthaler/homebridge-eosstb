# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# CONFIG CHANGES REQUIRED
If you used custom channels, you must updated your config when updating from 1.1.3 to later versions. See the [configuration section in the Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md#configuration).

# Bug Fixes and Improvements

## Current In-Work List (Future Releases)
* In work: testing of Input Current Visibility State
* In work: improve handling of channel names: characters not allowed in HomeKit are now replaced with whitespace


## 1.2.3-beta.7 (2022-01-22)
* InputSourceType not yet fully working
* Improved reliability of mqtt reconnects when mqtt session goes offline
* Added extra characteristics (StatusActive, StatusFault, InUse, ProgramMode, InputDeviceType, InputSourceType) for use in Shortcuts and Automations
* Shifted some log messages to higher debug levels to allow for easier debugging
* Increased MASTER_CHANNEL_LIST_REFRESH_CHECK_INTERVAL_S from 120 to 600s to reduce network traffic
<<<<<<< Updated upstream
* Improved Wiki


## 1.2.2 (2022-01-21)
* Fixed remote control crash when using minimum plugin config
* Bumped dependencies (homebridge, axios, mqtt, qs)
=======
* Improved Wiki!
* Bumped dependencies (homebridge, axios, mqtt, qs)
* Fixed issue where remote keys caused a crash when using minimum plugin config (no deviceId specified)
>>>>>>> Stashed changes


## 1.2.1 (2021-12-04)
* Bumped dependencies    
    "homebridge": ">=1.3.8",
    "node": ">=16.13.1"


## 1.2.0 (2021-11-05)
* Added enhanced remote control functions with user definable single-tap and double-tap support
* Renamed UPC TV to Sunrise UPC TV for CH
* Bumped dependencies


## 1.1.17 (2021-10-09)
* Refactored code due to axios-cookiejar-support migration to 2.0.x 
* Bumped dependencies


## 1.1.16 (2021-10-03)
* Cleaned up and bumped dependencies


## 1.1.14 (2021-09-07)
* Bumped dependencies


## 1.1.12 (2021-09-01)
* Increased wait time when initially connecting from 15s to 30s to help with be-nl users
* Fixed logging bug on line 2405
* Bumped dependencies


## 1.1.11 (2021-05-15)
* Fixed issue where the last TV channel name was still displayed after changing to a radio station


## 1.1.10 (2021-05-13)
* Improved session startup and mqtt session handling
* Improved error trapping and handling in the updateDeviceState procedure
* Fixed a "includes is not a function" error.
* Added Funding options
* EOSSTB is now homebridge verified! Restart your OS running Homebridge to see the Donate and Verified tags in Homebridge. All donations appreciated :)


## 1.1.9 (2021-04-24)
* Fixed issue where GB mqtt session would not start (timing issue)


## 1.1.8 (2021-04-22)
* Fixed issue "TypeError: this.currentChannelId.includes is not a function" on line 2494


## 1.1.7 (2021-04-21)
* Added limit of TV accessory name to 14 characters as per set-top box rules but only when syncName=true
* Added support of DisplayOrder for proper channel sorting
* Fixed issue where names of special app channels would not appear as current channel (Netflix)
* Fixed issue where channel numbers would appear multiple times
* Fixed issue where user-configured channel names would be discarded
* Fixed issue where display of recordingState in logs was incorrect
* Improved consistency of log display
* Bumped dependencies


## 1.1.6 (2021-04-14)
* Fixed issue where showChannelNumbers was not working
* Fixed issue in config.schema where channelNames was shown in the wrong config location


## 1.1.5 (2021-04-12)
* Fixed issue where recordingState was not properly reported
* Cleaned up some logging


## 1.1.4 (2021-04-11)
* Added config.schema.json
* Added recordingState, added detection of nDVR / localDVR / LDVR, improved device detection


## 1.1.3 (2021-04-06)
* Added urls for cz, de, hu, sk, ro (testers needed)
* Added ignoring of BBC special apps com.bbc.app.launcher and com.bbc.app.crb so that channel name stays displayed


## 1.1.2 (2021-04-02)
* Improved sessionWatchdog to detect session up but mqttClient down, and try to reconnect
* Improved logging of volume command warnings
* Improved display of device config tip
* Fixed issue where channel list was not sorted properly
* Fixed issue where only the first device of multiple devices would load
* Fixed issue where a scenario with no profiles resulted in no channels being loaded
* Fixed issue where duplicates in the masterChannelList caused channel loading problems


## 1.1.1 (2021-03-28)
* Fixed issue when channelNames exist: Cannot read property 'channelName' of undefined on line 2458
* Fixed issue when profiles do not exist: Cannot read property 'favoriteChannels' of undefined on line 2330


## 1.1.0 (2021-03-28)
* Added Virgin Media IE login support
* Added support of Input Current Visibility State
* Added support of Closed Captions (Log and Shortcuts)
* Added support of Picture Mode (Log and Shortcuts)
* Added support of mqtt subscriptions for recording status
* Added support of device config options "syncName" and "name", see Readme for details
* Improved handling of device names when syncing (valid names: 3 to 14 characters)
* Improved session robustness and automatic reconnects
* Improved handling of profiles with no favourite channels
* Improved handling of profiles when channel order changes
* Improved robustness of config: country is now case insensitive
* Improved error logging in loadMasterChannelList
* Improved some logging
* Bumped dependencies


## 1.0.2 (2021-03-22)
* Improved handling when no supported devices found
* Improved logging when getPersonalizationData fails
* Improved code for the television service
* Fixed a problem where the start command was not being sent to the backend platform
* Fixed some small logging display errors


## 1.0.1 (2021-03-21)
* Cleaned up some left-over debug logging
* Started session code for IE (unfinished)


## 1.0.0 (2021-03-20)
### Important Note
You must updated your config when updating from 0.1.13 to 1.0.0 (or later versions). See the [configuration section in the Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md#configuration).
### Changes
* Added Virgin Media GB support for the Virgin TV 360 box
* Added Virgin Media IE support (testers needed) for the Virgin TV 360 box
* Added full multi-device support, great if you have more than one set-top box
* Added personalisation and profile support, including set-top box renaming
* Added full channel list support, showing only subscribed channels
* Added Mute support
* Added auto session recovery if session fails
* Added lots of customisation capabilities (see [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md))
* Improved display of accessory properties
* Bumped all dependencies
* Many more improvements, see the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md#features) for full plugin documentation

## 0.1.13 (2021-02-25)
* Fixed bugs in the BE session

## 0.1.12 (2021-02-25)
* Fixed typo in code for BE

## 0.1.11 (2021-02-25)
* Fixed bug with session state handler for BE

## 0.1.10 (2021-02-25)
* Added support of Profiles. Desired profile can be configured in config.json. Defaults to Shared if not found
* Added support of showing/hiding channel numbers in the channel list
* Added triple-volume-down click detection. A triple down sends the muteCommand instead of volDownCommand
* Finaly fixed the mqtt device connection. UI status data starts flowing when the device pushes a change or the user makes a change in HomeKit
* Improved responsiveness
* Improved the currentMediaState and targetMediaState code
* Refactored the device status code
* Cleaned up and improved logging even more

## 0.1.9 (2021-02-22)
* Fixed problem where accessory would not load when the session would not get created

## 0.1.8 (2021-02-22)
* Improved robustness and error messages for generic session
* Improved loading of Channel List. Now only refreshes once the list has expired, this reduces web traffic a lot
* Improved mqtt session handling
* Migrated from request (deprecated) to axios for all web requests
* Bumped dependencies and pruned unused dependencies from package.json
* Fixed Homebridge v1.3.0 warning when renaming an input

## 0.1.7 (2021-02-20)
* Fixed bugs and improved robustness of Telenet sessions

## 0.1.6 (2021-02-20)
* Improved detection and handling of expired sessions for Telenet

## 0.1.5 (2021-02-20)
* Fixed warnings appearing in Homebridge 1.3.0
* Changed channel refresh time from 30s to 60s
* Inhibited sending of View TV Settings command when device power is off
* Improved detection of power state
* Improved logging

## 0.1.4 (2021-02-19)
* Fixed error in mqtt session

## 0.1.3 (2021-02-19)
* Fixed error in changelog

## 0.1.2 (2021-02-19)
* Improved robustness if internet connection fails
* Improved logging
* Clean-up and document code
* Added funding links
* Started adding support for CurrentMediaState and TargetMediaState
* Further work done on GB session code

## 0.1.1 (2021-02-17)
* Improved logging and robustness

### Initial Release

## 0.1.0 (2021-02-16)
* Initial release (rather experimental)

