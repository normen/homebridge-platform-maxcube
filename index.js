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
    this.cube = new MaxCube(this.config.ip, this.config.port);
  }
};
MaxCubePlatform.prototype = {
  accessories: function(callback) {
    var that = this;
    this.cube.maxCubeLowLevel.on('error', function (error) {
      that.log("Max! Cube Error:", error);
      if(!this.refreshed){
        // We didn't connect yet and got an error,
        // probably the Cube couldn't be reached,
        // fulfill the callback so HomeBridge can initialize.
        var myAccessories = [];
        callback(myAccessories);
      }
    });
    this.cube.on('connected', function () {
      var myAccessories = [];
      if (this.refreshed) return;
      that.cube.getDeviceStatus().then(function (devices) {
        this.refreshed = true;
        devices.forEach(function (device) {
          var deviceInfo = that.cube.getDeviceInfo(device.rf_address);
          var wall = that.config.allow_wall_thermostat && (deviceInfo.device_type == 3);
          if (deviceInfo.device_type == 1 || deviceInfo.device_type == 2 || wall) {
            myAccessories.push(new Thermostat(that.log, that.config, device, deviceInfo, that.cube, Service, Characteristic));
          }
        });
        callback(myAccessories);
      });
    });
  }
};

var Service;
var Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform('homebridge-platform-maxcube', 'MaxCubePlatform', MaxCubePlatform, true);
}
