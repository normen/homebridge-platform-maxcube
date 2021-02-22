var Service;
var Characteristic;
var UUIDGen;
var Accessory;

function ContactSensor(homebridge, platform, device, accessory = null){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  Accessory = homebridge.platformAccessory;
  this.log = platform.log;
  this.config = platform.config;
  if(platform.cube) this.setCube(platform.cube);
  this.device = device;
  this.open = this.device.open;

  if(accessory){
    this.name = accessory.context.name;
    this.accessory = accessory;
    this.informationService = accessory.getService(Service.AccessoryInformation);
    this.contactService = accessory.getService(Service.ContactSensor);
  } else {
    this.deviceInfo = this.cube.getDeviceInfo(device.rf_address);
    this.name = this.deviceInfo.device_name + ' (' + this.deviceInfo.room_name + ')';

    var uuid = UUIDGen.generate(this.device.rf_address + this.name);
    this.log('Creating new accessory for ' + this.name);
    this.accessory = new Accessory(this.name, uuid);
    this.informationService = this.accessory.getService(Service.AccessoryInformation);
    this.informationService
     .setCharacteristic(Characteristic.Manufacturer, 'EQ-3')
     .setCharacteristic(Characteristic.Model, 'EQ3 - '+ this.device.rf_address)
     .setCharacteristic(Characteristic.SerialNumber, this.device.rf_address)

    this.contactService = new Service.ContactSensor();
    this.accessory.addService(this.contactService);
    this.accessory.context.device = this.device;
    this.accessory.context.name = this.name;
    this.accessory.context.deviceType = 1;
    this.contactService
      .addCharacteristic(new Characteristic.StatusLowBattery())
    platform.api.registerPlatformAccessories('homebridge-platform-maxcube', 'MaxCubePlatform', [this.accessory] );
  }
  this.contactService
    .getCharacteristic(Characteristic.ContactSensorState)
    .on('get', this.getContactSensorState.bind(this));

  this.contactService
    .getCharacteristic(Characteristic.StatusLowBattery)
    .on('get', this.getLowBatteryStatus.bind(this));
};

ContactSensor.prototype = {
  setCube: function(cube){
    if(this.cube) return;
    this.cube = cube;
    this.cube.on('device_list', this.refreshDevice.bind(this));
  },
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
    callback(null, this.device.battery_low?1:0);
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
