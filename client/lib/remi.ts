import { Deck } from "./deck";
import {
  GameEventEmitter,
  GameEventType,
  GamePhase,
  type AnyGameEvent,
  type GameStateSnapshot,
} from "./game-event";

import { ValidationBridge } from "@shared/validation/validation-bridge";
import {
  MoveValidator,
  ValidatableGameState,
  ValidatablePlayer,
} from "@shared/validation/move-validator";
// import {
//   cardsToCardData,
//   cardDataToCard,
//   isJokerCard,
//   findCardById,
//   normalizeSuit,
// } from "@shared/types/card.types";
import type { CardData, Suit } from "@shared/types/card-data.types"; // For validation
import { Card } from "../lib/card";
import { MeldValidator } from "@shared/index";

import { cardsToCardData, isJoker } from "@shared/types/card-data.types"; // For conversion

export interface MeldValidationResult {
  // Input
  selectedCards: Card[];

  // Analysis
  validMelds: Card[][]; // Groups of cards that form valid melds
  invalidCards: Card[]; // Cards that don't fit in any meld

  // Scoring
  totalScore: number;
  meldScores: number[]; // Score for each valid meld

  // Requirements
  meetsOpenRequirement: boolean; // Can player lay these melds?
  minimumNeeded: number; // How many more points needed to open
  hasOpened: boolean;
}

/**
 * ARCHITECTURE DECISION:
 * This class is PURE LOGIC - it knows nothing about Phaser or visuals.
 * - Manages ALL game state internally
 * - Validates ALL game rules
 * - Emits events when state changes
 * - Provides read-only access to state via getters
 * - Never directly manipulates visual objects
 */
export class Remi {
  // Event emitter for notifying visual layer
  #events = new GameEventEmitter();

  // Game state (PRIVATE - only accessible via methods/getters)
  #deck!: Deck;
  #playerHands: Card[][] = [];
  #playerMelds: Card[][][] = []; // Each player's laid-down melds
  #playersHaveOpened: boolean[] = [];
  #currentPlayer: number = 0;
  #phase: GamePhase = GamePhase.DRAW;
  #numPlayers: number = 0;
  #currentMelds: Card[][] = [];
  #currentScore: number = 0;
  #drewFromDiscard: boolean = false;
  #discardCardDrawn: Card | null = null;
  #finishingCard: Card | null = null;
  #finishingCardDrawn: boolean = false;
  gameStateSnapshot: {
    hand: Card[];
    melds: Card[][];
    phase: GamePhase;
    finishingCard: Card | null;
    discardCard: Card | null;
  } | null = null;

  constructor() {}

  public on(
    eventType: GameEventType,
    callback: (event: AnyGameEvent) => void
  ): () => void {
    return this.#events.on(eventType, callback);
  }

  public newGame(numPlayers: number = 2): void {
    this.#numPlayers = numPlayers;
    this.#currentPlayer = 0;
    this.#phase = GamePhase.DRAW;

    this.#deck = new Deck(2);
    this.#playerHands = [];
    this.#playerMelds = [];
    this.#playersHaveOpened = Array(numPlayers).fill(false);
    this.#currentMelds = [];
    this.#currentScore = 0;

    for (let i = 0; i < numPlayers; i++) {
      this.#playerHands[i] = [];
      this.#playerMelds[i] = [];
    }

    for (let i = 0; i < 14; i++) {
      for (let p = 0; p < numPlayers; p++) {
        const card = this.#deck.draw()!;
        card.flip();
        this.#playerHands[p].push(card);
      }
    }

    const nonJokers = this.#deck.drawPile.filter(
      (card) => !this.#isJoker(card)
    );
    if (nonJokers.length > 0) {
      const randomIndex = Math.floor(Math.random() * nonJokers.length);

      this.#finishingCard = nonJokers[randomIndex];
    } else {
      this.#finishingCard = null;
      console.warn("The draw pile contains no non-Joker cards to select from.");
    }

    // Emit events
    this.#events.emit({
      type: GameEventType.GAME_STARTED,
      timestamp: Date.now(),
      numPlayers,
      startingPlayer: 0,
    });

    this.#events.emit({
      type: GameEventType.PLAYER_TURN_STARTED,
      timestamp: Date.now(),
      playerIndex: 0,
      phase: GamePhase.DRAW,
    });
  }

  public getFinishingCard(): Card | null {
    return this.#finishingCard;
  }

  public hasDrawnFinishingCard(): boolean {
    return this.#finishingCardDrawn;
  }

  public canPlayerFinishNow(playerIndex: number): boolean {
    // Player can finish if they can lay down all cards and discard one
    const hand = this.getPlayerHand(playerIndex);
    return hand.length < 2; // 1 card to meld + 1 to discard
  }

  public getDiscardCard(): Card | null {
    return this.#discardCardDrawn;
  }

  public hasDrawnFromDiscard(): boolean {
    return this.#drewFromDiscard;
  }

  public setDiscardCard(card: Card | null = null): void {
    this.#discardCardDrawn = card;
  }

  public setHasDrawnFromDiscard(value: boolean = false): void {
    this.#drewFromDiscard = value;
  }

  #createValidatableState(): ValidatableGameState {
    const state = this.getState();

    // Convert players to ValidatablePlayer format
    const players: ValidatablePlayer[] = this.#playerHands.map(
      (hand, index) => ({
        id: `player_${index}`, // Use consistent player IDs
        name: `Player ${index + 1}`,
        handSize: hand.length,
        hasOpened: this.#playersHaveOpened[index] || false,
        melds:
          this.#playerMelds[index]?.map((meld) =>
            meld.map((card) => cardsToCardData([card])[0])
          ) || [],
        hand: hand.map((card) => cardsToCardData([card])[0]), // Include hand for validation
      })
    );

    // Get top discard card as CardData
    const topDiscard = state.topDiscardCard
      ? cardsToCardData([state.topDiscardCard])[0]
      : null;

    // Get finishing card as CardData
    const finishingCard = this.#finishingCard
      ? cardsToCardData([this.#finishingCard])[0]
      : null;

    return {
      currentPlayerId: `player_${this.#currentPlayer}`,
      phase: state.phase,
      players,
      drawPileSize: state.drawPileSize,
      discardPileTop: topDiscard,
      finishingCard,
      finishingCardDrawn: this.#finishingCardDrawn,
    };
  }

  public drawCard(playerIndex: number): boolean {
    // Validate
    const gameState = this.#createValidatableState();
    const playerId = `player_${playerIndex}`;

    // Use enhanced validator
    const validation = MoveValidator.canDrawFromDeck(playerId, gameState);
    if (!validation.valid) return false;

    // Also validate hand size
    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      const sizeCheck = MoveValidator.validateHandSizeForAction(
        "DRAW",
        player.handSize,
        player.hasOpened
      );
      if (!sizeCheck.valid) return false;
    }

    // Execute
    const card = this.#deck.draw()!;
    card.flip();
    this.#playerHands[playerIndex].push(card);

    // Emit events
    this.#events.emit({
      type: GameEventType.CARD_DRAWN_FROM_DECK,
      timestamp: Date.now(),
      playerIndex,
      card,
      handSize: this.#playerHands[playerIndex].length,
    });

    // Transition to MELD phase
    this.setPhase(GamePhase.MELD);

    return true;
  }

  public restoreState(snapshot: {
    hand: Card[];
    melds: Card[][];
    phase: GamePhase;
    finishingCard: Card | null;
    discardCard: Card | null;
  }): void {
    // Deep restore hand with new instances
    this.#playerHands[0] = snapshot.hand.map((card) => {
      const restored = new Card(card.suit, card.value);
      if (card.isFaceUp) restored.flip();
      return restored;
    });

    // Deep restore melds
    this.#playerMelds[0] = snapshot.melds.map((meld) =>
      meld.map((card) => {
        const restored = new Card(card.suit, card.value);
        if (card.isFaceUp) restored.flip();
        return restored;
      })
    );

    if (snapshot.finishingCard !== undefined) {
      this.setFinishingCard(snapshot.finishingCard);
    }

    if (snapshot.discardCard) {
      const restored = new Card(
        snapshot.discardCard.suit,
        snapshot.discardCard.value
      );
      if (snapshot.discardCard.isFaceUp) restored.flip();

      const alreadyInPile = this.#deck.discardPile.some(
        (c) => c.id === restored.id
      );
      if (!alreadyInPile) {
        this.#deck.discardPile.push(restored);
      }
    }
    this.#phase = snapshot.phase;
    this.#currentMelds = [];
    this.#currentScore = 0;
  }

  public drawFromDiscard(playerIndex: number): boolean {
    const gameState = this.#createValidatableState();
    const playerId = `player_${playerIndex}`;

    const validation = MoveValidator.canDrawFromDiscard(playerId, gameState);
    if (!validation.valid) {
      console.log("Draw from discard validation failed:", validation.error);
      return false;
    }

    this.setHasDrawnFromDiscard(true);

    const card = this.#deck.discardPile.pop()!;
    card.flip();
    this.#playerHands[playerIndex].push(card);

    this.setDiscardCard(card);

    this.#events.emit({
      type: GameEventType.CARD_DRAWN_FROM_DISCARD,
      timestamp: Date.now(),
      playerIndex,
      card,
      handSize: this.#playerHands[playerIndex].length,
    });

    this.setPhase(GamePhase.MELD);
    return true;
  }

  public takeFinishingCard(playerIndex: number): boolean {
    const gameState = this.#createValidatableState();
    const playerId = `player_${playerIndex}`;

    const validation = MoveValidator.canTakeFinishingCard(playerId, gameState);
    if (!validation.valid) {
      console.log("Take finishing card validation failed:", validation.error);
      return false;
    }

    const card = this.#finishingCard;
    this.#finishingCard = null;
    this.#finishingCardDrawn = true;
    if (card === null) return false;
    card.flip();
    this.#playerHands[playerIndex].push(card);

    this.#events.emit({
      type: GameEventType.FINISHING_CARD,
      timestamp: Date.now(),
      playerIndex,
      card,
      handSize: this.#playerHands[playerIndex].length,
    });

    this.setPhase(GamePhase.MELD);
    return true;
  }

  public saveGameStateSnapshot(): void {
    const hand = this.getPlayerHand(0);
    const melds = this.getPlayerMelds(0);
    const phase = this.getState().phase;

    this.gameStateSnapshot = {
      hand: hand,
      melds: melds,
      phase,
      finishingCard: this.getFinishingCard(),
      discardCard: this.getState().topDiscardCard,
    };
    console.log("Game state saved for potential undo");
  }

  // Add to Remi class
  public setFinishingCardDrawn(state: boolean = false): void {
    this.#finishingCardDrawn = state;
  }
  public getFinishingState(): boolean {
    return this.#finishingCardDrawn;
  }

  public setFinishingCard(card: Card | null = null): void {
    this.#finishingCard = card;
  }

  public returnCardToDiscard(card: Card): void {
    // Add card back to top of discard pile
    this.#deck.discardPile.push(card);
  }

  public removeLastMeld(playerIndex: number): boolean {
    const melds = this.#playerMelds[playerIndex];
    if (melds.length === 0) return false;

    const removedMeld = melds.pop()!;

    // Return cards to hand
    const hand = this.#playerHands[playerIndex];
    removedMeld.forEach((card) => hand.push(card));

    return true;
  }

  public checkGameOver(): void {
    // Check if current player has no cards left
    const currentHand = this.#playerHands[this.#currentPlayer];
    if (currentHand.length === 0) {
      this.endGame(this.#currentPlayer);
    }
  }

  public validateMelds(
    playerIndex: number,
    selectedCards: Card[]
  ): MeldValidationResult {
    const hasOpened = this.#playersHaveOpened[playerIndex];

    // Use the validator's validateMelds method
    const result = ValidationBridge.validateMelds(selectedCards, hasOpened, 51);

    return {
      selectedCards,
      validMelds: result.validMelds as Card[][],
      invalidCards: result.invalidCards as Card[],
      totalScore: result.totalScore,
      meldScores: result.meldScores,
      meetsOpenRequirement: result.meetsOpenRequirement,
      minimumNeeded: result.minimumNeeded,
      hasOpened,
    };
  }

  #findCardInGame(id: string): Card {
    // Search in player hands
    for (const hand of this.#playerHands) {
      const card = hand.find((c) => c.id === id);
      if (card) return card;
    }

    // Search in player melds
    for (const melds of this.#playerMelds) {
      for (const meld of melds) {
        const card = meld.find((c) => c.id === id);
        if (card) return card;
      }
    }

    throw new Error(`Card ${id} not found in game`);
  }

  public currentScore(): number {
    return this.#currentScore;
  }

  public layDownMelds(playerIndex: number, melds: Card[][]): boolean {
    if (this.#phase !== GamePhase.MELD && this.#phase !== GamePhase.DISCARD) {
      return false;
    }
    if (playerIndex !== this.#currentPlayer) return false;

    // Validate all cards are in hand
    const hand = this.#playerHands[playerIndex];
    const allCardsInHand = melds.flat().every((card) => hand.includes(card));
    if (!allCardsInHand) return false;

    // Validate melds
    const allValid = melds.every(
      (meld) => this.#isValidSet(meld) || this.#isValidRun(meld)
    );
    if (!allValid) return false;

    // Check opening requirement
    const hasOpened = this.#playersHaveOpened[playerIndex];
    const totalScore = this.#calculateTotalMeldScore(melds);
    if (!hasOpened && totalScore < 51) return false;

    const sortedMelds = melds.map((meld) => this.#sortMeldForDisplay(meld));

    // Execute: Remove from hand, add to table
    sortedMelds.flat().forEach((card) => {
      const idx = hand.indexOf(card);
      if (idx > -1) hand.splice(idx, 1);
    });
    this.#playerMelds[playerIndex].push(...sortedMelds);

    // Update opened status
    if (!hasOpened) {
      this.#playersHaveOpened[playerIndex] = true;
    }

    this.#currentScore = 0;
    this.#currentMelds = [];

    // Emit
    this.#events.emit({
      type: GameEventType.MELDS_LAID_DOWN,
      timestamp: Date.now(),
      playerIndex,
      melds: sortedMelds,
      meldScore: totalScore,
      playerHasOpened: this.#playersHaveOpened[playerIndex],
    });

    return true;
  }

  #sortMeldForDisplay(meld: Card[]): Card[] {
    return ValidationBridge.sortMeldForDisplay(meld);
  }

  // Replace #sortRunCards
  #sortRunCards(cards: Card[]): Card[] {
    return ValidationBridge.sortRunCards(cards);
  }

  public addCardToMeld(
    playerIndex: number,
    card: Card,
    meldOwner: number,
    meldIndex: number
  ): boolean {
    console.log('addCardToMeld called:', { playerIndex, cardId: card.id, meldOwner, meldIndex });
    
    const hand = this.#playerHands[playerIndex];
    const meld = this.#playerMelds[meldOwner]?.[meldIndex];
    if (!meld) return false;

    const jokerIndex = meld.findIndex((c) => this.#isJoker(c));
    if (jokerIndex !== -1) {
      const joker = meld[jokerIndex];

      // Use bridge to check if this card can replace the joker
      if (ValidationBridge.canCardReplaceJoker(card, joker, meld)) {
        // Execute replacement
        const idx = hand.indexOf(card);
        hand.splice(idx, 1);
        meld[jokerIndex] = card;

        // Return joker to hand
        hand.push(joker);

        // Sort meld after modification
        this.#sortAndRepositionMeld(meld);

        // Emit event
        this.#events.emit({
          type: GameEventType.CARD_ADDED_TO_MELD,
          timestamp: Date.now(),
          playerIndex,
          card,
          meldIndex,
          meldOwner,
          replacedJoker: joker,
        });

        return true;
      }
    }
    const canAdd = ValidationBridge.canAddToMeld(card, meld);

    // Check 1: Phase
    if (this.#phase !== GamePhase.MELD && this.#phase !== GamePhase.DISCARD) {
      console.log('❌ Failed: Wrong phase. Current:', this.#phase);
      return false;
    }
    
    // Check 2: Current player
    if (playerIndex !== this.#currentPlayer) {
      console.log('❌ Failed: Not current player. Expected:', this.#currentPlayer, 'Got:', playerIndex);
      return false;
    }
    
    // Check 3: Both players opened
    if (!this.#playersHaveOpened[playerIndex] || !this.#playersHaveOpened[meldOwner]) {
      console.log('❌ Failed: Players not opened.', {
        playerOpened: this.#playersHaveOpened[playerIndex],
        ownerOpened: this.#playersHaveOpened[meldOwner]
      });
      return false;
    }
    
    // Check 4: Meld exists
    if (!meld) {
      console.log('❌ Failed: Meld not found.', {
        meldOwner,
        meldIndex,
        ownerMelds: this.#playerMelds[meldOwner]?.length ?? 0
      });
      return false;
    }
    
    // Check 5: Card in hand (LIKELY CULPRIT!)
    if (!hand.includes(card)) {
      console.log('❌ Failed: Card not in hand!', {
        cardId: card.id,
        handCardIds: hand.map(c => c.id),
        cardInHandById: hand.some(c => c.id === card.id)  // Check by ID instead
      });
      return false;
    }
    
    // Check 6: ValidationBridge check
    if (!canAdd) {
      console.log('❌ Failed: ValidationBridge.canAddToMeld returned null', {
        card: { id: card.id, suit: card.suit, value: card.value },
        meldCards: meld.map(c => ({ id: c.id, suit: c.suit, value: c.value }))
      });
      return false;
    }

    console.log('✅ All checks passed, proceeding with add');

    // Check card is in hand
    if (!hand.includes(card)) return false;
    if (!canAdd) return false;

    

    // No joker replacement - just add the card normally
    const idx = hand.indexOf(card);
    hand.splice(idx, 1);
    meld.push(card);

    this.#sortAndRepositionMeld(meld);

    // Emit
    this.#events.emit({
      type: GameEventType.CARD_ADDED_TO_MELD,
      timestamp: Date.now(),
      playerIndex,
      card,
      meldIndex,
      meldOwner,
      replacedJoker: null,
    });

    return true;
  }

  #sortAndRepositionMeld(meld: Card[]): void {
    const sorted = ValidationBridge.sortMeldForDisplay(meld);
    // Replace meld contents with sorted version
    meld.length = 0;
    meld.push(...sorted);
  }

  #doesCardReplaceJoker(card: Card, joker: Card, meld: Card[]): boolean {
    return ValidationBridge.canCardReplaceJoker(card, joker, meld);
  }

  public discardCard(playerIndex: number, card: Card): boolean {
    const gameState = this.#createValidatableState();
    const playerId = `player_${playerIndex}`;

    // Get player hand for validation
    const hand = this.#playerHands[playerIndex];
    const handData = hand.map((c) => cardsToCardData([c])[0]);

    const validation = MoveValidator.canDiscard(
      playerId,
      card.id,
      gameState,
      handData
    );
    if (!validation.valid) {
      console.log("Discard validation failed:", validation.error);
      return false;
    }
    const idx = hand.indexOf(card);
    if (idx === -1) return false;

    // Execute
    hand.splice(idx, 1);
    this.#deck.discardPile.push(card);

    // Emit
    this.#events.emit({
      type: GameEventType.CARD_DISCARDED,
      timestamp: Date.now(),
      playerIndex,
      card,
      handSize: hand.length,
    });

    // Check win condition
    if (hand.length === 0) {
      this.endGame(playerIndex);
      return true;
    }

    // End turn
    this.endTurn();
    return true;
  }

  public reorderHand(
    playerIndex: number,
    fromIndex: number,
    toIndex: number
  ): boolean {
    const hand = this.#playerHands[playerIndex];
    const playerId = `player_${playerIndex}`;
    const validation = MoveValidator.canReorderHand(
      playerId,
      fromIndex,
      toIndex,
      hand.length
    );
    if (!validation.valid) return false;

    const [card] = hand.splice(fromIndex, 1);
    hand.splice(toIndex, 0, card);

    return true;
  }

  public getState(): GameStateSnapshot {
    return {
      currentPlayer: this.#currentPlayer,
      phase: this.#phase,
      numPlayers: this.#numPlayers,
      drawPileSize: this.#deck.drawPile.length,
      discardPileSize: this.#deck.discardPile.length,
      topDiscardCard:
        this.#deck.discardPile[this.#deck.discardPile.length - 1] || null,
      playersHaveOpened: [...this.#playersHaveOpened],
      handSizes: this.#playerHands.map((h) => h.length),
    };
  }

  public getPlayerHand(playerIndex: number): Card[] {
    return [...(this.#playerHands[playerIndex] || [])];
  }

  public getPlayerMelds(playerIndex: number): Card[][] {
    return this.#playerMelds[playerIndex]?.map((meld) => [...meld]) || [];
  }

  public getCurrentMelds(): Card[][] {
    // Split into valid meld groups
    return this.#currentMelds;
  }

  public hasPlayerOpened(playerIndex: number): boolean {
    return this.#playersHaveOpened[playerIndex] || false;
  }

  public setPhase(newPhase: GamePhase): void {
    this.#phase = newPhase;
    this.#events.emit({
      type: GameEventType.PHASE_CHANGED,
      timestamp: Date.now(),
      newPhase,
      currentPlayer: this.#currentPlayer,
    });
  }

  private endTurn(): void {
    const previousPlayer = this.#currentPlayer;
    this.#currentPlayer = (this.#currentPlayer + 1) % this.#numPlayers;

    // Reset discard tracking for next turn
    this.#drewFromDiscard = false;
    this.#discardCardDrawn = null;
    this.#finishingCardDrawn = false;
    this.gameStateSnapshot = null;

    this.#events.emit({
      type: GameEventType.TURN_ENDED,
      timestamp: Date.now(),
      previousPlayer,
      nextPlayer: this.#currentPlayer,
    });

    this.setPhase(GamePhase.DRAW);

    this.#events.emit({
      type: GameEventType.PLAYER_TURN_STARTED,
      timestamp: Date.now(),
      playerIndex: this.#currentPlayer,
      phase: this.#phase,
    });
  }

  private endGame(winner: number): void {
    this.setPhase(GamePhase.GAME_OVER);

    // Reset discard tracking for next turn
    this.#drewFromDiscard = false;
    this.#discardCardDrawn = null;
    this.#finishingCardDrawn = false;
    this.gameStateSnapshot = null;

    // Calculate final scores (simplified)
    const scores = this.#playerHands.map((hand) =>
      hand.reduce((sum, card) => sum + this.#cardPointValue(card), 0)
    );

    this.#events.emit({
      type: GameEventType.GAME_OVER,
      timestamp: Date.now(),
      winner,
      scores,
    });
  }

  #isValidSet(cards: Card[]): boolean {
    return ValidationBridge.isValidSet(cards); // Use Remi-specific version
  }

  #isValidRun(cards: Card[]): boolean {
    return ValidationBridge.isValidRun(cards);
  }

  #isValidMeld(cards: Card[]): boolean {
    return ValidationBridge.isValidMeld(cards);
  }

  #calculateTotalMeldScore(melds: Card[][]): number {
    return melds.reduce((sum, meld) => sum + this.#calculateMeldValue(meld), 0);
  }

  #calculateMeldValue(meld: Card[]): number {
    return ValidationBridge.calculateMeldScore(meld);
  }

  #cardPointValue(card: Card): number {
    // 1. Explicitly handle the physical Joker card first
    // Checks suit OR value 14, depending on how your Card class constructs Jokers
    if (this.#isJoker(card)) {
      return 0; // Or whatever base value a Joker has in hand (usually 0 or 25 depending on rules)
      // Note: In a meld, this function isn't called for the Joker itself;
      // #getJokerValueInMeld calculates the value it *represents*.
    }

    // 2. Handle Regular Cards
    if (card.value === 1) return 10; // Low Ace (always 10 pts in Rummy usually)
    if (card.value >= 2 && card.value <= 10) return card.value;
    if (card.value >= 11 && card.value <= 13) return 10; // K, Q, J

    // 3. Handle Virtual High Ace
    // This case is only hit if you manually construct a virtual card
    // object with value 14 inside #getJokerValueInRun
    if (card.value === 14) return 10;

    return 0;
  }

  #canCardsBeAdjacent(card1: Card, card2: Card): boolean {
    return ValidationBridge.canCardsBeAdjacent(card1, card2);
  }

  #isJoker(card: Card): boolean {
    return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
  }
}
