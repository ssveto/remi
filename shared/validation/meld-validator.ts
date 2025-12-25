// shared/validation/meld-validator.ts
import type { Card } from "../types/card.types";
import { isJoker, getCardPoints } from "../types/card.types";
import type { MeldValidationResult } from "../types/game-state.types";
import type { CardData } from "../types/card-data.types";

/**
 * Pure validation functions for melds.
 * All methods are static - no dependencies on game state.
 */

const REMI_SET_RULES = {
  maxCardsPerSet: 4,
  maxJokersPerSet: 1,
  openingRequirement: 51,
} as const;

export class MeldValidator {
  /**
   * Validate if cards form a valid SET (same value, different suits)
   * Minimum 3 cards required
   */
  static isValidSet(cards: CardData[]): boolean {
    // Must be 3 or 4 cards
    if (cards.length < 3 || cards.length > REMI_SET_RULES.maxCardsPerSet) {
      return false;
    }

    const regularCards = cards.filter((c) => !isJoker(c));
    const jokerCount = cards.length - regularCards.length;

    // RULE: Maximum 1 joker per SET
    if (jokerCount > REMI_SET_RULES.maxJokersPerSet) return false;

    // Must have at least one regular card
    if (regularCards.length === 0) {
      return false;
    }

    // All regular cards must have same value
    const targetValue = regularCards[0].value;
    const allSameValue = regularCards.every((c) => c.value === targetValue);
    if (!allSameValue) {
      return false;
    }

    // All regular cards must have different suits
    const suits = new Set(regularCards.map((c) => c.suit));
    const allDifferentSuits = suits.size === regularCards.length;
    if (!allDifferentSuits) {
      return false;
    }

    return true;
  }

  /**
   * Validate if cards form a valid RUN (consecutive values, same suit)
   * Minimum 3 cards required
   */
  static isValidRun(cards: CardData[]): boolean {
    if (cards.length < 3) return false;

    const regularCards = cards.filter((c) => !isJoker(c));

    // Need at least one regular card to determine suit
    if (regularCards.length === 0) return false;

    // All regular cards must have same suit
    const firstSuit = regularCards[0].suit;
    if (!regularCards.every((c) => c.suit === firstSuit)) {
      return false;
    }

    // Can't have adjacent jokers
    for (let i = 0; i < cards.length - 1; i++) {
      if (isJoker(cards[i]) && isJoker(cards[i + 1])) {
        return false;
      }
    }

    // Validate the sequence
    return this.validatePositionalRun(cards);
  }

  /**
   * Check if cards form any valid meld (set or run)
   */
  static isValidMeld(cards: CardData[]): boolean {
    return this.isValidSet(cards) || this.isValidRun(cards);
  }

  static splitIntoMeldGroups(cards: CardData[]): CardData[][] {
    const n = cards.length;
    if (n < 3) return [];

    // We want to maximize: (number of cards used, number of melds)
    const dp = new Array(n + 1);
    dp[0] = { cardsUsed: 0, meldCount: 0, melds: [] };

    for (let i = 1; i <= n; i++) {
      // Option 1: Don't use card i-1
      let best = {
        cardsUsed: dp[i - 1].cardsUsed,
        meldCount: dp[i - 1].meldCount,
        melds: [...dp[i - 1].melds],
      };

      // Option 2: Try to end a meld at i-1
      for (let j = Math.max(0, i - 13); j <= i - 3; j++) {
        const candidate = cards.slice(j, i);
        const length = i - j;

        // Check if valid set or run
        let isValid = false;

        if (this.isValidSet(candidate)) {
          isValid = true;
        } else {
          // Check for run with suit constraint
          const nonJokers = candidate.filter((c) => !isJoker(c));
          if (nonJokers.length > 0) {
            const firstSuit = nonJokers[0].suit;
            if (
              nonJokers.every((c) => c.suit === firstSuit) &&
              this.isValidRun(candidate)
            ) {
              isValid = true;
            }
          }
        }

        if (isValid) {
          const candidateCardsUsed = dp[j].cardsUsed + length;
          const candidateMeldCount = dp[j].meldCount + 1;

          // Prefer more cards used, then more melds
          if (
            candidateCardsUsed > best.cardsUsed ||
            (candidateCardsUsed === best.cardsUsed &&
              candidateMeldCount > best.meldCount)
          ) {
            best = {
              cardsUsed: candidateCardsUsed,
              meldCount: candidateMeldCount,
              melds: [...dp[j].melds, candidate],
            };
          }
        }
      }

      dp[i] = best;
    }

    return dp[n].melds;
  }

  /**
   * Validates that the EXACT sequence provided is valid.
   * Rule: Rank(Next) - Rank(Current) == NumJokersInBetween + 1
   */
  private static validatePositionalRun(cards: CardData[]): boolean {
    // Filter out jokers but keep their original indices to calculate gaps
    const indexedRegulars = cards
      .map((card, index) => ({ card, index, isJoker: isJoker(card) }))
      .filter((item) => !item.isJoker);

    // If 0 or 1 regular card, it's valid (e.g., J-Joker-Joker or Joker-5-Joker)
    if (indexedRegulars.length < 2) return true;

    // Determine if ascending or descending based on first gap
    let isAscending: boolean | null = null;

    // CRITICAL FIX: Track Ace interpretation - once decided, must be consistent
    // null = not decided, true = high ace (14), false = low ace (1)
    let useHighAce: boolean | null = null;

    for (let i = 0; i < indexedRegulars.length - 1; i++) {
      const current = indexedRegulars[i];
      const next = indexedRegulars[i + 1];

      // "N" is the number of jokers physically sitting between these two cards
      const jokersBetween = next.index - current.index - 1;
      const requiredGap = jokersBetween + 1;

      const v1 = current.card.value;
      const v2 = next.card.value;

      let validStep = false;
      let stepDirectionIsAscending = true;
      let thisStepUsesHighAce: boolean | null = null;

      // --- CHECK 1: Try Standard Low Ace (Ace=1) ---
      const diff = v2 - v1;
      if (Math.abs(diff) === requiredGap) {
        validStep = true;
        stepDirectionIsAscending = diff > 0;
        // If this step involves an Ace and works with low-ace, mark it
        if (v1 === 1 || v2 === 1) {
          thisStepUsesHighAce = false;
        }
      }

      // --- CHECK 2: Try High Ace (Ace=14) if standard failed or if we're committed to high ace ---
      if (!validStep && (v1 === 1 || v2 === 1)) {
        const v1High = v1 === 1 ? 14 : v1;
        const v2High = v2 === 1 ? 14 : v2;
        const diffHigh = v2High - v1High;

        if (Math.abs(diffHigh) === requiredGap) {
          validStep = true;
          stepDirectionIsAscending = diffHigh > 0;
          thisStepUsesHighAce = true;
        }
      }

      if (!validStep) return false; // Gap is wrong

      // --- CHECK 3: Enforce Ace Interpretation Consistency ---
      // Once we commit to high-ace or low-ace, we MUST stick with it
      if (thisStepUsesHighAce !== null) {
        if (useHighAce === null) {
          // First time seeing an Ace - commit to this interpretation
          useHighAce = thisStepUsesHighAce;
        } else if (useHighAce !== thisStepUsesHighAce) {
          // CONFLICT: Trying to use different Ace interpretation!
          // This catches cases like K-A-2 where K-A uses high and A-2 uses low
          return false;
        }
      }

      // --- CHECK 4: Enforce Monotonicity (all ascending or all descending) ---
      if (isAscending === null) {
        isAscending = stepDirectionIsAscending;
      } else if (isAscending !== stepDirectionIsAscending) {
        return false; // Changed direction
      }
    }

    // --- CHECK 5: Validate jokers at the ends don't represent invalid values ---
    const firstRegular = indexedRegulars[0];
    const lastRegular = indexedRegulars[indexedRegulars.length - 1];

    // Determine if we should use high ace for boundary checks
    // Use committed value if set, otherwise infer from card values
    const effectiveUseHighAce =
      useHighAce ??
      // If no ace was involved in the middle, check if it's a high sequence
      ((firstRegular.card.value >= 11 || lastRegular.card.value >= 11) &&
        (firstRegular.card.value === 1 || lastRegular.card.value === 1));

    // Check leading jokers (before first regular card)
    const leadingJokers = firstRegular.index;
    if (leadingJokers > 0) {
      let firstRegularValue = firstRegular.card.value;

      if (effectiveUseHighAce && firstRegularValue === 1) {
        firstRegularValue = 14;
      }

      const firstJokerValue = firstRegularValue - leadingJokers;

      // Joker can't represent card less than 1
      if (firstJokerValue < 1) {
        return false;
      }
    }

    // Check trailing jokers (after last regular card)
    const trailingJokers = cards.length - 1 - lastRegular.index;
    if (trailingJokers > 0) {
      let lastRegularValue = lastRegular.card.value;

      if (effectiveUseHighAce && lastRegularValue === 1) {
        lastRegularValue = 14;
      }

      const lastJokerValue = lastRegularValue + trailingJokers;

      // Joker can't represent card greater than 14 (High Ace)
      if (lastJokerValue > 14) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate the score of a meld
   */
  static calculateMeldScore(meld: CardData[]): number {
    return meld.reduce((sum, card) => {
      if (isJoker(card)) {
        return sum + this.getJokerValueInMeld(card, meld);
      }
      return sum + getCardPoints(card);
    }, 0);
  }

  /**
   * Get the point value of a joker within a specific meld
   */
  static getJokerValueInMeld(joker: CardData, meld: CardData[]): number {
    const regularCards = meld.filter((c) => !isJoker(c));

    if (regularCards.length === 0) return 0;

    // In a SET: joker takes value of the set
    if (this.isValidSet(meld)) {
      return getCardPoints(regularCards[0]);
    }

    // In a RUN: calculate joker's position value
    if (this.isValidRun(meld)) {
      return this.getJokerValueInRun(joker, meld, regularCards);
    }

    return 0;
  }

  /**
   * Get the value of a joker in a run
   */
  static getJokerValueInRun(
    joker: CardData,
    meld: CardData[],
    regularCards?: CardData[] // Make optional
  ): number {
    const regCards = regularCards || meld.filter((c) => !isJoker(c));
    if (regCards.length === 0) return 0;

    const sortedValues = regCards.map((c) => c.value).sort((a, b) => a - b);
    const sequence = this.buildSequenceWithJokers(meld, sortedValues);

    const jokerPositionInMeld = meld.findIndex((c) => c.id === joker.id);
    if (jokerPositionInMeld === -1) return 0;

    const jokerValue = sequence[jokerPositionInMeld];
    return getCardPoints({ value: jokerValue } as CardData);
  }

  /**
   * Build a complete sequence showing what value each position represents
   */
  static buildSequenceWithJokers(
    meld: CardData[],
    sortedValues: number[]
  ): number[] {
    const minValue = sortedValues[0];

    // Count leading jokers (before first regular card)
    let leadingJokers = 0;
    for (const card of meld) {
      if (isJoker(card)) {
        leadingJokers++;
      } else {
        break; // Found first regular card
      }
    }

    // Handle high ace sequences (Q-K-A)
    let startValue;
    if (sortedValues[0] === 1 && sortedValues[sortedValues.length - 1] > 10) {
      startValue = 14 - meld.length + 1;
    } else {
      startValue = minValue - leadingJokers;
    }

    // Build sequence
    const sequence: number[] = [];
    let currentValue = startValue;

    for (let i = 0; i < meld.length; i++) {
      sequence.push(currentValue);
      currentValue++;
    }

    return sequence;
  }

  static sortMeldForDisplay(meld: CardData[]): CardData[] {
    // Check if it's a run (needs sorting)
    if (this.isValidRun(meld)) {
      return this.sortRunCards(meld);
    }
    // Sets don't need sorting, return as-is
    return [...meld];
  }

  /**
   * Validate a collection of cards and return detailed results
   */
  static validateMelds(
    cards: CardData[],
    hasOpened: boolean,
    openingRequirement: number = 51
  ): MeldValidationResult {
    if (cards.length === 0) {
      return {
        isValid: false,
        error: "No cards selected",
        selectedCards: [],
        validMelds: [],
        invalidCards: [],
        totalScore: 0,
        meldScores: [],
        meetsOpenRequirement: false,
        minimumNeeded: openingRequirement,
        hasOpened,
      };
    }
    // Find all valid melds in the selected cards
    const validMelds = this.splitIntoMeldGroups(cards);
    // Find cards that aren't in any meld
    const cardsInMelds = validMelds.flat();
    const invalidCards = cards.filter(
      (card) => !cardsInMelds.some((c) => c.id === card.id)
    );

    // Calculate scores
    const meldScores = validMelds.map((meld) => this.calculateMeldScore(meld));
    const totalScore = meldScores.reduce((sum, score) => sum + score, 0);

    // Check opening requirement
    const meetsOpenRequirement = hasOpened || totalScore >= openingRequirement;
    const minimumNeeded = hasOpened
      ? 0
      : Math.max(0, openingRequirement - totalScore);

    // Determine overall validity
    const isValid = validMelds.length > 0 && invalidCards.length === 0;
    const error = !isValid
      ? invalidCards.length > 0
        ? "Some cards do not form valid melds"
        : "No valid melds found"
      : undefined;

    // Convert back to Card[] for result
    const validMeldsAsCards: Card[][] = validMelds.map((meld) =>
      meld.map((card) => ({ ...card } as Card))
    );

    const invalidCardsAsCards = invalidCards.map((card) => card as Card);
    return {
      isValid,
      error,
      selectedCards: cards as Card[],
      validMelds: validMeldsAsCards,
      invalidCards: invalidCardsAsCards,
      totalScore,
      meldScores,
      meetsOpenRequirement,
      minimumNeeded,
      hasOpened,
    };
  }


  /**
   * Check if a card can be added to an existing meld
   */
  static canAddToMeld(card: CardData, meld: CardData[]): boolean {
    // Try adding to the end

    const regularCards = meld.filter((c) => !isJoker(c));
    const couldBeRun =
      regularCards.length > 0 &&
      regularCards.every((c) => c.suit === regularCards[0].suit);

    // Sort if it's a run to ensure proper order
    const sortedMeld = couldBeRun ? this.sortRunCards(meld) : meld;
    const testMeldEnd = [...sortedMeld, card];
    if (this.isValidSet(testMeldEnd) || this.isValidRun(testMeldEnd)) {
      return true;
    }

    // Try adding to the beginning
    const testMeldBegin = [card, ...sortedMeld];
    if (this.isValidSet(testMeldBegin) || this.isValidRun(testMeldBegin)) {
      return true;
    }

    return false;
  }

  static canCardsBeAdjacent(card1: CardData, card2: CardData): boolean {
    // Rule 1: Cannot have adjacent jokers
    if (isJoker(card1) && isJoker(card2)) {
      return false;
    }

    // Rule 2: If one is joker, allow it (joker is flexible)
    if (isJoker(card1) || isJoker(card2)) {
      return true;
    }

    // Rule 3: Both regular cards - they must be compatible
    const sameSuit = card1.suit === card2.suit;
    const sameValue = card1.value === card2.value;

    return sameSuit || sameValue;
  }
  static sortRunCards(cards: CardData[]): CardData[] {
    if (cards.length === 0) return [];

    // Create array with indices to track joker positions
    const indexed = cards.map((card, index) => ({
      card,
      originalIndex: index,
      isJoker: isJoker(card),
    }));

    // Separate jokers and regular cards
    const jokers = indexed.filter((item) => item.isJoker);
    const regulars = indexed.filter((item) => !item.isJoker);

    if (regulars.length === 0) return cards;

    // Sort regular cards by value with Ace handling
    const hasHighCards = regulars.some((r) => r.card.value >= 11);
    regulars.sort((a, b) => {
      const aVal = a.card.value === 1 && hasHighCards ? 14 : a.card.value;
      const bVal = b.card.value === 1 && hasHighCards ? 14 : b.card.value;
      return aVal - bVal;
    });

    // Reconstruct with jokers in logical positions
    const result: CardData[] = [];
    let jokerIdx = 0;

    for (let i = 0; i < regulars.length; i++) {
      const current = regulars[i].card;
      const next = regulars[i + 1]?.card;

      result.push(current);

      if (next) {
        // Calculate gap between current and next card
        const currentVal =
          current.value === 1 && next.value >= 11 ? 14 : current.value;
        const nextVal =
          next.value === 1 && current.value >= 11 ? 14 : next.value;
        const gap = nextVal - currentVal - 1;

        // Insert jokers to fill the gap
        const jokersToInsert = Math.min(gap, jokers.length - jokerIdx);
        for (let j = 0; j < jokersToInsert; j++) {
          result.push(jokers[jokerIdx++].card);
        }
      }
    }

    // Add any remaining jokers at the end
    while (jokerIdx < jokers.length) {
      result.push(jokers[jokerIdx++].card);
    }

    return result;
  }

  static canCardReplaceJoker(
    card: CardData,
    joker: CardData,
    meld: CardData[]
  ): boolean {
    const regularCards = meld.filter((c) => !isJoker(c));
    if (regularCards.length === 0) return false;

    // Check if it's a SET
    const allSameValue = regularCards.every(
      (c) => c.value === regularCards[0].value
    );
    const allDifferentSuits =
      new Set(regularCards.map((c) => c.suit)).size === regularCards.length;

    if (allSameValue && allDifferentSuits) {
      // Check if we have 3 regular cards already
      if (regularCards.length === 3) {
        // Adding 4th card - check if it completes the set
        const isCorrectValue = card.value === regularCards[0].value;
        const isUniqueSuit = !regularCards.some((c) => c.suit === card.suit);
        return isCorrectValue && isUniqueSuit;
      }
      return false;
    }

    // Check if it's a RUN
    const allSameSuit = regularCards.every(
      (c) => c.suit === regularCards[0].suit
    );
    if (allSameSuit) {
      const sortedMeld = this.sortRunCards(meld);
      const jokerRepresentsValue = this.getJokerRepresentedValueInRun(
        joker,
        sortedMeld
      );

      const isCorrectSuit = card.suit === regularCards[0].suit;
      const isCorrectValue = card.value === jokerRepresentsValue;

      return isCorrectSuit && isCorrectValue;
    }

    return false;
  }

  static getJokerRepresentedValueInRun(
    joker: CardData,
    meld: CardData[]
  ): number {
    const regularCards = meld.filter((c) => !isJoker(c));
    const sortedValues = regularCards.map((c) => c.value).sort((a, b) => a - b);

    // Build the complete sequence
    const sequence = this.buildSequenceWithJokers(meld, sortedValues);

    // Find joker's position and return its value
    const jokerPositionInMeld = meld.findIndex((c) => c.id === joker.id);
    return sequence[jokerPositionInMeld];
  }

  /**
   * Determine where a card can be added to a meld
   * Returns 'start', 'end', or null
   */
  static getAddPosition(
    card: CardData,
    meld: CardData[]
  ): "start" | "end" | null {
    // Try adding to the end

    const regularCards = meld.filter((c) => !isJoker(c));
    const couldBeRun =
      regularCards.length > 0 &&
      regularCards.every((c) => c.suit === regularCards[0].suit);

    // Sort if it's a run to ensure proper order
    const sortedMeld = couldBeRun ? this.sortRunCards(meld) : meld;
    const testMeldEnd = [...sortedMeld, card];
    if (this.isValidSet(testMeldEnd) || this.isValidRun(testMeldEnd)) {
      return "end";
    }

    // Try adding to the beginning
    const testMeldBegin = [card, ...sortedMeld];
    if (this.isValidSet(testMeldBegin) || this.isValidRun(testMeldBegin)) {
      return "start";
    }

    return null;
  }

  /**
   * Calculate deadwood value (cards not in melds)
   */
  static calculateDeadwood(cards: CardData[]): number {
    return cards.reduce((sum, card) => sum + getCardPoints(card), 0);
  }

  /**
   * Get the type of a valid meld
   */
  static getMeldType(meld: CardData[]): "SET" | "RUN" | null {
    if (this.isValidSet(meld)) return "SET";
    if (this.isValidRun(meld)) return "RUN";
    return null;
  }
}
