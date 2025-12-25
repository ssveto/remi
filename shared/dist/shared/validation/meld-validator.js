"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeldValidator = void 0;
const card_types_1 = require("../types/card.types");
const REMI_SET_RULES = {
    maxCardsPerSet: 4,
    maxJokersPerSet: 1,
    openingRequirement: 51,
};
class MeldValidator {
    static isValidSet(cards) {
        if (cards.length < 3 || cards.length > REMI_SET_RULES.maxCardsPerSet) {
            return false;
        }
        const regularCards = cards.filter((c) => !(0, card_types_1.isJoker)(c));
        const jokerCount = cards.length - regularCards.length;
        if (jokerCount > REMI_SET_RULES.maxJokersPerSet)
            return false;
        if (regularCards.length === 0) {
            return false;
        }
        const targetValue = regularCards[0].value;
        const allSameValue = regularCards.every((c) => c.value === targetValue);
        if (!allSameValue) {
            return false;
        }
        const suits = new Set(regularCards.map((c) => c.suit));
        const allDifferentSuits = suits.size === regularCards.length;
        if (!allDifferentSuits) {
            return false;
        }
        return true;
    }
    static isValidRun(cards) {
        if (cards.length < 3)
            return false;
        const regularCards = cards.filter((c) => !(0, card_types_1.isJoker)(c));
        if (regularCards.length === 0)
            return false;
        const firstSuit = regularCards[0].suit;
        if (!regularCards.every((c) => c.suit === firstSuit)) {
            return false;
        }
        for (let i = 0; i < cards.length - 1; i++) {
            if ((0, card_types_1.isJoker)(cards[i]) && (0, card_types_1.isJoker)(cards[i + 1])) {
                return false;
            }
        }
        return this.validatePositionalRun(cards);
    }
    static isValidMeld(cards) {
        return this.isValidSet(cards) || this.isValidRun(cards);
    }
    static splitIntoMeldGroups(cards) {
        const validMelds = [];
        if (cards.length < 3)
            return validMelds;
        let i = 0;
        while (i < cards.length) {
            const result = this.findMeldFromPosition(cards, i);
            if (result) {
                validMelds.push(result.meld);
                i = result.end;
            }
            else {
                i++;
            }
        }
        return validMelds;
    }
    static findMeldFromPosition(cards, start) {
        const potentialSetCards = [cards[start]];
        let setIndex = start + 1;
        while (setIndex < cards.length) {
            const currentCard = cards[setIndex];
            const firstCard = cards[start];
            const sameValue = !(0, card_types_1.isJoker)(currentCard) &&
                !(0, card_types_1.isJoker)(firstCard) &&
                currentCard.value === firstCard.value;
            const isJokerCard = (0, card_types_1.isJoker)(currentCard);
            if (sameValue || isJokerCard) {
                potentialSetCards.push(currentCard);
                setIndex++;
            }
            else {
                break;
            }
        }
        if (potentialSetCards.length >= 3 && potentialSetCards.length <= 4) {
            const nonJokers = potentialSetCards.filter((c) => !(0, card_types_1.isJoker)(c));
            const suits = new Set(nonJokers.map((c) => c.suit));
            if (suits.size === nonJokers.length) {
                const jokerCount = potentialSetCards.length - nonJokers.length;
                if (jokerCount <= 1) {
                    return { meld: [...potentialSetCards], end: setIndex };
                }
            }
        }
        for (let runLength = 3; runLength <= Math.min(13, cards.length - start); runLength++) {
            const runCandidate = cards.slice(start, start + runLength);
            const nonJokersInRun = runCandidate.filter((c) => !(0, card_types_1.isJoker)(c));
            if (nonJokersInRun.length > 0) {
                const firstSuit = nonJokersInRun[0].suit;
                if (!nonJokersInRun.every((c) => c.suit === firstSuit)) {
                    continue;
                }
            }
            if (this.isValidRun(runCandidate)) {
                return { meld: runCandidate, end: start + runLength };
            }
        }
        return null;
    }
    static validatePositionalRun(cards) {
        const indexedRegulars = cards
            .map((card, index) => ({ card, index, isJoker: (0, card_types_1.isJoker)(card) }))
            .filter((item) => !item.isJoker);
        if (indexedRegulars.length < 2)
            return true;
        let isAscending = null;
        for (let i = 0; i < indexedRegulars.length - 1; i++) {
            const current = indexedRegulars[i];
            const next = indexedRegulars[i + 1];
            const jokersBetween = next.index - current.index - 1;
            const requiredGap = jokersBetween + 1;
            const v1 = current.card.value;
            const v2 = next.card.value;
            let diff = v2 - v1;
            let validStep = false;
            let stepDirectionIsAscending = true;
            if (Math.abs(diff) === requiredGap) {
                validStep = true;
                stepDirectionIsAscending = diff > 0;
            }
            if (!validStep && (v1 === 1 || v2 === 1)) {
                const v1High = v1 === 1 ? 14 : v1;
                const v2High = v2 === 1 ? 14 : v2;
                const diffHigh = v2High - v1High;
                if (Math.abs(diffHigh) === requiredGap) {
                    validStep = true;
                    stepDirectionIsAscending = diffHigh > 0;
                }
            }
            if (!validStep)
                return false;
            if (isAscending === null) {
                isAscending = stepDirectionIsAscending;
            }
            else if (isAscending !== stepDirectionIsAscending) {
                return false;
            }
        }
        const firstRegular = indexedRegulars[0];
        const leadingJokers = firstRegular.index;
        if (leadingJokers > 0) {
            let firstRegularValue = firstRegular.card.value;
            const lastRegular = indexedRegulars[indexedRegulars.length - 1];
            const hasHighAce = firstRegular.card.value === 1 && lastRegular.card.value >= 11;
            if (hasHighAce) {
                firstRegularValue = 14;
            }
            const firstJokerValue = firstRegularValue - leadingJokers;
            if (firstJokerValue < 1) {
                return false;
            }
        }
        const lastRegular = indexedRegulars[indexedRegulars.length - 1];
        const trailingJokers = cards.length - 1 - lastRegular.index;
        if (trailingJokers > 0) {
            let lastRegularValue = lastRegular.card.value;
            const firstRegularCheck = indexedRegulars[0];
            const hasHighAce = lastRegular.card.value === 1 && firstRegularCheck.card.value >= 11;
            if (hasHighAce) {
                lastRegularValue = 14;
            }
            const lastJokerValue = lastRegularValue + trailingJokers;
            if (lastJokerValue > 14) {
                return false;
            }
        }
        return true;
    }
    static calculateMeldScore(meld) {
        return meld.reduce((sum, card) => {
            if ((0, card_types_1.isJoker)(card)) {
                return sum + this.getJokerValueInMeld(card, meld);
            }
            return sum + (0, card_types_1.getCardPoints)(card);
        }, 0);
    }
    static getJokerValueInMeld(joker, meld) {
        const regularCards = meld.filter((c) => !(0, card_types_1.isJoker)(c));
        if (regularCards.length === 0)
            return 0;
        if (this.isValidSet(meld)) {
            return (0, card_types_1.getCardPoints)(regularCards[0]);
        }
        if (this.isValidRun(meld)) {
            return this.getJokerValueInRun(joker, meld, regularCards);
        }
        return 0;
    }
    static getJokerValueInRun(joker, meld, regularCards) {
        const sortedValues = regularCards.map((c) => c.value).sort((a, b) => a - b);
        const sequence = this.buildSequenceWithJokers(meld, sortedValues);
        const jokerPositionInMeld = meld.indexOf(joker);
        const jokerValue = sequence[jokerPositionInMeld];
        return (0, card_types_1.getCardPoints)({ value: jokerValue });
    }
    static buildSequenceWithJokers(meld, sortedValues) {
        const minValue = sortedValues[0];
        let leadingJokers = 0;
        for (const card of meld) {
            if ((0, card_types_1.isJoker)(card)) {
                leadingJokers++;
            }
            else {
                break;
            }
        }
        let startValue;
        if (sortedValues[0] === 1 && sortedValues[sortedValues.length - 1] > 10) {
            startValue = 14 - meld.length + 1;
        }
        else {
            startValue = minValue - leadingJokers;
        }
        const sequence = [];
        let currentValue = startValue;
        for (let i = 0; i < meld.length; i++) {
            sequence.push(currentValue);
            currentValue++;
        }
        return sequence;
    }
    static sortMeldForDisplay(meld) {
        if (this.isValidRun(meld)) {
            return this.sortRunCards(meld);
        }
        return [...meld];
    }
    static validateMelds(cards, hasOpened, openingRequirement = 51) {
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
        const validMelds = this.splitIntoMeldGroups(cards);
        const cardsInMelds = validMelds.flat();
        const invalidCards = cards.filter((card) => !cardsInMelds.some((c) => c.id === card.id));
        const meldScores = validMelds.map((meld) => this.calculateMeldScore(meld));
        const totalScore = meldScores.reduce((sum, score) => sum + score, 0);
        const meetsOpenRequirement = hasOpened || totalScore >= openingRequirement;
        const minimumNeeded = hasOpened
            ? 0
            : Math.max(0, openingRequirement - totalScore);
        const isValid = validMelds.length > 0 && invalidCards.length === 0;
        const error = !isValid
            ? invalidCards.length > 0
                ? "Some cards do not form valid melds"
                : "No valid melds found"
            : undefined;
        const validMeldsAsCards = validMelds.map((meld) => meld.map((card) => ({ ...card })));
        const invalidCardsAsCards = invalidCards.map(card => card);
        return {
            isValid,
            error,
            selectedCards: cards,
            validMelds: validMeldsAsCards,
            invalidCards: invalidCardsAsCards,
            totalScore,
            meldScores,
            meetsOpenRequirement,
            minimumNeeded,
            hasOpened,
        };
    }
    static findBestMeldCombination(cards) {
        const melds = [];
        const remainingCards = [...cards];
        const allPossibleMelds = this.findAllPossibleMelds(remainingCards);
        allPossibleMelds.sort((a, b) => this.calculateMeldScore(b) - this.calculateMeldScore(a));
        for (const meld of allPossibleMelds) {
            const canUseMeld = meld.every((card) => remainingCards.some((rc) => rc.id === card.id));
            if (canUseMeld) {
                melds.push(meld);
                for (const card of meld) {
                    const index = remainingCards.findIndex((rc) => rc.id === card.id);
                    if (index !== -1) {
                        remainingCards.splice(index, 1);
                    }
                }
            }
        }
        return melds;
    }
    static findAllPossibleMelds(cards) {
        const melds = [];
        for (let size = 3; size <= cards.length; size++) {
            const combinations = this.getCombinations(cards, size);
            for (const combo of combinations) {
                if (this.isValidSet(combo) || this.isValidRun(combo)) {
                    melds.push(combo);
                }
            }
        }
        return melds;
    }
    static getCombinations(arr, size) {
        if (size > arr.length)
            return [];
        if (size === 1)
            return arr.map((item) => [item]);
        const result = [];
        for (let i = 0; i < arr.length - size + 1; i++) {
            const head = arr[i];
            const tailCombinations = this.getCombinations(arr.slice(i + 1), size - 1);
            tailCombinations.forEach((tail) => result.push([head, ...tail]));
        }
        return result;
    }
    static canAddToMeld(card, meld) {
        const testMeldEnd = [...meld, card];
        if (this.isValidSet(testMeldEnd) || this.isValidRun(testMeldEnd)) {
            return true;
        }
        const testMeldBegin = [card, ...meld];
        if (this.isValidSet(testMeldBegin) || this.isValidRun(testMeldBegin)) {
            return true;
        }
        return false;
    }
    static canCardsBeAdjacent(card1, card2) {
        if ((0, card_types_1.isJoker)(card1) && (0, card_types_1.isJoker)(card2)) {
            return false;
        }
        if ((0, card_types_1.isJoker)(card1) || (0, card_types_1.isJoker)(card2)) {
            return true;
        }
        const sameSuit = card1.suit === card2.suit;
        const sameValue = card1.value === card2.value;
        return sameSuit || sameValue;
    }
    static sortRunCards(cards) {
        if (cards.length === 0)
            return [];
        const indexed = cards.map((card, index) => ({
            card,
            originalIndex: index,
            isJoker: (0, card_types_1.isJoker)(card),
        }));
        const jokers = indexed.filter((item) => item.isJoker);
        const regulars = indexed.filter((item) => !item.isJoker);
        if (regulars.length === 0)
            return cards;
        const hasHighCards = regulars.some((r) => r.card.value >= 11);
        regulars.sort((a, b) => {
            const aVal = a.card.value === 1 && hasHighCards ? 14 : a.card.value;
            const bVal = b.card.value === 1 && hasHighCards ? 14 : b.card.value;
            return aVal - bVal;
        });
        const result = [];
        let jokerIdx = 0;
        for (let i = 0; i < regulars.length; i++) {
            const current = regulars[i].card;
            const next = regulars[i + 1]?.card;
            result.push(current);
            if (next) {
                const currentVal = current.value === 1 && next.value >= 11 ? 14 : current.value;
                const nextVal = next.value === 1 && current.value >= 11 ? 14 : next.value;
                const gap = nextVal - currentVal - 1;
                const jokersToInsert = Math.min(gap, jokers.length - jokerIdx);
                for (let j = 0; j < jokersToInsert; j++) {
                    result.push(jokers[jokerIdx++].card);
                }
            }
        }
        while (jokerIdx < jokers.length) {
            result.push(jokers[jokerIdx++].card);
        }
        return result;
    }
    static canCardReplaceJoker(card, joker, meld) {
        const regularCards = meld.filter((c) => !(0, card_types_1.isJoker)(c));
        if (regularCards.length === 0)
            return false;
        const allSameValue = regularCards.every((c) => c.value === regularCards[0].value);
        const allDifferentSuits = new Set(regularCards.map((c) => c.suit)).size === regularCards.length;
        if (allSameValue && allDifferentSuits) {
            if (regularCards.length === 3) {
                const isCorrectValue = card.value === regularCards[0].value;
                const isUniqueSuit = !regularCards.some((c) => c.suit === card.suit);
                return isCorrectValue && isUniqueSuit;
            }
            return false;
        }
        const allSameSuit = regularCards.every((c) => c.suit === regularCards[0].suit);
        if (allSameSuit) {
            const sortedMeld = this.sortRunCards(meld);
            const jokerRepresentsValue = this.getJokerRepresentedValueInRun(joker, sortedMeld);
            const isCorrectSuit = card.suit === regularCards[0].suit;
            const isCorrectValue = card.value === jokerRepresentsValue;
            return isCorrectSuit && isCorrectValue;
        }
        return false;
    }
    static getJokerRepresentedValueInRun(joker, meld) {
        const regularCards = meld.filter((c) => !(0, card_types_1.isJoker)(c));
        const sortedValues = regularCards.map((c) => c.value).sort((a, b) => a - b);
        const sequence = this.buildSequenceWithJokers(meld, sortedValues);
        const jokerPositionInMeld = meld.findIndex((c) => c.id === joker.id);
        return sequence[jokerPositionInMeld];
    }
    static getAddPosition(card, meld) {
        const testMeldEnd = [...meld, card];
        if (this.isValidSet(testMeldEnd) || this.isValidRun(testMeldEnd)) {
            return "end";
        }
        const testMeldBegin = [card, ...meld];
        if (this.isValidSet(testMeldBegin) || this.isValidRun(testMeldBegin)) {
            return "start";
        }
        return null;
    }
    static calculateDeadwood(cards) {
        return cards.reduce((sum, card) => sum + (0, card_types_1.getCardPoints)(card), 0);
    }
    static getMeldType(meld) {
        if (this.isValidSet(meld))
            return "SET";
        if (this.isValidRun(meld))
            return "RUN";
        return null;
    }
}
exports.MeldValidator = MeldValidator;
//# sourceMappingURL=meld-validator.js.map