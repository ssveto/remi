import * as Phaser from "phaser";
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from "./common";
import { Remi } from "../lib/remi";
import type { Card } from "../lib/card";

const DEBUG = false;
const SCALE = 1.1;
const CARD_BACK_FRAME = 54;

const SUIT_FRAMES = {
  HEART: 26,
  DIAMOND: 13,
  SPADE: 39,
  CLUB: 0,
  JOKER_RED: 52,
  JOKER_BLACK: 53,
} as const;

const LAYOUT = {
  MAX_HAND_WIDTH: 570 * 2,
  CARD_SPACING: 38 * 2,
  MIN_SCALE: 0.4,
  MAX_CARDS_IN_HAND: 15,
  PLAYER_HAND: { x: 30 * 2, y: 300 * 2 },
  DISCARD_PILE: { x: 330 * 2, y: 130 * 2 },
  DRAW_PILE: { x: 230 * 2, y: 130 * 2 },
  DISCARD_DROP_ZONE_PADDING: 75,
  DRAW_ZONE_OFFSET: 10,
  ANIMATION_DURATION: 100,
} as const;

type ZoneType = keyof typeof ZONE_TYPE;
const ZONE_TYPE = {
  DISCARD: "DISCARD",
  CARDS_IN_HAND: "CARDS_IN_HAND",
} as const;

export class GameScene extends Phaser.Scene {
  #drawPileCards!: Phaser.GameObjects.Image[];
  #discardPileCard!: Phaser.GameObjects.Image;
  #cardsInHand!: Phaser.GameObjects.Image[];
  #dropZonesInHand: Phaser.GameObjects.Zone[] = [];
  #remi!: Remi;
  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  public create(): void {
    this.#remi = new Remi();
    this.#remi.newGame();
    this.#createDrawPile();
    this.#showCardsInDrawPile();
    this.#createDiscardPile();
    this.#createCardsInHand();
    this.input.dragDistanceThreshold = 4;
    this.#createDragEvents();
    this.#createDropZoneForDiscard();
    this.#createDropEventListener();
    this.#updateCardsInHand();
    this.#updateDropZonesForHand();
  }
  #createDrawPile(): void {
    //this.#drawCardLocationBox(DRAW_PILE_X_POSITIONS, DRAW_PILE_Y_POSITIONS, 45);
    this.#drawPileCards = [];
    for (let i = 0; i < 3; i += 1) {
      this.#drawPileCards.push(
        this.#createCard(
          LAYOUT.DRAW_PILE.x + i * 10,
          LAYOUT.DRAW_PILE.y,
          false
        )
      );
    }
    const drawZone = this.add
      .zone(
        LAYOUT.DRAW_PILE.x - 10,
        LAYOUT.DRAW_PILE.y - 10,
        CARD_WIDTH * SCALE + 40,
        CARD_HEIGHT * SCALE + 30
      )
      .setOrigin(0)
      .setInteractive();
    drawZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      // Use a default start position if the hand is empty
      let newCardX = LAYOUT.PLAYER_HAND.x;
      let newCardY = LAYOUT.PLAYER_HAND.y;

      const numCardsInHand = this.#cardsInHand.length;

      if (this.#cardsInHand.length === 15) {
        return;
      }
      if (this.#remi.drawPile.length === 0) {
        this.#remi.shuffleDiscardPile();
        this.#showCardsInDrawPile();
        if (this.#remi.drawPile.length === 0) {
          // no cards to draw even after shuffle
          return;
        }
      }

      // If there are cards, get the position of the last one
      if (numCardsInHand > 0) {
        const lastCardGameObject = this.#cardsInHand[numCardsInHand - 1];
        // Use the last card's position, possibly adding the spacing (though #updateCardsInHand
        // will correct it, giving it a temporary position is fine).
        newCardX = lastCardGameObject.x;
        newCardY = lastCardGameObject.y;
      }
      this.#remi.drawCard();
      const newCard = this.#remi.cardsInHand[this.#remi.cardsInHand.length - 1];


      this.#cardsInHand.push(
        this.#createCard(newCardX, newCardY, newCard.isFaceUp).setData({
          zoneType: ZONE_TYPE.CARDS_IN_HAND,
          cardRef: newCard,
        })
      );
      if (newCard.isFaceUp) {
        const go = this.#cardsInHand[this.#cardsInHand.length - 1].setFrame(
          this.#getCardFrame(newCard)
        );
        this.input.setDraggable(go);
      }
      this.#showCardsInDrawPile();
      this.#updateCardsInHand();
      this.#updateDropZonesForHand();
    });
    if (DEBUG) {
      this.add
        .rectangle(
          drawZone.x,
          drawZone.y,
          drawZone.width,
          drawZone.height,
          0xff0000,
          0.5
        )
        .setOrigin(0);
    }
  }

  #createDiscardPile(): void {
    this.#drawCardLocationBox(
      LAYOUT.DISCARD_PILE.x,
      LAYOUT.DISCARD_PILE.y,
      40
    );

    this.#discardPileCard = this.#createCard(
      LAYOUT.DISCARD_PILE.x,
      LAYOUT.DISCARD_PILE.y,
      true
    ).setVisible(false);
  }


  #drawCardLocationBox(x: number, y: number, z: number): void {
    this.add
      .rectangle(x, y, z * 2, 57 * 2)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5);
  }

  #createCard(
    x: number,
    y: number,
    _draggable: boolean,
    cardIndex?: number
  ): Phaser.GameObjects.Image {
    return this.add
      .image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME)
      .setOrigin(0)
      .setScale(SCALE)
      .setInteractive()
      .setData({
        x,
        y,
        cardIndex,
      });
  }
  #createCardsInHand(): void {
    this.#cardsInHand = [];
    this.#remi.cardsInHand.forEach((card, cardIndex) => {
      const cardGameObject = this.#createCard(
        LAYOUT.PLAYER_HAND.x + cardIndex * 38,
        LAYOUT.PLAYER_HAND.y,
        card.isFaceUp,
        cardIndex
      ).setData({
        cardIndex: cardIndex,
        zoneType: ZONE_TYPE.CARDS_IN_HAND,
        cardRef: card,
      });
      this.#cardsInHand.push(cardGameObject);
      if (card.isFaceUp) {
        this.input.setDraggable(cardGameObject);

        cardGameObject.setFrame(this.#getCardFrame(card));
      }
    });
  }

  #createDragEvents(): void {
    this.#createDragStartEventListener();
    this.#createDragEventListener();
    this.#createDragEndEventListener();
  }

  #createDragStartEventListener(): void {
    this.input.on(
      Phaser.Input.Events.DRAG_START,
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.Image
      ) => {
        // snap back effect so that if the move is unallowed, will return back
        const cardIndex = this.#cardsInHand.indexOf(gameObject);
        if (cardIndex === -1) return;

        const cardData = this.#remi.cardsInHand[cardIndex];
        if (!cardData.isFaceUp) {
          // Cancel drag for face-down cards
          //this.input.setDragState(gameObject.input, 0);
          gameObject.setInteractive(false);
          return;
        }

        gameObject.setData("origX", gameObject.x);
        gameObject.setData("origY", gameObject.y);
        gameObject.setDepth(2);
      }
    );
  }
  #createDragEventListener(): void {
    this.input.on(
      Phaser.Input.Events.DRAG,
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.Image,
        dragX: number,
        dragY: number
      ) => {
        gameObject.setPosition(dragX, dragY);
      }
    );
  }
  #createDragEndEventListener(): void {
    this.input.on(
      Phaser.Input.Events.DRAG_END,
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.Image
      ) => {
        gameObject.setDepth(0);

        if (!gameObject.getData("wasDropped")) {
          gameObject.setPosition(
            gameObject.getData("origX") as number,
            gameObject.getData("origY") as number
          );
        }

        // Reset flag for next drag
        gameObject.setData("wasDropped", false);
      }
    );
  }

  #createDropZoneForDiscard(): void {
    let zone = this.add
      .zone(
        LAYOUT.DISCARD_PILE.x - 75,
        LAYOUT.DISCARD_PILE.y - 75,
        CARD_WIDTH * SCALE + 150,
        CARD_HEIGHT * SCALE + 150
      )
      .setOrigin(0)
      .setRectangleDropZone(CARD_WIDTH * SCALE + 150, CARD_HEIGHT * SCALE + 150)
      .setData({
        zoneType: ZONE_TYPE.DISCARD,
      });
    if (DEBUG) {
      this.add
        .rectangle(zone.x, zone.y, zone.width, zone.height, 0xff0000, 0.5)
        .setOrigin(0);
    }
  }

  #createDropEventListener(): void {
    this.input.on(
      Phaser.Input.Events.DROP,
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.Image,
        dropZone: Phaser.GameObjects.Zone
      ) => {
        gameObject.setData("wasDropped", true);
        const zoneType = dropZone.getData("zoneType") as ZoneType;
        if (zoneType === ZONE_TYPE.DISCARD) {
          this.#handleMoveCardToDiscard(gameObject);
          // #handleMoveCardToDiscard will destroy gameObject and then call #updateHandVisuals()
        } else if (zoneType === ZONE_TYPE.CARDS_IN_HAND) {
          const targetIndex = dropZone.getData("positionIndex") as number;
          this.#handleMoveCardInHand(gameObject, targetIndex); // This should call #updateHandVisuals()
        }
      }
    );
  }

  #handleMoveCardToDiscard(gameObject: Phaser.GameObjects.Image): void {
    const cardRef = gameObject.getData("cardRef") as Card;

    // If no cardRef, something went wrong during card creation
    if (!cardRef) {
      console.error("Card missing cardRef data!");
      gameObject.destroy();
      return;
    }

    // Find the card in the logic layer
    const currentCardIndex = this.#remi.cardsInHand.indexOf(cardRef);

    if (currentCardIndex === -1) {
      console.error("Card not found in hand!", cardRef);
      gameObject.destroy();
      return;
    }

    // Remove from logic
    const [discardedCard] = this.#remi.cardsInHand.splice(currentCardIndex, 1);
    this.#remi.discardPile.push(discardedCard);

    this.#discardPileCard.setFrame(this.#getCardFrame(discardedCard));
    this.#discardPileCard.setVisible(true);

    // Remove from visual layer
    const visualIndex = this.#cardsInHand.indexOf(gameObject);
    if (visualIndex !== -1) {
      this.#cardsInHand.splice(visualIndex, 1);
    }
    gameObject.destroy();

    // Refresh hand
    this.#updateCardsInHand();
    this.#updateDropZonesForHand();
  }

  #handleMoveCardInHand(
    gameObject: Phaser.GameObjects.Image,
    targetPosition: number
  ): void {
    const currentCardIndex = this.#cardsInHand.indexOf(gameObject);
    console.log(currentCardIndex);
    console.log(targetPosition);
    // Do nothing if the card is dropped in its own position
    if (currentCardIndex === targetPosition) {
      // It's good practice to snap the card back to its original position
      // even if no reordering happens.
      this.#updateCardsInHand();
      return;
    }

    // 1. Remove the card from its original position (for both logic and visuals)
    const [movedLogicCard] = this.#remi.cardsInHand.splice(currentCardIndex, 1);
    const [movedGameObject] = this.#cardsInHand.splice(currentCardIndex, 1);

    // 2. Insert the card into the target position
    this.#remi.cardsInHand.splice(targetPosition, 0, movedLogicCard);
    this.#cardsInHand.splice(targetPosition, 0, movedGameObject);

    // 3. Update all card visuals and drop zones to reflect the new order
    // This is much safer than manually setting data on just two cards.
    this.#updateCardsInHand();
    this.#updateDropZonesForHand(); // You need to update the drop zones as well!
  }

  #updateCardsInHand(): void {
    const layout = this.#calculateHandLayout();
    if (layout.numCards === 0) return;

    this.#cardsInHand.forEach((card, cardIndex) => {
      const finalX = layout.startX + cardIndex * layout.spacing;

      this.tweens.add({
        targets: card,
        x: finalX,
        y: LAYOUT.PLAYER_HAND.y,
        scale: layout.scaleFactor,
        duration: LAYOUT.ANIMATION_DURATION,
        ease: "Sine.easeOut",
      });

      card.setData("cardIndex", cardIndex);
      card.setData("zoneType", ZONE_TYPE.CARDS_IN_HAND);
    });
  }

  #updateDropZonesForHand(): void {
    this.#dropZonesInHand.forEach((zone) => zone.destroy());
    this.#dropZonesInHand = [];

    const layout = this.#calculateHandLayout();
    if (layout.numCards === 0) return;

    this.#cardsInHand.forEach((card, cardIndex) => {
      const finalX = layout.startX + cardIndex * layout.spacing;

      let zone = this.add
        .zone(finalX, LAYOUT.PLAYER_HAND.y, CARD_WIDTH * layout.scaleFactor, CARD_HEIGHT * layout.scaleFactor)
        .setOrigin(0)
        .setRectangleDropZone(CARD_WIDTH * layout.scaleFactor, CARD_HEIGHT * layout.scaleFactor) // FIXED!
        .setData({
          zoneType: ZONE_TYPE.CARDS_IN_HAND,
          positionIndex: cardIndex,
        })
        .setDepth(-1);

      this.#dropZonesInHand.push(zone);
    });
  }

  #getCardFrame(data: Card): number {
    if (data.value === 14) {
      if (data.suit === "JOKER_RED") {
        return 52;
      }
      if (data.suit === "JOKER_BLACK") {
        return 53;
      }
    }

    return SUIT_FRAMES[data.suit] + data.value - 1;
  }

  #showCardsInDrawPile(): void {
    const numberOfCardsToShow = Math.min(this.#remi.drawPile.length, 3);
    this.#drawPileCards.forEach((card, cardIndex) => {
      const showCard = cardIndex < numberOfCardsToShow;
      card.setVisible(showCard);
    });
  }
  #calculateHandLayout(): {
    startX: number;
    spacing: number;
    scaleFactor: number;
    numCards: number
  } {
    const numCards = this.#cardsInHand.length;

    // If no cards, return defaults
    if (numCards === 0) {
      return { startX: LAYOUT.PLAYER_HAND.x, spacing: 0, scaleFactor: 1, numCards: 0 };
    }

    // Calculate how wide the hand would be without scaling
    const unscaledTotalWidth = CARD_WIDTH + (numCards - 1) * LAYOUT.CARD_SPACING;

    // Scale down if too wide, but never smaller than MIN_SCALE
    let scaleFactor = Math.min(1, LAYOUT.MAX_HAND_WIDTH / unscaledTotalWidth);
    scaleFactor = Math.max(scaleFactor, LAYOUT.MIN_SCALE);

    // Calculate actual width after scaling
    const scaledTotalWidth = CARD_WIDTH * scaleFactor +
      (numCards - 1) * (LAYOUT.CARD_SPACING * scaleFactor);

    // Center the hand by calculating empty space on sides
    const emptySpace = LAYOUT.MAX_HAND_WIDTH - scaledTotalWidth;
    const startX = LAYOUT.PLAYER_HAND.x + emptySpace / 2;
    const spacing = LAYOUT.CARD_SPACING * scaleFactor;

    return { startX, spacing, scaleFactor, numCards };
  }
}
