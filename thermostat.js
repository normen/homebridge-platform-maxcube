var Service;
var Characteristic;


function Thermostat(log, config, device, deviceInfo, cube, service, characteristic){
    this.log = log;
    this.config = config;
    this.device = device;
    this.deviceInfo = deviceInfo;
    
    this.cube = cube;
    this.log('adding device: ' + device.rf_address)

    Service = service;
    Characteristic = characteristic;

    // set the name
    this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';

    // set the temperatur to celcius
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
    this.temperature = this.device.temp;
    
    this.refreshDevice();
  };

Thermostat.prototype = {
  refreshDevice: function(){
    //show temperature
    if (this.temperature >= 10) {
      this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
      this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      this.log('setting mode to '+ this.heatingCoolingState + ' temperature to '+ this.temperature)
    } else {
      this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;
      this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
      this.temperature = 10;
      this.log('setting temp to off ', this.heatingCoolingState)
    }

    // auto mode
    if (this.device.mode == 'AUTO'){
      this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
    }
    
    this.targetTemperature = this.temperature;
  },
  getCurrentHeatingCoolingState: function(callback) {
     this.refreshDevice();
     callback(null, this.heatingCoolingState);
  },
  
  getTargetHeatingCoolingState: function(callback) {
     this.refreshDevice();
     callback(null, this.targetHeatingCoolingState);
  },
  
  setTargetHeatingCoolingState: function(value, callback) {
    var that = this;
    var targetCoolingState = 'MANUAL';
    
    if(value == 0)
    {
      this.log('EQ3 - '+this.name+' - Off');  
      this.targetCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
      this.targetTemperature = 0;
    }
    else if(value == 1)
    {
      this.log('EQ3 - '+this.name+' - Day mode');
      this.targetCoolingState = Characteristic.TargetHeatingCoolingState.DAY;
      this.targetTemperature = 19;
    }
    else if(value == 2)
    {
      this.log('EQ3 - '+this.name+' - Night mode');
      this.targetCoolingState = Characteristic.TargetHeatingCoolingState.NIGHT;
      this.targetTemperature = 10;
    }
    else if(value == 3)
    {
      this.log('EQ3 - '+this.name+' - Auto mode');
      this.targetCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
      targetCoolingState = 'AUTO';
      this.targetTemperature = 19;
    } else {
      this.log('unknown mode');
      
    }
    
    this.cube.getConnection().then(function () {
      that.cube.initialised = true;
      that.log('connection established');
      that.log('setting temperature to: '+that.targetTemperature+ ', mode: '+ targetCoolingState);
      that.cube.setTemperature(that.device.rf_address, that.targetTemperature, targetCoolingState);
    });
    callback(null, value);
  },

  getCurrentTemperature: function(callback) {
    this.refreshDevice();
    callback(null, this.temperature);
  },

  getTargetTemperature: function(callback) {
    this.refreshDevice();
    callback(null, this.targetTemperature);
  },

  setTargetTemperature: function(value, callback) {
    that = this;
    this.targetTemperature = value;

    if(this.targetTemperature != this.temperature)
    {
      this.log('EQ3 - '+this.name+' - Setting new temperature '+this.temperature+' -> '+this.targetTemperature);
      this.temperature = this.targetTemperature;
      this.cube.getConnection().then(function () {
        that.device.temp = that.targetTemperature
        that.cube.initialised = true;
        that.log('connection established')
        that.cube.setTemperature(that.device.rf_address, that.targetTemperature)
        that.refreshDevice();
        setTimeout(function(){
          that.cube.close()
        }, 1000)
      });
      
    }
    callback(null, this.targetTemperature);
  },
  
  getTemperatureDisplayUnits: function(callback) {
    var error = null;
    callback(error, this.temperatureDisplayUnits);
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

      return [informationService,thermostatService];
  }
}

module.exports = Thermostat;
