import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherDimmerAccessory extends RademacherAccessory {
    private readonly dimmer: HomePilotItem;
    private lastBrightness: number;
    private currentBrightness: number;
    private currentStatus: boolean;
    private lastStatus: boolean;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, dimmer: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, dimmer, session);
        this.dimmer = dimmer;
        let position = 0;
        if (this.dimmer.statusesMap && this.dimmer.statusesMap.Position !== undefined) {
            position = this.dimmer.statusesMap.Position;
        } else {
            this.log('RademacherDimmerAccessory(): no position in dimmer object %o', dimmer);
        }
        if (this.debug) {
            this.log('%s [%s] - RademacherDimmerAccessory(): initial position=%s', accessory.displayName, dimmer.did, position);
        }
        this.lastBrightness = position;
        this.currentBrightness = this.lastBrightness;
        this.currentStatus = position > 0;
        this.lastStatus = this.currentStatus;
        this.service = this.getOrAddService(hap.Service.Lightbulb, this.accessory.displayName);
        this.service.getCharacteristic(hap.Characteristic.On)
            .on('get', this.getStatus.bind(this))
            .on('set', this.setStatus.bind(this));
        this.service.getCharacteristic(hap.Characteristic.Brightness)
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));
        // TODO configure interval
        setInterval(this.update.bind(this), 30000);
    }

    getStatus(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getStatus()', this.accessory.displayName, this.dimmer.did);
        }
        callback(null, this.currentStatus);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - error in getStatus(): %s', this.accessory.displayName, this.dimmer.did, err);
                return;
            }
            const pos = data?.statusesMap?.Position as number;
            if (this.debug) {
                this.log('%s [%s] - getStatus(): brightness=%s', this.accessory.displayName, this.dimmer.did, pos);
            }
            this.currentStatus = pos > 0;
            this.lastStatus = this.currentStatus;
            this.service.getCharacteristic(hap.Characteristic.On).updateValue(this.currentStatus);
        });
    }

    setStatus(status: CharacteristicValue, callback: (error?: Error | null) => void): void {
        if (this.debug) {
            this.log('%s [%s] - setStatus(%s)', this.accessory.displayName, this.dimmer.did, status);
        }
        callback(null);
        const changed = (status !== this.lastStatus);
        if (this.debug) {
            this.log('%s [%s] - setStatus(): dimmer changed=%s', this.accessory.displayName, this.dimmer.did, changed);
        }
        if (changed) {
            this.log('%s [%s] - setStatus(): changed from %s to %s', this.accessory.displayName, this.dimmer.did, this.lastStatus, status);
            const params = { name: this.lastStatus ? 'TURN_OFF_CMD' : 'TURN_ON_CMD' };
            this.session.put('/devices/' + this.dimmer.did, params, 30000, (err) => {
                if (err) {
                    this.log('%s [%s] - setStatus(): error=%s', this.accessory.displayName, this.dimmer.did, err);
                    return;
                }
                this.currentStatus = status as boolean;
                this.lastStatus = this.currentStatus;
                this.service.getCharacteristic(hap.Characteristic.On).updateValue(this.currentStatus);
            });
        }
    }

    getBrightness(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getBrightness()', this.accessory.displayName, this.dimmer.did);
        }
        callback(null, this.currentBrightness);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getBrightness(): error=%s', this.accessory.displayName, this.dimmer.did, err);
                return;
            }
            const pos = data?.statusesMap?.Position as number;
            if (this.debug) {
                this.log('%s [%s] - getBrightness(): brightness=%s', this.accessory.displayName, this.dimmer.did, pos);
            }
            this.currentBrightness = pos;
            this.lastBrightness = this.currentBrightness;
            this.service.getCharacteristic(hap.Characteristic.Brightness).updateValue(this.currentBrightness);
        });
    }

    setBrightness(brightness: CharacteristicValue, callback: (error?: Error | null) => void): void {
        if (this.debug) {
            this.log('%s [%s] - setBrightness(%s)', this.accessory.displayName, this.dimmer.did, brightness);
        }
        callback(null);
        const changed = (brightness !== this.lastBrightness);
        if (changed) {
            this.log('%s  [%s] - setBrightness(): brightness changed from %s to %s', this.accessory.displayName, this.dimmer.did, this.lastBrightness, brightness);
            const params = { name: 'GOTO_POS_CMD', value: brightness };
            this.session.put('/devices/' + this.dimmer.did, params, 30000, (err) => {
                if (err) {
                    this.log('%s [%s] - setBrightness(): error=%s', this.accessory.displayName, this.dimmer.did, err);
                    return;
                }
                this.currentBrightness = brightness as number;
                this.lastBrightness = this.currentBrightness;
                this.service.getCharacteristic(hap.Characteristic.Brightness).updateValue(this.currentBrightness);
            });
        }
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.dimmer.did);
        }

        // Status
        this.getStatus((err, status) => {
            if (err) {
                this.log('%s [%s] update().getStatus(): error=%s', this.accessory.displayName, this.dimmer.did, err);
            } else if (status === null) {
                this.log('%s [%s] update().getStatus(): got null', this.accessory.displayName, this.dimmer.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getStatus(): new status=%s', this.accessory.displayName, this.dimmer.did, status);
                }
            }
        });

        // Brightness
        this.getBrightness((err, brightness) => {
            if (err) {
                this.log('%s [%s] update().getBrightness(): error=%s', this.accessory.displayName, this.dimmer.did, err);
            } else if (brightness === null) {
                this.log('%s [%s] update().getBrightness(): got null', this.accessory.displayName, this.dimmer.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getBrightness(): new brightness=%s', this.accessory.displayName, this.dimmer.did, brightness);
                }
            }
        });
    }

    getServices(): Service[] {
        return [this.service];
    }
}
