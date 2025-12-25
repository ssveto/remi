// client/scenes/handlers/MultiplayerHandler.ts
import * as Phaser from 'phaser';
import { Card } from '../../lib/card';
import { GamePhase } from '../../lib/game-event';
import { NetworkManager } from '../../lib/network-manager';
import { StateSync, StateChangeTracker } from '../../managers/state-sync';
import { UIHelpers } from '../../lib/ui-helpers';
import { SCENE_KEYS, COLORS } from '../common';
import { MeldValidator, MoveValidator } from '../../../shared';
import {
    SocketEvent,
    GameStateUpdate,
    CardData,
    RoundStartedData,
    RoundEndedData,
} from '../../../shared/types/socket-events';

// Import managers
import {
    HandManager,
    MeldManager,
    PlayerIconManager,
    DragDropManager,
    CardGameObject,
} from '../managers';

// =============================================================================
// TYPES
// =============================================================================

export interface MultiplayerSceneInterface {
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

    // Game objects
    discardPileSprite: Phaser.GameObjects.Image | null;
    finishingCardSprite: Phaser.GameObjects.Image | null;


    // State
    isMyTurn: boolean;
    currentPhase: GamePhase;

    addRoundScore: (playerId: string, score: number) => void;
    setCurrentRound: (round: number) => void;
    showRoundResults?: (results: any) => void; // Optional for now
    getTotalScores: () => Map<string | number, number>;
    showFinalResults?: (results: any) => void; // Optional for now


    // Methods
    showMessage: (text: string, duration?: number) => void;
    updatePhaseUI: () => void;
    updateMeldUI: () => void;
    createDrawPile: () => void;
    createDiscardPile: () => void;
    createFinishingCardFromServer: (card: CardData) => void;

    // Setters
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
    };
}

// =============================================================================
// MULTIPLAYER HANDLER
// =============================================================================

/**
 * Handles all multiplayer socket events and state synchronization.
 *
 * Responsibilities:
 * - Setting up network event listeners
 * - Processing game state updates from server
 * - Validating and sending player actions to server
 * - Handling reconnection and player left events
 * - Managing game over state
 */
export class MultiplayerHandler {
    private gameScene: MultiplayerSceneInterface;
    private config: MultiplayerConfig;

    // Network
    private networkManager: NetworkManager;
    private myPlayerId: string;

    // State tracking
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

    /**
     * Initialize multiplayer connection and event listeners
     */
    setup(): void {
        console.log('🌐 Setting up multiplayer mode');

        // Setup network event listeners
        this.setupEventListeners();

        // Check for cached state (arrived before listeners were ready)
        const cachedState = this.networkManager.getLastGameState();
        if (cachedState) {
            console.log('📊 Processing cached game state');
            this.handleGameStateUpdate(cachedState);
        } else {
            console.log('⏳ Waiting for game state from server...');
        }

        console.log('✅ Multiplayer listeners registered');
    }

    /**
     * Get current server state
     */
    getServerState(): GameStateUpdate | null {
        return this.currentServerState;
    }

    /**
     * Get my player ID
     */
    getMyPlayerId(): string {
        return this.myPlayerId;
    }

    /**
     * Get my player index in the game
     */
    getMyPlayerIndex(): number {
        if (!this.currentServerState) return 0;
        return this.currentServerState.players.findIndex(p => p.id === this.myPlayerId);
    }

    /**
     * Check if a player has opened
     */
    hasPlayerOpened(playerIndex: number): boolean {
        return this.currentServerState?.players[playerIndex]?.hasOpened ?? false;
    }

    /**
     * Get player melds data
     */
    getPlayerMelds(playerIndex: number): CardData[][] {
        return this.currentServerState?.players[playerIndex]?.melds ?? [];
    }

    /**
     * Clean up handler
     */
    destroy(): void {
        this.networkManager.removeAllListeners();
        this.currentServerState = null;
    }

    // ===========================================================================
    // USER ACTIONS
    // ===========================================================================

    /**
     * Handle draw pile click
     */
    handleDrawPileClick(): void {
        this.networkManager.drawCard();
        this.drewFromDiscardId = null;
        this.tookFinishingCard = false;
        this.drawnCardUsedInMeld = false;
    }

    /**
     * Handle discard pile click (draw from discard)
     */
    handleDiscardPileClick(): void {
        if (this.currentServerState?.discardPileTop) {
            this.drewFromDiscardId = this.currentServerState.discardPileTop.id;
            this.drawnCardUsedInMeld = false;
        }
        this.tookFinishingCard = false;
        this.networkManager.drawFromDiscard();
    }

    /**
     * Handle finishing card click
     */
    handleFinishingCardClick(): void {
        this.tookFinishingCard = true;
        this.drewFromDiscardId = null;
        this.drawnCardUsedInMeld = false;
        this.networkManager.takeFinishingCard();
    }

    /**
     * Handle discard drop
     */
    /**
 * Handle discard drop
 */
    handleDiscard(card: Card, cardGO: CardGameObject): boolean {
        const cardId = (card as any).serverId;

        if (!cardId) {
            console.error('Card missing serverId:', card);
            return false;
        }

        // Guard 1: Drew from discard but didn't use the card
        if (this.drewFromDiscardId && !this.drawnCardUsedInMeld) {
            // Check if trying to discard the exact card we drew
            if (cardId === this.drewFromDiscardId) {
                this.gameScene.showMessage('Cannot discard the card you just drew!');
                this.snapBackCard(cardGO);
                return false;
            }

            // Check if the drawn card is still in hand (wasn't used in a meld)
            const drawnCardStillInHand = this.gameScene.handManager.getHandCards().some(
                c => (c as any).serverId === this.drewFromDiscardId
            );

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
            this.gameScene.showMessage(canDiscard.error || 'Cannot discard');
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
            ease: 'Power2',
            onComplete: () => {
                this.networkManager.discardCard(cardId);
                this.gameScene.handManager.destroyCardSafely(cardGO);

                if (this.gameScene.discardPileSprite) {
                    const frame = this.gameScene.handManager.getCardFrame(card as any);
                    this.gameScene.discardPileSprite.setFrame(frame).setVisible(true);
                }

                // Reset tracking
                this.resetDrawTracking();
            }
        });

        return true;
    }

    /**
 * Handle add card to meld
 */
    handleAddToMeld(
        card: Card,
        cardGO: CardGameObject,
        meldOwner: string,
        meldIndex: number
    ): boolean {
        const cardId = (card as any).serverId;

        if (!cardId) {
            console.error('Card missing serverId');
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
            this.gameScene.showMessage(canAdd.error || 'Cannot add to meld');
            return false;
        }

        // Find the meld owner's player index
        const meldOwnerIndex = this.currentServerState!.players.findIndex(
            p => p.id === meldOwner
        );

        // Get the meld visual
        const meld = this.gameScene.meldManager.getMeld(meldOwnerIndex, meldIndex);

        if (meld) {
            // Remove card from hand
            this.gameScene.handManager.removeCard(card);
            this.gameScene.handManager.updateHandDisplay();
            this.gameScene.handManager.updateHandDropZones();

            // Add card to meld visually
            this.gameScene.meldManager.addCardToMeldVisual(meld, cardGO, card);
        }

        // Send to server
        this.networkManager.addCardToMeld(cardId, meldOwner, meldIndex);
        return true;
    }

    /**
     * Handle laying melds
     */
    handleLayMelds(selectedCards: Card[]): void {

        if (this.drewFromDiscardId) {
            const drawnCardUsed = selectedCards.some(
                c => (c as any).serverId === this.drewFromDiscardId
            );
            if (drawnCardUsed) {
                this.drawnCardUsedInMeld = true;
            }
        }
        const meldIds = [StateSync.getCardIds(selectedCards)];
        this.networkManager.layMelds(meldIds);
    }
    /**
 * Handle hand reorder
 */
    handleReorderHand(fromIndex: number, toIndex: number): void {
        // Update local hand immediately for responsiveness
        this.gameScene.handManager.reorderCard(fromIndex, toIndex);

        // Send to server
        this.networkManager.reorderHand(fromIndex, toIndex);
    }

    /**
 * Handle skip meld phase
 */
    handleSkipMeld(): void {
        // Validate locally
        if (!this.gameScene.isMyTurn) {
            this.gameScene.showMessage('Not your turn');
            return;
        }

        if (this.currentServerState?.phase !== 'MELD') {
            this.gameScene.showMessage('Can only skip during meld phase');
            return;
        }

        this.networkManager.skipMeld();
    }

    /**
     * Leave the current room
     */
    leaveRoom(): void {
        this.networkManager.leaveRoom();
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        this.networkManager.disconnect();
    }

    // ===========================================================================
    // PRIVATE - EVENT SETUP
    // ===========================================================================

    private setupEventListeners(): void {
        // Game state updates
        this.networkManager.on(SocketEvent.GAME_STATE_UPDATE, (state: GameStateUpdate) => {
            this.handleGameStateUpdate(state);
        });

        // Game over
        this.networkManager.on(SocketEvent.GAME_OVER, (result: any) => {
            this.handleGameOver(result);
        });

        // Errors
        this.networkManager.on(SocketEvent.ERROR, (error: any) => {
            this.handleError(error);
        });

        // Player left
        this.networkManager.on(SocketEvent.PLAYER_LEFT, (data: any) => {
            this.handlePlayerLeft(data);
        });

        // Player reconnected
        this.networkManager.on(SocketEvent.PLAYER_RECONNECTED, (data: any) => {
            this.handlePlayerReconnected(data);
        });

        // Undo confirmation
        this.networkManager.on(SocketEvent.UNDO_CONFIRMED, (data: { type: string }) => {
            if (data.type === 'FINISHING_CARD') {
                this.gameScene.showMessage('Undo successful - drew from deck instead');
                // Restore finishing card visual
                if (this.currentServerState?.finishingCard && this.gameScene.finishingCardSprite) {
                    this.gameScene.finishingCardSprite.setVisible(true);
                }
            } else if (data.type === 'DRAW_FROM_DISCARD') {
                this.gameScene.showMessage('Undo successful - drew from deck instead');
            }
        });
        this.networkManager.on(SocketEvent.ROUND_STARTED, (data: RoundStartedData) => {
            this.handleRoundStarted(data);
        });

        this.networkManager.on(SocketEvent.ROUND_ENDED, (data: RoundEndedData) => {
            this.handleRoundEnded(data);
        });
    }

    // ===========================================================================
    // PRIVATE - STATE HANDLING
    // ===========================================================================

    private handleGameStateUpdate(state: GameStateUpdate): void {
        const previousState = this.currentServerState;
        this.currentServerState = state;

        // Detect what changed
        const changes = this.stateChangeTracker.detectChanges(state);
        console.log('📨 State update received, changes:', changes);

        // First update - create board
        if (!this.boardCreated) {
            this.createGameBoard();
            this.boardCreated = true;
        }

        // Update player icons
        this.gameScene.playerIconManager.updateAll();

        // Update hand if changed
        if (changes.handChanged && state.myHand) {
            this.updateHand(state.myHand);
        }

        // Update melds if changed
        if (changes.meldsChanged) {
            this.updateMelds(state);
            this.handleJokerReplacementFromServer(state, previousState);
        }

        // Check for newly opened opponents
        this.checkForNewlyOpenedPlayers(state, previousState);

        // Update discard pile
        if (changes.discardChanged && state.discardPileTop) {
            this.updateDiscardPile(state.discardPileTop);
        }

        // Update finishing card
        if (state.finishingCard && !this.gameScene.finishingCardSprite) {
            this.gameScene.createFinishingCardFromServer(state.finishingCard);
        }

        // Update turn state
        this.gameScene.setIsMyTurn(StateSync.isMyTurn(state, this.myPlayerId));
        this.gameScene.setCurrentPhase(state.phase as GamePhase);

        // Update UI
        this.gameScene.updatePhaseUI();

        // Refresh opponent meld view if open
        this.gameScene.meldManager.refreshMeldViewIfOpen((pi) => this.getPlayerMelds(pi));

        // Update current player highlight
        if (changes.turnChanged) {
            const currentPlayerIndex = state.players.findIndex(
                p => p.id === state.currentPlayerId
            );
            this.gameScene.playerIconManager.setCurrentPlayer(currentPlayerIndex);

            if (currentPlayerIndex !== this.getMyPlayerIndex()) {
                this.gameScene.playerIconManager.pulseIcon(currentPlayerIndex);
            }
            this.lastDrawnFromDiscardId = null;
            this.tookFinishingCard = false;
            // Update discard zone highlight
            const shouldHighlight = this.gameScene.isMyTurn &&
                state.phase !== 'DRAW';
            this.gameScene.dragDropManager.setDiscardHighlight(shouldHighlight);
        }

        if (previousState) {
            state.players.forEach((player, index) => {
                if (player.id === this.myPlayerId) return;

                const prevPlayer = previousState.players.find(p => p.id === player.id);
                if (prevPlayer && prevPlayer.handSize !== player.handSize) {
                    const increased = player.handSize > prevPlayer.handSize;
                    this.gameScene.playerIconManager.highlightCardCountChange(index, increased);
                }
            });
        }
    }

    private handleRoundStarted(data: RoundStartedData): void {
        this.currentRound = data.round;
        this.totalRounds = data.totalRounds;

        // Update GameScene
        if (typeof this.gameScene.setCurrentRound === 'function') {
            this.gameScene.setCurrentRound(this.currentRound);
        }
        this.gameScene.showMessage(`Round ${this.currentRound} started!`, 2000);

        // Reset local state for new round
        this.boardCreated = false;
        this.lastDrawnFromDiscardId = null;
        this.tookFinishingCard = false;
        this.previousHandIds = new Set();
    }

    private handleRoundEnded(data: RoundEndedData): void {
        const { round, winner, roundScores, cumulativeScores } = data;

        // Update round tracking
        this.currentRound = round;

        // Update scores in GameScene
        if (typeof this.gameScene.addRoundScore === 'function') {
            roundScores.forEach(({ playerId, score }) => {
                this.gameScene.addRoundScore(playerId, score);
            });
        }

        if (typeof this.gameScene.showRoundResults === 'function') {
            this.gameScene.showRoundResults?.({
                round,
                winner: winner.id,
                scores: roundScores,
                cumulativeScores,
            });
        } else {
            // Fallback: show message
            const isWinner = winner.id === this.myPlayerId;
            this.gameScene.showMessage(
                `${winner.name} won round ${round}! ${isWinner ? '🎉' : '😔'}`,
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
        const currentHandIds = new Set(serverCards.map(c => c.id));

        // Find new cards (in server state but not in our previous hand)
        const newCards = serverCards.filter(c => !this.previousHandIds.has(c.id));

        // Find removed cards (in previous hand but not in server state)
        const removedIds = [...this.previousHandIds].filter(id => !currentHandIds.has(id));

        // If it's a full refresh (first load, or major change), just set the hand
        if (this.previousHandIds.size === 0 || removedIds.length > 1 || newCards.length > 3) {
            const newHand = StateSync.serverCardsToClient(serverCards);
            this.gameScene.handManager.setHand(newHand);
        } else {
            // Incremental update - animate individual changes

            // Remove cards that are gone (usually handled by discard already, but just in case)
            for (const removedId of removedIds) {
                const card = this.gameScene.handManager.getHandCards().find(
                    c => (c as any).serverId === removedId || c.id === removedId
                );
                if (card) {
                    this.gameScene.handManager.removeCard(card);
                }
            }

            // Add new cards with animation
            for (const serverCard of newCards) {
                const clientCard = StateSync.serverCardToClient(serverCard);

                // Determine where card came from based on game state
                let sourceX = this.config.layout.DRAW_PILE.x;
                let sourceY = this.config.layout.DRAW_PILE.y;

                // If discard pile changed, card probably came from there
                if (this.currentServerState?.discardPileTop?.id !== serverCard.id) {
                    // Check if we drew from discard (discard pile shrunk)
                    // For now, default to draw pile position
                }

                this.gameScene.handManager.addCard(clientCard, sourceX, sourceY);
            }

            // Update display to reposition cards smoothly
            this.gameScene.handManager.updateHandDisplay();
        }

        // Update tracking
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

            const previousPlayer = previousState?.players.find(p => p.id === player.id);
            const justOpened = player.hasOpened && !previousPlayer?.hasOpened;

            if (justOpened) {
                // Show their melds
                this.gameScene.meldManager.showOpponentMelds(index, player.melds);
                this.gameScene.playerIconManager.flashMeldIndicator(index);
            }
        });
    }

    // ===========================================================================
    // PRIVATE - EVENT HANDLERS
    // ===========================================================================

    private handleGameOver(result: any): void {
        // This is now FINAL game over after all rounds
        const finalResults = {
            winner: result.winner,
            totalScores: result.finalScores || [],
            roundResults: result.roundResults || [],
        };

        /// Show final results
        if (typeof this.gameScene.showFinalResults === 'function') {
            this.gameScene.showFinalResults?.(finalResults);
        } else {
            // Fallback: show simple message
            const isWinner = result.winner.id === this.myPlayerId;
            const message = isWinner
                ? `🏆 You won the game! Final score: ${result.winner.score}`
                : `🏆 ${result.winner.name} won the game!`;

            this.gameScene.showMessage(message, 5000);
        }
    }


    private handleError(error: any): void {
        console.error('❌ Network error:', error);
        UIHelpers.showToast(
            this.gameScene as unknown as Phaser.Scene,
            error.message || 'Network error',
            3000,
            COLORS.ERROR
        );
    }

    private handlePlayerLeft(data: any): void {
        const playerName = data.playerName || 'A player';
        const disconnected = data.disconnected || false;

        if (disconnected) {
            this.gameScene.showMessage(`${playerName} disconnected - waiting for reconnection...`);

            // Find player index and update icon
            const playerIndex = this.currentServerState?.players.findIndex(
                p => p.name === playerName
            );
            if (playerIndex !== undefined && playerIndex >= 0) {
                this.gameScene.playerIconManager.setPlayerDisconnected(playerIndex, true);
            }
        } else {
            this.gameScene.showMessage(`${playerName} left the game`);
        }

        this.gameScene.playerIconManager.updateAll();
    }

    private handlePlayerReconnected(data: any): void {
        const playerName = data.playerName || 'A player';
        this.gameScene.showMessage(`${playerName} reconnected!`);

        // Find player index and update icon
        const playerIndex = this.currentServerState?.players.findIndex(
            p => p.id === data.playerId
        );
        if (playerIndex !== undefined && playerIndex >= 0) {
            this.gameScene.playerIconManager.setPlayerDisconnected(playerIndex, false);
        }
    }

    validateSelection(selectedCards: Card[]): {
        score: number;
        isValid: boolean;
        meetsOpenRequirement: boolean;
        validMelds: Card[][];
    } {
        if (selectedCards.length < 3) {
            return { score: 0, isValid: false, meetsOpenRequirement: false, validMelds: [] };
        }

        // Convert to CardData format for validator
        const cardData: CardData[] = selectedCards.map(card => ({
            id: (card as any).serverId || card.id,
            suit: card.suit as any,
            value: card.value,
            isFaceUp: card.isFaceUp,
        }));

        // Use MeldValidator to check if cards form valid melds
        const isSet = MeldValidator.isValidSet(cardData);
        const isRun = MeldValidator.isValidRun(cardData);
        const isValid = isSet || isRun;

        // Calculate score
        const score = isValid ? MeldValidator.calculateMeldScore(cardData) : 0;

        // Check opening requirement
        const hasOpened = this.hasPlayerOpened(this.getMyPlayerIndex());
        const meetsRequirement = hasOpened || score >= 51;

        return {
            score,
            isValid,
            meetsOpenRequirement: meetsRequirement,
            validMelds: isValid ? [selectedCards] : [],
        };
    }

    /**
 * Handle joker replacement from server state update
 */
    private handleJokerReplacementFromServer(
        state: GameStateUpdate,
        previousState: GameStateUpdate | null
    ): void {
        if (!previousState) return;

        const myIndex = this.getMyPlayerIndex();
        const myCurrentHand = state.myHand || [];
        const myPreviousHand = previousState.myHand || [];

        // Check if a joker appeared in hand that wasn't there before
        const newJokers = myCurrentHand.filter(card => {
            const isJoker = card.suit === 'JOKER_RED' || card.suit === 'JOKER_BLACK';
            const wasInPreviousHand = myPreviousHand.some(c => c.id === card.id);
            return isJoker && !wasInPreviousHand;
        });

        if (newJokers.length > 0) {
            this.gameScene.showMessage('Joker replaced and added to your hand!');
            // The hand update will handle adding the card visually
        }
    }

    private showDiscardDrawUndoOption(cardGO: CardGameObject): void {
        this.snapBackCard(cardGO);

        UIHelpers.createModal(
            this.gameScene as unknown as Phaser.Scene,
            '⚠️ Must Use Drawn Card',
            'You must use the card you drew from the discard pile in a meld, or undo your draw.',
            [
                {
                    text: 'Undo & Draw from Deck',
                    callback: () => {
                        this.networkManager.undoSpecialDraw();
                        this.resetDrawTracking();
                    },
                    color: COLORS.PRIMARY,
                },
                {
                    text: 'Keep Trying',
                    callback: () => {
                        this.gameScene.showMessage('Add the drawn card to a meld first!');
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
            '⚠️ Cannot Finish',
            'You took the finishing card but cannot go out this turn.',
            [
                {
                    text: 'Undo & Draw from Deck',
                    callback: () => {
                        this.networkManager.undoSpecialDraw();
                        this.resetDrawTracking();
                    },
                    color: COLORS.PRIMARY,
                },
                {
                    text: 'Keep Trying',
                    callback: () => {
                        this.gameScene.showMessage('Lay down all your cards to finish!');
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

    /**
     * Snap card back to original position
     */
    private snapBackCard(cardGO: CardGameObject): void {
        const origX = cardGO.getData('origX') as number;
        const origY = cardGO.getData('origY') as number;

        if (origX !== undefined && origY !== undefined) {
            this.gameScene.tweens.add({
                targets: cardGO,
                x: origX,
                y: origY,
                duration: 150,
                ease: 'Back.easeOut',
            });
        }
    }
}
