import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { DevicesResponse, HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherDoorSensorAccessory extends RademacherAccessory {
    private readonly sensor: HomePilotItem;
    private readonly services: Service[];
    private currentState: boolean;
    private currentBatteryLevel: number;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sensor: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sensor, session);
        this.sensor = sensor;
        this.services = [];
        // contact sensor
        this.currentState = this.sensor.readings?.contact_state !== 'closed';
        const contactsensorService = this.accessory.getService(hap.Service.ContactSensor)!;
        contactsensorService.getCharacteristic(hap.Characteristic.ContactSensorState)
            .setValue(this.currentState)
            .on('get', this.getCurrentDoorState.bind(this));
        this.services.push(contactsensorService);
        // battery
        this.currentBatteryLevel = this.sensor.batteryStatus ?? 0;
        const batteryService = this.accessory.getService(hap.Service.Battery)!;
        batteryService.getCharacteristic(hap.Characteristic.BatteryLevel)
            .setValue(this.currentBatteryLevel)
            .on('get', this.getCurrentBatteryLevel.bind(this));
        this.services.push(batteryService);
        // TODO configure interval
        setInterval(this.update.bind(this), 10000);
    }

    getCurrentDoorState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentDoorState()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentState);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentDoorState(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentDoorState(): readings=%s', this.accessory.displayName, this.sensor.did, data.readings);
                    }
                    const contactState = data.readings?.contact_state;
                    const closed = contactState === 'closed';
                    this.currentState = !closed;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentDoorState(): open=%s', this.accessory.displayName, this.sensor.did, this.currentState);
                    }
                    const contactsensorService = this.accessory.getService(hap.Service.ContactSensor)!;
                    contactsensorService.getCharacteristic(hap.Characteristic.ContactSensorState).updateValue(this.currentState);
                }
            });
        });
    }

    getCurrentBatteryLevel(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentBatteryLevel()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentBatteryLevel);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentBatteryLevel(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.currentBatteryLevel = data.batteryStatus ?? 0;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentBatteryLevel(): battery status=%s', this.accessory.displayName, this.sensor.did, this.currentBatteryLevel);
                    }
                    const batteryService = this.accessory.getService(hap.Service.Battery)!;
                    batteryService.getCharacteristic(hap.Characteristic.BatteryLevel).updateValue(this.currentBatteryLevel);
                }
            });
        });
    }

    getServices(): Service[] {
        return this.services;
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.sensor.did);
        }

        // contact state
        this.getCurrentDoorState((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentDoorState(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getCurrentDoorState(): got null state', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentDoorState(): open=%s', this.accessory.displayName, this.sensor.did, state);
                }
            }
        });

        // battery level
        this.getCurrentBatteryLevel((err, level) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentBatteryLevel(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (level === null) {
                this.log('%s [%s] - update().getCurrentBatteryLevel(): got null battery level', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentBatteryLevel(): level=%s', this.accessory.displayName, this.sensor.did, level);
                }
            }
        });
    }
}
