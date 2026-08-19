import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import { SENSOR_LIST_CACHE_TTL_MS, type RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { DevicesResponse, HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherTemperatureSensorAccessory extends RademacherAccessory {
    private readonly sensor: HomePilotItem;
    private currentTemperature: number;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sensor: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sensor, session);

        this.sensor = sensor;
        this.currentTemperature = sensor.readings?.temperature_primary ?? 0;

        this.service = this.getOrAddService(hap.Service.TemperatureSensor, this.accessory.displayName);
        this.service.getCharacteristic(hap.Characteristic.CurrentTemperature)
            .setProps({ minValue: -30.0, maxValue: 80.0 })
            .setValue(this.currentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));
    }

    getCurrentTemperature(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getting current temperature', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentTemperature);

        this.session.getCached('/v4/devices?devtype=Sensor', 30000, SENSOR_LIST_CACHE_TTL_MS, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentTemperature(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.currentTemperature = data.readings?.temperature_primary ?? 0;
                    if (this.debug) {
                        this.log('%s [%s] - temperature is %s', this.accessory.displayName, this.sensor.did, this.currentTemperature);
                    }
                    this.service.getCharacteristic(hap.Characteristic.CurrentTemperature).updateValue(this.currentTemperature);
                }
            });
        });
    }

    getServices(): Service[] {
        return [this.service];
    }
}
