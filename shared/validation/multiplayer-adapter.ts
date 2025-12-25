// shared/validation/multiplayer-adapter.ts
import { MeldValidator } from './meld-validator';
import { MoveValidator } from './move-validator';
import type { CardData } from '../types/card.types';

export class MultiplayerValidator {
  /**
   * Validate moves for multiplayer games
   */
  static validatePlayerAction(
    action: 'DRAW_DECK' | 'DRAW_DISCARD' | 'LAY_MELDS' | 'DISCARD' | 'ADD_TO_MELD',
    playerId: string,
    gameState: any, // Your multiplayer game state
    payload?: any
  ): { valid: boolean; error?: string } {
    switch (action) {
      case 'DRAW_DECK':
        return MoveValidator.canDrawFromDeck(playerId, gameState);
      case 'DRAW_DISCARD':
        return MoveValidator.canDrawFromDiscard(playerId, gameState);
      case 'LAY_MELDS':
        if (!payload?.melds) return { valid: false, error: 'No melds provided' };
        return MoveValidator.canLayMelds(playerId, payload.melds, gameState, 51);
      case 'ADD_TO_MELD':
        if (!payload) return { valid: false, error: 'No payload' };
        return MoveValidator.canAddToMeld(
          playerId,
          payload.cardId,
          payload.meldOwner,
          payload.meldIndex,
          gameState
        );
      default:
        return { valid: false, error: 'Unknown action' };
    }
  }
  
  /**
   * Validate card selection for melds (client-side)
   */
  static validateCardSelection(cards: CardData[]): {
    isValid: boolean;
    isSet: boolean;
    isRun: boolean;
    score: number;
  } {
    const isSet = MeldValidator.isValidSet(cards);
    const isRun = MeldValidator.isValidRun(cards);
    const isValid = isSet || isRun;
    const score = isValid ? MeldValidator.calculateMeldScore(cards) : 0;
    
    return { isValid, isSet, isRun, score };
  }
}