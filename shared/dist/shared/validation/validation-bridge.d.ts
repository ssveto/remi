import { Card } from "../../client/lib/card";
import type { MeldValidationResult } from "../types/game-state.types";
export declare class ValidationBridge {
    static isValidSet(cards: Card[]): boolean;
    static isValidRun(cards: Card[]): boolean;
    static isValidMeld(cards: Card[]): boolean;
    private static mapCardDataToCards;
    static splitIntoMeldGroups(cards: Card[]): Card[][];
    static findBestMeldCombination(cards: Card[]): Card[][];
    static sortRunCards(cards: Card[]): Card[];
    static sortMeldForDisplay(meld: Card[]): Card[];
    static canCardReplaceJoker(card: Card, joker: Card, meld: Card[]): boolean;
    static canCardsBeAdjacent(card1: Card, card2: Card): boolean;
    static calculateMeldScore(meld: Card[]): number;
    static validateMelds(cards: Card[], hasOpened: boolean, openingRequirement?: number): MeldValidationResult;
    private static findCardById;
    static canAddToMeld(card: Card, meld: Card[]): "start" | "end" | null;
    static getMeldType(meld: Card[]): "SET" | "RUN" | null;
}
//# sourceMappingURL=validation-bridge.d.ts.map