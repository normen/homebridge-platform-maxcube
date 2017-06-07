# MaxCube module for homebridge
Bridges the eq-3 MaxCube box to Apples Homekit.
Automatically registers all devices itself so that you should instantly be able to control your home heating through Siri & your phone.

### Status of this package:
Experimental and dirty.
If you're interested to help, please do so. The code needs improvement and it currently won't win a beauty contest as that was not the intention.

Supports the following features of Max! thermostat devices:
 - Setting temperature
 - Setting the mode (AUTO/MANUAL)
 - Displaying the measured temperature
 - Displaying the set temperature
 - Displaying the battery warning

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
 
 - OFF: The thermostat is set to 10 degrees and manual mode.
 - HEATING: The thermostat is set to manual mode, temperature is kept as is.
 - COOLING: The thermostat is set to manual mode, temperature is kept as is, it will report "HEATING" when next polled.
 - AUTO: The thermostat is set to AUTO mode.
 
When the thermostat is set to 10 degrees or less manuall it will also report "OFF".

### Using Max! software alongside HomeBridge
If you want to use the Max! software to configure your Max! cube its best to first stop the homebridge server as you might get connection issues otherwise.
