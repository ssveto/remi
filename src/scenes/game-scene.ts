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
  #currentMelds: Card[][] = []; 
  #selectedCards: Set<Phaser.GameObjects.Image> = new Set();
  #selectionOrder: Phaser.GameObjects.Image[] = [];
  #hasOpenedInitialMeld = false;
  #currentMeldScore = 0;
  #meldScoreText!: Phaser.GameObjects.Text;
  #meldButton!: Phaser.GameObjects.Container;
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
    this.#createMeldScoreDisplay();
    this.#createMeldButton();
  }

  #createMeldScoreDisplay(): void {
    this.#meldScoreText = this.add
      .text(70, 40, "0", {
        // Start with just '0'
        fontSize: "30px",
        fontFamily: "Roboto",
        color: "#FFFFFF",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(1, 0);
  }

  #createMeldButton(): void {
    // Button background
    const bg = this.add
      .rectangle(0, 0, 140, 45, 0x4caf50, 1)
      .setStrokeStyle(2, 0x2e7d32)
      .setInteractive({ useHandCursor: true });

    // Button text
    const text = this.add
      .text(0, 0, "Otvori se", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Container for both
    this.#meldButton = this.add.container(this.scale.width / 2, 550, [
      bg,
      text,
    ]);
    this.#meldButton.setVisible(false);

    // Hover effects
    bg.on("pointerover", () => {
      bg.setFillStyle(0x66bb6a);
      this.game.canvas.style.cursor = "pointer";
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(0x4caf50);
      this.game.canvas.style.cursor = "default";
    });

    // Click handler
    bg.on("pointerdown", () => {
      this.#layDownMelds();
    });
  }

  #layDownMelds(): void {}
  #createDrawPile(): void {
    //this.#drawCardLocationBox(DRAW_PILE_X_POSITIONS, DRAW_PILE_Y_POSITIONS, 45);
    this.#drawPileCards = [];
    for (let i = 0; i < 3; i += 1) {
      this.#drawPileCards.push(
        this.#createCard(LAYOUT.DRAW_PILE.x + i * 10, LAYOUT.DRAW_PILE.y, false)
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
      const cardGameObject = this.#createCard(
        newCardX,
        LAYOUT.PLAYER_HAND.y,
        newCard.isFaceUp
      ).setData({
        zoneType: ZONE_TYPE.CARDS_IN_HAND,
        cardRef: newCard,
        isSelected: false,
      });
      this.#makeCardSelectable(cardGameObject);
      this.#cardsInHand.push(cardGameObject);
      if (newCard.isFaceUp) {
        const go = this.#cardsInHand[this.#cardsInHand.length - 1].setFrame(
          this.#getCardFrame(newCard)
        );
        //
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
    this.#drawCardLocationBox(LAYOUT.DISCARD_PILE.x, LAYOUT.DISCARD_PILE.y, 40);

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
    const card = this.add
      .image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME)
      .setOrigin(0)
      .setScale(SCALE)
      .setInteractive()
      .setData({
        x,
        y,
        cardIndex,
      });
    return card;
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
        //originalY: LAYOUT.PLAYER_HAND.y,
        isSelected: false,
      });
      this.#cardsInHand.push(cardGameObject);
      if (card.isFaceUp) {
        this.input.setDraggable(cardGameObject);

        cardGameObject.setFrame(this.#getCardFrame(card));
        this.#makeCardSelectable(cardGameObject);
      }
    });
  }

  #makeCardSelectable(cardGameObject: Phaser.GameObjects.Image): void {
    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    cardGameObject.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointerDownTime = this.time.now;
      pointerDownPos = { x: pointer.x, y: pointer.y };
    });

    cardGameObject.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // Calculate how much the pointer moved
      const distance = Phaser.Math.Distance.Between(
        pointerDownPos.x,
        pointerDownPos.y,
        pointer.x,
        pointer.y
      );

      // Calculate how long the pointer was down
      const duration = this.time.now - pointerDownTime;

      // If pointer didn't move much and was quick, treat as click
      // Otherwise, it was a drag
      if (distance < 10 && duration < 300) {
        this.#toggleCardSelection(cardGameObject);
      }
    });
  }

  #toggleCardSelection(cardGameObject: Phaser.GameObjects.Image): void {
    const isSelected = cardGameObject.getData("isSelected") as boolean;
    //const originalY = cardGameObject.getData("originalY") as number;

    if (isSelected) {
      cardGameObject.setData("isSelected", false);
      this.input.setDraggable(cardGameObject, true);
      this.#selectedCards.delete(cardGameObject);

      const orderIndex = this.#selectionOrder.indexOf(cardGameObject);
      if (orderIndex !== -1) {
        this.#selectionOrder.splice(orderIndex, 1);
      }

      this.tweens.add({
        targets: cardGameObject,
        y: LAYOUT.PLAYER_HAND.y,
        duration: 150,
        ease: "Back.easeOut",
      });
      cardGameObject.clearTint();
    } else {
      cardGameObject.setData("isSelected", true);
      this.input.setDraggable(cardGameObject, false);
      this.#selectedCards.add(cardGameObject);
      // Track selection order
      this.#selectionOrder.push(cardGameObject);

      this.tweens.add({
        targets: cardGameObject,
        y: LAYOUT.PLAYER_HAND.y - 10, // Move up 20px for better visibility
        duration: 150,
        ease: "Back.easeOut",
      });
      cardGameObject.setTint(0xffff00); // Yellow tint
    }
    // Validate after every selection change
    this.#validateSelectedMelds();
  }

  #getSelectedCardsInOrder(): Card[] {
    return this.#selectionOrder.map(
      (cardGO) => cardGO.getData("cardRef") as Card
    );
  }

  #splitIntoMeldGroups(cardsInOrder: Card[]): Card[][] {
    const validMelds: Card[][] = [];
    let currentGroup: Card[] = [];

    for (let i = 0; i < cardsInOrder.length; i++) {
      const card = cardsInOrder[i];
      currentGroup.push(card);

      // Check if we have at least 3 cards
      if (currentGroup.length >= 3) {
        // Check if current group is valid
        const isValid =
          this.#remi.isValidSet(currentGroup) ||
          this.#remi.isValidRun(currentGroup);

        if (isValid) {
          // Continue - this group is still valid, keep adding cards
          continue;
        } else {
          // Current group became invalid
          // Check if the group WITHOUT the last card was valid
          const groupWithoutLast = currentGroup.slice(0, -1);

          if (groupWithoutLast.length >= 3) {
            const wasValid =
              this.#remi.isValidSet(groupWithoutLast) ||
              this.#remi.isValidRun(groupWithoutLast);

            if (wasValid) {
              // Previous group was valid, save it
              validMelds.push(groupWithoutLast);
              // Start new group with current card
              currentGroup = [card];
            } else {
              // Previous group was also invalid, keep trying
              // (this shouldn't happen if we're checking continuously)
            }
          } else {
            // Group too small, just continue
          }
        }
      }
    }

    // Check the final group
    if (currentGroup.length >= 3) {
      const isValid =
        this.#remi.isValidSet(currentGroup) ||
        this.#remi.isValidRun(currentGroup);
      if (isValid) {
        validMelds.push(currentGroup);
      }
    }

    return validMelds;
  }
  
  #validateSelectedMelds(): void {
  if (this.#selectedCards.size < 3) {
    this.#currentMeldScore = 0;
    this.#currentMelds = []; 
    this.#updateMeldScoreDisplay();
    this.#resetSelectionVisuals(); // Clear any coloring
    return;
  }
  
  // Get selected cards in the ORDER they were selected
  const selectedInOrder = this.#getSelectedCardsInOrder();
  
  // Split into groups based on validity (do this ONCE)
  this.#currentMelds = this.#splitIntoMeldGroups(selectedInOrder);
  
  // Calculate total score from valid melds
  let totalScore = 0;
  this.#currentMelds.forEach((meld) => {
    totalScore += this.#calculateMeldValue(meld);
  });
  
  this.#currentMeldScore = totalScore;
  this.#updateMeldScoreDisplay();
  
  // Pass the already-calculated melds to visualization
  this.#updateSelectionVisuals(this.#currentMelds);
}

#updateSelectionVisuals(melds: Card[][]): void {
  // Safety check
  if (!this.#selectionOrder || this.#selectionOrder.length === 0) {
    return;
  }

  // Create a map of which meld each card belongs to
  const cardToMeld = new Map<Card, number>();
  this.#currentMelds.forEach((meld, meldIndex) => {
    meld.forEach(card => {
      cardToMeld.set(card, meldIndex);
    });
  });
  
  // Colors for different melds
  const meldColors = [0xffff00, 0x00ff00, 0x00ffff, 0xff00ff];
  
  // Update each selected card's tint based on its meld
  this.#selectionOrder.forEach((cardGO) => {
    const cardRef = cardGO.getData('cardRef') as Card;
    const meldIndex = cardToMeld.get(cardRef);
    
    if (meldIndex !== undefined) {
      // Card is part of a valid meld
      cardGO.setTint(meldColors[meldIndex % meldColors.length]);
    } else {
      // Card is not part of any valid meld
      cardGO.setTint(0xff0000); // Red = invalid
    }
  });
}

#resetSelectionVisuals(): void {
  // Safety check - only reset if there are selected cards
  if (!this.#selectionOrder || this.#selectionOrder.length === 0) {
    return;
  }
  
  // Reset all selected cards to default yellow
  this.#selectionOrder.forEach((cardGO) => {
    cardGO.setTint(0xffff00); // Yellow
  });
}

  #calculateMeldValue(meld: Card[]): number {
    return meld.reduce((sum, card) => {
      // Ace = 11 points
      if (card.value === 1 || card.value === 14) {
        return sum + 10;
      }
      // Face cards (Jack=11, Queen=12, King=13) = 10 points each
      if (card.value >= 11 && card.value <= 13) {
        return sum + 10;
      }
      // Number cards = face value (2=2, 3=3, ... 10=10)
      return sum + card.value;
    }, 0);
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
        // If card is selected, deselect it when starting to drag
        if (gameObject.getData("isSelected")) {
          this.#toggleCardSelection(gameObject);
        }

        gameObject.setData("origX", gameObject.x);
        gameObject.setData("origY", gameObject.y);
        gameObject.setDepth(2);
      }
    );
  }

  #updateMeldScoreDisplay(): void {
    const meetsRequirement =
      this.#hasOpenedInitialMeld || this.#currentMeldScore >= 51;

    // Update text
    this.#meldScoreText.setText(`${this.#currentMeldScore}`);

    // Update color
    if (this.#currentMeldScore === 0) {
      this.#meldScoreText.setColor("#ffffff");
    } else if (meetsRequirement) {
      this.#meldScoreText.setColor("#00ff00"); // Green
    } else {
      this.#meldScoreText.setColor("#ff0000"); // Red
    }

    // Show/hide button
    this.#updateMeldButton();
  }

  #updateMeldButton(): void {
    // Show button if:
    // 1. First time and score >= 51, OR
    // 2. Already opened and has any valid meld (score > 0)
    const shouldShow =
      (!this.#hasOpenedInitialMeld && this.#currentMeldScore >= 51) ||
      (this.#hasOpenedInitialMeld && this.#currentMeldScore > 0);

    this.#meldButton.setVisible(shouldShow);
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
      const isSelected = card.getData("isSelected");

      this.tweens.add({
        targets: card,
        x: finalX,
        y: isSelected ? LAYOUT.PLAYER_HAND.y - 10 : LAYOUT.PLAYER_HAND.y,
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
        .zone(
          finalX,
          LAYOUT.PLAYER_HAND.y,
          CARD_WIDTH * layout.scaleFactor,
          CARD_HEIGHT * layout.scaleFactor
        )
        .setOrigin(0)
        .setRectangleDropZone(
          CARD_WIDTH * layout.scaleFactor,
          CARD_HEIGHT * layout.scaleFactor
        ) // FIXED!
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
    numCards: number;
  } {
    const numCards = this.#cardsInHand.length;

    // If no cards, return defaults
    if (numCards === 0) {
      return {
        startX: LAYOUT.PLAYER_HAND.x,
        spacing: 0,
        scaleFactor: 1,
        numCards: 0,
      };
    }

    // Calculate how wide the hand would be without scaling
    const unscaledTotalWidth =
      CARD_WIDTH + (numCards - 1) * LAYOUT.CARD_SPACING;

    // Scale down if too wide, but never smaller than MIN_SCALE
    let scaleFactor = Math.min(1, LAYOUT.MAX_HAND_WIDTH / unscaledTotalWidth);
    scaleFactor = Math.max(scaleFactor, LAYOUT.MIN_SCALE);

    // Calculate actual width after scaling
    const scaledTotalWidth =
      CARD_WIDTH * scaleFactor +
      (numCards - 1) * (LAYOUT.CARD_SPACING * scaleFactor);

    // Center the hand by calculating empty space on sides
    const emptySpace = LAYOUT.MAX_HAND_WIDTH - scaledTotalWidth;
    const startX = LAYOUT.PLAYER_HAND.x + emptySpace / 2;
    const spacing = LAYOUT.CARD_SPACING * scaleFactor;

    return { startX, spacing, scaleFactor, numCards };
  }
}
