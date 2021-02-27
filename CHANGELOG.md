# Changelog

All notable changes to this project will be documented in this file.

### Bug Fixes and Improvements

## 0.1.14-beta.1 (2020-02-26)
* Bump engine dependencies (Node and Homebridge)
* Set source type to application and device type to TV
* Improved handling of profile channels
* Added ability to add a customer channel names (needed for Netflix)
* Added better handling of non-linear TV and apps


## 0.1.13 (2020-02-25)
* Fixed bugs in the BE session

## 0.1.12 (2020-02-25)
* Fixed typo in code for BE

## 0.1.11 (2020-02-25)
* Fixed bug with session state handler for BE

## 0.1.10 (2020-02-25)
* Added support of Profiles. Desired profile can be configured in config.json. Defaults to Shared if not found
* Added support of showing/hiding channel numbers in the channel list
* Added triple-volume-down click detection. A triple down sends the muteCommand instead of volDownCommand
* Finaly fixed the mqtt device connection. UI status data starts flowing when the device pushes a change or the user makes a change in HomeKit
* Improved responsiveness
* Improved the currentMediaState and targetMediaState code
* Refactored the device status code
* Cleaned up and improved logging even more

## 0.1.9 (2020-02-22)
* Fixed problem where accessory would not load when the session would not get created

## 0.1.8 (2020-02-22)
* Improved robustness and error messages for generic session
* Improved loading of Channel List. Now only refreshes once the list has expired, this reduces web traffic a lot
* Improved mqtt session handling
* Migrated from request (deprecated) to axios for all web requests
* Bumped dependencies and pruned unused dependencies from package.json
* Fixed homebridge v1.3.0 warning when renaming an input

## 0.1.7 (2020-02-20)
* Fixed bugs and improved robustness of Telenet sessions

## 0.1.6 (2020-02-20)
* Improved detection and handling of expired sessions for Telenet

## 0.1.5 (2020-02-20)
* Fixed warnings appearing in Homebridge 1.3.0
* Changed channel refresh time from 30s to 60s
* Inhibited sending of View TV Settings command when device power is off
* Improved detection of power state
* Improved logging

## 0.1.4 (2020-02-19)
* Fixed error in mqtt session

## 0.1.3 (2020-02-19)
* Fixed error in changelog

## 0.1.2 (2020-02-19)
* Improved robustness if internet connection fails
* Improved logging
* Cleanup and document code
* Added funding links
* Started adding support for CurrentMediaState and TargetMediaState
* Further work done on GB session code

## 0.1.1 (2020-02-17)
* Improved logging and robustness

### Initial Release

## 0.1.0 (2020-02-16)
* Initial release