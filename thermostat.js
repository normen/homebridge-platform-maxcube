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
deviceConfig:
{ comfort_temp: 21,
  eco_temp: 17,
  max_setpoint_temp: 30.5,
  min_setpoint_temp: 4.5,
  temp_offset: 0,
  max_valve: 100 }
device_type 1+2 = Thermostat
device_type 3 = Wall Thermostat (same data layout)
device_type 4 = Window Sensor (no data except rf_address)
device_type 5 = Eco Button (no data except rf_address)
*/
function Thermostat(log, config, device, cube, service, characteristic){
  Service = service;
  Characteristic = characteristic;
  this.log = log;
  this.config = config;
  this.cube = cube;
  this.device = device;
  this.deviceInfo = cube.getDeviceInfo(device.rf_address);
  this.deviceConfig = cube.getDeviceConfiguration(device.rf_address);
  this.lastNonZeroTemp = this.device.temp;
  this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';
  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.comfortTemp = this.deviceConfig.comfort_temp || 20;
  this.ecoTemp = this.deviceConfig.eco_temp || 17;
  this.offTemp = this.deviceConfig.min_setpoint_temp || 5;
  this.maxTemp = this.deviceConfig.max_setpoint_temp || 30;
  this.sendFault = false;
  if(this.device.mode == 'AUTO'){
    this.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
  } else {
    this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
  }
  if(this.device.setpoint <= this.offTemp){
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
      minValue: this.offTemp,
      maxValue: this.maxTemp,
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

  this.cube.on('updated_list', this.refreshDevice.bind(this));
};

Thermostat.prototype = {
  refreshDevice: function(devices){
    let that = this;
    let device = devices.filter(function(item) { return item.rf_address === that.device.rf_address; })[0];
    if(!device) {
      return;
    }
    this.deviceInfo = that.cube.getDeviceInfo(device.rf_address);
    this.deviceConfig = that.cube.getDeviceConfiguration(device.rf_address);
    var oldDevice = that.device;
    that.device = device;
    this.checkHeatingCoolingState();
    if(that.device.temp != 0){
      that.lastNonZeroTemp = that.device.temp;
    }
    // publish changes in data so events can be triggered by data changes
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
      that.thermostatService.getCharacteristic(Characteristic.StatusFault).updateValue(that.errorStatus());
      that.log(that.name+' - received new error state');
    }
  },
  checkHeatingCoolingState: function(){
    let oldCoolingState = this.coolingState;
    if(this.device.mode == 'MANUAL'){
      let isEco = this.device.setpoint == this.ecoTemp;
      let isOff = this.device.setpoint == this.offTemp;
      if(isOff) this.coolingState = Characteristic.TargetHeatingCoolingState.OFF;
      else if(isEco) this.coolingState = Characteristic.TargetHeatingCoolingState.COOL;
      else this.coolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }else{
      this.coolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    }
    if(oldCoolingState != this.coolingState){
      that.log(that.name+' - received new target mode '+that.device.mode);
      this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(this.coolingState);
    }
  },
  getCurrentHeatingCoolingState: function(callback) {
    this.checkHeatingCoolingState();
    if(this.coolingState == Characteristic.TargetHeatingCoolingState.AUTO){
      callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
    }
    else {
      callback(null, this.coolingState);
    }
  },
  getTargetHeatingCoolingState: function(callback) {
    this.checkHeatingCoolingState();
    callback(null, this.coolingState);
  },
  setTargetHeatingCoolingState: function(value, callback) {
    let that = this;
    var targetMode = 'MANUAL';
    var targetTemp = that.device.setpoint;
    if(value == Characteristic.TargetHeatingCoolingState.OFF) {
      this.coolingState = value;
      targetTemp = this.offTemp;
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.HEAT) {
      this.coolingState = value;
      targetTemp = this.comfortTemp;
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.COOL) {
      this.coolingState = value;
      targetTemp = this.ecoTemp;
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.AUTO) {
      this.coolingState = value;
      targetTemp = this.comfortTemp;
      that.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
      targetMode = 'AUTO';
    } else {
      that.log("Unknown HeatingCoolingState value");
    }
    this.device.mode = targetMode;
    this.device.setpoint = targetTemp;
    this.cube.getConnection().then(function () {
      that.log(that.name+' - setting mode '+targetMode+' at temperature '+targetTemp);
      that.cube.setTemperature(that.device.rf_address, targetTemp, targetMode);
      that.sendFault = false;
    }, function(){that.sendFault = true});
    callback(null, this.coolingState);
  },
  getCurrentTemperature: function(callback) {
    callback(null, this.lastNonZeroTemp);
  },
  getTargetTemperature: function(callback) {
    callback(null, this.device.setpoint);
  },
  setTargetTemperature: function(value, callback) {
    let that = this;
    this.device.setpoint = value;
    if(this.cube) this.cube.getConnection().then(function () {
      that.log(that.name+' - setting temperature '+ value);
      that.cube.setTemperature(that.device.rf_address, value, that.device.mode);
      that.sendFault = false;
    }, function(){that.sendFault = true});
    callback(null, value);
  },
  getTemperatureDisplayUnits: function(callback) {
    callback(null, this.temperatureDisplayUnits);
  },
  getLowBatteryStatus: function(callback) {
    callback(null, this.device.battery_low);
  },
  getErrorStatus: function(callback) {
    callback(null, this.errorStatus());
  },
  errorStatus: function(){
    var status = 0;
    if(this.device.error){
      status|=1;
    }
    if(this.device.link_error){
      status|=2;
    }
    if(this.sendFault){
      status|=4;
    }
    return status;
  },
  getServices: function(){
    return [this.informationService,this.thermostatService];
  }
}
module.exports = Thermostat;
