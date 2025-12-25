// shared/index.ts
/**
 * Central export point for all shared code.
 * Import everything you need from '@shared' or '../../shared' in both client and server.
 * 
 * Usage:
 *   import { CardData, Suit, GamePhase, SocketEvent } from '@shared';
 *   import { MeldValidator, MoveValidator } from '@shared';
 */

// =============================================================================
// TYPES - Card
// =============================================================================
export type { Suit, CardData } from './types/card.types';
export { 
  isJoker, 
  getCardPoints, 
  getCardName, 
  cardsEqual, 
  cloneCard,
  isCardData,
} from './types/card.types';

// =============================================================================
// TYPES - Game State
// =============================================================================
export { GamePhase, MeldType } from './types/game-state.types';
export type { 
  GameState, 
  PlayerGameState, 
  MeldValidationResult,
  GameConfig,
  GameStats,
  MeldInfo,
} from './types/game-state.types';

// =============================================================================
// TYPES - Player
// =============================================================================
export { PlayerActionType } from './types/player.types';
export type { 
  PlayerInfo, 
  PlayerInfoSimple,
  RoomState, 
  RoomStateClient,
  PublicRoomInfo,
  PlayerAction,
  PlayerActionHistory,
  PlayerPreferences,
} from './types/player.types';

// =============================================================================
// TYPES - Socket Events
// =============================================================================
export { SocketEvent, EmoteType } from './types/socket-events';
export type {
  // Requests
  CreateRoomRequest,
  JoinRoomRequest,
  DrawCardRequest,
  DrawFromDiscardRequest,
  TakeFinishingCardRequest,
  DiscardCardRequest,
  LayMeldsRequest,
  SkipMeldRequest,
  AddToMeldRequest,
  ReorderHandRequest,
  ChatMessageRequest,
  // Responses
  CreateRoomResponse,
  JoinRoomResponse,
  GameStateUpdate,
  PlayerState,
  GameOverData,
  ErrorResponse,
  InfoMessage,
  // Chat
  ChatMessage,
  Emote,
  // Type guards
} from './types/socket-events';

export { 
  isGameStateUpdate, 
  isPlayerState, 
  isErrorResponse,
} from './types/socket-events';

// =============================================================================
// VALIDATION
// =============================================================================
export * from './validation/meld-validator';
export { 
  MoveValidator,
  type MoveValidationResult,
  type ValidatableGameState,
  type ValidatablePlayer,
} from './validation/move-validator';

// =============================================================================
// CONSTANTS
// =============================================================================
export * from './constants/game-config';
export * from './constants/error-codes';