// shared/validation/score-calculator.ts
export class ScoreCalculator {
    /**
     * Calculate score for a single card
     */
    static calculateCardValue(card: { rank?: string; value?: number; suit?: string }): number {
        const rank = card.rank || card.value?.toString();

        if (!rank) {
            // Joker check
            if (card.suit === 'JOKER_RED' || card.suit === 'JOKER_BLACK') return 25;
            return 0;
        }

        // Joker
        if (rank === 'Joker') return 25;

        // Face cards
        if (['J', 'Q', 'K'].includes(rank)) return 10;

        // Ace
        if (rank === 'A') return 15;

        // Number cards
        const numValue = parseInt(rank);
        return numValue || 5; // Fallback to 5 if parsing fails
    }

    /**
     * Calculate total score for a meld
     */
    static calculateMeldScore(meld: any[]): number {
        return meld.reduce((total, card) => total + this.calculateCardValue(card), 0);
    }

    /**
     * Calculate total score for all melds of a player
     */
    static calculatePlayerScore(melds: any[][]): number {
        return melds.reduce((total, meld) => total + this.calculateMeldScore(meld), 0);
    }
}
