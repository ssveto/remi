"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreCalculator = void 0;
class ScoreCalculator {
    static calculateCardValue(card) {
        const rank = card.rank || card.value?.toString();
        if (!rank) {
            if (card.suit === 'JOKER_RED' || card.suit === 'JOKER_BLACK')
                return 25;
            return 0;
        }
        if (rank === 'Joker')
            return 25;
        if (['J', 'Q', 'K'].includes(rank))
            return 10;
        if (rank === 'A')
            return 15;
        const numValue = parseInt(rank);
        return numValue || 5;
    }
    static calculateMeldScore(meld) {
        return meld.reduce((total, card) => total + this.calculateCardValue(card), 0);
    }
    static calculatePlayerScore(melds) {
        return melds.reduce((total, meld) => total + this.calculateMeldScore(meld), 0);
    }
}
exports.ScoreCalculator = ScoreCalculator;
//# sourceMappingURL=score-calculator.js.map