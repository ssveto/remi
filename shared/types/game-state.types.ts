// shared/types/game-state.types.ts
/**
 * Game state type definitions.
 * 
 * THIS IS THE SINGLE SOURCE OF TRUTH FOR GAME STATE TYPES.
 */

import type { CardData, Suit } from './card.types';
import type { Card } from '../../client/lib/card'; // Use Card class type

/**
 * Game phases that control what actions are valid.
 * Using const object + type for better compatibility with serialization.
 */
export const GamePhase = {
  DRAW: 'DRAW',
  MELD: 'MELD',
  DISCARD: 'DISCARD',
  GAME_OVER: 'GAME_OVER',
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

/**
 * Complete game state snapshot (server authoritative)
 */
export interface GameState {
  // Turn information
  currentPlayerIndex: number;
  currentPlayerId: string;
  phase: GamePhase;
  turnNumber: number;
  
  // Players
  players: PlayerGameState[];
  
  // Deck state
  drawPileSize: number;
  discardPileTop: CardData | null;
  finishingCard: CardData | null;
  finishingCardDrawn: boolean;
  
  // Game metadata
  gameStartedAt: number;
  lastActionAt: number;
}

/**
 * Individual player's game state
 */
export interface PlayerGameState {
  id: string;
  name: string;
  handSize: number;
  hand?: CardData[]; // Only sent to the player who owns it
  melds: CardData[][];
  hasOpened: boolean;
  isConnected: boolean;
  score: number; // Current meld score
  deadwood: number; // Value of cards not in melds
}

/**
 * Meld validation result
 */
export interface MeldValidationResult {
  isValid: boolean;
  error?: string;
  
  // Input
  selectedCards: Card[];
  
  // Analysis
  validMelds: Card[][]; // Groups of cards that form valid melds
  invalidCards: Card[]; // Cards that don't fit in any meld
  
  // Scoring
  totalScore: number;
  meldScores: number[]; // Score for each valid meld
  
  // Requirements
  meetsOpenRequirement: boolean; // Can player lay these melds?
  minimumNeeded: number; // How many more points needed to open (if not opened)
  hasOpened: boolean; // Has this player already opened?
}

/**
 * Game configuration
 */
export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  initialHandSize: number;
  openingRequirement: number; // Points needed to open (51)
  numDecks: number; // Number of card decks to use
}

/**
 * Game statistics (for end game)
 */
export interface GameStats {
  winner: {
    id: string;
    name: string;
    score: number;
  };
  finalScores: Array<{
    playerId: string;
    playerName: string;
    meldScore: number;
    deadwood: number;
    finalScore: number;
  }>;
  totalTurns: number;
  gameLength: number; // seconds
}

/**
 * Type for meld (set or run)
 */
export const MeldType = {
  SET: 'SET',
  RUN: 'RUN',
} as const;

export type MeldType = typeof MeldType[keyof typeof MeldType];

/**
 * Analyzed meld information
 */
export interface MeldInfo {
  type: MeldType;
  cards: CardData[];
  score: number;
  suit?: Suit; // For runs
  value?: number; // For sets
}