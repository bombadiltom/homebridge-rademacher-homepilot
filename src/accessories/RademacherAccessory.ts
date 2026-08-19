import type { Logging, PlatformAccessory, Service, WithUUID } from 'homebridge' with { 'resolution-mode': 'import' };
import { hap } from '../hap';
import type { RademacherHomePilotSession } from '../RademacherHomePilotSession';
import type { HomePilotItem } from '../types';

export type DeviceCallback = (error: Error | null, device?: HomePilotItem | null) => void;

// getDevice() is called once per characteristic read, and HomeKit/our own poll
// interval can trigger several of those in quick succession for the same
// accessory (e.g. reading CurrentPosition and TargetPosition together). Reusing
// a response this fresh avoids redundant round trips to the HomePilot gateway
// without making state look stale to HomeKit.
const DEVICE_CACHE_TTL_MS = 4000;

export class RademacherAccessory {
    readonly accessory: PlatformAccessory;
    readonly log: Logging;
    debug: boolean;
    readonly session: RademacherHomePilotSession;
    readonly did?: number;
    protected lastUpdate = 0;
    protected device: HomePilotItem | null = null;
    private pendingCallbacks: DeviceCallback[] | null = null;

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

    // A cached accessory restored from homebridge's persisted accessories.json can be
    // missing a service (e.g. it was cached by an older plugin version, or the HomePilot
    // gateway reassigned the did to a different device type). Rather than crashing with
    // "Cannot read properties of undefined (reading 'getCharacteristic')" - which, thrown
    // from inside the devices-list GET handler, silently aborts processing of every
    // remaining device in that batch - self-heal by adding the missing service.
    protected getOrAddService<S extends WithUUID<typeof Service> & (new (displayName?: string, subtype?: string) => Service)>(serviceConstructor: S, name: string): Service {
        return this.accessory.getService(serviceConstructor) ?? this.accessory.addService(new serviceConstructor(name));
    }

    getDevice(callback: DeviceCallback): void {
        if (Date.now() - this.lastUpdate <= DEVICE_CACHE_TTL_MS) {
            callback(null, this.device);
            return;
        }
        // update() reads several characteristics back-to-back (e.g. current + target
        // temperature + heating state), all before any response comes back. The TTL
        // check above only catches calls made *after* a previous fetch resolved, so
        // concurrent callers here would otherwise each fire their own request; queue
        // them onto the one already in flight instead.
        if (this.pendingCallbacks) {
            this.pendingCallbacks.push(callback);
            return;
        }
        this.pendingCallbacks = [callback];
        this.session.get('/v4/devices/' + this.did, 30000, (e, body) => {
            const callbacks = this.pendingCallbacks ?? [];
            this.pendingCallbacks = null;
            if (e) {
                const error = new Error('Request failed: ' + e);
                callbacks.forEach((cb) => cb(error, null));
                return;
            }
            if (body && (Object.prototype.hasOwnProperty.call(body, 'device') || Object.prototype.hasOwnProperty.call(body, 'meter'))) {
                const device = Object.prototype.hasOwnProperty.call(body, 'device') ? body.device : body.meter;
                this.device = device.data;
                this.lastUpdate = Date.now();
                callbacks.forEach((cb) => cb(null, device));
            } else {
                this.log('no device, no meter');
                callbacks.forEach((cb) => cb(null, this.device));
            }
        });
    }
}
