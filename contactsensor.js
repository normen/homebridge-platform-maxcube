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
    this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
    var oldDevice = this.device;
    if(device.open) {
      this.openState = Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    }
    else {
      this.openState = Characteristic.ContactSensorState.CONTACT_DETECTED;
    }
    // publish changes in data so events can be triggered by data changes
    if(oldDevice.open != this.openState){
      this.contactService.getCharacteristic(Characteristic.ContactSensorState).updateValue(this.openState);
      this.device.open = (this.openState?true:false);
      this.log(this.name+' - received new open '+ this.openState);
    }
    if(oldDevice.battery_low != this.device.battery_low){
      this.contactService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.device.battery_low);
      this.log(this.name+' - received new low battery state '+this.device.battery_low);
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
