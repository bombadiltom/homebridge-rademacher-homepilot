import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import { SENSOR_LIST_CACHE_TTL_MS, type RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { DevicesResponse, HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherSunSensorAccessory extends RademacherAccessory {
    private readonly sensor: HomePilotItem;
    private readonly services: Service[];
    private currentSunState: number;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sensor: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sensor, session);
        this.sensor = sensor;
        this.services = [];
        // Light sensor
        this.currentSunState = this.sensor.readings?.sun_detected ? 100000 : 0.0001;
        const lightSensorService = this.getOrAddService(hap.Service.LightSensor, this.accessory.displayName);
        lightSensorService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
            .setProps({ minValue: 0.0001, maxValue: 100000 })
            .setValue(this.currentSunState)
            .on('get', this.getCurrentSunState.bind(this));
        this.services.push(lightSensorService);
        // Switch (ambient light level characteristic of light sensor cannot yet be used as trigger in HomeKit)
        const switchService = this.getOrAddService(hap.Service.Switch, this.accessory.displayName);
        switchService.getCharacteristic(hap.Characteristic.On)
            .setValue(!!this.sensor.readings?.sun_detected);
        this.services.push(switchService);
        setInterval(this.update.bind(this), 10000);
    }

    getCurrentSunState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentSunState()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentSunState);
        this.session.getCached('/v4/devices?devtype=Sensor', 30000, SENSOR_LIST_CACHE_TTL_MS, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentSunState(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    const sunDetected = !!data.readings?.sun_detected;
                    this.currentSunState = sunDetected ? 100000 : 0.0001;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentSunState(): sun_detected=%s, state=%s', this.accessory.displayName, this.sensor.did, sunDetected, this.currentSunState);
                    }
                    // Update LightSensor state
                    const lightSensorService = this.accessory.getService(hap.Service.LightSensor)!;
                    lightSensorService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).updateValue(this.currentSunState);
                    // Update Switch state
                    const switchService = this.accessory.getService(hap.Service.Switch)!;
                    switchService.getCharacteristic(hap.Characteristic.On).updateValue(sunDetected);
                }
            });
        });
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.sensor.did);
        }
        this.getCurrentSunState((err, sunState) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentSunState(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (sunState === null) {
                this.log('%s [%s] - update().getCurrentSunState(): got null state', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentSunState(): state=%s', this.accessory.displayName, this.sensor.did, sunState);
                }
            }
        });
    }

    getServices(): Service[] {
        return this.services;
    }
}
