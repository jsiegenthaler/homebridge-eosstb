# Changelog

All notable changes to this project will be documented in this file.

Please restart Homebridge after every plugin update.

### Bug Fixes and Improvements


## 0.2.0-beta.76 (2021-03-20)
* Set media state to STOP when set-top box power is off
* Improve logging of power state changes

## 0.2.0-beta.75 (2021-03-20)
* Set default media state to STOP (applicable only on Homebridge restart)
* Added settopbox as a valid accessoryCategory

## 0.2.0-beta.74 (2021-03-19)
* Fixed masterChannelList to read proper user channel list and be locationId aware

## 0.2.0-beta.73 (2021-03-19)
* Fixed a mqtt bug where source is sometimes null

## 0.2.0-beta.72 (2021-03-19)
* Fixed a customisation bug where the accessoryCategory was not being set properly

## 0.2.0-beta.71 (2021-03-19)
* Fixed a bug where the RemoteControl would cause the box to turn off

## 0.2.0-beta.70 (2021-03-19)
* Cleaned up some Session BE and GB code

## 0.2.0-beta.69 (2021-03-19)
* Fix logging bug

## 0.2.0-beta.68 (2021-03-19)
* Added logging of newly discovered mqtt message types
* Cleaned up Telenet session code

## 0.2.0-beta.67 (2021-03-19)
* Cleaned up more GB debug code

## 0.2.0-beta.66 (2021-03-19)
* Cleaned up debug code, GB logon is working

## 0.2.0-beta.65 (2021-03-18)
## 0.2.0-beta.64 (2021-03-18)
## 0.2.0-beta.63 (2021-03-18)
## 0.2.0-beta.62 (2021-03-18)
## 0.2.0-beta.61 (2021-03-18)
## 0.2.0-beta.60 (2021-03-18)
## 0.2.0-beta.59 (2021-03-18)
## 0.2.0-beta.58 (2021-03-18)
## 0.2.0-beta.57 (2021-03-18)
## 0.2.0-beta.56 (2021-03-18)
## 0.2.0-beta.55 (2021-03-18)
## 0.2.0-beta.54 (2021-03-18)
## 0.2.0-beta.53 (2021-03-18)
## 0.2.0-beta.52 (2021-03-18)
## 0.2.0-beta.51 (2021-03-18)
## 0.2.0-beta.50 (2021-03-18)
## 0.2.0-beta.49 (2021-03-18)
## 0.2.0-beta.48 (2021-03-18)
## 0.2.0-beta.47 (2021-03-18)
* Working on the GB logon

## 0.2.0-beta.46 (2021-03-18)
* Removed "name" from mandatory check of platform config items, as name is optional

## 0.2.0-beta.45 (2021-03-18)
* Added checks of mandatory config items on startup

## 0.2.0-beta.44 (2021-03-17)
* Moved the master channel list refreshed log entry to debugLevel 1 to avoid flooding the Homebridge log

## 0.2.0-beta.43 (2021-03-17)
* Fixed a profile channel list loading bug

## 0.2.0-beta.42 (2021-03-17)
* Fixed a logging bug
* Bumped dependencies

## 0.2.0-beta.41 (2021-03-16)
* Added customising of triple-press time for Mute command
* Added tip for Homebridge config showing deviceId
* Fixed wrong year in changelog file

## 0.2.0-beta.40 (2021-03-15)
* Reinstated master channel list check (deleted by mistake)
* Cleaned up mqtt status and master channel list last updated variables

## 0.2.0-beta.39 (2021-03-14)
* Improved robustness of getInputName when inputs not yet loaded, now returns NO_CHANNEL_NAME
* Fixed bug when loading inputs if maxChannels is not found in config
* Cleaned up some debug logging

## 0.2.0-beta.38 (2021-03-14)
* Improved robustness of sessionWatchdog after an unexpected OS restart
* Removed useless getuiStatus on every received mqtt message, it's not responding

## 0.2.0-beta.37 (2021-03-14)
* Removed some debug logging

## 0.2.0-beta.36 (2021-03-13)
* Fixed bug in get personaliation data on startup
* Fixed bug in loading input sources when channel was hidden

## 0.2.0-beta.35 (2021-03-13)
* Fixed TypeError: Cannot read property 'channelName' of undefined like 2522

## 0.2.0-beta.34 (2021-03-13)
* Reworked and reenabled session watchdog
* Improved debug logging to monitor mqtt
* Fixed bug with maxChannels setting

## 0.2.0-beta.33 (2021-03-12)
* Reworked and reenabled session watchdog
* Added mqtt watchdog

## 0.2.0-beta.32 (2021-03-11)
* Cleaned up some remote logging

## 0.2.0-beta.31 (2021-03-11)
* Fixed more remote control bugs (due to multiDevice)

## 0.2.0-beta.30 (2021-03-11)
* Updated SerialNumber to display the deviceId, the same as shown on the TV
* Fixed more remote control bugs (due to multiDevice)


## 0.2.0-beta.29 (2021-03-11)
* Fixed some bugs when the box is playing an app
* Fixed the remaping of remote keys for multiple devices
* Added config items arrowUpButton and arrowDownButton to allow remapping of ArrowUp and ArrowDown in the remote control to ChannelUp and ChannelDown

## 0.2.0-beta.28 (2021-03-09)
* Cleaned up some logging

## 0.2.0-beta.27 (2021-03-09)
* Fixed a startup bug

## 0.2.0-beta.27 (2021-03-09)
* Fixed a startup bug

## 0.2.0-beta.25 (2021-03-09)
* Removed some dev logging

## 0.2.0-beta.25 (2021-03-09)
* Fixed another multi-device startup bug

## 0.2.0-beta.24 (2021-03-09)
* Changed from cached platform accessories back to standard external accessories
* Fixed bug when no devices array exists in config

## 0.2.0-beta.23 (2021-03-09)
* Removed problematic concats

## 0.2.0-beta.22 (2021-03-09)

## 0.2.0-beta.21 (2021-03-09)
* Fixed handling of device name changes pushed by server

## 0.2.0-beta.20 (2021-03-09)

## 0.2.0-beta.19 (2021-03-09)
* Fixed bug in Mute control

## 0.2.0-beta.18 (2021-03-09)
* Fixed bug in mqtt message handler for multiple devices

## 0.2.0-beta.17 (2021-03-09)
* Fixed bug in mqtt message handler for multiple devices

## 0.2.0-beta.16 (2021-03-08)
* Fixed bug in setPersonalizationDataForDevice

## 0.2.0-beta.15 (2021-03-08)
* Fixed timings again for Telenet

## 0.2.0-beta.14 (2021-03-08)
* Moved mqtt to platform level, added proper device caching in Homebridge

## 0.2.0-beta.12 (2021-03-07)
* Added more mqtt debugging

## 0.2.0-beta.11 (2021-03-07)
* Improved mqtt device profile request to be limited to current device
* Improved mqtt logging

## 0.2.0-beta.10 (2021-03-07)
* Improved timings for Telenet

## 0.2.0-beta.9 (2021-03-07)
* Fixed bug in auto channel list selector

## 0.2.0-beta.8 (2021-03-07)
* Debugging Telenet session

## 0.2.0-beta.7 (2021-03-07)
* Debugging Telenet session

## 0.2.0-beta.6 (2021-03-07)
* Adapted timings for Telenet

## 0.2.0-beta.5 (2021-03-07)
* Working on a Telenet session bug

## 0.2.0-beta.4 (2021-03-07)
* Working on a Telenet session bug

## 0.2.0-beta.3 (2021-03-07)
* Fixed a Telenet session bug

## 0.2.0-beta.2 (2021-03-07)
* Fixed a couple of bugs in channel list selection and storing of current state

## 0.2.0-beta.1 (2021-03-06)
* Refactorerd code again for proper multi-device support
* Improved session setup
* Changing the mediabox (device) name in the web gui will now update the accessory name in HomeKit
* Improved handling of Shared Profile channel list
* Added smart profile selector


## 0.1.14-beta.6 (2021-03-04)
* Improved error handling when device control is relinquished to another controller
* Improved startup process
* Refactorerd code to get ready for multi-device support
* Started adding support for visibilityState and channel renaming


## 0.1.14-beta.5 (2021-02-27)
* Fixed another crash when an app was playing on the box

## 0.1.14-beta.4 (2021-02-27)
* Fixed crash when an app was playing on the box

## 0.1.14-beta.3 (2021-02-27)
* Added logging of recentlyUsedApps

## 0.1.14-beta.2 (2021-02-27)
* Fixed bug in getProfilesUpdate: (Cannot read property 'findIndex' of undefined) when channelNames does not exist

## 0.1.14-beta.1 (2021-02-27)
* Bump engine dependencies (Node and Homebridge)
* Set source type to application and device type to TV
* Improved handling of profile channels
* Added ability to add a customer channel names (needed for Netflix)
* Added better handling of non-linear TV and apps


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
* Fixed homebridge v1.3.0 warning when renaming an input

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
* Cleanup and document code
* Added funding links
* Started adding support for CurrentMediaState and TargetMediaState
* Further work done on GB session code

## 0.1.1 (2021-02-17)
* Improved logging and robustness

### Initial Release

## 0.1.0 (2021-02-16)
* Initial release