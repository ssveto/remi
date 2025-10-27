import { Card } from "./card";
import { Deck } from "./deck";

export class Remi {
  #deck: Deck;
  #cardsInHand: Card[];

  constructor() {
    this.#deck = new Deck();
    this.#cardsInHand = [];
  }

  get drawPile(): Card[] {
    return this.#deck.drawPile;
  }
  get discardPile(): Card[] {
    return this.#deck.discardPile;
  }
  get cardsInHand(): Card[] {
    return this.#cardsInHand;
  }
  public newGame(): void {
    this.#deck.reset();
    this.#cardsInHand = [];

    for (let i = 0; i < 15; i += 1) {
      const card = this.#deck.draw() as Card;
      card.flip();
      this.#cardsInHand.push(card);
    }
  }
  public drawCard(): boolean {
    const card = this.#deck.draw();
    if (card === undefined) {
      return false;
    }
    card.flip();
    this.#cardsInHand.push(card);
    return true;
  }

  public shuffleDiscardPile(): boolean {
    if (this.#deck.drawPile.length !== 0) {
      return false;
    }
    this.#deck.shuffleInDiscardPile();
    return true;
  }

  public takeDiscardCard(): boolean {
    return true;
  }

  public switchCardsInHand(source: number, target: number): boolean {
    return true;
  }

  public dropCard(): boolean {
    return true;
  }
}
