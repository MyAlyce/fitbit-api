import type { AccessLevel, DateVal, TimeVal } from "./General.type";
import type { HeartRateZone } from "./HeartRate.type";

type Stats = {
    activeScore: number;
    caloriesOut: number;
    distance: number;
    floors: number;
    steps: number;
}

export type LifetimeActivity = {
    best: {
        total: {
            distance: DateVal;
            floors: DateVal;
            steps: DateVal;
        };
        tracker: {
            distance: DateVal;
            floors: DateVal;
            steps: DateVal;
        };
    };
    lifetime: {
        total: Stats;
        tracker: Stats;
    }
}

export type ActivityGoals = {
    activeMinutes: number;
    caloriesOut: number;
    distance: number;
    floors: number;
    steps: number;
};

export type ActivityLog = {
    activityId: number;
    activityParentId: number;
    activityParentName: string;
    calories: number;
    description: string;
    distance: number;
    duration: number;
    hasStartTime: boolean;
    isFavorite: boolean;
    lastModified: string;
    logId: number;
    name: string;
    startDate: string;
    startTime: string;
    steps: number;
};

export type Activity = {
    activeDuration: number;
    activityLevel: {
        minutes: number;
        name: string;
    }[];
    activityName: string;
    activityTypeId: number;
    calories: number;
    caloriesLink: string;
    duration: number;
    elevationGain: number;
    lastModified: string;
    logId: number;
    logType: string;
    manualValuesSpecified: {
        calories: boolean;
        distance: boolean;
        steps: boolean;
    };
    originalDuration: number;
    originalStartTime: string;
    startTime: string;
    steps: number;
    tcxLink: string;
};

export type FavoriteActivity = {
    activityId: number,
    description: string,
    /** The number of mets assigned to the activity or exercise.
     * 
     * `Fitbit trackers calculate active minutes using metabolic equivalents (METs). METs help measure the energy expenditure of various activities.`
     */
    mets: number,
    name: string
};


export type ActivityTypeCategory = {
    activities:     ActivityType[];
    id:             number;
    name:           string;
    subCategories?: ActivityTypeCategory[];
}

export type ActivityType = {
    accessLevel:     AccessLevel;
    hasSpeed:        boolean;
    id:              number;
    name:            string;
    activityLevels?: ActivityTypeLevel[];
    mets?:           number;
}

export type ActivityTypeLevel = {
    id:          number;
    maxSpeedMPH: number;
    mets:        number;
    minSpeedMPH: number;
    name:        string;
}

export type RecentActivity = {
    activityId: number;
    calories: number;
    description: string;
    distance: number;
    duration: number;
    name: string;
}


export type ActivitySummary = {
    activeScore:            number;
    activityCalories:       number;
    calorieEstimationMu:    number;
    caloriesBMR:            number;
    caloriesOut:            number;
    caloriesOutUnestimated: number;
    customHeartRateZones:   HeartRateZone[];
    distances:              {
        activity: string;
        distance: number;
    }[];
    elevation:              number;
    fairlyActiveMinutes:    number;
    floors:                 number;
    heartRateZones:         HeartRateZone[];
    lightlyActiveMinutes:   number;
    marginalCalories:       number;
    restingHeartRate:       number;
    sedentaryMinutes:       number;
    steps:                  number;
    useEstimation:          boolean;
    veryActiveMinutes:      number;
}


export type ActivityResource = 'activityCalories' | 'calories' | 'caloriesBMR' | 'distance' | 'elevation' | 'floors' | 'minutesSedentary' | 'minutesFairlyActive' | 'minutesVeryActive' | 'steps';

export type ActivityResourceObj<T extends ActivityResource> =
    T extends 'activityCalories'    ? { "activities-activityCalories": DateVal[] } :
    T extends 'calories'            ? { "activities-calories": DateVal[] } :
    T extends 'caloriesBMR'         ? { "activities-caloriesBMR": DateVal[] } :
    T extends 'distance'            ? { "activities-distance": DateVal[] } :
    T extends 'elevation'           ? { "activities-elevation": DateVal[] } :
    T extends 'floors'              ? { "activities-floors": DateVal[] } :
    T extends 'minutesSedentary'    ? { "activities-minutesSedentary": DateVal[] } :
    T extends 'minutesFairlyActive' ? { "activities-minutesFairlyActive": DateVal[] } :
    T extends 'minutesVeryActive'   ? { "activities-minutesVeryActive": DateVal[] } :
    T extends 'steps'               ? { "activities-steps": DateVal[] } : never;


type IntraDataset<T = TimeVal> = {
    dataset: T[];
    datasetInterval: number;
    datasetType: string;
}

export type ActivityIntradayResource = 'calories' | 'distance' | 'elevation' | 'floors' | 'steps';

export type ActivityIntradayResourceObj<T> = 
    T extends 'calories'            ? { "activities-calories": DateVal[]; 'activities-calories-intraday': IntraDataset<{ level: number; mets: number; time: string; value: number; }> } :
    T extends 'distance'            ? { "activities-distance": DateVal[]; 'activities-distance-intraday': IntraDataset } :
    T extends 'elevation'           ? { "activities-elevation": DateVal[]; 'activities-elevation-intraday': IntraDataset } :
    T extends 'floors'              ? { "activities-floors": DateVal[]; 'activities-floors-intraday': IntraDataset } :
    T extends 'steps'               ? { "activities-steps": DateVal[]; 'activities-steps-intraday': IntraDataset } : never;
