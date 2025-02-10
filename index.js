var Accessory, Service, Characteristic, UUIDGen;

var RademacherHomePilotSession = require('./accessories/RademacherHomePilotSession.js');
var RademacherBlindsAccessory = require('./accessories/RademacherBlindsAccessory.js');
var RademacherLockAccessory = require('./accessories/RademacherLockAccessory.js');
var RademacherDimmerAccessory = require ('./accessories/RademacherDimmerAccessory.js');
var RademacherSwitchAccessory = require ('./accessories/RademacherSwitchAccessory.js');
var RademacherSmokeAlarmAccessory = require ('./accessories/RademacherSmokeAlarmAccessory.js');
var RademacherEnvironmentSensorAccessory = require ('./accessories/RademacherEnvironmentSensorAccessory.js');
var RademacherSunSensorAccessory = require ('./accessories/RademacherSunSensorAccessory.js');
var RademacherTemperatureSensorAccessory = require ('./accessories/RademacherTemperatureSensorAccessory.js');
var RademacherDoorSensorAccessory = require ('./accessories/RademacherDoorSensorAccessory.js');
var RademacherThermostatAccessory = require('./accessories/RademacherThermostatAccessory.js');
var RademacherSceneAccessory = require ('./accessories/RademacherSceneAccessory.js');

module.exports = function(homebridge) {
    global.Accessory = homebridge.platformAccessory;
    global.Service = homebridge.hap.Service;
    global.Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-rademacher-homepilot", "RademacherHomePilot", RademacherHomePilot, true);
};

// exclude/include dids
function did_filter(log, config,data)
{
    this.debug = (String(config["debug"]).toLowerCase() == "true"); 
    id=data.did?data.did:data.sid;
    if (this.debug && config["did_list_usage"] && config["did_list"]) 
    {
        log("did_list_usage: "+config["did_list_usage"])
        log("did_list: "+config["did_list"])
        log("id: "+id)
        log("includes: "+config["did_list"].includes(id))
    }
    if (config["did_list_usage"] && config["did_list_usage"]!="none" && config["did_list"]) 
    {
        if (config["did_list_usage"]=="include") 
        {
            if (config["did_list"].includes(id))
            {
                log("did filtering: including did "+id)
                return data;
            }
            else
            {
                log("did filtering: excluding (not in include list) did "+id)
            }   
        }
        else if (config["did_list_usage"]=="exclude") 
        {
            if (config["did_list"].includes(id))
            {
                log("did filtering: excluding did "+id)
            }
            else
            {
                log("did filtering: including (not in exclude list) did "+id)
                return data;
            }              
        }
    }
    else
    {
        if (this.debug) log("not filtering: "+id)
        return data;     
    }
}

function RademacherHomePilot(log, config, api) {
    // global vars
    this.log = log;
    this.debug = (String(config["debug"]).toLowerCase() == "true"); 
    if (this.debug) log("Debugging...")
    var self = this;

    // configuration vars
    this.accessories = [];
    this.inverted = true;

    process.env.UV_THREADPOOL_SIZE = 128;
    
    // HomePilot session
    this.session = new RademacherHomePilotSession(this.log, this.debug, config["url"], config["password"], config["password_hashed"]);

    if (api) {
        this.api = api;

        this.api.on('didFinishLaunching', function() {
            var handleActuators = function(e, body) {
                if(e) {
                  self.log("Request failed: "+e);
                  return;
                }
                if (body.devices)
                {
                    body.devices.filter(data => did_filter(self.log,config,data)).forEach(function(data) {
                        var uuid = UUIDGen.generate("did"+data.did);
                        var accessory = self.accessories[uuid];
                       
                        // blinds
                        if(["27601565","35000864","14234511","35000662","36500172","36500572_A","16234511_A","16234511_S","45059071","31500162","23602075","32000064","32000064_A","14236011",
                            "23782076","10182345","10502002","10122345","35200262","10236020","10941001","10251530","10142345","16901001","35200662","10502001","10771001_A"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addBlindsAccessory(data);
                            }
                            else {
                                self.log("blinds are online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherBlindsAccessory(self.log, self.debug, (accessory instanceof RademacherBlindsAccessory ? accessory.accessory : accessory), data, self.session);
                            }
                        }
                        // dimmer
                        else if(["35140462","35000462","35001262","99999982","99999983","35200462"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addDimmerAccessory(data);
                            }
                            else {
                                self.log("dimmer is online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherDimmerAccessory(self.log, self.debug, (accessory instanceof RademacherDimmerAccessory ? accessory.accessory : accessory), data, self.session, self.inverted);
                            }
                        }
                        // thermostat
                        else if(["35003064","32501812_A","35002319","13601001","13501001_A"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addThermostatAccessory(data);
                            }
                            else {
                                self.log("thermostat is online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherThermostatAccessory(self.log, self.debug, (accessory instanceof RademacherThermostatAccessory ? accessory.accessory : accessory), data, self.session, self.inverted);
                            }
                        }
                        // lock/switch
                        else if(["35000262","35001164","32501972","32501972_A","99999960","11301001","32501772_A"].includes(data.deviceNumber))
                        {
                            // icon = "Schließkontakt" ? => lock
                            if (data.iconSet.k.includes("iconset27")){
                                if (accessory === undefined) {
                                    self.addLockAccessory(data);
                                }
                                else
                                { 
                                    self.log("lock is online: %s [%s]", accessory.displayName, data.did);
                                    self.accessories[uuid] = new RademacherLockAccessory(self.log, self.debug, (accessory instanceof RademacherLockAccessory ? accessory.accessory : accessory), data, self.session);
                                }
                            }
                            else {
                                if (accessory === undefined) {
                                    self.addSwitchAccessory(data);
                                }
                                else
                                {
                                    self.log("switch is online: %s [%s]", accessory.displayName, data.did);
                                    self.accessories[uuid] = new RademacherSwitchAccessory(self.log, self.debug, (accessory instanceof RademacherSwitchAccessory ? accessory.accessory : accessory), data, self.session);
                                }
                            }
                        }
                        // enviroment sensor
                        else if(["32000064","32000064_A","32000064_S","32004464"].includes(data.deviceNumber))
                        {
                            self.addEnvironmentSensorAccessory(accessory, data);
                        }
                        // sun sensor
                        else if(["32000069","32210069","10771003"].includes(data.deviceNumber))
                        {
                            self.addSunSensorAccessory(accessory, data);
                        }
                        // unknown
                        else
                        {
                            self.log("Unknown product: %s", data.deviceNumber);
                            if (self.debug) self.log(data);
                        }
                    });
                }
                else
                {
                    self.log("No devices found in %s",body);
                }
            };
            var handleSensors = function(e, body) {
                if(e) {
                    self.log("Request failed: "+e);
                    return;
                }
                if (body.meters)
                {
                    body.meters.filter(data => did_filter(self.log,config,data)).forEach(function(data) {
                        var uuid = UUIDGen.generate("did"+data.did);
                        var accessory = self.accessories[uuid];
                        
                        // smoke alarm
                        if(["32001664"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addSmokeAlarmAccessory(data);
                            }
                            else {
                                self.log("smoke alarm is online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherSmokeAlarmAccessory(self.log, self.debug, (accessory instanceof RademacherSmokeAlarmAccessory ? accessory.accessory : accessory), data, self.session);
                            }
                        }
                        // environment sensor
                        else if(["32000064_S"].includes(data.deviceNumber))
                        {
                            self.addEnvironmentSensorAccessory(accessory, data);
                        }
                        // sun sensor
                        else if(["32000069","32210069","10771003"].includes(data.deviceNumber))
                        {
                            self.addSunSensorAccessory(accessory, data);
                        }
                        // temperature sensor
                        else if(["32501812_S","13501001_S"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addTemperatureSensorAccessory(data);
                            }
                            else {
                                self.log("temperature sensor is online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherTemperatureSensorAccessory(self.log, self.debug, (accessory instanceof RademacherTemperatureSensorAccessory ? accessory.accessory : accessory), data, self.session);
                            }
                        }
                        // door/window sensor
                        else if(["32003164","32002119","14771002"].includes(data.deviceNumber))
                        {
                            if (accessory === undefined) {
                                self.addDoorSensorAccessory(data);
                            }
                            else {
                                self.log("door sensor is online: %s [%s]", accessory.displayName, data.did);
                                self.accessories[uuid] = new RademacherDoorSensorAccessory(self.log, self.debug, (accessory instanceof RademacherDoorSensorAccessory ? accessory.accessory : accessory), data, self.session);
                            }
                        }                    
                        // unknown
                        else
                        {
                            self.log("Unknown product: %s",data.deviceNumber);
                            self.log(data);
                        }
                    });
                }
                else
                {
                    self.log("No meters found in %s",body);
                }
            };
            var handleScenes = function(e, body) {
                if(e) {
                    self.log("Request failed: "+e);
                    return;
                }
                if (body.scenes)
                {
                    body.scenes.filter(data => did_filter(self.log,config,data)).forEach(function(data) {
                        if (data.isExecutable==1)
                        {
                            var uuid = UUIDGen.generate("sid"+data.sid);
                            var accessory = self.accessories[uuid];
                            
                            if (accessory === undefined) {
                                self.addSceneAccessory(data);
                            }
                            else {
                                self.log("scene is online: %s [%s]", accessory.displayName, data.sid);
                                self.accessories[uuid] = new RademacherSceneAccessory(self.log, self.debug, (accessory instanceof RademacherSceneAccessory ? accessory.accessory : accessory), data, self.session);
                            }
                        }
                    });
                }
                else
                {
                    self.log("No meters found in %s", body);
                }
            };
            self.session.login(function(e) {
                if(e) {
                    self.log("Login failed: "+e);
                    return;
                }
                self.session.get("/v4/devices?devtype=Actuator", 30000, handleActuators);
                self.session.get("/v4/devices?devtype=Sensor", 30000, handleSensors);
                if (String(config["scenes_as_switch"]).toLowerCase() == "true")
                {
                    self.session.get("/v4/scenes", 30000, handleScenes);
                }
            });
        }.bind(this));
    }
}

RademacherHomePilot.prototype.configureAccessory = function(accessory) {
    this.accessories[accessory.UUID] = accessory;
};

RademacherHomePilot.prototype.addBlindsAccessory = function(blind) {
    this.log("Found blinds: %s - %s [%s]", blind.name, blind.description, blind.did);

    var name = null;
    if(!blind.description.trim())
        name = blind.name;
    else
        name = blind.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+blind.did));
    accessory.addService(global.Service.WindowCovering, name);
    this.accessories[accessory.UUID] = new RademacherBlindsAccessory(this.log, this.debug, accessory, blind, this.session, this.inverted);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added blinds: %s - %s [%s]", blind.name, blind.description, blind.did);
};

RademacherHomePilot.prototype.addSmokeAlarmAccessory = function(sensor) {
    this.log("Found smoke alarm: %s - %s [%s]", sensor.name, sensor.description, sensor.did);

    var name = null;
    if(!sensor.description.trim())
        name = sensor.name;
    else
        name = sensor.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+sensor.did));
    accessory.addService(global.Service.SmokeSensor, name);
    accessory.addService(global.Service.Battery, name);
    this.accessories[accessory.UUID] = new RademacherSmokeAlarmAccessory(this.log, this.debug, accessory, sensor, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added smoke alarm: %s - %s [%s]", sensor.name, sensor.description, sensor.did);
};

RademacherHomePilot.prototype.addEnvironmentSensorAccessory = function(accessoryIn, sensor) {
    this.log("Found environment sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);

    var name = null;
    if(!sensor.description.trim())
        name = sensor.name;
    else
        name = sensor.description;

    var accessory = null
    if (accessoryIn === undefined)
    {
        this.log("Found environment sensor: new accessory")
        accessory = new global.Accessory(name, UUIDGen.generate("did"+sensor.did));
        accessory.addService(global.Service.TemperatureSensor, name);
        accessory.addService(global.Service.LightSensor, name);
        accessory.addService(global.Service.ContactSensor, name);
        this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    }
    else if (accessoryIn instanceof RademacherEnvironmentSensorAccessory)
    {
        accessory = accessoryIn.accessory;
    }
    else
    {
        accessory = accessoryIn
    }
    if (!(this.accessories[accessory.UUID] instanceof RademacherEnvironmentSensorAccessory))
    {
        this.accessories[accessory.UUID] = new RademacherEnvironmentSensorAccessory(this.log, this.debug, accessory, sensor, this.session, this.inverted);
    }
    this.log("Added environment sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);
};

RademacherHomePilot.prototype.addSunSensorAccessory = function(accessoryIn, sensor) 
{
    this.log("Found sun sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);

    var name = null;
    if (!sensor.description.trim()) {
        name = sensor.name;
    }
    else {
        name = sensor.description;
    }

    var accessory = null;

    if (accessoryIn === undefined) {
        this.log("Found sun sensor: new accessory with LightSensor and Switch characteristics");
        accessory = new global.Accessory(name, UUIDGen.generate("did" + sensor.did));
        accessory.addService(global.Service.LightSensor, name);
        accessory.addService(global.Service.Switch, name);
        this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    }
    else if (accessoryIn instanceof RademacherSunSensorAccessory) {
        accessory = accessoryIn.accessory;
    }
    else {
        accessory = accessoryIn;
    }

    if (!(this.accessories[accessory.UUID] instanceof RademacherSunSensorAccessory)) {
        this.accessories[accessory.UUID] = new RademacherSunSensorAccessory(this.log, this.debug, accessory, sensor, this.session, this.inverted);
    }
    
    this.log("Added sun sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);
};

RademacherHomePilot.prototype.addTemperatureSensorAccessory = function(sensor) {
    this.log("Found temperature sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);

    var name = null;
    if(!sensor.description.trim())
        name = sensor.name;
    else
        name = sensor.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+sensor.did));
    accessory.addService(global.Service.TemperatureSensor, name);
    this.accessories[accessory.UUID] = new RademacherTemperatureSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added temperature sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);
};

RademacherHomePilot.prototype.addDoorSensorAccessory = function(sensor) {
    this.log("Found door sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);

    var name = null;
    if(!sensor.description.trim())
        name = sensor.name;
    else
        name = sensor.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+sensor.did));
    accessory.addService(global.Service.ContactSensor, name);
    accessory.addService(global.Service.Battery, name);
    this.accessories[accessory.UUID] = new RademacherDoorSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added door sensor: %s - %s [%s]", sensor.name, sensor.description, sensor.did);
};

RademacherHomePilot.prototype.addDimmerAccessory = function(dimmer) {
    this.log("Found dimmer: %s - %s [%s]", dimmer.name, dimmer.description, dimmer.did);

    var name = null;
    if(!dimmer.description.trim())
        name = dimmer.name;
    else
        name = dimmer.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+dimmer.did));
    accessory.addService(global.Service.Lightbulb, name);
    this.accessories[accessory.UUID] = new RademacherDimmerAccessory(this.log, this.debug, accessory, dimmer, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added dimmer: %s - %s [%s]", dimmer.name, dimmer.description, dimmer.did);
};

RademacherHomePilot.prototype.addThermostatAccessory = function(thermostat) {
    this.log("Found thermostat: %s - %s [%s]", thermostat.name, thermostat.description, thermostat.did);

    var name = null;
    if(!thermostat.description.trim())
        name = thermostat.name;
    else
        name = thermostat.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+thermostat.did));
    accessory.addService(global.Service.Thermostat, name);
    this.accessories[accessory.UUID] = new RademacherThermostatAccessory(this.log, this.debug, accessory, thermostat, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added thermostat: %s - %s [%s]", thermostat.name, thermostat.description, thermostat.did);
};

RademacherHomePilot.prototype.addSwitchAccessory = function(sw) {
    this.log("Found switch: %s - %s [%s]", sw.name, sw.description, sw.did);

    var name = null;
    if(!sw.description.trim())
        name = sw.name;
    else
        name = sw.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+sw.did));
    accessory.addService(global.Service.Switch, name);
    this.accessories[accessory.UUID] = new RademacherSwitchAccessory(this.log, this.debug, accessory, sw, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added switch: %s - %s [%s]", sw.name, sw.description, sw.did);
};

RademacherHomePilot.prototype.addSceneAccessory = function(scene) {
    this.log("Found scene: %s - %s [%s]", scene.name, scene.description, scene.sid);

    var name = null;
    if(!scene.description.trim())
        name = scene.name;
    else
        name = scene.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("sid"+scene.sid));
    accessory.addService(global.Service.Switch, name);
    this.accessories[accessory.UUID] = new RademacherSceneAccessory(this.log, this.debug, accessory, scene, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added scene: %s - %s [%s]", scene.name, scene.description, scene.sid);
};

RademacherHomePilot.prototype.addLockAccessory = function(sw) {
    this.log("Found lock: %s - %s [%s]", sw.name, sw.description, sw.did);

    var name = null;
    if(!sw.description.trim())
        name = sw.name;
    else
        name = sw.description;
    var accessory = new global.Accessory(name, UUIDGen.generate("did"+sw.did));
    accessory.addService(global.Service.LockMechanism, name);
    this.accessories[accessory.UUID] = new RademacherLockAccessory(this.log, this.debug, accessory, sw, this.session);
    this.api.registerPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    this.log("Added lock: %s - %s [%s]", sw.name, sw.description, sw.did);
};

RademacherHomePilot.prototype.removeAccessory = function(accessory) {
    if (accessory) {
        this.log("[" + accessory.description + "] Removed from HomeBridge.");
        if (this.accessories[accessory.UUID]) {
            delete this.accessories[accessory.UUID];
        }
        this.api.unregisterPlatformAccessories("homebridge-rademacher-homepilot", "RademacherHomePilot", [accessory]);
    }
};
