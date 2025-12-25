export declare const GAME_CONFIG: {
    readonly MIN_PLAYERS: 2;
    readonly MAX_PLAYERS: 4;
    readonly INITIAL_HAND_SIZE: 14;
    readonly MAX_HAND_SIZE: 15;
    readonly NUM_DECKS: 2;
    readonly CARDS_PER_DECK: 54;
    readonly OPENING_REQUIREMENT: 51;
    readonly MIN_MELD_SIZE: 3;
    readonly MAX_SET_SIZE: 4;
    readonly ACE_VALUE: 10;
    readonly FACE_CARD_VALUE: 10;
    readonly JOKER_VALUE: 0;
    readonly TURN_TIMEOUT: 60000;
    readonly GAME_TIMEOUT: 3600000;
    readonly INACTIVITY_TIMEOUT: 300000;
    readonly ROOM_CODE_LENGTH: 6;
    readonly ROOM_CLEANUP_INTERVAL: 60000;
    readonly INACTIVE_ROOM_TIMEOUT: 1800000;
    readonly RECONNECT_TIMEOUT: 30000;
    readonly MAX_RECONNECT_ATTEMPTS: 5;
};
export declare const CARD_VALUES: {
    readonly ACE_LOW: 1;
    readonly ACE_HIGH: 14;
    readonly JACK: 11;
    readonly QUEEN: 12;
    readonly KING: 13;
    readonly JOKER: 14;
};
export declare const PHASE_ORDER: readonly ["DRAW", "MELD", "DISCARD"];
export declare const SUITS: readonly ["HEART", "DIAMOND", "SPADE", "CLUB", "JOKER_RED", "JOKER_BLACK"];
export declare const REGULAR_SUITS: readonly ["HEART", "DIAMOND", "SPADE", "CLUB"];
export declare const JOKER_SUITS: readonly ["JOKER_RED", "JOKER_BLACK"];
export declare const VALIDATION_CONFIG: {
    readonly ALLOW_HIGH_ACE_RUNS: true;
    readonly ALLOW_WRAP_AROUND_RUNS: false;
    readonly MAX_JOKERS_IN_SET: 3;
    readonly REQUIRE_NATURAL_CARDS: true;
    readonly REQUIRE_DISCARD_TO_END_TURN: true;
    readonly ALLOW_REORDER_HAND: true;
    readonly ALLOW_UNDO_MELDS: false;
};
export declare const POINTS_CONFIG: {
    readonly WIN_BONUS: 100;
    readonly GOING_REMI_BONUS: 200;
    readonly DEADWOOD_PENALTY_MULTIPLIER: 1;
    readonly TIMEOUT_PENALTY: 50;
    readonly DISCONNECT_PENALTY: 100;
};
export declare const TIMING_CONFIG: {
    readonly CARD_DEAL_DELAY: 50;
    readonly CARD_DRAW_ANIMATION: 300;
    readonly CARD_DISCARD_ANIMATION: 300;
    readonly MELD_LAY_ANIMATION: 400;
    readonly TURN_CHANGE_DELAY: 500;
    readonly MESSAGE_DISPLAY_TIME: 2000;
};
export declare const DEBUG_CONFIG: {
    readonly ENABLE_LOGGING: boolean;
    readonly LOG_GAME_EVENTS: false;
    readonly LOG_VALIDATION: false;
    readonly SKIP_OPENING_REQUIREMENT: false;
    readonly FAST_AI_TURNS: false;
};
export declare const FEATURES: {
    readonly ENABLE_CHAT: true;
    readonly ENABLE_EMOTES: true;
    readonly ENABLE_SPECTATORS: false;
    readonly ENABLE_TOURNAMENTS: false;
    readonly ENABLE_ACHIEVEMENTS: false;
    readonly ENABLE_STATISTICS: true;
};
//# sourceMappingURL=game-config.d.ts.map