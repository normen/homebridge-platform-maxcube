var MaxCube = require('maxcube2');
var Thermostat = require('./thermostat');
var ContactSensor = require('./contactsensor');

/** Sample platform outline
 *  based on Sonos platform
 */
function MaxCubePlatform(log, config){
  this.log = log;
  this.config = config;
  this.refreshed = false;
  this.windowsensor = config.windowsensor || true;
  this.myAccessories = [];
  this.myAccessories.push(new MaxCubeLinkSwitchAccessory(this.log, this.config, this));
  this.updateRate = 10000;
  this.reconnectTimeout = 10000;
};
MaxCubePlatform.prototype = {
  accessories: function(callback) {
    this.startCube(callback);
  },
  startCube: function(callback){
    if(this.cube) return;
    var that = this;
    this.log("Try connecting to Max! Cube..");
    this.cube = new MaxCube(this.config.ip, this.config.port);
    var myCube = this.cube;
    this.cube.maxCubeLowLevel.on('error', function (error) {
      // if we get a callback but theres a new cube instance -> ignore
      if(!Object.is(that.cube, myCube)) {
        that.log("Message from different cube instance - ignoring");
        try{myCube.close()}catch(error){}
        return;
      }
      that.log("Max! Cube Error:", error);
      // close connection and inform HomeKit about connection switch state
      that.stopCube();
      if(!that.refreshed){
        // We didn't connect yet and got an error,
        // probably the Cube couldn't be reached,
        // DO NOT fulfill the callback so HomeBridge doesn't initialize and delete the devices!
        that.log("Max! Cube could not be found, please restart HomeBridge with Max! Cube connected.");
        //if(!isNull(callback)) callback(that.myAccessories);
      } else{
        // We were already connected and got an error, try reconnect
        that.log("Reconnecting in "+that.reconnectTimeout/1000+" seconds");
        setTimeout(that.startCube.bind(that),that.reconnectTimeout);
      }
    });
    this.cube.on('connected', function () {
      // if we get a callback but theres a new cube instance -> ignore
      if(!Object.is(that.cube, myCube)) {
        that.log("Message from different cube instance - ignoring");
        try{myCube.close()}catch(error){}
        return;
      }
      that.log("Connected to Max! Cube..");
      // inform HomeKit about connection switch state
      that.myAccessories[0].sendStatus();
      // if were connected before, only publish new cube info and return
      if(that.refreshed){
        that.myAccessories.forEach(function(thermostat){
          thermostat.cube = that.cube;
        });
        return;
      }
      // first connection, list devices, create accessories and start update loop
      that.cube.getDeviceStatus().then(function (devices) {
        that.refreshed = true;
        devices.forEach(function (device) {
          var deviceInfo = that.cube.getDeviceInfo(device.rf_address);
          var isShutter = deviceInfo.device_type == 4
          var isWall = that.config.allow_wall_thermostat && (deviceInfo.device_type == 3);
          var deviceTypeOk = that.config.only_wall_thermostat ? (deviceInfo.device_type == 3) : (deviceInfo.device_type == 1 || deviceInfo.device_type == 2);
          if (isShutter && that.windowsensor) {
            that.myAccessories.push(new ContactSensor(that.log, that.config, device, that.cube, Service, Characteristic));
          }
          if (deviceTypeOk || isWall) {
            that.myAccessories.push(new Thermostat(that.log, that.config, device, that.cube, Service, Characteristic));
          }
        });
        setTimeout(that.updateThermostatData.bind(that),that.updateRate);
        if(!isNull(callback)) callback(that.myAccessories);
      });
    });
  },
  stopCube: function(){
    if(this.cube){
      this.log("Closing connection to Max! Cube..");
      try{this.cube.close()}catch(error){}
      this.cube = null;
      this.myAccessories.forEach(function(thermostat){
        thermostat.cube = null;
      });
      this.myAccessories[0].sendStatus();
    }
  },
  updateThermostatData: function(){
    // called periodically
    setTimeout(this.updateThermostatData.bind(this),this.updateRate);
    var that = this;
    if(that.cube) this.cube.getConnection().then(function () {
      if(that.cube) that.cube.getDeviceStatus().then(function (devices) {
        devices.forEach(function (device) {
          that.myAccessories.forEach(function(thermostat){
            thermostat.refreshDevice(device);
          });
        });
      });
    });
  }
};

// switch accessory to enable/disable cube connection
function MaxCubeLinkSwitchAccessory(log, config, cubePlatform){
  this.log = log;
  this.config = config;
  this.cubePlatform = cubePlatform;
  this.name = "Max! Link";
  this.service = new Service.Switch("Max! Link");
  this.service.getCharacteristic(Characteristic.On).value = false;
  this.service.getCharacteristic(Characteristic.On)
      .on('set', this.setConnectionState.bind(this))
      .on('get', this.getConnectionState.bind(this));
}

MaxCubeLinkSwitchAccessory.prototype = {
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
    .setCharacteristic(Characteristic.Manufacturer, "EQ-3")
    .setCharacteristic(Characteristic.Model, "Max! Cube")
    return [informationService, this.service];
  },
  setConnectionState: function(state, callback){
    if(state){
      this.cubePlatform.startCube();
    }else{
      this.cubePlatform.stopCube();
    }
    callback(null, state);
  },
  getConnectionState: function(callback){
    callback(null, this.cubePlatform.cube != null);
  },
  sendStatus: function(){
    this.service.getCharacteristic(Characteristic.On).updateValue(this.cubePlatform.cube != null);
  },
  refreshDevice(deviceInfo){
    //only here so that update loop doesn't have to be complicated
  }
}

function isNull(object) {
    return object == undefined || null;
}

var Service;
var Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform('homebridge-platform-maxcube', 'MaxCubePlatform', MaxCubePlatform);
}
