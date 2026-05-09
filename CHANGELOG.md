# Changelog

All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# Bug Fixes and Improvements

## Current To-Do and In-Work List (For Future Releases, in rough order of priority):

TODO
review all http endpoints, make sure a suitable log entry is being made so I can check the data is plausible

configsvc
authorizationService DONE
personalizationService DONE
purchaseService
recordingService
linearService
sessionService

IMPORTANR
Implement setTargetMediaState to send the Play/Pause/Stop functions, so that Eve can control the media state. Watch out for sending commands twice when using the remote control. maybe the sendKey redirects to the setmediaState?

Behavious: SetMediaState from 0 to 1 will start playing.
Behavious: SetMediaState from 0 to 1 will start playing.
Behavious: SetMediaState from 2 to 1 will start playing.
Behavious: SetMediaState from 1 to 2 will start playing.
unreliable, compare to webclient... this is driving me crazy!
might have to revert to sendKeys to set Play and Stop/Pause



CHECK
make sendKey logging consistent

CHECK
what are my issues with persistence?
Persisting the input state visibility between restarts would be good
Visibility cannot be set if the user has no WriteAccess to the channel list!!
Persistance test:
1. Hide the channel SRF info using Home app
2. Force-close and reopen  the home app. Confirm channel is still hidden
3. Confirm the current visibility state in the plugin logs is correct
3. Restart the plugin
4. Observe the current visibility state in the plugin logs - does it get the right value from HomeKit HAP? If so, no persistance required.

Device name: this comes from backend
Channel name: overwrite not allowed - can we disable in HomeKit. Yes, but prevents setting visibility

CHALLENGE
The mostWatchedChannelList is not working

## 2.4.0-alpha.42 (2026-05-07)
- changed the name of hidden channels from HIDDEN_xx to HIDDENxx to stop the HAP-NodeJS WARNING: The accessory 'HIDDEN_32' has an invalid 'Name' characteristic 

## 2.4.0-alpha.41 (2026-05-07)
- fixed typos in this change log

## 2.4.0-alpha.40 (2026-05-07)
- Changes to code to support HAP-NodeJS still works with Homebridge v1.11.x
- Reinstated engine "homebridge": "^1.11.4||^2.0.0",

## 2.4.0-alpha.39 (2026-05-07)
- fixed issues caused by HAP-NodeJS v1 released with Homebridge v2 where use of enums off the Characteristic class is no longer supported
- due to these HAP-NodeJS changes, support for Homebridge versions below 2.0.0 is no longer provided
- Bumped engine "homebridge": "^2.0.0",
- Bumped engine "node": "^24.15.0"
- Bumped dependency "axios": "^1.16.0",
- Bumped dependency "axios-cookiejar-support": "^7.0.0",
- Bumped dependency "mqtt": "^5.15.1",
- Bumped dependency "puppeteer-core": "^24.43.0",
- Bumped dependency "qs": "^6.15.1",
- Bumped dependency "tough-cookie": "^6.0.1",
- Bumped dependency "ws": "^8.20.0"

## 2.4.0-alpha.38 (2026-03-07)

- changes to settargetmediastate & setMediaState

## 2.4.0-alpha.37 (2026-03-07)

- changes to settargetmediastate

## 2.4.0-alpha.36 (2026-03-07)

- changes to settargetmediastate

## 2.4.0-alpha.35 (2026-03-07)

- changes to settargetmediastate

## 2.4.0-alpha.34 (2026-03-07)

- changes to settargetmediastate

## 2.4.0-alpha.33 (2026-03-07)

- optimised getmqtttoken
- checked function of setTargetMediaState , needs testing, controlled by Eve

## 2.4.0-alpha.32 (2026-03-07)

- made all urls into proper url objects
- fixed issue with getMostWatchedChannels

## 2.4.0-alpha.31 (2026-03-07)

- change the master channel list refresh to once a day at a random time between 0000 and 0600. The user setting has no impact and can be removed
- cleaned up some more diagnostic logging

## 2.4.0-alpha.30 (2026-03-07)

- cleaned up some diagnostic logging

## 2.4.0-alpha.29 (2026-03-06)

- optimised refreshDeviceChannelList

## 2.4.0-alpha.28 (2026-03-06)

 - fixed issue with detecting status, introduce 2 versions ago

## 2.4.0-alpha.27 (2026-03-06)

-- removed test code to detect plugin shutdown

## 2.4.0-alpha.26 (2026-03-06)

-- added test code to detect plugin shutdown
- added clean unsubscribe on plugin shutdown

## 2.4.0-alpha.25 (2026-03-05)

 - fixed introduced bug in setRemoteKey

## 2.4.0-alpha.24 (2026-03-05)

 - made channel ConfiguredName read only as the backend defines the channel name

## 2.4.0-alpha.23 (2026-03-05)

 - optimised setRemoteKey

## 2.4.0-alpha.22 (2026-03-05)

 - fixed error handling in refreshMasterChannelList

## 2.4.0-alpha.21 (2026-03-05)

 - fixed logging bug in sendKey

## 2.4.0-alpha.20 (2026-03-05)

 - improved accessory information display to show a better serialnumber
 - updated set-top box model name for 2008C
 - added more robustness to many calls in case we never get a configsvc response
 - optimised the mqttDeviceStateHandler
 - improved refreshMasterChannelList
 - improved a lot of webservice calls, removing promises and going to try-catch

## 2.4.0-alpha.19 (2026-03-04)

 - removed some dead code
 - enabled handler for setClosedCaptions and setPictureMode, test control from Eve app
 - improved send key logging

## 2.4.0-alpha.18 (2026-03-03)

- Fixed dislayOrder crash on startup - check this!
- Optimised post publishExternalAccessories HAP updates
- Changed all updateValue to updateCharacteristic post-publish to be more HAP compliant

## 2.4.0-alpha.17 (2026-03-03)

- Cleaned up the platform code
- Changed all get/set handlers to async
- Optimised all get/set handlers
- More HAP minor bug fixes and optimisations

## 2.4.0-alpha.16 (2026-03-03)

- Fixed bug: TypeError: this.prepareinputSourceServices is not a function

## 2.4.0-alpha.15 (2026-03-03)

- Renamed Current Channnel Id and Current Channel Name to Active Channel Id and Active Channel Name for consistency with Active Identifier

## 2.4.0-alpha.14 (2026-03-03)

- Optimised HAP code for strict compliance
- Removed debug logging

## 2.4.0-alpha.13 (2026-03-03)

- Fixes to logging of getInputName for diagnostics

## 2.4.0-alpha.12 (2026-03-03)

- More improvements to get ConfiguredName working properly on the Eve app (needs testing for both TV and Inputs)

## 2.4.0-alpha.11 (2026-03-03)

- Fixed logging bug in setInputName

## 2.4.0-alpha.10 (2026-03-03)

## 2.4.0-alpha.9 (2026-03-03)

## 2.4.0-alpha.8 (2026-03-03)

- More improvements to get ConfiguredName working properly on the Eve app (needs testing for both TV and Inputs)

## 2.4.0-alpha.7 (2026-03-03)

- Corrected some debug log levels
- Fixed ConfiguredName being empty on the Eve app (needs testing for both TV and Inputs)

## 2.4.0-alpha.6 (2026-03-02)

- Removed getMute and getVolume, these are not supported
- More code optimisations

## 2.4.0-alpha.5 (2026-03-02)

- More code performance improvements
- Improved all HAP code

## 2.4.0-alpha.4 (2026-03-02)

- Fixed self bug in volume control

## 2.4.0-alpha.4 (2026-03-02)

- Fixed self bug in volume control

## 2.4.0-alpha.3 (2026-03-02)

- Fixed new introduced bug with displayed channel being incorrect (offset by 1)
- Added "devMode": true support to config.json

## 2.4.0-alpha.2 (2026-03-01)

- Improved README.md text
- Improved config.schema.json description text
- Improved discovery of devices and accessory setup
- Improved mqtt handling
- Improved overall code robustness and fixed many small bugs
- Fixed spelling mistakes in comments

## 2.4.0-alpha.1 (2026-02-27)

- Adapted login sequence for CH
- Updated config.schema.json to support new CH login method and improced description texts
- Bumped dependency "axios": "^1.13.6",

## 2.3.8 (2026-02-27)

This is a maintenance release to bring dependencies up to date.

- Updated iOS and Homebridge version references in Readme
- Bumped dependency "qs": "^6.15.0",

## 2.3.7 (2026-02-14)

This is a maintenance release to bring dependencies up to date.

- Bumped engine "homebridge": "^1.9.0||^2.0.0-beta",
- Bumped engine "node": "^24.13.0"
- Bumped dependency "axios": "^1.13.5",
- Bumped dependency "axios-cookiejar-support": "^6.0.5",
- Bumped dependency "debug": "^4.4.3",
- Bumped dependency "mqtt": "^5.15.0",
- Bumped dependency "qs": "^6.14.2",
- Bumped dependency "semver": "^7.7.4",
- Bumped dependency "tough-cookie": "^6.0.0",
- Bumped dependency "ws": "^8.19.0"

## 2.3.6 (2025-08-22)

- Fixed connection problems for NL
- Updated references to NL in Readme
- Updated iOS and Homebridge version references in Readme
- Formatted source code using Prettier
- Bumped dependency "axios-cookiejar-support": "^6.0.4",
- Bumped dependency "axios": "^1.11.0",
- Bumped dependency "debug": "^4.4.1",
- Bumped dependency "mqtt": "^5.14.0",
- Bumped dependency "qs": "^6.14.0",
- Bumped dependency "semver": "^7.7.2",
- Bumped dependency "tough-cookie": "^5.1.2",
- Bumped dependency "ws": "^8.18.3"
- Bumped dependency "homebridge": "^1.9.0||^2.0.0-beta",
- Bumped dependency "node": "^22.18.0"

## 2.3.5 (2024-10-25)

- Added preparations for Homebridge 2.0
- Updated iOS and Homebridge version references in Readme
- Bumped dependency "axios": "^1.7.5",
- Bumped dependency "axios-cookiejar-support": "^5.0.3",
- Bumped dependency "debug": "^4.3.7",
- Bumped dependency "mqtt": "^5.10.1",
- Bumped dependency "qs": "^6.13.0",
- Bumped dependency "semver": "^7.6.3",
- Bumped dependency "tough-cookie": "^5.0.0",
- Bumped dependency "ws": "^8.18.0"
- Bumped dependency "homebridge": "^1.8.4||^2.0.0-beta",
- Bumped dependency "node": "^20.18.0"

## 2.3.4 (2024-06-22)

- Updated PL references in package.json
- Minor Readme updates

## 2.3.3 (2024-06-20)

- Bumped dependency "mqtt": "^5.7.2"
- Bumped dependency "ws": "^8.17.1"

## 2.3.2 (2024-06-15)

This release fixes the logon issues for Belgium users. Other countries still have issues, refer issue #112

- Fixed login issues for BE users
- Bumped dependency "axios": "^1.7.2"
- Bumped dependency "axios-cookiejar-support": "^5.0.2"
- Bumped dependency "debug": "^4.3.5"
- Bumped dependency "mqtt": "^5.7.0"
- Bumped dependency "qs": "^6.12.1"
- Bumped dependency "semver": "^7.6.2"
- Bumped dependency "tough-cookie": "^4.1.4"
- Bumped dependency "ws": "^8.17.0"
- Removed Magenta TV from package.json
- Updated iOS version references in Readme
- Updated Readme file to change UPC references to Liberty Global
- Updated Readme file with minor Readme changes for BE and PL

## 2.3.1 (2024-04-06)

This is a maintenance release to bring dependencies up to date.
The core logon issues still exist, refer issue #112

- Removed Magenta TV from package.json
- Bumped dependency "axios": "^1.6.8"
- Bumped dependency "mqtt": "^5.5.0"
- Bumped dependency "semver": "^7.6.0"
- Bumped dependency "qs": "^6.12.0"

## 2.3.0 (2024-01-25)

- Added auto endpoint detection for all services, this fixes connection issues in many countries
- Added ability to set authentication method. You must select the method in the plugin config. If none set, logon method falls back to using country code
- Added Disable Session Watchdog to config.schema to make it easier to debug by turning off the session watchdog
- Fixed issue connecting to mqtt broker (issue started ca. 23 Jan 2024) by adding extra subprotocol headers
- Fixed bug in getMostWatchedChannels where the endpoint was incorrect
- Updated Readme plugin status for various countries
- Updated iOS version references in Readme
- Bumped dependency "axios": "^1.6.6"
- Bumped dependency "mqtt": "^5.3.5"
- IN WORK: Reworking GB authentication methods. NOT YET WORKING, PLEASE BE PATIENT

## 2.2.16 (2024-01-16)

- Removed AZ, CZ, DE, HU, RO from config.json and Readme. These countries no longer offer UPC TV.

## 2.2.15 (2024-01-14)

- Fixed issue with MQTT connection failure in CH due to change of MQTT endpoint
- Bumped dependency "axios-cookiejar-support": "^5.0.0"

## 2.2.14 (2024-01-06)

- Updated description in package.json for better display in Homebridge on small device screens
- Updated iOS references to iOS 17.2 in README.md
- Bumped dependency "axios": "^1.6.5"
- Bumped dependency "mqtt": "^5.3.4"

## 2.2.13 (2023-11-09)

- Updated Homebridge references in README.md
- Bumped dependency "axios": "^1.6.1"
- Bumped dependency "mqtt": "^5.2.0"
- Bumped dependency "homebridge": "^1.7.0"

## 2.2.12 (2023-10-28)

- Updated iOS references to iOS 17.x in README.md
- Added config option masterChannelRefreshCheckInterval to select desired master channel list refresh check interval (in seconds). Default 60s.
- Bumped dependency "axios": "^1.6.0"
- Bumped dependency "mqtt": "^5.1.3"
- Bumped dependency "node": "^20.9.0"

## 2.2.11 (2023-08-05)

- Updated iOS references in README.md
- Bumped dependency "mqtt": "^5.0.2"

## 2.2.10 (2023-07-23)

- Improved authentication refresh
- Added config items masterChannelListValidFor to allow easy tuning of timer periods
- Fixed minor typos and improved some text in README.md
- Fixed ReferenceError bug #107
- Bumped dependency "semver": "^7.5.4"
- Bumped dependency "tough-cookie": "^4.1.3"
- Bumped dependency "node": ">=18.17.0"

## 2.2.9 (2023-05-29)

- Fixed bug with access token expiring causing 401 unauthorised errors when refreshing channel list
- Cleaned up some code

## 2.2.8 (2023-05-22)

- Updated iOS version references
- Fixed bug causing Homebridge crash when master channel list is not yet loaded
- Fixed bug causing Homebridge crash when any error occurs in refresh of master channel list

## 2.2.6 (2023-05-19)

- Fixed some minor logging typos
- Added logging of version info
- Updated engine version references
- Bumped dependency "axios": "^1.4.0",
- Bumped dependency "qs": "^6.11.2",

## 2.2.5 (2023-03-28)

- Improved robustness when no set-top boxes detected in the user profile
- Updated iOS version references
- Minor improvements to the Readme

## 2.2.4 (2023-03-11)

- Bumped dependency "qs": "^6.11.1",
- Bumped dependency "node": ">=16.19.1"

## 2.2.3 (2023-03-01)

- Bumped dependency "axios": "^1.3.4",

## 2.2.2 (2023-02-18)

- Fixed bug causing 401 unauthorized when refreshing the master channel list
- Bumped dependency "axios": "^1.3.3"

## 2.2.1 (2023-02-11)

- Fixed issue #96 with failled mqtt session not reconnecting automatically
- Cleaned up and optimized some code
- Bumped dependency "axios": "^1.3.2"
- Improved readme content and layout

## 2.2.0 (2023-01-28)

- Added support for new ARRIS VIP5002W set-top box as seen in NL in January 2023
- Added support for households which do not have recording entitlements
- Updated device manufacturer names
- Updated iOS version references
- Updated set-top box model references
- Updated set-top box version references
- Improved detection of local DVR
- Improved logging code
- Bumped dependency "axios": "^1.2.5"

## 2.1.3 (2023-01-16)

- Fixed bug: 'Target Media State': characteristic was supplied illegal value #91
- Fixed bug in setMediaState
- Improved handling of Target Media State

## 2.1.2 (2023-01-08)

- Fixed bug causing the plugin to crash when logging an error in getRecordingState and refreshDeviceChannelList

## 2.1.1 (2023-01-05)

- Fixed bug where InputSourceType and InputDeviceType values were not correctly read

## 2.1.0 (2023-01-03)

- Added KeyMacro support
- Added custom characteristics: Current Channel Id and Current Channel Name, useful in automations
- Added preparation for reading current program name (future feature)
- Fixed bug where Input Device Type was not always correctly logged
- Fixed bug where Input Source Type was not always correctly logged
- Updated iOS version references
- Bumped dependency "axios": "^1.2.2"
- Bumped dependency "axios-cookiejar-support": "^4.0.6"

## 2.0.4 (2022-12-05)

- Fixed model detection of HUMAX EOS1008R boxes
- Fixed detection of Status Active to properly show mqtt active or not using Status Active in the Home app
- Added keyevent NextUserProfile to config.json as a selectable remote key
- Improved error handling and cleaned up some code in various subroutines
- Bumped dependency "axios": "^1.2.1"

## 2.0.3 (2022-11-29)

- Fixed Telenet login for BE users

## 2.0.2 (2022-11-28)

- Improved startup speed (sessionWatchdog starts faster)
- Improved robustness for handling of user-defined box names if >14 characters
- Improved mqttClient error handling to try and catch a rare error
- Fixed incorrect endpoint for UPC TV Poland
- Fixed bug in setPersonalizationDataForDevice causing crash for GB users
- Fixed minor logging issue
- Fixed default settings for TargetMediaState
- Cleaned up some GB code
- Bumped dependency "axios": "^1.2.0"
- Bumped Homebridge "homebridge": ">=1.6.0",

## 2.0.2-beta.1 (2022-11-19)

- Added custom characteristic Current Channel Id
- Added custom characteristic Current Channel Name
- Optimised some code

## 2.0.1 (2022-11-19)

- Increased reliability of mqtt messages by setting QoS
- Optimised the GB session code Removed some left over debug code

## 2.0.0 (2022-11-14)

- Rewrote plugin to handle new login sequence and new endpoints following backend changes on 13.10.2022
- Major startup speed improvements after Homebridge reboot
- Improved mqtt performance
- Added support of channel sort by most watched
- And many more small bug fixes and improvements included
