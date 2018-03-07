var Service;
var Characteristic;

function Thermostat(homebridge, platform, device){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  this.log = platform.log;
  this.config = platform.config;
  this.cube = platform.cube;
  this.device = device;
  this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
  this.deviceConfig = this.cube.getDeviceConfiguration(device.rf_address);
  this.lastNonZeroTemp = this.device.temp;
  this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';
  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.comfortTemp = this.deviceConfig.comfort_temp || 20;
  this.ecoTemp = this.deviceConfig.eco_temp || 17;
  this.offTemp = this.deviceConfig.min_setpoint_temp || 5;
  this.maxTemp = this.deviceConfig.max_setpoint_temp || 30;
  this.sendFault = false;

  this.checkHeatingCoolingState();

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
    this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
    this.deviceConfig = this.cube.getDeviceConfiguration(device.rf_address);
    var oldDevice = this.device;
    this.device = device;
    this.checkHeatingCoolingState();
    if(this.device.temp != 0){
      this.lastNonZeroTemp = this.device.temp;
    }
    // publish changes in data so events can be triggered by data changes
    if(oldDevice.battery_low != this.device.battery_low){
      this.thermostatService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.device.battery_low);
      this.log(this.name+' - received new low battery state '+this.device.battery_low);
    }
    if(oldDevice.setpoint != this.device.setpoint){
      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(this.device.setpoint);
      this.log(this.name+' - received new target temperature '+this.device.setpoint);
    }
    if(oldDevice.temp != this.device.temp){
      this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.lastNonZeroTemp);
      this.log(this.name+' - received new temperature '+this.device.temp);
    }
    if(oldDevice.error != this.device.error || oldDevice.link_error != this.device.link_error){
      this.thermostatService.getCharacteristic(Characteristic.StatusFault).updateValue(this.errorStatus());
      this.log(this.name+' - received new error state');
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
    //only send change notification when we already computed state once
    if(oldCoolingState !== undefined && oldCoolingState != this.coolingState){
      this.log(this.name+' - computed new target mode '+this.coolingState);
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
    var targetTemp = this.device.setpoint;
    if(value == Characteristic.TargetHeatingCoolingState.OFF) {
      this.coolingState = value;
      targetTemp = this.offTemp;
      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.HEAT) {
      this.coolingState = value;
      targetTemp = this.comfortTemp;
      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.COOL) {
      this.coolingState = value;
      targetTemp = this.ecoTemp;
      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    }
    else if(value == Characteristic.TargetHeatingCoolingState.AUTO) {
      this.coolingState = value;
      targetTemp = this.comfortTemp;
      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
      targetMode = 'AUTO';
    } else {
      this.log("Unknown HeatingCoolingState value");
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
