<p align="center">
    <img src="https://github.com/jsiegenthaler/eosstb/blob/master/pics/DCX960andRemoteSmall.jpg" alt="UPC TV Box (ARRIS DCX960)" height="300">
  </a>
</p>


# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your EOS set-top box (typically a ARRIS DCX960 running on the UPC/Ziggo/Telenet/Magenta/Virgin Media
TV system), as well as connected HDMI-CEC controllable devices with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your EOS set-top box as a Set-Top Box Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

You need a subscription to the online TV service from your local TV provider.
The username and password are the same as used in the TV provider's TV app on your iOS device (the app varies by country, in Switzerland it is [upc tv Schweiz](https://apps.apple.com/ch/app/upc-tv-schweiz/id1292688012)).

Supports multiple set-top boxes, allowing you to create a TV accessory for each box (should you have more than one).

[![npm](https://img.shields.io/npm/v/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![npm](https://badgen.net/npm/dt/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

# Works in Your Country (If you are with UPC / Ziggo / Telenet / Magenta and hopefully Virgin Media)
As UPC operates in multiple countries under multiple brands, this plugin will work in a number of countries that use UPC TV systems. The known countries that use the same UPC TV system with the ARRIS DCX960 set-top box are:
* Switzerland: [UPC Switzerland](https://www.upc.ch/en/). The DCX960 is called the **UPC TV Box**. Also known as the EOSSTB.   **WORKING**
* Netherlands: [Ziggo](https://www.ziggo.nl/). Here the DCX960 is called the **Mediabox Next (4K)**.   **WORKING**
* Belgium: [Telenet](https://www2.telenet.be/en/). The Belgiums call the DCX960 a **Telenet TV-Box**.   **WORKING**
* Austria: [Magenta](https://www.magenta.at/). The DCX960 is called the **Entertain Box 4K**.   **TESTERS NEEDED**
* United Kingdom and Ireland: [Virgin Media](https://www.virginmedia.com/). The DCX960 appears to be called the **Virgin TV 360** box, introduced to in August 2020.   **TESTERS WANTED** Note: my plugin does not work with the older Virgin Media TiVo boxes.

So if you subscribe to a TV service from one of these countries, you are lucky, this plugin will work for you.

May also work with other UPC countries, if you know of any, let me know.

# TO-DO as of 25.02.2020
* Test GB connections for Virgin Media
* Improve robustness and responsiveness even more


# Recent Major Achievements
25 Feb 2021: Released v0.1.10 with full profile support and mqtt EOSSTB device status support.

20 Feb 2021: Resolved issues with homebridge v1.3.0 and improved robustness a lot

16 Feb 2021: Got the plugin working as an External Accessory with the right Set-Top Box icon. Got the NPM package configured. You can now search for the plugin and install it in Homebridge.

13 Feb 2021: Got the Telenet session working finally. This plugin now works properly with the Telenet TV-Boxes in Belgium.



## Made in Switzerland
This plugin was written and tested on the author's EOS set-top box (ARRIS mediabox model DCX960/KK0L/A816/0000) in Switzerland.

## Why I chose the name EOSSTB
I tried to find a good common name that works for this plugin for all countries. Each country uses a different marketing name for the box, so I could not use the local name. The EOS system, also known as the Horizon platform, runs on an ARRIS DCX960, but even this box comes in different types and with different firmware, so I decided not to use the model name. So I stuck with the box identifier that appears in the mqtt messages: EOSSTB.

## Disclaimer (The Legal Stuff)
This plugin is not provided by UPC or Ziggo or Telenet or Magenta or Vigin Media any other affiliate of UPC. It is neither endorsed nor supported nor developed by UPC or any affiliates. 
UPC can change their systems at any time and that might break this plugin. But I hope not.

## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...14.4, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.2.5 (or later). Developed on Homebridge 1.1.116....1.3.1, earlier versions not tested.
* A [TV subscription](https://www.upc.ch/en/bundles/buy-tv-internet/) (or the equivalent in your country)
* A [My UPC account](https://www.upc.ch/en/account/login/credentials/) (or the equivalent in your country, part of your TV package)
* The ARRIS mediabox DCX960 (provided by your TV provider as part of your TV subscription, called by the system an "EOSSTB" and marketed under different names in different UPC countries)

## Installation
Homebridge UI: the easiest way to install is seach for "eosstb" in the Homebridge UI, and then click **INSTALL**.

Manual install:
```sh
sudo npm install -g homebridge-eosstb
```
After installing, make sure you restart Homebridge.

## Adding EOSSTB to the Home app
The EOSSTB is exposed as a separate external accessory and each device needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap **+** in the top right corner of the screen to start the process of adding a new accessory or scene.
3. Tap **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **I Don't Have a Code or Cannot Scan**.
5. **Select an Accessory to Add to (Home Name)**: Select the accessory you want to add. You should see your EOSSTB here. If not, check your Homebridge config.
6. Accept the **Uncertified Accesory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge.
8. **Set-Top Box Location**: Select a room for your EOSSTB accessory and tap **Continue**.
9. **Set-Top Box Name**: Give your EOSSTB a different name if you wish (you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **Set-Top Box Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **Set-Top Box Added to (Home Name)**: Tap **Done** to finish the setup.

Your new accessory will appear shortly in the room that you selected. It may show **Updating...** for a while. You can force a Home app refresh by displaying a different room and then going back again to the previous room.

## Remote Control Supported Keys
To access the **Apple TV Remote**, open your **Control Center** by swiping down from the top (newer iPhones) or up from the bottom of the screen (older iPhones). If you do not see the remote control icon, you will need to activate it in **Settings > Control Centre** and ensure that the **Apple TV Remote** is in the list of **INCLUDED CONTROLS**.

The following keys are supported by in the **Apple TV Remote** in the Control Center:

* Navigation (Up/Down/Left/Right)	
* OK
* Play/Pause
* Back
* Info (i)
* Volume Up
* Volume Down

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu, which is the default.

The volume controls do not control the EOS set-top box directly, as the EOS box has no volume capability. The EOS physical remote actually sends IR commands to your TV. If you can control your TV volume via a network connection then the volume controls can be used to send volume commands to your TV via the raspberry pi. This is what the author uses.


## Limitations
Due to HomeKit limitations, the maximum services for a single accessory is 100. Over this value the Home app will no longer respond. 
Services used in this EOS box accessory are:
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilise one service per input. The maximum possible channels (inputs) are thus 100 - 3 = 97.
However, the more services you have, the slower the plugin loads. So I have limited the inputs to maximum 50, but you can override this in the config.


## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum (mandatory) configuration:

```js
    "platforms": [
        {
            "platform": "eosstb",
            "devices": [
                {
                    "name": "EOSSTB",
                    "country": "ch",
                    "username": "yourEmail@email.com",
                    "password": "yourPassword"
                }
            ]
        }
    ]
```

Example extended configuration as used on the author's Samsung TV (where x.x.x.x is the IP address of the TV):

```js
    "platforms": [
        {
            "platform": "eosstb",
            "devices": [
                {
                    "name": "EOSSTB",
                    "country": "ch",
                    "username": "yourEmail@email.com",
                    "password": "yourPassword",
                    "profile": "Dad",
                    "maxChannels": 50,
                    "playPauseButton": "MediaPlayPause",
                    "backButton": "Escape",
                    "infoButton": "MediaTopMenu",
                    "volUpCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLUP",
                    "volDownCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLDOWN",
                    "muteCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_MUTE",
                    "manufacturer": "ARRIS",
                    "modelName": "DCX960",
                    "serialNumber": "123456",
                    "firmwareRevision": "v1.0.0",
                    "debugLevel": 0
                }
            ]
        }
    ]
```

### Configuration Items:

#### Mandatory

* **platform**: the name of your platform. Mandatory, must be eosstb.

* **name**: The displayed name of your device. Default is the name of your box from your country, you can set it to whatever you want. Mandatory.

+ **country**: Your country. Must be one of ch, nl, be-nl, be-fr, at or gb. This controls the country-specific logon sequence and the mqtt sessions. Mandatory.

* **username**: Your login username for your TV provider's online account (My UPC in Switzerland). Normally an email address. Mandatory.

* **password**: Your password associated with your TV provider's account. Mandatory.

#### Optional

* **profile**: The profile name to use to load the channel list. Optional, defaults to Shared if not found. The iOS device can only handle maximum 90 (a bit more but I hard limited it to 90). Most cable providers offer many more than 90 channels: my provider has 483. To ensure you have a meaningful list on your iOS device, setup a profile on your set-top box, and enter the profile name in the config. The channels from the profile will be loaded in order. If your profile is changed to the set/top box, the changes will be pushed to HomeKit.

* **maxChannels**: The maximum number of channels to load. Optional, defaults to 50 if not found, and is hard limited to 90. The more channels configured, the longer the startup time after a Homebridge reboot. Note: re-pairing the accessory in the Home app might be needed after changing maxChannels.

* **showChannelNumbers**: Shows or hides the channel numbers in the channel selector in HomeKit. Values: true or false (default). If channel numbers are displayed, there is less room for the channel name. Optional, defaults to false (channel numbers are not displayed).

* **settopboxId**: DEPRECATED (NOT IN USE ANY MORE) Your set-topbox id. Only needed if you have more than one EOS box, so that the plugin can control the correct box. The id is shown in the HomeBridge log and is in the format 3C36E4-EOSSTB-00xxxxxxxxxx (xxxxxxxxxx is actually your CA code). Optional, defaults to the first detected set-top box id in the mqtt traffic if not found.

* **accessoryCategory**: The accessory category. This changes the image on the tile in Homekit. Allows you to use a TV or a Audio Receiver or a Set-Top Box (default). Available values are:  TV = any of "television", "tv", "TV", "TELEVISION".  Audio Receiver = any of "receiver", "audio-receiver", "AUDIO_RECEIVER".  Optional, defaults to TV Set-Top Box if the value is not recognised.

* **playPauseButton**: The command issued to the EOS box when the Play/Pause button (**>||**) in the iOS remote is tapped. Normally MediaPause. Optional, defaults to MediaPause if not found.

* **backButton**: The command issued to the EOS box when the **BACK** button in the iOS remote is tapped. Normally Escape. Optional, defaults to Escape if not found.

* **infoButton**: The command issued to the EOS box when the Info button (**i**) in the iOS remote is tapped. As the iOS remote has no Menu button, the Info button should be used to access the menu. This is why the Info button is set to MediaTopMenu. Optional, defaults to MediaTopMenu if not found.

* **volUpCommand**: The bash command to increase the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Up button on your device. Optional.

* **volDownCommand**: The bash command to decrease the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Down button on your device. Optional.

* **muteCommand**: The bash command to mute the TV. Whilst not supported natively in the Apple iOS remote, I have integrated it with a triple-press on the Volume Down button. Mute is also supported in Homebridge. Optional.

* **manufacturer**: You can add a manufacturer name if you wish. Defaults to the plugin name. Optional.

* **modelName**: You can add a model name if you wish. Defaults to the set-top box type. Optional.

* **serialNumber**: You can add a serial number if you wish. Defaults to the physical device id. Optional.

* **firmwareRevision**: You can add a firmware revision if you wish. Must be numeric, non-numeric values are not displayed. Defaults to the plugin version. Optional.

* **debugLevel**: Controls the amount of debug data shown in the Homebridge logs, independent of the debug setting in Homebridge. Supported values are: 0=No debug logging, 1=Minimum, 2=Enhanced, 3=Verbose. Optional. Defaults to 0 if not found. Warning: a lot of log entries can occur at the higher debug levels.



## Known Relevant EOS Box Commands
* **MediaTopMenu**: Displays the top menu page (home page) on the TV, same as the **HOME** button on the EOS box remote

* **Escape**: Escapes (exits) out of any current menu on the TV. Same as the **RETURN** button on the EOS box remote

* **ContextMenu**: Displays a context menu on the current TV program. Same as the **...** button on the EOS box remote

* **Info**: Displays the INFO screen on the TV showing info about the current TV program

* **Help**: Displays the SETTINGS INFO page on the TV, allowing you to access settings quickly

* **Guide**: Displays the TV GUIDE page on the TV, same as the Guide button on the EOS box remote

* **MediaPause**: Toggles between Pause and Play of the current TV program



## Known Other Commands
### Volume
* **VolumeUp** and **VolumeDown**: When the iOS remote is displayed, the iOS volume controls can be used to control the volume of your TV. However, this is not done via the EOS box, but instead via a bash command using a command line interface (CLI) to your TV. Your TV must be capable of being controlled remotely via any machine that can accept a bash command, such as a raspberry pi. The author has a Samsung Receiver and runs Homebridge on a raspberry pi, and thus uses [samsungctl](https://github.com/Ape/samsungctl/) which allows KEY_VOLUP and KEY_VOLDOWN to be easily sent to the Samsung Receiver. If you already have volume buttons in Homebridge for your TV, you can control Homebridge via the command line. See [the examples in issue 506 in the Homebridge issues log](https://github.com/homebridge/homebridge/issues/506) and scoll to the bottom to see some working command lines. Once you know what bash command works, configure it in volUpCommand and volDownCommand.

### Mute
* **Mute** is not supported natively by the iOS remote, but I have added it with a triple-press detection on the volume down button. Press the button three times within 1 second, and the Mute command will be sent using the command stored in the **muteCommand** config item.

## Siri
I have found that Siri can turn the box on and off with the command "Hey Siri, turn on <yourEosBoxName>". However, I haven't been able to get Siri to change channels or change volume yet. If you find out how, let me know!


## Thanks to
* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* [NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

* [ziggonext-python by Rudolf Offereins](https://pypi.org/project/ziggonext/#description) Rudolf is the best!

* My helpers in Belgium: [Wesley Liekens](https://www.facebook.com/deliekes) and [Anthony Dekimpe](https://www.facebook.com/anthony.dekimpe) for helping me get the session code working for Telenet

* UPC for making such a useful TV platform and EOS box

