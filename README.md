<p align="center">
    <img src="https://github.com/jsiegenthaler/eosstb/blob/master/pics/DCX960andRemoteSmall.jpg" alt="UPC TV Box (ARRIS DCX960)" height="300">
  </a>
</p>


# WORK IN PROGRESS - HELP WANTED - ESPECIALLY GREAT BRITAIN
This is very much a work in progres.. Why? Because I'm not finished. If you can, give me a hand... especially if you have some javascript experience and use Virgin in Great Britain...


# TO-DO as of 16.02.2020
* Test gb connections for Virgin Media
* Test with profiles - try and find a way to get the EOS box profile channels so that the channel list can be reduced to your profile channel list



# Recent Major Achievements
13 Feb 2021: Got the Telenet session working finally. This plugin now works properly with the Telenet TV-Boxes in Belgium.

16 Feb 2021: Got the plugin working as an External Accessory with the right Set-Top Box icon. Got the NPM package configured. You can now search for the plugin and install it in Homebridge.

# homebridge-eosstb

`homebridge-eosstb` is a Homebridge plugin allowing you to control your EOS settop box (typically a ARRIS DCX960 running on the UPC/Ziggo/Telenet/Magenta/Virgin Media
TV system), as well as connected HDMI-CEC controllable devices with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your EOS settop box as a TV Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

You need a subscription to the online TV service from your local TV provider.
The username and password are the same as used in the TV provider's TV app on your iOS device (the app varies by country, in Switzerland it is [upc tv Schweiz](https://apps.apple.com/ch/app/upc-tv-schweiz/id1292688012)).

Supports multiple settop boxes, allowing you to create a TV accessory for each box (should you have more than one).

[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

# Works in Your Country (If you are with UPC / Ziggo / Telenet / Magenta and hopefully Virgin Media)
As UPC operates in multiple countries under multiple brands, this plugin will work in a number of countries that use UPC TV systems. The known countries that use the same UPC TV system with the ARRIS DCX960 settop box are:
* Switzerland: [UPC Switzerland](https://www.upc.ch/en/). The DCX960 is called the **UPC TV Box**. Also known as the EOSSTB.   **WORKING**
* Netherlands: [Ziggo](https://www.ziggo.nl/). Here the DCX960 is called the **Mediabox Next (4K)**.   **WORKING**
* Belgium: [Telenet](https://www2.telenet.be/en/). The Belgiums call the DCX960 a **Telenet TV-Box**.   **WORKING**
* Austria: [Magenta](https://www.magenta.at/). The DCX960 is called the **Entertain Box 4K**.   **TESTERS NEEDED**
* United Kingdom and Ireland: [Virgin Media](https://www.virginmedia.com/). The DCX960 appears to be called the **Virgin TV 360 mini box**.   **TESTERS WANTED**

So if you subscribe to a TV service from one of these countries, you are lucky, this plugin will work for you.

May also work with other UPC countries, if you know of any, let me know.

## Made in Switzerland
This plugin was written and tested on the author's EOS settop box (ARRIS mediabox model DCX960/KK0L/A816/0000) in Switzerland.

## Why I chose the name EOSSTB
I tried to find a good common name that works for this plugin for all countries. Each country uses a different marketing name for the box, so I could not use the local name. The eos system runs on an ARRIS DCX960, but it looks like Virgin Media have a different settop box, so I decided not to use the model name. So I stuck with the box identifier that appears in the mqtt messages: EOSSTB.

## Disclaimer (The Legal Stuff)
This plugin is not provided by UPC or Ziggo or Telenet or Magenta or Vigin Media any other affiliate of UPC. It is neither endorsed nor supported nor developed by UPC or any affiliates. 
UPC can change their systems at any time and that might break this plugin. But I hope not.

## Requirements
* An Apple iPhone or iPad with iOS 14.0 (or later). Developed on iOS 14.1...14.4, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.2.5 (or later). Developed on Homebridge 1.1.116....1.2.5, earlier versions not tested.
* A [TV subscription](https://www.upc.ch/en/bundles/buy-tv-internet/) (or the equivalent in your country)
* A [My UPC account](https://www.upc.ch/en/account/login/credentials/) (or the equivalent in your country, part of your TV package)
* The ARRIS mediabox DCX960 (provided by your TV provider as part of your TV subscription, called by the system an "EOSSTB" and marketed under different names in different UPC countries)

## Installation
Homebridge UI: the easiest way to install is seach for "eosstb" in the Homebridge UI, and then click INSTALL.

Manual install:
```sh
sudo npm install -g homebridge-eosstb
```
After installing, make sure you restart Homebridge.

## Adding EOSSTB to the Home app
The EOSSTB is exposed as a separate external accessory and each device needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap the **Home** tab, then tap **+** in the top right corner.
3. Tap **Add Accessory**, and select **I Don't Have a Code or Cannot Scan**.
4. Select the accessory you want to pair. You should see your EOSSTB here. If not, check your Homebridge config.
5. Accept the **Uncertified Accesory** warning by tapping **Add Anyway**
5. Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge.
6. Select a room for your EOSSTB accessory and tap **Continue**.
7. Give your EOSSTB a different name if you wish (you can change this in the Home app later) and tap **Continue**.
8. Name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
9. Switch on any offered automations if you wish (you can change these in the Home app later) and tap **Continue**.
10. Tap **Done** to finish the setup.

Your new accessory will appear shortly in the room that you selected.

## Remote Control Supported Keys
To access the Apple TV Remote, open your Control Center by swiping down from the top (newer iPhones) or up from the bottom of the screen (older iPhones). If you do now see the Remote Control icon, you will need to activate it in Settings > Control Centre and ensutre that the Apple TV Remote is in the list of INCLUDED CONTROLS.

The following keys are supported by in the Apple TV Remote in the Control Center:

* Navigation (Up/Down/Left/Right)	
* OK
* Play/Pause
* Back
* Info (i)
* Volume Up
* Volume Down

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu, which is the default.

The volume controls do not control the EOS box directly, as the EOS box has no volume capability. The EOS box remote actually sends IR commands to your TV. If you can control your TV volume via a network connection then the volume controls can be used to send volume commands to your TV via the raspberry pi. This is what the author uses.


## Limitations
Due to HomeKit limitations, the maximum services for a single accessory is 100. Over this value the Home app will no longer respond. 
Services used in this EOS box accessory are: 
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilise one service per input. The maximum possible channels (inputs) are thus 97.
However, the more services you have, the slower the plugin might be. So I have limited the inputs to maximum 50, but you can override this in the config.

## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum configuration:

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
                    "password": "yourPassword"
                    "playPauseButton": "MediaPlayPause",
                    "backButton": "Escape",
                    "infoButton": "MediaTopMenu",
                    "volUpCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLUP",
                    "volDownCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLDOWN",
                    "muteCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_MUTE"
                    "maxChannels": 50,
                    "manufacturer": "ARRIS",
                    "modelName": "DCX960",
                    "serialNumber": "123456",
                    "firmwareRevision": "v1.0.0"
                }
            ]
        }
    ]
```

### Configuration Items:
* **platform**: the name of your platform. Mandatory, must be eosstb.

* **name**: The displayed name of your device. Default is the name of your box from your country, you can set it to whatever you want. Mandatory.

+ **country**: Your country. Must be one of ch, nl, be-nl, be-fr, at or gb. This controls the country-specific logon sequence and the mqtt sessions. Mandatory.

* **username**: Your login username for your TV provider's online account (My UPC in Switzerland). Normally an email address. Mandatory.

* **password**: Your password associated with your TV provider's account. Mandatory.

* **settopboxId**: Your settopbox id. Only needed if you have more than one EOS box, so that the plugin can control the correct box. The id is shown in the HomeBridge log and is in the format 3C36E4-EOSSTB-00xxxxxxxxxx (xxxxxxxxxx is actually your CA code). Optional, defaults to the first detected settop box id in the mqtt traffic if not found.

* **accessoryCategory**: The accessory category. This changes the image on the tile in Homekit. Allows you to use a TV or a Audio Receiver or a Set-Top Box (default). Available values are:  TV = any of "television", "tv", "TV", "TELEVISION".  Audio Receiver = any of "receiver", "audio-receiver", "AUDIO_RECEIVER".  Optional, defaults to TV Set-Top Box if the value is not recognised.

* **playPauseButton**: The command issued to the EOS box when the Play/Pause button (**>||**) in the iOS remote is tapped. Normally MediaPause. Optional, defaults to MediaPause if not found.

* **backButton**: The command issued to the EOS box when the **BACK** button in the iOS remote is tapped. Normally Escape. Optional, defaults to Escape if not found.

* **infoButton**: The command issued to the EOS box when the Info button (**i**) in the iOS remote is tapped. As the iOS remote has no Menu button, the Info button should be used to access the menu. This is why the Info button is set to MediaTopMenu. Optional, defaults to MediaTopMenu if not found.

* **maxChannels**: The maximum number of channels to load. Optional, defaults to 50 if not found. Loading times increase with higher maximums. Limited to 90.

* **volUpCommand**: The bash command to increase the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Up button on your device. Optional.

* **volDownCommand**: The bash command to decrease the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Down button on your device. Optional.

* **muteCommand**: The bash command to mute the volume of the TV. Currently not supported in the Apple iOS remote (last checked in iOS v14.4) but is supported in Homebridge and in other home controller apps like Eve. Optional.

* **debugLevel**: Controls the amount of debug data shown in the Homebridge logs. Support values are: 0=Minimum logging, 1=Enhanced, 2=Verbose. Optional. Defaults to 0 if not found. Warning: a lot of data is logged at higher than level 0.

* **manufacturer**: You can add a manufacturer name if you wish. Defaults to "ARRIS". Optional.

* **modelName**: You can add a model name if you wish. Defaults to the stb type. Optional.

* **serialNumber**: You can add a serial number if you wish. Defaults to the physical device id. Optional.

* **firmwareRevision**: You can add a firmware revicsion if you wish. Defaults to "unknown". Optional.


## Known Relevant EOS Box Commands
* **MediaTopMenu**: Displays the top menu page (home page) on the TV, same as the **HOME** button on the EOS box remote

* **Escape**: Escapes (exits) out of any current menu on the TV. Same as the **RETURN** button on the EOS box remote

* **ContextMenu**: Displays a context menu on the current TV program. Same as the **...** button on the EOS box remote

* **Info**: Displays the INFO screen on the TV showing info about the current TV program

* **Help**: Displays the SETTINGS INFO page on the TV, allowing you to access settings quickly

* **Guide**: Displays the TV GUIDE page on the TV, same as the Guide button on the EOS box remote

* **MediaPause**: Toggles between Pause and Play of the current TV program



## Known Other Commands
* **VolumeUp** and **VolumeDown**: When the iOS remote is displayed, the iOS volume controls can be used to control the volume of your TV. However, this is not done via the EOS box, but instead via a bash command using a command line interface (CLI) to your TV. Your TV must be capable of being controlled remotely via any machine that can accept a bash command, such as a raspberry pi. The author has a Samsung Receiver and runs Homebridge on a raspberry pi, and thus uses [samsungctl](https://github.com/Ape/samsungctl/) which allows KEY_VOLUP and KEY_VOLDOWN to be easily sent to the Samsung Receiver. If you already have volume buttons in Homebridge for your TV, you can control Homebridge via the command line. See [the examples in issue 506 in the Homebridge issues log](https://github.com/homebridge/homebridge/issues/506) and scoll to the bottom to see some working command lines. Once you know what bash command works, configure it in volUpCommand and volDownCommand.


## Siri
I have found that Siri can turn the box on and off with the command "Hey Siri, turn on <yourEosBoxName>". However, I haven't been able to get Siri to change channels or change volume yet. If you find out how, let me know!


## Thanks to
* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* [NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

* [ziggonext-python by Rudolf Offereins](https://pypi.org/project/ziggonext/#description) Rudolf is the best!

* My helpers in Belgium: [Wesley Liekens](https://www.facebook.com/deliekes) and [Anthony Dekimpe](https://www.facebook.com/anthony.dekimpe) for helping me get the session code working for Telenet

* UPC for making such a useful TV platform and EOS box

