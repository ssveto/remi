"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiplayerValidator = void 0;
const meld_validator_1 = require("./meld-validator");
const move_validator_1 = require("./move-validator");
class MultiplayerValidator {
    static validatePlayerAction(action, playerId, gameState, payload) {
        switch (action) {
            case 'DRAW_DECK':
                return move_validator_1.MoveValidator.canDrawFromDeck(playerId, gameState);
            case 'DRAW_DISCARD':
                return move_validator_1.MoveValidator.canDrawFromDiscard(playerId, gameState);
            case 'LAY_MELDS':
                if (!payload?.melds)
                    return { valid: false, error: 'No melds provided' };
                return move_validator_1.MoveValidator.canLayMelds(playerId, payload.melds, gameState, 51);
            case 'ADD_TO_MELD':
                if (!payload)
                    return { valid: false, error: 'No payload' };
                return move_validator_1.MoveValidator.canAddToMeld(playerId, payload.cardId, payload.meldOwner, payload.meldIndex, gameState);
            default:
                return { valid: false, error: 'Unknown action' };
        }
    }
    static validateCardSelection(cards) {
        const isSet = meld_validator_1.MeldValidator.isValidSet(cards);
        const isRun = meld_validator_1.MeldValidator.isValidRun(cards);
        const isValid = isSet || isRun;
        const score = isValid ? meld_validator_1.MeldValidator.calculateMeldScore(cards) : 0;
        return { isValid, isSet, isRun, score };
    }
}
exports.MultiplayerValidator = MultiplayerValidator;
//# sourceMappingURL=multiplayer-adapter.js.map