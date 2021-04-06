# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# CONFIG CHANGES REQUIRED
You must updated your config when updating from 0.1.13 to 1.0.0 (or later versions). See the [configuration section in the Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md#configuration).

# Bug Fixes and Improvements


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

