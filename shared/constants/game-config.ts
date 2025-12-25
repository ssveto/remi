// shared/constants/game-config.ts

/**
 * Core game configuration constants
 * These define the rules of Remi
 */

export const GAME_CONFIG = {
  // Player limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  
  // Hand configuration
  INITIAL_HAND_SIZE: 14,
  MAX_HAND_SIZE: 15,
  
  // Deck configuration
  NUM_DECKS: 2,
  CARDS_PER_DECK: 54, // Including 2 jokers
  
  // Meld requirements
  OPENING_REQUIREMENT: 51, // Points needed to open
  MIN_MELD_SIZE: 3, // Minimum cards in a meld
  MAX_SET_SIZE: 4, // Maximum cards in a set (4 suits)
  
  // Scoring
  ACE_VALUE: 10,
  FACE_CARD_VALUE: 10, // J, Q, K
  JOKER_VALUE: 0, // Jokers have no fixed value
  
  // Game timing
  TURN_TIMEOUT: 60000, // 60 seconds per turn
  GAME_TIMEOUT: 3600000, // 1 hour max game length
  INACTIVITY_TIMEOUT: 300000, // 5 minutes of inactivity
  
  // Room settings
  ROOM_CODE_LENGTH: 6,
  ROOM_CLEANUP_INTERVAL: 60000, // Clean up old rooms every minute
  INACTIVE_ROOM_TIMEOUT: 1800000, // 30 minutes
  
  // Reconnection
  RECONNECT_TIMEOUT: 30000, // 30 seconds to reconnect
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;

/**
 * Card values for scoring
 */
export const CARD_VALUES = {
  ACE_LOW: 1,
  ACE_HIGH: 14,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
  JOKER: 14,
} as const;

/**
 * Phases in order
 */
export const PHASE_ORDER = ['DRAW', 'MELD', 'DISCARD'] as const;

/**
 * Suit configuration
 */
export const SUITS = ['HEART', 'DIAMOND', 'SPADE', 'CLUB', 'JOKER_RED', 'JOKER_BLACK'] as const;

export const REGULAR_SUITS = ['HEART', 'DIAMOND', 'SPADE', 'CLUB'] as const;

export const JOKER_SUITS = ['JOKER_RED', 'JOKER_BLACK'] as const;

/**
 * Game state validation
 */
export const VALIDATION_CONFIG = {
  // Meld validation
  ALLOW_HIGH_ACE_RUNS: true, // Q-K-A is valid
  ALLOW_WRAP_AROUND_RUNS: false, // K-A-2 is NOT valid
  MAX_JOKERS_IN_SET: 3, // Maximum jokers in a single set
  REQUIRE_NATURAL_CARDS: true, // Must have at least 1 non-joker
  
  // Move validation
  REQUIRE_DISCARD_TO_END_TURN: true,
  ALLOW_REORDER_HAND: true,
  ALLOW_UNDO_MELDS: false, // Can't undo after laying melds
} as const;

/**
 * Points calculation
 */
export const POINTS_CONFIG = {
  // Winning bonus
  WIN_BONUS: 100,
  
  // Going out without laying any melds
  GOING_REMI_BONUS: 200,
  
  // Penalties
  DEADWOOD_PENALTY_MULTIPLIER: 1,
  TIMEOUT_PENALTY: 50,
  DISCONNECT_PENALTY: 100,
} as const;

/**
 * Animation and UI timing (client-side only, but useful for both)
 */
export const TIMING_CONFIG = {
  CARD_DEAL_DELAY: 50, // ms between dealing cards
  CARD_DRAW_ANIMATION: 300, // ms for draw animation
  CARD_DISCARD_ANIMATION: 300, // ms for discard animation
  MELD_LAY_ANIMATION: 400, // ms for laying melds
  TURN_CHANGE_DELAY: 500, // ms before starting next turn
  MESSAGE_DISPLAY_TIME: 2000, // ms to show messages
} as const;

/**
 * Development/Debug settings
 */
export const DEBUG_CONFIG = {
  ENABLE_LOGGING: process.env.NODE_ENV !== 'production',
  LOG_GAME_EVENTS: false,
  LOG_VALIDATION: false,
  SKIP_OPENING_REQUIREMENT: false, // For testing
  FAST_AI_TURNS: false,
} as const;

/**
 * Feature flags
 */
export const FEATURES = {
  ENABLE_CHAT: true,
  ENABLE_EMOTES: true,
  ENABLE_SPECTATORS: false, // Coming soon
  ENABLE_TOURNAMENTS: false, // Coming soon
  ENABLE_ACHIEVEMENTS: false, // Coming soon
  ENABLE_STATISTICS: true,
} as const;