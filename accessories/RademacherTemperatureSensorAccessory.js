var tools = require("./tools.js");
var RademacherAccessory = require("./RademacherAccessory.js");

function RademacherTemperatureSensorAccessory(log, debug, accessory, sensor, session) {
    RademacherAccessory.call(this, log, debug, accessory, sensor, session);

    this.sensor = sensor;
    this.currentTemperature = sensor.readings.temperature_primary;

    this.service = this.accessory.getService(global.Service.TemperatureSensor);
    this.service.getCharacteristic(global.Characteristic.CurrentTemperature)
        .setProps({minValue: -30.0, maxValue: 80.0})
        .setValue(this.currentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));
}

RademacherTemperatureSensorAccessory.prototype = Object.create(RademacherAccessory.prototype);

RademacherTemperatureSensorAccessory.prototype.getCurrentTemperature = function (callback) {
    if (this.debug) this.log("%s [%s] - getting current temperature", this.accessory.displayName, this.sensor.did);
    callback(null,this.currentTemperature);
    var self = this;

    this.session.get("/v4/devices?devtype=Sensor", 30000, function(err, body) {
        if(err) {
            self.log("%s [%s] - getCurrentTemperature(): error=%s", self.accessory.displayName, self.sensor.did,err);
            return;
        }
        body.meters.forEach(function(data) {
            if(data.did == self.sensor.did)
            {
                self.currentTemperature = data.readings.temperature_primary;
                if (self.debug) self.log("%s [%s] - temperature is %s", self.accessory.displayName, self.sensor.did, self.currentTemperature);
                self.service.getCharacteristic(global.Characteristic.CurrentTemperature).updateValue(self.currentTemperature)
            }
        });
    });
};

RademacherTemperatureSensorAccessory.prototype.getServices = function () {
    return [this.service];
};

module.exports = RademacherTemperatureSensorAccessory;
