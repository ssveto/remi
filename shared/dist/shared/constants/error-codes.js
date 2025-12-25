"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_SEVERITY = exports.ErrorSeverity = exports.ERROR_MESSAGES = exports.ErrorCode = void 0;
exports.createError = createError;
exports.isRecoverableError = isRecoverableError;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["CONNECTION_FAILED"] = "CONNECTION_FAILED";
    ErrorCode["CONNECTION_TIMEOUT"] = "CONNECTION_TIMEOUT";
    ErrorCode["ALREADY_CONNECTED"] = "ALREADY_CONNECTED";
    ErrorCode["NOT_CONNECTED"] = "NOT_CONNECTED";
    ErrorCode["RECONNECT_FAILED"] = "RECONNECT_FAILED";
    ErrorCode["INVALID_SESSION"] = "INVALID_SESSION";
    ErrorCode["SESSION_EXPIRED"] = "SESSION_EXPIRED";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["ROOM_NOT_FOUND"] = "ROOM_NOT_FOUND";
    ErrorCode["ROOM_FULL"] = "ROOM_FULL";
    ErrorCode["ROOM_CLOSED"] = "ROOM_CLOSED";
    ErrorCode["ALREADY_IN_ROOM"] = "ALREADY_IN_ROOM";
    ErrorCode["NOT_IN_ROOM"] = "NOT_IN_ROOM";
    ErrorCode["INVALID_ROOM_CODE"] = "INVALID_ROOM_CODE";
    ErrorCode["WRONG_PASSWORD"] = "WRONG_PASSWORD";
    ErrorCode["GAME_ALREADY_STARTED"] = "GAME_ALREADY_STARTED";
    ErrorCode["NOT_HOST"] = "NOT_HOST";
    ErrorCode["TOO_FEW_PLAYERS"] = "TOO_FEW_PLAYERS";
    ErrorCode["TOO_MANY_PLAYERS"] = "TOO_MANY_PLAYERS";
    ErrorCode["PLAYER_NOT_FOUND"] = "PLAYER_NOT_FOUND";
    ErrorCode["PLAYER_DISCONNECTED"] = "PLAYER_DISCONNECTED";
    ErrorCode["PLAYER_TIMEOUT"] = "PLAYER_TIMEOUT";
    ErrorCode["INVALID_PLAYER_NAME"] = "INVALID_PLAYER_NAME";
    ErrorCode["DUPLICATE_PLAYER_NAME"] = "DUPLICATE_PLAYER_NAME";
    ErrorCode["NOT_YOUR_TURN"] = "NOT_YOUR_TURN";
    ErrorCode["WRONG_PHASE"] = "WRONG_PHASE";
    ErrorCode["TURN_TIMEOUT"] = "TURN_TIMEOUT";
    ErrorCode["ACTION_NOT_ALLOWED"] = "ACTION_NOT_ALLOWED";
    ErrorCode["INVALID_MOVE"] = "INVALID_MOVE";
    ErrorCode["CARD_NOT_FOUND"] = "CARD_NOT_FOUND";
    ErrorCode["CARD_NOT_IN_HAND"] = "CARD_NOT_IN_HAND";
    ErrorCode["CARD_ALREADY_PLAYED"] = "CARD_ALREADY_PLAYED";
    ErrorCode["INVALID_CARD"] = "INVALID_CARD";
    ErrorCode["HAND_FULL"] = "HAND_FULL";
    ErrorCode["HAND_EMPTY"] = "HAND_EMPTY";
    ErrorCode["EMPTY_DECK"] = "EMPTY_DECK";
    ErrorCode["EMPTY_DISCARD"] = "EMPTY_DISCARD";
    ErrorCode["NO_FINISHING_CARD"] = "NO_FINISHING_CARD";
    ErrorCode["FINISHING_CARD_TAKEN"] = "FINISHING_CARD_TAKEN";
    ErrorCode["INVALID_MELD"] = "INVALID_MELD";
    ErrorCode["INSUFFICIENT_POINTS"] = "INSUFFICIENT_POINTS";
    ErrorCode["NOT_OPENED"] = "NOT_OPENED";
    ErrorCode["ALREADY_OPENED"] = "ALREADY_OPENED";
    ErrorCode["DUPLICATE_CARDS"] = "DUPLICATE_CARDS";
    ErrorCode["MELD_NOT_FOUND"] = "MELD_NOT_FOUND";
    ErrorCode["INVALID_ADDITION"] = "INVALID_ADDITION";
    ErrorCode["CARDS_REMAINING"] = "CARDS_REMAINING";
    ErrorCode["MELD_TOO_SMALL"] = "MELD_TOO_SMALL";
    ErrorCode["MELD_TOO_LARGE"] = "MELD_TOO_LARGE";
    ErrorCode["CANNOT_DISCARD_DRAWN_CARD"] = "CANNOT_DISCARD_DRAWN_CARD";
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["INVALID_FORMAT"] = "INVALID_FORMAT";
    ErrorCode["GAME_NOT_STARTED"] = "GAME_NOT_STARTED";
    ErrorCode["GAME_ALREADY_ENDED"] = "GAME_ALREADY_ENDED";
    ErrorCode["INVALID_GAME_STATE"] = "INVALID_GAME_STATE";
    ErrorCode["STATE_SYNC_FAILED"] = "STATE_SYNC_FAILED";
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorCode["MAINTENANCE_MODE"] = "MAINTENANCE_MODE";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
exports.ERROR_MESSAGES = {
    [ErrorCode.CONNECTION_FAILED]: 'Failed to connect to server',
    [ErrorCode.CONNECTION_TIMEOUT]: 'Connection timed out',
    [ErrorCode.ALREADY_CONNECTED]: 'Already connected to server',
    [ErrorCode.NOT_CONNECTED]: 'Not connected to server',
    [ErrorCode.RECONNECT_FAILED]: 'Failed to reconnect',
    [ErrorCode.INVALID_SESSION]: 'Invalid session',
    [ErrorCode.SESSION_EXPIRED]: 'Session expired',
    [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
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
    [ErrorCode.PLAYER_NOT_FOUND]: 'Player not found',
    [ErrorCode.PLAYER_DISCONNECTED]: 'Player disconnected',
    [ErrorCode.PLAYER_TIMEOUT]: 'Player timed out',
    [ErrorCode.INVALID_PLAYER_NAME]: 'Invalid player name',
    [ErrorCode.DUPLICATE_PLAYER_NAME]: 'Player name already taken',
    [ErrorCode.NOT_YOUR_TURN]: "It's not your turn",
    [ErrorCode.WRONG_PHASE]: 'Cannot perform this action in current phase',
    [ErrorCode.TURN_TIMEOUT]: 'Turn timed out',
    [ErrorCode.ACTION_NOT_ALLOWED]: 'Action not allowed',
    [ErrorCode.INVALID_MOVE]: 'Move not allowed',
    [ErrorCode.CARD_NOT_FOUND]: 'Card not found',
    [ErrorCode.CARD_NOT_IN_HAND]: 'Card is not in your hand',
    [ErrorCode.CARD_ALREADY_PLAYED]: 'Card has already been played',
    [ErrorCode.INVALID_CARD]: 'Invalid card',
    [ErrorCode.HAND_FULL]: 'Hand is full',
    [ErrorCode.HAND_EMPTY]: 'Hand is empty',
    [ErrorCode.EMPTY_DECK]: 'Draw pile is empty',
    [ErrorCode.EMPTY_DISCARD]: 'Discard pile is empty',
    [ErrorCode.NO_FINISHING_CARD]: 'Finishing card not available',
    [ErrorCode.FINISHING_CARD_TAKEN]: 'Finishing card has already been taken',
    [ErrorCode.CANNOT_DISCARD_DRAWN_CARD]: 'Finishing card has already been taken',
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
    [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
    [ErrorCode.INVALID_INPUT]: 'Invalid input',
    [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field',
    [ErrorCode.INVALID_FORMAT]: 'Invalid format',
    [ErrorCode.GAME_NOT_STARTED]: 'Game has not started',
    [ErrorCode.GAME_ALREADY_ENDED]: 'Game has already ended',
    [ErrorCode.INVALID_GAME_STATE]: 'Invalid game state',
    [ErrorCode.STATE_SYNC_FAILED]: 'Failed to sync game state',
    [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests - please slow down',
    [ErrorCode.MAINTENANCE_MODE]: 'Server is under maintenance',
    [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
};
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
exports.ERROR_SEVERITY = {
    [ErrorCode.CONNECTION_FAILED]: ErrorSeverity.ERROR,
    [ErrorCode.CONNECTION_TIMEOUT]: ErrorSeverity.WARNING,
    [ErrorCode.ALREADY_CONNECTED]: ErrorSeverity.INFO,
    [ErrorCode.NOT_CONNECTED]: ErrorSeverity.ERROR,
    [ErrorCode.RECONNECT_FAILED]: ErrorSeverity.ERROR,
    [ErrorCode.INVALID_SESSION]: ErrorSeverity.ERROR,
    [ErrorCode.SESSION_EXPIRED]: ErrorSeverity.WARNING,
    [ErrorCode.UNAUTHORIZED]: ErrorSeverity.ERROR,
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
    [ErrorCode.PLAYER_NOT_FOUND]: ErrorSeverity.ERROR,
    [ErrorCode.PLAYER_DISCONNECTED]: ErrorSeverity.WARNING,
    [ErrorCode.PLAYER_TIMEOUT]: ErrorSeverity.WARNING,
    [ErrorCode.INVALID_PLAYER_NAME]: ErrorSeverity.WARNING,
    [ErrorCode.DUPLICATE_PLAYER_NAME]: ErrorSeverity.WARNING,
    [ErrorCode.NOT_YOUR_TURN]: ErrorSeverity.INFO,
    [ErrorCode.WRONG_PHASE]: ErrorSeverity.INFO,
    [ErrorCode.TURN_TIMEOUT]: ErrorSeverity.WARNING,
    [ErrorCode.ACTION_NOT_ALLOWED]: ErrorSeverity.INFO,
    [ErrorCode.INVALID_MOVE]: ErrorSeverity.WARNING,
    [ErrorCode.CARD_NOT_FOUND]: ErrorSeverity.ERROR,
    [ErrorCode.CARD_NOT_IN_HAND]: ErrorSeverity.WARNING,
    [ErrorCode.CARD_ALREADY_PLAYED]: ErrorSeverity.WARNING,
    [ErrorCode.INVALID_CARD]: ErrorSeverity.WARNING,
    [ErrorCode.HAND_FULL]: ErrorSeverity.WARNING,
    [ErrorCode.HAND_EMPTY]: ErrorSeverity.INFO,
    [ErrorCode.EMPTY_DECK]: ErrorSeverity.INFO,
    [ErrorCode.EMPTY_DISCARD]: ErrorSeverity.INFO,
    [ErrorCode.NO_FINISHING_CARD]: ErrorSeverity.INFO,
    [ErrorCode.FINISHING_CARD_TAKEN]: ErrorSeverity.INFO,
    [ErrorCode.CANNOT_DISCARD_DRAWN_CARD]: ErrorSeverity.INFO,
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
    [ErrorCode.VALIDATION_FAILED]: ErrorSeverity.WARNING,
    [ErrorCode.INVALID_INPUT]: ErrorSeverity.WARNING,
    [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorSeverity.WARNING,
    [ErrorCode.INVALID_FORMAT]: ErrorSeverity.WARNING,
    [ErrorCode.GAME_NOT_STARTED]: ErrorSeverity.WARNING,
    [ErrorCode.GAME_ALREADY_ENDED]: ErrorSeverity.INFO,
    [ErrorCode.INVALID_GAME_STATE]: ErrorSeverity.ERROR,
    [ErrorCode.STATE_SYNC_FAILED]: ErrorSeverity.ERROR,
    [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL,
    [ErrorCode.SERVICE_UNAVAILABLE]: ErrorSeverity.CRITICAL,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorSeverity.WARNING,
    [ErrorCode.MAINTENANCE_MODE]: ErrorSeverity.INFO,
    [ErrorCode.UNKNOWN_ERROR]: ErrorSeverity.ERROR,
};
function createError(code, customMessage, details) {
    return {
        code,
        message: customMessage || exports.ERROR_MESSAGES[code],
        severity: exports.ERROR_SEVERITY[code],
        details,
        timestamp: Date.now(),
    };
}
function isRecoverableError(code) {
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
//# sourceMappingURL=error-codes.js.map