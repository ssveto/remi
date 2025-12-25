import type { MeldValidationResult } from "../types/game-state.types";
import type { CardData } from '../types/card-data.types';
export declare class MeldValidator {
    static isValidSet(cards: CardData[]): boolean;
    static isValidRun(cards: CardData[]): boolean;
    static isValidMeld(cards: CardData[]): boolean;
    static splitIntoMeldGroups(cards: CardData[]): CardData[][];
    private static findMeldFromPosition;
    private static validatePositionalRun;
    static calculateMeldScore(meld: CardData[]): number;
    private static getJokerValueInMeld;
    private static getJokerValueInRun;
    static buildSequenceWithJokers(meld: CardData[], sortedValues: number[]): number[];
    static sortMeldForDisplay(meld: CardData[]): CardData[];
    static validateMelds(cards: CardData[], hasOpened: boolean, openingRequirement?: number): MeldValidationResult;
    static findBestMeldCombination(cards: CardData[]): CardData[][];
    private static findAllPossibleMelds;
    private static getCombinations;
    static canAddToMeld(card: CardData, meld: CardData[]): boolean;
    static canCardsBeAdjacent(card1: CardData, card2: CardData): boolean;
    static sortRunCards(cards: CardData[]): CardData[];
    static canCardReplaceJoker(card: CardData, joker: CardData, meld: CardData[]): boolean;
    static getJokerRepresentedValueInRun(joker: CardData, meld: CardData[]): number;
    static getAddPosition(card: CardData, meld: CardData[]): "start" | "end" | null;
    static calculateDeadwood(cards: CardData[]): number;
    static getMeldType(meld: CardData[]): "SET" | "RUN" | null;
}
//# sourceMappingURL=meld-validator.d.ts.map