import type { CardData, Suit } from './card.types';
import type { Card } from '../../client/lib/card';
export declare const GamePhase: {
    readonly DRAW: "DRAW";
    readonly MELD: "MELD";
    readonly DISCARD: "DISCARD";
    readonly GAME_OVER: "GAME_OVER";
};
export type GamePhase = typeof GamePhase[keyof typeof GamePhase];
export interface GameState {
    currentPlayerIndex: number;
    currentPlayerId: string;
    phase: GamePhase;
    turnNumber: number;
    players: PlayerGameState[];
    drawPileSize: number;
    discardPileTop: CardData | null;
    finishingCard: CardData | null;
    finishingCardDrawn: boolean;
    gameStartedAt: number;
    lastActionAt: number;
}
export interface PlayerGameState {
    id: string;
    name: string;
    handSize: number;
    hand?: CardData[];
    melds: CardData[][];
    hasOpened: boolean;
    isConnected: boolean;
    score: number;
    deadwood: number;
}
export interface MeldValidationResult {
    isValid: boolean;
    error?: string;
    selectedCards: Card[];
    validMelds: Card[][];
    invalidCards: Card[];
    totalScore: number;
    meldScores: number[];
    meetsOpenRequirement: boolean;
    minimumNeeded: number;
    hasOpened: boolean;
}
export interface GameConfig {
    minPlayers: number;
    maxPlayers: number;
    initialHandSize: number;
    openingRequirement: number;
    numDecks: number;
}
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
    gameLength: number;
}
export declare const MeldType: {
    readonly SET: "SET";
    readonly RUN: "RUN";
};
export type MeldType = typeof MeldType[keyof typeof MeldType];
export interface MeldInfo {
    type: MeldType;
    cards: CardData[];
    score: number;
    suit?: Suit;
    value?: number;
}
//# sourceMappingURL=game-state.types.d.ts.map