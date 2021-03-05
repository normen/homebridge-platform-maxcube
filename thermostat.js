var Service;
var Characteristic;
var Accessory;
var UUIDGen;

function Thermostat(homebridge, platform, device, accessory = null){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  this.log = platform.log;
  this.config = platform.config;
  this.device = device;
  this.lastNonZeroTemp = this.device.temp;
  this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
  this.inputOutputTimeout = 10000;
  this.sendFault = false;
  this.lastManualChange = new Date(0);

  if(platform.cube) this.setCube(platform.cube);
  this.checkHeatingCoolingState();

  if(accessory){
    this.name = accessory.context.name;
    this.comfortTemp = accessory.context.comfortTemp;
    this.ecoTemp = accessory.context.ecoTemp;
    this.offTemp = accessory.context.offTemp;
    this.maxTemp = accessory.context.maxTemp;

    this.accessory = accessory;
    this.informationService = accessory.getService(Service.AccessoryInformation);
    this.thermostatService = accessory.getService(Service.Thermostat);
  } else {
    this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
    this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';

    this.deviceConfig = this.cube.getDeviceConfiguration(device.rf_address);
    this.comfortTemp = this.deviceConfig.comfort_temp || 20;
    this.ecoTemp = this.deviceConfig.eco_temp || 17;
    this.offTemp = this.deviceConfig.min_setpoint_temp || 5;
    this.maxTemp = this.deviceConfig.max_setpoint_temp || 30;

    var uuid = UUIDGen.generate(this.device.rf_address + this.name);
    this.log('Creating new accessory for ' + this.name);
    this.accessory = new Accessory(this.name, uuid);
    this.accessory.context.device = this.device;
    this.accessory.context.name = this.name;
    this.accessory.context.comfortTemp = this.comfortTemp;
    this.accessory.context.ecoTemp = this.ecoTemp;
    this.accessory.context.offTemp = this.offTemp;
    this.accessory.context.maxTemp = this.maxTemp;
    this.accessory.context.deviceType = 0;
    this.thermostatService = new Service.Thermostat();
    this.accessory.addService(this.thermostatService);
    this.informationService = this.accessory.getService(Service.AccessoryInformation);
    this.informationService
     .setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
     .setCharacteristic(Characteristic.Model, 'EQ3 - '+ this.device.rf_address)
     .setCharacteristic(Characteristic.SerialNumber, this.device.rf_address)
    this.thermostatService
     .addCharacteristic(new Characteristic.StatusFault());
    this.thermostatService
     .addCharacteristic(new Characteristic.StatusLowBattery());
    platform.api.registerPlatformAccessories('homebridge-platform-maxcube', 'MaxCubePlatform', [this.accessory] );
  }

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
      minStep: 0.5
    })
    .on('get', this.getTargetTemperature.bind(this))
    .on('set', this.setTargetTemperature.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .on('get', this.getTemperatureDisplayUnits.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.StatusLowBattery)
    .on('get', this.getLowBatteryStatus.bind(this));

  this.thermostatService
    .getCharacteristic(Characteristic.StatusFault)
    .on('get', this.getErrorStatus.bind(this));
};

Thermostat.prototype = {
  setCube: function(cube){
    if(this.cube) return;
    this.cube = cube;
    this.cube.on('device_list', this.refreshDevice.bind(this));
  },
  refreshDevice: function(devices){
    let that = this;
    let device = devices.filter(function(item) { return item.rf_address === that.device.rf_address; })[0];
    if(!device) return;
    //avoid the update resetting values that were just entered by the user and not yet acknowledged by the cube
    if((new Date() - this.lastManualChange) < this.inputOutputTimeout) return;
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
      this.thermostatService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.device.battery_low?1:0);
      this.log(this.name+' - received new low battery state '+this.device.battery_low);
    }
    if(oldDevice.setpoint != this.device.setpoint){
      if(this.device.setpoint>=this.offTemp) this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(this.device.setpoint);
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
    let oldCoolingState = this.targetHeatingCoolingState;
    if(this.device.mode == 'MANUAL'){
      let isEco = this.device.setpoint == this.ecoTemp;
      let isOff = this.device.setpoint == this.offTemp;
      if(isOff) this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
      else if(isEco) this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
      else this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
    }else{
      this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
    }
    //only send change notification when we already computed state once
    if(oldCoolingState !== undefined && oldCoolingState != this.targetHeatingCoolingState){
      this.log(this.name+' - computed new target mode '+this.targetHeatingCoolingState);
      this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(this.targetHeatingCoolingState);
      this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(this.currentHeatingCoolingState());
    }
    return this.targetHeatingCoolingState;
  },
  getCurrentHeatingCoolingState: function(callback) {
    this.checkHeatingCoolingState();
    callback(null, this.currentHeatingCoolingState());
  },
  currentHeatingCoolingState: function(){
    if(this.targetHeatingCoolingState == Characteristic.TargetHeatingCoolingState.AUTO){
      return Characteristic.TargetHeatingCoolingState.HEAT;
    }
    else {
      return this.targetHeatingCoolingState;
    }
  },
  getTargetHeatingCoolingState: function(callback) {
    this.checkHeatingCoolingState();
    callback(null, this.targetHeatingCoolingState);
  },
  setTargetHeatingCoolingState: function(value, callback) {
    this.lastManualChange = new Date();
    let that = this;
    var targetMode = 'MANUAL';
    var targetTemp = this.device.setpoint;
    this.targetHeatingCoolingState = value;
    if(value == Characteristic.TargetHeatingCoolingState.OFF) {
      targetTemp = this.offTemp;
    }
    else if(value == Characteristic.TargetHeatingCoolingState.HEAT) {
      if(targetTemp == this.offTemp){
        targetTemp = this.comfortTemp;
      }
    }
    else if(value == Characteristic.TargetHeatingCoolingState.COOL) {
      targetTemp = this.ecoTemp;
    }
    else if(value == Characteristic.TargetHeatingCoolingState.AUTO) {
      if(targetTemp == this.offTemp){
        targetTemp = this.comfortTemp;
      }
      targetMode = 'AUTO';
    }
    this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(targetTemp);
    this.device.mode = targetMode;
    this.device.setpoint = targetTemp;
    this.checkHeatingCoolingState();
    let errorStatus = that.errorStatus();
    if(this.cube) this.cube.getConnection().then(function () {
      if(errorStatus != 0){
        that.log(that.name+' has error state '+ errorStatus + ' - sending error reset to cube');
        that.cube.resetError(that.device.rf_address);
      }
      that.log(that.name+' - setting mode '+targetMode+' at temperature '+targetTemp);
      that.cube.setTemperature(that.device.rf_address, targetTemp, targetMode);
      that.sendFault = false;
    }, function(){that.sendFault = true});
    callback(null);
  },
  getCurrentTemperature: function(callback) {
    callback(null, this.lastNonZeroTemp);
  },
  getTargetTemperature: function(callback) {
    if(this.device.setpoint>this.offTemp){
      callback(null, this.device.setpoint);
    } else{
      callback(null, this.offTemp);
    }
  },
  setTargetTemperature: function(value, callback) {
    this.lastManualChange = new Date();
    let that = this;
    this.device.setpoint = value;
    let errorStatus = this.errorStatus();
    if(this.cube) this.cube.getConnection().then(function () {
      if(errorStatus != 0){
        that.log(that.name+' has error state '+ errorStatus + ' - sending error reset to cube');
        that.cube.resetError(that.device.rf_address);
      }
      that.log(that.name+' - setting temperature '+ value);
      that.cube.setTemperature(that.device.rf_address, value, that.device.mode);
      that.sendFault = false;
    }, function(){that.sendFault = true});
    callback(null);
  },
  getTemperatureDisplayUnits: function(callback) {
    callback(null, this.temperatureDisplayUnits);
  },
  getLowBatteryStatus: function(callback) {
    callback(null, this.device.battery_low?1:0);
  },
  getErrorStatus: function(callback) {
    callback(null, this.errorStatus());
  },
  errorStatus: function(){
    if(this.device.error||this.device.link_error||this.sendFault){
      return 1;
    }
    return 0;
  },
  getServices: function(){
    return [this.informationService,this.thermostatService];
  }
}
module.exports = Thermostat;
