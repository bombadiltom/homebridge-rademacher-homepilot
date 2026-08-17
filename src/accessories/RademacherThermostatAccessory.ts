import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import * as tools from '../tools';
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherThermostatAccessory extends RademacherAccessory {
    private readonly thermostat: HomePilotItem;
    private currentTemperature: number;
    private lastTemperature: number;
    private targetTemperature: number;
    private readonly targetState: number;
    private currentState: number;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, thermostat: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, thermostat, session);

        this.thermostat = thermostat;

        this.currentTemperature = tools.duofernTemp2HomekitTemp(this.thermostat.statusesMap?.acttemperatur as number);
        this.lastTemperature = this.currentTemperature;
        this.targetTemperature = tools.duofernTemp2HomekitTemp(this.thermostat.statusesMap?.Position as number);
        this.targetState = hap.Characteristic.CurrentHeatingCoolingState.HEAT;
        if (this.thermostat.statusesMap?.relaisstatus !== undefined) {
            this.currentState = this.thermostat.statusesMap.relaisstatus;
        } else {
            this.currentState = hap.Characteristic.CurrentHeatingCoolingState.HEAT;
        }

        this.service = this.getOrAddService(hap.Service.Thermostat, this.accessory.displayName);

        this.service.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
            .setValue(this.currentState)
            .setProps({
                minValue: hap.Characteristic.CurrentHeatingCoolingState.OFF,
                maxValue: hap.Characteristic.CurrentHeatingCoolingState.HEAT,
                minStep: 1,
                validValues: [hap.Characteristic.CurrentHeatingCoolingState.OFF, hap.Characteristic.CurrentHeatingCoolingState.HEAT],
            })
            .on('get', this.getCurrentHeatingCoolingState.bind(this));

        this.service.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
            .setValue(this.targetState)
            .setProps({
                minValue: hap.Characteristic.CurrentHeatingCoolingState.HEAT,
                maxValue: hap.Characteristic.CurrentHeatingCoolingState.HEAT,
                minStep: 1,
                validValues: [hap.Characteristic.CurrentHeatingCoolingState.HEAT],
            })
            .on('get', this.getTargetHeatingCoolingState.bind(this))
            .on('set', this.setTargetHeatingCoolingState.bind(this));

        this.service.getCharacteristic(hap.Characteristic.CurrentTemperature)
            .setValue(this.currentTemperature)
            .setProps({
                minValue: 4,
                maxValue: 28,
                minStep: 0.5,
            })
            .on('get', this.getCurrentTemperature.bind(this));

        this.service.getCharacteristic(hap.Characteristic.TargetTemperature)
            .setValue(this.targetTemperature)
            .setProps({
                minValue: 4,
                maxValue: 28,
                minStep: 0.5,
            })
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this));

        this.service.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
            .setValue(hap.Characteristic.TemperatureDisplayUnits.CELSIUS)
            .on('get', this.getTemperatureDisplayUnits.bind(this));

        this.service.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
            .setValue(50);

        // TODO configure interval
        setInterval(this.update.bind(this), 10000);
    }

    getCurrentHeatingCoolingState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentHeatingCoolingState()', this.accessory.displayName, this.thermostat.did);
        }
        callback(null, this.currentState);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getCurrentHeatingCoolingState(): error=%s', this.accessory.displayName, this.thermostat.did, err);
                return;
            }
            if (data?.statusesMap?.relaisstatus !== undefined) {
                this.currentState = data.statusesMap.relaisstatus;
            } else {
                this.currentState = hap.Characteristic.CurrentHeatingCoolingState.HEAT;
            }
            if (this.debug) {
                this.log('%s [%s] - getCurrentHeatingCoolingState(): current state is %d', this.accessory.displayName, this.thermostat.did, this.currentState);
            }
            this.service.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState).updateValue(this.currentState);
        });
    }

    getCurrentTemperature(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentTemperature()', this.accessory.displayName, this.thermostat.did);
        }
        callback(null, this.currentTemperature);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getCurrentTemperature(): error=%s', this.accessory.displayName, this.thermostat.did, err);
                return;
            }
            this.currentTemperature = tools.duofernTemp2HomekitTemp(data?.statusesMap?.acttemperatur as number);
            if (this.debug) {
                this.log('%s [%s] - getCurrentTemperature(): current temperature is %d', this.accessory.displayName, this.thermostat.did, this.currentTemperature);
            }
            this.service.getCharacteristic(hap.Characteristic.CurrentTemperature).updateValue(this.currentTemperature);
        });
    }

    getTargetTemperature(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getTargetTemperature()', this.accessory.displayName, this.thermostat.did);
        }
        callback(null, this.targetTemperature);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getTargetTemperature(): error=%s', this.accessory.displayName, this.thermostat.did, err);
                return;
            }
            this.targetTemperature = tools.duofernTemp2HomekitTemp(data?.statusesMap?.Position as number);
            if (this.debug) {
                this.log('%s [%s] - getTargetTemperature(): target temperature is %d', this.accessory.displayName, this.thermostat.did, this.targetTemperature);
            }
            this.service.getCharacteristic(hap.Characteristic.TargetTemperature).updateValue(this.targetTemperature);
        });
    }

    setTargetTemperature(temperature: CharacteristicValue, callback: (error?: Error | null) => void): void {
        if (this.debug) {
            this.log('%s [%s] - setTargetTemperature(%d)', this.accessory.displayName, this.thermostat.did, temperature);
        }
        callback(null);
        const params = { name: 'TARGET_TEMPERATURE_CFG', value: temperature };
        this.session.put('/devices/' + this.thermostat.did, params, 30000, (err) => {
            if (err) {
                this.log('%s [%s] - setTargetTemperature(): error=%s', this.accessory.displayName, this.thermostat.did, err);
                return;
            }
            this.targetTemperature = temperature as number;
            this.service.getCharacteristic(hap.Characteristic.TargetTemperature).updateValue(this.targetTemperature);
        });
    }

    getTargetHeatingCoolingState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getTargetHeatingCoolingState()', this.accessory.displayName, this.thermostat.did);
        }
        return callback(null, hap.Characteristic.TargetHeatingCoolingState.HEAT);
    }

    setTargetHeatingCoolingState(state: CharacteristicValue, callback: (error?: Error | null) => void): void {
        if (this.debug) {
            this.log('%s [%s] - setTargetHeatingCoolingState(%s) (ignored)', this.accessory.displayName, this.thermostat.did, state);
        }
        return callback(null);
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.thermostat.did);
        }

        // Thermostat
        this.getCurrentTemperature((err, temp) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentTemperature(): error=%s', this.accessory.displayName, this.thermostat.did, err);
            } else if (temp === null) {
                this.log('%s [%s] - update().getCurrentTemperature(): got null temp', this.accessory.displayName, this.thermostat.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentTemperature(): temp=%s', this.accessory.displayName, this.thermostat.did, temp);
                }
            }
        });

        this.getTargetTemperature((err, temp) => {
            if (err) {
                this.log('%s [%s] - update().getTargetTemperature(): error=%s', this.accessory.displayName, this.thermostat.did, err);
            } else if (temp === null) {
                this.log('%s [%s] - update().getTargetTemperature(): got null target temp', this.accessory.displayName, this.thermostat.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getTargetTemperature(): temp=%s', this.accessory.displayName, this.thermostat.did, temp);
                }
            }
        });

        this.getCurrentHeatingCoolingState((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentHeatingCoolingState(): error=%s', this.accessory.displayName, this.thermostat.did, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getCurrentHeatingCoolingState(): got null state', this.accessory.displayName, this.thermostat.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentHeatingCoolingState(): state=%s', this.accessory.displayName, this.thermostat.did, state);
                }
            }
        });
    }

    getTemperatureDisplayUnits(callback: GetCallback): void {
        callback(null, hap.Characteristic.TemperatureDisplayUnits.CELSIUS);
    }

    getServices(): Service[] {
        return [this.service];
    }
}
