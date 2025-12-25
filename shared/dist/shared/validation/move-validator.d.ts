import type { CardData } from '../types/card-data.types';
export interface MoveValidationResult {
    valid: boolean;
    error?: string;
    errorCode?: string;
}
export interface ValidatableGameState {
    currentPlayerId: string;
    phase: string;
    players: ValidatablePlayer[];
    drawPileSize: number;
    discardPileTop: CardData | null;
    finishingCard: CardData | null;
    finishingCardDrawn: boolean;
}
export interface ValidatablePlayer {
    id: string;
    name: string;
    handSize: number;
    hasOpened: boolean;
    melds: CardData[][];
    hand?: CardData[];
}
export declare class MoveValidator {
    static canDrawFromDeck(playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    static canDrawFromDiscard(playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    static isJoker(card: CardData): boolean;
    static canTakeFinishingCard(playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    static canDiscard(playerId: string, cardId: string, gameState: ValidatableGameState, playerHand?: CardData[]): MoveValidationResult;
    static canTransitionToPhase(currentPhase: string, targetPhase: string, playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    static validateHandSizeForAction(action: string, currentHandSize: number, hasOpened: boolean): MoveValidationResult;
    static canLayMelds(playerId: string, melds: CardData[][], gameState: ValidatableGameState, openingRequirement?: number, playerHand?: CardData[]): MoveValidationResult;
    static validateGameStateIntegrity(gameState: ValidatableGameState): MoveValidationResult;
    static canReorderHand(playerId: string, fromIndex: number, toIndex: number, handSize: number): MoveValidationResult;
    static canRemoveMeld(playerId: string, meldIndex: number, playerMelds: CardData[][]): MoveValidationResult;
    static canShuffleDeck(gameState: ValidatableGameState): MoveValidationResult;
    static canAddToMeld(playerId: string | number, cardId: string, meldOwner: string | number, meldIndex: number, gameState: ValidatableGameState, playerHand?: CardData[]): MoveValidationResult;
    static canSkipMeld(playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    static canGoOut(playerId: string, gameState: ValidatableGameState): MoveValidationResult;
    private static getPlayerByIdOrIndex;
    private static getPlayer;
    static getPlayerIndex(gameState: ValidatableGameState, playerId: string): number;
    static getAllowedActions(playerId: string, gameState: ValidatableGameState): string[];
}
//# sourceMappingURL=move-validator.d.ts.map