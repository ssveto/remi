// shared/validation/move-validator.ts
import { GamePhase } from "../types/game-state.types";
import { MeldValidator } from "./meld-validator";
import type { CardData } from '../types/card-data.types'; // For validation

/**
 * Result of a move validation check
 */
export interface MoveValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Common interface for validation - works with both GameState and GameStateUpdate
 * This allows validators to work on both server (GameState) and client (GameStateUpdate)
 */
export interface ValidatableGameState {
  currentPlayerId: string;
  phase: string; // GamePhase as string for compatibility
  players: ValidatablePlayer[];
  drawPileSize: number;
  discardPileTop: CardData | null;
  finishingCard: CardData | null;
  finishingCardDrawn: boolean;
}

export interface ValidatablePlayer {
  id: string;
  name: string;
  handSize: number;
  hasOpened: boolean;
  melds: CardData[][];
  hand?: CardData[]; // Only available on server or for current player
}

/**
 * Validates game moves (actions) according to Remi rules.
 * All methods are static and pure - no side effects.
 *
 * Works with both:
 * - GameState (server-side)
 * - GameStateUpdate (client-side from socket)
 */
export class MoveValidator {
  /**
   * Validate if a player can draw a card from the deck
   */
  static canDrawFromDeck(
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in DRAW phase
    if (gameState.phase !== GamePhase.DRAW && gameState.phase !== "DRAW") {
      return {
        valid: false,
        error: "Wrong phase - must draw first",
        errorCode: "WRONG_PHASE",
      };
    }

    // Must have cards in deck
    if (gameState.drawPileSize === 0) {
      return {
        valid: false,
        error: "Draw pile is empty",
        errorCode: "EMPTY_DECK",
      };
    }

    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    const sizeCheck = this.validateHandSizeForAction(
      "DRAW",
      player.handSize,
      player.hasOpened
    );
    if (!sizeCheck.valid) return sizeCheck;

    // Add game state integrity check
    const integrityCheck = this.validateGameStateIntegrity(gameState);
    if (!integrityCheck.valid) return integrityCheck;

    return { valid: true };
  }

  /**
   * Validate if a player can draw from discard pile
   */
  static canDrawFromDiscard(
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in DRAW phase
    if (gameState.phase !== GamePhase.DRAW && gameState.phase !== "DRAW") {
      return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
    }

    // Must have cards in discard pile
    if (!gameState.discardPileTop) {
      return {
        valid: false,
        error: "Discard pile is empty",
        errorCode: "EMPTY_DISCARD",
      };
    }

    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Hand size check
    if (player.handSize >= 15) {
      return { valid: false, error: "Hand is full", errorCode: "HAND_FULL" };
    }

    return { valid: true };
  }

  static isJoker(card: CardData): boolean {
    return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
  }

  /**
   * Validate if a player can take the finishing card
   */
  static canTakeFinishingCard(
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in DRAW phase
    if (gameState.phase !== GamePhase.DRAW && gameState.phase !== "DRAW") {
      return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
    }

    // Finishing card must exist and not be drawn
    if (!gameState.finishingCard || gameState.finishingCardDrawn) {
      return {
        valid: false,
        error: "Finishing card not available",
        errorCode: "NO_FINISHING_CARD",
      };
    }

    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Player must not have opened yet
    if (player.hasOpened) {
      return {
        valid: false,
        error: "Cannot take finishing card after opening",
        errorCode: "ALREADY_OPENED",
      };
    }

    const sizeCheck = this.validateHandSizeForAction(
      "TAKE_FINISHING_CARD",
      player.handSize,
      player.hasOpened
    );
    if (!sizeCheck.valid) return sizeCheck;

    return { valid: true };
  }

  /**
   * Validate if a player can discard a card
   * Note: For client-side validation, pass the player's hand separately
   */
  static canDiscard(
    playerId: string,
    cardId: string,
    gameState: ValidatableGameState,
    playerHand?: CardData[]
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Can discard in MELD or DISCARD phase
    const phase = gameState.phase;
    const isMeldPhase = phase === GamePhase.MELD || phase === "MELD";
    const isDiscardPhase = phase === GamePhase.DISCARD || phase === "DISCARD";

    if (!isMeldPhase && !isDiscardPhase) {
      return {
        valid: false,
        error: "Draw a card first",
        errorCode: "WRONG_PHASE",
      };
    }

    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Get hand from player object or from parameter
    const hand = player.hand || playerHand;
    if (!hand) {
      // Can't validate card ownership without hand - assume valid on client
      return { valid: true };
    }

    // Must have the card in hand
    if (!hand.some((card) => card.id === cardId)) {
      return {
        valid: false,
        error: "Card not in hand",
        errorCode: "CARD_NOT_IN_HAND",
      };
    }

    return { valid: true };
  }

  static canTransitionToPhase(
    currentPhase: string,
    targetPhase: string,
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {

    if (gameState) {
    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return { valid: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' };
    }
  }

    const transitions: Record<string, string[]> = {
      DRAW: ["MELD"],
      MELD: ["DISCARD", "MELD"], // Can stay in MELD for multiple melds
      DISCARD: ["DRAW"],
    };



    const allowed = transitions[currentPhase] || [];
    if (!allowed.includes(targetPhase)) {
      return {
        valid: false,
        error: `Cannot transition from ${currentPhase} to ${targetPhase}`,
        errorCode: "INVALID_PHASE_TRANSITION",
      };
    }

    return { valid: true };
  }

  static validateHandSizeForAction(
    action: string,
    currentHandSize: number,
    hasOpened: boolean
  ): MoveValidationResult {
    switch (action) {
      case "DRAW":
        if (currentHandSize >= 15) {
          return {
            valid: false,
            error: "Hand is full",
            errorCode: "HAND_FULL",
          };
        }
        return { valid: true };

      case "TAKE_FINISHING_CARD":
        if (hasOpened) {
          return {
            valid: false,
            error: "Already opened",
            errorCode: "ALREADY_OPENED",
          };
        }
        if (currentHandSize !== 14) {
          return {
            valid: false,
            error: "Must have exactly 14 cards",
            errorCode: "WRONG_HAND_SIZE",
          };
        }
        return { valid: true };

      case "DISCARD":
        if (currentHandSize === 0) {
          return {
            valid: false,
            error: "No cards to discard",
            errorCode: "EMPTY_HAND",
          };
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  }

  /**
   * Validate if a player can lay down melds
   * Note: For client-side validation, pass the player's hand separately
   */
  static canLayMelds(
    playerId: string,
    melds: CardData[][],
    gameState: ValidatableGameState,
    openingRequirement: number = 51,
    playerHand?: CardData[]
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in MELD phase
    if (gameState.phase !== GamePhase.MELD && gameState.phase !== "MELD") {
      return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
    }

    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Validate each meld
    for (let i = 0; i < melds.length; i++) {
      const meld = melds[i];

      // Check if meld is valid (set or run)
      if (!MeldValidator.isValidSet(meld) && !MeldValidator.isValidRun(meld)) {
        return {
          valid: false,
          error: `Meld ${i + 1} is not a valid set or run`,
          errorCode: "INVALID_MELD",
        };
      }

      // Check if player has all cards in hand (if hand available)
      const hand = player.hand || playerHand;
      if (hand) {
        for (const card of meld) {
          if (!hand.some((c) => c.id === card.id)) {
            return {
              valid: false,
              error: "One or more cards not in hand",
              errorCode: "CARD_NOT_IN_HAND",
            };
          }
        }
      }
    }

    // Check for duplicate cards across melds
    const allMeldCards = melds.flat();
    const cardIds = allMeldCards.map((c) => c.id);
    if (cardIds.length !== new Set(cardIds).size) {
      return {
        valid: false,
        error: "Cannot use same card in multiple melds",
        errorCode: "DUPLICATE_CARDS",
      };
    }

    // If player hasn't opened, check opening requirement
    if (!player.hasOpened) {
      const totalScore = melds.reduce(
        (sum, meld) => sum + MeldValidator.calculateMeldScore(meld),
        0
      );

      if (totalScore < openingRequirement) {
        return {
          valid: false,
          error: `Need ${openingRequirement} points to open (have ${totalScore})`,
          errorCode: "INSUFFICIENT_POINTS",
        };
      }
    }

    return { valid: true };
  }

  static validateGameStateIntegrity(
    gameState: ValidatableGameState
  ): MoveValidationResult {
    // Validate current player
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer) {
      return { valid: false, error: 'Current player not found', errorCode: 'PLAYER_NOT_FOUND' };
    }

    // Validate player hand sizes
    for (const player of gameState.players) {
      if (player.handSize < 0 || player.handSize > 15) {
        return { 
          valid: false, 
          error: `Player ${player.name} has invalid hand size: ${player.handSize}`,
          errorCode: 'INVALID_HAND_SIZE' 
        };
      }
    }

    // Validate draw pile
    if (gameState.drawPileSize < 0) {
      return { valid: false, error: 'Draw pile has negative size', errorCode: 'INVALID_DRAW_PILE' };
    }

    // Validate phase
    const validPhases = [GamePhase.DRAW, GamePhase.MELD, GamePhase.DISCARD, GamePhase.GAME_OVER];
    if (!validPhases.includes(gameState.phase as GamePhase) && 
        !['DRAW', 'MELD', 'DISCARD', 'GAME_OVER'].includes(gameState.phase)) {
      return { valid: false, error: `Invalid phase: ${gameState.phase}`, errorCode: 'INVALID_PHASE' };
    }

    return { valid: true };
  }

  static canReorderHand(
    playerId: string,
    fromIndex: number,
    toIndex: number,
    handSize: number
  ): MoveValidationResult {

    if (!playerId) {
      return { valid: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' };
    }
    if (fromIndex < 0 || fromIndex >= handSize) {
      return { valid: false, error: 'Invalid from index', errorCode: 'INVALID_INDEX' };
    }
    
    if (toIndex < 0 || toIndex >= handSize) {
      return { valid: false, error: 'Invalid to index', errorCode: 'INVALID_INDEX' };
    }
    
    if (fromIndex === toIndex) {
      return { valid: false, error: 'Cannot move card to same position', errorCode: 'SAME_POSITION' };
    }
    
    return { valid: true };
  }

  /**
   * Validate if player can remove a meld (for undo)
   */
  static canRemoveMeld(
    playerId: string,
    meldIndex: number,
    playerMelds: CardData[][]
  ): MoveValidationResult {

    
    if (!playerId) {
      return { valid: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' };
    }
  
    if (meldIndex < 0 || meldIndex >= playerMelds.length) {
      return { valid: false, error: 'Invalid meld index', errorCode: 'INVALID_MELD_INDEX' };
    }
    
    // Check if player has any melds
    if (playerMelds.length === 0) {
      return { valid: false, error: 'No melds to remove', errorCode: 'NO_MELDS' };
    }
    
    return { valid: true };
  }

  /**
   * Validate if deck can be shuffled
   */
  static canShuffleDeck(gameState: ValidatableGameState): MoveValidationResult {
    if (gameState.drawPileSize > 0) {
      return { valid: false, error: 'Draw pile is not empty', errorCode: 'DRAW_PILE_NOT_EMPTY' };
    }
    
    // Check if there are cards in discard pile to shuffle
    const totalCards = gameState.players.reduce((sum, player) => sum + player.handSize, 0) +
                      gameState.drawPileSize;
    
    if (totalCards >= 104) { // Assuming 2 decks
      return { valid: false, error: 'All cards are in play', errorCode: 'NO_CARDS_TO_SHUFFLE' };
    }
    
    return { valid: true };
  }


  /**
   * Validate if a player can add a card to an existing meld
   *
   * Supports both single-player (index-based) and multiplayer (ID-based) modes:
   * - Single-player: playerId and meldOwner are numbers (player indices)
   * - Multiplayer: playerId and meldOwner are strings (socket IDs)
   *
   * @param playerId - Player making the move (index for single-player, ID for multiplayer)
   * @param cardId - ID of the card to add
   * @param meldOwner - Player who owns the meld (index for single-player, ID for multiplayer)
   * @param meldIndex - Index of the meld to add to (0-indexed)
   * @param gameState - Current game state
   * @param playerHand - Optional player hand for client-side validation
   */
  static canAddToMeld(
    playerId: string | number,
    cardId: string,
    meldOwner: string | number,
    meldIndex: number,
    gameState: ValidatableGameState,
    playerHand?: CardData[]
  ): MoveValidationResult {
    // Normalize player identification - get the player object
    const player = this.getPlayerByIdOrIndex(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Must be player's turn (compare by ID since that's consistent)
    if (gameState.currentPlayerId !== player.id) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in MELD phase
    if (gameState.phase !== GamePhase.MELD && gameState.phase !== "MELD") {
      return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
    }

    // Get hand from player object or from parameter
    const hand = player.hand || playerHand;

    // Find the card to add
    let card: CardData | undefined;
    if (hand) {
      card = hand.find((c) => c.id === cardId);
      if (!card) {
        return {
          valid: false,
          error: "Card not in hand",
          errorCode: "CARD_NOT_IN_HAND",
        };
      }
    }

    // Get the meld owner
    const owner = this.getPlayerByIdOrIndex(gameState, meldOwner);
    if (!owner) {
      return {
        valid: false,
        error: "Meld owner not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Check if meld exists
    if (meldIndex < 0 || meldIndex >= owner.melds.length) {
      return {
        valid: false,
        error: "Meld does not exist",
        errorCode: "MELD_NOT_FOUND",
      };
    }

    const meld = owner.melds[meldIndex];

    // Check if card can be added to meld (only if we have the card)
    if (card && !MeldValidator.canAddToMeld(card, meld)) {
      return {
        valid: false,
        error: "Card cannot be added to this meld",
        errorCode: "INVALID_ADDITION",
      };
    }

    // Player must have opened to add to others' melds
    // Compare by player ID for consistency
    if (owner.id !== player.id && !player.hasOpened) {
      return {
        valid: false,
        error: "Must open before adding to other players' melds",
        errorCode: "NOT_OPENED",
      };
    }

    return { valid: true };
  }

  /**
   * Validate if a player can skip the meld phase
   */
  static canSkipMeld(
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {
    // Must be player's turn
    if (gameState.currentPlayerId !== playerId) {
      return {
        valid: false,
        error: "Not your turn",
        errorCode: "NOT_YOUR_TURN",
      };
    }

    // Must be in MELD phase
    if (gameState.phase !== GamePhase.MELD && gameState.phase !== "MELD") {
      return {
        valid: false,
        error: "Not in meld phase",
        errorCode: "WRONG_PHASE",
      };
    }

    return { valid: true };
  }

  /**
   * Validate if game can end (player going out)
   */
  static canGoOut(
    playerId: string,
    gameState: ValidatableGameState
  ): MoveValidationResult {
    const player = this.getPlayer(gameState, playerId);
    if (!player) {
      return {
        valid: false,
        error: "Player not found",
        errorCode: "PLAYER_NOT_FOUND",
      };
    }

    // Must have opened
    if (!player.hasOpened) {
      return {
        valid: false,
        error: "Must open before going out",
        errorCode: "NOT_OPENED",
      };
    }

    // Must have laid all cards (except one to discard)
    if (player.handSize > 1) {
      return {
        valid: false,
        error: "Must lay down all cards",
        errorCode: "CARDS_REMAINING",
      };
    }

    return { valid: true };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Get player from game state by ID (string) or index (number)
   * Works with both single-player (index-based) and multiplayer (ID-based) modes
   */
  private static getPlayerByIdOrIndex(
    gameState: ValidatableGameState,
    playerIdOrIndex: string | number
  ): ValidatablePlayer | undefined {
    if (typeof playerIdOrIndex === "number") {
      // Single-player mode: lookup by index
      if (playerIdOrIndex < 0 || playerIdOrIndex >= gameState.players.length) {
        return undefined;
      }
      return gameState.players[playerIdOrIndex];
    } else {
      // Multiplayer mode: lookup by ID
      return gameState.players.find((p) => p.id === playerIdOrIndex);
    }
  }

  /**
   * Get player from game state by ID
   * Works with both GameState and GameStateUpdate player arrays
   */
  private static getPlayer(
    gameState: ValidatableGameState,
    playerId: string
  ): ValidatablePlayer | undefined {
    return gameState.players.find((p) => p.id === playerId);
  }

  /**
   * Get player index from game state by ID
   */
  static getPlayerIndex(
    gameState: ValidatableGameState,
    playerId: string
  ): number {
    return gameState.players.findIndex((p) => p.id === playerId);
  }

  /**
   * Get allowed actions for a player in current state
   */
  static getAllowedActions(
    playerId: string,
    gameState: ValidatableGameState
  ): string[] {
    const actions: string[] = [];

    if (gameState.currentPlayerId !== playerId) {
      return []; // Not player's turn
    }

    const phase = gameState.phase;

    if (phase === GamePhase.DRAW || phase === "DRAW") {
      if (this.canDrawFromDeck(playerId, gameState).valid) {
        actions.push("DRAW_DECK");
      }
      if (this.canDrawFromDiscard(playerId, gameState).valid) {
        actions.push("DRAW_DISCARD");
      }
      if (this.canTakeFinishingCard(playerId, gameState).valid) {
        actions.push("TAKE_FINISHING_CARD");
      }
    } else if (phase === GamePhase.MELD || phase === "MELD") {
      actions.push("LAY_MELDS");
      actions.push("ADD_TO_MELD");
      actions.push("SKIP_MELD");
    } else if (phase === GamePhase.DISCARD || phase === "DISCARD") {
      actions.push("DISCARD");
    }

    return actions;
  }
}
