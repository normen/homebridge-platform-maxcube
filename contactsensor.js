var Service;
var Characteristic;
//{"rf_address":"181517","open":false}
function ContactSensor(log, config, device, deviceInfo, cube, service, characteristic){
  Service = service;
  Characteristic = characteristic;
  this.log = log;
  this.config = config;
  this.device = device;
  this.deviceInfo = deviceInfo;
  this.cube = cube;
  this.open = this.device.open;
  this.name = this.deviceInfo.device_name;


  this.informationService = new Service.AccessoryInformation();
  this.informationService
    .setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
    .setCharacteristic(Characteristic.Model, 'EQ3 - '+ this.device.rf_address)
    .setCharacteristic(Characteristic.SerialNumber, this.device.rf_address)

  this.contactService = new Service.ContactSensor(this.device.address);
  this.contactService
    .getCharacteristic(Characteristic.ContactSensorState)
    .on('get', this.getContactSensorState.bind(this));

  this.contactService
    .addCharacteristic(new Characteristic.StatusLowBattery())
    .on('get', this.getLowBatteryStatus.bind(this));

};

ContactSensor.prototype = {
  refreshDevice: function(device){
    // this is called by the global data update loop
    if(device.rf_address!=this.device.rf_address) return;
    var that = this;
    var oldDevice = that.device;
    if(device.open) {
      that.openState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
    else {
      that.openState = Characteristic.ContactSensorState.CONTACT_DETECTED;
    }
    that.publishNewData(oldDevice);
  },
  publishNewData: function(oldDevice){
    // publish changes in data so events can be triggered by data changes
    var that = this;
    if(oldDevice.open != that.openState){
      that.contactService.getCharacteristic(Characteristic.ContactSensorState).updateValue(that.openState);
      that.device.open = (that.openState?true:false);
      that.log(that.name+' - received new open '+ that.openState);
    }
    if(oldDevice.battery_low != that.device.battery_low){
      that.contactService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(that.device.battery_low);
      that.log(that.name+' - received new low battery state '+that.device.battery_low);
    }

  },
  getContactSensorState: function(callback) {
    callback(null, this.device.open);
  },
  getLowBatteryStatus: function(callback) {
    callback(null, this.device.battery_low);
  },
  getErrorStatus: function(callback) {
    callback(null, this.device.error||this.device.link_error);
  },
  getServices: function(){
    return [this.informationService,this.contactService];
  }
}
module.exports = ContactSensor;
