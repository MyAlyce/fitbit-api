import type { AccessLevel } from "./General.type";

export type BaseFoodType = {
    accessLevel:        AccessLevel;
    brand:              string;
    calories:           number;
    foodId:             number;
    name:               string;
    units:              number[];
}

export type Food = BaseFoodType & {
    defaultServingSize: number;
    defaultUnit:        FoodUnit;
    isGeneric:          boolean;
    locale?:            string;
    servings?:          FoodServing[];
}

export type CustomFood = Food & {
    creatorEncodedId:   string;
    nutritionalValues:  { [key: string]: number };
}

export type FrequentFood = BaseFoodType & {
    amount:        number;
    dateLastEaten: string;
    mealTypeId:    number;
    unit:          FoodUnit;
}

export interface FoodServing {
    multiplier:  number;
    servingSize: number;
    unit:        FoodUnit;
    unitId:      number;
}

export type FoodLocale = {
    barcode:     boolean;
    imageUpload: boolean;
    label:       string;
    value:       string;
}

export type FoodUnit = {
    id:     number;
    name:   string;
    plural: string;
}

export type LoggedFood = BaseFoodType & {
    amount:      number;
    mealTypeId:  number;
    unit:        FoodUnit;
    locale?:     string;
}

export type FoodLog = {
    foodDay: {
        date:       string;
        summary:    FoodSummary;
    };
    foodLog: {
        isFavorite:        boolean;
        logDate:           string;
        logId:             number;
        loggedFood:        LoggedFood;
        nutritionalValues: FoodSummary;
    };
}

export type FoodSummary = {
    calories: number;
    carbs:    number;
    fat:      number;
    fiber:    number;
    protein:  number;
    sodium:   number;
    water?:   number;
}

export type FoodDaySummary = {
    foods:   FoodLog['foodLog'][];
    goals:   { calories: number; };
    summary: FoodSummary;
}

export interface Meal {
    description: string;
    id:          number;
    mealFoods:   LoggedFood[];
    name:        string;
}

export type WaterLog = {
    amount: number;
    logId: number;
}

export type WaterDaySummary = {
    summary: { water: number; };
    water: WaterLog[];
}

export type WaterGoal = {
    goal: number;
    startDate: string;
}

export type FoodGoal = {
    calories: number;
}
