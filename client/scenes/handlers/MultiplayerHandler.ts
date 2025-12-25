import * as Phaser from "phaser";
import { Card } from "../../lib/card";
import { GamePhase } from "../../lib/game-event";
import { NetworkManager } from "../../lib/network-manager";
import { StateSync, StateChangeTracker } from "../../managers/state-sync";
import { UIHelpers } from "../../lib/ui-helpers";
import { SCENE_KEYS, COLORS } from "../common";
import { MeldValidator, MoveValidator } from "../../../shared";
import {
  SocketEvent,
  GameStateUpdate,
  CardData,
  RoundStartedData,
  RoundEndedData,
} from "../../../shared/types/socket-events";

import {
  HandManager,
  MeldManager,
  PlayerIconManager,
  DragDropManager,
  CardGameObject,
} from "../managers";

// =============================================================================
// TYPES
// =============================================================================

export interface MultiplayerSceneInterface {
  scale: Phaser.Scale.ScaleManager;
  add: Phaser.GameObjects.GameObjectFactory;
  tweens: Phaser.Tweens.TweenManager;
  time: Phaser.Time.Clock;

  handManager: HandManager;
  meldManager: MeldManager;
  playerIconManager: PlayerIconManager;
  dragDropManager: DragDropManager;

  discardPileSprite: Phaser.GameObjects.Image | null;
  finishingCardSprite: Phaser.GameObjects.Image | null;

  isMyTurn: boolean;
  currentPhase: GamePhase;

  addRoundScore: (playerId: string, score: number) => void;
  setCurrentRound: (round: number) => void;
  showRoundResults?: (results: any) => void;
  getTotalScores: () => Map<string | number, number>;
  showFinalResults?: (results: any) => void;

  showMessage: (text: string, duration?: number) => void;
  updatePhaseUI: () => void;
  updateMeldUI: () => void;
  createDrawPile: () => void;
  createDiscardPile: () => void;
  createFinishingCardFromServer: (card: CardData) => void;
  createFinishingCardDisplay?: () => void; // NEW: Optional method for creating finishing card

  setIsMyTurn: (value: boolean) => void;
  setCurrentPhase: (phase: GamePhase) => void;
}

export interface MultiplayerConfig {
  networkManager: NetworkManager;
  myPlayerId: string;
  roomId?: string;
  layout: {
    DRAW_PILE: { x: number; y: number };
    DISCARD_PILE: { x: number; y: number };
    FINISHING_CARD: { x: number; y: number }; // ADDED: Finishing card position
  };
}

// =============================================================================
// MULTIPLAYER HANDLER
// =============================================================================

export class MultiplayerHandler {
  private gameScene: MultiplayerSceneInterface;
  private config: MultiplayerConfig;

  private networkManager: NetworkManager;
  private myPlayerId: string;

  private currentServerState: GameStateUpdate | null = null;
  private stateChangeTracker: StateChangeTracker = new StateChangeTracker();
  private boardCreated: boolean = false;
  private lastDrawnFromDiscardId: string | null = null;
  private tookFinishingCard: boolean = false;

  // Undo/guard tracking
  private drewFromDiscardId: string | null = null;
  private drawnCardUsedInMeld: boolean = false;

  private previousHandIds: Set<string> = new Set();

  private currentRound: number = 1;
  private totalRounds: number = 10;

  constructor(gameScene: MultiplayerSceneInterface, config: MultiplayerConfig) {
    this.gameScene = gameScene;
    this.config = config;
    this.networkManager = config.networkManager;
    this.myPlayerId = config.myPlayerId;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  setup(): void {
    console.log("🌐 Setting up multiplayer mode");
    this.setupEventListeners();

    const cachedState = this.networkManager.getLastGameState();
    if (cachedState) {
      console.log("📊 Processing cached game state");
      this.handleGameStateUpdate(cachedState);
    } else {
      console.log("⏳ Waiting for game state from server...");
    }

    console.log("✅ Multiplayer listeners registered");
  }

  getServerState(): GameStateUpdate | null {
    return this.currentServerState;
  }

  getMyPlayerId(): string {
    return this.myPlayerId;
  }

  getMyPlayerIndex(): number {
    if (!this.currentServerState) return 0;
    return this.currentServerState.players.findIndex(
      (p) => p.id === this.myPlayerId
    );
  }

  hasPlayerOpened(playerIndex: number): boolean {
    return this.currentServerState?.players[playerIndex]?.hasOpened ?? false;
  }

  getPlayerMelds(playerIndex: number): CardData[][] {
    return this.currentServerState?.players[playerIndex]?.melds ?? [];
  }

  destroy(): void {
    this.networkManager.removeAllListeners();
    this.currentServerState = null;
  }

  // ===========================================================================
  // USER ACTIONS
  // ===========================================================================

  handleDrawPileClick(): void {
    this.networkManager.drawCard();
    this.drewFromDiscardId = null;
    this.tookFinishingCard = false;
    this.drawnCardUsedInMeld = false;
  }

  handleDiscardPileClick(): void {
    if (this.currentServerState?.discardPileTop) {
      this.drewFromDiscardId = this.currentServerState.discardPileTop.id;
      this.drawnCardUsedInMeld = false;
    }
    this.tookFinishingCard = false;
    this.networkManager.drawFromDiscard();
  }

  handleFinishingCardClick(): void {
    // IMPROVED: Check if player has opened (same as single-player)
    const myIndex = this.getMyPlayerIndex();
    if (this.hasPlayerOpened(myIndex)) {
      this.gameScene.showMessage(
        "You can't take the finishing card if you already have melds!"
      );
      return;
    }

    this.tookFinishingCard = true;
    this.drewFromDiscardId = null;
    this.drawnCardUsedInMeld = false;
    this.networkManager.takeFinishingCard();
  }

  handleDiscard(card: Card, cardGO: CardGameObject): boolean {
    const cardId = (card as any).serverId;

    if (!cardId) {
      console.error("Card missing serverId:", card);
      return false;
    }

    // Guard 1: Drew from discard but didn't use the card
    if (this.drewFromDiscardId && !this.drawnCardUsedInMeld) {
      if (cardId === this.drewFromDiscardId) {
        this.gameScene.showMessage("Cannot discard the card you just drew!");
        this.snapBackCard(cardGO);
        return false;
      }

      const drawnCardStillInHand = this.gameScene.handManager
        .getHandCards()
        .some((c) => (c as any).serverId === this.drewFromDiscardId);

      if (drawnCardStillInHand) {
        this.showDiscardDrawUndoOption(cardGO);
        return false;
      }
    }

    // Guard 2: Took finishing card but can't go out
    if (this.tookFinishingCard) {
      const handSize = this.gameScene.handManager.getHandCards().length;
      if (handSize > 1) {
        this.showFinishingCardUndoOption(cardGO);
        return false;
      }
    }

    // Validate locally
    const canDiscard = MoveValidator.canDiscard(
      this.myPlayerId,
      cardId,
      this.currentServerState!
    );

    if (!canDiscard.valid) {
      this.gameScene.showMessage(canDiscard.error || "Cannot discard");
      this.snapBackCard(cardGO);
      return false;
    }

    // Optimistic update
    this.gameScene.handManager.removeCard(card);
    this.gameScene.handManager.updateHandDisplay();
    this.gameScene.handManager.updateHandDropZones();

    // Animate and send to server
    this.gameScene.tweens.add({
      targets: cardGO,
      x: this.config.layout.DISCARD_PILE.x,
      y: this.config.layout.DISCARD_PILE.y,
      duration: 200,
      ease: "Power2",
      onComplete: () => {
        this.networkManager.discardCard(cardId);
        this.gameScene.handManager.destroyCardSafely(cardGO);

        if (this.gameScene.discardPileSprite) {
          const frame = this.gameScene.handManager.getCardFrame(card as any);
          this.gameScene.discardPileSprite.setFrame(frame).setVisible(true);
        }

        this.resetDrawTracking();
      },
    });

    return true;
  }

  /**
   * IMPROVED: Handle add card to meld with joker replacement support
   */
  handleAddToMeld(
    card: Card,
    cardGO: CardGameObject,
    meldOwner: string,
    meldIndex: number
  ): boolean {
    const cardId = (card as any).serverId;

    if (!cardId) {
      console.error("Card missing serverId");
      return false;
    }

    // Check if this is the drawn card being used
    if (this.drewFromDiscardId && cardId === this.drewFromDiscardId) {
      this.drawnCardUsedInMeld = true;
    }

    // Validate locally first
    const canAdd = MoveValidator.canAddToMeld(
      this.myPlayerId,
      cardId,
      meldOwner,
      meldIndex,
      this.currentServerState!
    );

    if (!canAdd.valid) {
      this.gameScene.showMessage(canAdd.error || "Cannot add to meld");
      return false;
    }

    // Find the meld owner's player index
    const meldOwnerIndex = this.currentServerState!.players.findIndex(
      (p) => p.id === meldOwner
    );

    // Get the meld visual
    const meld = this.gameScene.meldManager.getMeld(meldOwnerIndex, meldIndex);

    if (!meld) {
      console.error("Meld not found");
      return false;
    }

    // IMPROVED: Get meld data and check for joker replacement
    const meldData =
      this.currentServerState!.players[meldOwnerIndex]?.melds[meldIndex];

    if (meldData) {
      const cardData: CardData = {
        id: cardId,
        suit: card.suit as any,
        value: card.value,
        isFaceUp: true,
      };

      const jokerInMeld = meldData.find(
        (c) => c.suit === "JOKER_RED" || c.suit === "JOKER_BLACK"
      );

      if (
        jokerInMeld &&
        MeldValidator.canCardReplaceJoker(cardData, jokerInMeld, meldData)
      ) {
        console.log(
          "🃏 This card will replace a joker - awaiting server confirmation"
        );
        // The server will handle the replacement and send updated state
        // The joker will appear in our hand via handleJokerReplacementFromServer
      }

      // Sort meld data for proper visual display
      const sortedMeldData = this.sortMeldData(meldData);

      // Remove card from hand
      this.gameScene.handManager.removeCard(card);
      this.gameScene.handManager.updateHandDisplay();
      this.gameScene.handManager.updateHandDropZones();

      // Add card to meld visually with sorted data
      this.gameScene.meldManager.addCardToMeldVisual(
        meld,
        cardGO,
        card,
        sortedMeldData
      );
    } else {
      // Fallback without sorting
      this.gameScene.handManager.removeCard(card);
      this.gameScene.handManager.updateHandDisplay();
      this.gameScene.handManager.updateHandDropZones();
      this.gameScene.meldManager.addCardToMeldVisual(meld, cardGO, card);
    }

    // Send to server
    this.networkManager.addCardToMeld(cardId, meldOwner, meldIndex);
    return true;
  }

  /**
   * IMPROVED: Handle laying melds with proper validation and splitting
   */
  handleLayMelds(selectedCards: Card[]): boolean {
    // Use improved validation that splits into meld groups
    const validation = this.validateSelection(selectedCards);

    if (!validation.isValid) {
      if (validation.invalidCards.length > 0) {
        this.gameScene.showMessage("Some cards cannot form valid melds");
      } else {
        this.gameScene.showMessage("Invalid melds");
      }
      return false;
    }

    if (!validation.meetsOpenRequirement) {
      this.gameScene.showMessage(
        `Need 51 points to open (have ${validation.score})`
      );
      return false;
    }

    // Check must keep one card for discard
    const handSize = this.gameScene.handManager.getHandCards().length;
    if (handSize === selectedCards.length) {
      this.gameScene.showMessage("Must keep at least one card to discard");
      return false;
    }

    // Track if drawn card is being used
    if (this.drewFromDiscardId) {
      const drawnCardUsed = selectedCards.some(
        (c) => (c as any).serverId === this.drewFromDiscardId
      );
      if (drawnCardUsed) {
        this.drawnCardUsedInMeld = true;
      }
    }

    // IMPROVED: Convert valid melds to card ID arrays (properly split)
    const meldIds = validation.validMelds.map((meld) =>
      meld.map((card) => (card as any).serverId || card.id)
    );

    this.networkManager.layMelds(meldIds);
    return true;
  }

  handleReorderHand(fromIndex: number, toIndex: number): void {
    this.gameScene.handManager.reorderCard(fromIndex, toIndex);
    this.networkManager.reorderHand(fromIndex, toIndex);
  }

  handleSkipMeld(): void {
    if (!this.gameScene.isMyTurn) {
      this.gameScene.showMessage("Not your turn");
      return;
    }

    if (this.currentServerState?.phase !== "MELD") {
      this.gameScene.showMessage("Can only skip during meld phase");
      return;
    }

    this.networkManager.skipMeld();
  }

  leaveRoom(): void {
    this.networkManager.leaveRoom();
  }

  disconnect(): void {
    this.networkManager.disconnect();
  }

  // ===========================================================================
  // IMPROVED VALIDATION
  // ===========================================================================

  /**
   * IMPROVED: Validate selection with proper meld splitting
   * Now matches single-player functionality
   */
  validateSelection(selectedCards: Card[]): {
    score: number;
    isValid: boolean;
    meetsOpenRequirement: boolean;
    validMelds: Card[][];
    invalidCards: Card[];
  } {
    if (selectedCards.length < 3) {
      return {
        score: 0,
        isValid: false,
        meetsOpenRequirement: false,
        validMelds: [],
        invalidCards: selectedCards,
      };
    }

    // Convert to CardData format for validator
    const cardData: CardData[] = selectedCards.map((card) => ({
      id: (card as any).serverId || card.id,
      suit: card.suit as any,
      value: card.value,
      isFaceUp: card.isFaceUp,
    }));

    // IMPROVED: Use splitIntoMeldGroups to find ALL valid melds
    const validMeldGroups = MeldValidator.splitIntoMeldGroups(cardData);

    // Find cards that aren't in any valid meld
    const cardsInMelds = new Set(validMeldGroups.flat().map((c) => c.id));
    const invalidCardData = cardData.filter((c) => !cardsInMelds.has(c.id));

    // Map back to original Card objects
    const validMelds = validMeldGroups
      .map((meldGroup) =>
        meldGroup
          .map(
            (cd) =>
              selectedCards.find(
                (c) => ((c as any).serverId || c.id) === cd.id
              )!
          )
          .filter(Boolean)
      )
      .filter((meld) => meld.length >= 3);

    const invalidCards = invalidCardData
      .map(
        (cd) =>
          selectedCards.find((c) => ((c as any).serverId || c.id) === cd.id)!
      )
      .filter(Boolean);

    // Calculate total score
    const score = validMeldGroups.reduce(
      (sum, meld) => sum + MeldValidator.calculateMeldScore(meld),
      0
    );

    // Check validity and opening requirement
    const hasOpened = this.hasPlayerOpened(this.getMyPlayerIndex());
    const isValid = validMelds.length > 0 && invalidCards.length === 0;
    const meetsOpenRequirement = hasOpened || score >= 51;

    return {
      score,
      isValid,
      meetsOpenRequirement,
      validMelds,
      invalidCards,
    };
  }

  // ===========================================================================
  // PRIVATE - EVENT SETUP
  // ===========================================================================

  private setupEventListeners(): void {
    this.networkManager.on(
      SocketEvent.GAME_STATE_UPDATE,
      (state: GameStateUpdate) => {
        this.handleGameStateUpdate(state);
      }
    );

    this.networkManager.on(SocketEvent.GAME_OVER, (result: any) => {
      this.handleGameOver(result);
    });

    this.networkManager.on(SocketEvent.ERROR, (error: any) => {
      this.handleError(error);
    });

    this.networkManager.on(SocketEvent.PLAYER_LEFT, (data: any) => {
      this.handlePlayerLeft(data);
    });

    this.networkManager.on(SocketEvent.PLAYER_RECONNECTED, (data: any) => {
      this.handlePlayerReconnected(data);
    });

    this.networkManager.on(
      SocketEvent.UNDO_CONFIRMED,
      (data: { type: string }) => {
        if (data.type === "FINISHING_CARD") {
          this.gameScene.showMessage(
            "Undo successful - drew from deck instead"
          );
          if (
            this.currentServerState?.finishingCard &&
            this.gameScene.finishingCardSprite
          ) {
            this.gameScene.finishingCardSprite.setVisible(true);
          }
        } else if (data.type === "DRAW_FROM_DISCARD") {
          this.gameScene.showMessage(
            "Undo successful - drew from deck instead"
          );
        }
      }
    );

    this.networkManager.on(
      SocketEvent.ROUND_STARTED,
      (data: RoundStartedData) => {
        this.handleRoundStarted(data);
      }
    );

    this.networkManager.on(SocketEvent.ROUND_ENDED, (data: RoundEndedData) => {
      this.handleRoundEnded(data);
    });

    // IMPROVED: Listen for card added to meld events
    this.networkManager.on(SocketEvent.CARD_ADDED_TO_MELD, (data: any) => {
      this.handleCardAddedToMeldEvent(data);
    });
  }

  // ===========================================================================
  // PRIVATE - STATE HANDLING
  // ===========================================================================

  private handleGameStateUpdate(state: GameStateUpdate): void {
    const previousState = this.currentServerState;
    this.currentServerState = state;

    const changes = this.stateChangeTracker.detectChanges(state);
    console.log("📨 State update received, changes:", changes);

    if (!this.boardCreated) {
      this.createGameBoard();
      this.boardCreated = true;
    }

    this.gameScene.playerIconManager.updateAll();

    if (changes.handChanged && state.myHand) {
      this.updateHand(state.myHand);
    }

    if (changes.meldsChanged) {
      this.updateMelds(state);
      this.handleJokerReplacementFromServer(state, previousState);
    }

    this.checkForNewlyOpenedPlayers(state, previousState);

    if (changes.discardChanged && state.discardPileTop) {
      this.updateDiscardPile(state.discardPileTop);
    }

    if (state.finishingCard) {
      if (this.gameScene.finishingCardSprite) {
        // FIX: If sprite exists, just update its frame to the new card
        const frame = this.gameScene.handManager.getCardFrame(
          state.finishingCard as any
        );
        this.gameScene.finishingCardSprite.setFrame(frame).setVisible(true);
      } else {
        // If sprite doesn't exist, create it
        this.gameScene.createFinishingCardFromServer(state.finishingCard);
      }
    }

    this.gameScene.setIsMyTurn(StateSync.isMyTurn(state, this.myPlayerId));
    this.gameScene.setCurrentPhase(state.phase as GamePhase);

    this.gameScene.updatePhaseUI();

    this.gameScene.meldManager.refreshMeldViewIfOpen((pi) =>
      this.getPlayerMelds(pi)
    );

    if (changes.turnChanged) {
      const currentPlayerIndex = state.players.findIndex(
        (p) => p.id === state.currentPlayerId
      );
      this.gameScene.playerIconManager.setCurrentPlayer(currentPlayerIndex);

      if (currentPlayerIndex !== this.getMyPlayerIndex()) {
        this.gameScene.playerIconManager.pulseIcon(currentPlayerIndex);
      }
      this.lastDrawnFromDiscardId = null;
      this.tookFinishingCard = false;

      const shouldHighlight = this.gameScene.isMyTurn && state.phase !== "DRAW";
      this.gameScene.dragDropManager.setDiscardHighlight(shouldHighlight);
    }

    // Track card count changes for other players
    if (previousState) {
      state.players.forEach((player, index) => {
        if (player.id === this.myPlayerId) return;

        const prevPlayer = previousState.players.find(
          (p) => p.id === player.id
        );
        if (prevPlayer && prevPlayer.handSize !== player.handSize) {
          const increased = player.handSize > prevPlayer.handSize;
          this.gameScene.playerIconManager.highlightCardCountChange(
            index,
            increased
          );
        }
      });
    }
  }

  private handleRoundStarted(data: RoundStartedData): void {
    this.currentRound = data.round;
    this.totalRounds = data.totalRounds;

    if (typeof this.gameScene.setCurrentRound === "function") {
      this.gameScene.setCurrentRound(this.currentRound);
    }
    this.gameScene.showMessage(`Round ${this.currentRound} started!`, 2000);

    // Reset local state for new round
    this.boardCreated = false;
    this.lastDrawnFromDiscardId = null;
    this.tookFinishingCard = false;
    this.previousHandIds = new Set();
    this.resetDrawTracking();
  }

  private handleRoundEnded(data: RoundEndedData): void {
    const { round, winner, roundScores, cumulativeScores } = data;

    this.currentRound = round;

    if (typeof this.gameScene.addRoundScore === "function") {
      roundScores.forEach(({ playerId, score }) => {
        this.gameScene.addRoundScore(playerId, score);
      });
    }

    if (typeof this.gameScene.showRoundResults === "function") {
      this.gameScene.showRoundResults?.({
        round,
        winner: winner.id,
        scores: roundScores,
        cumulativeScores,
      });
    } else {
      const isWinner = winner.id === this.myPlayerId;
      this.gameScene.showMessage(
        `${winner.name} won round ${round}! ${isWinner ? "🎉" : "😔"}`,
        3000
      );
    }
  }

  private createGameBoard(): void {
    this.gameScene.createDrawPile();
    this.gameScene.createDiscardPile();
    this.previousHandIds = new Set();

    this.gameScene.dragDropManager.createDiscardDropZone({
      x: this.config.layout.DISCARD_PILE.x,
      y: this.config.layout.DISCARD_PILE.y,
    });

    this.gameScene.playerIconManager.createIcons();
  }

  private updateHand(serverCards: CardData[]): void {
    const currentHandIds = new Set(serverCards.map((c) => c.id));

    const newCards = serverCards.filter((c) => !this.previousHandIds.has(c.id));
    const removedIds = [...this.previousHandIds].filter(
      (id) => !currentHandIds.has(id)
    );

    if (
      this.previousHandIds.size === 0 ||
      removedIds.length > 1 ||
      newCards.length > 3
    ) {
      const newHand = StateSync.serverCardsToClient(serverCards);
      this.gameScene.handManager.setHand(newHand);
    } else {
      for (const removedId of removedIds) {
        const card = this.gameScene.handManager
          .getHandCards()
          .find((c) => (c as any).serverId === removedId || c.id === removedId);
        if (card) {
          this.gameScene.handManager.removeCard(card);
        }
      }

      for (const serverCard of newCards) {
        const clientCard = StateSync.serverCardToClient(serverCard);

        let sourceX = this.config.layout.DRAW_PILE.x;
        let sourceY = this.config.layout.DRAW_PILE.y;

        // Check if this is a joker (might be from replacement)
        const isJoker =
          serverCard.suit === "JOKER_RED" || serverCard.suit === "JOKER_BLACK";
        if (isJoker) {
          // Joker replacements come from meld area
          sourceX = this.gameScene.scale.width / 2;
          sourceY = this.gameScene.scale.height / 2 - 100;
        }

        this.gameScene.handManager.addCard(clientCard, sourceX, sourceY);
      }

      this.gameScene.handManager.updateHandDisplay();
    }

    this.previousHandIds = currentHandIds;
  }

  private updateMelds(state: GameStateUpdate): void {
    this.gameScene.meldManager.updateFromServerState(
      state.players,
      this.myPlayerId,
      (cards) => StateSync.serverCardsToClient(cards)
    );
  }

  private updateDiscardPile(topCard: CardData): void {
    if (this.gameScene.discardPileSprite) {
      const frame = this.gameScene.handManager.getCardFrame(topCard as any);
      this.gameScene.discardPileSprite.setFrame(frame).setVisible(true);
    }
  }

  private checkForNewlyOpenedPlayers(
    state: GameStateUpdate,
    previousState: GameStateUpdate | null
  ): void {
    state.players.forEach((player, index) => {
      if (player.id === this.myPlayerId) return;

      const previousPlayer = previousState?.players.find(
        (p) => p.id === player.id
      );
      const justOpened = player.hasOpened && !previousPlayer?.hasOpened;

      if (justOpened) {
        this.gameScene.meldManager.showOpponentMelds(index, player.melds);
        this.gameScene.playerIconManager.flashMeldIndicator(index);
      }
    });
  }

  // ===========================================================================
  // IMPROVED - JOKER REPLACEMENT HANDLING
  // ===========================================================================

  /**
   * IMPROVED: Handle joker replacement when server state shows joker in hand
   */
  private handleJokerReplacementFromServer(
    state: GameStateUpdate,
    previousState: GameStateUpdate | null
  ): void {
    if (!previousState) return;

    const myCurrentHand = state.myHand || [];
    const myPreviousHand = previousState.myHand || [];

    // Check if a joker appeared in hand that wasn't there before
    const newJokers = myCurrentHand.filter((card) => {
      const isJoker = card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
      const wasInPreviousHand = myPreviousHand.some((c) => c.id === card.id);
      return isJoker && !wasInPreviousHand;
    });

    if (newJokers.length > 0) {
      this.gameScene.showMessage("🃏 Joker replaced and added to your hand!");
      // The joker will be added via the normal hand update flow with special animation
    }
  }

  /**
   * Handle CARD_ADDED_TO_MELD socket event
   */
  private handleCardAddedToMeldEvent(data: {
    playerId: string;
    cardId: string;
    meldOwner: string;
    meldIndex: number;
    replacedJoker?: CardData;
  }): void {
    const { playerId, meldOwner, meldIndex, replacedJoker } = data;

    const meldOwnerIndex = this.currentServerState!.players.findIndex(
      (p) => p.id === meldOwner
    );

    // If another player added to a meld, update visuals
    if (playerId !== this.myPlayerId) {
      const playerName =
        this.currentServerState?.players.find((p) => p.id === playerId)?.name ||
        "Player";

      if (replacedJoker) {
        this.gameScene.showMessage(`${playerName} replaced a joker!`);
      }

      // Refresh meld view if open
      this.gameScene.meldManager.refreshMeldViewIfOpen((pi) =>
        this.getPlayerMelds(pi)
      );
    }

    this.gameScene.playerIconManager.updateAll();
  }

  // ===========================================================================
  // PRIVATE - EVENT HANDLERS
  // ===========================================================================

  private handleGameOver(result: any): void {
    const finalResults = {
      winner: result.winner,
      totalScores: result.finalScores || [],
      roundResults: result.roundResults || [],
    };

    if (typeof this.gameScene.showFinalResults === "function") {
      this.gameScene.showFinalResults?.(finalResults);
    } else {
      const isWinner = result.winner.id === this.myPlayerId;
      const message = isWinner
        ? `🏆 You won the game! Final score: ${result.winner.score}`
        : `🏆 ${result.winner.name} won the game!`;

      this.gameScene.showMessage(message, 5000);
    }
  }

  private handleError(error: any): void {
    console.error("❌ Network error:", error);
    UIHelpers.showToast(
      this.gameScene as unknown as Phaser.Scene,
      error.message || "Network error",
      3000,
      COLORS.ERROR
    );
  }

  private handlePlayerLeft(data: any): void {
    const playerName = data.playerName || "A player";
    const disconnected = data.disconnected || false;

    if (disconnected) {
      this.gameScene.showMessage(
        `${playerName} disconnected - waiting for reconnection...`
      );

      const playerIndex = this.currentServerState?.players.findIndex(
        (p) => p.name === playerName
      );
      if (playerIndex !== undefined && playerIndex >= 0) {
        this.gameScene.playerIconManager.setPlayerDisconnected(
          playerIndex,
          true
        );
      }
    } else {
      this.gameScene.showMessage(`${playerName} left the game`);
    }

    this.gameScene.playerIconManager.updateAll();
  }

  private handlePlayerReconnected(data: any): void {
    const playerName = data.playerName || "A player";
    this.gameScene.showMessage(`${playerName} reconnected!`);

    const playerIndex = this.currentServerState?.players.findIndex(
      (p) => p.id === data.playerId
    );
    if (playerIndex !== undefined && playerIndex >= 0) {
      this.gameScene.playerIconManager.setPlayerDisconnected(
        playerIndex,
        false
      );
    }
  }

  // ===========================================================================
  // PRIVATE - HELPERS
  // ===========================================================================

  /**
   * Sort meld data for proper visual display (matches single-player behavior)
   */
  private sortMeldData(meldData: CardData[]): CardData[] {
    if (meldData.length === 0) return [];

    const sortedMeld = [...meldData];

    const nonJokers = sortedMeld.filter(
      (c) => c.suit !== "JOKER_RED" && c.suit !== "JOKER_BLACK"
    );

    const isRun =
      nonJokers.length > 0 &&
      nonJokers.every((c) => c.suit === nonJokers[0].suit);

    sortedMeld.sort((a, b) => {
      const aIsJoker = a.suit === "JOKER_RED" || a.suit === "JOKER_BLACK";
      const bIsJoker = b.suit === "JOKER_RED" || b.suit === "JOKER_BLACK";

      if (aIsJoker && bIsJoker) return a.suit.localeCompare(b.suit);
      if (aIsJoker && !bIsJoker) return 1;
      if (!aIsJoker && bIsJoker) return -1;

      if (isRun) {
        return a.value - b.value;
      } else {
        const suitOrder: Record<string, number> = {
          CLUB: 0,
          DIAMOND: 1,
          HEART: 2,
          SPADE: 3,
        };
        const suitDiff = (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
        if (suitDiff !== 0) return suitDiff;
        return a.value - b.value;
      }
    });

    return sortedMeld;
  }

  private showDiscardDrawUndoOption(cardGO: CardGameObject): void {
    this.snapBackCard(cardGO);

    UIHelpers.createModal(
      this.gameScene as unknown as Phaser.Scene,
      "⚠️ Must Use Drawn Card",
      "You must use the card you drew from the discard pile in a meld, or undo your draw.",
      [
        {
          text: "Undo & Draw from Deck",
          callback: () => {
            this.networkManager.undoSpecialDraw();
            this.resetDrawTracking();
          },
          color: COLORS.PRIMARY,
        },
        {
          text: "Keep Trying",
          callback: () => {
            this.gameScene.showMessage("Add the drawn card to a meld first!");
          },
          color: COLORS.SECONDARY,
        },
      ]
    );
  }

  private showFinishingCardUndoOption(cardGO: CardGameObject): void {
    this.snapBackCard(cardGO);

    UIHelpers.createModal(
      this.gameScene as unknown as Phaser.Scene,
      "⚠️ Cannot Finish",
      "You took the finishing card but cannot go out this turn.",
      [
        {
          text: "Undo & Draw from Deck",
          callback: () => {
            this.networkManager.undoSpecialDraw();
            this.resetDrawTracking();
          },
          color: COLORS.PRIMARY,
        },
        {
          text: "Keep Trying",
          callback: () => {
            this.gameScene.showMessage("Lay down all your cards to finish!");
          },
          color: COLORS.SECONDARY,
        },
      ]
    );
  }

  private resetDrawTracking(): void {
    this.drewFromDiscardId = null;
    this.tookFinishingCard = false;
    this.drawnCardUsedInMeld = false;
  }

  private snapBackCard(cardGO: CardGameObject): void {
    const origX = cardGO.getData("origX") as number;
    const origY = cardGO.getData("origY") as number;

    if (origX !== undefined && origY !== undefined) {
      this.gameScene.tweens.add({
        targets: cardGO,
        x: origX,
        y: origY,
        duration: 150,
        ease: "Back.easeOut",
      });
    }
  }
}
