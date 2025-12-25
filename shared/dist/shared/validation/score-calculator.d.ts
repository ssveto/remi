export declare class ScoreCalculator {
    static calculateCardValue(card: {
        rank?: string;
        value?: number;
        suit?: string;
    }): number;
    static calculateMeldScore(meld: any[]): number;
    static calculatePlayerScore(melds: any[][]): number;
}
//# sourceMappingURL=score-calculator.d.ts.map