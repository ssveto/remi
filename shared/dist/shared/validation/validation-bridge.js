"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationBridge = void 0;
const card_data_types_1 = require("../types/card-data.types");
const meld_validator_1 = require("./meld-validator");
class ValidationBridge {
    static isValidSet(cards) {
        return meld_validator_1.MeldValidator.isValidSet((0, card_data_types_1.cardsToCardData)(cards));
    }
    static isValidRun(cards) {
        return meld_validator_1.MeldValidator.isValidRun((0, card_data_types_1.cardsToCardData)(cards));
    }
    static isValidMeld(cards) {
        return meld_validator_1.MeldValidator.isValidMeld((0, card_data_types_1.cardsToCardData)(cards));
    }
    static mapCardDataToCards(cardDataArray, originalCards) {
        const cardMap = new Map(originalCards.map(card => [card.id, card]));
        return cardDataArray.map(cardData => {
            const card = cardMap.get(cardData.id);
            if (!card) {
                throw new Error(`Card ${cardData.id} not found in original array`);
            }
            return card;
        });
    }
    static splitIntoMeldGroups(cards) {
        const cardData = (0, card_data_types_1.cardsToCardData)(cards);
        const meldGroups = meld_validator_1.MeldValidator.splitIntoMeldGroups(cardData);
        return meldGroups.map(meldGroup => this.mapCardDataToCards(meldGroup, cards));
    }
    static findBestMeldCombination(cards) {
        const cardData = (0, card_data_types_1.cardsToCardData)(cards);
        const bestMelds = meld_validator_1.MeldValidator.findBestMeldCombination(cardData);
        return bestMelds.map(meld => this.mapCardDataToCards(meld, cards));
    }
    static sortRunCards(cards) {
        const cardData = (0, card_data_types_1.cardsToCardData)(cards);
        const sorted = meld_validator_1.MeldValidator.sortRunCards(cardData);
        return this.mapCardDataToCards(sorted, cards);
    }
    static sortMeldForDisplay(meld) {
        const cardData = (0, card_data_types_1.cardsToCardData)(meld);
        const sorted = meld_validator_1.MeldValidator.sortMeldForDisplay(cardData);
        return this.mapCardDataToCards(sorted, meld);
    }
    static canCardReplaceJoker(card, joker, meld) {
        const cardData = (0, card_data_types_1.cardsToCardData)([card])[0];
        const jokerData = (0, card_data_types_1.cardsToCardData)([joker])[0];
        const meldData = (0, card_data_types_1.cardsToCardData)(meld);
        return meld_validator_1.MeldValidator.canCardReplaceJoker(cardData, jokerData, meldData);
    }
    static canCardsBeAdjacent(card1, card2) {
        const card1Data = (0, card_data_types_1.cardsToCardData)([card1])[0];
        const card2Data = (0, card_data_types_1.cardsToCardData)([card2])[0];
        return meld_validator_1.MeldValidator.canCardsBeAdjacent(card1Data, card2Data);
    }
    static calculateMeldScore(meld) {
        return meld_validator_1.MeldValidator.calculateMeldScore((0, card_data_types_1.cardsToCardData)(meld));
    }
    static validateMelds(cards, hasOpened, openingRequirement = 51) {
        const cardData = (0, card_data_types_1.cardsToCardData)(cards);
        const result = meld_validator_1.MeldValidator.validateMelds(cardData, hasOpened, openingRequirement);
        return {
            ...result,
            selectedCards: cards,
            validMelds: result.validMelds.map(meld => meld.map(cardData => this.findCardById(cards, cardData.id))),
            invalidCards: result.invalidCards.map(cardData => this.findCardById(cards, cardData.id)),
        };
    }
    static findCardById(cards, id) {
        const card = cards.find((c) => c.id === id);
        if (!card)
            throw new Error(`Card ${id} not found`);
        return card;
    }
    static canAddToMeld(card, meld) {
        return meld_validator_1.MeldValidator.getAddPosition((0, card_data_types_1.cardsToCardData)([card])[0], (0, card_data_types_1.cardsToCardData)(meld));
    }
    static getMeldType(meld) {
        return meld_validator_1.MeldValidator.getMeldType((0, card_data_types_1.cardsToCardData)(meld));
    }
}
exports.ValidationBridge = ValidationBridge;
//# sourceMappingURL=validation-bridge.js.map