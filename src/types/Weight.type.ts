export type WeightLog = {
    bmi: number;
    date: string;
    fat: number;
    logId: number;
    source: string;
    time: string;
    weight: number;
};

export type FatLog = {
    date: string;
    fat: number;
    logId: number;
    source: string;
    time: string;
};

export type WeightGoal = {
    goalType: 'LOSE' | 'GAIN' | 'MAINTAIN';
    startDate: string;
    startWeight: number;
    weight: number;
    weightThreshold: number;
}

export type FatGoal = {
    fat: number;
}
