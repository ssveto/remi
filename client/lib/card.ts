import type { Suit } from "../../shared/types/card-data.types";

export class Card {
  public id: string;
  public suit: Suit;
  public value: number;
  public faceUp: boolean;
  readonly serverId?: string;

  constructor(suit: Suit, value: number, isFaceUp = false, serverId?: string) {
    this.faceUp = isFaceUp;
    this.suit = suit;
    this.value = value;
    this.serverId = serverId;
    this.id = serverId || `${suit}_${value}_${this.#generateShortId()}`;
  }
  get isFaceUp(): boolean {
    return this.faceUp;
  }

  public flip(): void {
    this.faceUp = !this.faceUp;
  }

  #generateShortId(): string {
    // Use crypto.randomUUID if available (browser/node 16+)
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 8);
    }

    // Fallback: timestamp + random
    return `${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  // ✅ ADDED: Utility method for comparisons
  public equals(other: Card): boolean {
    return this.id === other.id;
  }

  // ✅ ADDED: Utility method for debugging
  public toString(): string {
    return `${this.value}${this.suit[0]} [${this.id.slice(-8)}]`;
  }

  // In card.ts, add this static method to the Card class
  static getScoreValueFromData(cardData: any): number {
    // Extract suit and value from CardData
    const suit = cardData.suit;
    const value = cardData.value;

    if (suit === "JOKER_RED" || suit === "JOKER_BLACK") {
      return 25;
    }

    if (typeof value === "string") {
      switch (value) {
        case "Ace":
        case "King":
        case "Queen":
        case "Jack":
          return 10;
        default:
          const num = parseInt(value);
          return isNaN(num) ? 5 : num;
      }
    }

    if (typeof value === "number") {
      if (value >= 11 && value <= 14) return 10;
      return value;
    }

    return 5;
  }

  get isJoker(): boolean {
    return this.suit === "JOKER_RED" || this.suit === "JOKER_BLACK";
  }

  // Helper to get CardData representation
  toCardData() {
    return {
      id: this.id,
      suit: this.suit,
      value: this.value,
      isFaceUp: this.isFaceUp,
    };
  }
}
