var MaxCube = require('maxcube');
var Thermostat = require('./thermostat');


/** Sample platform outline
 *  based on Sonos platform
 */

function MaxCubePlatform(log, config){
    this.log = log;
    this.config = config;
    this.refreshed = false;
    if (this.config) {
      //this.log('Connecting to MaxCube')
      this.cube = new MaxCube(this.config.ip, this.config.port);
    }
};
MaxCubePlatform.prototype = {
    accessories: function(callback) {
      //this.log("Fetching maxCube devices.");
      var that = this;
      this.cube.maxCubeLowLevel.on('error', function (error) {
          that.log("Max! Cube Error:", error);
      });
      this.cube.on('connected', function () {
        //that.log('Connected');

        var myAccessories = [];
        that.cube.getDeviceStatus().then(function (devices) {
          if (this.refreshed){
            //that.log('Already refreshed');
            return;
          }
          this.refreshed = true;
          devices.forEach(function (device) {
            //that.log('gegting device info for '+ device.rf_address)
            var deviceInfo = that.cube.getDeviceInfo(device.rf_address);

            if (deviceInfo.device_type == 1||deviceInfo.device_type == 2) {
              //that.log('registering device', deviceInfo.device_name+" ("+deviceInfo.room_name+")")
              myAccessories.push(new Thermostat(that.log, that.config, device, deviceInfo, that.cube, Service, Characteristic));
            }
          });
          //that.cube.close();
          callback(myAccessories);
        });
      });
    }
};

var Service;
var Characteristic;

// more
module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform('homebridge-platform-maxcube', 'MaxCubePlatform', MaxCubePlatform, true);
}
