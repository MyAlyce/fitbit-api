export interface Badge {
    badgeGradientEndColor:   string;
    badgeGradientStartColor: string;
    badgeType:               BadgeType;
    category:                string;
    /** Type unknown */
    cheers:                  unknown[];
    dateTime:                string;
    description:             string;
    earnedMessage:           string;
    encodedId:               string;
    image100px:              string;
    image125px:              string;
    image300px:              string;
    image50px:               string;
    image75px:               string;
    marketingDescription:    string;
    mobileDescription:       string;
    name:                    string;
    shareImage640px:         string;
    shareText:               string;
    shortDescription:        string;
    shortName:               string;
    timesAchieved:           number;
    value:                   number;
    unit?:                   string;
}

export enum BadgeType {
    DailyFloors = "DAILY_FLOORS",
    DailySteps = "DAILY_STEPS",
    LifetimeDistance = "LIFETIME_DISTANCE",
}
