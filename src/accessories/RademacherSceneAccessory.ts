import type { CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import { RademacherAccessory } from './RademacherAccessory';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

type GetCallback = (error: Error | null, value?: CharacteristicValue | null) => void;

export class RademacherSceneAccessory extends RademacherAccessory {
    private readonly scene: HomePilotItem;
    private readonly service: Service;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, scene: HomePilotItem, session: RademacherHomePilotSession) {
        super(log, debug, accessory, scene, session);

        this.scene = scene;

        this.debug = true;

        this.service = this.getOrAddService(hap.Service.Switch, this.accessory.displayName);

        this.service
            .getCharacteristic(hap.Characteristic.On).setValue(false)
            .on('set', this.setCurrentState.bind(this))
            .on('get', this.getCurrentState.bind(this));
    }

    getCurrentState(callback: GetCallback): void {
        callback(null, false);
    }

    setCurrentState(value: CharacteristicValue, callback: (error?: Error | null) => void): void {
        this.log('%s [%s] - setCurrentState(%s)', this.accessory.displayName, this.scene.sid, value);
        callback(null);
        if (value) {
            const params = { request_type: 'EXECUTESCENE', trigger_event: 'TRIGGER_SCENE_MANUALLY_EVT' };
            this.log('%s [%s] - executing scene', this.accessory.displayName, this.scene.sid);
            this.service.getCharacteristic(hap.Characteristic.On).updateValue(true);
            this.session.post('/scenes/' + this.scene.sid + '/actions', params, 30000, (err) => {
                this.service.getCharacteristic(hap.Characteristic.On).updateValue(false);
                if (err) {
                    this.log('%s [%s] - setCurrentState(): error=%s', this.accessory.displayName, this.scene.sid, err);
                    return;
                }
            });
        }
    }

    update(): void {
        // Switch state
        this.getCurrentState((err, state) => {
            if (err) {
                this.log('%s [%s] - update().getCurrentState(): error=%s', this.accessory.displayName, this.scene.sid, err);
            } else if (state === null) {
                this.log('%s [%s] - update().getCurrentState(): null state', this.accessory.displayName, this.scene.sid);
            } else {
                if (this.debug) {
                    this.log('%s [%s] - update().getCurrentState(): new state=%s', this.accessory.displayName, this.scene.sid, state);
                }
            }
        });
    }
}
