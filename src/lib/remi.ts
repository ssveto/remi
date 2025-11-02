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

    for (let i = 0; i < 14; i += 1) {
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

  // In your Remi class (lib/remi.ts)

isJoker(card: Card): boolean {
  return card.suit === 'JOKER_RED' || 
         card.suit === 'JOKER_BLACK' || 
         card.value === 14; // If jokers are stored with value 14
}

isValidSet(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  
  const jokers = cards.filter(c => this.isJoker(c));
  const regularCards = cards.filter(c => !this.isJoker(c));

  if (jokers.length > 1) return false;
  
  // Must have at least one regular card to define the set
  if (regularCards.length === 0) return false;
  
  // Normalize ace values for comparison (treat all aces as value 1)
  const normalizeValue = (card: Card): number => {
    return card.value === 14 ? 1 : card.value;
  };
  
  // All regular cards must have same value
  const targetValue = normalizeValue(regularCards[0]);
  if (!regularCards.every(c => normalizeValue(c) === targetValue)) {
    return false;
  }
  
  // All regular cards must have different suits
  const suits = new Set(regularCards.map(c => c.suit));
  if (suits.size !== regularCards.length) {
    return false;
  }
  
  // Valid set: same value, different suits, can have jokers
  // Maximum 4 cards in a set (one per suit)
  return cards.length <= 4;
}

isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  
  const jokers = cards.filter(c => this.isJoker(c));
  const regularCards = cards.filter(c => !this.isJoker(c));

  if (jokers.length > 1) return false;
  
  if (regularCards.length === 0) return false;
  
  // All regular cards must be same suit
  const suit = regularCards[0].suit;
  if (!regularCards.every(c => c.suit === suit)) return false;

  // // ✅ NEW: Check for adjacent jokers
  // if (!this.#hasNoAdjacentJokers(cards)) {
  //   return false;
  // }
  
  // Get values and sort them
  const sortedValues = regularCards.map(c => c.value).sort((a, b) => a - b);
  
  // Check if we can form a sequence with jokers
  return this.#canFormSequence(sortedValues, jokers.length);
}

// #hasNoAdjacentJokers(cards: Card[]): boolean {
//   for (let i = 0; i < cards.length - 1; i++) {
//     if (this.isJoker(cards[i]) && this.isJoker(cards[i + 1])) {
//       return false; // Found adjacent jokers - invalid!
//     }
//   }
//   return true; // No adjacent jokers found
// }

#canFormSequence(sortedValues: number[], jokerCount: number): boolean {
  if (sortedValues.length === 0) return false;
  
  let jokersNeeded = 0;
  
  for (let i = 1; i < sortedValues.length; i++) {
    const gap = sortedValues[i] - sortedValues[i - 1] - 1;
    
    // Duplicate cards in run = invalid
    if (gap < 0) return false;
    
    jokersNeeded += gap;
    
    // Not enough jokers to fill gaps
    if (jokersNeeded > jokerCount) return false;
  }
  
  return true;
}


}
