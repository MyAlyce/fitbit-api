export type SubscriptionCollection = 'all' | 'activities' | 'body' | 'foods' | 'sleep' | 'userRevokedAccess';

export type Subscription = {
    collectionType: string;
    ownerId: string;
    ownerType: string;
    subscriberId: string;
    subscriptionId: string;
}

export type SubscriptionOpts = {
    /** Collection of data to retrieve notifications.
     * 
     * `all` -> a subscription will be created for all collections.
     * 
     * If both all and specific collection subscriptions are created, duplicate notifications will be received.
     * Each subscriber can have only one subscription for a specific user's collection.
     */
    collection: SubscriptionCollection;

    /** Subscription-id you wish to use for the subscription instance you are creating, this is not the same as
     * `subscriberId`. If not specified fitbit will generate one for you.
    */
    subscriptionId?: string | number;

    /** `Subscriber-Id` used for your applications subscribers.
     * 
     * This can be setup on `https://dev.fitbit.com/apps`. If not yet set up use `[Edit Application Settings]`
     * to add a subscriber.
     * 
     * If not specified fitbit will subscriber set us as `default` from you list of subscribers.
     */
    subscriberId?: string | number,
}
