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
* Check adding/removing/reordering of a profile channel list works properly
* Fix problem with getPersonalizationData failing after plugin has been running overnight with ERR_BAD_REQUEST
* Implement refreshToken capabilities
* Rework getRecordingState: currently disabled, new endpoint not yet known
* Update axios to 1.1.x (once axios runs properly, 1.1.3 has some bugs)
* Readme needs updating to reflect all changes


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
