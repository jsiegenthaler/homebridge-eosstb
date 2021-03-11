<p align="center">
    <img src="https://github.com/jsiegenthaler/eosstb/blob/master/pics/DCX960andRemoteSmall.jpg" alt="UPC TV Box (ARRIS DCX960)" height="300">
  </a>
</p>


# homebridge-eosstb
[![npm](https://img.shields.io/npm/v/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![npm](https://badgen.net/npm/dt/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

`homebridge-eosstb` is a Homebridge plugin allowing you to control your EOS set-top box (typically a ARRIS DCX960 running on the UPC/Ziggo/Telenet/Magenta/Virgin Media
TV system), as well as connected HDMI-CEC controllable devices with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

This plugin displays your EOS set-top box as a Set-Top Box Accessory with Power, Input & Remote Control capabilities in your iOS device (iPhone, iPad, iMac, etc.).

You need a subscription to the online TV service from your local TV provider.
The username and password are the same as used in the TV provider's TV app on your iOS device (the app varies by country, in Switzerland it is [upc tv Schweiz](https://apps.apple.com/ch/app/upc-tv-schweiz/id1292688012)).

Supports multiple set-top boxes, allowing you to create a TV accessory for each box (should you have more than one).

If you like this plugin, consider making a donation or buying me a coffee!<br>
<a target="blank" href="https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468"><img src="https://img.shields.io/badge/PayPal-Donate-blue.svg?logo=paypal"/></a>  <a target="blank" href="https://ko-fi.com/jsiegenthaler"><img src="https://img.shields.io/badge/Ko--Fi-Buy%20me%20a%20coffee-29abe0.svg?logo=ko-fi"/></a>




# Works in Your Country (If you are with UPC / Ziggo / Telenet / Magenta and hopefully Virgin Media)
As UPC operates in multiple countries under multiple brands, this plugin will work in a number of countries that use UPC TV systems. The known countries that use the same UPC TV system with the ARRIS DCX960 set-top box are:
* Switzerland: [UPC Switzerland](https://www.upc.ch/en/). The DCX960 is called the **UPC TV Box**. Also known as the EOSSTB.   **WORKING**
* Netherlands: [Ziggo](https://www.ziggo.nl/). Here the DCX960 is called the **Mediabox Next (4K)**.   **WORKING**
* Belgium: [Telenet](https://www2.telenet.be/en/). The Belgiums call the DCX960 a **Telenet TV-Box**.   **WORKING**
* Austria: [Magenta](https://www.magenta.at/). The DCX960 is called the **Entertain Box 4K**.   **TESTERS NEEDED**
* United Kingdom and Ireland: [Virgin Media](https://www.virginmedia.com/). The DCX960 appears to be called the **Virgin TV 360** box, introduced to in August 2020.   **TESTERS WANTED** Note: my plugin does not work with the older Virgin Media TiVo boxes.

So if you subscribe to a TV service from one of these countries, you are lucky, this plugin will work for you.

May also work with other UPC countries, if you know of any, let me know.

# TO-DO as of 09.03.2020
* Test GB connections for Virgin Media


# Recent Major Achievements
09 Feb 2021: Full multi-device support working properly

06 Feb 2021: Full multi-device support added

27 Feb 2021: Working on v0.1.14 with live channel change updates and many improvements

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

## Features
**Full Remote Control Support**: The Apple TV Remote in your iOS device can control your set-top box; including power, menu navigation, play, pause, volume and mute commands.

**Intelligent Mute**: Clicking Volume Down on your iOS device three times in rapid succession sends a Mute command to your TV. A subsequent press of Volume Up or Volume Down cancels the mute.

**Synchronised Set-Top Box Name**: Changing the name of the set-top box in the iOS device changes it on the TV and backend systems in real time, and vice-versa. No reboot required.

**Synchronised Current Channel Display**: Changing the channel on the set-top box changes the displayed channel name in the Home app in real time, and vice-versa.

**Synchronised Channel List Order**: Changing the channel list order of channels in a profile on your set-top box changes the channel list order on your iOS device in real time. No reboot required. Note that the Shared Profile channel list order cannot be changed.

**Ignores Not-Subscribed Channels**: Only the channels you subscribe to are shown in the iOS device, saving you valuable slots in the limited iOS channel list.

**Optional Channel Numbers**: If you wish, you can display a channel number before the channel name. As this consumes some space on the Home app tile, it is off by default.

**Master Channel List Refreshed Regularly**: The master channel list is refreshed at the correct intervals requested by the TV provider, minimising network traffic.

**Intelligent Profile Support**: If the master channel list is too large for your iOS device, then the plugin will chose the best fitting profile, should you have any user profiles stored on your set-top box. The best fitting user profile is the first user profile found that fits fully within the available channel list space. Of course, you can specify your own profile which overrides this intelligent selection.

**Fully Configurable**: A large amount of configuration items exist to allow you to configure your plugin the way you want.






## Installation
Homebridge UI: the easiest way to install is seach for **eosstb** in the Homebridge UI, and then click **INSTALL**.

Manual install:
```sh
sudo npm install -g homebridge-eosstb
```
After installing, make sure you restart Homebridge.

## Adding EOSSTB to the Home app
The EOSSTB is exposed as a separate external accessory and each set-top box needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap **+** in the top right corner of the screen to start the process of adding a new accessory or scene.
3. Tap **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **I Don't Have a Code or Cannot Scan**.
5. **Select an Accessory to Add to (Home Name)**: Select the accessory you want to add. You should see your set-top box here. If not, check your Homebridge config.
6. Accept the **Uncertified Accesory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge.
8. **Set-Top Box Location**: Select a room for your new accessory and tap **Continue**.
9. **Set-Top Box Name**: Give your set-top box a different name if you wish (synchronised to your real set-top box, you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Re-name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **Set-Top Box Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **Set-Top Box Added to (Home Name)**: Tap **Done** to finish the setup.

Your new accessory will appear shortly in the room that you selected. It may show **Updating...** for a while as it loads all the data. You can force a Home app refresh by switching to another room and then back again.

## Remote Control Supported Keys
To access the **Apple TV Remote**, open your **Control Center** by swiping down from the top (newer iPhones and iPads) or up from the bottom of the screen (older iPhones). If you do not see the remote control icon, you will need to activate it in **Settings > Control Centre** and ensure that the **Apple TV Remote** is in the list of **INCLUDED CONTROLS**.

The following keys are supported by in the **Apple TV Remote** in the Control Center:

* Navigation (Up/Down/Left/Right)	
* OK
* Play/Pause
* Back
* Info (i)
* Volume Up
* Volume Down (also used for Mute)

You can configure the (i) button to be Info, Help, Guide, ContextMenu or MediaTopMenu.
Most useful is MediaTopMenu (the normal menu command), which is the default.

The volume controls do not control the EOS set-top box directly, as the EOS box has no volume capability. The EOS physical remote actually sends IR commands to your TV. If you can control your TV volume via a network connection then the volume controls can be used to send volume commands to your TV via the raspberry pi. This is what the author uses.


## Limitations
### Channel Count
Due to HomeKit limitations, the maximum services for a single accessory is 100. Over this value the Home app will no longer respond. 
Services used in this set-top box accessory are:
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilise one service per input. The maximum possible channels (inputs) are thus 100 - 3 = 97.
However, the more services you have, the slower the plugin loads. So I have limited the inputs to maximum 50, but you can override this in the config. The inputs are hard limited to 90 inputs.

### Web App Controllers Take Over Sometimes
The Homekit plugin emulates the web app. If the web app is started on a web browser on a laptop or PC, the backend systems may prefer the web app to HomeKit, and disconnect Homekit from the mqtt session. The best thing to do is not use the web app. I'm considering ways to make the mqtt session more robust.

### Media State (Play/Pause) Limitations
The eosstb plugin can detect the current and target media state and shows PLAY, PAUSE or LOADING (loading is displayed when fast-forwarding or rewinding) in the Homebridge logs. Unfortunately, the Apple Home app cannot do anything with the media state (as at iOS 14.4). Hopefully this will improve in the future.


## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum (mandatory) configuration:

```js
    "platforms": [
        {
            "platform": "eosstb",
            "country": "ch",
            "username": "yourEmail@email.com",
            "password": "yourPassword"
        }
    ]
```

Example extended configuration as used on the author's Samsung TV (where x.x.x.x is the IP address of the TV). An extended configuration allows you to control the behaviour of each device. You must identify the devices by their id:

```js
    "platforms": [
        {
            "platform": "eosstb",
            "country": "ch",
            "username": "yourEmail@email.com",
            "password": "yourPassword",
            "debugLevel": 0,
            "devices": [
                {
                    "id": "EOSSTB",
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
                    "channelNames": [
                        {
                            "channelId": "SV09690",
                            "channelName": "Netflix"
                        }
                }
            ]
        }
    ]
```

### Platform Configuration Items
Unless otherwise stated, all configuration items are case sensitive.

#### Mandatory
Mandatory configuration items must always exist. These are used to establish the session to the EOS platform.

* **platform**: the name of the platform. Mandatory, must be eosstb.

+ **country**: Your country. Must be one of ch, nl, be-nl, be-fr, at or gb. Not case sensistive. This controls the country-specific logon sequence and the mqtt sessions. Mandatory.

* **username**: Your login username for your TV provider's online account (Switzerland: My UPC). Normally an email address. Mandatory.

* **password**: Your password associated with your TV provider's account. Mandatory.


#### Optional

* **debugLevel**: Controls the amount of debug data shown in the Homebridge logs, independent of the debug setting in Homebridge. Debug messages are shown in the Homebridge log in the warning colour, normally yellow. Supported values are: 0=No debug logging, 1=Minimum, 2=Enhanced, 3=Verbose. Optional. Defaults to 0 if not found. Warning: a lot of log entries can occur at the higher debug levels.


### Device Configuration Items
Most people will be happy with the default device configuration. If you do not need to change anything, you can omit the device configuration section.
If you want to configure your devices differently, do so here. Multiple devices are supported, each device can be configured separately. The devices are identified by their physical device id. you Yill see that there is no option to set the name, as the name of the set-top box displayed in the Home app is always synchronised to the physical set-top box.

#### Mandatory

* **deviceid**: The unique set-top box physical device id, in Switzerland and Belgium this is in the format 3C36E4-EOSSTB-001234567890. Other countries may be the same. Required to identify the set-top box in your network, as multiple boxes can exist. Review the Homebridge log to see your device id, it is displayed shortly after a Homebridge reboot. Mandatory for a device configuration.

#### Optional

* **profile**: The profile name to use to load the channel list for the device. Optional, defaults to the Shared Profile if not found. if using the Shared Profile,, the device loads the first 90 channels found. Most cable providers offer many more than 90 channels: my provider has 483, of which I am entitled to 287. To ensure you have a useful channel list on your iOS device, create a profile on your set-top box, and enter the profile name in the config. The channels will then be loaded from the profile. If your profile is changed to the set/top box, the changes will be pushed to HomeKit.

* **maxChannels**: The maximum number of channels to load. Optional, defaults to 50 if not found, and is hard limited to 90. The more channels configured, the longer the startup time after a Homebridge reboot. Note: re-pairing the accessory in the Home app might be needed after changing maxChannels.

* **showChannelNumbers**: Shows or hides the channel numbers in the channel selector in HomeKit. Values: true or false (default). If channel numbers are displayed, there is less room for the channel name. Optional, defaults to false (channel numbers are not displayed).

* **channelNames**: Allows you to add unknown channel names, or to rename any channel as you wish. Required as some channels (e.g. Netflix) are not published on the master channel list. If a channel displays in your iOS device like this: "Channel SV09690", then check your TV to see the channel name, and add it to the config. An example is provided for Netflix. Optional, unknown channels are displayed as "Channel xxxxxxx" where xxxxxxx is the channelId.

* **accessoryCategory**: The accessory category. This changes the image on the tile in Homekit. Allows you to use a TV or a Audio Receiver or a Set-Top Box (default). Available values are:  TV = any of "television", "tv".  Audio Receiver = any of "receiver", "audio-receiver", "avr".  Not case snsitive. Optional, defaults to TV Set-Top Box if the value is not recognised.

* **playPauseButton**: The command issued to the EOS box when the Play/Pause button (**>||**) in the iOS remote is tapped. Normally MediaPause. Optional, defaults to MediaPause if not found.

* **backButton**: The command issued to the EOS box when the **BACK** button in the iOS remote is tapped. Normally Escape. Optional, defaults to Escape if not found.

* **infoButton**: The command issued to the EOS box when the Info button (**i**) in the iOS remote is tapped. As the iOS remote has no Menu button, the Info button should be used to access the menu. This is why the Info button is set to MediaTopMenu. Optional, defaults to MediaTopMenu if not found.

* **volUpCommand**: The bash command to increase the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Up button on your device. Optional.

* **volDownCommand**: The bash command to decrease the volume of the TV. This command is sent when the iOS remote is open and you press the Volume Down button on your device. Optional.

* **muteCommand**: The bash command to mute the TV. Whilst not supported natively in the Apple iOS remote, I have integrated it with a triple-press on the Volume Down button. Mute is also supported in Homebridge. Optional.

* **manufacturer**: You can add a manufacturer name if you wish. Defaults to the detected device and platform type, otherwise to the platform name. Optional.

* **modelName**: You can add a model name if you wish. Defaults to the detected device model and device type, otherwise to the plugin name. Optional.

* **serialNumber**: You can add a serial number if you wish. Defaults to the set-top box serial number id, otherwise to the physical device id. Optional.

* **firmwareRevision**: You can add a firmware revision if you wish. Must be numeric, non-numeric values are not displayed. Defaults to the plugin version. Optional.





## Netflix and other special app channels ##
Netflix is actually an app on the set-top box, and not a normal linear TV channel. It appears in the channel list on the TV, and can be added to favorites. However, it is not broadcast as a normal linear TV channel in the master channel list. Therefore the name cannot be determined from the profile favorite channel list, and the name appears as "Channel xxx" where xxx is the channel id. Known channel ids for Netflix are:
* Telenet Belgium: netflix
* UPC Switzerland: SVO9690
Add the channelId and the channelName to channelNames in the config, and then the proper name will appear.

## EOS Set-Top Box KeyEvent Commands
A collection of known key event commands that control the set-top box. 

* **MediaTopMenu**: Displays the top menu page (home page) on the TV, same as the **HOME** button on the set-top box remote

* **Escape**: Escapes (exits) out of any current menu on the TV. Same as the **RETURN** button on the set-top box remote

* **ContextMenu**: Displays a context menu on the current TV program. Same as the **...** button on the set-top box remote

* **Info**: Displays the INFO screen on the TV showing info about the current TV program

* **Help**: Displays the SETTINGS INFO page on the TV, allowing you to access settings quickly

* **Guide**: Displays the TV GUIDE page on the TV, same as the Guide button on the set-top box remote

* **MediaPause**: Toggles between Pause and Play of the currently playing program

* **MediaPlayPause**: Toggles between Pause and Play of the currently playing program (same as MediaPause)

* **TV**: Goes back to live TV from whatever state the set-top box was in

* **ChannelUp**: Move up the channel list by one channel, same as the **/\\** (channel up) button on the set-top box remote

* **ChannelDown**: Move down the channel list by one channel, same as the **\\/** (channel down) button on the set-top box remote


## Other Commands
These commands do not control the set-top box directly, but can be used to control the TV or Receiver or stereo volume (network remote control required) 

### Volume
* **VolumeUp** and **VolumeDown**: When the iOS remote is displayed, the iOS volume controls can be used to control the volume of your TV. However, this is not done via the set-top box, but instead via a bash command using a command line interface (CLI) to your TV. Your TV must be capable of being controlled remotely via any machine that can accept a bash command, such as a raspberry pi. The author has a Samsung Receiver and runs Homebridge on a raspberry pi, and thus uses [samsungctl](https://github.com/Ape/samsungctl/) which allows KEY_VOLUP and KEY_VOLDOWN to be easily sent to the Samsung Receiver. If you already have volume buttons in Homebridge for your TV, you can control Homebridge via the command line. See [the examples in issue 506 in the Homebridge issues log](https://github.com/homebridge/homebridge/issues/506) and scoll to the bottom to see some working command lines. Once you know what bash command works, configure it in volUpCommand and volDownCommand.

### Mute
* **Mute** is not supported natively by the iOS remote, but I have added it with a triple-press detection on the volume down button. Press the button three times within 1 second, and the Mute command will be sent using the command stored in the **muteCommand** config item.

### View TV Settings
You can use **View TV Settings** to open the set-top box main menu at the PROFILES menu. To use: in the Home app, tap-and-wait on the set-top box tile to open the channel changer, then tap on the cog/wheel to open the settings for the accessory, and scroll down to **View TV Settings**. 



### Siri
Known Siri commands that work with a Set-Top Box accessory are:
* "Hey Siri, turn on \<SetTopBoxName\>": turns on the set-top box
* "Hey Siri, turn off \<SetTopBoxName\>": turns off the set-top box
* "Hey Siri, start \<SetTopBoxName\>": turns on the set-top box
* "Hey Siri, stop \<SetTopBoxName\>": turns off the set-top box
* "Hey Siri, pause \<SetTopBoxName\>": Siri says "Stopping on the \<SetTopBoxName\>" and shows an AirPlay Connecting dialog but doesn't do anything

As you can see, these are limited to power on and off. Unfortunately, this is an Apple limitation. Hopefully Apply will improve Siri contol in the future.
If you find any more commands, let me know!
    


## Thanks to
* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* [NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

* [ziggonext-python by Rudolf Offereins](https://pypi.org/project/ziggonext/#description) Rudolf is the best!

* My helpers in Belgium: [Wesley Liekens](https://www.facebook.com/deliekes) and [Anthony Dekimpe](https://www.facebook.com/anthony.dekimpe) for helping me get the session code working for Telenet

* UPC for making such a useful TV platform and EOS box

