export type Friend = {
    type:       "person";
    id:         string;
    attributes: {
        /** avatar url */
        avatar: string;
        child:  boolean;
        friend: boolean;
        name:   string;
    };
}

export type LeaderboardFriend = {
    type:          'ranked-user' | 'inactive-user';
    id:            string;
    attributes?:   {
        "step-rank":    number;
        "step-summary": number;
    };
    relationships: {
        data: { type: 'person'; id: string; };
    };
}