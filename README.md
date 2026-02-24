# homebridge-rademacher-homepilot
Homebridge plugin for Rademacher Homepilot.

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)


# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [npm](https://www.npmjs.com/package/homebridge-rademacher-homepilot) and should be installed "globally" by typing:
```
npm install -g homebridge-rademacher-homepilot
```
Update your config.json file. See config.json in this repository for a sample.

# Configuration

Configuration sample:
```
  "platforms": [
      {
        "platform": "RademacherHomePilot",
        "name": "RademacherHomePilot",
        "url": "http://192.168.0.1",
        "password": "",
        "password_hashed": false,
        "scenes_as_switch": false,
        "add_blinds": true,
        "add_dimmer": true,
        "add_thermostat": true,
        "add_lock_switch": true,
        "add_enviroment_sensor": true,
        "add_sun_sensor": true,
        "add_temperature_sensor": true,
        "add_door_window_sensor": true,
        "add_smoke_alarmr": true,
        "debug": false,
        "did_list_usage": "none",
        "did_list": []
      }
    ]
```

* `url`: address of HomePilot's web interface in your local network,
* `password`: password to HomePilot (if enabled in its web interface)
* `password_hashed`: password to HomePilot is already hashed with sha256 (if enabled in its web interface), for hashing https://www.sha-generator.de/ worked for me
* `scenes_as_switch`: if "true", all scenes are added as switch to HomeKit, otherwise scenes are not added at all 
* `add_blinds`: if "true", all blinds are added as  HomeKit, otherwise blinds are not added at all
* `add_dimmer`: if "true", all dimmers are added to HomeKit, otherwise dimmers are not added at all
* `add_thermostat`: if "true", all thermostats are added to HomeKit, otherwise thermostats are not added at all 
* `add_lock_switch`: if "true", all locks and switches are added to HomeKit, otherwise locks and switches are not added at all 
* `add_enviroment_sensor`: if "true", all environment sensors are added HomeKit, otherwise environment sensors are not added at all 
* `add_sun_sensor`: if "true", sun sensors are added to HomeKit, otherwise sun sensors are not added at all 
* `add_temperature_sensor`: if "true", temperature sensors are added to HomeKit, otherwise temperature sensors are not added at all 
* `add_door_window_sensor`: if "true", door/window sensors are added to HomeKit, otherwise door/window sensors are not added at all 
* `add_smoke_alarm`: if "true", sun smoke alarms are added to HomeKit, otherwise smoke_alarms are not added at all 
* `debug`: if "true", debugging is activated
* `did_list_usage`: if "include" you can choose what Devices are mirrored to HomeKit, you have to enter matching DIDs below, if "exclude" you can exclude a list of DIDs, default is "none"
* `did_list`: enter the Device IDs (DIDs) you want to be shown in HomeKit. You can find them in the log file in square brackets ("[12/6/2020, 5:40:36 PM] [RademacherHomePilot] blinds are online: bodentief [10000]" => did = 10000), example list: "did_list": [10000,10001,10002]

# Icons
## Awning
If you set the icon "Awning/Markise" in HomePilot for blinds, the position will not be inverted (means 0=Closed, 100=Open)
## Lock
If you set the icon "Closing Contact/Schließkontakt" for a switch it will be added as lock

# Community

The official Homebridge Discord server and Reddit community are where users can discuss Homebridge and ask for help.

<span align="center">

[![Homebridge Discord](https://discordapp.com/api/guilds/432663330281226270/widget.png?style=banner2)](https://discord.gg/kqNCe2D) [![Homebridge Reddit](images/homebridge-reddit.svg?sanitize=true)](https://www.reddit.com/r/homebridge/)

</span>

HomeKit communities can also be found on both [Discord](https://discord.gg/RcV7fa8) and [Reddit](https://www.reddit.com/r/homekit).
