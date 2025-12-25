// client/scenes/managers/AIManager.ts
import * as Phaser from 'phaser';
import { Card } from '../../lib/card';
import { Remi } from '../../lib/remi';
import { AIPlayer, AIDifficulty } from '../../lib/ai-player';
import { GamePhase } from '../../lib/game-event';

// =============================================================================
// CONSTANTS
// =============================================================================

export const AI_TIMING = {
    INITIAL_DELAY: 500,
    THINK_DELAY: 500,
    MELD_ADDITION_DELAY: 200,
    MELD_ADDITION_STAGGER: 300,
    DISCARD_DELAY: 500,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface AIConfig {
    difficulty: AIDifficulty;
    thinkDelay?: number;
    randomness?: number;
}

export interface AIManagerCallbacks {
    getLogic: () => Remi | null;
    showMessage: (text: string) => void;
    updatePlayerIcons: () => void;
    onOpponentOpened: (playerIndex: number) => void;
    onAITurnComplete?: () => void;
}

export interface AITurnPlan {
    meldsToLay: Card[][];
    cardsToAddToMelds?: Array<{
        card: Card;
        meldOwner: number;
        meldIndex: number;
    }>;
    cardToDiscard: Card;
}

// =============================================================================
// AI MANAGER - FIXED VERSION
// =============================================================================

export class AIManager {
    private scene: Phaser.Scene;
    private callbacks: AIManagerCallbacks;

    // AI state - support multiple AI players
    private aiPlayers: Map<number, AIPlayer> = new Map();
    private currentTurnId: number | null = null;
    private config: AIConfig;
    private isProcessingTurn: boolean = false;

    constructor(
        scene: Phaser.Scene,
        callbacks: AIManagerCallbacks,
        config?: Partial<AIConfig>
    ) {
        this.scene = scene;
        this.callbacks = callbacks;
        this.config = {
            difficulty: config?.difficulty ?? AIDifficulty.HARD,
            thinkDelay: config?.thinkDelay ?? 800,
            randomness: config?.randomness ?? 0.1,
        };
    }

    // ===========================================================================
    // PUBLIC API - INITIALIZATION
    // ===========================================================================

    /**
     * Initialize AI players
     * @param numPlayersOrHumanIndex - If second param provided: total players. Otherwise: human player index (legacy)
     * @param humanPlayerIndex - Index of the human player (default 0)
     */
    initialize(numPlayersOrHumanIndex: number = 2, humanPlayerIndex?: number): void {
        // Handle legacy call: initialize() or initialize(humanIndex)
        // vs new call: initialize(numPlayers, humanIndex)
        let numPlayers: number;
        let humanIdx: number;

        if (humanPlayerIndex !== undefined) {
            // New style: initialize(numPlayers, humanIndex)
            numPlayers = numPlayersOrHumanIndex;
            humanIdx = humanPlayerIndex;
        } else {
            // Legacy style: initialize() or initialize(humanIndex)
            // Try to get player count from game logic, but safely
            const logic = this.callbacks.getLogic();
            let detectedPlayers = 2;
            
            try {
                const state = logic?.getState?.();
                if (state?.numPlayers) {
                    detectedPlayers = state.numPlayers;
                }
            } catch (e) {
                // Game not started yet, use default
                console.log('[AIManager] Game not started yet, using default 2 players');
            }
            
            numPlayers = detectedPlayers;
            humanIdx = numPlayersOrHumanIndex === 2 ? 0 : numPlayersOrHumanIndex; // If called with no args, default human to 0
        }
        
        this.initializeForPlayers(numPlayers, humanIdx);
    }

    /**
     * Initialize AI players for a multi-player game
     * @param numPlayers Total number of players
     * @param humanPlayerIndex Index of the human player (default 0)
     */
    initializeForPlayers(numPlayers: number = 2, humanPlayerIndex: number = 0): void {
        this.aiPlayers.clear();
        this.currentTurnId = null;
        this.isProcessingTurn = false;

        // Validate inputs
        if (numPlayers < 2) {
            console.warn(`[AIManager] numPlayers (${numPlayers}) too low, using 2`);
            numPlayers = 2;
        }
        if (humanPlayerIndex < 0 || humanPlayerIndex >= numPlayers) {
            console.warn(`[AIManager] humanPlayerIndex (${humanPlayerIndex}) out of range, using 0`);
            humanPlayerIndex = 0;
        }

        console.log(`[AIManager] Initializing for ${numPlayers} players, human is player ${humanPlayerIndex}`);

        for (let i = 0; i < numPlayers; i++) {
            if (i !== humanPlayerIndex) {
                console.log(`[AIManager] Creating AI player for index ${i}`);
                this.aiPlayers.set(i, new AIPlayer({
                    difficulty: this.config.difficulty,
                    thinkDelay: this.config.thinkDelay as number,
                    randomness: this.config.randomness as number,
                }));
            }
        }

        console.log(`[AIManager] Initialized ${this.aiPlayers.size} AI players for indices: ${Array.from(this.aiPlayers.keys()).join(', ')}`);
    }

    /**
     * Convenient alias for initializeForPlayers
     * USE THIS METHOD - pass the number of players explicitly
     * Example: aiManager.initializeWithPlayerCount(3) for 1 human + 2 AI
     */
    initializeWithPlayerCount(numPlayers: number, humanPlayerIndex: number = 0): void {
        this.initializeForPlayers(numPlayers, humanPlayerIndex);
    }

    /**
     * Update AI difficulty
     */
    setDifficulty(difficulty: AIDifficulty): void {
        this.config.difficulty = difficulty;
        
        // Update randomness based on difficulty
        switch (difficulty) {
            case AIDifficulty.EASY:
                this.config.randomness = 0.3;
                break;
            case AIDifficulty.MEDIUM:
                this.config.randomness = 0.15;
                break;
            case AIDifficulty.HARD:
                this.config.randomness = 0.08;
                break;
            case AIDifficulty.EXPERT:
                this.config.randomness = 0.02;
                break;
        }
        
        // Reinitialize existing AI players with new difficulty
        const existingIndices = Array.from(this.aiPlayers.keys());
        for (const index of existingIndices) {
            this.aiPlayers.set(index, new AIPlayer({
                difficulty: this.config.difficulty,
                thinkDelay: this.config.thinkDelay as number,
                randomness: this.config.randomness as number,
            }));
        }
    }

    /**
     * Get AI player instance
     */
    getAIPlayer(playerIndex?: number): AIPlayer | null {
        if (playerIndex !== undefined) {
            return this.aiPlayers.get(playerIndex) || null;
        }
        // Return first AI player for backward compatibility
        const first = this.aiPlayers.values().next();
        return first.done ? null : first.value;
    }

    /**
     * Check if AI is initialized
     */
    isInitialized(): boolean {
        return this.aiPlayers.size > 0;
    }

    // ===========================================================================
    // PUBLIC API - OPPONENT TRACKING
    // ===========================================================================

    notifyOpponentDiscard(playerIndex: number, card: Card): void {
        this.aiPlayers.forEach(ai => {
            if (typeof ai.updateOpponentModel === 'function') {
                ai.updateOpponentModel(playerIndex, 'discard', card);
            }
        });
    }

    notifyOpponentPickDiscard(playerIndex: number, card: Card): void {
        this.aiPlayers.forEach(ai => {
            if (typeof ai.updateOpponentModel === 'function') {
                ai.updateOpponentModel(playerIndex, 'pick_discard', card);
            }
        });
    }

    notifyOpponentDrawDeck(playerIndex: number): void {
        this.aiPlayers.forEach(ai => {
            if (typeof ai.updateOpponentModel === 'function') {
                ai.updateOpponentModel(playerIndex, 'draw_deck');
            }
        });
    }

    notifyOpponentLayMelds(playerIndex: number, melds: Card[][]): void {
        this.aiPlayers.forEach(ai => {
            if (typeof ai.updateOpponentModel === 'function') {
                ai.updateOpponentModel(playerIndex, 'lay_melds', undefined, melds);
            }
        });
    }

    notifyOpponentOpened(playerIndex: number): void {
        this.aiPlayers.forEach(ai => {
            if (typeof ai.updateOpponentModel === 'function') {
                ai.updateOpponentModel(playerIndex, 'open');
            }
        });
    }

    // ===========================================================================
    // PUBLIC API - TURN EXECUTION
    // ===========================================================================

    /**
     * Run an AI turn for the current player
     */
    runTurn(): boolean {
        console.log('[AIManager] runTurn called');

        if (!this.canRunTurn()) {
            console.log('[AIManager] Cannot run turn');
            return false;
        }

        const logic = this.callbacks.getLogic();
        if (!logic) {
            console.log('[AIManager] No game logic');
            return false;
        }

        const state = logic.getState();
        const aiIndex = state.currentPlayer;

        const turnId = Date.now();
        this.currentTurnId = turnId;
        this.isProcessingTurn = true;

        // Execute with error handling
        this.executeTurnSequenceSafe(turnId, aiIndex);

        return true;
    }

    /**
     * Cancel any running AI turn
     */
    cancelTurn(): void {
        console.log('[AIManager] Cancelling turn');
        this.currentTurnId = null;
        this.isProcessingTurn = false;
    }

    /**
     * Check if an AI turn is currently running
     */
    isTurnRunning(): boolean {
        return this.isProcessingTurn;
    }

    /**
     * Check if AI can run a turn right now
     * Will auto-initialize missing AI players if needed
     */
    canRunTurn(): boolean {
        const logic = this.callbacks.getLogic();
        if (!logic) {
            console.log('[AIManager] canRunTurn: no logic');
            return false;
        }

        let state;
        try {
            state = logic.getState();
        } catch (e) {
            console.log('[AIManager] canRunTurn: game not started');
            return false;
        }

        if (!state) {
            console.log('[AIManager] canRunTurn: no state');
            return false;
        }

        if (state.phase === GamePhase.GAME_OVER) {
            console.log('[AIManager] canRunTurn: game over');
            return false;
        }

        if (state.currentPlayer === 0) {
            // Human player's turn
            return false;
        }

        // Auto-initialize if we don't have enough AI players
        if (this.aiPlayers.size === 0 || !this.aiPlayers.has(state.currentPlayer)) {
            console.log(`[AIManager] Auto-initializing AI players (current player ${state.currentPlayer} not found)`);
            this.initializeForPlayers(state.numPlayers, 0); // Use explicit method with known player count
        }

        // Check again after potential initialization
        if (!this.aiPlayers.has(state.currentPlayer)) {
            return false;
        }

        if (this.isProcessingTurn) {
            return false;
        }

        return true;
    }

    /**
     * Reset AI manager for a new game
     * Call this when starting a new game
     * @param numPlayers Total number of players in the game
     * @param humanPlayerIndex Index of the human player (default 0)
     */
    resetForNewGame(numPlayers: number, humanPlayerIndex: number = 0): void {
        console.log(`[AIManager] Resetting for new game with ${numPlayers} players`);
        this.cancelTurn();
        this.aiPlayers.clear();
        this.initializeForPlayers(numPlayers, humanPlayerIndex);
    }

    // ===========================================================================
    // PUBLIC API - QUERIES
    // ===========================================================================

    shouldDrawFromDiscard(playerIndex: number): boolean {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(playerIndex);
        if (!logic || !aiPlayer) return false;

        try {
            return aiPlayer.shouldDrawFromDiscard(logic, playerIndex);
        } catch (error) {
            console.error('[AIManager] Error in shouldDrawFromDiscard:', error);
            return false;
        }
    }

    shouldTakeFinishingCard(playerIndex: number): boolean {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(playerIndex);
        if (!logic || !aiPlayer) return false;

        try {
            return aiPlayer.shouldTakeFinishingCard(logic, playerIndex);
        } catch (error) {
            console.error('[AIManager] Error in shouldTakeFinishingCard:', error);
            return false;
        }
    }

    planTurn(playerIndex: number): AITurnPlan | null {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(playerIndex);
        if (!logic || !aiPlayer) return null;

        try {
            return aiPlayer.planMeldAndDiscard(logic, playerIndex);
        } catch (error) {
            console.error('[AIManager] Error in planTurn:', error);
            return null;
        }
    }

    // ===========================================================================
    // PUBLIC API - CLEANUP
    // ===========================================================================

    destroy(): void {
        this.cancelTurn();
        this.aiPlayers.clear();
    }

    // ===========================================================================
    // PRIVATE - TURN EXECUTION (WITH ERROR HANDLING)
    // ===========================================================================

    private executeTurnSequenceSafe(turnId: number, aiIndex: number): void {
        // Wrap entire execution in try-catch with guaranteed completion
        const executeWithSafety = async () => {
            try {
                await this.executeTurnSequenceAsync(turnId, aiIndex);
            } catch (error) {
                console.error('[AIManager] Critical error in turn execution:', error);
                this.forceCompleteTurn(turnId);
            }
        };

        // Start after initial delay
        this.scene.time.delayedCall(AI_TIMING.INITIAL_DELAY, () => {
            executeWithSafety();
        });
    }

    private async executeTurnSequenceAsync(turnId: number, aiIndex: number): Promise<void> {
        // STEP 1: Draw
        if (!this.validateTurn(turnId, aiIndex)) {
            this.forceCompleteTurn(turnId);
            return;
        }

        console.log(`[AIManager] AI ${aiIndex} executing draw phase`);

        const drawSuccess = this.executeDrawPhase(aiIndex);
        if (!drawSuccess) {
            console.error(`[AIManager] AI ${aiIndex} draw failed`);
            this.forceCompleteTurn(turnId);
            return;
        }

        this.callbacks.updatePlayerIcons();

        // Wait for think delay
        await this.delay(AI_TIMING.THINK_DELAY);

        // STEP 2: Melds
        if (!this.validateTurn(turnId, aiIndex)) {
            this.forceCompleteTurn(turnId);
            return;
        }

        const plan = this.executeMeldPhase(aiIndex);
        if (!plan) {
            console.error(`[AIManager] AI ${aiIndex} meld planning failed`);
            this.forceCompleteTurn(turnId);
            return;
        }

        // Process meld additions with delays
        const cardsToAdd = plan.cardsToAddToMelds ?? [];
        if (cardsToAdd.length > 0) {
            for (let i = 0; i < cardsToAdd.length; i++) {
                await this.delay(AI_TIMING.MELD_ADDITION_DELAY);
                
                if (!this.validateTurn(turnId, aiIndex)) {
                    this.forceCompleteTurn(turnId);
                    return;
                }

                this.executeMeldAddition(aiIndex, cardsToAdd[i]);
            }
        }

        // Wait for discard delay
        await this.delay(AI_TIMING.DISCARD_DELAY);

        // STEP 3: Discard
        if (!this.validateTurn(turnId, aiIndex)) {
            this.forceCompleteTurn(turnId);
            return;
        }

        this.executeDiscardPhase(aiIndex, plan);
        this.callbacks.updatePlayerIcons();

        // Complete turn
        this.completeTurn(turnId);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve);
        });
    }

    private executeDrawPhase(aiIndex: number): boolean {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(aiIndex);

        if (!logic || !aiPlayer) {
            console.error(`[AIManager] Draw phase: missing logic or AI player`);
            return false;
        }

        try {
            // Priority 1: Finishing card
            if (aiPlayer.shouldTakeFinishingCard(logic, aiIndex)) {
                const success = logic.takeFinishingCard(aiIndex);
                if (success) {
                    this.callbacks.showMessage('AI took the finishing card! 🃏');
                    console.log(`[AIManager] AI ${aiIndex} took finishing card`);
                    return true;
                }
            }

            // Priority 2: Discard pile
            if (aiPlayer.shouldDrawFromDiscard(logic, aiIndex)) {
                const topCard = logic.getState().topDiscardCard;
                const success = logic.drawFromDiscard(aiIndex);
                if (success) {
                    console.log(`[AIManager] AI ${aiIndex} drew from discard`);
                    if (topCard) {
                        this.notifyOpponentPickDiscard(aiIndex, topCard);
                    }
                    return true;
                }
            }

            // Default: Draw from deck
            const success = logic.drawCard(aiIndex);
            if (success) {
                this.notifyOpponentDrawDeck(aiIndex);
            }
            return success;

        } catch (error) {
            console.error(`[AIManager] Error in draw phase:`, error);
            
            // Last resort: try to draw from deck
            try {
                return logic.drawCard(aiIndex);
            } catch (e) {
                console.error(`[AIManager] Even fallback draw failed:`, e);
                return false;
            }
        }
    }

    private executeMeldPhase(aiIndex: number): AITurnPlan | null {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(aiIndex);

        if (!logic || !aiPlayer) {
            console.error(`[AIManager] Meld phase: missing logic or AI player`);
            return null;
        }

        try {
            const plan = aiPlayer.planMeldAndDiscard(logic, aiIndex);

            // Lay down melds
            if (plan.meldsToLay.length > 0) {
                const success = logic.layDownMelds(aiIndex, plan.meldsToLay);
                if (success) {
                    console.log(`[AIManager] AI ${aiIndex} laid ${plan.meldsToLay.length} melds`);
                    this.callbacks.onOpponentOpened(aiIndex);
                    this.notifyOpponentLayMelds(aiIndex, plan.meldsToLay);
                    this.notifyOpponentOpened(aiIndex);
                }
            }

            return plan;

        } catch (error) {
            console.error(`[AIManager] Error in meld phase:`, error);
            
            // Return a minimal plan with just a discard
            const hand = logic.getPlayerHand(aiIndex);
            if (hand.length > 0) {
                return {
                    meldsToLay: [],
                    cardToDiscard: hand[0],
                    cardsToAddToMelds: []
                };
            }
            return null;
        }
    }

    private executeMeldAddition(
        aiIndex: number,
        addition: { card: Card; meldOwner: number; meldIndex: number }
    ): void {
        const logic = this.callbacks.getLogic();
        if (!logic) return;

        try {
            logic.addCardToMeld(
                aiIndex,
                addition.card,
                addition.meldOwner,
                addition.meldIndex
            );
            console.log(`[AIManager] AI ${aiIndex} added card to meld`);
        } catch (error) {
            console.error(`[AIManager] Error adding to meld:`, error);
        }
    }

    private executeDiscardPhase(aiIndex: number, plan: AITurnPlan): void {
        const logic = this.callbacks.getLogic();
        const aiPlayer = this.aiPlayers.get(aiIndex);

        if (!logic) {
            console.error(`[AIManager] Discard phase: missing logic`);
            return;
        }

        try {
            const currentHand = logic.getPlayerHand(aiIndex);
            
            if (currentHand.length === 0) {
                return;
            }

            // Try planned card first
            let cardToDiscard = currentHand.find(c => c.id === plan.cardToDiscard.id);

            // Fallback: recalculate
            if (!cardToDiscard && aiPlayer) {
                cardToDiscard = aiPlayer.selectBestDiscardAdvanced(
                    currentHand,
                    logic.getState(),
                    aiIndex,
                    logic,
                    currentHand
                );
            }

            // Last fallback: first card
            if (!cardToDiscard) {
                cardToDiscard = currentHand[0];
            }

            logic.discardCard(aiIndex, cardToDiscard);
            this.notifyOpponentDiscard(aiIndex, cardToDiscard);

        } catch (error) {
            console.error(`[AIManager] Error in discard phase:`, error);
            
            // Emergency discard
            try {
                const hand = logic.getPlayerHand(aiIndex);
                if (hand.length > 0) {
                    logic.discardCard(aiIndex, hand[0]);
                }
            } catch (e) {
                console.error(`[AIManager] Emergency discard failed:`, e);
            }
        }
    }

    // ===========================================================================
    // PRIVATE - VALIDATION
    // ===========================================================================

    private validateTurn(turnId: number, playerIndex: number): boolean {
        if (this.currentTurnId !== turnId) {
            return false;
        }

        const logic = this.callbacks.getLogic();
        if (!logic) {
            return false;
        }

        const state = logic.getState();

        if (state.phase === GamePhase.GAME_OVER) {
            return false;
        }

        if (state.currentPlayer !== playerIndex) {
            return false;
        }

        return true;
    }

    private completeTurn(turnId: number): void {
        if (this.currentTurnId === turnId) {
            console.log(`[AIManager] Turn ${turnId} completed normally`);
            this.currentTurnId = null;
            this.isProcessingTurn = false;
            this.callbacks.onAITurnComplete?.();
        }
    }

    private forceCompleteTurn(turnId: number): void {
        this.currentTurnId = null;
        this.isProcessingTurn = false;
        this.callbacks.onAITurnComplete?.();
    }
}