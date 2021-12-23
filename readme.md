This library supports both browser and nodejs.

## Install

Install npm or yarn library:

```
npm install @giveback007/fitbit-api
<or>
yarn add @giveback007/fitbit-api
```

## Polyfills
`NodeJs` requires fetch polyfills (not required if running in browser).

```typescript
// Using ES6 modules
import 'cross-fetch/polyfill';

// Using CommonJS modules
require('cross-fetch/polyfill');

global.FormData = require('form-data');
```

## Usage
If a `fitbit-user-id` isn't passed it will default to `"-"` for the current logged in user.

```typescript
import { FitbitApi } from '@giveback007/fitbit-api';

const api = new FitbitApi("<access-token>", "<fitbit-user-id>" || "-");

api.user.getProfile().then(profile => console.log(profile));
```

## Automatic Token Refresh
Pass in a function as a third argument, it will automatically be called on `"expired_token"` or `"invalid_token"` errors.

If the refresh function fails -> returns an error object with `"expired_token"` or `"invalid_token"`.

If new `"<access-token>"` is successfully retrieved the api will retry the call it first failed on.

```typescript
new FitbitApi("<access-token>", "<fitbit-user-id>", async () => {
  const newToken = await /* some code retrieving new access-token */;
  return newToken;
});
```

## List Of Supported Endpoints
### https://dev.fitbit.com/build/reference/web-api
* Activity `api.activity`:
  - [/activity/](https://dev.fitbit.com/build/reference/web-api/activity/)
  - [/activity-timeseries/](dev.fitbit.com/build/reference/web-api/)
  - [/intraday/get-activity-intraday-by-date/](https://dev.fitbit.com/build/reference/web-api/intraday/get-activity-intraday-by-date/)
  - [/intraday/get-activity-intraday-by-date-range/](https://dev.fitbit.com/build/reference/web-api/intraday/get-activity-intraday-by-date-range/)
* Body `api.body`: 
  - [/body/](https://dev.fitbit.com/build/reference/web-api/body/)
  - [/body-timeseries/](https://dev.fitbit.com/build/reference/web-api/body-timeseries/)
* Devices `api.devices`: 
  - [/devices/](https://dev.fitbit.com/build/reference/web-api/devices/)
* Friends `api.devices`: 
  - [/friends/](https://dev.fitbit.com/build/reference/web-api/friends/)
* HeartRate `api.heartRate`: 
  - [/heartrate-timeseries/](https://dev.fitbit.com/build/reference/web-api/heartrate-timeseries/)
  - [/intraday/get-heartrate-intraday-by-date/](https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date/)
  - [/intraday/get-heartrate-intraday-by-date-range/](https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date-range/)
* Nutrition `api.nutrition`: 
  - [/nutrition/](https://dev.fitbit.com/build/reference/web-api/nutrition/)
  - [/nutrition-timeseries/](https://dev.fitbit.com/build/reference/web-api/nutrition-timeseries/)
* Sleep `api.sleep`:
  - [/sleep/](https://dev.fitbit.com/build/reference/web-api/sleep/)
* Subscription `api.subscription`:
  - [/subscription/](https://dev.fitbit.com/build/reference/web-api/subscription/)
* User `api.user`: 
  - [/user/](https://dev.fitbit.com/build/reference/web-api/user/)

## Typescript & Intellisense
All data is typed and api endpoint with more complex interface arguments are boiled down to be easier to understand with the use intellisense.

![Typescript and intellisense](https://github.com/MyAlyce/fitbit-api/blob/main/public/intellisense.gif)

## Error Handling
Successful responses are wrapped in a success object:
```typescript
{
    "type": "SUCCESS",
    "isSuccess": true,
    "code": 200,
    "data": {...},
    "response": Response,
    "headers": {
        "content-type": "application/json; charset=utf-8"
    }
}
```

And an error response will return an error object:
```typescript
{
    "type": "ERROR",
    "isSuccess": false,
    "code": 401,
    "error": { "errors": [{...}], "success": false },
    "response": Response,
    "headers": {
        "content-length": "135",
        "content-type": "application/json"
    }
}
```

## Date Handling
Another quality of life implementation is how this api handles dates. When needing to input a date you will often see the `AnyDate` type. This allows the date to be passed as a variety of inputs. 

```typescript
type DateObj = { y: number; m?: number; d?: number, hr?: number, min?: number, sec?: number, ms?: number };
type AnyDate = string | number | Date | 'today' | 'now' | 'yesterday' | DateObj;

const date = 'today' || 'now' || 'yesterday' // -> ✔️
const date = 1640289705866 // -> ✔️
const date = 'Dec 23 2021 15:00:02' || '2021/12/23' || '2021 12 23' || ... // -> ✔️
const date = { y: 2021 } || { y: 2021, m: 12, d: 23 } || ... // -> ✔️
const date = new Date() // -> ✔️
const date = 'invalid date string' // -> ❌ throw new Error('Invalid Date')
const date = NaN // -> ❌ throw new Error('Invalid Date')
```

## Headers
Certain fitbit response headers (such as rate limiting) are unsupported by the browser and therefore won't show up when the api is called.

Some of these headers are:
* `fitbit-rate-limit-limit`
* `fitbit-rate-limit-remaining`
* `fitbit-rate-limit-reset`

## Subscriptions
This can't be accessed in the browser since it requires passing in headers that the browser doesn't support.

Make sure to set up a subscriber endpoint with fitbit were you manage fitbit api app credentials `https://dev.fitbit.com/apps`. To add this to an existing application use the `[Edit Application Settings]` button.

For more information: https://dev.fitbit.com/build/reference/web-api/developer-guide/using-subscriptions/

## getLogList() & Generators
This library uses generators to load `.sleep.getLogList()` for `/sleep/get-sleep-log-list/` and `.activity.getLogList()` for `/activity/get-activity-log-list/`, these endpoints limit data at 100 objects per call and return a `"next"` link.

To make life easier you can keep calling the `generator.next()` to automatically retrieve the next set of data. 

```typescript
const generator = await api.activity.getLogList({ beforeDate: 'now' });
await generator.next();
// ->
{
    value: {
        allData: [{...}] // the full collection of all .next() calls.
        lastResponse: {
            "type": "SUCCESS",
            "isSuccess": true,
            "code": 200,
            "data": {...}
        ],
        totalCalls: 1 // the amount of times .next() called up to this obj.
    },
    done: false // this will be `true` when there's no more data to retrieve.
}
```

## Developer Discord
This project is by the [MyAlyce team](https://github.com/myalyce). If you have any questions join us on discord:

[Invitation Link](https://discord.gg/bbA8Nfd7de), use `#fitbit_integration` channel for fitbit api specific things.

## TODOs
QUICK TODOS:
* setup a publish script
* set this up:
  https://hackernoon.com/these-6-essential-tools-will-maintain-your-npm-modules-for-you-4cbbee88e0cb
* publish to npm
* chart based api data

TODO:
* additional header handling (localization etc.)
* a way to handle rate limiting
  - rate limiting headers only exist in node (possibly make rate limiting utils, look up how rate limiting translates to the end user)
* tests
* set up subscription endpoint on alyce
* research some form of swagger api change detection
* turn everything from fitbit into package. (eg. auth on nodejs & browser side)
  - separate out parts that don't have node dependencies &import the non-node dependent parts with node parts.
* add a simple way to add-in/expose fitbit api endpoints. 
* implement 'Get Activity TCX' https://dev.fitbit.com/build/reference/web-api/activity/get-activity-tcx/
