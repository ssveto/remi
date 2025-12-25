import type { CardData } from '../types/card.types';
export declare class MultiplayerValidator {
    static validatePlayerAction(action: 'DRAW_DECK' | 'DRAW_DISCARD' | 'LAY_MELDS' | 'DISCARD' | 'ADD_TO_MELD', playerId: string, gameState: any, payload?: any): {
        valid: boolean;
        error?: string;
    };
    static validateCardSelection(cards: CardData[]): {
        isValid: boolean;
        isSet: boolean;
        isRun: boolean;
        score: number;
    };
}
//# sourceMappingURL=multiplayer-adapter.d.ts.map