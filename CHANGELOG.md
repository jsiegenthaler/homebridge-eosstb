# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# IMPORTANT NOTICE
This (v2.x) is a major update over v1.x due to the change in endpoints in the backend systems that occured on 13.10.2022.
Please report all bugs and problems.


# Bug Fixes and Improvements

## Current To-Do and In-Work List (For Future Releases, in rough order of priority):
* Work on ideas for showing radio channels and using them -> STARTED. Possible only with KeyMacros. How should these appear in the channel list?
* Fix potential problem with getPersonalizationData failing after plugin has been running overnight with ERR_BAD_REQUEST
* Implement refreshToken capabilities


## 2.0.2-beta.7 (2022-11-26)
* Fixed bug in setPersonalizationDataForDevice causing crash for GB users
* Fixed minor logging issue
* Improved mqttClient error handling to try and catch a rare error
* Bumped dependency "axios": "^1.1.3"
* Bumped Homebridge "homebridge": ">=1.6.0",


## 2.0.1 (2022-11-19)
* Increased reliability of mqtt messages by setting QoS
* Optimised the GB session code
* Removed some left over debug code


## 2.0.0 (2022-11-14)
* Rewrote plugin to handle new login sequence and new endpoints following backend changes on 13.10.2022
* Major startup speed improvements after Homebridge reboot
* Improved mqtt performance
* Added support of channel sort by most watched
* And many more small bug fixes and improvements included