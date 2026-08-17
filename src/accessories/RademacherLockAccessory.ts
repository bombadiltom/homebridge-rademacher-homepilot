import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherLockAccessory extends RademacherAccessory {
    private readonly lock: HomePilotItem;
    private readonly lockservice: Service;
    private currentState: number;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, lock: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, lock, session);
        this.lock = lock;
        this.lockservice = this.getOrAddService(hap.Service.LockMechanism, accessory.displayName);

        this.currentState = lock.statusesMap?.Position === 0
            ? hap.Characteristic.LockCurrentState.SECURED
            : hap.Characteristic.LockCurrentState.UNSECURED;
        if (this.debug) {
            this.log('%s [%s] - RademacherLockAccessory(): initial state=%s', this.accessory.displayName, this.lock.did, this.currentState);
        }

        this.lockservice
            .getCharacteristic(hap.Characteristic.LockCurrentState)
            .setValue(this.currentState)
            .on('get', this.getState.bind(this));

        this.lockservice
            .getCharacteristic(hap.Characteristic.LockTargetState)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        // TODO configure interval
        setInterval(this.update.bind(this), 60000);
    }

    getState(callback: GetCallback): void {
        if (this.debug) {
            this.log('%s [%s] - getState()', this.accessory.displayName, this.lock.did);
        }
        callback(null, this.currentState);
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getState(): error=%s', this.accessory.displayName, this.lock.did, err);
                return;
            }
            const position = data?.statusesMap?.Position;
            this.currentState = position === 0
                ? hap.Characteristic.LockCurrentState.SECURED
                : hap.Characteristic.LockCurrentState.UNSECURED;
            if (this.debug) {
                this.log('%s [%s] - getState(): position=%s, state=%s', this.accessory.displayName, this.lock.did, position, this.currentState);
            }
            this.lockservice.getCharacteristic(hap.Characteristic.LockCurrentState).updateValue(this.currentState);
            this.lockservice.getCharacteristic(hap.Characteristic.LockTargetState).updateValue(this.currentState);
        });
    }

    setState(state: CharacteristicValue, callback: (error?: Error | null) => void): void {
        this.log('%s [%s] - setState(%s)', this.accessory.displayName, this.lock.did, state);
        callback(null);
        this.lockservice.getCharacteristic(hap.Characteristic.LockCurrentState).updateValue(hap.Characteristic.LockCurrentState.UNSECURED);
        this.lockservice.getCharacteristic(hap.Characteristic.LockTargetState).updateValue(hap.Characteristic.LockTargetState.UNSECURED);
        const params = { name: 'TURN_ON_CMD' };
        this.session.put('/devices/' + this.lock.did, params, 30000, (err) => {
            // always lock again
            this.lockservice.getCharacteristic(hap.Characteristic.LockCurrentState).updateValue(hap.Characteristic.LockCurrentState.SECURED);
            this.lockservice.getCharacteristic(hap.Characteristic.LockTargetState).updateValue(hap.Characteristic.LockTargetState.SECURED);
            if (err) {
                this.log('%s [%s] - setState(): error=%s', this.accessory.displayName, this.lock.did, err);
                return;
            }
        });
    }

    update(): void {
        if (this.debug) {
            this.log('%s [%s] - update()', this.accessory.displayName, this.lock.did);
        }

        // lock state
        this.getState((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getState(): error=%s', this.accessory.displayName, this.lock.did, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getState(): got null state', this.accessory.displayName, this.lock.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getState(): state=%s', this.accessory.displayName, this.lock.did, state);
                }
            }
        });
    }

    getServices(): Service[] {
        return [this.lockservice];
    }
}
