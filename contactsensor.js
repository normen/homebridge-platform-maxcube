var Service;
var Characteristic;

function ContactSensor(homebridge, platform, device){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  this.log = platform.log;
  this.config = platform.config;
  this.cube = platform.cube;
  this.device = device;
  this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
  this.open = this.device.open;
  this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';

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

  this.cube.on('updated_list', this.refreshDevice.bind(this));
};

ContactSensor.prototype = {
  refreshDevice: function(devices){
    let that = this;
    let device = devices.filter(function(item) { return item.rf_address === that.device.rf_address; })[0];
    if(!device) {
      return;
    }
    this.deviceInfo = that.cube.getDeviceInfo(device.rf_address);
    var oldDevice = that.device;
    if(device.open) {
      that.openState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
    else {
      that.openState = Characteristic.ContactSensorState.CONTACT_DETECTED;
    }
    // publish changes in data so events can be triggered by data changes
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
    return status;
  },
  getServices: function(){
    return [this.informationService,this.contactService];
  }
}
module.exports = ContactSensor;
