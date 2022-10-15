# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# IMPORTANT NOTICE
This is a major update due to the change in endpoints in the backend systems that occured on 13.10.2022.
I've managed to get the MQTT back up and running, which will allow HomeKit to know the box status again.
MQTT control is working again, I've tested Power ON & OFF, these are working, will test other functions shortly.
The channel list needs to be rewritten as the data has changed a lot, so currently I've simply loaded 2 x dummy channel names to keep HomeKit happy.
This is alpha code, and I'm currently testing on my own system.
Please report all bugs and problems.


# Bug Fixes and Improvements

## Current In-Work List (Future Releases)
See below

## Major Reworks TO-DO:
* Implement refreshToken capabilities
* Rework refreshMasterChannelList: currently generates a dummy list of 2 channels, needs to be rewritten for new endpoint
* Rework getRecordingState: currently disabled, new endpoint not yet known
* Rework setPersonalizationDataForDevice: currently disabled, new endpoint not yet known
* Update axios to 1.1.x (this is not a simple dependency update, breaks many things)




## 2.0.0-alpha.3 (2022-10-15)
* Got MQTT control working again
* Reinstated sendKey via MQTT

## 2.0.0-alpha.2 (2022-10-15)
* Fixed crash when the box pushed a personalizationData change

## 2.0.0-alpha.1 (2022-10-15)
* Reworked authorization due to changes in backend, logons now running again for CH. NL, IE and AT should work as well.
* Reworked MQTT session connection due to changes in backend, MQTT now running again and shows box status, including power state
* Controlling via MQTT is not yet possible
* Updated Sunrise TV endpoints from upctv to sunrisetv
* Fixed incorrect link in readme for Virgin TV GO
* Fixed various crashes when no expected data received
* Bumped dependencies (node, tough-cookie)
* Updated README.md to reference iOS 16.0
* Initial v2 release, based on v1.4.9

