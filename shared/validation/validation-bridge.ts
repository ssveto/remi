// shared/validation/validation-bridge.ts
import { Card } from "../../client/lib/card";
import { CardData, cardsToCardData } from "../types/card-data.types";
import { MeldValidator } from "./meld-validator";
import type { MeldValidationResult } from "../types/game-state.types";

export class ValidationBridge {
  /**
   * Complete validation bridge for Remi game
   */

  // Meld validation
  static isValidSet(cards: Card[]): boolean {
    return MeldValidator.isValidSet(cardsToCardData(cards));
  }

  static isValidRun(cards: Card[]): boolean {
    return MeldValidator.isValidRun(cardsToCardData(cards));
  }

  static isValidMeld(cards: Card[]): boolean {
    return MeldValidator.isValidMeld(cardsToCardData(cards));
  }

  private static mapCardDataToCards(
    cardDataArray: CardData[],
    originalCards: Card[]
  ): Card[] {
    const cardMap = new Map(originalCards.map((card) => [card.id, card]));

    return cardDataArray.map((cardData) => {
      const card = cardMap.get(cardData.id);
      if (!card) {
        throw new Error(`Card ${cardData.id} not found in original array`);
      }
      return card;
    });
  }

  // Meld splitting
  static splitIntoMeldGroups(cards: Card[]): Card[][] {
    const cardData = cardsToCardData(cards);
    const meldGroups = MeldValidator.splitIntoMeldGroups(cardData);
    //return meldGroups.map((meld) => meld.map(cardDataToCard));
    return meldGroups.map((meldGroup) =>
      this.mapCardDataToCards(meldGroup, cards)
    );
  }

  // Meld suggestions
  static findBestMeldCombination(cards: Card[]): Card[][] {
    const cardData = cardsToCardData(cards);
    const bestMelds = MeldValidator.findBestMeldCombination(cardData);
    return bestMelds.map((meld) => this.mapCardDataToCards(meld, cards));
  }

  static sortRunCards(cards: Card[]): Card[] {
    const cardData = cardsToCardData(cards);
    const sorted = MeldValidator.sortRunCards(cardData);
    return this.mapCardDataToCards(sorted, cards);
  }

  static sortMeldForDisplay(meld: Card[]): Card[] {
    const cardData = cardsToCardData(meld);
    const sorted = MeldValidator.sortMeldForDisplay(cardData);
    return this.mapCardDataToCards(sorted, meld);
  }

  // Joker operations
  static canCardReplaceJoker(card: Card, joker: Card, meld: Card[]): boolean {
    const cardData = cardsToCardData([card])[0];
    const jokerData = cardsToCardData([joker])[0];
    const meldData = cardsToCardData(meld);

    return MeldValidator.canCardReplaceJoker(cardData, jokerData, meldData);
  }

  // Helper for adjacent cards
  static canCardsBeAdjacent(card1: Card, card2: Card): boolean {
    const card1Data = cardsToCardData([card1])[0];
    const card2Data = cardsToCardData([card2])[0];

    return MeldValidator.canCardsBeAdjacent(card1Data, card2Data);
  }

  // Scoring
  static calculateMeldScore(meld: Card[]): number {
    return MeldValidator.calculateMeldScore(cardsToCardData(meld));
  }

  // Complete validation
  static validateMelds(
    cards: Card[],
    hasOpened: boolean,
    openingRequirement: number = 51
  ): MeldValidationResult {
    const cardData = cardsToCardData(cards);
    const result = MeldValidator.validateMelds(
      cardData,
      hasOpened,
      openingRequirement
    );

    // Convert back to Card arrays
    return {
      ...result,
      selectedCards: cards,
      validMelds: result.validMelds.map((meld) =>
        meld.map((cardData) => this.findCardById(cards, cardData.id))
      ),
      invalidCards: result.invalidCards.map((cardData) =>
        this.findCardById(cards, cardData.id)
      ),
    };
  }

  private static findCardById(cards: Card[], id: string): Card {
    const card = cards.find((c) => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return card;
  }

  static getJokerValueInMeld(joker: Card, meld: Card[]): number {
    const jokerData = cardsToCardData([joker])[0];
    const meldData = cardsToCardData(meld);

    // We need to expose this method in MeldValidator first
    return MeldValidator.getJokerValueInMeld(jokerData, meldData);
  }

  /**
   * Get represented value of joker in a run
   */
  static getJokerRepresentedValueInRun(joker: Card, meld: Card[]): number {
    const jokerData = cardsToCardData([joker])[0];
    const meldData = cardsToCardData(meld);

    return MeldValidator.getJokerRepresentedValueInRun(jokerData, meldData);
  }

  /**
   * Build sequence with jokers represented values
   */
  static buildSequenceWithJokers(
    meld: Card[],
    sortedValues: number[]
  ): number[] {
    const meldData = cardsToCardData(meld);
    return MeldValidator.buildSequenceWithJokers(meldData, sortedValues);
  }

  // Card operations
  static canAddToMeld(card: Card, meld: Card[]): "start" | "end" | null {
    return MeldValidator.getAddPosition(
      cardsToCardData([card])[0],
      cardsToCardData(meld)
    );
  }

  static getMeldType(meld: Card[]): "SET" | "RUN" | null {
    return MeldValidator.getMeldType(cardsToCardData(meld));
  }

  // Add these methods to the ValidationBridge class in validation-bridge.ts:

  static isJoker(card: Card): boolean {
    return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
  }

  static getCardPoints(card: Card): number {
    if (this.isJoker(card)) return 0;
    if (card.value === 1) return 10;
    if (card.value >= 2 && card.value <= 10) return card.value;
    if (card.value >= 11 && card.value <= 13) return 10;
    if (card.value === 14) return 10;
    return 0;
  }
}
