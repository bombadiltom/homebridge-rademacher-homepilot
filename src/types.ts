export interface StatusesMap {
    Position?: number;
    acttemperatur?: number;
    relaisstatus?: number;
    [key: string]: number | string | boolean | undefined;
}

export interface SensorReadings {
    smoke_detected?: boolean;
    temperature_primary?: number;
    sun_brightness?: number;
    sun_detected?: boolean;
    rain_detected?: boolean;
    contact_state?: string;
    [key: string]: unknown;
}

// A device ("Actuator"), meter ("Sensor") or scene as returned by the
// HomePilot v4 API. Devices/meters carry a did, scenes a sid.
export interface HomePilotItem {
    did?: number;
    sid?: number;
    uid?: string;
    name: string;
    description: string;
    deviceNumber?: string;
    deviceGroup?: number;
    hasErrors?: number;
    isExecutable?: number;
    batteryStatus?: number;
    iconSet?: { k: string; [key: string]: unknown };
    statusesMap?: StatusesMap;
    readings?: SensorReadings;
    [key: string]: unknown;
}

export interface DevicesResponse {
    devices?: HomePilotItem[];
    meters?: HomePilotItem[];
}

export interface ScenesResponse {
    scenes?: HomePilotItem[];
}
