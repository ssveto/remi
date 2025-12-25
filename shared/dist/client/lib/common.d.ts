export type CardSuit = keyof typeof CARD_SUIT;
export declare const CARD_SUIT: {
    readonly HEART: "HEART";
    readonly DIAMOND: "DIAMOND";
    readonly SPADE: "SPADE";
    readonly CLUB: "CLUB";
    readonly JOKER_RED: "JOKER_RED";
    readonly JOKER_BLACK: "JOKER_BLACK";
};
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type CardSuitColor = keyof typeof CARD_SUIT_COLOR;
export declare const CARD_SUIT_COLOR: {
    readonly RED: "RED";
    readonly BLACK: "BLACK";
};
export declare const CARD_SUIT_TO_COLOR: {
    readonly HEART: "RED";
    readonly DIAMOND: "RED";
    readonly SPADE: "BLACK";
    readonly CLUB: "BLACK";
    readonly JOKER_RED: "RED";
    readonly JOKER_BLACK: "BLACK";
};
//# sourceMappingURL=common.d.ts.map