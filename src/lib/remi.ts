import { Card } from "./card";
import { Deck } from "./deck";

export class Remi {
  #deck: Deck;
  #playerHands: Card[][];
  #numPlayers: number;

  constructor() {
    this.#deck = new Deck();
    this.#playerHands = [];
    this.#numPlayers = 0;
  }

  get drawPile(): Card[] {
    return this.#deck.drawPile;
  }

  get discardPile(): Card[] {
    return this.#deck.discardPile;
  }

  // Keep for backwards compatibility (returns player 0's hand)
  get cardsInHand(): Card[] {
    return this.#playerHands[0] || [];
  }

  // New method to get specific player's hand
  public getPlayerHand(playerIndex: number): Card[] {
    return this.#playerHands[playerIndex] || [];
  }

  public newGame(numPlayers: number = 2): void {
    this.#deck.reset();
    this.#numPlayers = numPlayers;
    this.#playerHands = [];

    // Initialize empty hands for all players
    for (let i = 0; i < numPlayers; i++) {
      this.#playerHands[i] = [];
    }

    // Deal 14 cards to each player
    for (let i = 0; i < 14; i++) {
      for (let playerIndex = 0; playerIndex < numPlayers; playerIndex++) {
        const card = this.#deck.draw() as Card;
        card.flip();
        this.#playerHands[playerIndex].push(card);
      }
    }
  }

  public drawCard(playerIndex: number = 0): boolean {
    if (playerIndex < 0 || playerIndex >= this.#numPlayers) {
      console.error(`Invalid player index: ${playerIndex}`);
      return false;
    }

    const card = this.#deck.draw();
    if (card === undefined) {
      return false;
    }
    card.flip();
    this.#playerHands[playerIndex].push(card);
    return true;
  }

  public drawFromDiscard(playerIndex: number = 0): Card | undefined {
    if (playerIndex < 0 || playerIndex >= this.#numPlayers) {
      console.error(`Invalid player index: ${playerIndex}`);
      return undefined;
    }

    if (this.#deck.discardPile.length === 0) {
      return undefined;
    }

    const card = this.#deck.discardPile.pop();
    if (card) {
      card.flip();
      this.#playerHands[playerIndex].push(card);
    }
    return card;
  }

  public discardCard(playerIndex: number, card: Card): boolean {
    if (playerIndex < 0 || playerIndex >= this.#numPlayers) {
      console.error(`Invalid player index: ${playerIndex}`);
      return false;
    }

    const hand = this.#playerHands[playerIndex];
    const cardIndex = hand.indexOf(card);

    if (cardIndex === -1) {
      return false;
    }

    hand.splice(cardIndex, 1);
    this.#deck.discardPile.push(card);
    return true;
  }

  public removeCardFromHand(playerIndex: number, card: Card): boolean {
    if (playerIndex < 0 || playerIndex >= this.#numPlayers) {
      console.error(`Invalid player index: ${playerIndex}`);
      return false;
    }

    const hand = this.#playerHands[playerIndex];
    const cardIndex = hand.indexOf(card);

    if (cardIndex === -1) {
      return false;
    }

    hand.splice(cardIndex, 1);
    return true;
  }

  public shuffleDiscardPile(): boolean {
    if (this.#deck.drawPile.length !== 0) {
      return false;
    }
    this.#deck.shuffleInDiscardPile();
    return true;
  }

  public takeDiscardCard(): boolean {
    return true;
  }

  public switchCardsInHand(source: number, target: number): boolean {
    return true;
  }

  public dropCard(): boolean {
    return true;
  }

  isJoker(card: Card): boolean {
    return card.suit === 'JOKER_RED' ||
    card.suit === 'JOKER_BLACK' ||
    card.value === 14;
  }

  isValidSet(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    const jokers = cards.filter(c => this.isJoker(c));
    const regularCards = cards.filter(c => !this.isJoker(c));
    if (jokers.length > 1) return false;

    if (regularCards.length === 0) return false;

    const normalizeValue = (card: Card): number => {
      return card.value === 14 ? 1 : card.value;
    };

    const targetValue = normalizeValue(regularCards[0]);
    if (!regularCards.every(c => normalizeValue(c) === targetValue)) {
      return false;
    }

    const suits = new Set(regularCards.map(c => c.suit));
    if (suits.size !== regularCards.length) {
      return false;
    }

    return cards.length <= 4;
  }

  isValidRun(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    const jokers = cards.filter(c => this.isJoker(c));
    const regularCards = cards.filter(c => !this.isJoker(c));
    if (jokers.length > 1) return false;

    if (regularCards.length === 0) return false;

    const suit = regularCards[0].suit;
    if (!regularCards.every(c => c.suit === suit)) return false;

    const sortedValues = regularCards.map(c => c.value).sort((a, b) => a - b);

    return this.#canFormSequence(sortedValues, jokers.length);
  }

  #canFormSequence(sortedValues: number[], jokerCount: number): boolean {
  if (sortedValues.length === 0) return false;

  let jokersNeeded = 0;

    for (let i = 1; i < sortedValues.length; i++) {
      const gap = sortedValues[i] - sortedValues[i - 1] - 1;

      if (gap < 0) return false;

      jokersNeeded += gap;

      if (jokersNeeded > jokerCount) return false;
    }

    return true;
  }
}
