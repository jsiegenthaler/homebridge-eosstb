# Changelog
All notable changes to this project will be documented in this file.
See the [Readme file](https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/README.md) for full plugin documentation.
Please restart Homebridge after every plugin update.

# IMPORTANT NOTICE
This is a major update due to the change in endpoints in the backend systems that occured on 13.10.2022.
MQTT control is working again: Power, Remote Control and Channel Control are working properly.
Channel display is working again, and properly tracks channel changes on the box.


This is alpha code, and I'm currently testing on my own system.
Please report all bugs and problems.


# Bug Fixes and Improvements

## Current In-Work List (Future Releases)
See below

## Major Reworks TO-DO (in rough order of priority):
* IN PROGRESS: Get BE logon working
* Add back the Profile setting for channels, but together with Channel order
* Fix problem with getPersonalizationData failing after plugin has been running overnight with ERR_BAD_REQUEST
* Implement refreshToken capabilities
* Rework getRecordingState: currently disabled, new endpoint not yet known
* Rework setPersonalizationDataForDevice: currently disabled, new endpoint not yet known
* Update axios to 1.1.x (this is not a simple dependency update, breaks many things)
* Readme needs updating to reflect all changes


## 2.0.0-alpha.18 (2022-10-27)
* Improved robustness and prevented crash of setInput in case the input is not found in the channel list


## 2.0.0-alpha.17 (2022-10-26)
* Trials of BE sessions started: please test
* Added channelOrder config, allowing sort by mostWatched or by standard channel order. This provides for more efficient use of the limited channel list. I'd like feedback!
* Bumped dependencies (homebridge, node)
* Updated README.md to reflect latest iOS 16.1 and Homebridge 1.5.1 releases


## 2.0.0-alpha.16 (2022-10-23)
* Removed some debug code


## 2.0.0-alpha.15 (2022-10-23)
* Fixed bug in setInputName where the this.channelList bounds might be exceeded 

## 2.0.0-alpha.14 (2022-10-23)
* Tracking down error in line 4003 TypeError: Cannot set properties of undefined (setting 'configuredName')


## 2.0.0-alpha.13 (2022-10-23)
* Fixed bug preventing display of active channel immediately after Homebridge restart 
* Tuned mqtt messages to reduce message flooding
* Updated mqtt unique message id to 32 char to match web client


## 2.0.0-alpha.12 (2022-10-21)
* Cleaned up a lot of debug code and comments
* Fixed bug in mqtt services where channel changes were not being subscribed to properly
* Fixed bug in getInput where the subtype was not being detected properly and thus channel was not being displayed properly on refresh. This was an old bug from v1! 


## 2.0.0-alpha.11 (2022-10-19)
* Fixed bug with assignment to const


## 2.0.0-alpha.10 (2022-10-19)
* Added handling of entitlements with lots of debug code running
* Adapted subscribedChannelList to handle default profile only (removed profile options, was too complex)
* Updated default firmware version on config.schema to current firmware version 4.43
* Improved handling of config.schema maxChannels


## 2.0.0-alpha.8 (2022-10-18)
* Fixed masterChannelListExpiryDate in refreshMasterChannelList and cleaned up code
* Adapted code to load the default profile as configured on box
* Removed subscription to mqtt recordingStatus topic as endpoints not known


## 2.0.0-alpha.6 (2022-10-17)
* Adapted refreshMasterChannelList to work with new end point and all countries, needs fine tuning still
* Cleaned up some transitional code


## 2.0.0-alpha.5 (2022-10-15)
* Fixed url for getPersonalizationData so that it works for all countries, this will help users to test
* Adapted refreshMasterChannelList to work with new end point, needs fine tuning still
* Adapted refreshChannelList to work with the new data structure, not yet complete, needs fine tuning still


## 2.0.0-alpha.4 (2022-10-15)
* Fixed ReferenceError in getPersonalizationData: requestType is not defined at /usr/local/lib/node_modules/homebridge-eosstb/index.js:2659:63

## 2.0.0-alpha.3 (2022-10-15)
* Got MQTT control working again.
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

