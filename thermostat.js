var Service;
var Characteristic;


function Thermostat(log, config, device, cube, service, characteristic){
    this.log = log;
    this.config = config;
		this.device = device;
		
		this.cube = cube;
		this.log('adding device: ' + device.rf_address)

		Service = service;
		Characteristic = characteristic;

		this.name = this.device.rf_address;
		this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
		this.temperature = this.device.temp;
    this.targetTemperature = this.device.temp;
    this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.HEAT;
    this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
};

Thermostat.prototype = {
	refreshDevice: function(){
		
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
		if(value == 0)
    {
			this.log('EQ3 - '+this.name+' - Off');
		}
		else if(value == 1)
		{
			this.log('EQ3 - '+this.name+' - Day mode');
		}
		else if(value == 2)
    {
    	this.log('EQ3 - '+this.name+' - Night mode');
		}
	  else if(value == 3)
		{
	  	this.log('EQ3 - '+this.name+' - Auto mode');
		}
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
    this.refreshDevice();
		this.targetTemperature = value;

		if(that.targetTemperature != that.temperature)
		{
		  this.log('EQ3 - '+this.name+' - Setting new temperature '+this.temperature+' -> '+this.targetTemperature);
			this.temperature = this.targetTemperature;
			this.cube.getConnection().then(function () {
				that.cube.initialised = true;
				that.log('connection established')
				that.cube.setTemperature(that.device.rf_address, that.targetTemperature)
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