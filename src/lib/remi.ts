import { Card } from "./card";
import { Deck } from "./deck";

export class Remi {
  #deck: Deck;
  #cardsInHand: Card[];

  constructor() {
    this.#deck = new Deck();
    this.#cardsInHand = [];
  }

  get drawPile(): Card[] {
    return this.#deck.drawPile;
  }
  get discardPile(): Card[] {
    return this.#deck.discardPile;
  }
  get cardsInHand(): Card[] {
    return this.#cardsInHand;
  }
  public newGame(): void {
    this.#deck.reset();
    this.#cardsInHand = [];

    for (let i = 0; i < 15; i += 1) {
      const card = this.#deck.draw() as Card;
      card.flip();
      this.#cardsInHand.push(card);
    }
  }
  public drawCard(): boolean {
    const card = this.#deck.draw();
    if (card === undefined) {
      return false;
    }
    card.flip();
    this.#cardsInHand.push(card);
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

  isValidSet(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    // Separate aces from other cards
    const aces = cards.filter((card) => card.value === 1 || card.value === 14);
    const nonAces = cards.filter(
      (card) => card.value !== 1 && card.value !== 14
    );

    // If no non-ace cards, can't determine what rank aces should be
    if (nonAces.length === 0) return false;

    // All non-ace cards must have the same rank
    const rank = nonAces[0].value;
    const allSameRank = nonAces.every((card) => card.value === rank);
    if (!allSameRank) return false;

    // All cards (including aces) must have different suits
    const suits = new Set(cards.map((card) => card.suit));
    const allDifferentSuits = suits.size === cards.length;

    return allDifferentSuits;
  }

  isValidRun(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    // All cards must be the same suit
    const suit = cards[0].suit;
    if (!cards.every((card) => card.suit === suit)) return false;

    // Separate aces from other cards
    const aces = cards.filter((card) => card.value === 1 || card.value === 14);
    const nonAces = cards.filter(
      (card) => card.value !== 1 && card.value !== 14
    );

    // If all aces, can't form a valid run
    if (nonAces.length === 0) return false;

    // Sort non-ace cards
    const sorted = [...nonAces].sort((a, b) => a.value - b.value);
    const minValue = sorted[0].value;
    const maxValue = sorted[sorted.length - 1].value;

    // Check if aces are in natural positions (1 or 14)
    let naturalAces = 0;
    let gapFillingAces = aces.length;

    // Check for natural ace at start (value = 1, and minValue = 2)
    if (minValue === 2 && aces.length > 0) {
      naturalAces++;
      gapFillingAces--;
    }

    // Check for natural ace at end (value = 14, and maxValue = 13)
    if (maxValue === 13 && aces.length > naturalAces) {
      naturalAces++;
      gapFillingAces--;
    }

    // For gap-filling aces
    const gaps = this.#findGapsInSequence(sorted, minValue, maxValue);

    // Must have exactly as many gap-filling aces as gaps
    if (gaps.length !== gapFillingAces) return false;

    // Check if any gaps are adjacent (would require adjacent aces)
    for (let i = 1; i < gaps.length; i++) {
      if (gaps[i] === gaps[i - 1] + 1) {
        return false; // Adjacent gaps not allowed
      }
    }

    // Verify total length makes sense
    const expectedLength = maxValue - minValue + 1 + naturalAces;
    if (expectedLength !== cards.length) return false;

    return true;
  }
  // Helper method to find missing values in sequence
  #findGapsInSequence(
    sortedCards: Card[],
    minValue: number,
    maxValue: number
  ): number[] {
    const gaps: number[] = [];
    const presentValues = new Set(sortedCards.map((c) => c.value));

    for (let value = minValue; value <= maxValue; value++) {
      if (!presentValues.has(value as any)) {
        gaps.push(value);
      }
    }
    return gaps;
  }
}
