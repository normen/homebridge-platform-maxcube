# MaxCube module for homebridge
Bridges the eq-3 MaxCube box to Apples Homekit.
Automatically registers all devices itself so that you should instantly be able to control your home heating through Siri & your phone.

##### Status of this package:
Experimental and dirty.
If you're interested to help, please do so. The code needs improvement and it currently won't win a beauty contest as that was not the intention.


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
##### Explanation:
You have to find out the ip party through your DHCP server, the rest should automatically work out of the box:
All devices you have connected are automatically fetched from your MaxCube