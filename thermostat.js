var Service;
var Characteristic;
/*
device:
{ rf_address: '15b389',
  initialized: false,
  fromCmd: false,
  error: false,
  valid: false,
  mode: 'AUTO',
  dst_active: false,
  gateway_known: false,
  panel_locked: false,
  link_error: false,
  battery_low: false,
  valve: 0,
  setpoint: 0,
  temp: 0 }
deviceInfo:
{ device_type: 1,
  device_name: 'Süden',
  room_name: 'Stube',
  room_id: 1 }
*/
function Thermostat(log, config, device, deviceInfo, cube, service, characteristic){

    this.log = log;
    this.config = config;
    this.device = device;
    this.deviceInfo = deviceInfo;

    this.cube = cube;

    this.lastNonZeroTemp = this.device.temp;

    Service = service;
    Characteristic = characteristic;

    // set the name
    this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';

    // set the temperatur to celcius
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

    if(this.device.mode == "AUTO"){
      this.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    } else {
      this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }
  };

Thermostat.prototype = {
  refreshDevice: function(){
    var that = this;
    this.cube.getConnection().then(function () {
      that.cube.getDeviceStatus(that.device.rf_address).then(function (devices) {
        devices.forEach(function (device) {
          that.device.initialized=device.initialized;
          that.device.fromCmd=device.fromCmd;
          that.device.error=device.error;
          that.device.valid=device.valid;
          that.device.mode=device.mode;
          that.device.dst_active=device.dst_active;
          that.device.gateway_known=device.gateway_known;
          that.device.panel_locked=device.panel_locked;
          that.device.link_error=device.link_error;
          that.device.battery_low=device.battery_low;
          that.device.valve=device.valve;
          that.device.setpoint=device.setpoint;
          that.device.temp=device.temp;
          if(that.device.mode == "AUTO"){
            that.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
          } else {
            that.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
          }
          if(that.device.temp != 0){
            that.lastNonZeroTemp = that.device.temp;
          }
        });
      });
    });
  },
  getCurrentHeatingCoolingState: function(callback) {
     this.refreshDevice();
     callback(null, this.coolingState);
  },

  getTargetHeatingCoolingState: function(callback) {
     this.refreshDevice();
     callback(null, this.coolingState);
  },
  setTargetHeatingCoolingState: function(value, callback) {
    this.refreshDevice();
    var that = this;
    var targetCoolingState = 'MANUAL';
    if(value == 0) {
      //this.coolingState = Characteristic.TargetHeatingCoolingState.OFF;
      this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }
    else if(value == 1) {
      this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }
    else if(value == 2) {
      //this.coolingState = Characteristic.TargetHeatingCoolingState.COOL;
      this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }
    else if(value == 3) {
      this.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      targetCoolingState = 'AUTO';
    } else {
    }
    this.cube.getConnection().then(function () {
      that.log('setting mode: '+ targetCoolingState);
      that.cube.setTemperature(that.device.rf_address, that.device.setpoint, targetCoolingState);
    });
    callback(null, this.coolingState);
  },

  getCurrentTemperature: function(callback) {
    this.refreshDevice();
    callback(null, this.lastNonZeroTemp);
  },

  getTargetTemperature: function(callback) {
    this.refreshDevice();
    callback(null, this.device.setpoint);
  },

  setTargetTemperature: function(value, callback) {
    var that = this;
    that.refreshDevice();
    this.cube.getConnection().then(function () {
      that.log('setting temperature: '+ value);
      that.cube.setTemperature(that.device.rf_address, value, that.device.mode);
      that.refreshDevice();
    });
    callback(null, value);
  },

  getTemperatureDisplayUnits: function(callback) {
    var error = null;
    callback(error, this.temperatureDisplayUnits);
  },
  getLowBatteryStatus: function(callback) {
    this.refreshDevice();
    callback(null, this.device.battery_low);
  },

  getServices: function(){
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
      .setCharacteristic(Characteristic.Model, 'EQ3 - '+ this.device.rf_address)
      .setCharacteristic(Characteristic.SerialNumber, this.device.rf_address)

    var thermostatService = new Service.Thermostat(this.device.address);
      thermostatService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

      thermostatService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));

      thermostatService
        .addCharacteristic(new Characteristic.StatusLowBattery())
        .on('get', this.getLowBatteryStatus.bind(this));

      return [informationService,thermostatService];
  }
}

module.exports = Thermostat;
