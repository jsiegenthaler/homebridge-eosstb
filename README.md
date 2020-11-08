# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your UPC Switzerland UPC TV Box & any connected HDMI-CEC controllable devices with the Apple Home app and the Control Centre Apple TV Remote.

The Swiss UPC TV BOX will display as a TV Accessory with Power, Input & Remote Control capabilities.

Works with the UPC Switzerland Mediabox made by ARRIS Global Limited, model DCX960.

Tested on the author's ARRIS mediabox model DCX960/KK0L/A816/0000

You need a My UPC subscription.
The username and password are the same as used in the "upc tv Switzerland" app on your iOS device.


## Requirements
* iOS 14.0 (or later). Developed on iOS 14.1 and 14.2, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.1.116 (or later). Devloped on Homebridge 1.1.116, earlier versions not tested.
* UPC Switzerland TV subscription
* ARRIS mediabox DCX960 (provided by UPC as part of your UPC TV subscription, marketed as "UPC TV Box")
* My UPC account (required to connect to your UPC TV Box)

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

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu-
Most useful is MediaTopMenu, chich is the default


## Limitaitons
Due to HomeKit app limitation, the maximum services for 1 accessory is 100. Over this value HomeKit app will no longer respond. 
As services in this accessory are, (1.information service, 2.speaker service, 3.lightbulb service, 4.television service and inputs service 5-100(where every input = 1 service)). If all services are enabled possible inputs to use is 96.

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

## Thanks to
[homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)
https://openbase.io/js/homebridge-denon-tv/documentation


[NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

[NextRemoteJs](https://github.com/basst85/NextRemoteJs/)
