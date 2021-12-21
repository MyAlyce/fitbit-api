export interface SleepGoalDetails {
    consistency: {
        awakeRestlessPercentage: number;
        flowId:                  number;
        recommendedSleepGoal:    number;
        typicalDuration:         number;
        typicalWakeupTime:       string;
    };
    goal: SleepGoal;
}

export interface SleepGoal {
    goal: {
      minDuration: number,
      updatedOn: string,
    }
}



export type Sleep = {
    dateOfSleep:         string;
    duration:            number;
    efficiency:          number;
    endTime:             string;
    infoCode:            number;
    isMainSleep:         boolean;
    logId:               number;
    minutesAfterWakeup:  number;
    minutesAsleep:       number;
    minutesAwake:        number;
    minutesToFallAsleep: number;
    startTime:           string;
    timeInBed:           number;
} & ({
    type:                "classic";
    levels:              ClassicSleepLevels;
} | {
    type:                "stages";
    levels:              SleepLevels;
});

export type SleepSummary = {
    stages: {
        deep: number,
        light: number,
        rem: number,
        wake: number,
    },
    totalMinutesAsleep: number;
    totalSleepRecords: number;
    totalTimeInBed: number;
}

export interface ClassicSleepLevels {
    data:    {
        dateTime: string;
        level:    "asleep" | "awake" | "restless";
        seconds:  number;
    }[];
    summary: {
        asleep:   ClassicSummary;
        awake:    ClassicSummary;
        restless: ClassicSummary;
    };
}

interface ClassicSummary { count: number; minutes: number; }

export interface SleepLevels {
    data:      Datum[];
    shortData: Datum[];
    summary:   {
        deep:  Summary;
        light: Summary;
        rem:   Summary;
        wake:  Summary;
    };
}

interface Datum {
    dateTime: string;
    level:    "deep" | "light" | "rem" | "wake" | "unknown";
    seconds:  number;
}

interface Summary {
    count:               number;
    minutes:             number;
    thirtyDayAvgMinutes: number;
}
