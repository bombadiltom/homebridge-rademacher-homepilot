import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherSwitchAccessory extends RademacherAccessory {
    private readonly sw: HomePilotItem;
    private lastState: boolean;
    private currentState: boolean;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, sw: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, sw, session);
        this.sw = sw;
        this.lastState = this.sw.statusesMap?.Position === 100;
        this.currentState = this.sw.statusesMap?.Position === 100;
        if (this.debug) {
            this.log('%s [%s] - RademacherSwitchAccessory(): initial state=%s', this.accessory.displayName, this.sw.did, this.currentState);
        }
        this.service = this.accessory.getService(hap.Service.Switch)!;
        this.service
            .getCharacteristic(hap.Characteristic.On)
            .setValue(this.currentState)
            .on('set', this.setCurrentState.bind(this))
            .on('get', this.getCurrentState.bind(this));
        // TODO configure interval
        setInterval(this.update.bind(this), 10000);
    }

    getCurrentState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getCurrentState()', this.accessory.displayName, this.sw.did);
        }
        callback(null, this.currentState);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getCurrentState(): error=%s', this.accessory.displayName, this.sw.did, err);
                return;
            }
            const position = data ? data.statusesMap?.Position : 0;
            this.currentState = position === 100;
            this.lastState = this.currentState;
            if (this.debug) {
                this.log('%s [%s] - getCurrentState(): position=%s, state=%s', this.accessory.displayName, this.sw.did, position, this.currentState);
            }
            this.service.getCharacteristic(hap.Characteristic.On).updateValue(this.currentState);
        });
    }

    setCurrentState(value: CharacteristicValue, callback: (error?: Error | null) => void): void {
        if (this.debug) {
            this.log('%s [%s] - setCurrentState(%s)', this.accessory.displayName, this.sw.did, value);
        }
        callback(null);
        const changed = (value !== this.lastState);
        if (this.debug) {
            this.log('%s [%s] - setCurrentState(): switch changed=%s, lastState=%s', this.accessory.displayName, this.sw.did, changed, this.lastState);
        }
        if (changed) {
            const params = { name: this.lastState ? 'TURN_OFF_CMD' : 'TURN_ON_CMD' };
            this.session.put('/devices/' + this.sw.did, params, 30000, (err) => {
                if (err) {
                    this.log('%s [%s] - setCurrentState(): error=%s', this.accessory.displayName, this.sw.did, err);
                    return;
                }
                this.currentState = value as boolean;
                this.lastState = this.currentState;
                this.service.getCharacteristic(hap.Characteristic.On).updateValue(this.currentState);
            });
        }
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.sw.did);
        }
        // Switch state
        this.getCurrentState((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentState(): error=%s', this.accessory.displayName, this.sw.did, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getCurrentState(): got null state', this.accessory.displayName, this.sw.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentState(): state=%s', this.accessory.displayName, this.sw.did, state);
                }
            }
        });
    }
}
