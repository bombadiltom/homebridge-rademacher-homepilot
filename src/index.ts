import type { API } from 'homebridge' with { 'resolution-mode': 'import' };
import { setHap } from './hap';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { RademacherHomePilot } from './platform';

export = (api: API): void => {
    setHap(api);
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RademacherHomePilot);
};
