export type Suit = "HEART" | "DIAMOND" | "SPADE" | "CLUB" | "JOKER_RED" | "JOKER_BLACK";
export interface CardData {
    id: string;
    suit: Suit;
    value: number;
    isFaceUp: boolean;
}
export declare function isJoker(card: CardData): boolean;
export declare function getCardPoints(card: CardData): number;
export declare function getCardName(card: CardData): string;
export declare function cardsEqual(card1: CardData, card2: CardData): boolean;
export declare function cloneCard(card: CardData): CardData;
export declare function isCardData(obj: any): obj is CardData;
export declare function cardToCardData(card: {
    id: string;
    suit: Suit;
    value: number;
    isFaceUp: boolean;
}): CardData;
export declare function cardsToCardData(cards: Array<{
    id: string;
    suit: Suit;
    value: number;
    isFaceUp: boolean;
}>): CardData[];
//# sourceMappingURL=card-data.types.d.ts.map