// server/src/models/ServerGameState.ts
import { v4 as uuidv4 } from 'uuid';
import {
  CardData,
  GamePhase,
  MeldValidator,
  MoveValidator,
  GAME_CONFIG,
  ErrorCode,
  createError,
  type GameError,
} from '../../../shared';

// Import client-facing types
import type { GameStateUpdate, PlayerState } from '../../../shared/types/socket-events';

/**
 * Server-side authoritative game state
 * Uses shared validation to ensure rules are enforced
 */
export class ServerGameState {
  // Game metadata
  private gameId: string;
  private playerOrder: string[]; // Player IDs in turn order
  private playerNames: Map<string, string> = new Map();
  private currentPlayerIndex: number = 0;
  private phase: GamePhase = GamePhase.DRAW;
  private turnNumber: number = 0;
  private gameStartedAt: number;

  // Round system
  private currentRound: number = 1;
  private totalRounds: number = 10; // Configurable
  private cumulativeScores: Map<string, number> = new Map();
  private roundWinners: Map<number, string> = new Map(); // round -> winnerId
  private roundScores: Map<number, Map<string, number>> = new Map(); // round -> playerId -> score

  // Card management
  private drawPile: CardData[] = [];
  private discardPile: CardData[] = [];
  private finishingCard: CardData | null = null;
  private finishingCardDrawn: boolean = false;
  // Track discard draw to prevent immediate discard of same card
  private drewFromDiscard: boolean = false;
  private discardCardDrawnId: string | null = null;

  // Player data
  private playerHands: Map<string, CardData[]> = new Map();
  private playerMelds: Map<string, CardData[][]> = new Map();
  private playersOpened: Set<string> = new Set();
  private playerConnected: Map<string, boolean> = new Map();

  private undoSnapshot: {
    hand: CardData[];
    melds: CardData[][];
    discardPile: CardData[];
    finishingCard: CardData | null;
    finishingCardDrawn: boolean;
    type: 'DISCARD' | 'FINISHING_CARD';
  } | null = null;

  constructor(playerIds: string[], playerNames: Map<string, string>, totalRounds: number = 10) {
    this.gameId = uuidv4();
    this.playerOrder = [...playerIds];
    this.playerNames = playerNames;
    this.gameStartedAt = Date.now();
    this.totalRounds = totalRounds;

    // Initialize player connection status
    playerIds.forEach(id => this.playerConnected.set(id, true));
    playerIds.forEach(id => {
      this.cumulativeScores.set(id, 0);
    });

    // Initialize decks
    this.initializeDecks();

    // Deal initial hands
    this.dealInitialHands();

    // Select finishing card
    this.selectFinishingCard();

    console.log(`🎮 Game ${this.gameId} started with ${playerIds.length} players, ${totalRounds} rounds`);
  }

  // ==========================================================================
  // GAME ACTIONS
  // ==========================================================================

  /**
   * Player draws a card from the deck
   */
  drawCard(playerId: string): { success: boolean; error?: GameError; card?: CardData } {
    // Validate move using internal state format
    const validation = MoveValidator.canDrawFromDeck(playerId, this.getInternalState());
    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Handle empty deck
    if (this.drawPile.length === 0) {
      this.shuffleDiscardIntoDeck();
      if (this.drawPile.length === 0) {
        return {
          success: false,
          error: createError(ErrorCode.EMPTY_DECK),
        };
      }
    }

    this.undoSnapshot = null;

    // Draw card
    const card = this.drawPile.pop()!;
    card.isFaceUp = true;

    // Add to player's hand
    const hand = this.getPlayerHand(playerId);
    hand.push(card);

    // Change phase
    this.phase = GamePhase.MELD;

    console.log(`🎴 ${this.playerNames.get(playerId)} drew a card`);

    return { success: true, card };
  }

  /**
   * Player draws from discard pile
   */
  drawFromDiscard(playerId: string): { success: boolean; error?: GameError; card?: CardData } {
    // Validate move
    const validation = MoveValidator.canDrawFromDiscard(playerId, this.getInternalState());
    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Save snapshot BEFORE drawing (for potential undo)
    const hand = this.getPlayerHand(playerId);
    const melds = this.getPlayerMelds(playerId);
    this.undoSnapshot = {
      hand: [...hand],
      melds: melds.map(m => [...m]),
      discardPile: [...this.discardPile],
      finishingCard: this.finishingCard,
      finishingCardDrawn: this.finishingCardDrawn,
      type: 'DISCARD',
    };


    // Draw card
    const card = this.discardPile.pop()!;
    card.isFaceUp = true;

    this.drewFromDiscard = true;
    this.discardCardDrawnId = card.id;


    // Add to player's hand
    hand.push(card);

    // Change phase
    this.phase = GamePhase.MELD;

    console.log(`♻️ ${this.playerNames.get(playerId)} drew from discard pile`);

    return { success: true, card };
  }

  /**
   * Player takes the finishing card
   */
  takeFinishingCard(playerId: string): { success: boolean; error?: GameError; card?: CardData } {
    // Validate move
    const validation = MoveValidator.canTakeFinishingCard(playerId, this.getInternalState());
    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Save snapshot BEFORE taking (for potential undo)
    const hand = this.getPlayerHand(playerId);
    const melds = this.getPlayerMelds(playerId);
    this.undoSnapshot = {
      hand: [...hand],
      melds: melds.map(m => [...m]),
      discardPile: [...this.discardPile],
      finishingCard: this.finishingCard,
      finishingCardDrawn: this.finishingCardDrawn,
      type: 'FINISHING_CARD',
    };

    // Take card
    const card = this.finishingCard!;
    card.isFaceUp = true;
    this.finishingCard = null;
    this.finishingCardDrawn = true;

    // Add to player's hand
    hand.push(card);

    // Change phase
    this.phase = GamePhase.MELD;

    console.log(`✨ ${this.playerNames.get(playerId)} took the finishing card!`);

    return { success: true, card };
  }

  /**
   * Player lays down melds
   */
  layMelds(
    playerId: string,
    meldIds: string[][] // Array of arrays of card IDs
  ): { success: boolean; error?: GameError; melds?: CardData[][] } {
    // Convert card IDs to CardData
    const hand = this.getPlayerHand(playerId);
    const melds: CardData[][] = [];

    for (const meldCardIds of meldIds) {
      const meld: CardData[] = [];
      for (const cardId of meldCardIds) {
        const card = hand.find(c => c.id === cardId);
        if (!card) {
          return {
            success: false,
            error: createError(ErrorCode.CARD_NOT_IN_HAND),
          };
        }
        meld.push(card);
      }
      melds.push(meld);
    }

    // Validate move
    const validation = MoveValidator.canLayMelds(
      playerId,
      melds,
      this.getInternalState(),
      GAME_CONFIG.OPENING_REQUIREMENT
    );

    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Remove cards from hand
    for (const meld of melds) {
      for (const card of meld) {
        const index = hand.findIndex(c => c.id === card.id);
        if (index !== -1) {
          hand.splice(index, 1);
        }
      }
    }

    const sortedMelds = melds.map(meld => this.sortMeldForDisplay(meld));
    // Add to player's melds
    const playerMelds = this.getPlayerMelds(playerId);
    playerMelds.push(...sortedMelds);

    // Mark player as opened
    this.playersOpened.add(playerId);

    // Stay in MELD phase - player still needs to discard
    // (No phase change here)

    const totalScore = melds.reduce(
      (sum, meld) => sum + MeldValidator.calculateMeldScore(meld),
      0
    );

    console.log(`📋 ${this.playerNames.get(playerId)} laid ${melds.length} melds (${totalScore} pts)`);

    return { success: true, melds };
  }

  /**
   * Player adds a card to an existing meld
   */
  addToMeld(
    playerId: string,
    cardId: string,
    meldOwner: string,
    meldIndex: number
  ): { success: boolean; error?: GameError; card?: CardData; replacedJoker?: CardData } {
    // Get the card
    const hand = this.getPlayerHand(playerId);
    const card = hand.find(c => c.id === cardId);

    if (!card) {
      return {
        success: false,
        error: createError(ErrorCode.CARD_NOT_IN_HAND),
      };
    }

    // Validate move
    const validation = MoveValidator.canAddToMeld(
      playerId,
      cardId,
      meldOwner,
      meldIndex,
      this.getInternalState()
    );

    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Get the meld
    const ownerMelds = this.getPlayerMelds(meldOwner);
    const meld = ownerMelds[meldIndex];

    // Check for joker replacement
    let replacedJoker: CardData | undefined;

    const jokerIndex = meld.findIndex(c =>
      c.suit === 'JOKER_RED' || c.suit === 'JOKER_BLACK'
    );

    if (jokerIndex !== -1) {
      const joker = meld[jokerIndex];

      // Check if this card can replace the joker
      if (this.doesCardReplaceJoker(card, joker, meld)) {
        replacedJoker = joker;

        // Execute replacement: put card where joker was
        meld[jokerIndex] = card;

        // Remove card from hand
        const handIndex = hand.findIndex(c => c.id === cardId);
        hand.splice(handIndex, 1);

        // Give joker back to player's hand
        hand.push(joker);

        console.log(`🃏 ${this.playerNames.get(playerId)} replaced a joker!`);
        return { success: true, card, replacedJoker };
      }
    }

    // Remove card from hand first
    const handIndex = hand.findIndex(c => c.id === cardId);
    hand.splice(handIndex, 1);

    // Add card to meld (at correct position based on meld type)
    // Check if getAddPosition exists, otherwise default to 'end'
    if (typeof MeldValidator.getAddPosition === 'function') {
      const position = MeldValidator.getAddPosition(card, meld);
      if (position === 'start') {
        meld.unshift(card);
      } else {
        meld.push(card);
      }
    } else {
      // Fallback: just add to end, sorting will fix position
      meld.push(card);
    }

    // Re-sort meld after addition to ensure proper display order
    const sortedMeld = this.sortMeldForDisplay(meld);
    meld.length = 0;
    meld.push(...sortedMeld);

    console.log(`➕ ${this.playerNames.get(playerId)} added card to meld`);

    return { success: true, card, replacedJoker };
  }

  /**
   * Player discards a card
   */
  discardCard(
    playerId: string,
    cardId: string
  ): { 
    success: boolean; 
    error?: GameError; 
    card?: CardData; 
    roundOver?: boolean; 
    winner?: string 
  } {
    // ... existing validation (same as before) ...
    
    if (this.drewFromDiscard && this.discardCardDrawnId === cardId) {
      const errorCode = (ErrorCode as any).CANNOT_DISCARD_DRAWN_CARD 
        || (ErrorCode as any).INVALID_MOVE 
        || ErrorCode.WRONG_PHASE;
      return {
        success: false,
        error: createError(errorCode,
          'Cannot discard the card you just drew from the discard pile'),
      };
    }

    const validation = MoveValidator.canDiscard(playerId, cardId, this.getInternalState());

    if (!validation.valid) {
      return {
        success: false,
        error: createError(validation.errorCode as ErrorCode, validation.error),
      };
    }

    // Get card from hand
    const hand = this.getPlayerHand(playerId);
    const cardIndex = hand.findIndex(c => c.id === cardId);
    const [card] = hand.splice(cardIndex, 1);

    // Add to discard pile
    this.discardPile.push(card);

    console.log(`🗑️ ${this.playerNames.get(playerId)} discarded a card`);

    // Check win condition
    if (hand.length === 0 && this.playersOpened.has(playerId)) {
      console.log(`🏆 ${this.playerNames.get(playerId)} wins round ${this.currentRound}!`);
      return { 
        success: true, 
        card, 
        roundOver: true, 
        winner: playerId 
      };
    }

    // Next turn
    this.nextTurn();

    return { success: true, card };
  }


  /**
   * Skip meld phase (go directly to discard)
   */
  skipMeld(playerId: string): { success: boolean; error?: GameError } {
    if (this.getCurrentPlayerId() !== playerId) {
      return {
        success: false,
        error: createError(ErrorCode.NOT_YOUR_TURN),
      };
    }

    if (this.phase !== GamePhase.MELD) {
      return {
        success: false,
        error: createError(ErrorCode.WRONG_PHASE),
      };
    }

    this.phase = GamePhase.DISCARD;
    console.log(`⏭️ ${this.playerNames.get(playerId)} skipped meld phase`);

    return { success: true };
  }

  /**
   * Reorder cards in hand (no validation needed - purely visual)
   */
  reorderHand(playerId: string, fromIndex: number, toIndex: number): { success: boolean } {
    const hand = this.getPlayerHand(playerId);

    if (fromIndex < 0 || fromIndex >= hand.length || toIndex < 0 || toIndex >= hand.length) {
      return { success: false };
    }

    const [card] = hand.splice(fromIndex, 1);
    hand.splice(toIndex, 0, card);

    return { success: true };
  }

  undoSpecialDraw(playerId: string): { success: boolean; error?: GameError; newCard?: CardData } {
    // Must be current player
    if (this.getCurrentPlayerId() !== playerId) {
      return {
        success: false,
        error: createError(ErrorCode.NOT_YOUR_TURN),
      };
    }

    // Must be in MELD phase
    if (this.phase !== GamePhase.MELD) {
      return {
        success: false,
        error: createError(ErrorCode.WRONG_PHASE, 'Can only undo before discarding'),
      };
    }

    // Must have a snapshot to restore
    if (!this.undoSnapshot) {
      return {
        success: false,
        error: createError(ErrorCode.INVALID_MOVE, 'No action to undo'),
      };
    }

    const snapshot = this.undoSnapshot;

    // Restore hand (removes drawn card AND any cards used in melds this turn)
    const hand = this.getPlayerHand(playerId);
    hand.length = 0;
    hand.push(...snapshot.hand);

    // Restore melds (removes any melds laid this turn)
    this.playerMelds.set(playerId, snapshot.melds.map(m => [...m]));

    // Restore discard pile
    this.discardPile = [...snapshot.discardPile];

    // Restore finishing card state
    this.finishingCard = snapshot.finishingCard;
    this.finishingCardDrawn = snapshot.finishingCardDrawn;

    // Reset tracking
    this.drewFromDiscard = false;
    this.discardCardDrawnId = null;

    // Clear snapshot
    const undoType = snapshot.type;
    this.undoSnapshot = null;

    // Draw from deck instead
    if (this.drawPile.length === 0) {
      this.shuffleDiscardIntoDeck();
    }

    let newCard: CardData | undefined;
    if (this.drawPile.length > 0) {
      newCard = this.drawPile.pop()!;
      newCard.isFaceUp = true;
      hand.push(newCard);
    }

    console.log(`↩️ ${this.playerNames.get(playerId)} undid ${undoType} draw, state restored, drew from deck`);

    return { success: true, newCard };
  }

  /**
   * Set player connection status
   */
  setPlayerConnected(playerId: string, connected: boolean): void {
    this.playerConnected.set(playerId, connected);
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get game state formatted for client (GameStateUpdate format)
   * This is what gets sent over the socket to each player
   */
  getState(forPlayerId: string): GameStateUpdate {
    const currentPlayerId = this.getCurrentPlayerId();

    return {
      //Round info (NEW)
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      // Turn info
      currentPlayerId,
      currentPlayerName: this.playerNames.get(currentPlayerId) || 'Unknown',
      phase: this.phase as 'DRAW' | 'MELD' | 'DISCARD' | 'GAME_OVER',

      // Players (without their hands - just public info)
      players: this.playerOrder.map(id => this.getPlayerStateForClient(id, currentPlayerId)),

      // Shared game elements
      drawPileSize: this.drawPile.length,
      discardPileTop: this.discardPile[this.discardPile.length - 1] || null,
      finishingCard: this.finishingCard,
      finishingCardDrawn: this.finishingCardDrawn,

      // THIS PLAYER'S HAND - the key fix!
      myHand: this.getPlayerHand(forPlayerId),

      // Metadata
      turnNumber: this.turnNumber,
      gameStartTime: this.gameStartedAt,  // Note: client expects gameStartTime, not gameStartedAt
    };
  }

  /**
   * Get internal state format (for validators)
   * This uses the ValidatableGameState interface
   */
  private getInternalState() {
    return {
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.getCurrentPlayerId(),
      phase: this.phase,
      turnNumber: this.turnNumber,
      players: this.playerOrder.map(id => ({
        id,
        name: this.playerNames.get(id) || 'Unknown',
        handSize: this.getPlayerHand(id).length,
        hand: this.getPlayerHand(id),
        melds: this.getPlayerMelds(id),
        hasOpened: this.playersOpened.has(id),
        isConnected: this.playerConnected.get(id) ?? true,
        score: this.calculatePlayerScore(id),
      })),
      drawPileSize: this.drawPile.length,
      discardPileTop: this.discardPile[this.discardPile.length - 1] || null,
      finishingCard: this.finishingCard,
      finishingCardDrawn: this.finishingCardDrawn,
      gameStartedAt: this.gameStartedAt,
      lastActionAt: Date.now(),
    };
  }

  /**
   * Get player state for client (PlayerState format - no hand)
   */
  private getPlayerStateForClient(playerId: string, currentPlayerId: string): PlayerState {
    const melds = this.getPlayerMelds(playerId);
    const handSize = this.getPlayerHand(playerId).length;

    return {
      id: playerId,
      name: this.playerNames.get(playerId) || 'Unknown',
      handSize,
      hasOpened: this.playersOpened.has(playerId),
      melds,
      isCurrentPlayer: playerId === currentPlayerId,
      isConnected: this.playerConnected.get(playerId) ?? true,
      score: this.cumulativeScores.get(playerId) || 0,
    };
  }

  /**
   * Calculate a player's current meld score
   */
  private calculatePlayerScore(playerId: string): number {
    const melds = this.getPlayerMelds(playerId);
    return melds.reduce(
      (sum, meld) => sum + MeldValidator.calculateMeldScore(meld),
      0
    );
  }

  /**
   * Get game statistics for end screen
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  getTotalRounds(): number {
    return this.totalRounds;
  }

  getCumulativeScores(): Map<string, number> {
    return new Map(this.cumulativeScores);
  }

  getPlayerName(playerId: string): string | undefined {
    return this.playerNames.get(playerId);
  }

  isFinalRound(): boolean {
    return this.currentRound >= this.totalRounds;
  }

  getRoundResults(): Array<{
    round: number;
    winnerId: string;
    winnerName: string;
    scores: Array<{playerId: string; playerName: string; score: number}>;
  }> {
    const results = [];
    
    for (let round = 1; round <= this.currentRound; round++) {
      const winnerId = this.roundWinners.get(round);
      const roundScores = this.roundScores.get(round);
      
      if (winnerId && roundScores) {
        results.push({
          round,
          winnerId,
          winnerName: this.playerNames.get(winnerId) || 'Unknown',
          scores: Array.from(roundScores.entries()).map(([playerId, score]) => ({
            playerId,
            playerName: this.playerNames.get(playerId) || 'Unknown',
            score,
          })),
        });
      }
    }
    
    return results;
  }

  getGameStats(winnerId: string) {
    const finalScores = this.playerOrder.map(playerId => {
      const deadwood = this.calculatePlayerDeadwood(playerId);
      const cumulativeScore = this.cumulativeScores.get(playerId) || 0;

      return {
        playerId,
        playerName: this.playerNames.get(playerId) || 'Unknown',
        finalScore: cumulativeScore, // This is already cumulative
        deadwood,
      };
    });

    return {
      winner: {
        id: winnerId,
        name: this.playerNames.get(winnerId) || 'Unknown',
        score: this.cumulativeScores.get(winnerId) || 0,
      },
      finalScores,
      roundResults: this.getRoundResults(),
      totalRounds: this.totalRounds,
      totalTurns: this.turnNumber,
      gameLength: Math.floor((Date.now() - this.gameStartedAt) / 1000),
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
 * Sort a meld for proper display
 */
  private sortMeldForDisplay(meld: CardData[]): CardData[] {
    if (MeldValidator.isValidRun(meld)) {
      return this.sortRunCards(meld);
    }
    // For sets: move jokers to end, sort regular cards by suit
    return [...meld].sort((a, b) => {
      const aIsJoker = a.suit === 'JOKER_RED' || a.suit === 'JOKER_BLACK';
      const bIsJoker = b.suit === 'JOKER_RED' || b.suit === 'JOKER_BLACK';
      if (aIsJoker && !bIsJoker) return 1;
      if (!aIsJoker && bIsJoker) return -1;
      return a.suit.localeCompare(b.suit);
    });
  }

  /**
   * Sort run cards in sequential order, placing jokers in gaps
   */
  private sortRunCards(cards: CardData[]): CardData[] {
    const jokers: CardData[] = [];
    const regulars: CardData[] = [];

    for (const card of cards) {
      if (card.suit === 'JOKER_RED' || card.suit === 'JOKER_BLACK') {
        jokers.push(card);
      } else {
        regulars.push(card);
      }
    }

    // Sort regular cards by value (handle Ace high if needed)
    const hasHighCards = regulars.some(c => c.value >= 11);
    regulars.sort((a, b) => {
      const aVal = a.value === 1 && hasHighCards ? 14 : a.value;
      const bVal = b.value === 1 && hasHighCards ? 14 : b.value;
      return aVal - bVal;
    });

    // Interleave jokers to fill gaps
    const result: CardData[] = [];
    let jokerIdx = 0;

    for (let i = 0; i < regulars.length; i++) {
      result.push(regulars[i]);

      if (i < regulars.length - 1) {
        const current = regulars[i];
        const next = regulars[i + 1];
        const currentVal = current.value === 1 && hasHighCards ? 14 : current.value;
        const nextVal = next.value === 1 && hasHighCards ? 14 : next.value;
        const gap = nextVal - currentVal - 1;

        // Insert jokers for gaps
        for (let j = 0; j < gap && jokerIdx < jokers.length; j++) {
          result.push(jokers[jokerIdx++]);
        }
      }
    }

    // Add remaining jokers at end
    while (jokerIdx < jokers.length) {
      result.push(jokers[jokerIdx++]);
    }

    return result;
  }

  /**
   * Check if a card can replace a joker in a meld
   */
  private doesCardReplaceJoker(card: CardData, joker: CardData, meld: CardData[]): boolean {
    const jokerIndex = meld.indexOf(joker);
    if (jokerIndex === -1) return false;

    const regularCards = meld.filter(c =>
      c.suit !== 'JOKER_RED' && c.suit !== 'JOKER_BLACK'
    );

    if (regularCards.length === 0) return false;

    // Check if it's a SET (same value, different suits)
    const allSameValue = regularCards.every(c => c.value === regularCards[0].value);
    const allDifferentSuits = new Set(regularCards.map(c => c.suit)).size === regularCards.length;

    if (allSameValue && allDifferentSuits) {
      // SET: Can only replace joker if adding 4th card that completes all suits
      if (regularCards.length === 3) {
        const isCorrectValue = card.value === regularCards[0].value;
        const isUniqueSuit = !regularCards.some(c => c.suit === card.suit);
        return isCorrectValue && isUniqueSuit;
      }
      return false;
    }

    // Check if it's a RUN (same suit, sequential values)
    const allSameSuit = regularCards.every(c => c.suit === regularCards[0].suit);

    if (allSameSuit) {
      // RUN: Card must be correct suit and value that joker represents
      const jokerValue = this.getJokerRepresentedValue(joker, meld);
      const isCorrectSuit = card.suit === regularCards[0].suit;
      const isCorrectValue = card.value === jokerValue;
      return isCorrectSuit && isCorrectValue;
    }

    return false;
  }


  private getJokerRepresentedValue(joker: CardData, meld: CardData[]): number {
    const jokerIndex = meld.indexOf(joker);

    // Find first non-joker card before this position
    let baseValue = -1;
    let baseIndex = -1;

    for (let i = 0; i < meld.length; i++) {
      const card = meld[i];
      if (card.suit !== 'JOKER_RED' && card.suit !== 'JOKER_BLACK') {
        baseValue = card.value;
        baseIndex = i;
        break;
      }
    }

    if (baseValue === -1) return -1;

    // Calculate what value this joker position represents
    return baseValue + (jokerIndex - baseIndex);
  }

  private getCurrentPlayerId(): string {
    return this.playerOrder[this.currentPlayerIndex];
  }

  private getPlayerHand(playerId: string): CardData[] {
    if (!this.playerHands.has(playerId)) {
      this.playerHands.set(playerId, []);
    }
    return this.playerHands.get(playerId)!;
  }

  private getPlayerMelds(playerId: string): CardData[][] {
    if (!this.playerMelds.has(playerId)) {
      this.playerMelds.set(playerId, []);
    }
    return this.playerMelds.get(playerId)!;
  }

  private nextTurn(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    this.drewFromDiscard = false;
    this.discardCardDrawnId = null;
    this.undoSnapshot = null;
    this.phase = GamePhase.DRAW;
    this.turnNumber++;
  }

  private initializeDecks(): void {
    const suits: Array<'HEART' | 'DIAMOND' | 'SPADE' | 'CLUB'> = ['HEART', 'DIAMOND', 'SPADE', 'CLUB'];

    // Create 2 standard decks
    for (let deck = 0; deck < GAME_CONFIG.NUM_DECKS; deck++) {
      // Add regular cards (1-13)
      for (const suit of suits) {
        for (let value = 1; value <= 13; value++) {
          this.drawPile.push({
            id: uuidv4(),
            suit,
            value,
            isFaceUp: false,
          });
        }
      }

      // Add jokers
      this.drawPile.push({
        id: uuidv4(),
        suit: 'JOKER_RED',
        value: 14,
        isFaceUp: false,
      });

      this.drawPile.push({
        id: uuidv4(),
        suit: 'JOKER_BLACK',
        value: 14,
        isFaceUp: false,
      });
    }

    // Shuffle
    this.shuffleDeck();
  }

  private shuffleDeck(): void {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  private dealInitialHands(): void {
    for (let i = 0; i < GAME_CONFIG.INITIAL_HAND_SIZE; i++) {
      for (const playerId of this.playerOrder) {
        const card = this.drawPile.pop()!;
        card.isFaceUp = true;
        this.getPlayerHand(playerId).push(card);
      }
    }

    console.log(`🃏 Dealt ${GAME_CONFIG.INITIAL_HAND_SIZE} cards to each player`);
  }

  private selectFinishingCard(): void {
    // Find a non-joker card
    const nonJokers = this.drawPile.filter(
      card => card.suit !== 'JOKER_RED' && card.suit !== 'JOKER_BLACK'
    );

    if (nonJokers.length > 0) {
      const randomIndex = Math.floor(Math.random() * nonJokers.length);
      this.finishingCard = nonJokers[randomIndex];
      this.finishingCard.isFaceUp = true; // Finishing card is visible

      // Remove from draw pile
      const index = this.drawPile.indexOf(this.finishingCard);
      this.drawPile.splice(index, 1);

      console.log(`✨ Finishing card selected`);
    }
  }

  private shuffleDiscardIntoDeck(): void {
    if (this.discardPile.length === 0) return;

    // Keep top card in discard
    const topCard = this.discardPile.pop()!;

    // Move rest to draw pile
    this.drawPile.push(...this.discardPile);
    this.discardPile = [topCard];

    // Shuffle and flip cards face down
    for (const card of this.drawPile) {
      card.isFaceUp = false;
    }
    this.shuffleDeck();

    console.log(`🔄 Shuffled ${this.drawPile.length} cards from discard into deck`);
  }

  // ==========================================================================
  // ROUND MANAGEMENT
  // ==========================================================================

  /**
   * Calculate scores when a round ends
   */

  private calculateRoundScores(winnerId: string): Map<string, number> {
    const roundScores = new Map<string, number>();

    // Winner gets negative points based on other players' deadwood
    let winnerScore = 0;

    this.playerOrder.forEach(playerId => {
      if (playerId === winnerId) {
        // Calculate penalty from other players
        const otherPlayersPenalty = this.calculateTotalDeadwoodExcluding(winnerId);
        winnerScore = -otherPlayersPenalty;
        roundScores.set(playerId, winnerScore);
      } else {
        // Losers get positive deadwood penalty
        const deadwood = this.calculatePlayerDeadwood(playerId);
        roundScores.set(playerId, deadwood);
      }
    });

    return roundScores;
  }

  /**
   * Calculate deadwood for a specific player
   */
  private calculatePlayerDeadwood(playerId: string): number {
    const hand = this.getPlayerHand(playerId);
    const hasOpened = this.playersOpened.has(playerId);

    if (!hasOpened) return 100; // Fixed penalty for not opening

    return hand.reduce((total, card) => {
      if (card.suit === 'JOKER_RED' || card.suit === 'JOKER_BLACK') {
        return total + 25;
      }
      if (card.value === 1) return total + 15;
      if ([13, 12, 11].includes(card.value)) return total + 10;
      return total + card.value;
    }, 0);
  }

  /**
   * Calculate total deadwood excluding a specific player
   */
  private calculateTotalDeadwoodExcluding(excludePlayerId: string): number {
    return this.playerOrder.reduce((total, playerId) => {
      if (playerId === excludePlayerId) return total;
      return total + this.calculatePlayerDeadwood(playerId);
    }, 0);
  }

  /**
   * Handle round end logic
   */
  handleRoundEnd(winnerId: string): {
    roundScores: Map<string, number>;
    cumulativeScores: Map<string, number>;
    isFinalRound: boolean;
  } {
    // Calculate round scores
    const roundScores = this.calculateRoundScores(winnerId);

    // Store winner
    this.roundWinners.set(this.currentRound, winnerId);

    // Update cumulative scores
    roundScores.forEach((score, playerId) => {
      const current = this.cumulativeScores.get(playerId) || 0;
      this.cumulativeScores.set(playerId, current + score);
    });

    return {
      roundScores,
      cumulativeScores: new Map(this.cumulativeScores), // Return copy
      isFinalRound: this.currentRound >= this.totalRounds,
    };
  }

  /**
   * Start a new round
   */
  startNewRound(): void {
    if (this.currentRound >= this.totalRounds) {
      throw new Error('Cannot start new round - game is over');
    }

    this.currentRound++;

    // Reset round-specific state
    this.resetForNewRound();

    console.log(`🔄 Starting round ${this.currentRound}/${this.totalRounds}`);
  }
  private resetForNewRound(): void {
    this.drawPile = [];
    this.discardPile = [];
    this.finishingCard = null;
    this.finishingCardDrawn = false;
    this.drewFromDiscard = false;
    this.discardCardDrawnId = null;

    this.playerHands.clear();
    this.playerMelds.clear();
    this.playersOpened.clear();

    this.currentPlayerIndex = 0;
    this.phase = GamePhase.DRAW;
    this.turnNumber = 0;

    this.initializeDecks();
    this.dealInitialHands();
    this.selectFinishingCard();
  }

}