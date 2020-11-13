# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your UPC TV Box and connected HDMI-CEC controllable devices with the Apple Home app and the Control Centre Apple TV Remote.

The UPC TV Box will display as a TV Accessory with Power, Input & Remote Control capabilities.

Works with the UPC Switzerland UPC TV Box (Mediabox) made by ARRIS Global Limited, model DCX960. Also known as the EOSSTB.
Will also work with other UPC countries, see config.

Tested on the author's ARRIS mediabox model DCX960/KK0L/A816/0000

You need a My UPC subscription.
The username and password are the same as used in the "upc tv Switzerland" app on your iOS device.

## Disclaimer
This plugin is neither provided nor endorsed nor supported nor developed by UPC. 
UPC can change their systems at any time and that might break this plugin.


## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1 and 14.2, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.1.116 (or later). Devloped on Homebridge 1.1.116, earlier versions not tested.
* A UPC TV subscription (included for most people who have internet with UPC)
* A My UPC account (part of your UPC Internet and TV package)
* The ARRIS mediabox DCX960 (provided by UPC as part of your UPC TV subscription, marketed as "UPC TV Box")

## Installation
Install homebridge-eosstb:
```sh
npm install -g homebridge-eosstb
```

## Usage Notes
Quickly switch input using the information (i) button in the Control Centre remote

## Remote Control Supported Keys
The following keys are supported by in the Apple TV Remote in the Control Center

Navigation (Up/Down/Left/Right)	
OK
Play/Pause
Back
Info (i)

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu, chich is the default


## Limitaitons
Due to HomeKit app limitation, the maximum services for 1 accessory is 100. Over this value HomeKit app will no longer respond. 
As services in this accessory are, (1. Information service, 2. Television service, 3. Speaker service, and 4. Input service. The inputs can consume services 5-100 (every input = 1 service)). If all services are enabled possible inputs to use is thus 96.
Hoever, the more services you have, the slower the plugin might be. So I have limited the inputs to maximum 50.

## Configuration
Add a new platform to your homebridge `config.json`.

Specific "favourite" inputs can be added manually or all available inputs reported by the AVR will be set.

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
Explanations:
platform    the name of your platform, normally eosstb
name        The displayed name of your device. Default is UPC TV, you can set it to whatever you want
username    Your login username for your My UPC account. Normally an email address.
password    Your password associated with your My UPC account
PlayPauseKey    The command issued to the UPC Box when the Play/Pause button in the iOS remote is tapped. Normally MediaPause
BackKey     The command issued to the UPC Box when the Back button in the iOS remote is tapped. Normally Escape
InfoKey     The command issued to the UPC Box when the Info button (i) in the iOS remote is tapped. As the iOS Remote has no Menu button, the Info button should be used to access the enu. This is what the Info button is set to MediaTopMenu

Known UPC Box Commands
Escape  The "Return" button on the remoze


## Thanks to
[homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)
https://openbase.io/js/homebridge-denon-tv/documentation

[NextRemoteJs](https://github.com/basst85/NextRemoteJs/)
