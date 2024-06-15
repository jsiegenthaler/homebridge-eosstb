# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# Bug Fixes and Improvements

## Current To-Do and In-Work List (For Future Releases, in rough order of priority):
* Add ability to log and read current program name

## 2.3.2-beta.3 (2024-06-15)
* Fixed base url in getRecordingBookings to use backoffice.json reported url

## 2.3.2-beta.2 (2024-06-15)
* Fixed bug in generating backoffice url for BE
* Updated UPC references to Liberty Global in Readme
* Other minor Readme changes for BE and PL

## 2.3.2-beta.1 (2024-06-15)
This is a maintenance release to bring dependencies up to date.
This release also fixes logon for Belgium users, but other countries still have issues, refer issue #112
* Change countryBaseUrlArray for be to solve be logon issues, waiting on user feedback. #120
* Bumped dependency "axios": "^1.7.2"
* Bumped dependency "axios-cookiejar-support": "^5.0.2"
* Bumped dependency "debug": "^4.3.5"
* Bumped dependency "mqtt": "^5.7.0"
* Bumped dependency "qs": "^6.12.1"
* Bumped dependency "semver": "^7.6.2"
* Bumped dependency "tough-cookie": "^4.1.4"
* Bumped dependency "ws": "^8.17.0"
* Removed Magenta TV from package.json
* Updated iOS version references in Readme
* Updated Important Notice in Readme



## 2.3.1 (2024-04-06)
This is a maintenance release to bring dependencies up to date.
The core logon issues still exist, refer issue #112
* Removed Magenta TV from package.json
* Bumped dependency "axios": "^1.6.8"
* Bumped dependency "mqtt": "^5.5.0"
* Bumped dependency "semver": "^7.6.0"
* Bumped dependency "qs": "^6.12.0"


## 2.3.0 (2024-01-25)
* Added auto endpoint detection for all services, this fixes connection issues in many countries
* Added ability to set authentication method. You must select the method in the plugin config. If none set, logon method falls back to using country code
* Added Disable Session Watchdog to config.schema to make it easier to debug by turning off the session watchdog
* Fixed issue connecting to mqtt broker (issue started ca. 23 Jan 2024) by adding extra subprotocol headers
* Fixed bug in getMostWatchedChannels where the endpoint was incorrect
* Updated Readme plugin status for various countries
* Updated iOS version references in Readme
* Bumped dependency "axios": "^1.6.6"
* Bumped dependency "mqtt": "^5.3.5"
* IN WORK: Reworking GB authentication methods. NOT YET WORKING, PLEASE BE PATIENT


## 2.2.16 (2024-01-16)
* Removed AZ, CZ, DE, HU, RO from config.json and Readme. These countries no longer offer UPC TV.


## 2.2.15 (2024-01-14)
* Fixed issue with MQTT connection failure in CH due to change of MQTT endpoint
* Bumped dependency "axios-cookiejar-support": "^5.0.0"


## 2.2.14 (2024-01-06)
* Updated description in package.json for better display in Homebridge on small device screens
* Updated iOS references to iOS 17.2 in README.md
* Bumped dependency "axios": "^1.6.5"
* Bumped dependency "mqtt": "^5.3.4"


## 2.2.13 (2023-11-09)
* Updated Homebridge references in README.md
* Bumped dependency "axios": "^1.6.1"
* Bumped dependency "mqtt": "^5.2.0"
* Bumped dependency "homebridge": "^1.7.0"


## 2.2.12 (2023-10-28)
* Updated iOS references to iOS 17.x in README.md
* Added config option masterChannelRefreshCheckInterval to select desired master channel list refresh check interval (in seconds). Default 60s.
* Bumped dependency "axios": "^1.6.0"
* Bumped dependency "mqtt": "^5.1.3"
* Bumped dependency "node": "^20.9.0"


## 2.2.11 (2023-08-05)
* Updated iOS references in README.md
* Bumped dependency "mqtt": "^5.0.2"


## 2.2.10 (2023-07-23)
* Improved authentication refresh
* Added config items masterChannelListValidFor to allow easy tuning of timer periods
* Fixed minor typos and improved some text in README.md
* Fixed ReferenceError bug #107
* Bumped dependency "semver": "^7.5.4"
* Bumped dependency "tough-cookie": "^4.1.3"
* Bumped dependency "node": ">=18.17.0"


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
