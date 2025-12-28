// client/scenes/handlers/
// .ts
import * as Phaser from "phaser";
import { Card } from "../../lib/card";
import { Remi } from "../../lib/remi";
import { GameEventType, GamePhase } from "../../lib/game-event";
import { SCENE_KEYS, COLORS, DEPTHS, ASSET_KEYS } from "../common";
import { UIHelpers } from "../../lib/ui-helpers";

// Import managers
import {
  HandManager,
  MeldManager,
  PlayerIconManager,
  DragDropManager,
  AIManager,
  CardGameObject,
  HAND_LAYOUT,
  PlayerMeld,
} from "../managers";
import { AIDifficulty } from "lib/ai-player";

// =============================================================================
// TYPES
// =============================================================================

interface RoundResults {
  round: number;
  winner: number;
  scores: number[];
  totalScores: Map<number, number>;
}

interface FinalResults {
  winner: number;
  totalScores: Map<number, number>;
}

export interface GameSceneInterface {
  // Phaser scene
  scale: Phaser.Scale.ScaleManager;
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  time: Phaser.Time.Clock;

  // Managers
  handManager: HandManager;
  meldManager: MeldManager;
  playerIconManager: PlayerIconManager;
  dragDropManager: DragDropManager;
  aiManager: AIManager;

  // Game objects
  discardPileSprite: Phaser.GameObjects.Image | null;
  finishingCardSprite: Phaser.GameObjects.Image | null;

  // State
  isMyTurn: boolean;
  currentPhase: GamePhase;

  addRoundScore: (playerId: number | string, score: number) => void;
  setCurrentRound: (round: number) => void;
  //showRoundResults: (results: RoundResults) => void;
  showFinalResults: (results: FinalResults) => void;
  updateScoreDisplay?: () => void;
  getTotalScores: () => Map<number | string, number>; // ADD THIS LINE

  showUndoOption: (
    cardGO: CardGameObject,
    onUndo: () => void,
    onCancel: () => void
  ) => void;
  showFinishingCardUndoOption: (
    cardGO: CardGameObject,
    onUndo: () => void,
    onCancel: () => void
  ) => void;

  // Methods
  showMessage: (text: string, duration?: number) => void;
  updatePhaseUI: () => void;
  updateMeldUI: () => void;
  createDrawPile: () => void;
  createDiscardPile: () => void;
  createFinishingCardDisplay: () => void;

  // Setters for state
  setIsMyTurn: (value: boolean) => void;
  setCurrentPhase: (phase: GamePhase) => void;
}

export interface SinglePlayerConfig {
  numPlayers?: number;
  numRounds?: number; // ADD
  aiDifficulty?: AIDifficulty; // ADD (import AIDifficulty if needed)
  layout: {
    DRAW_PILE: { x: number; y: number };
    DISCARD_PILE: { x: number; y: number };
    FINISHING_CARD: { x: number; y: number };
  };
}

// =============================================================================
// SINGLE PLAYER HANDLER
// =============================================================================

/**
 * Handles all single-player game logic, events, and AI coordination.
 *
 * Responsibilities:
 * - Setting up game logic (Remi) and event listeners
 * - Handling all game events (card draws, melds, discards, etc.)
 * - Coordinating with AIManager for AI turns
 * - Managing undo/snapshot state
 * - Handling game over
 */
export class SinglePlayerHandler {
  private gameScene: GameSceneInterface;
  private config: SinglePlayerConfig;

  // Game logic
  private logic: Remi | null = null;

  // Undo state
  private undoEnabled: boolean = false;

  constructor(gameScene: GameSceneInterface, config: SinglePlayerConfig) {
    this.gameScene = gameScene;
    this.config = config;
  }

  private currentRound: number = 1;
  private totalRounds: number = 3;

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Initialize and start a new single-player game
   */
  setup(): void {
    console.log("🎮 Setting up single-player mode");

    // Initialize game logic
    this.logic = new Remi();

    const {width, height} = this.gameScene.scale;

    // Subscribe to events
    this.setupEventListeners();

    // Initialize AI via manager
    this.gameScene.aiManager.initialize();

    // Start game
    const numPlayers = this.config.numPlayers ?? 4; // Change default to 4 to match GameScene
    this.totalRounds = this.config.numRounds ?? 3; // Use from config
    this.logic.newGame(numPlayers);

    // Initialize meld storage
    this.gameScene.meldManager.initializeForPlayers(numPlayers);

    this.gameScene.setIsMyTurn(true);

    console.log("✅ Single-player game started");
  }

  /**
   * Get the game logic instance
   */
  getLogic(): Remi | null {
    return this.logic;
  }

  /**
   * Check if player has opened (laid melds)
   */
  hasPlayerOpened(playerIndex: number = 0): boolean {
    return this.logic?.hasPlayerOpened(playerIndex) ?? false;
  }

  /**
   * Get current meld score
   */
  // getCurrentScore(): number {
  //   return this.logic?.currentScore() ?? 0;
  // }

  /**
   * Get player melds data
   */
  getPlayerMelds(playerIndex: number): Card[][] {
    return this.logic?.getPlayerMelds(playerIndex) ?? [];
  }

  /**
   * Clean up handler
   */
  destroy(): void {
    if (this.logic) {
      // The Remi class doesn't have event listener cleanup, but we should null it
      this.logic = null;
    }
    this.undoEnabled = false;
    this.currentRound = 1;
  }

  // ===========================================================================
  // USER ACTIONS
  // ===========================================================================

  /**
   * Handle draw pile click
   */
  handleDrawPileClick(): boolean {
    if (!this.logic) return false;
    return this.logic.drawCard(0);
  }

  /**
   * Handle discard pile click (draw from discard)
   */
  handleDiscardPileClick(): boolean {
    if (!this.logic) return false;
    this.logic.saveGameStateSnapshot();
    this.undoEnabled = true;
    return this.logic.drawFromDiscard(0);
  }

  /**
   * Handle finishing card click
   */
  handleFinishingCardClick(): boolean {
    if (!this.logic) return false;

    if (this.logic.hasPlayerOpened(0)) {
      this.gameScene.showMessage(
        "You can't take the finishing card if you already have melds!"
      );
      return false;
    }

    this.logic.saveGameStateSnapshot();
    this.undoEnabled = true;
    return this.logic.takeFinishingCard(0);
  }

  /**
   * Handle discard drop
   */
  handleDiscard(card: Card, cardGO: CardGameObject): boolean {
    const { width, height } = this.gameScene.scale;
    if (!this.logic) return false;

    // Check 1: Drew from discard but didn't use the card
    if (this.logic.hasDrawnFromDiscard() && this.logic.getDiscardCard()) {
      const cardWasUsed = this.checkIfDiscardCardWasUsed();
      if (!cardWasUsed) {
        this.gameScene.showUndoOption(
          cardGO,
          () => this.executeUndo(),
          () =>
            this.gameScene.showMessage(
              "Moras ili odigrati uzetu kartu ili se vratiti na pocetak poteza!",
              10000
            )
        );
        return false; // Don't discard yet
      }
    }

    // Check 2: Drew finishing card but won't finish
    if (this.logic.hasDrawnFinishingCard()) {
      const handSize = this.gameScene.handManager.getHandCards().length;
      if (handSize > 1) {
        this.gameScene.showFinishingCardUndoOption(
          cardGO,
          () => this.executeFinishingCardUndo(),
          () =>
            this.gameScene.showMessage(
              "Moras ili zavrsiti igru ili se vratiti na pocetak poteza!",
              10000
            )
        );
        return false; // Don't discard yet
      }
    }
    const success = this.logic.discardCard(0, card);

    if (success) {
      // Remove from hand arrays (but don't destroy yet - we'll animate first)
      this.gameScene.handManager.removeCard(card);

      // Update hand display immediately to close the gap
      this.gameScene.handManager.updateHandDisplay();
      this.gameScene.handManager.updateHandDropZones();

      // Get the frame for the discarded card now (before any state changes)
      const cardFrame = this.gameScene.handManager.getCardFrame(card);

      // Animate the card to discard pile
      this.gameScene.tweens.add({
        targets: cardGO,
        x: width * this.config.layout.DISCARD_PILE.x,
        y: height * this.config.layout.DISCARD_PILE.y,
        duration: 150,
        ease: "Power2",
        onComplete: () => {
          // Show the discarded card on the pile
          if (this.gameScene.discardPileSprite) {
            this.gameScene.discardPileSprite
              .setFrame(cardFrame)
              .setVisible(true);
          }
          // Destroy the animated card
          this.gameScene.handManager.destroyCardSafely(cardGO);
        },
      });

      this.gameScene.playerIconManager.updateAll();
      this.undoEnabled = false;
      return true;
    }

    return false;
  }

  /**
   * Handle add card to meld
   */
  handleAddToMeld(card: Card, meldOwner: number, meldIndex: number): boolean {
    if (!this.logic) return false;
    return this.logic.addCardToMeld(0, card, meldOwner, meldIndex);
  }

  /**
   * Handle laying melds
   */
  handleLayMelds(selectedCards: Card[]): boolean {
    if (!this.logic) return false;

    const validation = this.logic.validateMelds(0, selectedCards);

    if (!validation.validMelds || validation.validMelds.length === 0) {
      this.gameScene.showMessage("Invalid melds");
      return false;
    }

    if (!this.logic.hasPlayerOpened(0) && validation.totalScore < 51) {
      this.gameScene.showMessage("Need at least 51 points to open");
      return false;
    }

    // Check must keep one card for discard
    const handSize = this.gameScene.handManager.getHandCards().length;
    if (handSize === selectedCards.length) {
      this.gameScene.showMessage("Must keep at least one card to discard");
      return false;
    }

    return this.logic.layDownMelds(0, validation.validMelds);
  }

  /**
   * Handle hand reorder
   */
  handleReorderHand(fromIndex: number, toIndex: number): void {
    this.logic?.reorderHand(0, fromIndex, toIndex);
  }

  /**
   * Execute undo (if available)
   */
  private executeUndo(): void {
    if (!this.logic || !this.logic.gameStateSnapshot) {
      console.error("No snapshot to restore!");
      return;
    }

    console.log("Executing undo...");

    // 1. Clear melds created this turn
    const initialMeldsCount = this.logic.gameStateSnapshot.melds.length;
    this.gameScene.meldManager.clearMeldsAfterIndex(0, initialMeldsCount);

    // 2. Restore logic state
    this.logic.restoreState(this.logic.gameStateSnapshot);

    // 3. Update discard pile visual
    this.updateDiscardPileVisual();

    // 4. Rebuild hand from restored state
    const restoredHand = this.logic.getPlayerHand(0);
    this.gameScene.handManager.setHand(restoredHand);

    // 5. Draw from deck instead (delayed)
    this.gameScene.time.delayedCall(300, () => {
      const success = this.logic?.drawCard(0);
      if (success) {
        this.gameScene.showMessage("Drew from deck instead");
        this.logic?.setHasDrawnFromDiscard();
        this.logic?.setDiscardCard();
        if (this.logic) this.logic.gameStateSnapshot = null;
      } else {
        console.error("Draw failed!");
      }
    });
  }

  private executeFinishingCardUndo(): void {
    if (!this.logic || !this.logic.gameStateSnapshot) {
      console.error("No snapshot to restore!");
      return;
    }

    // 1. Clear melds created this turn
    const initialMeldsCount = this.logic.gameStateSnapshot.melds.length;
    this.gameScene.meldManager.clearMeldsAfterIndex(0, initialMeldsCount);

    // 3. Restore logic state
    this.logic.restoreState(this.logic.gameStateSnapshot);

    // 2. Get the finishing card before restoring
    const finishingCardToRestore = this.logic.getFinishingCard();

    // 4. Rebuild hand from restored state
    const restoredHand = this.logic.getPlayerHand(0);
    this.gameScene.handManager.setHand(restoredHand);

    // 5. Restore finishing card visual
    if (finishingCardToRestore && this.gameScene.finishingCardSprite) {
      this.gameScene.finishingCardSprite.setVisible(true);
      this.logic.setFinishingCard(finishingCardToRestore);
    }

    // 6. Draw from deck instead
    this.gameScene.time.delayedCall(300, () => {
      this.logic?.drawCard(0);
      this.gameScene.showMessage("Drew from deck instead");
      this.logic?.setFinishingCardDrawn(false);
      if (this.logic) this.logic.gameStateSnapshot = null;
      this.undoEnabled = false;
    });
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoEnabled && this.logic?.gameStateSnapshot !== undefined;
  }

  // ===========================================================================
  // PRIVATE - EVENT SETUP
  // ===========================================================================

  private setupEventListeners(): void {
    if (!this.logic) return;

    this.logic.on(GameEventType.GAME_STARTED, (e: any) =>
      this.onGameStarted(e)
    );
    this.logic.on(GameEventType.CARD_DRAWN_FROM_DECK, (e: any) =>
      this.onCardDrawn(e)
    );
    this.logic.on(GameEventType.CARD_DRAWN_FROM_DISCARD, (e: any) =>
      this.onCardDrawnFromDiscard(e)
    );
    this.logic.on(GameEventType.FINISHING_CARD, (e: any) =>
      this.onFinishingCardDrawn(e)
    );
    this.logic.on(GameEventType.CARD_DISCARDED, (e: any) =>
      this.onCardDiscarded(e)
    );
    this.logic.on(GameEventType.MELDS_LAID_DOWN, (e: any) =>
      this.onMeldsLaidDown(e)
    );
    this.logic.on(GameEventType.CARD_ADDED_TO_MELD, (e: any) =>
      this.onCardAddedToMeld(e)
    );
    this.logic.on(GameEventType.PHASE_CHANGED, (e: any) =>
      this.onPhaseChanged(e)
    );
    this.logic.on(GameEventType.TURN_ENDED, (e: any) => this.onTurnEnded(e));
    this.logic.on(GameEventType.PLAYER_TURN_STARTED, (e: any) =>
      this.onPlayerTurnStarted(e)
    );
    this.logic.on(GameEventType.GAME_OVER, (e: any) => this.onGameOver(e));
  }

  // ===========================================================================
  // PRIVATE - EVENT HANDLERS
  // ===========================================================================

  private onGameStarted(event: any): void {
    const {width, height} = this.gameScene.scale;
    console.log("🎲 Game started event received");

    // Create game board elements
    this.gameScene.createDrawPile();
    this.gameScene.createDiscardPile();
    this.gameScene.createFinishingCardDisplay();

    // Create discard drop zone
    this.gameScene.dragDropManager.createDiscardDropZone({
      x: width * this.config.layout.DISCARD_PILE.x,
      y: height * this.config.layout.DISCARD_PILE.y,
    });

    // Create player icons
    this.gameScene.playerIconManager.createIcons();

    // Set initial hand
    const hand = this.logic!.getPlayerHand(0);
    this.gameScene.handManager.setHand(hand);

    // Show initial discard pile card (Remi starts with one card on discard pile)
    this.updateDiscardPileVisual();

    this.gameScene.updatePhaseUI();
    (this.gameScene as any).updateScoreDisplay?.();
  }

  private onCardDrawn(event: any): void {
    const {width, height} = this.gameScene.scale;
    if (event.playerIndex !== 0) return;

    const card = event.card as Card;
    this.gameScene.handManager.addCard(
      card,
      width * this.config.layout.DRAW_PILE.x,
      height * this.config.layout.DRAW_PILE.y
    );
    this.gameScene.playerIconManager.updateAll();

    this.gameScene.setCurrentPhase(GamePhase.MELD);
    this.gameScene.updatePhaseUI();
    this.gameScene.updateMeldUI();
  }

  private onCardDrawnFromDiscard(event: any): void {
        const {width, height} = this.gameScene.scale;

    if (event.playerIndex !== 0) return;

    const card = event.card as Card;
    this.gameScene.handManager.addCard(
      card,
      width * this.config.layout.DISCARD_PILE.x,
      height * this.config.layout.DISCARD_PILE.y
    );

    // Update discard pile visual after animation
    this.gameScene.time.delayedCall(HAND_LAYOUT.ANIMATION_DURATION, () => {
      this.updateDiscardPileVisual();
    });

    this.gameScene.setCurrentPhase(GamePhase.MELD);
    this.gameScene.updatePhaseUI();
    this.gameScene.updateMeldUI();
  }

  private onFinishingCardDrawn(event: any): void {
        const {width, height} = this.gameScene.scale;

    if (event.playerIndex !== 0) return;

    const card = event.card as Card;
    this.gameScene.handManager.addCard(
      card,
      width * this.config.layout.FINISHING_CARD.x,
      height * this.config.layout.FINISHING_CARD.y
    );

    // Hide finishing card sprite
    if (this.gameScene.finishingCardSprite) {
      this.gameScene.finishingCardSprite.setVisible(false);
    }

    this.gameScene.showMessage(
      "Drew finishing card - you must go all out this turn!"
    );
  }

  private onCardDiscarded(event: any): void {
    // For player 0, the visual is handled in handleDiscard's tween onComplete
    // For AI players, we need to update the visual here
    if (event.playerIndex !== 0) {
      this.updateDiscardPileVisual();
      this.gameScene.playerIconManager.updateCardCount(event.playerIndex);
      this.gameScene.playerIconManager.highlightCardCountChange(
        event.playerIndex,
        false
      );
    }
  }

  private onMeldsLaidDown(event: any): void {
    const { playerIndex, melds } = event;

    // Get existing meld count to calculate correct index
    const existingMeldsCount =
      this.gameScene.meldManager.getPlayerMelds(playerIndex).length;

    melds.forEach((meld: Card[], idx: number) => {
      const meldIndex = existingMeldsCount + idx; // Offset by existing melds
      this.gameScene.meldManager.createMeldVisual(playerIndex, meld, meldIndex);
    });

    // If human player, remove cards from hand
    if (playerIndex === 0) {
      const meldCardIds = new Set<string>(
        (melds as Card[][]).flat().map((c: Card) => c.id)
      );
      this.gameScene.handManager.removeCardsByIds(meldCardIds);
    }

    this.gameScene.updateMeldUI();
    this.gameScene.playerIconManager.updateMeldStatus(playerIndex, true);

    // Flash indicator for AI
    if (playerIndex !== 0) {
      this.gameScene.playerIconManager.flashMeldIndicator(playerIndex);
    }
  }

  private onCardAddedToMeld(event: any): void {
    const { playerIndex, card, meldOwner, meldIndex, replacedJoker } = event;

    const meld = this.gameScene.meldManager.getMeld(meldOwner, meldIndex);
    if (!meld) {
      console.error("Meld not found");
      return;
    }

    // 1. Get the meld data from logic layer
    const rawMeldData =
      this.logic?.getPlayerMelds(meldOwner)?.[meldIndex] ?? [];

    // 2. CLONE the data to avoid "frozen" state issues
    let sortedMeldData = [...rawMeldData];

    if (sortedMeldData.length > 0) {
      // Check if all cards have the same suit (indicating a Run)
      const nonJokers = sortedMeldData.filter(
        (c: Card) => !c.suit.includes("JOKER")
      );

      // Detect if it's a RUN (all non-jokers have the same suit)
      const isRun =
        nonJokers.length > 0 &&
        nonJokers.every((c: Card) => c.suit === nonJokers[0].suit);

      sortedMeldData.sort((a: Card, b: Card) => {
        // Handle Jokers: If comparing Joker vs Non-Joker, we need a strategy.
        // Strategy: Treat Joker as having a value that fits the sequence?
        // For simplicity in the View Layer: Sort non-jokers, then append/prepend jokers?
        // BETTER: Try to sort naturally, but if one is Joker, we handle it specially.

        const aIsJoker = a.suit.includes("JOKER");
        const bIsJoker = b.suit.includes("JOKER");

        // If both are Jokers, sort by suit/color
        if (aIsJoker && bIsJoker) return a.suit.localeCompare(b.suit);

        // If only one is Joker
        if (aIsJoker && !bIsJoker) return 1; // Push Jokers to end
        if (!aIsJoker && bIsJoker) return -1;

        // Normal Card Comparison
        if (isRun) {
          // RUN: Sort by Value (Ascending)
          return a.value - b.value;
        } else {
          // SET: Sort by Suit (Bridge Order), then Value
          const suitOrder: Record<string, number> = {
            CLUB: 0,
            DIAMOND: 1,
            HEART: 2,
            SPADE: 3,
          };

          const suitDiff =
            (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
          if (suitDiff !== 0) return suitDiff;

          return a.value - b.value;
        }
      });
    }

    if (playerIndex === 0) {
      // HUMAN adding a card
      const cardGO = this.gameScene.handManager.removeCard(card);
      if (!cardGO) {
        console.error("Card not found in hand:", card.id);
        return;
      }

      if (replacedJoker) {
        const result = this.gameScene.meldManager.handleJokerReplacement(
          meld,
          cardGO,
          card,
          replacedJoker,
          sortedMeldData // Pass sorted data
        );
        if (result) {
          this.gameScene.handManager.addCard(
            replacedJoker,
            result.jokerStartPosition.x,
            result.jokerStartPosition.y
          );
        }
      } else {
        this.gameScene.meldManager.addCardToMeldVisual(
          meld,
          cardGO,
          card,
          sortedMeldData
        );
      }

      this.gameScene.handManager.updateHandDisplay();
      this.gameScene.handManager.updateHandDropZones();

      if (this.gameScene.handManager.getHandCards().length === 0) {
        this.gameScene.time.delayedCall(500, () => {
          this.logic?.checkGameOver();
        });
      }
    } else {
      // AI adding a card
      if (meldOwner === 0) {
        // AI adding to MY meld
        const startPos = { x: 100 + playerIndex * 200, y: 100 };
        const cardSprite = this.gameScene.handManager.createCardSprite(
          card,
          startPos.x,
          startPos.y
        );

        if (replacedJoker) {
          const result = this.gameScene.meldManager.handleJokerReplacement(
            meld,
            cardSprite,
            card,
            replacedJoker,
            sortedMeldData
          );
          this.gameScene.showMessage(`AI replaced your Joker!`);
        } else {
          this.gameScene.meldManager.addCardToMeldVisual(
            meld,
            cardSprite,
            card,
            sortedMeldData
          );
          this.gameScene.showMessage(`AI added card to your meld!`);
        }
      } else {
        const startPos = { x: 100 + playerIndex * 200, y: 100 };
        const cardSprite = this.gameScene.handManager.createCardSprite(
          card,
          startPos.x,
          startPos.y
        );

        // 2. Add to visual manager
        this.gameScene.meldManager.addCardToMeldVisual(
          meld,
          cardSprite,
          card,
          sortedMeldData
        );

        // 3. Handle Visibility: Hide if we aren't currently viewing this opponent
        const isThisPlayerDisplayed =
          this.gameScene.meldManager.getDisplayedOpponentIndex() ===
          playerIndex;

        if (!isThisPlayerDisplayed) {
          cardSprite.setVisible(false);
        }
      }

      this.gameScene.playerIconManager.updateCardCount(playerIndex);
    }

    this.gameScene.meldManager.refreshMeldViewIfOpen((pi) =>
      this.getPlayerMelds(pi)
    );
  }

  private onPhaseChanged(event: any): void {
    this.gameScene.setCurrentPhase(event.newPhase);
    this.gameScene.updatePhaseUI();
    this.gameScene.updateMeldUI();

    // Highlight discard zone when appropriate
    const shouldHighlight =
      this.gameScene.isMyTurn &&
      (event.newPhase === GamePhase.DISCARD ||
        event.newPhase === GamePhase.MELD);
    this.gameScene.dragDropManager.setDiscardHighlight(shouldHighlight);
  }

  private onTurnEnded(event: any): void {
    // Turn ended - reset undo state
    this.undoEnabled = false;
  }

  private onPlayerTurnStarted(event: any): void {
    const { playerIndex } = event;

    this.gameScene.setIsMyTurn(playerIndex === 0);
    this.gameScene.updatePhaseUI();
    this.gameScene.playerIconManager.setCurrentPlayer(playerIndex);

    if (playerIndex !== 0) {
      // AI turn
      this.gameScene.playerIconManager.pulseIcon(playerIndex);
      this.gameScene.time.delayedCall(500, () => {
        this.gameScene.aiManager.runTurn();
      });
    }
  }

  private onGameOver(event: any): void {
    const { winner } = event;
    const numPlayers = this.logic?.getState().numPlayers || 3;
    const roundScores: number[] = [];

    // Cancel any pending AI turns to prevent updates to destroyed UI
    this.gameScene.aiManager.cancelTurn();

    for (let i = 0; i < numPlayers; i++) {
      let score: number;
      if (i === winner) {
        // WINNER: Reduce total by 40 (negative points)
        score = -40;
      } else {
        // LOSERS: Calculate penalty for cards in hand
        score = this.calculateHandPenalty(i);
      }
      roundScores.push(score);

      // Update GameScene with round scores
      this.gameScene.addRoundScore(i, score);
    }

    // Update the handler's round tracking
    this.currentRound++;

    if (this.currentRound <= this.totalRounds) {
      // Show message about next round
      this.gameScene.showMessage(
        `Round ${this.currentRound - 1} complete! ${
          winner === 0 ? "You won!" : `Player ${winner + 1} won!`
        }`,
        2500
      );

      // Wait a moment, then start next round
      this.gameScene.time.delayedCall(3000, () => {
        console.log(
          `🎮 Starting round ${this.currentRound} of ${this.totalRounds}`
        );
        this.gameScene.setCurrentRound(this.currentRound);

        // Reset logic for new round - ONLY called here after delay!
        this.resetForNewRound();
      });
    } else {
      // Game is completely over - show final results
      this.gameScene.showMessage("Game Over!", 3000);

      const finalResults = {
        winner,
        totalScores: this.gameScene.getTotalScores(),
      };
      (this.gameScene as any).showFinalResults?.(finalResults);
    }
  }

  private resetForNewRound(): void {
    // Clear current state
    if (this.logic) {
      // Cancel any pending AI turns first
      this.gameScene.aiManager.cancelTurn();

      // Reinitialize game logic for new round
      const numPlayers = this.config.numPlayers ?? 4;
      this.logic.newGame(numPlayers);

      // Reinitialize AI manager with correct player count
      this.gameScene.aiManager.initializeForPlayers(numPlayers, 0);

      // Reset visual managers
      this.gameScene.meldManager.clearAllMelds();
      this.gameScene.handManager.clearHand();

      // Reset turn indicators
      this.gameScene.setIsMyTurn(true);
      this.gameScene.setCurrentPhase(GamePhase.DRAW);

      // Recreate game elements
      this.gameScene.createDrawPile();
      this.gameScene.createDiscardPile();
      this.gameScene.createFinishingCardDisplay();

      // Set initial hand
      const hand = this.logic.getPlayerHand(0);
      this.gameScene.handManager.setHand(hand);
      this.gameScene.meldManager.clearAllMelds();

      this.gameScene.updatePhaseUI();
      this.gameScene.updateMeldUI();
    }
  }

  /**
   * Calculates the total penalty value of cards remaining in a player's hand.
   * This is called at the end of a round.
   */
  public calculateHandPenalty(playerIndex: number): number {
    if (!this.logic) return 0;

    // 1. Get cards left in HAND, not melds
    const hand = this.logic.getPlayerHand(playerIndex);

    if (!this.logic.hasPlayerOpened(playerIndex)) return 100;

    return hand.reduce((total, card) => {
      // 2. Jokers (usually 25 pts)
      if (card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK") {
        return total + 25;
      }
      if (card.value === 1) return total + 10;
      // 3. High Cards (Aces are usually 15, Face cards are 10)
      if ([13, 12, 11].includes(card.value)) return total + 10;

      // 4. Number Cards (2-10)
      // We parse the 'value', not the 'suit'
      return total + card.value;
    }, 0);
  }

  // ===========================================================================
  // PRIVATE - HELPERS
  // ===========================================================================

  private updateDiscardPileVisual(): void {
    if (!this.logic || !this.gameScene.discardPileSprite) {
      console.log("⚠️ updateDiscardPileVisual: missing logic or sprite");
      return;
    }

    const topCard = this.logic.getState().topDiscardCard;

    if (topCard) {
      const frame = this.gameScene.handManager.getCardFrame(topCard);
      this.gameScene.discardPileSprite.setFrame(frame).setVisible(true);
    } else {
      this.gameScene.discardPileSprite.setVisible(false);
    }
  }
  validateSelection(selectedCards: Card[]): {
    score: number;
    isValid: boolean;
    meetsOpenRequirement: boolean;
  } {
    if (!this.logic || selectedCards.length < 3) {
      return { score: 0, isValid: false, meetsOpenRequirement: false };
    }

    const result = this.logic.validateMelds(0, selectedCards);
    return {
      score: result.totalScore,
      isValid: result.validMelds.length > 0 && result.invalidCards.length === 0,
      meetsOpenRequirement: result.meetsOpenRequirement,
    };
  }
  private checkIfDiscardCardWasUsed(): boolean {
    if (!this.logic) return true;

    const drawnCard = this.logic.getDiscardCard();
    if (!drawnCard) return true;

    const numPlayers = this.logic.getState().numPlayers;

    for (let i = 0; i < numPlayers; i++) {
      const melds = this.logic.getPlayerMelds(i);
      const cardFound = melds.some((meld) => meld.some((c) => c.id === drawnCard.id));
      if (cardFound) {
        return true;
      }
    }

    return false;
  }
}
