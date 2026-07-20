import type { API, HAP } from 'homebridge' with { 'resolution-mode': 'import' };

// Runtime HAP handles (Service, Characteristic, uuid, ...) and the
// PlatformAccessory constructor are only available once homebridge hands
// us the API object, so they are stored here at plugin initialization.
export let hap: HAP;
export let Accessory: API['platformAccessory'];

export function setHap(api: API): void {
    hap = api.hap;
    Accessory = api.platformAccessory;
}
