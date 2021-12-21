import type { TimeVal } from "./General.type";

export interface HeartRate {
    dateTime: string;
    value: {
        customHeartRateZones: HeartRateZone[];
        heartRateZones:       HeartRateZone[];
        restingHeartRate:     number;
    };
}

export interface HeartRateZone {
    caloriesOut: number;
    max:         number;
    min:         number;
    minutes:     number;
    name:        string;
}

export interface HeartRateIntraday {
    dataset:         TimeVal[];
    datasetInterval: number;
    datasetType:     string;
}
