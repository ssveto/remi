// client/scenes/common.ts

/**
 * Scene keys for all game scenes
 */
export const SCENE_KEYS = {
  PRELOAD: "PreloadScene",
  MENU: 'MenuScene',
  SINGLE_PLAYER_SETUP: 'SinglePlayerSetupScene',  // ADD THIS
  LOBBY: 'LobbyScene',
  GAME: 'GameScene',
  SETTINGS: 'SettingsScene', // Future
} as const;

/**
 * Asset keys for Phaser assets
 */
export const ASSET_KEYS = {
  TITLE: 'TITLE',
  CLICK_TO_START: 'CLICK_TO_START',
  CARDS: 'CARDS',
} as const;

/**
 * Card dimensions
 */
// export const CARD_WIDTH = 73;
// export const CARD_HEIGHT = 104;

export const CARD_WIDTH = 219;
export const CARD_HEIGHT = 312;

/**
 * Color palette
 */
export const COLORS = {
  PRIMARY: 0x4CAF50,
  SECONDARY: 0x2196F3,
  SUCCESS: 0x4CAF50,
  WARNING: 0xFFC107,
  ERROR: 0xF44336,
  BACKGROUND: 0x1a1a1a,
  TEXT: 0xFFFFFF,
  TEXT_SECONDARY: 0xCCCCCC,
} as const;

/**
 * Z-depth layers
 */
export const DEPTHS = {
  BACKGROUND: 0,
  CARDS: 10,
  SELECTED_CARDS: 20,
  DRAG_CARD: 100,
  UI: 500,
  POPUP: 1000,
} as const;

/**
 * Game configuration constants
 */
export const GAME_CONSTANTS = {
  MAX_HAND_SIZE: 15,
  INITIAL_HAND_SIZE: 14,
  MIN_MELD_SIZE: 3,
  OPENING_REQUIREMENT: 51,
} as const;