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
device_type 1+2 = Thermostat
device_type 3 = Wall Thermostat (same data layout)
device_type 4 = Window Sensor (no data except rf_address)
device_type 5 = Eco Button (no data except rf_address)
*/
function Thermostat(log, config, device, deviceInfo, cube, service, characteristic){
  Service = service;
  Characteristic = characteristic;
  this.log = log;
  this.config = config;
  this.device = device;
  this.deviceInfo = deviceInfo;
  this.cube = cube;
  this.lastNonZeroTemp = this.device.temp;
  this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';
  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.defaultTemp = config.default_temp?config.default_temp:20;
  if(this.device.mode == "AUTO"){
    this.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
  } else {
    this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
  }
  if(this.device.setpoint <= 10){
    this.coolingState = Characteristic.TargetHeatingCoolingState.OFF;
  }

  this.informationService = new Service.AccessoryInformation();
  this.informationService
    .setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
    .setCharacteristic(Characteristic.Model, 'EQ3 - '+ this.device.rf_address)
    .setCharacteristic(Characteristic.SerialNumber, this.device.rf_address)

  this.thermostatService = new Service.Thermostat(this.device.address);
  this.thermostatService
    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
    .on('get', this.getCurrentHeatingCoolingState.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
    .on('get', this.getTargetHeatingCoolingState.bind(this))
    .on('set', this.setTargetHeatingCoolingState.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.getCurrentTemperature.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.TargetTemperature)
    .setProps({
      minValue: 10,
      maxValue: 30,
      minStep: 1
    })
    .on('get', this.getTargetTemperature.bind(this))
    .on('set', this.setTargetTemperature.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .on('get', this.getTemperatureDisplayUnits.bind(this));

  this.thermostatService
    .addCharacteristic(new Characteristic.StatusLowBattery())
    .on('get', this.getLowBatteryStatus.bind(this));

  this.thermostatService
    .addCharacteristic(new Characteristic.StatusFault())
    .on('get', this.getErrorStatus.bind(this));
};

Thermostat.prototype = {
  refreshDevice: function(device){
    // this is called by the global data update loop
    if(device.rf_address!=this.device.rf_address) return;
    var that = this;
    var oldDevice = that.device;
    that.device = device;
    if(that.device.mode == "AUTO"){
      that.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    } else {
      that.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }
    if(that.device.setpoint <= 10){
      that.coolingState = Characteristic.TargetHeatingCoolingState.OFF;
    }
    if(that.device.temp != 0){
      that.lastNonZeroTemp = that.device.temp;
    }
    that.publishNewData(oldDevice);
  },
  publishNewData: function(oldDevice){
    // publish changes in data so events can be triggered by data changes
    var that = this;
    if(oldDevice.mode != that.device.mode){
      that.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(that.coolingState);
      that.log(that.name+' - received new target mode '+that.device.mode);
    }
    if(oldDevice.battery_low != that.device.battery_low){
      that.thermostatService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(that.device.battery_low);
      that.log(that.name+' - received new low battery state '+that.device.battery_low);
    }
    if(oldDevice.setpoint != that.device.setpoint){
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(that.device.setpoint);
      that.log(that.name+' - received new target temperature '+that.device.setpoint);
    }
    if(oldDevice.temp != that.device.temp){
      that.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(that.lastNonZeroTemp);
      that.log(that.name+' - received new temperature '+that.device.temp);
    }
    if(oldDevice.error != that.device.error || oldDevice.link_error != that.device.link_error){
      that.thermostatService.getCharacteristic(Characteristic.StatusFault).updateValue(that.device.error||that.device.link_error);
      that.log(that.name+' - received new error state');
    }
  },
  getCurrentHeatingCoolingState: function(callback) {
    if(this.coolingState == Characteristic.TargetHeatingCoolingState.AUTO){
      //current state can't be "AUTO"
      callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
    }
    else {
      callback(null, this.coolingState);
    }
  },
  getTargetHeatingCoolingState: function(callback) {
    callback(null, this.coolingState);
  },
  setTargetHeatingCoolingState: function(value, callback) {
    var that = this;
    var targetCoolingState = 'MANUAL';
    var targetTemp = that.device.setpoint;
    if(value == Characteristic.TargetHeatingCoolingState.OFF) {
      this.coolingState = value;
      targetTemp = 10;
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.HEAT) {
      this.coolingState = value;
      if(targetTemp <= 10){
        targetTemp = this.defaultTemp;
        that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
      }
    }
    else if(value == Characteristic.TargetHeatingCoolingState.COOL) {
      this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
      if(targetTemp <= 10){
        targetTemp = this.defaultTemp;
        that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
      }
    }
    else if(value == Characteristic.TargetHeatingCoolingState.AUTO) {
      this.coolingState = value;
      if(targetTemp <= 10){
        targetTemp = this.defaultTemp;
        that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
      }
      targetCoolingState = 'AUTO';
    } else {
      that.log("Unknown HeatingCoolingState value");
    }
    this.device.mode = targetCoolingState;
    this.device.setpoint = targetTemp;
    if(this.cube) try{
      this.cube.getConnection().then(function () {
        that.log(that.name+' - setting mode '+targetCoolingState+' at temperature '+targetTemp);
        try{
          that.cube.setTemperature(that.device.rf_address, Math.round(targetTemp), targetCoolingState);
        }
        catch(err){
          that.log("Error sending data to Max! Cube: "+ err);
        }
      });
    }
    catch(err){
      that.log("Error sending data to Max! Cube: "+ err);
    }
    callback(null, this.coolingState);
  },
  getCurrentTemperature: function(callback) {
    callback(null, this.lastNonZeroTemp);
  },
  getTargetTemperature: function(callback) {
    callback(null, this.device.setpoint);
  },
  setTargetTemperature: function(value, callback) {
    var that = this;
    this.device.setpoint = value;
    if(this.cube) try{
      this.cube.getConnection().then(function () {
        that.log(that.name+' - setting temperature '+ value);
        try{
          that.cube.setTemperature(that.device.rf_address, Math.round(value), that.device.mode);
        }
        catch(err){
          that.log("Error sending data to Max! Cube: "+ err);
        }
      });
    }
    catch(err){
      that.log("Error sending data to Max! Cube: "+ err);
    }
    callback(null, value);
  },
  getTemperatureDisplayUnits: function(callback) {
    callback(null, this.temperatureDisplayUnits);
  },
  getLowBatteryStatus: function(callback) {
    callback(null, this.device.battery_low);
  },
  getErrorStatus: function(callback) {
    callback(null, this.device.error||this.device.link_error);
  },
  getServices: function(){
    return [this.informationService,this.thermostatService];
  }
}
module.exports = Thermostat;
