import type { Dict } from "@giveback007/util-lib";
import type { FitbitError } from "./FitbitError.type";

export type WeekDays = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type AccessLevel = "PUBLIC" | "PRIVATE" | "SHARED";

export type DateVal = { dateTime: string; value: string; };

export type TimeVal = { time: string; value: number; };

/**
 * y - year, eg: `2021`
 * 
 * m - month, use `1` for `January`
 * 
 * d - day, use `1` for `the 1st`
 * 
 * hr - hours, use `0` for `12am / 00h`
 */
export type DateObj = { y: number; m?: number; d?: number, hr?: number, min?: number, sec?: number, ms?: number };

export type AnyDate = string | number | Date | 'today' | 'now' | 'yesterday' | DateObj;

export type ApiResponse<T> = ({
    type: "ERROR";
    isSuccess: false;
    /** https://dev.fitbit.com/build/reference/web-api/troubleshooting-guide/error-messages/ */
    error: FitbitError | null;
} | {
    type: "SUCCESS";
    isSuccess: true;
    data: T;
}) & {
    code: number;
    response: Response;
    headers: Dict<string>;
};
