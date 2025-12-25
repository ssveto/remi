// shared/types/socket-events.ts
/**
 * Socket.io event definitions and payload types.
 * 
 * IMPORTANT: This file imports types from other files.
 * Do NOT redefine CardData, GamePhase, PlayerInfo, etc. here!
 */

import type { CardData } from './card.types';
import type { GamePhase } from './game-state.types';
//import type { PlayerInfoSimple, RoomStateClient } from './player.types';

// Re-export for convenience
export type { CardData, Suit } from './card.types';
export type { GamePhase, PlayerGameState, MeldValidationResult } from './game-state.types';
export type { PlayerInfoSimple, RoomStateClient } from './player.types';

// =============================================================================
// SOCKET EVENTS
// =============================================================================

export const SocketEvent = {
  // Connection
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  
  // Room Management
  CREATE_ROOM: "createRoom",
  JOIN_ROOM: "joinRoom",
  LEAVE_ROOM: "leaveRoom",
  START_GAME: "startGame",
  RECONNECT: "reconnect",

  // Round management
  ROUND_STARTED: "roundStarted",
  ROUND_ENDED: "roundEnded",
  START_NEW_ROUND: "startNewRound",
  
  // Room Events (server -> clients)
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
  
  // Game Actions (client -> server)
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
  
  // Game Events (server -> clients)
  GAME_STATE_UPDATE: "gameStateUpdate",
  TURN_CHANGED: "turnChanged",
  CARD_DRAWN: "cardDrawn",
  CARD_DISCARDED: "cardDiscarded",
  MELDS_LAID: "meldsLaid",
  MELD_PHASE_SKIPPED: "meldPhaseSkipped",
  CARD_ADDED_TO_MELD: "cardAddedToMeld",
  PHASE_CHANGED: "phaseChanged",
  GAME_OVER: "gameOver",
  
  // Chat & Social
  CHAT_MESSAGE: "chatMessage",
  EMOTE: "emote",
  
  // Errors & Info
  ERROR: "error",
  INFO: "info",
} as const;

export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];

// =============================================================================
// REQUEST PAYLOADS (Client -> Server)
// =============================================================================

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
  melds: string[][]; // Array of arrays of card IDs
}

export interface SkipMeldRequest {
  roomId: string;
  playerId: string;
}

export interface AddToMeldRequest {
  roomId: string;
  playerId: string;
  cardId: string;
  meldOwner: string;   // Player ID who owns the meld (multiplayer uses IDs)
  meldIndex: number;   // Which meld of that player (0-indexed)
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

// =============================================================================
// RESPONSE PAYLOADS (Server -> Client)
// =============================================================================

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

/**
 * Main game state update sent to clients
 */
export interface GameStateUpdate {
  // Current turn info
  currentPlayerId: string;
  currentPlayerName: string;
  phase: GamePhase;

  currentRound: number;
  totalRounds: number;
  
  // Players
  players: PlayerState[];
  
  // Shared game elements
  drawPileSize: number;
  discardPileTop: CardData | null;
  finishingCard: CardData | null;
  finishingCardDrawn: boolean;
  
  // My hand (only sent to the specific player)
  myHand?: CardData[];
  
  // Game metadata
  turnNumber: number;
  gameStartTime: number;
}

/**
 * Player state as seen by other players (no hand details)
 */
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
  gameLength: number; // in seconds
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
  duration?: number; // milliseconds to display
}

// =============================================================================
// CHAT & SOCIAL
// =============================================================================

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export const EmoteType = {
  NICE: 'nice',
  OOPS: 'oops',
  THINKING: 'thinking',
  GG: 'gg',
} as const;

export type EmoteType = typeof EmoteType[keyof typeof EmoteType];

export interface Emote {
  playerId: string;
  playerName: string;
  emoteType: EmoteType;
  timestamp: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isGameStateUpdate(obj: any): obj is GameStateUpdate {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.currentPlayerId === 'string' &&
    typeof obj.phase === 'string' &&
    Array.isArray(obj.players)
  );
}

export function isPlayerState(obj: any): obj is PlayerState {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.handSize === 'number' &&
    typeof obj.hasOpened === 'boolean' &&
    Array.isArray(obj.melds)
  );
}

export function isErrorResponse(obj: any): obj is ErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string'
  );
}