// shared/types/card.types.ts
/**
 * This file now re-exports everything for backward compatibility
 * The single source of truth is Card class and CardData interface
 */

// Re-export from card-data.types
export type { Suit, CardData } from './card-data.types';
export { 
  isJoker, 
  getCardPoints, 
  getCardName, 
  cardsEqual, 
  cloneCard, 
  isCardData,
  cardToCardData,
  cardsToCardData 
} from './card-data.types';

// Export Card class type (for convenience)
export type { Card } from '../../client/lib/card';