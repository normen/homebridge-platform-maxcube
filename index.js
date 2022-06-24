var Accessory, Service, Characteristic, UUIDGen;
var MaxCube = require('maxcube2');
var Thermostat = require('./thermostat');
var ContactSensor = require('./contactsensor');
var _homebridge;

function MaxCubePlatform(log, config, api){
  const self = this;
  this.api = api;
  this.log = log;
  this.config = config;
  this.paused = false;
  this.windowsensor = config.windowsensor === undefined ? true : config.windowsensor;
  this.myAccessories = [];
  this.updateRate = 10000;
  this.connected = false;
  if(!this.config || !this.config.ip || !this.config.port){
    this.log("Warning: MaxCube Plugin not configured!");
    return;
  }
  this.maxSwitch = null;
  this.api.on('didFinishLaunching', function () {
    self.cube = new MaxCube(self.config.ip, self.config.port);
    self.setupCube();
    if(!self.maxSwitch){
      self.maxSwitch = new MaxCubeLinkSwitchAccessory(self);
    }
    self.cube.getConnection();
  });
}
MaxCubePlatform.prototype = {
  setupCube: function() {
    let that = this;
    this.cube.on('error', function (error) {
      that.connected = false;
      that.log("Max! Cube connection error!");
      that.log(error);
      if(that.maxSwitch) that.maxSwitch.sendStatus();
    });
    this.cube.on('closed', function () {
      that.connected = false;
      that.log("Max! Cube connection closed.");
      if(that.maxSwitch) that.maxSwitch.sendStatus();
    });
    this.cube.on('connected', function () {
      that.connected = true;
      that.log("Connected to Max! Cube.");
      if(that.maxSwitch) that.maxSwitch.sendStatus();
      that.cube.getDeviceStatus().then(function (devices) {
        var deviceList = [];
        devices.forEach(function (device) {
          if(!that.haveDevice(device)) {
            var deviceInfo = that.cube.getDeviceInfo(device.rf_address);
            var isShutter = deviceInfo.device_type == 4
            var isWall = that.config.allow_wall_thermostat && (deviceInfo.device_type == 3);
            var deviceTypeOk = that.config.only_wall_thermostat ? (deviceInfo.device_type == 3) : (deviceInfo.device_type == 1 || deviceInfo.device_type == 2);
            if (isShutter && that.windowsensor) {
              that.myAccessories.push(new ContactSensor(_homebridge, that, device));
            }
            if (deviceTypeOk || isWall) {
              that.myAccessories.push(new Thermostat(_homebridge, that, device));
            }
          }
          deviceList.push(device);
        });
        that.myAccessories.forEach(function (accessory, idx, obj){
          if(deviceList.find(device=>device.rf_address === accessory.device.rf_address) === undefined) {
            // remove from homekit
            that.log('Removing ' + accessory.displayName + ' from HomeKit');
            that.api.unregisterPlatformAccessories('homebridge-platform-maxcube', 'MaxCubePlatform', [accessory.accessory]);
            obj.splice(idx,1);
          } else {
            // apply cube for restored devices
            accessory.setCube(that.cube);
          }
        });
        that.updateThermostatData();
      });
    });
  },
  configureAccessory: function(accessory) {
    let that = this;
    if (!this.config) { // happens if plugin is disabled and still active accessories
      return;
    }
    this.log('Restoring ' + accessory.displayName + ' from HomeKit');
    accessory.reachable = true;
    var device = accessory.context.device;
    var type = accessory.context.deviceType;
    if(type === 0){
      this.myAccessories.push(new Thermostat(_homebridge, this, device, accessory));
    } else if(type === 1){
      this.myAccessories.push(new ContactSensor(_homebridge, this, device, accessory));
    } else if(accessory.context.isMaxSwitch){
      this.maxSwitch = new MaxCubeLinkSwitchAccessory(this, accessory);
    } else{
      // don't know this, delete it from HomeKit
      this.api.on('didFinishLaunching', function () {
        that.log('Removing unknown Accessory ' + accessory.displayName + ' from HomeKit');
        that.api.unregisterPlatformAccessories('homebridge-platform-maxcube', 'MaxCubePlatform', [accessory]);
      });
    }
  },
  updateThermostatData: function(){
    // called periodically to trigger maxcube data update
    if(this.updateTimeout) clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(this.updateThermostatData.bind(this),this.updateRate);
    let that = this;
    if(!this.paused && this.cube) this.cube.getConnection().then(function () {
      that.cube.updateDeviceStatus();
    });
  },
  haveDevice: function(device){
    return (this.myAccessories.find(accessory => accessory.device.rf_address === device.rf_address) !== undefined); 
  },
  startCube: function(){
    if(!this.cube) return;
    this.log("Try connecting to Max! Cube..");
    this.paused = false;
    this.cube.getConnection();
  },
  stopCube: function(){
    if(!this.cube) return;
    this.log("Closing connection to Max! Cube..");
    this.paused = true;
    try{this.cube.close()}catch(error){that.error(error)}
  }
};

// switch accessory to enable/disable cube connection
function MaxCubeLinkSwitchAccessory(cubePlatform, accessory = null){
  this.log = cubePlatform.log;
  this.cubePlatform = cubePlatform;
  this.name = "Max! Link";
  if(accessory){
    this.accessory = accessory;
    this.service = accessory.getService(Service.Switch);
  } else {
    var uuidBase = this.name;
    if(cubePlatform.config.name){
      uuidBase = uuidBase + cubePlatform.config.name;
    }
    this.accessory = new Accessory(this.name, UUIDGen.generate(uuidBase));
    this.accessory.context.isMaxSwitch = true;
    this.service = new Service.Switch("Max! Link");
    this.accessory.addService(this.service);
    this.accessory.getService(Service.AccessoryInformation)
     .setCharacteristic(Characteristic.Manufacturer, "EQ-3")
     .setCharacteristic(Characteristic.Model, "Max! Cube")
    this.log('Creating new accessory for ' + this.name);
    cubePlatform.api.registerPlatformAccessories('homebridge-platform-maxcube', 'MaxCubePlatform', [this.accessory] );
  }
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
    callback(null, this.cubePlatform.connected);
  },
  sendStatus: function(){
    this.service.getCharacteristic(Characteristic.On).updateValue(this.cubePlatform.connected);
  }
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  Accessory = homebridge.platformAccessory;
  _homebridge = homebridge;
  homebridge.registerPlatform('homebridge-platform-maxcube', 'MaxCubePlatform', MaxCubePlatform, true);
}
