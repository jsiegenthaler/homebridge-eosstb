<p align="center">
    <img src="https://github.com/jsiegenthaler/eosstb/blob/master/pics/DCX960andRemoteSmall.jpg" alt="UPC TV Box (ARRIS DCX960)" height="300">
  </a>
</p>

# WORK IN PROGRESS
This is a private repo because I'm not finished, If you've been invited, then its because I selected you. You're here to help.
During the time that this is a prievate repo, installation must be done using:
```sh
npm install -g https://github.com/jsiegenthaler/eosstb/
```

# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your UPC TV Box (Mediabox Next (4K) / TV-Box / Entertain Box 4K) and connected HDMI-CEC controllable devices with the Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your UPC TV Box as a TV Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad).

You need a My UPC subscription or the appropriate equivalent from your UPC provider.
The username and password are the same as used in the UPC TV app on your iOS device (the app varies by country, this is the Swiss app: [upc tv Schweiz](https://apps.apple.com/ch/app/upc-tv-schweiz/id1292688012)).

# Works in Your Country (If you are lucky)
As UPC operates in multiple countries under multiple brands, this plugin will work in a number of countries that use UPC TV systems. The known countries that use the same ARRIS DCX960 settop box are:
* Switzerland: [UPC Switzerland](https://www.upc.ch/en/). The DCX960 is called the **UPC TV Box**. Also known as the EOSSTB.
* Netherlands: [Ziggo](https://www.ziggo.nl/). Here the DCX960 is called the **Mediabox Next (4K)**.
* Belgium: [Telenet](https://www2.telenet.be/en/). The Belgiums kept it simple. The DCX960 is called a **TV-Box**.
* Austria: [Magenta](https://www.magenta.at/). The DCX960 is called the **Entertain Box 4K**.

So if you use UPC TV from one of these countries, you are lucky, this plugic will work for you.

May also work with other UPC countries, if you know of any, let me know.

## Made in Switzerland
This plugin was written and tested on the author's UPC TV Box (ARRIS mediabox model DCX960/KK0L/A816/0000) in Switzerland.


## Disclaimer (The Legal Stuff)
This plugin is not provided by UPC or Ziggo or Telenet or Magenta any other affiliate of UPC. It is neither endorsed nor supported nor developed by UPC or any affiliates. 
UPC can change their systems at any time and that might break this plugin. But I hope not.

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
Most useful is MediaTopMenu, which is the default.

The volume controls do not control the UPC TV Box, as the UPC TV Box has no volume capability. The UPC remote actually sends IR commands to your TV. If you can control your TV volume via a network connection then the volume controls can be used to send volume commands to your TV via the raspberry pi. This is what the author uses.


## Limitations
Due to HomeKit app limitations, the maximum services for a single accessory is 100. Over this value the HomeKit app will no longer respond. 
Services used in this UPC TV Box accessory are: 
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilise one service per input. The maximum possible channels (inputs) are thus 97.
However, the more services you have, the slower the plugin might be. So I have limited the inputs to maximum 50.

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

### Configuration Items:
* **platform**: the name of your platform. Mandatory, must be eosstb.

* **name**: The displayed name of your device. Default is UPC TV, you can set it to whatever you want. Mandatory.

+ **country**: Your UPC country. Must be one of ch, nl, be-nl, be-fr, or at. Optional, default is ch (because that is where I live)

* **username**: Your login username for your My UPC account. Normally an email address. Mandatory.

* **password**: Your password associated with your My UPC account. Mandatory.

* **playPauseButton**: The command issued to the UPC Box when the Play/Pause button (**>||**) in the iOS remote is tapped. Normally MediaPause. Optional, defaults to MediaPause if not found.

* **backButton**: The command issued to the UPC Box when the **BACK** button in the iOS remote is tapped. Normally Escape. Optional, defaults to Escape if not found.

* **infoButton**: The command issued to the UPC Box when the Info button (**i**) in the iOS remote is tapped. As the iOS remote has no Menu button, the Info button should be used to access the menu. This is what the Info button is set to MediaTopMenu. Optional, defaults to MediaTopMenu if not found.

* **maxChannels**: The maximum number of channels to load. Optional, defaults to 50 if not found.


## Known Relevant UPC TV Box Commands
* **MediaTopMenu**: Displays the top menu page (home page) on the TV, same as the HOME button on the UPC remote

* **Escape**: Escapes (exits) out of any current menu on the TV. Same as the RETURN button on the UPC remote

* **ContextMenu**: Displays a context menu on the current TV program. Same as the ... button on the UPC remote

* **Info**: Displays the INFO screen on the UPC TV showing info about the current TV program

* **Help**: Displays the SETTINGS INFO page on the UPC TV, allowing you to access settings quickly

* **Guide**: Displays the TV GUIDE page on the UPC TV, same as the Guide button on the UPC remote

* **MediaPause**: Toggles between Pause and Play of the current TV program

* **MediaPause**: Pauses and Plays (when pressed again) the current TV program


## Known Other Commands
* **VolumeUp** and **VolumeDown**: When the iOS remote is displayed, the iOS volume controls can be used to control the volume of your TV. However, this is not done via the UPC TV Box, but instead via a bash command on homebridge. So your TV must be capable of being controlled remotely via your raspberry pi. The author's TV uses [samsungctl](https://github.com/Ape/samsungctl/), and that allows KEY_VOLUP and KEY_VOLDOWN to be easily sent to the Samsung Receiver.


## Siri
I have found that Siri can turn the box on and off with the command "Hey Siri, turn on <yourUPCTVboxname>". However, I haven't been able to get Siri to change channels or change volume yet.


## Thanks to
[homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

https://openbase.io/js/homebridge-denon-tv/documentation

[NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

[ziggonext-python by Rudolf Offereins](https://pypi.org/project/ziggonext/#description)

UPC for making such a useful TV platform
