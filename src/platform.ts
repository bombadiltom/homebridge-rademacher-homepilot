import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge' with { 'resolution-mode': 'import' };
import { Accessory, hap } from './hap';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { RademacherHomePilotSession } from './RademacherHomePilotSession';
import { RademacherAccessory } from './accessories/RademacherAccessory';
import { RademacherBlindsAccessory } from './accessories/RademacherBlindsAccessory';
import { RademacherLockAccessory } from './accessories/RademacherLockAccessory';
import { RademacherDimmerAccessory } from './accessories/RademacherDimmerAccessory';
import { RademacherSwitchAccessory } from './accessories/RademacherSwitchAccessory';
import { RademacherSmokeAlarmAccessory } from './accessories/RademacherSmokeAlarmAccessory';
import { RademacherEnvironmentSensorAccessory } from './accessories/RademacherEnvironmentSensorAccessory';
import { RademacherSunSensorAccessory } from './accessories/RademacherSunSensorAccessory';
import { RademacherTemperatureSensorAccessory } from './accessories/RademacherTemperatureSensorAccessory';
import { RademacherDoorSensorAccessory } from './accessories/RademacherDoorSensorAccessory';
import { RademacherThermostatAccessory } from './accessories/RademacherThermostatAccessory';
import { RademacherSceneAccessory } from './accessories/RademacherSceneAccessory';
import type { DevicesResponse, HomePilotItem, ScenesResponse } from './types';

// A cached accessory restored by homebridge (before its device came online)
// or the wrapper class handling a device that is online.
type AccessoryEntry = PlatformAccessory | RademacherAccessory;

const BLINDS_DEVICES = ['27601565', '35000864', '14234511', '35000662', '36500172', '36500572_A', '16234511_A', '16234511_S', '45059071', '31500162', '23602075', '32000064', '32000064_A', '14236011',
    '23782076', '10182345', '10502002', '10122345', '35200262', '10236020', '10941001', '10251530', '10142345', '16901001', '35200662', '10502001', '10771001_A'];
const DIMMER_DEVICES = ['35140462', '35000462', '35001262', '99999982', '99999983', '35200462'];
const THERMOSTAT_DEVICES = ['35003064', '32501812_A', '35002319', '13601001', '13501001_A'];
const LOCK_SWITCH_DEVICES = ['35000262', '35001164', '32501972', '32501972_A', '99999960', '11301001', '32501772_A'];
const ENVIRONMENT_SENSOR_DEVICES = ['32000064', '32000064_A', '32000064_S', '32004464'];
const ENVIRONMENT_SENSOR_METERS = ['32000064_S'];
const SUN_SENSOR_DEVICES = ['32000069', '32210069', '10771003'];
const SMOKE_ALARM_DEVICES = ['32001664'];
const TEMPERATURE_SENSOR_DEVICES = ['32501812_S', '13501001_S'];
const DOOR_SENSOR_DEVICES = ['32003164', '32002119', '14771002'];

export class RademacherHomePilot implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly api: API;
    readonly debug: boolean;
    readonly accessories: Record<string, AccessoryEntry> = {};
    readonly inverted = true;
    readonly session: RademacherHomePilotSession;

    constructor(log: Logging, config: PlatformConfig, api: API) {
        this.log = log;
        this.debug = this.flag(config, 'debug');
        if (this.debug) {
            log('Debugging...');
        }
        this.api = api;

        process.env.UV_THREADPOOL_SIZE = '128';

        // HomePilot session
        this.session = new RademacherHomePilotSession(this.log, this.debug, config['url'], config['password'], config['password_hashed']);

        this.api.on('didFinishLaunching', () => {
            this.session.login((e) => {
                if (e) {
                    this.log('Login failed: ' + e);
                    return;
                }
                this.session.get('/v4/devices?devtype=Actuator', 30000, (err, body) => this.handleActuators(config, err, body));
                this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body) => this.handleSensors(config, err, body));
                if (this.flag(config, 'scenes_as_switch')) {
                    this.session.get('/v4/scenes', 30000, (err, body) => this.handleScenes(config, err, body));
                }
            });
        });
    }

    private flag(config: PlatformConfig, key: string): boolean {
        return String(config[key]).toLowerCase() === 'true';
    }

    // exclude/include dids
    private didFilter(config: PlatformConfig, data: HomePilotItem): boolean {
        const id = data.did ? data.did : data.sid;
        const didListUsage = config['did_list_usage'] as string | undefined;
        const didList = config['did_list'] as (number | string)[] | undefined;
        if (this.debug && didListUsage && didList) {
            this.log('did_list_usage: ' + didListUsage);
            this.log('did_list: ' + didList);
            this.log('id: ' + id);
            this.log('includes: ' + didList.includes(id as number));
        }
        if (didListUsage && didListUsage !== 'none' && didList) {
            if (didListUsage === 'include') {
                if (didList.includes(id as number)) {
                    this.log('did filtering: including did %s: %s', id, data.name);
                    return true;
                } else {
                    this.log('did filtering: excluding (not in include list) did %s: %s', id, data.name);
                }
            } else if (didListUsage === 'exclude') {
                if (didList.includes(id as number)) {
                    this.log('did filtering: excluding did %s: %s', id, data.name);
                } else {
                    this.log('did filtering: including (not in exclude list) did %s: %s', id, data.name);
                    return true;
                }
            }
            return false;
        } else {
            if (this.debug) {
                this.log('not filtering: ' + id);
            }
            return true;
        }
    }

    private displayName(entry: AccessoryEntry): string {
        return this.platformAccessoryOf(entry).displayName;
    }

    private platformAccessoryOf(entry: AccessoryEntry): PlatformAccessory {
        return entry instanceof RademacherAccessory ? entry.accessory : entry;
    }

    private handleActuators(config: PlatformConfig, e: Error | null, body: DevicesResponse): void {
        if (e) {
            this.log('Request failed: ' + e);
            return;
        }
        if (body.devices) {
            body.devices.filter(data => this.didFilter(config, data)).forEach((data) => {
                const uuid = hap.uuid.generate('did' + data.did);
                const accessory = this.accessories[uuid];

                // blinds
                if (BLINDS_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_blinds')) {
                        if (accessory === undefined) {
                            this.addBlindsAccessory(data);
                        } else {
                            this.log('blinds are online: %s [%s]', this.displayName(accessory), data.did);
                            this.accessories[uuid] = new RademacherBlindsAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('blinds found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // dimmer
                else if (DIMMER_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_dimmer')) {
                        if (accessory === undefined) {
                            this.addDimmerAccessory(data);
                        } else {
                            this.log('dimmer is online: %s [%s]', this.displayName(accessory), data.did);
                            this.accessories[uuid] = new RademacherDimmerAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('dimmer found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // thermostat
                else if (THERMOSTAT_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_thermostat')) {
                        if (accessory === undefined) {
                            this.addThermostatAccessory(data);
                        } else {
                            this.log('thermostat is online: %s [%s]', this.displayName(accessory), data.did);
                            this.accessories[uuid] = new RademacherThermostatAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('thermostat found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // lock/switch
                else if (LOCK_SWITCH_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_lock_switch')) {
                        // icon = "Schließkontakt" ? => lock
                        if (data.iconSet?.k.includes('iconset27')) {
                            if (accessory === undefined) {
                                this.addLockAccessory(data);
                            } else {
                                this.log('lock is online: %s [%s]', this.displayName(accessory), data.did);
                                this.accessories[uuid] = new RademacherLockAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                            }
                        } else {
                            if (accessory === undefined) {
                                this.addSwitchAccessory(data);
                            } else {
                                this.log('switch is online: %s [%s]', this.displayName(accessory), data.did);
                                this.accessories[uuid] = new RademacherSwitchAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                            }
                        }
                    } else {
                        this.log('lock/switch found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // environment sensor
                else if (ENVIRONMENT_SENSOR_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_environment_sensor')) {
                        this.addEnvironmentSensorAccessory(accessory, data);
                    } else {
                        this.log('environment sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // sun sensor
                else if (SUN_SENSOR_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_sun_sensor')) {
                        this.addSunSensorAccessory(accessory, data);
                    } else {
                        this.log('sun sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // unknown
                else {
                    this.log('Unknown product: %s', data.deviceNumber);
                    if (this.debug) {
                        this.log(String(data));
                    }
                }
            });
        } else {
            this.log('No devices found in %s', body);
        }
    }

    private handleSensors(config: PlatformConfig, e: Error | null, body: DevicesResponse): void {
        if (e) {
            this.log('Request failed: ' + e);
            return;
        }
        if (body.meters) {
            body.meters.filter(data => this.didFilter(config, data)).forEach((data) => {
                const uuid = hap.uuid.generate('did' + data.did);
                const accessory = this.accessories[uuid];

                // smoke alarm
                if (SMOKE_ALARM_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_smoke_alarm')) {
                        if (accessory === undefined) {
                            this.addSmokeAlarmAccessory(data);
                        } else {
                            this.log('smoke alarm is online: %s [%s]', this.displayName(accessory), data.did);
                            this.accessories[uuid] = new RademacherSmokeAlarmAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('smoke alarm found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // environment sensor
                else if (ENVIRONMENT_SENSOR_METERS.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_environment_sensor')) {
                        this.addEnvironmentSensorAccessory(accessory, data);
                    } else {
                        this.log('environment sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // sun sensor
                else if (SUN_SENSOR_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_sun_sensor')) {
                        this.addSunSensorAccessory(accessory, data);
                    } else {
                        this.log('sun sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // temperature sensor
                else if (TEMPERATURE_SENSOR_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_temperature_sensor')) {
                        if (accessory === undefined) {
                            this.addTemperatureSensorAccessory(data);
                        } else {
                            this.log('temperature sensor is online: %s [%s]', data.name, data.did);
                            this.accessories[uuid] = new RademacherTemperatureSensorAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('temperature sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // door/window sensor
                else if (DOOR_SENSOR_DEVICES.includes(data.deviceNumber!)) {
                    if (this.flag(config, 'add_door_window_sensor')) {
                        if (accessory === undefined) {
                            this.addDoorSensorAccessory(data);
                        } else {
                            this.log('door sensor is online: %s [%s]', this.displayName(accessory), data.did);
                            this.accessories[uuid] = new RademacherDoorSensorAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                        }
                    } else {
                        this.log('door/window sensor found but not added: %s [%s]', data.name, data.did);
                    }
                }
                // unknown
                else {
                    this.log('Unknown product: %s %s %s', data.deviceNumber, data.did, data.name);
                    this.log(String(data));
                }
            });
        } else {
            this.log('No meters found in %s', body);
        }
    }

    private handleScenes(config: PlatformConfig, e: Error | null, body: ScenesResponse): void {
        if (e) {
            this.log('Request failed: ' + e);
            return;
        }
        if (body.scenes) {
            body.scenes.filter(data => this.didFilter(config, data)).forEach((data) => {
                if (data.isExecutable === 1) {
                    const uuid = hap.uuid.generate('sid' + data.sid);
                    const accessory = this.accessories[uuid];

                    if (accessory === undefined) {
                        this.addSceneAccessory(data);
                    } else {
                        this.log('scene is online: %s [%s]', this.displayName(accessory), data.sid);
                        this.accessories[uuid] = new RademacherSceneAccessory(this.log, this.debug, this.platformAccessoryOf(accessory), data, this.session);
                    }
                } else {
                    this.log('Filtered scene: %s %s', data.sid, data.name);
                }
            });
        } else {
            this.log('No scenes found in %s', body);
        }
    }

    configureAccessory(accessory: PlatformAccessory): void {
        this.accessories[accessory.UUID] = accessory;
    }

    private nameOf(data: HomePilotItem): string {
        if (!data.description.trim()) {
            return data.name;
        }
        return data.description;
    }

    addBlindsAccessory(blind: HomePilotItem): void {
        this.log('Found blinds: %s - %s [%s]', blind.name, blind.description, blind.did);

        const name = this.nameOf(blind);
        const accessory = new Accessory(name, hap.uuid.generate('did' + blind.did));
        accessory.addService(hap.Service.WindowCovering, name);
        this.accessories[accessory.UUID] = new RademacherBlindsAccessory(this.log, this.debug, accessory, blind, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added blinds: %s - %s [%s]', blind.name, blind.description, blind.did);
    }

    addSmokeAlarmAccessory(sensor: HomePilotItem): void {
        this.log('Found smoke alarm: %s - %s [%s]', sensor.name, sensor.description, sensor.did);

        const name = this.nameOf(sensor);
        const accessory = new Accessory(name, hap.uuid.generate('did' + sensor.did));
        accessory.addService(hap.Service.SmokeSensor, name);
        accessory.addService(hap.Service.Battery, name);
        this.accessories[accessory.UUID] = new RademacherSmokeAlarmAccessory(this.log, this.debug, accessory, sensor, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added smoke alarm: %s - %s [%s]', sensor.name, sensor.description, sensor.did);
    }

    addEnvironmentSensorAccessory(accessoryIn: AccessoryEntry | undefined, sensor: HomePilotItem): void {
        this.log('Found environment sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);

        const name = this.nameOf(sensor);

        let accessory: PlatformAccessory;
        if (accessoryIn === undefined) {
            this.log('Found environment sensor: new accessory');
            accessory = new Accessory(name, hap.uuid.generate('did' + sensor.did));
            accessory.addService(hap.Service.TemperatureSensor, name);
            accessory.addService(hap.Service.LightSensor, name);
            accessory.addService(hap.Service.ContactSensor, name);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
            accessory = this.platformAccessoryOf(accessoryIn);
        }
        if (!(this.accessories[accessory.UUID] instanceof RademacherEnvironmentSensorAccessory)) {
            this.accessories[accessory.UUID] = new RademacherEnvironmentSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
        }
        this.log('Added environment sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);
    }

    addSunSensorAccessory(accessoryIn: AccessoryEntry | undefined, sensor: HomePilotItem): void {
        this.log('Found sun sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);

        const name = this.nameOf(sensor);

        let accessory: PlatformAccessory;
        if (accessoryIn === undefined) {
            this.log('Found sun sensor: new accessory with LightSensor and Switch characteristics');
            accessory = new Accessory(name, hap.uuid.generate('did' + sensor.did));
            accessory.addService(hap.Service.LightSensor, name);
            accessory.addService(hap.Service.Switch, name);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
            accessory = this.platformAccessoryOf(accessoryIn);
        }
        if (!(this.accessories[accessory.UUID] instanceof RademacherSunSensorAccessory)) {
            this.accessories[accessory.UUID] = new RademacherSunSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
        }
        this.log('Added sun sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);
    }

    addTemperatureSensorAccessory(sensor: HomePilotItem): void {
        this.log('Found temperature sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);

        const name = this.nameOf(sensor);
        const accessory = new Accessory(name, hap.uuid.generate('did' + sensor.did));
        accessory.addService(hap.Service.TemperatureSensor, name);
        this.accessories[accessory.UUID] = new RademacherTemperatureSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added temperature sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);
    }

    addDoorSensorAccessory(sensor: HomePilotItem): void {
        this.log('Found door sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);

        const name = this.nameOf(sensor);
        const accessory = new Accessory(name, hap.uuid.generate('did' + sensor.did));
        accessory.addService(hap.Service.ContactSensor, name);
        accessory.addService(hap.Service.Battery, name);
        this.accessories[accessory.UUID] = new RademacherDoorSensorAccessory(this.log, this.debug, accessory, sensor, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added door sensor: %s - %s [%s]', sensor.name, sensor.description, sensor.did);
    }

    addDimmerAccessory(dimmer: HomePilotItem): void {
        this.log('Found dimmer: %s - %s [%s]', dimmer.name, dimmer.description, dimmer.did);

        const name = this.nameOf(dimmer);
        const accessory = new Accessory(name, hap.uuid.generate('did' + dimmer.did));
        accessory.addService(hap.Service.Lightbulb, name);
        this.accessories[accessory.UUID] = new RademacherDimmerAccessory(this.log, this.debug, accessory, dimmer, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added dimmer: %s - %s [%s]', dimmer.name, dimmer.description, dimmer.did);
    }

    addThermostatAccessory(thermostat: HomePilotItem): void {
        this.log('Found thermostat: %s - %s [%s]', thermostat.name, thermostat.description, thermostat.did);

        const name = this.nameOf(thermostat);
        const accessory = new Accessory(name, hap.uuid.generate('did' + thermostat.did));
        accessory.addService(hap.Service.Thermostat, name);
        this.accessories[accessory.UUID] = new RademacherThermostatAccessory(this.log, this.debug, accessory, thermostat, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added thermostat: %s - %s [%s]', thermostat.name, thermostat.description, thermostat.did);
    }

    addSwitchAccessory(sw: HomePilotItem): void {
        this.log('Found switch: %s - %s [%s]', sw.name, sw.description, sw.did);

        const name = this.nameOf(sw);
        const accessory = new Accessory(name, hap.uuid.generate('did' + sw.did));
        accessory.addService(hap.Service.Switch, name);
        this.accessories[accessory.UUID] = new RademacherSwitchAccessory(this.log, this.debug, accessory, sw, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added switch: %s - %s [%s]', sw.name, sw.description, sw.did);
    }

    addSceneAccessory(scene: HomePilotItem): void {
        this.log('Found scene: %s - %s [%s]', scene.name, scene.description, scene.sid);

        const name = this.nameOf(scene);
        const accessory = new Accessory(name, hap.uuid.generate('sid' + scene.sid));
        accessory.addService(hap.Service.Switch, name);
        this.accessories[accessory.UUID] = new RademacherSceneAccessory(this.log, this.debug, accessory, scene, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added scene: %s - %s [%s]', scene.name, scene.description, scene.sid);
    }

    addLockAccessory(sw: HomePilotItem): void {
        this.log('Found lock: %s - %s [%s]', sw.name, sw.description, sw.did);

        const name = this.nameOf(sw);
        const accessory = new Accessory(name, hap.uuid.generate('did' + sw.did));
        accessory.addService(hap.Service.LockMechanism, name);
        this.accessories[accessory.UUID] = new RademacherLockAccessory(this.log, this.debug, accessory, sw, this.session);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log('Added lock: %s - %s [%s]', sw.name, sw.description, sw.did);
    }

    removeAccessory(accessory: PlatformAccessory): void {
        if (accessory) {
            this.log('[' + accessory.displayName + '] Removed from HomeBridge.');
            if (this.accessories[accessory.UUID]) {
                delete this.accessories[accessory.UUID];
            }
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }
}
