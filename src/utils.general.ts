import type { AnyDate, DateObj } from "./types/General.type";
import type { Dict } from "@giveback007/util-lib";
import { hasKey, isType, minAppend, getDayStartEnd, objKeyVals, nonValue } from '@giveback007/util-lib';
import dayJs from 'dayjs';

/** Turns a dictionary obj into url params
 * 
 * @param dict eg: `{ key1: 1, key2: 'val2' }`
 * @returns eg: `"?key1=1&key2=val2"`
 */
 export function dictToUrlParams(dict: Dict<string | number | boolean>) {
    let search = '';

    objKeyVals(dict).forEach(({ key, val }, i) =>
        !nonValue(val) && (search += `${i ? '&' : '?'}${key}=${val}`));

    return search;
}

const fromDateObj = (o: DateObj) => new Date(o.y, (o.m || 1) - 1, o.d || 1, o.hr || 0, o.min || 0, o.sec || 0, o.ms || 0);
export const toDate = (anyDate: AnyDate) => {
    const dt =
        anyDate === 'now' ? new Date
        :
        anyDate === 'today' ? getDayStartEnd(new Date).start
        :
        anyDate === 'yesterday' ? getDayStartEnd((() => {
            const x = new Date;
            x.setDate(x.getDate() - 1);

            return x;
        })()).start
        :
        isType(anyDate, 'object') && hasKey(anyDate, 'y') ? fromDateObj(anyDate)
        :
        dayJs(anyDate).toDate();

    if (dt.toDateString() === 'Invalid Date') {
        console.error(`date: "${anyDate.toString()}" is an invalid date`);
        throw new Error('Invalid Date');
    }

    return dt;
};

export function dayAndTime(time: AnyDate, useSeconds = false): [string, string] {
    const dt = toDate(time);

    const dayStr = `${dt.getFullYear()}-${minAppend(dt.getMonth() + 1, 2, '0')}-${minAppend(dt.getDate(), 2, '0')}`;
    const timeStr = (`${minAppend(dt.getHours(), 2, '0')}:${minAppend(dt.getMinutes(), 2, '0')}` + (useSeconds ? (':' + minAppend(dt.getSeconds(), 2, '0')) : ''));
    
    return [dayStr, timeStr];
}

/** mutates date to increment by n of day */
export const incrDate =
    (date: Date, nDays = 1) => date.setDate(date.getDate() + nDays);

/** Mins to hours rounded to 1 decimal places */
export const minToHr = (mins: number) => Math.round(mins * 10 / 60) / 10;
