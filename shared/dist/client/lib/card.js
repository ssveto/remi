"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Card_instances, _Card_generateShortId;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
class Card {
    constructor(suit, value, isFaceUp = false, serverId) {
        _Card_instances.add(this);
        this.faceUp = isFaceUp;
        this.suit = suit;
        this.value = value;
        this.serverId = serverId;
        this.id = serverId || `${suit}_${value}_${__classPrivateFieldGet(this, _Card_instances, "m", _Card_generateShortId).call(this)}`;
    }
    get isFaceUp() {
        return this.faceUp;
    }
    flip() {
        this.faceUp = !this.faceUp;
    }
    equals(other) {
        return this.id === other.id;
    }
    toString() {
        return `${this.value}${this.suit[0]} [${this.id.slice(-8)}]`;
    }
    static getScoreValueFromData(cardData) {
        const suit = cardData.suit;
        const value = cardData.value;
        if (suit === "JOKER_RED" || suit === "JOKER_BLACK") {
            return 25;
        }
        if (typeof value === "string") {
            switch (value) {
                case "Ace":
                case "King":
                case "Queen":
                case "Jack":
                    return 10;
                default:
                    const num = parseInt(value);
                    return isNaN(num) ? 5 : num;
            }
        }
        if (typeof value === "number") {
            if (value >= 11 && value <= 14)
                return 10;
            return value;
        }
        return 5;
    }
    get isJoker() {
        return this.suit === "JOKER_RED" || this.suit === "JOKER_BLACK";
    }
    toCardData() {
        return {
            id: this.id,
            suit: this.suit,
            value: this.value,
            isFaceUp: this.isFaceUp,
        };
    }
}
exports.Card = Card;
_Card_instances = new WeakSet(), _Card_generateShortId = function _Card_generateShortId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID().slice(0, 8);
    }
    return `${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;
};
//# sourceMappingURL=card.js.map