// shared/constants/error-codes.ts

/**
 * Standardized error codes for the game
 * Used by both client and server for consistent error handling
 */

export enum ErrorCode {
  // ========================================================================
  // CONNECTION ERRORS (1xxx)
  // ========================================================================
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  ALREADY_CONNECTED = 'ALREADY_CONNECTED',
  NOT_CONNECTED = 'NOT_CONNECTED',
  RECONNECT_FAILED = 'RECONNECT_FAILED',
  
  // ========================================================================
  // AUTHENTICATION ERRORS (2xxx)
  // ========================================================================
  INVALID_SESSION = 'INVALID_SESSION',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // ========================================================================
  // ROOM ERRORS (3xxx)
  // ========================================================================
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_CLOSED = 'ROOM_CLOSED',
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  INVALID_ROOM_CODE = 'INVALID_ROOM_CODE',
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  GAME_ALREADY_STARTED = 'GAME_ALREADY_STARTED',
  NOT_HOST = 'NOT_HOST',
  TOO_FEW_PLAYERS = 'TOO_FEW_PLAYERS',
  TOO_MANY_PLAYERS = 'TOO_MANY_PLAYERS',
  
  // ========================================================================
  // PLAYER ERRORS (4xxx)
  // ========================================================================
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED',
  PLAYER_TIMEOUT = 'PLAYER_TIMEOUT',
  INVALID_PLAYER_NAME = 'INVALID_PLAYER_NAME',
  DUPLICATE_PLAYER_NAME = 'DUPLICATE_PLAYER_NAME',
  
  // ========================================================================
  // TURN ERRORS (5xxx)
  // ========================================================================
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  WRONG_PHASE = 'WRONG_PHASE',
  TURN_TIMEOUT = 'TURN_TIMEOUT',
  ACTION_NOT_ALLOWED = 'ACTION_NOT_ALLOWED',
  INVALID_MOVE = "INVALID_MOVE",
  
  // ========================================================================
  // CARD ERRORS (6xxx)
  // ========================================================================
  CARD_NOT_FOUND = 'CARD_NOT_FOUND',
  CARD_NOT_IN_HAND = 'CARD_NOT_IN_HAND',
  CARD_ALREADY_PLAYED = 'CARD_ALREADY_PLAYED',
  INVALID_CARD = 'INVALID_CARD',
  HAND_FULL = 'HAND_FULL',
  HAND_EMPTY = 'HAND_EMPTY',
  
  // ========================================================================
  // DECK ERRORS (7xxx)
  // ========================================================================
  EMPTY_DECK = 'EMPTY_DECK',
  EMPTY_DISCARD = 'EMPTY_DISCARD',
  NO_FINISHING_CARD = 'NO_FINISHING_CARD',
  FINISHING_CARD_TAKEN = 'FINISHING_CARD_TAKEN',

  
  // ========================================================================
  // MELD ERRORS (8xxx)
  // ========================================================================
  INVALID_MELD = 'INVALID_MELD',
  INSUFFICIENT_POINTS = 'INSUFFICIENT_POINTS',
  NOT_OPENED = 'NOT_OPENED',
  ALREADY_OPENED = 'ALREADY_OPENED',
  DUPLICATE_CARDS = 'DUPLICATE_CARDS',
  MELD_NOT_FOUND = 'MELD_NOT_FOUND',
  INVALID_ADDITION = 'INVALID_ADDITION',
  CARDS_REMAINING = 'CARDS_REMAINING',
  MELD_TOO_SMALL = 'MELD_TOO_SMALL',
  MELD_TOO_LARGE = 'MELD_TOO_LARGE',
  CANNOT_DISCARD_DRAWN_CARD = 'CANNOT_DISCARD_DRAWN_CARD',
  
  // ========================================================================
  // VALIDATION ERRORS (9xxx)
  // ========================================================================
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // ========================================================================
  // GAME STATE ERRORS (10xxx)
  // ========================================================================
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  GAME_ALREADY_ENDED = 'GAME_ALREADY_ENDED',
  INVALID_GAME_STATE = 'INVALID_GAME_STATE',
  STATE_SYNC_FAILED = 'STATE_SYNC_FAILED',
  
  // ========================================================================
  // SERVER ERRORS (11xxx)
  // ========================================================================
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  
  // ========================================================================
  // UNKNOWN/OTHER (99xxx)
  // ========================================================================
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Human-readable error messages
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Connection
  [ErrorCode.CONNECTION_FAILED]: 'Failed to connect to server',
  [ErrorCode.CONNECTION_TIMEOUT]: 'Connection timed out',
  [ErrorCode.ALREADY_CONNECTED]: 'Already connected to server',
  [ErrorCode.NOT_CONNECTED]: 'Not connected to server',
  [ErrorCode.RECONNECT_FAILED]: 'Failed to reconnect',
  
  // Authentication
  [ErrorCode.INVALID_SESSION]: 'Invalid session',
  [ErrorCode.SESSION_EXPIRED]: 'Session expired',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
  
  // Room
  [ErrorCode.ROOM_NOT_FOUND]: 'Room not found',
  [ErrorCode.ROOM_FULL]: 'Room is full',
  [ErrorCode.ROOM_CLOSED]: 'Room has been closed',
  [ErrorCode.ALREADY_IN_ROOM]: 'Already in a room',
  [ErrorCode.NOT_IN_ROOM]: 'Not in a room',
  [ErrorCode.INVALID_ROOM_CODE]: 'Invalid room code',
  [ErrorCode.WRONG_PASSWORD]: 'Incorrect password',
  [ErrorCode.GAME_ALREADY_STARTED]: 'Game has already started',
  [ErrorCode.NOT_HOST]: 'Only the host can perform this action',
  [ErrorCode.TOO_FEW_PLAYERS]: 'Not enough players to start',
  [ErrorCode.TOO_MANY_PLAYERS]: 'Too many players',
  
  // Player
  [ErrorCode.PLAYER_NOT_FOUND]: 'Player not found',
  [ErrorCode.PLAYER_DISCONNECTED]: 'Player disconnected',
  [ErrorCode.PLAYER_TIMEOUT]: 'Player timed out',
  [ErrorCode.INVALID_PLAYER_NAME]: 'Invalid player name',
  [ErrorCode.DUPLICATE_PLAYER_NAME]: 'Player name already taken',
  
  // Turn
  [ErrorCode.NOT_YOUR_TURN]: "It's not your turn",
  [ErrorCode.WRONG_PHASE]: 'Cannot perform this action in current phase',
  [ErrorCode.TURN_TIMEOUT]: 'Turn timed out',
  [ErrorCode.ACTION_NOT_ALLOWED]: 'Action not allowed',
  [ErrorCode.INVALID_MOVE]: 'Move not allowed',

  
  // Cards
  [ErrorCode.CARD_NOT_FOUND]: 'Card not found',
  [ErrorCode.CARD_NOT_IN_HAND]: 'Card is not in your hand',
  [ErrorCode.CARD_ALREADY_PLAYED]: 'Card has already been played',
  [ErrorCode.INVALID_CARD]: 'Invalid card',
  [ErrorCode.HAND_FULL]: 'Hand is full',
  [ErrorCode.HAND_EMPTY]: 'Hand is empty',
  
  // Deck
  [ErrorCode.EMPTY_DECK]: 'Draw pile is empty',
  [ErrorCode.EMPTY_DISCARD]: 'Discard pile is empty',
  [ErrorCode.NO_FINISHING_CARD]: 'Finishing card not available',
  [ErrorCode.FINISHING_CARD_TAKEN]: 'Finishing card has already been taken',
  [ErrorCode.CANNOT_DISCARD_DRAWN_CARD]: 'Finishing card has already been taken',

  
  // Melds
  [ErrorCode.INVALID_MELD]: 'Invalid meld - must be a valid set or run',
  [ErrorCode.INSUFFICIENT_POINTS]: 'Insufficient points to open',
  [ErrorCode.NOT_OPENED]: 'Must open before performing this action',
  [ErrorCode.ALREADY_OPENED]: 'Cannot perform this action after opening',
  [ErrorCode.DUPLICATE_CARDS]: 'Cannot use the same card in multiple melds',
  [ErrorCode.MELD_NOT_FOUND]: 'Meld not found',
  [ErrorCode.INVALID_ADDITION]: 'Card cannot be added to this meld',
  [ErrorCode.CARDS_REMAINING]: 'Must lay down all cards to go out',
  [ErrorCode.MELD_TOO_SMALL]: 'Meld must have at least 3 cards',
  [ErrorCode.MELD_TOO_LARGE]: 'Invalid meld size',
  
  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  [ErrorCode.INVALID_INPUT]: 'Invalid input',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format',
  
  // Game state
  [ErrorCode.GAME_NOT_STARTED]: 'Game has not started',
  [ErrorCode.GAME_ALREADY_ENDED]: 'Game has already ended',
  [ErrorCode.INVALID_GAME_STATE]: 'Invalid game state',
  [ErrorCode.STATE_SYNC_FAILED]: 'Failed to sync game state',
  
  // Server
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests - please slow down',
  [ErrorCode.MAINTENANCE_MODE]: 'Server is under maintenance',
  
  // Other
  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
};

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Map error codes to severity levels
 */
export const ERROR_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  // Connection - mostly warnings
  [ErrorCode.CONNECTION_FAILED]: ErrorSeverity.ERROR,
  [ErrorCode.CONNECTION_TIMEOUT]: ErrorSeverity.WARNING,
  [ErrorCode.ALREADY_CONNECTED]: ErrorSeverity.INFO,
  [ErrorCode.NOT_CONNECTED]: ErrorSeverity.ERROR,
  [ErrorCode.RECONNECT_FAILED]: ErrorSeverity.ERROR,
  
  // Authentication - errors
  [ErrorCode.INVALID_SESSION]: ErrorSeverity.ERROR,
  [ErrorCode.SESSION_EXPIRED]: ErrorSeverity.WARNING,
  [ErrorCode.UNAUTHORIZED]: ErrorSeverity.ERROR,
  
  // Room - mostly warnings
  [ErrorCode.ROOM_NOT_FOUND]: ErrorSeverity.WARNING,
  [ErrorCode.ROOM_FULL]: ErrorSeverity.WARNING,
  [ErrorCode.ROOM_CLOSED]: ErrorSeverity.INFO,
  [ErrorCode.ALREADY_IN_ROOM]: ErrorSeverity.WARNING,
  [ErrorCode.NOT_IN_ROOM]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_ROOM_CODE]: ErrorSeverity.WARNING,
  [ErrorCode.WRONG_PASSWORD]: ErrorSeverity.WARNING,
  [ErrorCode.GAME_ALREADY_STARTED]: ErrorSeverity.INFO,
  [ErrorCode.NOT_HOST]: ErrorSeverity.WARNING,
  [ErrorCode.TOO_FEW_PLAYERS]: ErrorSeverity.WARNING,
  [ErrorCode.TOO_MANY_PLAYERS]: ErrorSeverity.WARNING,
  
  // Player
  [ErrorCode.PLAYER_NOT_FOUND]: ErrorSeverity.ERROR,
  [ErrorCode.PLAYER_DISCONNECTED]: ErrorSeverity.WARNING,
  [ErrorCode.PLAYER_TIMEOUT]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_PLAYER_NAME]: ErrorSeverity.WARNING,
  [ErrorCode.DUPLICATE_PLAYER_NAME]: ErrorSeverity.WARNING,
  
  // Turn - info/warnings
  [ErrorCode.NOT_YOUR_TURN]: ErrorSeverity.INFO,
  [ErrorCode.WRONG_PHASE]: ErrorSeverity.INFO,
  [ErrorCode.TURN_TIMEOUT]: ErrorSeverity.WARNING,
  [ErrorCode.ACTION_NOT_ALLOWED]: ErrorSeverity.INFO,
  [ErrorCode.INVALID_MOVE]: ErrorSeverity.WARNING,
  
  // Cards - warnings
  [ErrorCode.CARD_NOT_FOUND]: ErrorSeverity.ERROR,
  [ErrorCode.CARD_NOT_IN_HAND]: ErrorSeverity.WARNING,
  [ErrorCode.CARD_ALREADY_PLAYED]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_CARD]: ErrorSeverity.WARNING,
  [ErrorCode.HAND_FULL]: ErrorSeverity.WARNING,
  [ErrorCode.HAND_EMPTY]: ErrorSeverity.INFO,
  
  // Deck - info
  [ErrorCode.EMPTY_DECK]: ErrorSeverity.INFO,
  [ErrorCode.EMPTY_DISCARD]: ErrorSeverity.INFO,
  [ErrorCode.NO_FINISHING_CARD]: ErrorSeverity.INFO,
  [ErrorCode.FINISHING_CARD_TAKEN]: ErrorSeverity.INFO,
  [ErrorCode.CANNOT_DISCARD_DRAWN_CARD]: ErrorSeverity.INFO,

  
  // Melds - warnings
  [ErrorCode.INVALID_MELD]: ErrorSeverity.WARNING,
  [ErrorCode.INSUFFICIENT_POINTS]: ErrorSeverity.WARNING,
  [ErrorCode.NOT_OPENED]: ErrorSeverity.WARNING,
  [ErrorCode.ALREADY_OPENED]: ErrorSeverity.WARNING,
  [ErrorCode.DUPLICATE_CARDS]: ErrorSeverity.WARNING,
  [ErrorCode.MELD_NOT_FOUND]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_ADDITION]: ErrorSeverity.WARNING,
  [ErrorCode.CARDS_REMAINING]: ErrorSeverity.WARNING,
  [ErrorCode.MELD_TOO_SMALL]: ErrorSeverity.WARNING,
  [ErrorCode.MELD_TOO_LARGE]: ErrorSeverity.WARNING,
  
  // Validation - warnings
  [ErrorCode.VALIDATION_FAILED]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_INPUT]: ErrorSeverity.WARNING,
  [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_FORMAT]: ErrorSeverity.WARNING,
  
  // Game state - errors
  [ErrorCode.GAME_NOT_STARTED]: ErrorSeverity.WARNING,
  [ErrorCode.GAME_ALREADY_ENDED]: ErrorSeverity.INFO,
  [ErrorCode.INVALID_GAME_STATE]: ErrorSeverity.ERROR,
  [ErrorCode.STATE_SYNC_FAILED]: ErrorSeverity.ERROR,
  
  // Server - critical
  [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL,
  [ErrorCode.SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorSeverity.WARNING,
  [ErrorCode.MAINTENANCE_MODE]: ErrorSeverity.INFO,
  
  // Other
  [ErrorCode.UNKNOWN_ERROR]: ErrorSeverity.ERROR,
};

/**
 * Helper to create a standardized error object
 */
export interface GameError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  details?: any;
  timestamp: number;
}

export function createError(
  code: ErrorCode,
  customMessage?: string,
  details?: any
): GameError {
  return {
    code,
    message: customMessage || ERROR_MESSAGES[code],
    severity: ERROR_SEVERITY[code],
    details,
    timestamp: Date.now(),
  };
}

/**
 * Helper to check if an error is recoverable
 */
export function isRecoverableError(code: ErrorCode): boolean {
  const recoverableErrors = [
    ErrorCode.NOT_YOUR_TURN,
    ErrorCode.WRONG_PHASE,
    ErrorCode.CARD_NOT_IN_HAND,
    ErrorCode.INVALID_MELD,
    ErrorCode.INSUFFICIENT_POINTS,
    ErrorCode.CONNECTION_TIMEOUT,
  ];
  
  return recoverableErrors.includes(code);
}