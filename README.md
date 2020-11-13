# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your UPC TV Box / Mediabox Next (4K) and connected HDMI-CEC controllable devices with the Apple Home app and the Control Centre Apple TV Remote (which I'll just call iOS remote from now on).

The UPC TV Box will display as a TV Accessory with Power, Input & Remote Control capabilities.

As UPC operates in multiple countries under multiple brands, this plugin will work in a number of countries. The known countries are:
* Switzerland: Works with the UPC Switzerland UPC TV Box (Mediabox) made by ARRIS Global Limited, model DCX960. Also known as the EOSSTB.
* Netherlands: Works with the Ziggo Mediabox Next (4K) made by ARRIS Global Limited, model DCX960.
May also work with other UPC countries, see config.

Tested on the author's UPC TV Box (ARRIS mediabox model DCX960/KK0L/A816/0000) in Switzerland.

You need a My UPC subscription or the appropriate equivalent from your UPC provider.
The username and password are the same as used in the "upc tv Switzerland" app on your iOS device (outside of Switzerland the app may have a different name).

## Disclaimer
This plugin is not provided by UPC or Ziggo or any other affiliate of UPC. It is neither endorsed nor supported nor developed by UPC or Ziggo. 
UPC/Ziggo can change their systems at any time and that might break this plugin.


## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1 and 14.2, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.1.116 (or later). Developed on Homebridge 1.1.116, earlier versions not tested.
* A [UPC TV subscription](https://www.upc.ch/en/bundles/buy-tv-internet/) (or the equivalent in your country, included for most people who have internet with UPC)
* A [My UPC account](https://www.upc.ch/en/account/login/credentials/) (or the equivalent in your country, part of your UPC Internet and TV package)
* The ARRIS mediabox DCX960 (provided by UPC/Ziggo as part of your UPC TV subscription, marketed as "UPC TV Box" by UPC in Switzerland and "Mediabox Next (4K)" by Ziggo in the Netherlands)

## Installation
Install homebridge-eosstb:
```sh
npm install -g homebridge-eosstb
```

## Remote Control Supported Keys
The following keys are supported by in the iOS Remote in the Control Center

* Navigation (Up/Down/Left/Right)	
* OK
* Play/Pause
* Back
* Info (i)
* Volume Up
* Volume Down

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu, which is the default

The volume controls do not control the UPC TV Box, but can be used to send commands to your TV via the raspberry pi.


## Limitations
Due to HomeKit app limitation, the maximum services for 1 accessory is 100. Over this value HomeKit app will no longer respond. 
Services in this accessory are: 1. Information service, 2. Television service, 3. Speaker service, and 4. Input service. The inputs can consume services 5-100 (every input = 1 service)). If all services are enabled possible inputs to use is thus 96.
Hoever, the more services you have, the slower the plugin might be. So I have limited the inputs to maximum 50.

## Configuration
Add a new platform to your homebridge `config.json`.

Example configuration:

```js
{
    "platforms": [
      {
        "platform": "eosstb",
        "name": "UPC TV Box",
        "username": "yourMyUpcEmail@email.com",
        "password": "yourMyUpcPassword"
      }
    ]
  }
```

### Explanations:
* **platform**: the name of your platform, normally eosstb
* **name**: The displayed name of your device. Default is UPC TV, you can set it to whatever you want
* **username**: Your login username for your My UPC account. Normally an email address.
* **password**: Your password associated with your My UPC account
* **playPauseButton**: The command issued to the UPC Box when the Play/Pause button in the iOS remote is tapped. Normally MediaPause
* **backButton**: The command issued to the UPC Box when the Back button in the iOS remote is tapped. Normally Escape
* **infoButton**: The command issued to the UPC Box when the Info button (i) in the iOS remote is tapped. As the iOS Remote has no Menu button, the Info button should be used to access the menu. This is what the Info button is set to MediaTopMenu
* **maxChannels**: The maximum number of channels to show. Default = 50. Limit = 96.

## Known UPC TV Box Commands
* **MediaTopMenu**: Displays the top menu page (home page) on the TV, same as the HOME button on the UPC remote

* **Escape**: Escapes (exits) out of any current screen on the TV. Same as the RETURN button on the remote

* **ContextMenu**: Dsisplays a context menu on the current TV program. Sales as the ... button on the UPC remote

* **Info**: Displays the INFO screen on the UPC TV showing info about the current TV program

* **Help**: Displays the SETTINGS INFO page on the UPC TV, allowing you to access settings quickly

* **Guide**: Displays the TV GUIDE page on the UPC TV, same as the Guide button on the remote

* **MediaPause**: Pauses and Plays (when pressed again) the current TV program

* **MediaPause**: Pauses and Plays (when pressed again) the current TV program

## Known Other Commands
* **VolumeUp** and **VolumeDown**: When the iOS remote is displayed, the iOS volume controls can be used to control the volume of your TV. However, this is not done via the UPC TV Box, but instead via a bash command on homebridge. So your TV must be cpaable of being controlled remotely via your raspberry pi. The author's TV uses [samsungctl](https://github.com/Ape/samsungctl/), and that allows KEY_VOLUP and KEY_VOLDOWN to be easily sent.

## Siri
I have found that Siri can turn the box on and off with the command "Hey Siri, turn on <youUPCTVboxname". However, I haven't been able to get Siri to change channels or change volume yet.


## Thanks to
[homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)
https://openbase.io/js/homebridge-denon-tv/documentation

[NextRemoteJs](https://github.com/basst85/NextRemoteJs/)
