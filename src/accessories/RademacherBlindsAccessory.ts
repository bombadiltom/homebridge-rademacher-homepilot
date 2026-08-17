import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import * as tools from '../tools';
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherBlindsAccessory extends RademacherAccessory {
    private readonly blind: HomePilotItem;
    private readonly inverted: boolean;
    private lastPosition: number;
    private currentTargetPosition: number;
    private obstructionDetected: boolean;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, blind: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, blind, session);
        this.blind = blind;
        this.inverted = this.blind.iconSet?.k !== 'iconset7';
        let position = 0;
        if (this.blind.statusesMap && this.blind.statusesMap.Position !== undefined) {
            position = this.blind.statusesMap.Position;
        } else {
            this.log('no position in blind object %o', blind);
        }
        this.lastPosition = this.inverted ? tools.reversePercentage(position) : position;
        this.currentTargetPosition = this.lastPosition;
        this.obstructionDetected = false;
        this.service = this.getOrAddService(hap.Service.WindowCovering, this.accessory.displayName);
        this.service
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .setValue(this.currentTargetPosition)
            .on('get', this.getTargetPosition.bind(this));
        this.service
            .getCharacteristic(hap.Characteristic.TargetPosition)
            .setValue(this.currentTargetPosition)
            .on('get', this.getTargetPosition.bind(this))
            .on('set', this.setTargetPosition.bind(this));
        this.service.getCharacteristic(hap.Characteristic.PositionState)
            .setValue(hap.Characteristic.PositionState.STOPPED)
            .on('get', this.getPositionState.bind(this));
        this.service.getCharacteristic(hap.Characteristic.ObstructionDetected)
            .setValue(!!this.blind.hasErrors)
            .on('get', this.getObstructionDetected.bind(this));
        // TODO configure interval
        setInterval(this.update.bind(this), 20000);
    }

    setTargetPosition(value: CharacteristicValue, callback: (error?: Error | null) => void): void {
        callback(null);
        this.log('%s [%s] - setTargetPosition(%s)', this.accessory.displayName, this.blind.did, value);
        const target = this.inverted ? tools.reversePercentage(value as number) : value as number;
        const params = { name: 'GOTO_POS_CMD', value: target };
        this.session.put('/devices/' + this.blind.did, params, 30000, (err) => {
            if (err) {
                this.log('%s [%s] - setTargetPosition(): error=%s', this.accessory.displayName, this.blind.did, err);
                return;
            }
            this.currentTargetPosition = value as number;
            this.lastPosition = this.currentTargetPosition;
            this.service.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentTargetPosition);
            this.service.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.currentTargetPosition);
        });
    }

    getTargetPosition(callback: GetCallback): void {
        callback(null, this.currentTargetPosition);
        if (this.debug) {
            this.log('%s [%s] - getTargetPosition(): position=%s', this.accessory.displayName, this.blind.did, this.currentTargetPosition);
        }
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getTargetPosition(): error=%s', this.accessory.displayName, this.blind.did, err);
                return;
            }
            if (data && data.statusesMap) {
                const map = data.statusesMap;
                const pos = this.inverted ? tools.reversePercentage(map.Position as number) : map.Position as number;
                if (this.debug) {
                    this.log('%s [%s] - getTargetPosition(): current target=%s', this.accessory.displayName, this.blind.did, pos);
                }
                this.currentTargetPosition = pos;
                this.lastPosition = this.currentTargetPosition;
                this.service.getCharacteristic(hap.Characteristic.TargetPosition).updateValue(this.currentTargetPosition);
                this.service.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.currentTargetPosition);
            } else {
                this.log('%s [%s] - no current target in %o', this.accessory.displayName, this.blind.did, data);
            }
        });
    }

    getPositionState(callback: GetCallback): void {
        callback(null, hap.Characteristic.PositionState.STOPPED);
    }

    getObstructionDetected(callback: GetCallback): void {
        callback(null, this.obstructionDetected);
        if (this.debug) {
            this.log('%s [%s] - getObstructionDetected()', this.accessory.displayName, this.blind.did);
        }
        this.getDevice((err, data) => {
            if (err) {
                this.log('%s [%s] - getObstructionDetected(): error=%s', this.accessory.displayName, this.blind.did, err);
                return;
            }
            if (data && data.hasErrors !== undefined) {
                if (this.debug) {
                    this.log('%s [%s] - getObstructionDetected(): hasErrors=%s', this.accessory.displayName, this.blind.did, data.hasErrors);
                }
                this.obstructionDetected = !!data.hasErrors;
                this.service.getCharacteristic(hap.Characteristic.ObstructionDetected).updateValue(this.obstructionDetected);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - getObstructionDetected(): could not detect obstruction from %o', this.accessory.displayName, this.blind.did, data);
                }
            }
        });
    }

    update(): void {
        if (this.debug) {
            this.log('%s - [%s] update()', this.accessory.displayName, this.blind.did);
        }

        // Position
        this.getTargetPosition((err, pos) => {
            if (err) {
                this.log('%s [%s] - update().getTargetPosition(): error=%s', this.accessory.displayName, this.blind.did, err);
            } else if (pos === null) {
                this.log('%s [%s] - update().getTargetPosition(): got null position', this.accessory.displayName, this.blind.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getTargetPosition(): new position=%s', this.accessory.displayName, this.blind.did, pos);
                }
            }
        });

        // Obstruction
        this.getObstructionDetected((err, obstructionDetected) => {
            if (err) {
                this.log('%s [%s] - update().getObstructionDetected(): error=%s', this.accessory.displayName, this.blind.did, err);
            } else if (obstructionDetected === null) {
                this.log('%s [%s] - update().getObstructionDetected(): got null', this.accessory.displayName, this.blind.did);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getObstructionDetected(): obstructionDetected=%s', this.accessory.displayName, this.blind.did, obstructionDetected);
                }
            }
        });
    }
}
