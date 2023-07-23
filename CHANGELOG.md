# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# Bug Fixes and Improvements

## Current To-Do and In-Work List (For Future Releases, in rough order of priority):
* Add ability to log and read current program name


## 2.2.10 (2023-07-23)
* Improved authentication refresh
* Added config items masterChannelListValidFor to allow easy tuning of timer periods
* Fixed minor typos and improved some text in README.md
* Fixed ReferenceError bug #107
* Bumped dependency "semver": "^7.5.4",
* Bumped dependency "tough-cookie": "^4.1.3"


## 2.2.9 (2023-05-29)
* Fixed bug with access token expiring causing 401 unauthorised errors when refreshing channel list
* Cleaned up some code


## 2.2.8 (2023-05-22)
* Updated iOS version references
* Fixed bug causing Homebridge crash when master channel list is not yet loaded
* Fixed bug causing Homebridge crash when any error occurs in refresh of master channel list


## 2.2.6 (2023-05-19)
* Fixed some minor logging typos
* Added logging of version info
* Updated engine version references
* Bumped dependency "axios": "^1.4.0",
* Bumped dependency "qs": "^6.11.2",


## 2.2.5 (2023-03-28)
* Improved robustness when no set-top boxes detected in the user profile
* Updated iOS version references
* Minor improvements to the Readme


## 2.2.4 (2023-03-11)
* Bumped dependency "qs": "^6.11.1",
* Bumped dependency "node": ">=16.19.1"


## 2.2.3 (2023-03-01)
* Bumped dependency "axios": "^1.3.4",


## 2.2.2 (2023-02-18)
* Fixed bug causing 401 unauthorized when refreshing the master channel list
* Bumped dependency "axios": "^1.3.3"


## 2.2.1 (2023-02-11)
* Fixed issue #96 with failled mqtt session not reconnecting automatically
* Cleaned up and optimized some code
* Bumped dependency "axios": "^1.3.2"
* Improved readme content and layout


## 2.2.0 (2023-01-28)
* Added support for new ARRIS VIP5002W set-top box as seen in NL in January 2023
* Added support for households which do not have recording entitlements
* Updated device manufacturer names
* Updated iOS version references
* Updated set-top box model references
* Updated set-top box version references
* Improved detection of local DVR
* Improved logging code
* Bumped dependency "axios": "^1.2.5"


## 2.1.3 (2023-01-16)
* Fixed bug: 'Target Media State': characteristic was supplied illegal value #91
* Fixed bug in setMediaState
* Improved handling of Target Media State


## 2.1.2 (2023-01-08)
* Fixed bug causing the plugin to crash when logging an error in getRecordingState and refreshDeviceChannelList


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
