"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJoker = isJoker;
exports.getCardPoints = getCardPoints;
exports.getCardName = getCardName;
exports.cardsEqual = cardsEqual;
exports.cloneCard = cloneCard;
exports.isCardData = isCardData;
exports.cardToCardData = cardToCardData;
exports.cardsToCardData = cardsToCardData;
function isJoker(card) {
    return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
}
function getCardPoints(card) {
    if (isJoker(card)) {
        return 0;
    }
    if (card.value === 1)
        return 10;
    if (card.value >= 2 && card.value <= 10)
        return card.value;
    if (card.value >= 11 && card.value <= 13)
        return 10;
    if (card.value === 14)
        return 10;
    return 0;
}
function getCardName(card) {
    if (isJoker(card)) {
        return card.suit === "JOKER_RED" ? "Red Joker" : "Black Joker";
    }
    const valueNames = {
        1: "A",
        11: "J",
        12: "Q",
        13: "K",
    };
    const valueName = valueNames[card.value] || card.value.toString();
    const suitSymbols = {
        HEART: "♥",
        DIAMOND: "♦",
        SPADE: "♠",
        CLUB: "♣",
        JOKER_RED: "🃏",
        JOKER_BLACK: "🃏",
    };
    return `${valueName}${suitSymbols[card.suit]}`;
}
function cardsEqual(card1, card2) {
    return card1.id === card2.id;
}
function cloneCard(card) {
    return { ...card };
}
function isCardData(obj) {
    return (typeof obj === "object" &&
        obj !== null &&
        typeof obj.id === "string" &&
        typeof obj.suit === "string" &&
        (obj.suit === "HEART" ||
            obj.suit === "DIAMOND" ||
            obj.suit === "SPADE" ||
            obj.suit === "CLUB" ||
            obj.suit === "JOKER_RED" ||
            obj.suit === "JOKER_BLACK") &&
        typeof obj.value === "number" &&
        typeof obj.isFaceUp === "boolean");
}
function cardToCardData(card) {
    return {
        id: card.id,
        suit: card.suit,
        value: card.value,
        isFaceUp: card.isFaceUp,
    };
}
function cardsToCardData(cards) {
    return cards.map(cardToCardData);
}
//# sourceMappingURL=card-data.types.js.map