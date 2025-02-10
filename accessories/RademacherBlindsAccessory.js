var tools = require("./tools.js");
var RademacherAccessory = require("./RademacherAccessory.js");

function RademacherBlindsAccessory(log, debug, accessory, blind, session) {
    RademacherAccessory.call(this, log, debug, accessory, blind, session);
    this.blind = blind;
    this.inverted = this.blind.iconSet.k!="iconset7"
    var position=0;
    if (this.blind.hasOwnProperty("statusesMap") && this.blind.statusesMap.hasOwnProperty("Position"))
    {
        position=this.blind.statusesMap.Position;
    }
    else
    {
        this.log("no position in blind object %o", blind)
    }
    this.lastPosition = this.inverted ? tools.reversePercentage(position) : position;
    this.currentTargetPosition = this.lastPosition;
    this.obstructionDetected=false;
    this.service = this.accessory.getService(global.Service.WindowCovering);  
    this.service
        .getCharacteristic(global.Characteristic.CurrentPosition)
        .setValue(this.currentTargetPosition)
        .on('get', this.getTargetPosition.bind(this));
    this.service
        .getCharacteristic(global.Characteristic.TargetPosition)
        .setValue(this.currentTargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));
    this.service.getCharacteristic(global.Characteristic.PositionState)
        .setValue(global.Characteristic.PositionState.STOPPED)
        .on('get', this.getPositionState.bind(this));
    this.service.getCharacteristic(Characteristic.ObstructionDetected)
        .setValue(this.blind.hasErrors)
        .on('get', this.getObstructionDetected.bind(this));
    // TODO configure interval
    setInterval(this.update.bind(this), 20000);
}

RademacherBlindsAccessory.prototype = Object.create(RademacherAccessory.prototype);

RademacherBlindsAccessory.prototype.setTargetPosition = function(value, callback) {
    callback(null);
    this.log("%s [%s] - setTargetPosition(%s)", this.accessory.displayName, this.blind.did, value);
    var self = this;
    var target = self.inverted ? tools.reversePercentage(value) : value;
    var params = {name: "GOTO_POS_CMD", value: target};
    this.session.put("/devices/"+this.blind.did, params, 30000, function(err) {
        if(err) 
        {
            self.log("%s [%s] - setTargetPosition(): error=%s", self.accessory.displayName, self.blind.did,err);
            return ;
        }
        self.currentTargetPosition = value;
        self.lastPosition = self.currentTargetPosition;
        self.service.getCharacteristic(global.Characteristic.CurrentPosition).updateValue(self.currentTargetPosition);
        self.service.getCharacteristic(global.Characteristic.TargetPosition).updateValue(self.currentTargetPosition);
    });
};

RademacherBlindsAccessory.prototype.getTargetPosition = function(callback) {
    callback(null, this.currentTargetPosition);
    if (this.debug) this.log("%s [%s] - getTargetPosition(): position=%s", this.accessory.displayName, this.blind.did,this.currentTargetPosition);
    var self = this;
    this.getDevice(function(err, data) {
        if(err) 
        {
            self.log("%s [%s] - getTargetPosition(): error=%s", self.accessory.displayName, self.blind.did,err);
            return; 
        }
        if (data && data.hasOwnProperty("statusesMap"))
        {
            var map=data.statusesMap;
            var pos = self.inverted ? tools.reversePercentage(map.Position) : map.Position;
            if (self.debug) self.log("%s [%s] - getTargetPosition(): current target=%s", self.accessory.displayName, self.blind.did,pos);
            self.currentTargetPosition = pos;
            self.lastPosition = self.currentTargetPosition;
            self.service.getCharacteristic(global.Characteristic.TargetPosition).updateValue(self.currentTargetPosition);
            self.service.getCharacteristic(global.Characteristic.CurrentPosition).updateValue(self.currentTargetPosition);
        }
        else
        {
            self.log("%s [%s] - no current target in %o", self.accessory.displayName, self.blind.did,data);
        }
    });
};

RademacherBlindsAccessory.prototype.getPositionState = function(callback) {
    callback(null, global.Characteristic.PositionState.STOPPED);
};

RademacherBlindsAccessory.prototype.getObstructionDetected = function(callback) {
    callback(null,this.obstructionDetected);
    if (this.debug) this.log("%s [%s] - getObstructionDetected()", this.accessory.displayName, this.blind.did);
    var self = this;
    this.getDevice(function(err, data) {
        if(err)
        {
            self.log(`%s [%s] - getObstructionDetected(): error=%s`, self.accessory.displayName, self.blind.did, err);
            return;
        }
        if (data && data.hasOwnProperty("hasErrors"))
        {
            if (self.debug) self.log("%s [%s] - getObstructionDetected(): hasErrors=%s", self.accessory.displayName, self.blind.did, data.hasErrors);
            self.obstructionDetected=data.hasErrors;
            self.service.getCharacteristic(global.Characteristic.ObstructionDetected).updateValue(self.obstructionDetected);
        }
        else
        {
            if (self.debug) self.log("%s [%s] - getObstructionDetected(): could not detect obstruction from %o", self.accessory.displayName, self.blind.did,data);
        }
    });
};

RademacherBlindsAccessory.prototype.update = function() {
    //if (this.blind.did==10015) this.debug=true
    if (this.debug) this.log(`%s - [%s] update()`, this.accessory.displayName, this.blind.did);
    var self = this;

    // Position
    this.getTargetPosition(function(err, pos) {
        if (err)
        {
            self.log(`%s [%s] - update().getTargetPosition(): error=%s`, self.accessory.displayName, self.blind.did, err);
        }
        else if (pos===null)
        {
            self.log(`%s [%s] - update().getTargetPosition(): got null position`, self.accessory.displayName, self.blind.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getTargetPosition(): enw position=%s`, self.accessory.displayName, self.blind.did, pos);
        }
    }.bind(this));
    
    // Position
    this.getObstructionDetected(function(err, obstructionDetected) {
        if (err)
        {
            self.log(`%s [%s] - update().getObstructionDetected(): error=%s`, self.accessory.displayName, self.blind.did, err);
        }
        else if (obstructionDetected===null)
        {
            self.log(`%s [%s] - update().getObstructionDetected(): got null`, self.accessory.displayName, self.blind.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - update().getObstructionDetected(): obstructionDetected=%s`, self.accessory.displayName, self.blind.did, obstructionDetected);
        }
    }.bind(this));

};

module.exports = RademacherBlindsAccessory;