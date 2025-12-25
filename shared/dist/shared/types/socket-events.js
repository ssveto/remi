"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmoteType = exports.SocketEvent = void 0;
exports.isGameStateUpdate = isGameStateUpdate;
exports.isPlayerState = isPlayerState;
exports.isErrorResponse = isErrorResponse;
exports.SocketEvent = {
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    CREATE_ROOM: "createRoom",
    JOIN_ROOM: "joinRoom",
    LEAVE_ROOM: "leaveRoom",
    START_GAME: "startGame",
    RECONNECT: "reconnect",
    ROUND_STARTED: "roundStarted",
    ROUND_ENDED: "roundEnded",
    START_NEW_ROUND: "startNewRound",
    ROOM_CREATED: "roomCreated",
    ROOM_JOINED: "roomJoined",
    ROOM_UPDATED: "roomUpdated",
    PLAYER_JOINED: "playerJoined",
    PLAYER_LEFT: "playerLeft",
    PLAYER_RECONNECTED: "playerReconnected",
    GAME_STARTED: "gameStarted",
    PUBLIC_ROOMS: "publicRooms",
    ROOM_LIST: "roomList",
    GET_ROOMS: "getRooms",
    DRAW_CARD: "drawCard",
    DRAW_FROM_DISCARD: "drawFromDiscard",
    TAKE_FINISHING_CARD: "takeFinishingCard",
    DISCARD_CARD: "discardCard",
    LAY_MELDS: "layMelds",
    SKIP_MELD: "skipMeld",
    ADD_TO_MELD: "addToMeld",
    REORDER_HAND: "reorderHand",
    UNDO_SPECIAL_DRAW: "undoSpecialDraw",
    UNDO_CONFIRMED: "undoConfirmed",
    GAME_STATE_UPDATE: "gameStateUpdate",
    TURN_CHANGED: "turnChanged",
    CARD_DRAWN: "cardDrawn",
    CARD_DISCARDED: "cardDiscarded",
    MELDS_LAID: "meldsLaid",
    MELD_PHASE_SKIPPED: "meldPhaseSkipped",
    CARD_ADDED_TO_MELD: "cardAddedToMeld",
    PHASE_CHANGED: "phaseChanged",
    GAME_OVER: "gameOver",
    CHAT_MESSAGE: "chatMessage",
    EMOTE: "emote",
    ERROR: "error",
    INFO: "info",
};
exports.EmoteType = {
    NICE: 'nice',
    OOPS: 'oops',
    THINKING: 'thinking',
    GG: 'gg',
};
function isGameStateUpdate(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.currentPlayerId === 'string' &&
        typeof obj.phase === 'string' &&
        Array.isArray(obj.players));
}
function isPlayerState(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.id === 'string' &&
        typeof obj.name === 'string' &&
        typeof obj.handSize === 'number' &&
        typeof obj.hasOpened === 'boolean' &&
        Array.isArray(obj.melds));
}
function isErrorResponse(obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        typeof obj.code === 'string' &&
        typeof obj.message === 'string');
}
//# sourceMappingURL=socket-events.js.map