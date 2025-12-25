import type { CardData } from './card.types';
import type { GamePhase } from './game-state.types';
export type { CardData, Suit } from './card.types';
export type { GamePhase, PlayerGameState, MeldValidationResult } from './game-state.types';
export type { PlayerInfoSimple, RoomStateClient } from './player.types';
export declare const SocketEvent: {
    readonly CONNECT: "connect";
    readonly DISCONNECT: "disconnect";
    readonly CREATE_ROOM: "createRoom";
    readonly JOIN_ROOM: "joinRoom";
    readonly LEAVE_ROOM: "leaveRoom";
    readonly START_GAME: "startGame";
    readonly RECONNECT: "reconnect";
    readonly ROUND_STARTED: "roundStarted";
    readonly ROUND_ENDED: "roundEnded";
    readonly START_NEW_ROUND: "startNewRound";
    readonly ROOM_CREATED: "roomCreated";
    readonly ROOM_JOINED: "roomJoined";
    readonly ROOM_UPDATED: "roomUpdated";
    readonly PLAYER_JOINED: "playerJoined";
    readonly PLAYER_LEFT: "playerLeft";
    readonly PLAYER_RECONNECTED: "playerReconnected";
    readonly GAME_STARTED: "gameStarted";
    readonly PUBLIC_ROOMS: "publicRooms";
    readonly ROOM_LIST: "roomList";
    readonly GET_ROOMS: "getRooms";
    readonly DRAW_CARD: "drawCard";
    readonly DRAW_FROM_DISCARD: "drawFromDiscard";
    readonly TAKE_FINISHING_CARD: "takeFinishingCard";
    readonly DISCARD_CARD: "discardCard";
    readonly LAY_MELDS: "layMelds";
    readonly SKIP_MELD: "skipMeld";
    readonly ADD_TO_MELD: "addToMeld";
    readonly REORDER_HAND: "reorderHand";
    readonly UNDO_SPECIAL_DRAW: "undoSpecialDraw";
    readonly UNDO_CONFIRMED: "undoConfirmed";
    readonly GAME_STATE_UPDATE: "gameStateUpdate";
    readonly TURN_CHANGED: "turnChanged";
    readonly CARD_DRAWN: "cardDrawn";
    readonly CARD_DISCARDED: "cardDiscarded";
    readonly MELDS_LAID: "meldsLaid";
    readonly MELD_PHASE_SKIPPED: "meldPhaseSkipped";
    readonly CARD_ADDED_TO_MELD: "cardAddedToMeld";
    readonly PHASE_CHANGED: "phaseChanged";
    readonly GAME_OVER: "gameOver";
    readonly CHAT_MESSAGE: "chatMessage";
    readonly EMOTE: "emote";
    readonly ERROR: "error";
    readonly INFO: "info";
};
export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];
export interface CreateRoomRequest {
    playerName: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
}
export interface JoinRoomRequest {
    roomId: string;
    playerName: string;
    password?: string;
}
export interface RoundStartedData {
    round: number;
    totalRounds: number;
}
export interface RoundEndedData {
    round: number;
    winner: {
        id: string;
        name: string;
    };
    roundScores: Array<{
        playerId: string;
        playerName: string;
        score: number;
    }>;
    cumulativeScores: Array<{
        playerId: string;
        playerName: string;
        score: number;
    }>;
}
export interface StartNewRoundRequest {
    roomId: string;
}
export interface DrawCardRequest {
    roomId: string;
}
export interface DrawFromDiscardRequest {
    roomId: string;
}
export interface TakeFinishingCardRequest {
    roomId: string;
    playerId: string;
}
export interface DiscardCardRequest {
    roomId: string;
    cardId: string;
}
export interface LayMeldsRequest {
    roomId: string;
    melds: string[][];
}
export interface SkipMeldRequest {
    roomId: string;
    playerId: string;
}
export interface AddToMeldRequest {
    roomId: string;
    playerId: string;
    cardId: string;
    meldOwner: string;
    meldIndex: number;
}
export interface ReorderHandRequest {
    roomId: string;
    fromIndex: number;
    toIndex: number;
}
export interface ChatMessageRequest {
    roomId: string;
    message: string;
}
export interface CreateRoomResponse {
    success: boolean;
    roomId?: string;
    playerId?: string;
    error?: string;
}
export interface JoinRoomResponse {
    success: boolean;
    roomId?: string;
    playerId?: string;
    error?: string;
}
export interface GameStateUpdate {
    currentPlayerId: string;
    currentPlayerName: string;
    phase: GamePhase;
    currentRound: number;
    totalRounds: number;
    players: PlayerState[];
    drawPileSize: number;
    discardPileTop: CardData | null;
    finishingCard: CardData | null;
    finishingCardDrawn: boolean;
    myHand?: CardData[];
    turnNumber: number;
    gameStartTime: number;
}
export interface PlayerState {
    id: string;
    name: string;
    handSize: number;
    hasOpened: boolean;
    melds: CardData[][];
    isCurrentPlayer: boolean;
    isConnected: boolean;
    score: number;
}
export interface GameOverData {
    winner: {
        id: string;
        name: string;
        score: number;
    };
    finalScores: Array<{
        playerId: string;
        playerName: string;
        score: number;
        deadwood: number;
    }>;
    gameLength: number;
    totalTurns: number;
}
export interface ErrorResponse {
    code: string;
    message: string;
    details?: any;
}
export interface InfoMessage {
    type: 'info' | 'warning' | 'success';
    message: string;
    duration?: number;
}
export interface ChatMessage {
    playerId: string;
    playerName: string;
    message: string;
    timestamp: number;
}
export declare const EmoteType: {
    readonly NICE: "nice";
    readonly OOPS: "oops";
    readonly THINKING: "thinking";
    readonly GG: "gg";
};
export type EmoteType = typeof EmoteType[keyof typeof EmoteType];
export interface Emote {
    playerId: string;
    playerName: string;
    emoteType: EmoteType;
    timestamp: number;
}
export declare function isGameStateUpdate(obj: any): obj is GameStateUpdate;
export declare function isPlayerState(obj: any): obj is PlayerState;
export declare function isErrorResponse(obj: any): obj is ErrorResponse;
//# sourceMappingURL=socket-events.d.ts.map