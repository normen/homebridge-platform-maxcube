var MaxCube = require('maxcube');
var Thermostat = require('./thermostat');


/** Sample platform outline
 *  based on Sonos platform
 */

function MaxCubePlatform(log, config){
    this.log = log;
    this.config = config;
		this.refreshed = false;
		this.log(this.config)
		if (this.config) {
			this.cube = new MaxCube(this.config.ip, this.config.port);
		}
};
MaxCubePlatform.prototype = {
    accessories: function(callback) {
    	this.log("Fetching maxCube devices.");
			var that = this;
			this.cube.on('connected', function () {
			  that.log('Connected');
 			 
				var myAccessories = [];
				that.cube.getDeviceStatus().then(function (devices) {
					if (this.refreshed){
						return;
					}
					this.refreshed = true;
				  devices.forEach(function (device) {
						that.log('registering device', device)
						myAccessories.push(new Thermostat(that.log, that.config, device, that.cube, Service, Characteristic));
				  });
				  that.cube.close();
					callback(myAccessories);
				});
			});
    }
};

var Service;
var Characteristic;

// more
module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform('homebridge-platform-maxcube', 'MaxCubePlatform', MaxCubePlatform, true);
}