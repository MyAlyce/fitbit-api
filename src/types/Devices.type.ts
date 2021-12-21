import type { WeekDays } from "./General.type";

export type Device = {
    battery: 'High' | 'Medium' | 'Low' | 'Empty';
    batteryLevel: number;
    deviceVersion: string;
    features: unknown[];
    id: string;
    lastSyncTime: string;
    mac: string;
    type: "TRACKER" | "SCALE";
}

export type Alarm = {
    alarmId: number;
    deleted: boolean;
    enabled: boolean;
    recurring: boolean;
    snoozeCount: number;
    snoozeLength: number;
    syncedToDevice: boolean;
    time: string;
    vibe: 'DEFAULT';
    weekDays: WeekDays[];
};
