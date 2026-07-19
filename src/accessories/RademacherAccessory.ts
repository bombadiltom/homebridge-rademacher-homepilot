import type { Logging, PlatformAccessory } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

export type DeviceCallback = (error: Error | null, device?: HomePilotItem | null) => void;

export class RademacherAccessory {
    readonly accessory: PlatformAccessory;
    readonly log: Logging;
    debug: boolean;
    readonly session: RademacherHomePilotSession;
    readonly did?: number;
    protected lastUpdate = 0;
    protected device: HomePilotItem | null = null;

    constructor(log: Logging, debug: boolean, accessory: PlatformAccessory, data: HomePilotItem, session: RademacherHomePilotSession) {
        const info = accessory.getService(hap.Service.AccessoryInformation)!;

        accessory.context.manufacturer = 'Rademacher';
        info.setCharacteristic(hap.Characteristic.Manufacturer, String(accessory.context.manufacturer));

        if (data.deviceNumber) {
            accessory.context.model = data.deviceNumber;
            info.setCharacteristic(hap.Characteristic.Model, String(accessory.context.model));
        }

        if (data.uid) {
            accessory.context.serial = data.uid;
        } else if (data.sid) {
            accessory.context.serial = data.sid;
        }
        if (accessory.context.serial !== undefined) {
            info.setCharacteristic(hap.Characteristic.SerialNumber, String(accessory.context.serial));
        }

        accessory.context.revision = 1; //data.version;
        info.setCharacteristic(hap.Characteristic.FirmwareRevision, String(accessory.context.revision));

        this.accessory = accessory;
        this.log = log;
        this.debug = debug;
        this.session = session;
        this.did = data.did;
    }

    getDevice(callback: DeviceCallback): void {
        if (this.lastUpdate < Date.now()) {
            this.session.get('/v4/devices/' + this.did, 30000, (e, body) => {
                if (e) {
                    return callback(new Error('Request failed: ' + e), null);
                }
                if (body && (Object.prototype.hasOwnProperty.call(body, 'device') || Object.prototype.hasOwnProperty.call(body, 'meter'))) {
                    const device = Object.prototype.hasOwnProperty.call(body, 'device') ? body.device : body.meter;
                    this.device = device.data;
                    this.lastUpdate = Date.now();
                    callback(null, device);
                } else {
                    this.log('no device, no meter');
                    callback(null, this.device);
                }
            });
        } else {
            callback(null, this.device);
        }
    }
}
