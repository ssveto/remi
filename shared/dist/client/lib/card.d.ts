import type { Suit } from "../../shared/types/card-data.types";
export declare class Card {
    #private;
    id: string;
    suit: Suit;
    value: number;
    faceUp: boolean;
    readonly serverId?: string;
    constructor(suit: Suit, value: number, isFaceUp?: boolean, serverId?: string);
    get isFaceUp(): boolean;
    flip(): void;
    equals(other: Card): boolean;
    toString(): string;
    static getScoreValueFromData(cardData: any): number;
    get isJoker(): boolean;
    toCardData(): {
        id: string;
        suit: Suit;
        value: number;
        isFaceUp: boolean;
    };
}
//# sourceMappingURL=card.d.ts.map