"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveValidator = void 0;
const game_state_types_1 = require("../types/game-state.types");
const meld_validator_1 = require("./meld-validator");
class MoveValidator {
    static canDrawFromDeck(playerId, gameState) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.DRAW && gameState.phase !== "DRAW") {
            return {
                valid: false,
                error: "Wrong phase - must draw first",
                errorCode: "WRONG_PHASE",
            };
        }
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
        const sizeCheck = this.validateHandSizeForAction("DRAW", player.handSize, player.hasOpened);
        if (!sizeCheck.valid)
            return sizeCheck;
        const integrityCheck = this.validateGameStateIntegrity(gameState);
        if (!integrityCheck.valid)
            return integrityCheck;
        return { valid: true };
    }
    static canDrawFromDiscard(playerId, gameState) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.DRAW && gameState.phase !== "DRAW") {
            return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
        }
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
        if (player.handSize >= 15) {
            return { valid: false, error: "Hand is full", errorCode: "HAND_FULL" };
        }
        return { valid: true };
    }
    static isJoker(card) {
        return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
    }
    static canTakeFinishingCard(playerId, gameState) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.DRAW && gameState.phase !== "DRAW") {
            return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
        }
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
        if (player.hasOpened) {
            return {
                valid: false,
                error: "Cannot take finishing card after opening",
                errorCode: "ALREADY_OPENED",
            };
        }
        const sizeCheck = this.validateHandSizeForAction("TAKE_FINISHING_CARD", player.handSize, player.hasOpened);
        if (!sizeCheck.valid)
            return sizeCheck;
        return { valid: true };
    }
    static canDiscard(playerId, cardId, gameState, playerHand) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        const phase = gameState.phase;
        const isMeldPhase = phase === game_state_types_1.GamePhase.MELD || phase === "MELD";
        const isDiscardPhase = phase === game_state_types_1.GamePhase.DISCARD || phase === "DISCARD";
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
        const hand = player.hand || playerHand;
        if (!hand) {
            return { valid: true };
        }
        if (!hand.some((card) => card.id === cardId)) {
            return {
                valid: false,
                error: "Card not in hand",
                errorCode: "CARD_NOT_IN_HAND",
            };
        }
        return { valid: true };
    }
    static canTransitionToPhase(currentPhase, targetPhase, playerId, gameState) {
        if (gameState) {
            const player = this.getPlayer(gameState, playerId);
            if (!player) {
                return { valid: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' };
            }
        }
        const transitions = {
            DRAW: ["MELD"],
            MELD: ["DISCARD", "MELD"],
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
    static validateHandSizeForAction(action, currentHandSize, hasOpened) {
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
    static canLayMelds(playerId, melds, gameState, openingRequirement = 51, playerHand) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.MELD && gameState.phase !== "MELD") {
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
        for (let i = 0; i < melds.length; i++) {
            const meld = melds[i];
            if (!meld_validator_1.MeldValidator.isValidSet(meld) && !meld_validator_1.MeldValidator.isValidRun(meld)) {
                return {
                    valid: false,
                    error: `Meld ${i + 1} is not a valid set or run`,
                    errorCode: "INVALID_MELD",
                };
            }
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
        const allMeldCards = melds.flat();
        const cardIds = allMeldCards.map((c) => c.id);
        if (cardIds.length !== new Set(cardIds).size) {
            return {
                valid: false,
                error: "Cannot use same card in multiple melds",
                errorCode: "DUPLICATE_CARDS",
            };
        }
        if (!player.hasOpened) {
            const totalScore = melds.reduce((sum, meld) => sum + meld_validator_1.MeldValidator.calculateMeldScore(meld), 0);
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
    static validateGameStateIntegrity(gameState) {
        const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
        if (!currentPlayer) {
            return { valid: false, error: 'Current player not found', errorCode: 'PLAYER_NOT_FOUND' };
        }
        for (const player of gameState.players) {
            if (player.handSize < 0 || player.handSize > 15) {
                return {
                    valid: false,
                    error: `Player ${player.name} has invalid hand size: ${player.handSize}`,
                    errorCode: 'INVALID_HAND_SIZE'
                };
            }
        }
        if (gameState.drawPileSize < 0) {
            return { valid: false, error: 'Draw pile has negative size', errorCode: 'INVALID_DRAW_PILE' };
        }
        const validPhases = [game_state_types_1.GamePhase.DRAW, game_state_types_1.GamePhase.MELD, game_state_types_1.GamePhase.DISCARD, game_state_types_1.GamePhase.GAME_OVER];
        if (!validPhases.includes(gameState.phase) &&
            !['DRAW', 'MELD', 'DISCARD', 'GAME_OVER'].includes(gameState.phase)) {
            return { valid: false, error: `Invalid phase: ${gameState.phase}`, errorCode: 'INVALID_PHASE' };
        }
        return { valid: true };
    }
    static canReorderHand(playerId, fromIndex, toIndex, handSize) {
        if (playerId) {
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
    static canRemoveMeld(playerId, meldIndex, playerMelds) {
        if (!playerId) {
            return { valid: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' };
        }
        if (meldIndex < 0 || meldIndex >= playerMelds.length) {
            return { valid: false, error: 'Invalid meld index', errorCode: 'INVALID_MELD_INDEX' };
        }
        if (playerMelds.length === 0) {
            return { valid: false, error: 'No melds to remove', errorCode: 'NO_MELDS' };
        }
        return { valid: true };
    }
    static canShuffleDeck(gameState) {
        if (gameState.drawPileSize > 0) {
            return { valid: false, error: 'Draw pile is not empty', errorCode: 'DRAW_PILE_NOT_EMPTY' };
        }
        const totalCards = gameState.players.reduce((sum, player) => sum + player.handSize, 0) +
            gameState.drawPileSize;
        if (totalCards >= 104) {
            return { valid: false, error: 'All cards are in play', errorCode: 'NO_CARDS_TO_SHUFFLE' };
        }
        return { valid: true };
    }
    static canAddToMeld(playerId, cardId, meldOwner, meldIndex, gameState, playerHand) {
        const player = this.getPlayerByIdOrIndex(gameState, playerId);
        if (!player) {
            return {
                valid: false,
                error: "Player not found",
                errorCode: "PLAYER_NOT_FOUND",
            };
        }
        if (gameState.currentPlayerId !== player.id) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.MELD && gameState.phase !== "MELD") {
            return { valid: false, error: "Wrong phase", errorCode: "WRONG_PHASE" };
        }
        const hand = player.hand || playerHand;
        let card;
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
        const owner = this.getPlayerByIdOrIndex(gameState, meldOwner);
        if (!owner) {
            return {
                valid: false,
                error: "Meld owner not found",
                errorCode: "PLAYER_NOT_FOUND",
            };
        }
        if (meldIndex < 0 || meldIndex >= owner.melds.length) {
            return {
                valid: false,
                error: "Meld does not exist",
                errorCode: "MELD_NOT_FOUND",
            };
        }
        const meld = owner.melds[meldIndex];
        if (card && !meld_validator_1.MeldValidator.canAddToMeld(card, meld)) {
            return {
                valid: false,
                error: "Card cannot be added to this meld",
                errorCode: "INVALID_ADDITION",
            };
        }
        if (owner.id !== player.id && !player.hasOpened) {
            return {
                valid: false,
                error: "Must open before adding to other players' melds",
                errorCode: "NOT_OPENED",
            };
        }
        return { valid: true };
    }
    static canSkipMeld(playerId, gameState) {
        if (gameState.currentPlayerId !== playerId) {
            return {
                valid: false,
                error: "Not your turn",
                errorCode: "NOT_YOUR_TURN",
            };
        }
        if (gameState.phase !== game_state_types_1.GamePhase.MELD && gameState.phase !== "MELD") {
            return {
                valid: false,
                error: "Not in meld phase",
                errorCode: "WRONG_PHASE",
            };
        }
        return { valid: true };
    }
    static canGoOut(playerId, gameState) {
        const player = this.getPlayer(gameState, playerId);
        if (!player) {
            return {
                valid: false,
                error: "Player not found",
                errorCode: "PLAYER_NOT_FOUND",
            };
        }
        if (!player.hasOpened) {
            return {
                valid: false,
                error: "Must open before going out",
                errorCode: "NOT_OPENED",
            };
        }
        if (player.handSize > 1) {
            return {
                valid: false,
                error: "Must lay down all cards",
                errorCode: "CARDS_REMAINING",
            };
        }
        return { valid: true };
    }
    static getPlayerByIdOrIndex(gameState, playerIdOrIndex) {
        if (typeof playerIdOrIndex === "number") {
            if (playerIdOrIndex < 0 || playerIdOrIndex >= gameState.players.length) {
                return undefined;
            }
            return gameState.players[playerIdOrIndex];
        }
        else {
            return gameState.players.find((p) => p.id === playerIdOrIndex);
        }
    }
    static getPlayer(gameState, playerId) {
        return gameState.players.find((p) => p.id === playerId);
    }
    static getPlayerIndex(gameState, playerId) {
        return gameState.players.findIndex((p) => p.id === playerId);
    }
    static getAllowedActions(playerId, gameState) {
        const actions = [];
        if (gameState.currentPlayerId !== playerId) {
            return [];
        }
        const phase = gameState.phase;
        if (phase === game_state_types_1.GamePhase.DRAW || phase === "DRAW") {
            if (this.canDrawFromDeck(playerId, gameState).valid) {
                actions.push("DRAW_DECK");
            }
            if (this.canDrawFromDiscard(playerId, gameState).valid) {
                actions.push("DRAW_DISCARD");
            }
            if (this.canTakeFinishingCard(playerId, gameState).valid) {
                actions.push("TAKE_FINISHING_CARD");
            }
        }
        else if (phase === game_state_types_1.GamePhase.MELD || phase === "MELD") {
            actions.push("LAY_MELDS");
            actions.push("ADD_TO_MELD");
            actions.push("SKIP_MELD");
        }
        else if (phase === game_state_types_1.GamePhase.DISCARD || phase === "DISCARD") {
            actions.push("DISCARD");
        }
        return actions;
    }
}
exports.MoveValidator = MoveValidator;
//# sourceMappingURL=move-validator.js.map