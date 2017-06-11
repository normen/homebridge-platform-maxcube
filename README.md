# MaxCube module for homebridge
Bridges the eq-3 MaxCube box to Apples Homekit.
Automatically registers all devices itself so that you should instantly be able to control your home heating through Siri & your phone.

### Status of this package:
Halfway decent and tested by a handful of people, most features work as intended.
If you're interested to help, please do so. The code needs improvement and it currently won't win a beauty contest as that was not the intention.

Supports the following features of Max! thermostat devices:
 - Setting temperature
 - Setting the mode (AUTO/MANUAL)
 - Displaying the measured temperature
 - Displaying the set temperature
 - Displaying the battery warning (also in Apples Home app)
 - Displaying error warnings (only in certain apps)

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
You have to find out the ip party through your DHCP server, the rest should automatically work out of the box:
All devices you have connected are automatically fetched from your MaxCube

## Additional Notes

### Heating/Cooling Mode
HomeKit provides a "mode" setting for thermostat devices that allows toggling OFF/HEATING/COOLING/AUTO. This setting is used by this plugin to enable the "AUTO" mode of Max! thermostat devices or to turn them off (e.g. via Siri command). The following things happen when different modes are enabled:

 - OFF: The thermostat is set to 10 degrees and manual mode. Setting any other mode when the thermostat is off will set the temperature to the default.
 - HEATING: The thermostat is set to manual mode, temperature is kept as is if above 10.
 - COOLING: The thermostat is set to manual mode, temperature is kept as is if above 10. The thermostat will report "HEATING" when next polled.
 - AUTO: The thermostat is set to AUTO mode, temperature is kept as is if above 10.

The default temperature when the thermostat is turned back on is 20 degrees. You can add a default_temp option to the config file to change this value, e.g. `"default_temp":22`.

When the thermostat is set to 10 degrees or less manually it will also report "OFF".

### Using Max! software alongside HomeBridge / Max! Link Switch
If you want to use the Max! software to configure your Max! cube you have to set the switch "Max! Link" in HomeKit to off, this will disconnect HomeBridge from the Max! Cube so that the Max! software can connect instead. Set it back to on to be able to control your heating from HomeKit again.

### Bidirectional
The plugin works bidirectionally, if you change the temperature on your actual thermostat it will be reflected in HomeKit. However theres a delay of up to five minutes until the plugin next polls the data from the Max! cube.

This also means that you can trigger scenes based on a certain room temperature etc. as the change signal is broadcast in HomeKit.

### AUTO mode and setting the temperature
When you set the AUTO mode it is kept even if you change the temperature via HomeKit / Siri, same for manual mode. When the thermostat is in AUTO mode and you change the temperature via HomeKit the Max! cube should set it back to the planned temperature on the next planned change.

### Wall thermostat devices
Wall thermostat devices are by default not included in HomeKit but if you add the option `allow_wall_thermostat` with any value except false/0 to the configuration they will be added as well. They could be useful as they also supply the temperature.

If you want to use ONLY wall thermostat devices and control everything through them you can add the option `only_wall_thermostat` with any value except false/0, e.g.

```
{
  "platform": "MaxCubePlatform",
  "name": "MaxCube Platform",
  "ip": "192.168.2.20",
  "port": 62910,
  "only_wall_thermostat": "true"
}
```

### Update rate
If you want to increase or reduce the rate at which the data is polled from the cube you can add the option `update_rate` with a time in minutes to the configuration.
```
{
  "platform": "MaxCubePlatform",
  "name": "MaxCube Platform",
  "ip": "192.168.2.20",
  "port": 62910,
  "update_rate": 10
}
```

### Broadcast limit
Note that the Max! cube has a built-in limit for sending data to the thermostat devices to obey to the laws about the 868MHz band. When you play around while setting up your system you might hit that limit and wonder why the thermostat devices don't react to signals anymore. To test if that is the case set the "Max! Link" switch to "off" and log in with your Max! software.
