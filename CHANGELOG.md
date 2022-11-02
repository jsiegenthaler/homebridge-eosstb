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
* IN PROGRESS: Get BE logon working. i need testers.
* Check adding/removing/reordering of a profile channel list works properly
* Fix problem with getPersonalizationData failing after plugin has been running overnight with ERR_BAD_REQUEST
* Implement refreshToken capabilities
* Rework getRecordingState: currently disabled, new endpoint not yet known
* Update axios to 1.1.x (this is not a simple dependency update, breaks many things)
* Readme needs updating to reflect all changes


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
