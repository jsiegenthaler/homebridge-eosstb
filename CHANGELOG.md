# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# IMPORTANT NOTICE
This is a major update due to the change in endpoints in the backend systems that occured on 13.10.2022.
This is beta code, and I'm currently testing on my own system.
Please report all bugs and problems.


# Bug Fixes and Improvements

## Current In-Work List (Future Releases)
See below

## Major Reworks TO-DO (in rough order of priority):
* Fix problem with getPersonalizationData failing after plugin has been running overnight with ERR_BAD_REQUEST
* Implement refreshToken capabilities
* Work on ideas for showing radio channels and using them
* Update axios to 1.1.x (once axios runs properly, 1.1.3 has some bugs) See https://github.com/axios/axios


## 2.0.0-beta.15 (2022-11-07)
* Bug fix with GB getPersonalizationData


## 2.0.0-beta.14 (2022-11-07)
* Bug fix with the endMqttClient call on Homebridge shutdown


## 2.0.0-beta.13 (2022-11-07)
* Bug fix to try and get GB session connected


## 2.0.0-beta.12 (2022-11-06)
* Bug fix to try and get GB session connected


## 2.0.0-beta.11 (2022-11-06)
* Enabled the interceptor to track down GB logon issues


## 2.0.0-beta.10 (2022-11-06)
* Improved startup sequence by properly using promises, startup is MUCH faster and more robust
* Adapted base url array for GB again (hopefully this fixes GB)
* GB sessions are under test


## 2.0.0-beta.9 (2022-11-05)
* Fixed refresh bug with live channel list handling
* Adapted base url array for GB and other countries to new syntax
* GB sessions are under test


## 2.0.0-beta.8 (2022-11-05)
* Fixed bug in updateDeviceState

## 2.0.0-beta.7 (2022-11-05)
* Removed configs for CZ, HU, and RO as these countries are no longer supported by UPC
* Fixed baseurl for IT and IE
* Cleaned up some code


## 2.0.0-beta.6 (2022-11-05)
* Fixed bug in setPersonalizationDataForDevice, now working properly


## 2.0.0-beta.5 (2022-11-05)
* Added recording state capabilities. Recording to local HDD not yet detectable, testers in GB wanted. Still needs adapting for series recordings.
* Disabled support for customPictureMode, is is handled by the inUse characteristic
* Updated Readme
* testing function: setPersonalizationDataForDevice


## 2.0.0-beta.4 (2022-11-03)
* BE logon confirmed working
* Improved shutdown process to inhibit reconnect during shutdown
* Fixed logging bug in refreshDeviceChannelList in message "DEBUG: input 17 subtype set to SV06077 %S input_SV06077"
* Fixed bug in refreshDeviceChannelList causing "This plugin generated a warning from the characteristic 'Current Visibility State'"


## 2.0.0-beta.3 (2022-11-03)
* Fixed incorrect country urls for BE


## 2.0.0-beta.2 (2022-11-03)
* Adapted BE logon sequence (thanks KrisSevenants)


## 2.0.0-beta.1 (2022-11-02)
* Adapted logon sequence following backend changes in October 2022. CH, NL, IE and AT should all work. Please get in touch if logon fails.
* Adapted channel handling following backend changes in October 2022.
* Added support of box default profile 
* Added channel sort option
* Added handling of Homebridge shutdown events to cleanly end the mqtt client
* Improved startup performance after reboot to correctly show channel name
* Improved mqtt handling, reducing network traffic
* Removed handling of recording status as new endpoints are unknown
* Updated references to Sunrise TV
* Updated references to new iOS versions
* Fixed many bugs
