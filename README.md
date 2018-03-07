# homebridge-platform-maxcube [![NPM Version](https://img.shields.io/npm/v/homebridge-platform-maxcube.svg)](https://www.npmjs.com/package/homebridge-platform-maxcube)
Bridges the eq-3 Max! Cube to Apples HomeKit.
Automatically registers all devices itself so that you should instantly be able to control your home heating through Siri & HomeKit.

### Status of this package:
Tested in long time use by the developer and others, all features seem to work as intended. If you're interested to help improving the software further, please do so.

Supports the following features of Max! thermostat devices:
 - Setting temperature
 - Displaying the measured temperature
 - Displaying the set temperature
 - Displaying the battery warning (also in Apples Home app)
 - Displaying error warnings (only in certain apps)
 - Setting the mode (AUTO/MANUAL)
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
You have to find out the IP address through your DHCP server, the rest should automatically work out of the box:
All devices you have connected are automatically fetched from your MaxCube

## Additional Notes

### Heating/Cooling Mode
HomeKit provides a "mode" setting for thermostat devices that allows toggling Off/Heating/Cooling/Auto. This setting is used by this plugin to switch between the "Auto" and "Manual" modes of Max! thermostat devices or to turn them off (e.g. via Siri command). The mode setting works bidirectionally, if you enable any of the modes on your thermostat device HomeKit will show it accordingly.

Note that some of these work different than in Max! or on the thermostats themselves. Enabling the auto mode will for example _not_ change the temperature to avoid issues where scenes in HomeKit set the mode and temperature in short succession.

The modes mean different things in HomeKit and in the Max! Cube:

#### Off = off temperature + manual mode
The thermostat is set to the off temperature defined in Max!. Setting manual mode prevents the Max! schedule from taking over. Setting any other mode when the thermostat is off will set the temperature to the default.

#### Heating = manual mode
Sets the thermostat to manual mode. Setting manual mode prevents the Max! schedule from taking over so it can be used to make "vacation" scenes in HomeKit.

#### Cooling = eco temperature + manual mode
Sets the thermostat to manual mode and automatically sets the temperature to the "eco" temperature defined in Max!. Setting manual mode prevents the Max! schedule from taking over so it can be used to make "vacation" scenes in HomeKit.

#### Auto = auto mode
The thermostat is set to auto mode. From HomeKit it will work as if you were controlling it by hand or the web interface. It will (re)set the temperature at the programmed times and otherwise keep the temperature you set.

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
- Press the physical eco button in your home
- Make a new scene in HomeKit
- Select all thermostats
- Save the scene with a name like "Heating Eco"

The scene will automatically include all thermostats with the mode set to off and the temperature set to the eco temperature. To create a "comfort" temperature do the same thing, enable your comfort setting and then create a scene "Heating Comfort" with all thermostats selected.

Because HomeKit keeps track of the state of the thermostats you can press the eco button and the scene will light up. When you change a thermostat it will turn off. Same for the "comfort temperature" scene.

Conversely, calling the scene is exactly the same as pressing the eco button so you can for example set a trigger for the scene to start "when the last person leaves home".

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

To test if that is the case set the "Max! Link" switch to "off" and log in with your Max! software.

#### Error codes
The plugin will report errors from the Max! Cube library to HomeKit but they are only visible in certain HomeKit apps. The code is a bit field, the single bits are as follows:
- `1` device error (generated by Max!)
- `2` link error (generated by Max!)
- `4` error sending data to thermostat (generated by plugin)

### Version History
#### v1.1.0
- Reads default values from Max! settings
- Allow toggling off/eco/manual/auto via HomeKit mode
- Cleanup handling of cube connection with new maxcube2 library
#### v1.0.0
- First full-feature release
- Thermostat support
- Window contact support
- Wall thermostat support
- Stable connection using maxcube2 library
- Robust against network connection losses
