import type { Activity, ActivityGoals, ActivityIntradayResource, ActivityIntradayResourceObj, ActivityLog, ActivityResource, ActivityResourceObj, ActivitySummary, ActivityType, ActivityTypeCategory, FavoriteActivity, LifetimeActivity, RecentActivity } from './types/Activity.type';
import type { Badge } from './types/Badges.type';
import type { Alarm, Device } from './types/Devices.type';
import type { DateVal, WeekDays } from './types/General.type';
import type { FitbitError } from './types/FitbitError.type';
import type { HeartRateIntraday, HeartRate } from './types/HeartRate.type';
import type { FitbitProfile } from './types/Profile.type';
import type { Sleep, SleepGoal, SleepGoalDetails, SleepSummary } from './types/Sleep.type';
import type { FatLog, FatGoal, WeightLog, WeightGoal } from './types/Weight.type';
import type { FoodLocale, FoodUnit, Food, CustomFood, FrequentFood, FoodLog, WaterLog, WaterDaySummary, FoodDaySummary, Meal, WaterGoal, FoodGoal } from './types/Nutrition.type';
import type { Friend, LeaderboardFriend } from './types/Friends.type';
import type { Subscription, SubscriptionCollection, SubscriptionOpts } from './types/Subscription.type';
import { hasKey, isType, minAppend, getDayStartEnd, days, objRemoveKeys, Dict, objKeyVals, nonValue } from '@giveback007/util-lib';
import { Api } from 'rest-api-handler';

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

/**
 * y - year, eg: `2021`
 * 
 * m - month, use `1` for `January`
 * 
 * d - day, use `1` for `the 1st`
 * 
 * hr - hours, use `0` for `12am / 00h`
 * */
type DateObj = { y: number; m?: number; d?: number, hr?: number, min?: number, sec?: number, ms?: number };
type AnyDate = string | number | Date | 'today' | 'now' | 'yesterday' | DateObj;
type id = string | number;

const fromDateObj = (o: DateObj) => new Date(o.y, (o.m || 1) - 1, o.d || 1, o.hr || 0, o.min || 0, o.sec || 0, o.ms || 0);
const toDate = (anyDate: AnyDate) => {
    const dt = 
        anyDate instanceof Date ? anyDate
        :
        anyDate === 'now' ? new Date
        :
        anyDate === 'today' ? getDayStartEnd(new Date).start
        :
        anyDate === 'yesterday' ? getDayStartEnd(Date.now() - days(1)).start
        :
        isType(anyDate, 'number') || isType(anyDate, 'string') ? new Date(anyDate)
        :
        fromDateObj(anyDate);

    if (dt.toDateString() === 'Invalid Date') {
        console.error(`date: "${anyDate.toString()}" is an invalid date`);
        throw new Error('Invalid Date');
    }

    return dt;
};

function dayAndTime(time: AnyDate, useSeconds = false): [string, string] {
    const dt = toDate(time);

    const dayStr = `${dt.getFullYear()}-${minAppend(dt.getMonth() + 1, 2, '0')}-${minAppend(dt.getDate(), 2, '0')}`;
    const timeStr = (`${minAppend(dt.getHours(), 2, '0')}:${minAppend(dt.getMinutes(), 2, '0')}` + (useSeconds ? (':' + minAppend(dt.getSeconds(), 2, '0')) : ''));
    
    return [dayStr, timeStr];
}

type Pagination = {
    afterDate?: string;
    beforeDate?: string;
    limit: number;
    next: string;
    offset: number;
    previous: string;
    sort: 'asc' | 'desc';
}

export class FitbitApi {
    private api = new Api('https://api.fitbit.com');

    private url = (version: 1 | 1.1 | 1.2, namespace: string, noUser = false) =>
        noUser ? `${version}/${namespace}` : `${version}/user/${this.fitBitUserId}/${namespace}`;

    constructor(
        private accessToken: string,
        private fitBitUserId: string = '-',
        /** Optional function that will attempt to auto refresh the token when expired */
        private getToken?: () => Promise<string>
    ) {
        this.setAccessToken(accessToken);
    }

    getApiInfo = () => ({
        accessToken: this.accessToken,
        fitBitUserId: this.fitBitUserId,
    });

    sleep = {
        /** Returns a list of a user's sleep log entries before `beforeDate` or after `afterDate` a given date specifying offset, limit and sort order.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-list/
         */
        getLogList: async (opts: {
            sort?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        } & ({ beforeDate: AnyDate } | { afterDate: AnyDate })) => {
            type SleepData = {
                pagination: Pagination;
                sleep: Sleep[];
            };

            const params = {
                limit: opts.limit || 100,
                offset: opts.offset || 0,
                ...(hasKey(opts, 'afterDate') ?
                    { afterDate: dayAndTime(opts.afterDate)[0], sort: opts.sort || 'asc' }
                    :
                    { beforeDate: dayAndTime(opts.beforeDate)[0], sort: opts.sort || 'desc' }
                )
            };
            
            if (params.limit > 100 || params.limit < 1) throw new Error(`Invalid limit: ${params.limit}, needs to be between 1 to 100`);
            const url = this.url(1.2, `sleep/list.json${dictToUrlParams(params)}`);

            return this.pageGenerator<SleepData, Sleep>(url, 'sleep');
        },

        /** Deletes a sleep log with the given log id.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/delete-sleep-log/
         */
        deleteLog: (sleepLogId: id) => this.handleData<null>(() => this.api.delete(this.url(1.2, `sleep/${sleepLogId}.json`))),

        /** Creates a log entry for a sleep event and returns a response in the format requested.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/create-sleep-log/
         */
        createLog: ({ time, duration }: {
            /** Start time of sleep. */
            time: string | number | Date;
            /** Duration in milliseconds. */
            duration: number;
        }) => {
            const [date, startTime] = dayAndTime(time);
            const url = this.url(1.2, `sleep.json${dictToUrlParams({ duration, date, startTime })}`);
            
            return this.handleData<{ sleep: Sleep; }>(() => this.api.post(url));
        },

        /** Returns a list of a user's sleep log entries for a given date.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/
         */
        getByDate: ({ date }: { date: AnyDate; }) => this.handleData<{
            sleep: Sleep[];
            summary: SleepSummary;
        }>(() => this.api.get(this.url(1.2, `sleep/date/${dayAndTime(date)[0]}.json`))),

        /** Returns a list of a user's sleep log entries for a given date range.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date-range/
         */
        getByDateRange: (opts: { startDate: AnyDate; endDate: AnyDate }) => {
            const url = this.url(1.2, `sleep/date/${dayAndTime(opts.startDate)[0]}/${dayAndTime(opts.endDate)[0]}.json`);
            return this.handleData<{ sleep: Sleep; }>(() => this.api.get(url));
        },

        /** Create or update a user's sleep goal.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/create-sleep-goals/
         */
        createGoal: (opts: {
            /** Length of sleep goal in minutes. */
            minDuration: string | number;
        }) => this.handleData<SleepGoal>(() => this.api.post(this.url(1.2, `sleep/goal.json${dictToUrlParams(opts)}`))),

        /** Returns a user's current sleep goal.
         * 
         * https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-goals/
         */
        getGoal: () => this.handleData<SleepGoalDetails>(() => this.api.get(this.url(1.2, 'sleep/goal.json'))),
    } as const;

    /** The Heart Rate Time Series endpoints are used for querying the user's heart rate data.
     * 
     * https://dev.fitbit.com/build/reference/web-api/heartrate-timeseries/
     */
    heartRate = {
        /** Retrieves the heart rate time series data over a period of time by specifying a date and time period or a date range. The response will include only the daily summary values. 
         * 
         * https://dev.fitbit.com/build/reference/web-api/heartrate-timeseries/get-heartrate-timeseries-by-date/
         */
        getTimeSeries: (opts: {
            type: 'By_Date';
            date: AnyDate;
            period?: '1d' | '7d' | '30d' | '1w' | '1m';
        } | {
            type: 'By_Range';
            fromDate: AnyDate;
            toDate: AnyDate;
        }) => {
            const url = this.url(1, opts.type === 'By_Date' ?
                `activities/heart/date/${dayAndTime(opts.date)[0]}/${opts.period || '1d'}.json`
                :
                `activities/heart/date/${dayAndTime(opts.fromDate)[0]}/${dayAndTime(opts.toDate)[0]}.json`
            );

            return this.handleData<{ "activities-heart": HeartRate[]; }>(() => this.api.get(url));
        },

        /** Retrieves the heart rate intraday time series data on a specific date or date range for a 24 hour period.
         * 
         * Can't exceed 24 hours, or an error will be given.
         * 
         * https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date/
         */
        getIntraday: (opts: {
            type: 'By_Date';
            date: AnyDate;
            detailLevel: '1sec' | '1min' | '5min' | '15min';
        } | {
            type: 'By_Range';
            fromTime: AnyDate;
            toTime: AnyDate;
            detailLevel: '1sec' | '1min' | '5min' | '15min';
        }) => {
            let url: string;

            if (opts.type === 'By_Date') {
                url = this.url(1, `activities/heart/date/${dayAndTime(opts.date)[0]}/1d/${opts.detailLevel}.json`);
            } else {
                const start = dayAndTime(opts.fromTime);
                const end = dayAndTime(opts.toTime);

                url = this.url(1, `activities/heart/date/${start[0]}/${end[0]}/${opts.detailLevel}/time/${start[1]}/${end[1]}.json`);
            }

            return this.handleData<{
                "activities-heart": HeartRate[];
                "activities-heart-intraday": HeartRateIntraday;
            }>(() => this.api.get(url));
        },
    } as const;

    /** The User endpoints display information about the user's profile information, the regional locale & language settings, and their badges collected.
     * 
     * https://dev.fitbit.com/build/reference/web-api/user/
     */
    user = {
        /** Retrieves a list of the user’s badges.
         * 
         * https://dev.fitbit.com/build/reference/web-api/user/get-badges/
         */
        getBadges: () =>
            this.handleData<{ badges: Badge[]; }>(() => this.api.get(this.url(1, `badges.json`))),

        /** Retrieves the user's profile data.
         * 
         * https://dev.fitbit.com/build/reference/web-api/user/get-profile/
         */
        getProfile: () =>
            this.handleData<{ user: FitbitProfile; }>(() => this.api.get(this.url(1, `profile.json`))),

        /** Modifies a user's profile data.
         * 
         * https://dev.fitbit.com/build/reference/web-api/user/update-profile/
         */
        updateProfile: async (opts: Partial<{
            /** The sex of the user; (MALE/FEMALE/NA). */
            gender: "MALE" | "FEMALE" | "NA",
            /** The date of birth in the format of yyyy-MM-dd. */
            birthday: string,
            /** The height in the format X.XX in the unit system that corresponds to the Accept-Language header provided. */
            height: string,
            /** This is a short description of user. */
            aboutMe: string,
            /** The full name of the user. */
            fullname: string,
            /** The country of the user's residence. This is a two-character code. */
            country: string,
            /** The US state of the user's residence. This is a two-character code if the country was or is set to US. */
            state: string,
            /** The US city of the user's residence. */
            city: string,
            /** Walking stride length in the format X.XX, where it is in the unit system that corresponds to the Accept-Language header provided. */
            strideLengthWalking: string,
            /** Running stride length in the format X.XX, where it is in the unit system that corresponds to the Accept-Language header provided. */
            strideLengthRunning: string,
            /** Default weight unit on website (which doesn't affect API); one of (en_US, en_GB, 'any' for METRIC). */
            weightUnit: 'en_US' | 'en_GB' | 'any',
            /** Default height/distance unit on website (which doesn't affect API); one of (en_US, en_GB, 'any' for METRIC). */
            heightUnit: 'en_US' | 'en_GB' | 'any',
            /** Default water unit on website (which doesn't affect API); one of (en_US, en_GB, 'any' for METRIC). */
            waterUnit: 'en_US' | 'en_GB' | 'any',
            /** Default glucose unit on website (which doesn't affect API); one of (en_US, en_GB, 'any' for METRIC). */
            glucoseUnit: 'en_US' | 'en_GB' | 'any',
            /** The timezone in the format, eg: 'America/Los_Angeles'. */
            timezone: string,
            /** The food database locale in the format of xx.XX. */
            foodsLocale: string,
            /** The locale of the website (country/language); one of the locales, currently – (en_US, fr_FR, de_DE, es_ES, en_GB, en_AU, en_NZ, ja_JP). */
            locale: 'en_US' | 'fr_FR' | 'de_DE' | 'es_ES' | 'en_GB' | 'en_AU' | 'en_NZ' | 'ja_JP',
            /** The Language in the format 'xx'. You should specify either locale or both - localeLang and localeCountry (locale is higher priority). */
            localeLang: string,
            /** The Country in the format 'xx'. You should specify either locale or both - localeLang and localeCountry (locale is higher priority). */
            localeCountry: string,
            /** The Start day of the week, meaning what day the week should start on. Either Sunday or Monday. */
            startDayOfWeek: 'Sunday' | 'Monday',
        }>) => this.handleData<{ user: FitbitProfile; }>(() => this.api.post(this.url(1, `profile.json${dictToUrlParams(opts)}`))),
    } as const;

    /** The Body endpoints are used for querying and modifying the user's body fat and weight data.
     * 
     * https://dev.fitbit.com/build/reference/web-api/body/
     */
    body = {
        /** Retrieves a list of all user's weight or fat log entries for a given date or date range.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/get-weight-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/get-bodyfat-log/
         */
        getLogs: <Data extends ('weight' | 'fat')>(opts: {
            type: 'By_Date';
            data: Data;
            date: AnyDate;
            period?: '1d' | '7d' | '30d' | '1w' | '1m';
        } | {
            type: 'By_Range';
            data: Data;
            fromDate: AnyDate;
            toDate: AnyDate;
        }) => {
            const url = this.url(1, opts.type === 'By_Date' ?
                `body/log/${opts.data}/date/${dayAndTime(opts.date)[0]}/${opts.period || '1d'}.json`
                :
                `body/log/${opts.data}/date/${dayAndTime(opts.fromDate)[0]}/${dayAndTime(opts.toDate)[0]}.json`
            );
            
            return this.handleData<Data extends 'fat' ? { fat: FatLog[]; } : { weight: WeightLog[]; }>(() => this.api.get(url));
        },

        /** Returns time series data in the specified range for weight, fat, or bmi.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body-timeseries/
        */
        getTimeSeries: <Data extends ('weight' | 'fat' | 'bmi')>(opts: {
            type: 'By_Date';
            data: Data;
            date: AnyDate;
            period?: '1d' | '7d' | '30d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'max';
        } | {
            type: 'By_Range';
            data: Data;
            fromDate: AnyDate;
            toDate: AnyDate;
        }) => {
            const url = this.url(1, opts.type === 'By_Date' ?
                `body/${opts.data}/date/${dayAndTime(opts.date)[0]}/${opts.period || '1d'}.json`
                :
                `body/${opts.data}/date/${dayAndTime(opts.fromDate)[0]}/${dayAndTime(opts.toDate)[0]}.json`
            );
            
            return this.handleData<
                Data extends 'fat' ? { "body-fat": DateVal[]; } :
                Data extends 'weight' ? { "body-weight": DateVal[]; } :
                Data extends 'bmi' ? { "body-bmi": DateVal[]; } : never
            >(() => this.api.get(url));
        },

        /** Retrieves a user's body fat and weight goals.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/get-body-goals/
         */
        getGoals: <Data extends ('weight' | 'fat')>(opts: { data: Data }) =>
            this.handleData<{ goal: Data extends 'fat' ? FatGoal : WeightGoal }>(() => this.api.get(this.url(1, `body/log/${opts.data}/goal.json`))),

        /** Updates a user's body fat and weight goals.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/create-weight-goal/
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/create-bodyfat-goal/
         */
        createGoals: <Data extends ('weight' | 'fat')>(opts: { data: Data }) =>
            this.handleData<{ goal: Data extends 'fat' ? FatGoal : WeightGoal }>(() => this.api.post(this.url(1, `body/log/${opts.data}/goal.json`))),
        
        
        /** Creates a body fat or weight log entry.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/create-bodyfat-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/create-weight-log/
         */
        createLog: <Data extends ('weight' | 'fat')>(opts: {
            data: Data;
            /** Body fat percentage or weight measurement in the format X.XX. */
            unit: number;
            /** Date time of log */
            time: number | string | Date
        }) => {
            const [date, time] = dayAndTime(opts.time, true);
            const url = this.url(1, `body/log/${opts.data}.json${dictToUrlParams({ [opts.data]: opts.unit, date, time })}`);

            return this.handleData<Data extends 'fat' ? { fatLog: FatLog; } : { weightLog: WeightLog; }>(() => this.api.post(url));
        },

        /** Deletes a body fat or weight log entry
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/delete-bodyfat-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/body/delete-weight-log/
         */
        deleteLog: <Data extends ('weight' | 'fat')>({ logId, data }: {
            data: Data;
            logId: id;
        }) => this.handleData<{ weightLog: WeightLog; }>(() => this.api.delete(this.url(1, `body/log/${data}/${logId}.json`))),
    };

    activity = {
        /** Retrieves the user's activity statistics.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-lifetime-stats/
         */
        getLifetimeStats: () =>
            this.handleData<LifetimeActivity>(() => this.api.get(this.url(1, `activities.json`))),

        /** Retrieves a user's current daily or weekly activity goals.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-activity-goals/
         */
        getGoals: (opts: { period: 'daily' | 'weekly' }) =>
            this.handleData<{ goals: ActivityGoals; }>(() => this.api.get(this.url(1, `activities/goals/${opts.period}.json`))),

        /** Creates or updates a user's daily or weekly activity goal.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/create-activity-goals/
         */
        createGoals: ({ period, type, value }: { period: 'daily' | 'weekly', type: string, value: string }) =>
            this.handleData<{ goals: ActivityGoals; }>(() => this.api.post(this.url(1, `activities/goals/${period}.json${dictToUrlParams({ type, value })}`))),
        
        /** Creates a log entry containing the Fitbit user's activity or private custom activity.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/create-activity-log/
         */
        createLog: (opts:
            { durationMillis: number; startTime: AnyDate; }
            &
            ({ activityId: id; manualCalories?: number; } | { activityName: string; manualCalories: number; })
        ) => {
            const [date, startTime] = dayAndTime(opts.startTime);
            const url = this.url(1, `activities.json${dictToUrlParams({ ...opts, date, startTime })}`);

            return this.handleData<{ activityLog: ActivityLog; }>(() => this.api.post(url));
        },

        /** Deletes a user’s activity log entry with the given ID.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/delete-activity-log/
         */
        deleteLog: (activityLogId: id) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `activities/${activityLogId}.json`))),

        /** Retrieves a list of a user's activity log entries before or after a given day.
         * 
         * @returns generator, call .next() to get data, keep calling .next() to continue loading data beforeDate or afterDate offset by data already loaded.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-activity-log-list/
         */
        getLogList: async (opts: {
            sort?: 'asc' | 'desc';
            limit?: number;
            offset?: number;
        } & ({ beforeDate: AnyDate } | { afterDate: AnyDate })) => {
            type ActivityData = {
                pagination: Pagination;
                activities: Activity[];
            };

            const params = {
                limit: opts.limit || 100,
                offset: opts.offset || 0,
                ...(hasKey(opts, 'afterDate') ?
                    { afterDate: dayAndTime(opts.afterDate)[0], sort: opts.sort || 'asc' }
                    :
                    { beforeDate: dayAndTime(opts.beforeDate)[0], sort: opts.sort || 'desc' }
                ),
            };
            
            if (params.limit > 100 || params.limit < 1) throw new Error(`Invalid limit: ${opts.limit}, needs to be a number between 1 to 100`);
            const url = this.url(1, `activities/list.json${dictToUrlParams(params)}`);

            return this.pageGenerator<ActivityData, Activity>(url, 'activities');
        },

        /** Retrieves a list of all valid Fitbit public activities and private, user-created activities. If available, activity level details will display.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-all-activity-types/
         */
        getAllTypes: () =>
            this.handleData<{ categories: ActivityTypeCategory[]; }>(() => this.api.get(this.url(1, `activities.json`))),

        /** Retrieves the details for a single activity. If available, activity level details will display.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-activity-type/
         */
        getType: (activityId: id) =>
            this.handleData<{ activity: ActivityType; }>(() => this.api.get(this.url(1, `activities/${activityId}.json`))),

        /** Retrieves a list of a user's favorite activities.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-favorite-activities/
         */
        getFavorite: () =>
            this.handleData<FavoriteActivity[]>(() => this.api.get(this.url(1, `activities/favorite.json`))),

        /** Adds the activity with the given ID to user's list of favorite activities.
         * 
         * For the list of available ids use: `.activity.getAllTypes()`
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/create-favorite-activity/
         */
        createFavorite: (activityId: id) =>
            this.handleData<Record<string, never>>(() => this.api.post(this.url(1, `activities/favorite/${activityId}.json`))),

        /** Adds the activity with the given ID to user's list of favorite activities.
         * 
         * For the list of available ids use: `.activity.getAllTypes()`
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/create-favorite-activity/
         */
        deleteFavorite: (activityId: id) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `activities/favorite/${activityId}.json`))),

        /** Retrieves a list of a user's recent activities types logged with some details of the last activity log of that type.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-recent-activity-types/
         */
        getRecent: () =>
            this.handleData<RecentActivity>(() => this.api.get(this.url(1, `activities/recent.json`))),

        /** Retrieves a summary and list of a user’s activities and activity log entries for a given day.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-daily-activity-summary/
         */
        getDailySummary: () => this.handleData<{
            /** The recorded exercise's identifier number. */
            activities: number[];
            goals:      ActivityGoals;
            summary:    ActivitySummary;
        }>(() => this.api.get(this.url(1, `activities/recent.json`))),

        /** Retrieves a list of a user's frequent activities.
         * 
         * https://dev.fitbit.com/build/reference/web-api/activity/get-frequent-activities/
         */
        getFrequent: () =>
            this.handleData<RecentActivity>(() => this.api.get(this.url(1, `activities/frequent.json`))),

        /** Returns time series data in the specified range for weight, fat, or bmi.
         * 
         * https://dev.fitbit.com/build/reference/web-api/body-timeseries/
        */
        getTimeSeries: <Data extends ActivityResource>(opts: {
            type: 'By_Date';
            data: Data;
            date: AnyDate;
            period?: '1d' | '7d' | '30d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'max';
        } | {
            type: 'By_Range';
            data: Data;
            fromDate: AnyDate;
            toDate: AnyDate;
        }) => {
            const url = this.url(1, opts.type === 'By_Date' ?
                `activities/${opts.data}/date/${dayAndTime(opts.date)[0]}/${opts.period || '1d'}.json`
                :
                `activities/${opts.data}/date/${dayAndTime(opts.fromDate)[0]}/${dayAndTime(opts.toDate)[0]}.json`
            );
            
            return this.handleData<ActivityResourceObj<Data>>(() => this.api.get(url));
        },

        /** Retrieves the activity intraday time series data for a given resource on a specific date or 24 hour period.
         * 
         * Can't exceed 24 hours, or an error will be given.
         * 
         * https://dev.fitbit.com/build/reference/web-api/intraday/get-activity-intraday-by-date/
         */
        getIntraday: <Data extends ActivityIntradayResource>(opts: {
            type: 'By_Date';
            date: AnyDate;
            data: Data;
            detailLevel: '1sec' | '1min' | '5min' | '15min';
        } | {
            type: 'By_Range';
            fromTime: AnyDate;
            toTime: AnyDate;
            data: Data;
            detailLevel: '1sec' | '1min' | '5min' | '15min';
        }) => {
            let url: string;

            if (opts.type === 'By_Date') {
                url = this.url(1, `activities/${opts.data}/date/${dayAndTime(opts.date)[0]}/1d/${opts.detailLevel}.json`);
            } else {
                const start = dayAndTime(opts.fromTime);
                const end = dayAndTime(opts.toTime);

                url = this.url(1, `activities/${opts.data}/date/${start[0]}/${end[0]}/${opts.detailLevel}/time/${start[1]}/${end[1]}.json`);
            }

            return this.handleData<ActivityIntradayResourceObj<Data>>(() => this.api.get(url));
        },

    } as const;

    devices = {
        /** Get Devices retrieves a list of devices paired to the user's account.
         * 
         * https://dev.fitbit.com/build/reference/web-api/devices/get-devices/
         */
        getList: () =>
            this.handleData<Device[]>(() => this.api.get(this.url(1, `devices.json`))),

        /** Create Alarm creates an alarm for the given device.
         * 
         * https://dev.fitbit.com/build/reference/web-api/devices/create-alarm/
         */
        createAlarm: (opts: {
            deviceTrackerId: id,
            time: string,
            enabled: boolean,
            recurring: boolean,
            weekDays: WeekDays
        }) => {
            const params = objRemoveKeys(opts, ['deviceTrackerId']);
            const url = this.url(1, `devices/tracker/${opts.deviceTrackerId}/alarms.json${dictToUrlParams(params)}`);

            return this.handleData<Alarm>(() => this.api.post(url));
        },

        /** Update Alarm updates an alarm for the given device.
         * 
         * https://dev.fitbit.com/build/reference/web-api/devices/update-alarm/
         */
        updateAlarm: ({ deviceTrackerId, alarmId }: { deviceTrackerId: id, alarmId: id }, update: Alarm) =>
            this.handleData<Alarm>(() => this.api.post(this.url(1, `devices/tracker/${deviceTrackerId}/alarms/${alarmId}.json${dictToUrlParams({...update, weekDays: update.weekDays.join() })}`))),

        /** Retrieves the alarms enabled for a specific device. This endpoint is supported for trackers that support alarms.
         * 
         * https://dev.fitbit.com/build/reference/web-api/devices/get-alarms/
         */
        getAlarms: (deviceTrackerId: id) => 
            this.handleData<{ "trackerAlarms": Alarm[] }>(() => this.api.get(this.url(1, `devices/tracker/${deviceTrackerId}/alarms.json`))),

        /** Delete Alarm deletes an alarm for the given device.
         * 
         * https://dev.fitbit.com/build/reference/web-api/devices/delete-alarm/
         */
        deleteAlarm: ({ deviceTrackerId, alarmId }: { deviceTrackerId: id, alarmId: id }) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `devices/tracker/${deviceTrackerId}/alarms/${alarmId}.json`))),

    } as const;

    /** The Friends endpoints display information about the specified user's friends and the friend's leaderboard.
     * 
     * https://dev.fitbit.com/build/reference/web-api/friends/
     */
    friends = {
        /** Retrieves a list of the Fitbit user's friends.
         * 
         * https://dev.fitbit.com/build/reference/web-api/friends/get-friends/
         */
        getList: () =>
            this.handleData<{ data: Friend[]; }>(() => this.api.get(this.url(1.1, `friends.json`))),

        /** Retrieves the user's friends leaderboard in the format requested using units in the unit system which corresponds to the Accept-Language header provided.
         * 
         * https://dev.fitbit.com/build/reference/web-api/friends/get-friends-leaderboard/
         */
        getLeaderboard: () =>
            this.handleData<{ data: LeaderboardFriend[]; included: Friend[]; }>(() => this.api.get(this.url(1.1, `leaderboard/friends.json`))),
    } as const;

    // https://dev.fitbit.com/build/reference/web-api/nutrition/
    nutrition = {
        // --- // FOODS INFO // --- //
        /** Retrieves a list of public foods from the Fitbit foods database and private foods the user created in the format requested.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/search-foods/
         */
        searchFood: (query: string) =>
            this.handleData<{ foods: Food[]; }>(() => this.api.get(this.url(1, `foods/search.json${dictToUrlParams({ query })}`, true))),

        /** Retrieves the details of a specific food stored in the Fitbit food database or a private food the authorized user has entered.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-food/
         */
        getFood: (foodId: id) =>
            this.handleData<{ food: Food; }>(() => this.api.get(this.url(1, `${foodId}.json`, true))),

        /** Retrieves the food locales used to search, log or create food.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-food-locales/
         */
        getFoodLocales: () =>
            this.handleData<FoodLocale[]>(() => this.api.get(this.url(1, `foods/locales.json`, true))),

        /** Retrieves a list of all valid Fitbit food units in the format requested.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-food-units/
         */
        getFoodUnits: () =>
            this.handleData<FoodUnit[]>(() => this.api.get(this.url(1, `foods/units.json`, true))),

        /** Creates a new private food for a user.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-food/
         */
        createFood: (params: {
                /** The food name. */
                name: string;
                /** The ID of the default measurement unit. Full list of units can be retrieved via the Get Food Units endpoint. */
                defaultFoodMeasurementUnitId: string;
                /** The size of the default serving. Nutrition values should be provided for this serving size. */
                defaultServingSize: string;
                /** The calories in the default serving size. */
                calories: string;
                /** Form type; LIQUID or DRY. */
                formType?: 'LIQUID' | 'DRY';
                /** The description of the food. */
                description?: string;
            },
            /** List of additional nutritional query parameter names that can be used
             * 
             * https://dev.fitbit.com/build/reference/web-api/nutrition/create-food#Additional-Nutritional-Information
             */
            addNutritionInfo = ''
        ) =>
            this.handleData<{ food: CustomFood }>(() => this.api.post(this.url(1, `foods.json${dictToUrlParams(params)}${addNutritionInfo}`))),

        /** Deletes a custom food created by the user.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/delete-custom-food/
         */
        deleteFood: (foodId: id) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `foods/${foodId}.json`))),

        
        // --- // FOOD // --- //
        /** Retrieves a list of user-specific frequent consumed foods.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-frequent-foods/
         */
        getFrequentFoods: () =>
            this.handleData<FrequentFood[]>(() => this.api.get(this.url(1, `foods/log/frequent.json`))),

        /** Retrieves a list of user-specific recently consumed foods.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-recent-foods/
         */
        getRecentFoods: () =>
            this.handleData<FrequentFood[]>(() => this.api.get(this.url(1, `foods/log/recent.json`))),

        
        // --- // LOGS FOOD & WATER // --- //
        /** Creates a food log entry for a given day. (OR) Create a user's water log entry.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-food-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-water-log/
         */
        createLog: <
            O extends {
                data: 'water';
                date: AnyDate;
                amount: number;
                unit: 'ml' | 'fl oz' | 'cup';
            } | ({
                data: 'food';
                /** Meal types. 1=Breakfast; 2=Morning Snack; 3=Lunch; 4=Afternoon Snack; 5=Dinner; 7=Anytime. */
                mealTypeId: 1 | 2 | 3 | 4 | 5 | 7;
                /** The ID of units used. Typically retrieved via a previous call to Get Food Logs, Search Foods, or Get Food Units. */
                unitId: id;
                amount: number;
                date: AnyDate;
                /** The true value will add the food to the user's favorites after creating the log entry; while the false value will not. Valid only with foodId value. */
                favorite?: boolean;
                /** Brand name of food. Valid only with foodName parameters. */
                brandName?: string;
                calories?: number;
            } & ({ foodId: id } | { foodName: string }))
        >(opts: O) => {
            const [date] = dayAndTime(opts.date)[0];
            const params = { ...objRemoveKeys(opts, ['data', 'date']), date };
            const url = this.url(1, `foods/log${opts.data === 'water' ? '/water' : ''}.json${dictToUrlParams(params)}`);

            return this.handleData<O['data'] extends 'water' ? WaterLog : FoodLog>(() => this.api.post(url));
        },

        /** Retrieves a summary of the user's food log entry for a given day. (OR) Retrieves a summary and list of a user's water log entries for a given day.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-food-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-water-log/
         */
        getLog: <
            O extends {
                data: 'water';
                date: AnyDate;
            } | {
                data: 'food';
                date: AnyDate;
            }
        >(opts: O) => {
            const [date] = dayAndTime(opts.date)[0];
            const params = { ...objRemoveKeys(opts, ['data', 'date']), date };
            const url = this.url(1, `foods/log${opts.data === 'water' ? '/water' : ''}.json${dictToUrlParams(params)}`);

            return this.handleData<O['data'] extends 'water' ? WaterDaySummary : FoodDaySummary>(() => this.api.get(url));
        },

        /** Deletes a user's food log entry using the given log ID. (OR) Deleted a user's water log entry using the given log ID.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/delete-food-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/delete-water-log/
         */
        deleteLog: ({ logId, data }: { data: 'water' | 'food'; logId: id; }) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `foods/log${data === 'water' ? '/water' : ''}/${logId}.json`))),

        /** Update food or water log.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/update-food-log/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/update-water-log/
         */
        updateLog: <
            O extends {
                data: 'water';
                unit: 'ml' | 'fl oz' | 'cup';
            } | {
                data: 'food';
                /** Meal types. 1=Breakfast; 2=Morning Snack; 3=Lunch; 4=Afternoon Snack; 5=Dinner; 7=Anytime. */
                mealTypeId: 1 | 2 | 3 | 4 | 5 | 7;
                /** The ID of units used. Typically retrieved via a previous call to Get Food Logs, Search Foods, or Get Food Units. */
                unitId: id;
                calories?: number;
            }
        >(opts: O & { logId: id; amount: number; }) => {
            const { logId, data } = opts;
            const params = objRemoveKeys(opts, ['data', 'logId']) as Dict<string | number>;

            this.handleData<
                O['data'] extends 'water' ? { waterLog: WaterLog } : { foodLog: FoodLog }
            >(() => this.api.post(this.url(1, `foods/log${data === 'water' ? '/water' : ''}/${logId}.json${dictToUrlParams(params)}`)));
        },


        // --- // MEALS // --- //
        /** Creates a meal with the given food.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-meal/
         * 
         * Endpoint doesn't match the documentation:
         * https://community.fitbit.com/t5/Web-API-Development/Create-a-meal-using-the-API-return-emtpy-array-and-I-don-t-understand-why/m-p/4839132#M13151
         * 
         * To get the correct input use the type definitions in opts.
         */
        createMeal: (opts: {
            name: string;
            description: string;
            mealFoods: {
                foodId: id;
                unitId: id;
                amount: number;
            }[];
        }) => this.handleData<{ meal: Meal; }>(() => this.api.post(this.url(1, `meals.json`), opts)),

        /** Retrieves a single meal created by the user from their food log given the meal id.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-meal/
         */
        getMeal: (mealId: id) =>
            this.handleData<{ meal: Meal; }>(() => this.api.get(this.url(1, `meals/${mealId}.json`))),

        /** Retrieves a list of meals created by the user from their food log.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-meals/
         */
        getMealList: () =>
            this.handleData<{ meals: Meal[]; }>(() => this.api.get(this.url(1, `meals.json`))),

        /** Updates an existing meal with the contents of the request.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/update-meal/
         */
        updateMeal: (opts: {
            mealId: id;
            name: string;
            description: string;
            mealFoods: {
                foodId: id;
                unitId: id;
                amount: number;
            }[];
        }) => this.handleData<{ meal: Meal; }>(() => this.api.post(this.url(1, `meals/${opts.mealId}.json`), objRemoveKeys(opts, ['mealId']))),

        /** Deletes an existing meal of the given meal ID.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/delete-meal/
         */
        deleteMeal: (mealId: id) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `meals/${mealId}.json`))),

        // --- // FAVORITE FOODS // --- //
        /** Adds a food with the given ID to the user's list of favorite foods.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/add-favorite-foods/
         */
        addFavoriteFood: (foodId: id) =>
            this.handleData<Record<string, never>>(() => this.api.post(this.url(1, `foods/log/favorite/${foodId}.json`))),
        
        /** Retrieves a list of user-specific favorite consumed foods.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-favorite-foods/
         */
        getFavoriteFoodList: () =>
            this.handleData<Food[]>(() => this.api.get(this.url(1, `foods/log/favorite.json`))),

        /** Deletes a food with the given ID from the user's list of favorite foods.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/delete-favorite-foods/
         */
        deleteFavoriteFood: (foodId: id) =>
            this.handleData<null>(() => this.api.delete(this.url(1, `foods/log/favorite/${foodId}.json`))),
        // Delete Favorite Foods deletes a food from the user's favorite food list.


        // --- // GOALS FOOD & WATER // --- //
        /** Creates or updates a user's daily calorie consumption or food plan goals. (OR) Creates or updates a user's daily water consumption goal.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-food-goal/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/create-water-goal/
         */
        createGoal: <
            O extends {
                data: 'water';
                target: number;
            } | ({
                data: 'food';
                personalized?: boolean;
            } & ({ calories: number } | { intensity: 'MAINTENANCE' | 'EASIER' | 'MEDIUM' | 'KINDAHARD' | 'HARDER' }))
        >(opts: O) => this.handleData<
            O['data'] extends 'water' ? { goal: WaterGoal } : { goals: FoodGoal }
        >(() => this.api.post(this.url(1, `foods/log${opts.data === 'water' ? '/water' : ''}/goal.json${dictToUrlParams(opts)}`))),

        /** Retrieves the user's current daily calorie consumption goal and/or food plan. (OR) Retrieves a user's daily water consumption goal.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-food-goals/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition/get-water-goal/
         */
        getGoal: <Data extends 'water' | 'food'>(data: Data) =>
            this.handleData<Data extends 'water' ? { goal: WaterGoal } : { goals: FoodGoal }>(() => this.api.get(this.url(1, `foods/log${data === 'water' ? '/water' : ''}/goal.json`))),
        
        
        
        // --- // TIME SERIES // --- //
        /** Retrieves the food and water consumption data for a given resource over a period of time by specifying a date or date range. The response will include only the daily summary values.
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition-timeseries/get-nutrition-timeseries-by-date/
         * 
         * https://dev.fitbit.com/build/reference/web-api/nutrition-timeseries/get-nutrition-timeseries-by-date-range/
        */
        getTimeSeries: <Data extends 'water' | 'food'>(opts: {
            type: 'By_Date';
            data: Data;
            date: AnyDate;
            period?: '1d' | '7d' | '30d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'max';
        } | {
            type: 'By_Range';
            data: Data;
            fromDate: AnyDate;
            toDate: AnyDate;
        }) => {
            const resource = opts.data === 'food' ? 'caloriesIn' : 'water';
            const url = this.url(1, opts.type === 'By_Date' ?
                `foods/log/${resource}/date/${dayAndTime(opts.date)[0]}/${opts.period || '1d'}.json`
                :
                `foods/log/${resource}/date/${dayAndTime(opts.fromDate)[0]}/${dayAndTime(opts.toDate)[0]}.json`
            );
            
            return this.handleData<
                Data extends 'food' ? { "foods-log-caloriesIn": DateVal[]; } : { "foods-log-water": DateVal[]; }
            >(() => this.api.get(url));
        },
    };

    /** Every time a Fitbit user opens the Fitbit mobile application, the Fitbit device
     * automatically syncs to fitbit.com. The average user syncs their Fitbit device several
     * times a day, and the user may manually log additional exercises and nutritional
     * information. Meanwhile, other users may sync their device sporadically, uploading as
     * much as a week's worth of data all at once. Because of the infrequency of updates,
     * Fitbit has developed a subscription service allowing 3rd-party applications to be
     * notified when a Fitbit user has updated their data. This prevents the need for you
     * to develop a polling or scheduling system looking for new data.
     * 
     * Using Subscriptions:
     * https://dev.fitbit.com/build/reference/web-api/developer-guide/using-subscriptions/
     * 
     * The Subscription endpoints allow an application to subscribe to user specific data.
     * Fitbit will send a webhook notification informing the application that the user has new
     * data to download. This functionality remove the need for application polling fitbit services
     * looking for new data. 
     * 
     * https://dev.fitbit.com/build/reference/web-api/subscription/
     * 
     * NOTE: This can't be used with browser code. Make sure to set up a subscriber endpoint with fitbit
     * were you manage fitbit api app credentials `https://dev.fitbit.com/apps`. To add this to an existing
     * application use the `Edit Application Settings` button.
     */
    subscription = {
        create: ({ collection, subscriptionId, subscriberId } : SubscriptionOpts) => {
            const url = this.subUrl(collection, subscriptionId);
            
            return this.handleData<{ apiSubscriptions: Subscription[] }>(() => this.api.post(
                url, void(0), void(0), subscriberId ? { 'X-Fitbit-Subscriber-Id': subscriberId } : { }
            ));
        },

        getList: ({ collection, subscriberId } : Pick<SubscriptionOpts, 'collection' | 'subscriberId'>) =>
            this.handleData<{ apiSubscriptions: Subscription[] }>(() => this.api.get(
                this.subUrl(collection),
                void(0),
                subscriberId ? { 'X-Fitbit-Subscriber-Id': subscriberId } : { }
            )),

        delete: ({ collection, subscriptionId, subscriberId } : SubscriptionOpts) => this.handleData<null>(() => this.api.delete(
            this.subUrl(collection, subscriptionId), subscriberId ? { 'X-Fitbit-Subscriber-Id': subscriberId } : { }
        )),
    } as const;

    private subUrl = (cl: SubscriptionCollection, id?: id) =>
        this.url(1, `${cl === 'all' ? '' : `${cl}/`}apiSubscriptions${id ? `/${id}` : ''}.json`);

    setAccessToken(token: string) {
        this.accessToken = token;
        this.api.setDefaultHeader('Authorization', `Bearer ${this.accessToken}`);
    }

    private async handleData<T>(dataCall: () => Promise<Response>, nRecur = 0): Promise<({
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
    }> {
        const response = await dataCall();
        const headers: Dict<string> = {};

        const iter = response.headers.entries();
        for (const [key, val] of iter) headers[key] = val;
        
        let json: T | FitbitError;

        try {
            json = await response.json();
        } catch {
            if (!response.ok) {
                const code = response.status;
                console.error(`${code === 500 ? 'Fitbit Internal' : 'Unhandled'} Error.`);

                if (code !== 500) throw new Error('Unhandled Error');
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            json = null as any;
        }

        if (!response.ok || (json && hasKey(json, 'errors'))) {
            let error: FitbitError | null = null;
            
            if (hasKey(json, 'errors')) {
                error = json;

                const { errorType: err } = json.errors[0];
                if ((err === "expired_token" || err === "invalid_token") && this.getToken && nRecur < 2) {
                    try {
                        const token = await this.getToken();
                        this.setAccessToken(token);
                        return await this.handleData(dataCall, nRecur + 1);
                    } catch(err) {
                        console.error(err);
                    }
                }
            }
    
            return {
                type: 'ERROR',
                isSuccess: false,
                code: response.status,
                error,
                response,
                headers
            };
        }
    
        return {
            type: 'SUCCESS',
            isSuccess: true,
            code: response.status,
            data: json,
            response,
            headers
        };
    }

    private async pageGenerator<O extends { pagination: Pagination; }, T>(startingUrl: string, dataKey: string) {
        let lastResponse = await this.handleData<O>(() => this.api.get(startingUrl));

        return (async function* (self: FitbitApi) {

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let allData: T[] = lastResponse.isSuccess ? [...(lastResponse.data as any)[dataKey] as T[]] : [];
            let totalCalls = 1;

            const getObj = () => ({ lastResponse, allData, totalCalls });

            if (lastResponse.type === 'ERROR') return getObj();
            yield getObj();

            let nextUrl = lastResponse.data.pagination.next;
            while (nextUrl) {
                lastResponse = await self.handleData<O>(() => self.api.get(nextUrl));
                totalCalls++;
                if (lastResponse.type === 'ERROR') return getObj();

                nextUrl = lastResponse.data.pagination.next;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                allData = [...allData, ...(lastResponse.data as any)[dataKey] as T[]];

                if (nextUrl) yield getObj();
            }

            return getObj();
        })(this);
    }
}
