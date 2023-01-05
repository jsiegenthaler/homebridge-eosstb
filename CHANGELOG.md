# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# Bug Fixes and Improvements

## Current To-Do and In-Work List (For Future Releases, in rough order of priority):
* Add ability to log and read current program name
* Implement refreshToken capabilities


## 2.1.x (2023-01-xx)
* Added logging of current program name and end time
* Added custom characteristics: Current Program Name Current Program End Time, useful in automations


## 2.1.1 (2023-01-05)
* Fixed bug where InputSourceType and InputDeviceType values were not correctly read


## 2.1.0 (2023-01-03)
* Added KeyMacro support
* Added custom characteristics: Current Channel Id and Current Channel Name, useful in automations
* Added preparation for reading current program name (future feature)
* Fixed bug where Input Device Type was not always correctly logged
* Fixed bug where Input Source Type was not always correctly logged
* Updated iOS version references
* Bumped dependency "axios": "^1.2.2"
* Bumped dependency "axios-cookiejar-support": "^4.0.6"


## 2.0.4 (2022-12-05)
* Fixed model detection of HUMAX EOS1008R boxes
* Fixed detection of Status Active to properly show mqtt active or not using Status Active in the Home app
* Added keyevent NextUserProfile to config.json as a selectable remote key
* Improved error handling and cleaned up some code in various subroutines
* Bumped dependency "axios": "^1.2.1"


## 2.0.3 (2022-11-29)
* Fixed Telenet login for BE users


## 2.0.2 (2022-11-28)
* Improved startup speed (sessionWatchdog starts faster)
* Improved robustness for handling of user-defined box names if >14 characters
* Improved mqttClient error handling to try and catch a rare error
* Fixed incorrect endpoint for UPC TV Poland
* Fixed bug in setPersonalizationDataForDevice causing crash for GB users
* Fixed minor logging issue
* Fixed default settings for TargetMediaState
* Cleaned up some GB code
* Bumped dependency "axios": "^1.2.0"
* Bumped Homebridge "homebridge": ">=1.6.0",


## 2.0.2-beta.1 (2022-11-19)
* Added custom characteristic Current Channel Id
* Added custom characteristic Current Channel Name
* Optimised some code


## 2.0.1 (2022-11-19)
* Increased reliability of mqtt messages by setting QoS
* Optimised the GB session code Removed some left over debug code


## 2.0.0 (2022-11-14)
* Rewrote plugin to handle new login sequence and new endpoints following backend changes on 13.10.2022
* Major startup speed improvements after Homebridge reboot
* Improved mqtt performance
* Added support of channel sort by most watched
* And many more small bug fixes and improvements included
