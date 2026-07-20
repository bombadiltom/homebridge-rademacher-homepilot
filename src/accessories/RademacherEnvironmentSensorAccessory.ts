import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { DevicesResponse, HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherEnvironmentSensorAccessory extends RademacherAccessory {
    private readonly sensor: HomePilotItem;
    private readonly services: Service[];
    private currentTemperature: number;
    private currentAmbientLightLevel: number;
    private currentRainState: boolean;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sensor: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sensor, session);
        this.sensor = sensor;
        this.services = [];
        // temperature sensor
        this.currentTemperature = sensor.readings?.temperature_primary ?? 0;
        const temperatureService = this.accessory.getService(hap.Service.TemperatureSensor)!;
        temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature)
            .setProps({ minValue: -30.0, maxValue: 80.0 })
            .setValue(this.currentTemperature)
            .on('get', this.getCurrentTemperature.bind(this));
        this.services.push(temperatureService);
        // light sensor
        this.currentAmbientLightLevel = sensor.readings?.sun_brightness ?? 0;
        const lightService = this.accessory.getService(hap.Service.LightSensor)!;
        lightService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
            .setProps({ minValue: 0, maxValue: 150000 })
            .setValue(this.currentAmbientLightLevel)
            .on('get', this.getCurrentAmbientLightLevel.bind(this));
        this.services.push(lightService);
        // Rain sensor
        this.currentRainState = !!this.sensor.readings?.rain_detected;
        const rainsensorService = this.accessory.getService(hap.Service.ContactSensor)!;
        rainsensorService.getCharacteristic(hap.Characteristic.ContactSensorState)
            .setValue(this.currentRainState)
            .on('get', this.getCurrentRainState.bind(this));
        this.services.push(rainsensorService);

        // TODO configure interval
        setInterval(this.update.bind(this), 10000);
    }

    getCurrentTemperature(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentTemperature()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentTemperature);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentTemperature(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.currentTemperature = data.readings?.temperature_primary ?? 0;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentTemperature(): temperature=%s', this.accessory.displayName, this.sensor.did, this.currentTemperature);
                    }
                    const temperatureService = this.accessory.getService(hap.Service.TemperatureSensor)!;
                    temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature).updateValue(this.currentTemperature);
                }
            });
        });
    }

    getCurrentRainState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentRainState()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentRainState);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentRainState(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.currentRainState = !!data.readings?.rain_detected;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentRainState(): rain_detected=%s', this.accessory.displayName, this.sensor.did, this.currentRainState);
                    }
                    const rainsensorService = this.accessory.getService(hap.Service.ContactSensor)!;
                    rainsensorService.getCharacteristic(hap.Characteristic.ContactSensorState).updateValue(this.currentRainState);
                }
            });
        });
    }

    getCurrentAmbientLightLevel(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentAmbientLightLevel()', this.accessory.displayName, this.sensor.did);
        }
        callback(null, this.currentAmbientLightLevel);
        this.session.get('/v4/devices?devtype=Sensor', 30000, (err, body: DevicesResponse) => {
            if (err) {
                this.log('%s [%s] - getCurrentAmbientLightLevel(): error=%s', this.accessory.displayName, this.sensor.did, err);
                return;
            }
            body.meters?.forEach((data) => {
                if (data.did === this.sensor.did) {
                    this.currentAmbientLightLevel = data.readings?.sun_brightness ?? 0;
                    if (this.debug) {
                        this.log('%s [%s] - getCurrentAmbientLightLevel(): sun_brightness=%s', this.accessory.displayName, this.sensor.did, this.currentAmbientLightLevel);
                    }
                    const lightService = this.accessory.getService(hap.Service.LightSensor)!;
                    lightService.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel).updateValue(this.currentAmbientLightLevel);
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

        this.getCurrentTemperature((err, temperature) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentTemperature(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (temperature === null) {
                this.log('%s [%s] - update().getCurrentTemperature(): got null temperature', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentTemperature(): temperature=%s', this.accessory.displayName, this.sensor.did, temperature);
                }
            }
        });

        this.getCurrentAmbientLightLevel((err, level) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentAmbientLightLevel(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (level === null) {
                this.log('%s [%s] - update().getCurrentAmbientLightLevel(): got null level', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentAmbientLightLevel(): level=%s', this.accessory.displayName, this.sensor.did, level);
                }
            }
        });

        this.getCurrentRainState((err, rainDetected) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentRainState(): error=%s', this.accessory.displayName, this.sensor.did, err);
            } else if (rainDetected === null) {
                this.log('%s [%s] - update().getCurrentRainState(): got null state', this.accessory.displayName, this.sensor.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentRainState(): state=%s', this.accessory.displayName, this.sensor.did, rainDetected);
                }
            }
        });
    }
}
