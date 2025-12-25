// shared/types/player.types.ts
/**
 * Player and room type definitions.
 * 
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR PLAYER/ROOM TYPES.
 */

/**
 * Player information in a room (before/during game)
 */
export interface PlayerInfo {
  id: string;
  name: string;
  socketId: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

/**
 * Simplified player info for client display
 */
export interface PlayerInfoSimple {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

/**
 * Room state information (full - for server)
 */
export interface RoomState {
  id: string;
  hostId: string;
  maxPlayers: number;
  players: PlayerInfo[];
  hasStarted: boolean;
  isPrivate: boolean;
  password?: string; // Only on server
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Room state for client (no sensitive data)
 */
export interface RoomStateClient {
  roomId: string;
  hostId: string;
  maxPlayers: number;
  players: PlayerInfoSimple[];
  hasStarted: boolean;
  isPrivate: boolean;
}

/**
 * Public room info (for room list/lobby)
 */
export interface PublicRoomInfo {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  hasStarted: boolean;
  createdAt: number;
}

/**
 * Player action tracking (for statistics)
 */
export interface PlayerActionHistory {
  playerId: string;
  actions: PlayerAction[];
}

export const PlayerActionType = {
  DRAW: 'DRAW',
  DRAW_DISCARD: 'DRAW_DISCARD',
  DRAW_FINISHING: 'DRAW_FINISHING',
  DISCARD: 'DISCARD',
  LAY_MELD: 'LAY_MELD',
  ADD_TO_MELD: 'ADD_TO_MELD',
  SKIP_MELD: 'SKIP_MELD',
} as const;

export type PlayerActionType = typeof PlayerActionType[keyof typeof PlayerActionType];

export interface PlayerAction {
  type: PlayerActionType;
  timestamp: number;
  cardId?: string;
  meldIds?: string[];
}

/**
 * Player preferences (for future use)
 */
export interface PlayerPreferences {
  playerId: string;
  autoSort: boolean; // Auto-sort hand
  confirmDiscard: boolean; // Confirm before discarding
  showTips: boolean; // Show helpful tips
  soundEnabled: boolean;
  theme: 'light' | 'dark';
}