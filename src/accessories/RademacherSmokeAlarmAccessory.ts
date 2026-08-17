import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { DevicesResponse, HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherSmokeAlarmAccessory extends RademacherAccessory {
    private readonly sensor: HomePilotItem;
    private readonly services: Service[];
    private smokeDetected: boolean;
    private currentBatteryLevel: number;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sensor: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sensor, session);
        this.sensor = sensor;
        this.services = [];
        // smoke
        this.smokeDetected = !!this.sensor.readings?.smoke_detected;
        const smokesensorService = this.getOrAddService(hap.Service.SmokeSensor, this.accessory.displayName);
        smokesensorService.getCharacteristic(hap.Characteristic.SmokeDetected)
            .setValue(this.smokeDetected)
            .on('get', this.getSmokeDetected.bind(this));
        this.services.push(smokesensorService);
        // battery
        this.currentBatteryLevel = this.sensor.batteryStatus ?? 0;
        const batteryService = this.getOrAddService(hap.Service.Battery, this.accessory.displayName);
        batteryService.getCharacteristic(hap.Characteristic.BatteryLevel)
            .setValue(this.currentBatteryLevel)
            .on('get', this.getCurrentBatteryLevel.bind(this));
        this.services.push(batteryService);
        // TODO configure interval
        setInterval(this.update.bind(this), 10000);
    }

    getSmokeDetected(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getSmokeDetected()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.smokeDetected);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getSmokeDetected(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.smokeDetected = !!data.readings?.smoke_detected;
                    if (this.debug) {
                        this.log('%s [%s] - getSmokeDetected(): smoke detected=%s', this.accessory.displayName, this.sensor.did, this.smokeDetected);
                    }
                    const smokesensorService = this.accessory.getService(hap.Service.SmokeSensor)!;
                    smokesensorService.getCharacteristic(hap.Characteristic.SmokeDetected).updateValue(this.smokeDetected);
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
                        this.log('%s [%s] - getCurrentBatteryLevel(): battery status = %s', this.accessory.displayName, this.sensor.did, this.currentBatteryLevel);
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
        // smoke
        this.getSmokeDetected((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getSmokeDetected(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getSmokeDetected(): got null state', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getSmokeDetected(): smoke detected = %s', this.accessory.displayName, this.sensor.did, state);
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
