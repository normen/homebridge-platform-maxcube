var MaxCube = require('maxcube2');
var Thermostat = require('./thermostat');
var ContactSensor = require('./contactsensor');

function MaxCubePlatform(log, config){
  this.log = log;
  this.config = config;
  this.wasConnected = false;
  this.paused = false;
  this.windowsensor = config.windowsensor === undefined ? true : config.windowsensor;
  this.myAccessories = [];
  this.myAccessories.push(new MaxCubeLinkSwitchAccessory(this.log, this.config, this));
  this.updateRate = 10000;
  this.reconnectTimeout = 10000;
  this.cube = null;
};
MaxCubePlatform.prototype = {
  accessories: function(callback) {
    if(this.cube) return;
    var that = this;
    this.startCube();

    this.cube.on('error', function (error) {
      if(!that.wasConnected){
        // We didn't connect yet and got an error,
        // probably the Cube couldn't be reached,
        // DO NOT fulfill the callback so HomeBridge doesn't initialize and delete the devices!
        that.log("Max! Cube could not be found, please restart HomeBridge with Max! Cube connected.");
        //callback(that.myAccessories);
      } else{
        that.log("Max! Cube connection error", error);
        // inform HomeKit about connection switch state
        that.myAccessories[0].sendStatus();
        // We were already connected and got an error, it will try and reconnect on the next list update
      }
    });
    this.cube.on('connected', function () {
      that.log("Connected to Max! Cube..");
      // inform HomeKit about connection switch state
      that.myAccessories[0].sendStatus();
      if(!that.wasConnected){
        // first connection, list devices, create accessories and start update loop
        that.cube.getDeviceStatus().then(function (devices) {
          that.wasConnected = true;
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
          callback(that.myAccessories);
          that.updateThermostatData();
        });
      }
    });
  },
  startCube: function(){
    this.log("Try connecting to Max! Cube..");
    this.paused = false;
    if(!this.cube){
      this.cube = new MaxCube(this.config.ip, this.config.port);
    }
    this.cube.getConnection();
  },
  stopCube: function(){
    this.log("Closing connection to Max! Cube..");
    this.paused = true;
    if(this.cube){
      try{this.cube.close()}catch(error){}
      this.myAccessories[0].sendStatus();
    }
  },
  updateThermostatData: function(){
    // called periodically to trigger maxcube data update
    setTimeout(this.updateThermostatData.bind(this),this.updateRate);
    var that = this;
    if(!this.paused) this.cube.getConnection().then(function () {
      that.cube.updateDeviceStatus();
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
    callback(null, this.cubePlatform.cube.initialised);
  },
  sendStatus: function(){
    this.service.getCharacteristic(Characteristic.On).updateValue(this.cubePlatform.cube.initialised);
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
