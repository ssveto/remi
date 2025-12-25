// shared/types/card-data.types.ts
export type Suit =
  | "HEART"
  | "DIAMOND"
  | "SPADE"
  | "CLUB"
  | "JOKER_RED"
  | "JOKER_BLACK";

/**
 * Serializable card data - used for validation and network transmission
 */
export interface CardData {
  id: string;
  suit: Suit;
  value: number; // 1-13 for regular cards, 14 for jokers
  isFaceUp: boolean;
}

/**
 * Helper to check if a card is a joker
 */
export function isJoker(card: CardData): boolean {
  return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
}

/**
 * Get point value of a card
 */
export function getCardPoints(card: CardData): number {
  if (isJoker(card)) {
    return 0; // Jokers have no inherent point value
  }

  if (card.value === 1) return 10; // Ace = 10 points
  if (card.value >= 2 && card.value <= 10) return card.value;
  if (card.value >= 11 && card.value <= 13) return 10; // J, Q, K = 10
  if (card.value === 14) return 10; // High ace

  return 0;
}

/**
 * Get display name for a card
 */
export function getCardName(card: CardData): string {
  if (isJoker(card)) {
    return card.suit === "JOKER_RED" ? "Red Joker" : "Black Joker";
  }

  const valueNames: { [key: number]: string } = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
  };

  const valueName = valueNames[card.value] || card.value.toString();
  const suitSymbols: Record<Suit, string> = {
    HEART: "♥",
    DIAMOND: "♦",
    SPADE: "♠",
    CLUB: "♣",
    JOKER_RED: "🃏",
    JOKER_BLACK: "🃏",
  };

  return `${valueName}${suitSymbols[card.suit]}`;
}

/**
 * Compare two cards for equality
 */
export function cardsEqual(card1: CardData, card2: CardData): boolean {
  return card1.id === card2.id;
}

/**
 * Create a copy of a card
 */
export function cloneCard(card: CardData): CardData {
  return { ...card };
}

/**
 * Type guard for CardData
 */
export function isCardData(obj: any): obj is CardData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.id === "string" &&
    typeof obj.suit === "string" &&
    (obj.suit === "HEART" || 
     obj.suit === "DIAMOND" || 
     obj.suit === "SPADE" || 
     obj.suit === "CLUB" ||
     obj.suit === "JOKER_RED" || 
     obj.suit === "JOKER_BLACK") &&
    typeof obj.value === "number" &&
    typeof obj.isFaceUp === "boolean"
  );
}

/**
 * Convert Card class instance to CardData
 */
export function cardToCardData(card: { id: string; suit: Suit; value: number; isFaceUp: boolean }): CardData {
  return {
    id: card.id,
    suit: card.suit,
    value: card.value,
    isFaceUp: card.isFaceUp,
  };
}

/**
 * Convert array of Card class instances to CardData array
 */
export function cardsToCardData(cards: Array<{ id: string; suit: Suit; value: number; isFaceUp: boolean }>): CardData[] {
  return cards.map(cardToCardData);
}