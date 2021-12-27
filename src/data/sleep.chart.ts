import type { AnyDate } from "../types/General.type";
import type { Sleep } from "../types/Sleep.type";
import { arrLast, arrToDict, average, Dict, hasKey, isType } from "@giveback007/util-lib";
import { dayAndTime, incrDate, minToHr, toDate } from "../utils.general";

export type ChartSleepData = {
    startDate: Date;
    endDate: Date;
    nOfDays: number;
    dateMarkers: string[];
    sleepData: (Sleep | null)[];
    sma: { data: (number | null)[]; smaN: number; }[];
    sleepLevels: {
        deep: (number | null)[];
        light: (number | null)[];
        rem: (number | null)[];
        wake: (number | null)[];
        asleep: (number | null)[];
    };
};

export function sleepToChartData(data: Sleep[], opts: {
    /** Defaults to using the earliest date from `data: Sleep[]` */
    startDate?: AnyDate;
    /** Defaults to using the latest date from `data: Sleep[]` */
    endDate?: AnyDate;
    /** sma list, eg: [30, 7] -> will generate 30-Day and 7-Day SMA */
    sma?: number[] | number;
} = {}): ChartSleepData {
    const time = (t: string) => new Date(t).getTime();
    data = [...data].sort((a, b) => time(a.startTime) - time(b.startTime));

    const startDate = toDate(opts.startDate || data[0].dateOfSleep);
    const endDate = toDate(opts.endDate || arrLast(data).dateOfSleep);

    if (startDate.getTime() > endDate.getTime())
        throw new Error("startDate can't be later than endDate");

    const sleepDict = arrToDict(data, 'dateOfSleep');

    const sleepData: (Sleep | null)[] = [];
    const dateMarkers: string[] = [];

    const sleepLevels = {
        // asleep is there for when the levels aren't available
        deep: [] as (number | null)[],
        light: [] as (number | null)[],
        rem: [] as (number | null)[],
        wake: [] as (number | null)[],
        asleep: [] as (number | null)[],
    };

    let i = 0;
    let doDateLoop = true;
    const [endDay] = dayAndTime(opts.endDate || arrLast(data).dateOfSleep);
    const loopDt = new Date(startDate);
    incrDate(loopDt, -1);

    while (doDateLoop) {
        incrDate(loopDt);
        const [dtStr] = dayAndTime(loopDt);
        
        const data = sleepDict[dtStr] || null;
        const summary = data ? data.levels.summary : null;

        dateMarkers[i] = dtStr;
        sleepData[i] = data;

        if (!summary || hasKey(summary, 'asleep')) {
            sleepLevels.asleep[i] = summary ? minToHr(data.minutesAsleep) : null;
            sleepLevels.wake[i] = data ? minToHr(data.minutesAwake) : null;
            sleepLevels.deep[i] = null;
            sleepLevels.light[i] = null;
            sleepLevels.rem[i] = null;
        } else {
            sleepLevels.asleep[i] = null;
            sleepLevels.deep[i] = minToHr(summary.deep.minutes);
            sleepLevels.light[i] = minToHr(summary.light.minutes);
            sleepLevels.rem[i] = minToHr(summary.rem.minutes);
            sleepLevels.wake[i] = minToHr(summary.wake.minutes);
        }
        
        i++;
        if (dtStr === endDay) doDateLoop = false;
    }

    const obj: ChartSleepData = { // data so far
        startDate, endDate, dateMarkers, sleepData, sleepLevels,
        nOfDays: dateMarkers.length, sma: []
    };

    const smas = (isType(opts.sma, 'number') ? [opts.sma] : opts.sma) || [];
    if (!smas.length) return obj;

    const hours = sleepData.map((x) => minToHr(x ? x.minutesAsleep : 0));
    let nOfMissing = 0;

    const smaArr: Dict<(number | null)[]> = {};
    const smaI: Dict<number> = {};
    smas.forEach(n => (smaArr[n] = []) && (smaI[n] = 0));
    
    for (let i = 0; i < sleepData.length; i++) {
        nOfMissing = !hours[i] ? nOfMissing + 1 : 0;

        smas.forEach(n => {
            // increment the smaI if the day is a minimum of n
            if (i >= n) smaI[n]++;

            const arr = hours.slice(smaI[n], i + 1).filter(x => x);
            smaArr[n].push(smaI[n] && nOfMissing < Math.floor(n / 2) ? Number(average(arr).toFixed(1)) : null);
        });
    }

    const smaFinal = smas.map(n => ({ data: smaArr[n], smaN: n }));

    return { ...obj, sma: smaFinal };
}
