# DISCONTINUED

As I moved my whole setup to a FHEM server with a CUL 868MHz stick this project is now deprecated. This does *not* mean that its not working or will stop working in the future.

The good news is that if you want to move your existing setup to FHEM as well you probably already have all the hardware to do that. It will work better with a 868MHz CUL or nanoCUL stick but you can also use your old Max Cube with FHEM.

## Migration to FHEM

- Use max cube or build/buy a CUL 868MHz stick
- Install [FHEM](https://fhem.de) on raspi
- Install [fhem plugin](https://github.com/justme-1968/homebridge-fhem) in homebridge
- Define Siri in fhem
- Define Max in fhem according to [this guide](https://wiki.fhem.de/wiki/MAX)
- Define SIGNALduino in fhem according to [this guide](https://wiki.fhem.de/wiki/SIGNALduino)
- Apply `attrTemplate` (see template below) for discovered devices
- Set `siriName` for discovered devices so they appear in homekit
- Profit

Put [this file](max_homebridge.template) in your `/opt/fhem/FHEM/lib/AttrTemplate` folder, then apply the templates through the FHEMWEB UI `set` command or otherwise.

# homebridge-platform-maxcube [![NPM Version](https://img.shields.io/npm/v/homebridge-platform-maxcube.svg)](https://www.npmjs.com/package/homebridge-platform-maxcube) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
Homebridge plugin to bring the eq-3 Max! Cube to Apples HomeKit. Automatically registers all configured devices so that you should instantly be able to control your home heating through Siri & HomeKit.

### Status of this package:
Tested in long time use by the developer and others, all features seem to work as intended. If you're interested to help improving the software further, please do so.

**Note for users of versions prior to 2.0: If you update to 2.0+ you will have to reconfigure all your devices in HomeKit**

Supports the following features of Max! thermostat devices:
 - Setting temperature
 - Setting the mode (Auto/Manual/Eco)
 - Displaying the measured temperature
 - Displaying the set temperature
 - Displaying the battery warning (also in Apples Home app)
 - Displaying error warnings (only in certain apps)
 - Supports window contact sensors
 - Optionally supports wall thermostat devices

## Example config
```
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  "platforms": [
      {
        "platform": "MaxCubePlatform",
        "name": "MaxCube Platform",
        "ip": "192.168.2.20",
        "port": 62910
      }
  ]
}
```
### Explanation:
You have to find out the IP address / server name through your DHCP server. The rest should automatically work out of the box - all devices you have connected are automatically fetched from your Max! Cube.

## Additional Notes

### Heating/Cooling Mode
HomeKit provides a "mode" setting for thermostat devices that allows toggling Off/Heating/Cooling/Auto. This setting is used by this plugin to switch between the "Auto" and "Manual" modes of Max! thermostat devices or to turn them off (e.g. via Siri command).

Note that some of these work different than in Max! or on the thermostats themselves. Enabling the auto mode will for example only change the temperature if the thermostat was off before to avoid issues where scenes in HomeKit set the mode and temperature in short succession.

The modes mean different things in HomeKit and in the Max! Cube:

#### Off = off temperature + manual mode
The thermostat is set to the off temperature defined in Max!. Setting manual mode prevents the Max! schedule from taking over. Setting any other mode when the thermostat is off will set the temperature to the default.

#### Heating = manual mode
Sets the thermostat to manual mode. Setting manual mode prevents the Max! schedule from taking over so it can be used to make "vacation" scenes in HomeKit.

#### Cooling = eco temperature + manual mode
Sets the thermostat to manual mode and automatically sets the temperature to the "eco" temperature defined in Max!. Setting manual mode prevents the Max! schedule from taking over so it can be used to make "vacation" scenes in HomeKit.

#### Auto = auto mode
The thermostat is set to auto mode. From HomeKit it will work as if you were controlling it by hand or the web interface. It will (re)set the temperature at the times programmed in the Max! Cube and otherwise keep the temperature you set.

The mode setting works bidirectionally, if you enable any of the settings on your thermostat HomeKit will update its "mode" accordingly.

### Using Max! software alongside HomeBridge
If you want to use the Max! software to configure your Max! cube you have to set the switch "Max! Link" in HomeKit to off, this will disconnect HomeBridge from the Max! Cube so that the Max! software can connect instead. Set it back to on to be able to control your heating from HomeKit again.

While this plugin is running you can not use the Max! internet control software and vice versa. Disable internet control in the Max! Cube to avoid conflicts.

### HomeKit Triggers
The plugin works bidirectionally, if you change the temperature on your actual thermostat it will be reflected in HomeKit. There can be a delay of up to a minute before the Max! Cube gets the data from the thermostat devices though.

This means that you can trigger scenes based on a certain room temperature, an opened window etc. as the change signal is broadcast in HomeKit.

### Wall thermostat devices
Wall thermostat devices are by default not included in HomeKit but if you add the option `allow_wall_thermostat` to the configuration they will be added as well. They could be useful as they also supply the temperature. They will work and control the temperature of their assigned room either way.

If you want to use ONLY wall thermostat devices and control everything through them you can add the option `only_wall_thermostat`.

### Eco Button
Eco buttons are not included in HomeKit as there isn't really a global "Eco" function in the Max! Cube. What happens when the Eco button is pressed is that all devices are set to their specific eco temperature separately and then set to manual mode so they don't change anymore.

This can be emulated in HomeKit by a scene much better than by any button this plugin could provide.

To create the "eco" scene do the following:
1. Press the physical eco button in your home
2. Make a new scene in HomeKit
3. Select all thermostats
4. Save the scene with a name like "Heating Eco"

The scene will automatically include all thermostats with the mode set to cooling and the temperature set to the eco temperature. To create a "comfort" temperature do the same thing, enable your comfort setting and then create a scene "Heating Comfort" with all thermostats selected.

Because HomeKit keeps track of the state of the thermostats you can press the eco button and the scene will light up. When you change a thermostat it will turn off. Same for the "comfort temperature" scene.

Conversely, calling the scene is _exactly the same_ as pressing the eco button so you can for example set a trigger for the scene to start "when the last person leaves home".

If you change your eco default values in the Max! Cube you will have to update the scene as well. To avoid messing up your HomeKit automation, keep the scene and just re-add the thermostat devices.
1. Press the physical eco button in your home again
2. Edit the existing scene in HomeKit
3. Remove all thermostats from the scene
4. Add them again, they will again save the current eco temperature

### Window sensors
If you don't want your window sensors to appear in HomeKit (they will work even if they don't) you can add an option `windowsensor` with a value of `false` to the config file.

### Overview of optional parameters
```
{
  "platform": "MaxCubePlatform",
  "name": "MaxCube Platform",
  "ip": "192.168.2.20",
  "port": 62910,
  "windowsensor": false,
  "allow_wall_thermostat": true,
  "only_wall_thermostat": true
}
```

## Hints & Troubleshooting

#### Broadcast limit
Note that the Max! cube has a built-in limit for sending data to the thermostat devices to obey to the laws about the 868MHz band. When you play around while setting up your system you might hit that limit and wonder why the thermostat devices don't react to signals anymore.

To test if that is the case set the "Max! Link" switch to "off" and log in with your Max! software. Wait a while to use the thermostat devices again.

#### Error codes
The plugin will report errors from the Max! Cube library to HomeKit but they are only visible in certain HomeKit apps. The code is a bit field, the single bits are as follows:
- `1` device error (generated by Max!)
- `2` link error (generated by Max!)
- `4` error sending data to thermostat (generated by plugin)

## Development
If you want new features or improve the plugin, you're very welcome to do so. The projects `devDependencies` include homebridge and the `npm run test` command has been adapted so that you can run a test instance of homebridge during development. 
#### Setup
- clone github repo
- `npm install` in the project folder
- create `.homebridge` folder in project root
- add `config.json` with appropriate content to `.homebridge` folder
- run `npm run test` to start the homebridge instance for testing

### Version History
see the [Changelog](CHANGELOG.md)
