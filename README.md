<p align="center">
    <img style="border:1px solid black;" src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/DCX960andRemoteSmall.jpg" alt="Sunrise TV Box (ARRIS DCX960)" height="300" align="center"><br>
    <img style="border:5px solid black;" src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/RoomWithEosstb.png" alt="RoomWithEosstb" height="300" align="center">
    <img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/EosstbControls.png" alt="EosstbControls" height="300" align="center">
    <img style="border:5px solid black;" src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/RemoteControl.png" alt="RemoteControl" height="300" align="center">
  </a>
</p>

# homebridge-eosstb

[![npm](https://badgen.net/npm/dt/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![npm](https://badgen.net/npm/dm/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![npm](https://img.shields.io/npm/v/homebridge-eosstb)](https://www.npmjs.com/package/homebridge-eosstb)
[![EOSSTB Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/VBQjaQjxcz)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![GitHub issues](https://img.shields.io/github/issues/jsiegenthaler/homebridge-eosstb)](https://github.com/jsiegenthaler/homebridge-eosstb/issues)
[![donate](https://badgen.net/badge/donate/paypal/91BE09)](https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468)

`homebridge-eosstb` is a Homebridge plugin allowing you to control your set-top box (typically an ARRIS DCX960 or HUMAX 2008C-STB-xx) running on the Magenta AT / Telenet BE / Sunrise CH / Virgin Media GB & IE / Ziggo NL Horizon TV platform with Apple HomeKit using the Home app and the Apple TV Remote in the Control Center.

| iOS/iPadOS 16 Accessory Tiles | Older iOS/iPadOS Accessory Tiles |
|   :---:   |   :---:   |
| <img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/EosstbAccessoryTile.png" alt="EosstbAccessoryTile" height="60" align="center"> | <img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/EosstbAccessoryTileiOS15.png" alt="EosstbAccessoryTileiOS15" height="80" align="center"> |


This plugin displays your set-top box as a Set-Top Box accessory with power, channel and remote-control capabilities on your iOS device (iPhone, iPad, iMac, etc.).


You need a subscription to the online TV service from your local TV provider.
The username and password are the same as used in the TV provider's TV app on your iOS device (the app varies by country; in Switzerland it is [Sunrise TV](https://apps.apple.com/ch/app/sunrise-tv/id1292688012)).

Supports multiple set-top boxes, should you have more than one.

If you like this plugin, consider making a donation or buying me a coffee!<br>
<a target="blank" href="https://www.paypal.com/donate?hosted_button_id=CNEDGHRUER468"><img src="https://img.shields.io/badge/PayPal-Donate-blue.svg?logo=paypal"/></a>  <a target="blank" href="https://ko-fi.com/jsiegenthaler"><img src="https://img.shields.io/badge/Ko--Fi-Buy%20me%20a%20coffee-29abe0.svg?logo=ko-fi"/></a>

## Readme Applicability
Due to the adding of features and functions, this Readme applies from v2.0.0. For prior versions, please see the [eosstb release history on npm](https://www.npmjs.com/package/homebridge-eosstb?activeTab=versions).

# Works in Your Country (If you are with Magenta / Sunrise / Telenet / Virgin Media / Vodafone / Ziggo)
As [UPC](https://en.wikipedia.org/wiki/UPC_Broadband) (the operator of the Horizon TV platform) operates in multiple countries under multiple brands, this plugin will work in a number of countries that use the Horizon TV platform. The known countries that use the same TV platform with the ARRIS DCX960 or HUMAX 2008C-STB-xx set-top box are:

| Country | TV Provider | Web App | Box Name | Plugin Status |
| ------- | ----------- | ------- | -------- | ------------- |
| BE | [Telenet](https://www2.telenet.be/) | [Telenet TV](https://www.telenettv.be/nl.html) | [Telenet TV-Box](https://www2.telenet.be/nl/klantenservice/ontdek-de-telenet-tv-box/) | Fully Working |
| CH | [Sunrise](https://www.sunrise.ch/en/) | [Sunrise TV](https://www.sunrisetv.ch/en.html) | [Sunrise TV Box](https://www.sunrise.ch/en/internet-tv/tv-subscription) | Fully Working |
| GB | [Virgin Media](https://www.virginmedia.com/) | [Virgin TV Go](https://virgintvgo.virginmedia.com/en.html) | [Virgin TV 360](https://www.virginmedia.com/shop/tv/virgin-tv-360) and [Virgin TV 360 Mini](https://www.virginmedia.com/shop/tv/multiroom)  | Fully Working |
| IE | [Virgin Media](https://www.virginmedia.ie/) | [Virgin TV Anywhere](https://www.virginmediatv.ie/en.html) | [360 Box](https://www.virginmedia.ie/virgintv360support/) | Fully Working |
| NL | [Ziggo](https://www.ziggo.nl/) | [Ziggo GO](https://www.ziggogo.tv/nl.html) | [Mediabox Next](https://www.ziggo.nl/televisie/mediaboxen/mediabox-next#ziggo-tv) | Fully Working |
| ------- | ----------- | ------- | -------- | ------------- |
| AT | [Magenta](https://www.magenta.at/) | [Magenta TV](https://www.magentatv.at/de.html) | [Entertain Box 4K](https://www.magenta.at/entertain-box) | _Testers Wanted_ |
| DE | [Vodafone DE](https://zuhauseplus.vodafone.de/digital-fernsehen/) | [Horizon Go](https://www.horizon.tv/de_de.html) | [GigaTV Cable Box](https://zuhauseplus.vodafone.de/digital-fernsehen/tv-endgeraete/) | _Testers Wanted_ |
| PL | [UPC PL](https://www.upc.pl/) | [UPC TV GO](https://www.upctv.pl/pl/home) | Horizon decoder | _Testers Wanted_ |
| SK | [UPC Broadband Slovakia](https://www.upc.sk/) | [Horizon Go](https://www.horizon.tv/sk_sk.html) | Horizon TV | _Testers Wanted_ |


If you subscribe to a TV service from one of these countries, you are lucky, this plugin will work for you.

May also work with other UPC countries, if you know of any, let me know.

## Made in Switzerland
This plugin was written and tested on the author's set-top box (ARRIS mediabox model DCX960/KK0L/A816/0000) running on Sunrise TV in Switzerland. It has also been extensively tested on Telenet in Belgium (also on the 2nd generation HUMAX 2008C-STB-xx), Virgin Media in Great Britain and Ireland, and Ziggo in the Netherlands.

## Why I chose the Name EOSSTB
I tried to find a good common name that works for this plugin for all countries. Each country uses a different marketing name for the box, so I could not use the local name. The EOS system, also known as the Horizon platform, originally used an ARRIS DCX960, but even this box comes in different types and with different firmware, so I decided not to use the model name. I stuck with the box identifier that appears in the mqtt messages: EOSSTB. 

In March 2022, a newer version of the set-top box has started to appear in Telenet in Belgium: a HUMAX 2008C-STB-TN, which identifies itself as EOS2STB. This has since been seen in NL as a HUMAX 2008C-STB-ZG, and in CH as a HUMAX 2008C-STB-UPC/CH. However, I will keep the plugin name unchanged at EOSSTB. 

## Disclaimer (The Legal Stuff)
This plugin is not provided by Magenta or Telenet or Sunrise or Virgin Media or Ziggo any other affiliate of [UPC](https://en.wikipedia.org/wiki/UPC_Broadband). It is neither endorsed nor supported nor developed by [UPC](https://en.wikipedia.org/wiki/UPC_Broadband) or any affiliates. [UPC](https://en.wikipedia.org/wiki/UPC_Broadband) can change their systems at any time and that might break this plugin. But I hope not.

## Requirements
* An Apple iPhone or iPad with iOS/iPadOS 14.0 (or later). Developed on iOS 14.1...16.1, earlier versions not tested.
* [Homebridge](https://homebridge.io/) v1.1.116 (or later). Developed on Homebridge 1.1.116....1.6.0, earlier versions not tested.
* A TV subscription from one of the supported countries and TV providers.
* An online account for viewing TV in the web app (often part of your TV package), see the table above.
* The ARRIS DCX960 or HUMAX 2008C-STB-xx mediabox, provided by your TV provider as part of your TV subscription, called by the system an "EOSSTB" or "EOS2STB" and marketed under different names in different countries. 
* The set-top box should be set to **SYSTEM** > **Standby power consumption** = **Fast start** to ensure it is always online and can respond to switch-on requests from HomeKit.
* For GB and IE users: if using an ARRIS DCX960, it must be running the TV 360 software, and not the older TiVo V6 software as found in GB and IE. TiVo V6 is not supported by this plugin, but GB users can [upgrade to TV 360 by contacting Virgin Media](https://www.virginmedia.com/shop/customer/virgin-tv-360-upgrade).

## Features
<img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/EosstbControls.png" alt="EosstbControls" height="400" align="right">

* **Full Remote-Control Support**: The Apple TV Remote in your iOS device can control your set-top box; including power, menu navigation, play, pause, fast-forward, rewind, channel up/down, volume and mute commands. All keys are fully configurable for single-tap and double-tap.

* **Siri Support** You can control your box with Siri (to the extent of what Apple Siri supports).

* **Shortcuts Support** You can read and control your box with Shortcuts and HomeKit automations (to the extent of what Apple supports), allowing you to control switch-on and channel selection in Home Automations, Shorcuts and Personal Automations.

* **Synchronised Set-Top Box Name**: Changing the name of the set-top box in the Home app changes it on the TV and backend systems in real time, and vice-versa. No reboot required. You can turn off the sync if desired in the config.

* **Synchronised Current Channel**: Changing the channel on the set-top box changes the displayed channel in the Home app in real time, and vice-versa.

* **Selectable Channel Sort By**: Channels in the Home app channel list can be listed in the same order as shown on the TV, or by Most Watched.

* **Synchronised Channel List Order**: Changing the order of channels in a profile on your set-top box changes the standard channel list order in the Home app in real time. No reboot required. Note that the Shared Profile channel list order cannot be changed.

* **Master Channel List Refreshed Daily**: The master channel list is refreshed daily, ensuring it is always up to date.

* **Ignores Non-Subscribed Channels**: Only the channels you subscribe to are shown in the Home app, saving you valuable slots in the limited Home app channel list.

* **Optional Channel Numbers**: If you wish, you can display a channel number before the channel name. As this consumes some space on the Home app tile, it is off by default.

* **Default Profile Support**: The default profile on start-up of the set-top box is used for the channel list if no other profile is configured for the plugin.

* **Intelligent Mute**: Clicking Volume Down on your iOS device three times in rapid succession sends a Mute command to your TV. A subsequent press of Volume Up or Volume Down cancels the mute (TV dependent). The triple-press timing is configurable.

* **Robust Session Handler**: If the web session or mqtt sessions are lost, the plugin will automatically try to reconnect.

* **Informative Log Entries**: The plugin logs show lots of information about your session and the state of the set-top box. Log levels are configurable with debugLevel.

* **Fully Configurable**: A large amount of configuration items exist to allow you to configure your plugin the way you want.

* **Future Feature Support**: The plugin also supports current and target media state as well as closed captions, even though the Home app accessory cannot currently display or control this data in the home app (as at iOS 16.1). Hopefully, Apple will add support for these features in the future. You can however use this data in Home Automations or the Shortcuts app.



## Installation
Homebridge UI: the easiest way to install is to search for **eosstb** in the Homebridge UI, and then click **INSTALL**.

Manual install:
```sh
sudo npm install -g homebridge-eosstb
```
After installing, make sure you restart Homebridge.

## Adding the Set-Top Box to the Home App
The set-top box accessory is exposed as a separate external accessory and each set-top box needs to be manually paired as follows:

1. Open the **Home** app on your device.
2. Tap **+** in the top right corner of the screen and then **Add Accessory** to start the process of adding a new accessory.
4. **Add Accessory**: tap **More options...** to add the accessory manually.
5. **Select an Accessory to Add to \<HomeName\>**: Select the accessory you want to add. You should see your set-top box here. If not, check your Homebridge config.
6. Accept the **Uncertified Accessory** warning by tapping **Add Anyway**.
7. **Enter HomeKit Setup Code**: Enter the **HomeKit Setup Code** (displayed in Homebridge under the QR code, format XXX-XX-XXX), or use the device's camera to scan the QR code in Homebridge and tap **Continue**.
8. **Set-Top Box Location**: Select a room for your new accessory and tap **Continue**.
9. **Set-Top Box Name**: Give your set-top box a different name if you wish (synchronised to your real set-top box, you can change this in the Home app later) and tap **Continue**.
10. **Name TV Input Sources**: Re-name your TV input sources if you wish (you can change these in the Home app later) and tap **Continue**.
11. **Set-Top Box Automations**: Switch on any suggested automations if you wish (you can change these in the Home app later) and tap **Continue**.
12. **Set-Top Box Added to \<HomeName\>**: Tap **Done** to finish the setup.

<img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/EosstbAccessoryTile.png" alt="EosstbAccessoryTile" height="60" align="left">
Your new accessory will appear shortly in the room that you selected. It may show **Updating...** for a few minutes as it loads all the data.

You can force a Home app refresh by switching to another room and then back again.



## Remote Control Supported Keys
To access the **Apple TV Remote**, open your **Control Center** by swiping down from the top (newer iPhones and iPads) or up from the bottom of the screen (older iPhones). If you do not see the remote-control icon, you will need to activate it in **Settings > Control Centre** and ensure that the **Apple TV Remote** is in the list of **INCLUDED CONTROLS**.
Make sure you select the correct device from the drop-down list at the top of the Apple TV Remote:

The following keys are supported by in the **Apple TV Remote** in the Control Center:

<img src="https://github.com/jsiegenthaler/homebridge-eosstb/blob/master/pics/RemoteControl.png" alt="RemoteControl" height="400" align="right">

| Key | Single Tap | Double Tap |
| ------- | ----------- | ------- |
| Up | ArrowUp | ChannelUp |
| Down | ArrowDown | ChannelDown |
| Left | ArrowLeft | MediaRewind |
| Right | ArrowRight | MediaFastForward |
| Select | Enter | Enter |
| PlayPause | MediaPlayPause | MediaPlayPause |
| Back | Escape | Escape |
| Info | MediaTopMenu | Guide |
| Volume Up | volUpCommand | - |
| Volume Down | volDownCommand | 3 clicks = mute |

The table shows the default key mappings. You can map any Apple TV Remote button to any set-top box remote control button, see the Wiki for all of the known [KeyEvents](https://github.com/jsiegenthaler/homebridge-eosstb/wiki/KeyEvents).

The volume controls do not control the set-top box directly, as the set-top box has no volume capability. The set-top box physical remote actually sends IR commands to your TV. If you can control your TV volume via a network connection then the volume controls can be used to send volume commands to your TV via the raspberry pi. This is what the author uses.


## Using Profiles to better manage your Channel List
Many TV providers provide hundreds of TV channels. The Home app is limited to 100 "services", which are TV channels or reserved for system control. This limits the maximum possible channels to 95, and thus the plugin will load the first 95 subscribed channels found, ignoring all non-subscribed channels. 

If the channels you wish to have in the Home app are not within the first 95 subscribed channels in your TV providers channel list, then you can create a profile on the set-top box, and configure the profile with the channels you want, in the order you want. Enter the same profile name in the plugin config **Profile Name**, and the plugin will load the channels from that profile.

Any changes in the profile on the set-top box will automatically be reflected in the plugin. As the Home app does not expect channels to change in the channel list, you may need to force-close the Home app and reopen it to force a refresh of the displayed channels after a change is made on your set-top box.

The profile used by the plugin does not have to be the same as the set-top box's start-up profile. It is OK to configure a profile that is dedicated to the plugin, if you so wish.


## Sorting the Channel list
The config item **Channel Sort By** allows the channels to be sorted by **Channel Order** (the standard channel order as shown on the TV) or by **Most Watched**. Most Watched is reported by the backend systems and is profile-based. It is not clear how often this list is updated, however for a TV subscription with many channels, this may be a preferable option to show your most watched channels at the top of the channel list.


## Limitations
### Channel Count
Due to HomeKit design limitations, the maximum services for a single accessory are 100. Over this value the Home app will no longer respond. 
Services used in this set-top box accessory are:
1. Information service (Name, model, serial number of the accessory)
2. Television service (for controlling the TV accessory)
3. Speaker service (for the controlling the TV accessory volume)
4. Input service. The input (TV channels) utilises one service per input. The maximum possible channels (inputs) are thus 100 - 3 = 97. I have limited the inputs to maximum 95, but you can override this in the config (helpful to reduce log entries when debugging). The inputs are hard limited to 95 inputs.

### Web App Controllers Take Over Sometimes
The eosstb plugin emulates the TV service web app. If the web app is started on a web browser on a laptop or PC, the backend systems may prefer the web app to HomeKit, and disconnect HomeKit from the mqtt session. The mqtt session will try and reconnect if it gets disconnected.

### Media State (Play/Pause) Limitations
The eosstb plugin can detect the current and target media state and shows STOP, PLAY, PAUSE or LOADING (loading is displayed when fast-forwarding or rewinding) in the Homebridge logs. Unfortunately, the Apple Home app cannot do anything with the media state (as at iOS 16.1) apart from allow you to read it in Shortcuts or Automations. Hopefully this will improve in the future.

### Recording State Limitations
The eosstb plugin can detect the current recording state of the set-top box, both for local HDD-based recording (for boxes that have a HDD fitted) and for network recording. The plugin shows IDLE, ONGOING_NDVR or ONGOING_LOCALDVR in the Homebridge logs. DVR means digital video recorder; N for network and LOCAL for local HDD based recording. The Apple Home app cannot natively do anything with the recording state but the eosstb plugin uses it to set the inUse charateristic if the set-top box is turned on or is recording to the local HDD. This is useful in Shortcuts or Automations.

### Closed Captions Limitations
The eosstb plugin can detect the closed captions state (**Subtitle options** in the set-top box menu) and shows ENABLED or DISABLED in the Homebridge logs. Unfortunately, the Apple Home app cannot do anything with the closed captions state (as at iOS 16.1) apart from allow you to read it in Shortcuts or Automations. Hopefully this will improve in the future.

## Configuration
Add a new platform to the platforms section of your homebridge `config.json`.

Example minimum (mandatory) configuration:

```js
    "platforms": [
        {
            "country": "ch",
            "username": "yourTvProviderUsername",
            "password": "yourTvProviderPassword",
            "platform": "eosstb"
        }
    ]
```

Example extended configuration as used on the author with his Samsung TV (where x.x.x.x is the IP address of the TV). An extended configuration allows you to customise the behaviour of each set-top box device. You must identify the devices by their deviceId:

```js
    "platforms": [
        {
            "platform": "eosstb",
            "name": "EOS",
            "country": "ch",
            "username": "yourTvProviderUsername",
            "password": "yourTvProviderPassword",
            "triplePressTime": 800,
            "debugLevel": 0,
            "devices": [
                {
                    "deviceId": "3C36E4-EOSSTB-00365657xxxx",
                    "name": "Sunrise TV",
                    "syncName": true,
                    "profile": "Dad",
                    "channelOrder": "mostWatched",
                    "accessoryCategory": "settopbox",
                    "playPauseButton": "MediaPlayPause",
                    "backButton": "Escape",
                    "infoButton": "MediaTopMenu",
                    "volUpCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLUP",
                    "volDownCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_VOLDOWN",
                    "muteCommand": "samsungctl --host x.x.x.x --name HomeKit --timeout 0.2 KEY_MUTE",
                    "manufacturer": "ARRIS",
                    "modelName": "DCX960",
                    "serialNumber": "123456",
                    "firmwareRevision": "4.40",
                    "showChannelNumbers": false,
                    "maxChannels": 50
                },
            "channels": [
                {
                    "channelId": "SV09690",
                    "channelName": "Netflix"
                }
            ]
        }
    ]
```

### Platform Config Items
Unless otherwise stated, all config items are case sensitive.

#### Mandatory
Mandatory config items must always exist. These are used to establish the session to the EOS / Horizon platform. If any mandatory config items are missing, a warning is shown and initialization is aborted.

* **platform**: the name of the platform. Mandatory, must be eosstb.

+ **country**: Your country. Must be one of ch, nl, be-nl, be-fr, at or gb. Not case sensitive. This controls the country-specific logon sequence and the mqtt sessions. Mandatory.

* **username**: Your login username for your TV account. Normally an email address. Mandatory.

* **password**: Your password associated with your TV account. Mandatory.

#### Optional

* **name**: The platform name that appears in the Homebridge logs. In many countries the platform is called Horizon, but you can name it to anything. Optional, defaults to "EOSSTB".

* **triplePressTime**: The amount of time in ms to detect triple-press of a button. Used for triple-press features, such as triple-press of Volume Down generates Mute. Optional, defaults to 800ms.

* **debugLevel**: Controls the amount of debug data shown in the Homebridge logs, independent of the debug setting in Homebridge. Extra debug messages above level 0 are shown in the Homebridge log in the warning colour, normally yellow. Supported values are: 0=No debug logging, 1=Minimum, 2=Enhanced, 3=Verbose. Optional. Defaults to 0 if not found. Warning: a lot of log entries can occur at the higher debug levels.



### Device Config Items
Most people will be happy with the default device config. If you do not need to change anything, you can omit the device config section.
If you want to configure your devices differently, do so here. Multiple devices are supported, each device can be configured separately. The devices are identified by their physical deviceId. You will see that there is no option to set the name in the config, as the name of the set-top box displayed in the Home app is always synchronised to the physical set-top box. You can change the set-top box name in the Home app.

#### Mandatory

* **deviceId**: The unique set-top box physical device id, in Switzerland, Belgium and the Netherlands this is in the format 3C36E4-EOSSTB-001234567890. Other countries are similar. Required to identify the set-top box in your network, as multiple boxes can exist. Review the Homebridge log to see your deviceId, it is displayed shortly after a Homebridge restart. Mandatory for a device configuration.

#### Optional

##### Name and Icon

* **name**: The device name. Set to anything you want. If syncName is true, the name will also be synced to the set-top box. Note that the set-top box name must be between 3 and 14 characters long; shorter names are expanded, longer names are truncated. Optional, defaults to the current set-top box name.

* **syncName**: You can choose to sync the HomeKit name with the physical set-top box name. If you set syncName to false, you can name the set-top box in HomeKit differently to the physical set-top box. Optional, defaults to true.

* **accessoryCategory**: The accessory category. This changes the image on the tile in the Home app. Allows you to use a TV or an Audio Receiver or a Set-Top Box (default). Available values are:  Set-Top-Box = any of "settopbox", "stb". TV = any of "television", "tv".  Audio Receiver = any of "receiver", "audio-receiver", "avr".  Not case sensitive. Optional, defaults to Set-Top Box if the value is not recognised.


##### Accessory information

* **manufacturer**: You can add a manufacturer name if you wish. Defaults to the detected device and platform type, otherwise to the eosstb platform name. Optional.

* **serialNumber**: You can add a serial number if you wish. Defaults to the set-top box serial number id, otherwise to the physical deviceId. Optional.

* **modelName**: You can add a model name if you wish. Defaults to the detected device model and product type or device type, otherwise to the eosstb plugin name. Optional.

* **firmwareRevision**: You can add a firmware revision if you wish. Must be numeric (non-numeric values are not displayed in the Home app). Defaults to the eosstb plugin version. Optional.

##### Channel Display

* **profile**: The profile name to use to load the channel list for the device. Optional, defaults to the default profile on startup, as configured on the set-top box. The plugin loads the first 95 subscribed channels found, which is a limitation of HomeKit. To manage your favourte channels within the constraint of 95 channels, create a profile on your set-top box, and use the profile name in the plugin config. If your profile is changed to the set-top box, the changes will be pushed to HomeKit. Channels should stay in a consistent channel order as the channel number is used in HomeKit scenes, not the channel name.

* **channelOrder**: The method to sort the channels in the channel list in the Home app. Available values are: Channel order = "channelOrder", Most Watched = "mostWatched". Case sensitive. Optional, defaults to channelOrder.


* **maxChannels**: The maximum number of channels to load. Optional, defaults to 95. Note: you may need to do force-close and reopen the Home app to force it to recognise a change in the quantity of channels available.

* **showChannelNumbers**: Shows or hides the channel numbers in the channel selector in HomeKit. Values: true or false (default). If channel numbers are displayed, there is less room for the channel name. Optional, defaults to false.


##### Remote Control Button Mapping

* **playPauseButton**: The command issued to the set-top box when the Play/Pause button (**> ||**) in the Apple TV Remote is tapped. Normally MediaPause. Optional, defaults to MediaPause if not found.

* **backButton**: The command issued to the set-top box when the **BACK** button in the Apple TV Remote is tapped. Normally Escape. Optional, defaults to Escape if not found.

* **infoButton**: The command issued to the set-top box when the Info button (**i**) in the Apple TV Remote is tapped. As the Apple TV Remote has no Menu button, the Info button should be used to access the menu. This is why the Info button is set to MediaTopMenu. Optional, defaults to MediaTopMenu if not found.




##### Remote Control Volume Commands

* **volUpCommand**: The bash command to increase the volume of the TV. This command is sent when the Apple TV Remote is open and you press the Volume Up button on your device. Optional.

* **volDownCommand**: The bash command to decrease the volume of the TV. This command is sent when the Apple TV Remote is open and you press the Volume Down button on your device. Optional.

* **muteCommand**: The bash command to mute the TV. Whilst not supported natively in the Apple Apple TV Remote, this plugin integrates it with a triple-press on the Volume Down button. Mute is also supported in Homebridge. Optional.




### Channel Config Items
Some channels such as Netflix are actually apps on the set-top box, and not normal linear TV channels. They appear in the channel list on the TV, and can be added to favourites from the TV menu (but not from the web app menu). However, they are not broadcast as a normal linear TV channel in the master channel list. Therefore, the name cannot be determined from the profile favourite channel list, and the name appears as "Channel xxxxxx" where xxxxxx is the channelId. To overcome this, add the channelId and the channelName to the channels section in the config as per the examples below.

* **channelId**: The channelId, as defined by the TV provider. Unknown channelIds will appear in the Homebridge log.

* **channelNames**: Allows you to add unknown channel names, or to rename any channel as you wish. Required as some channels (e.g., Netflix) are not published on the master channel list. If a channel displays in the Home app like this: "Channel SV09690", then check your TV to see the channel name, and add it to the config. An example is provided for Netflix. Optional, unknown channels are displayed as "Channel xxxxxxx" where xxxxxxx is the channelId.


* Telenet BE: 
```js
    "channels": [
        {
            "channelId": "netflix",
            "channelName": "Netflix"
        }
    ]
```
 
* Virgin Media GB:
 ```js
    "channels": [
        {
            "channelId": "1755",
            "channelName": "Netflix"
        },
        {
            "channelId": "2054",
            "channelName": "Prime Video"
        }
    ]
```

* Sunrise CH: 
```js
    "channels": [
        {
            "channelId": "SVO9690",
            "channelName": "Netflix"
        }
    ]
```

* Ziggo NL: 
```js
    "channels": [
        {
            "channelId": "NL_000073_019506",
            "channelName": "Netflix"
        },
        {
            "channelId": "NL_000210_019505",
            "channelName": "Viaplay"
        }
    ]
```





## Set-Top Box KeyEvent Commands
See the Wiki for [a collection of known key event commands that control the set-top box](https://github.com/jsiegenthaler/homebridge-eosstb/wiki/KeyEvents). 

## Special Commands
The volume and mute commands do not control the set-top box directly, but can be used to control the TV or Receiver volume (network remote control of the TV is required).

### Volume
* **VolumeUp** and **VolumeDown**: When the Apple TV Remote is displayed, the iOS device volume controls can be used to control the volume of your TV. However, this is not done via the set-top box, but instead via a command using a command line interface (CLI) to your TV. Your TV must be capable of being controlled remotely via any machine that can accept a bash command, such as a raspberry pi. The author has a Samsung Home Theater HT-D5500 and runs Homebridge on a raspberry pi, and thus uses [samsungctl](https://github.com/Ape/samsungctl/) which allows KEY_VOLUP, KEY_VOLDOWN and KEY_MUTE to be easily sent to the Samsung Home Theater. If you already have volume buttons in Homebridge for your TV, you can control Homebridge via the command line. See [the examples in issue 506 in the Homebridge issues log](https://github.com/homebridge/homebridge/issues/506) and scroll to the bottom to see some working command lines. Once you know what bash command works, configure it in volUpCommand and volDownCommand.

### Mute
* **Mute** is not supported natively by the Apple TV Remote, but this plugin adds it with a triple-press detection on the volume down button. Press the button three times within 800ms, and the Mute command will be sent using the command stored in the **muteCommand** config item.

### View TV Settings
You can use **View TV Settings** to open the set-top box main menu at the **PROFILES** menu. Usage: in the Home app, tap-and-wait on the set-top box tile to open the channel changer, then tap on the cogwheel to open the settings for the accessory, and scroll down to **View TV Settings**. 


## Siri
See the Wiki for [details on how to control the set-top box with Siri](https://github.com/jsiegenthaler/homebridge-eosstb/wiki/Siri). 
   

## Shortcuts
See the Wiki for [details on how to read and control the set-top box in the Shortcuts app](https://github.com/jsiegenthaler/homebridge-eosstb/wiki/Shortcuts). 


## Thanks to
* [homebridge-yamaha-avr](https://github.com/ACDR/homebridge-yamaha-avr)

* https://openbase.io/js/homebridge-denon-tv/documentation

* [NextRemoteJs](https://github.com/basst85/NextRemoteJs/)

* [ziggonext-python by Rudolf Offereins](https://pypi.org/project/ziggonext/#description) Rudolf is the best!

* My helpers in Belgium: [Wesley Liekens† (RIP)](https://www.facebook.com/deliekes) and [Anthony Dekimpe](https://www.facebook.com/anthony.dekimpe) for helping me get the session code working for Telenet

* My helpers in Great Britain and Ireland (you know who you are) for helping me get the session code working for Virgin Media

* [Liberty Global](https://en.wikipedia.org/wiki/Liberty_Global) for making such a useful Horizon TV platform and lovely set-top boxes
