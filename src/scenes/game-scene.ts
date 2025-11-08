import * as Phaser from "phaser";
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from "./common";
import { Remi } from "../lib/remi";
import type { Card } from "../lib/card";

const DEBUG = false;
const SCALE = 1;
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
  MELD_TABLE: {
    START_X: 300,
    START_Y: 450, // Below the hand
    MELD_SPACING_X: 50, // Space between melds horizontally
    MELD_SPACING_Y: 100, // Space between rows of melds
    CARD_SPACING_IN_MELD: 25, // Overlap cards in same meld
    // MAX_MELDS_PER_ROW: 3,
  },
  DROP_ZONE_EXPANSION: 60,
} as const;

enum GamePhase {
  DRAW = "DRAW",
  MELD = "MELD",
  DISCARD = "DISCARD",
  GAME_OVER = "GAME_OVER",
}

class GameState {
  currentPlayer: number = 0; // 0 = human player
  phase: GamePhase = GamePhase.DRAW;
  hasDrawnThisTurn: boolean = false;
  totalPlayers: number = 2; // Can expand for multiplayer later
  playerHasMelds: boolean[] = Array(this.totalPlayers).fill(false);
}

type ZoneType = keyof typeof ZONE_TYPE;
const ZONE_TYPE = {
  DISCARD: "DISCARD",
  CARDS_IN_HAND: "CARDS_IN_HAND",
  MELD_TABLE: "MELD_TABLE",
} as const;

export class GameScene extends Phaser.Scene {
  #drawPileCards!: Phaser.GameObjects.Image[];
  #discardPileCard!: Phaser.GameObjects.Image;
  #cardsInHand!: Phaser.GameObjects.Image[];
  #dropZonesInHand: Phaser.GameObjects.Zone[] = [];
  #remi!: Remi;
  #currentMelds: Card[][] = [];
  #selectedCards: Set<Phaser.GameObjects.Image> = new Set();
  #hasOpenedInitialMeld = false;
  #currentMeldScore = 0;
  #meldScoreText!: Phaser.GameObjects.Text;
  #meldButton!: Phaser.GameObjects.Container;
  #laidDownMelds: Phaser.GameObjects.Image[][] = []; // Visual groups
  #laidDownMeldData: Card[][] = []; // Logic data
  #gameState!: GameState;
  #phaseIndicator!: Phaser.GameObjects.Text;
  #meldDropZones: Phaser.GameObjects.Zone[] = [];
  #playerIcons: Phaser.GameObjects.Container[] = [];
  #playerMelds: Map<
  number,
  { melds: Phaser.GameObjects.Image[][]; meldData: Card[][] }
  > = new Map();
  #currentViewingPlayer: number = 0; // 0 = viewing own melds
  #meldViewContainer: Phaser.GameObjects.Container | null = null;
  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  public create(): void {
    this.#remi = new Remi();
    this.#gameState = new GameState();
    this.#remi.newGame(this.#gameState.totalPlayers);

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
    this.#createPhaseIndicator();
    this.#updatePhaseUI();
    this.#createPlayerIcons();
    this.#initializePlayerMelds();
    this.#gameState.currentPlayer = 0;
    this.#transitionPhase(GamePhase.DRAW);
  }

  #createPlayerIcons(): void {
  const iconSize = 60;
  const spacing = 70;
  const startX = this.scale.width - 80;
  const startY = 80;

  for (let i = 1; i < this.#gameState.totalPlayers; i++) {
    const y = startY + (i -1) * spacing;

    // Background circle
    const circle = this.add
    .circle(0, 0, iconSize / 2, 0x666666, 1)
    .setStrokeStyle(3, 0x333333);

    // Player number
    const text = this.add
    .text(0, 0, `P${i + 1}`, {
      fontSize: "20px",
      fontFamily: "Arial",
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

    // Meld indicator (small green dot, hidden by default)
    const indicator = this.add
    .circle(iconSize / 3, -iconSize / 3, 8, 0x00ff00, 1)
    .setStrokeStyle(2, 0xffffff)
    .setVisible(false);

    // Container for all elements
    const container = this.add.container(startX, y, [
      circle,
      text,
      indicator,
    ]);

    // Make interactive for all AI players
    circle.setInteractive({ useHandCursor: true });

    circle.on("pointerover", () => {
      circle.setFillStyle(0x888888);
    });

    circle.on("pointerout", () => {
      circle.setFillStyle(0x666666);
    });

    circle.on("pointerdown", () => {
      this.#viewPlayerMelds(i);
    });

    // Store with original player index
    this.#playerIcons[i] = container;
  }
  }
  #viewPlayerMelds(playerIndex: number): void {
  // Player 0 (you) - melds are always shown on table, no need to click
  if (playerIndex === 0) {
    //this.#showMessage("Your melds are always visible on the table");
    return;
  }

  // Check if player has melds
  if (!this.#gameState.playerHasMelds[playerIndex]) {
    this.#showMessage(`Player ${playerIndex + 1} has no melds yet`);
    return;
  }

  // If already viewing this player, close the view
  if (this.#currentViewingPlayer === playerIndex && this.#meldViewContainer) {
    this.#closeMeldView();
    return;
  }

  // Close previous view if open
  if (this.#meldViewContainer) {
    this.#closeMeldView();
  }

  this.#currentViewingPlayer = playerIndex;
  this.#showMeldView(playerIndex);
  }

  #showMeldView(playerIndex: number): void {
  const playerData = this.#playerMelds.get(playerIndex);
  if (!playerData || playerData.melds.length === 0) return;

  // Clear any previous temporary meld visuals
  this.#closeMeldView();

    // Store current viewing player
    this.#currentViewingPlayer = playerIndex;

    // Display melds at top of screen: x=80, y=100
    this.#meldViewContainer = this.add.container(0, 0);

    this.#displayPlayerMeldsAtTop(playerData.melds);
  }

  #displayPlayerMeldsAtTop(melds: Phaser.GameObjects.Image[][]): void {
  const START_X = this.scale.width / 2;
  const START_Y = 100; // Upper screen
  const CARD_SPACING_IN_MELD = 25;
  const MELD_SPACING_X = 50;
  let currentX = START_X;

  melds.forEach((meldVisuals) => {
    if (meldVisuals.length === 0) return;

    // Clone and position each card in the meld
    meldVisuals.forEach((cardGO, idx) => {
      const clone = this.add
      .image(
        currentX - idx * CARD_SPACING_IN_MELD,
        START_Y,
        ASSET_KEYS.CARDS,
        cardGO.frame.name // Shows actual card face
      )
      .setOrigin(0)
      .setScale(SCALE * 0.8)
      .setDepth(1 + idx); // Above everything

      this.#meldViewContainer?.add(clone);
    });

    // Advance X for next meld
    currentX += meldVisuals.length * CARD_SPACING_IN_MELD + MELD_SPACING_X;
  });
  }

  #closeMeldView(): void {
  if (this.#meldViewContainer) {
    this.#meldViewContainer.destroy();
    this.#meldViewContainer = null;
  }
  this.#currentViewingPlayer = 0; // Reset to viewing own melds
  }
  #initializePlayerMelds(): void {
  // Initialize empty meld storage for each player
  for (let i = 0; i < this.#gameState.totalPlayers; i++) {
    this.#playerMelds.set(i, {
      melds: [],
      meldData: [],
    });
  }
  }

  #updatePlayerIconStatus(playerIndex: number, hasMelds: boolean): void {
  if (playerIndex === 0) {
    this.#gameState.playerHasMelds[playerIndex] = hasMelds;
    return;
  }
  if (playerIndex < 0 || playerIndex >= this.#playerIcons.length) return;
  const icon = this.#playerIcons[playerIndex];
    if (!icon) return;

    const indicator = icon.getAt(2) as Phaser.GameObjects.Arc; // Green dot

    indicator.setVisible(hasMelds);
    this.#gameState.playerHasMelds[playerIndex] = hasMelds;
  }

  #createPhaseIndicator(): void {
  // const bg = this.add
  //   .rectangle(0, 0, 200, 50, 0x2E8B57, 0.9)
  //   //.setStrokeStyle(2, 0x1976d2);

  const text = this.add
  .text(80, 100, "DRAW A CARD", {
    fontSize: "18px",
    fontFamily: "Arial",
    color: "#ffffff",
    fontStyle: "bold",
  })
  .setOrigin(0.5);

  this.#phaseIndicator = text;
  }

  #updatePhaseUI(): void {
  // const phaseText = this.#phaseIndicator.getAt(1) as Phaser.GameObjects.Text;
  // const phaseBg = this.#phaseIndicator.getAt(
  //   0
  // ) as Phaser.GameObjects.Rectangle;

  switch (this.#gameState.phase) {
    case GamePhase.DRAW:
      this.#phaseIndicator.setText("DRAW CARD").setOrigin(0.5);
      //phaseBg.setFillStyle(0x2196f3); // Blue
      break;
    case GamePhase.MELD:
      this.#phaseIndicator.setText("MELD/DISCARD");
      //phaseBg.setFillStyle(0x4caf50); // Green
      break;
    case GamePhase.DISCARD:
      this.#phaseIndicator.setText("DISCARD");
      //phaseBg.setFillStyle(0xf44336); // Red
      break;
    case GamePhase.GAME_OVER:
      this.#phaseIndicator.setText("GAME OVER");
      //phaseBg.setFillStyle(0x9e9e9e); // Gray
      break;
  }
  }

  #transitionPhase(newPhase: GamePhase): void {
  this.#gameState.phase = newPhase;
  this.#updatePhaseUI();
  }

  #showMessage(text: string): void {
  const message = this.add
  .text(this.scale.width / 2, this.scale.height / 2 + 100, text, {
    fontSize: "24px",
    fontFamily: "Arial",
    color: "#000000",
    //backgroundColor: "#000000",
    padding: { x: 20, y: 10 },
  })
  .setOrigin(0.5)
  .setDepth(1000);

  this.tweens.add({
    targets: message,
    alpha: 0,
    y: message.y - 30,
    duration: 2000,
    ease: "Power2",
    onComplete: () => message.destroy(),
  });
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
    // PHASE CHECK:
    if (this.#gameState.phase !== GamePhase.DRAW) {
      this.#showMessage("You must be in draw phase!");
      return;
    }

    if (this.#cardsInHand.length === 15) {
      this.#showMessage("Hand is full!");
      return;
    }

    if (this.#remi.drawPile.length === 0) {
      this.#remi.shuffleDiscardPile();
      this.#showCardsInDrawPile();
      if (this.#remi.drawPile.length === 0) {
        this.#showMessage("No cards left!");
        return;
      }
    }

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
    const newCard = this.#remi.getPlayerHand(0)[this.#remi.getPlayerHand(0).length - 1]
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
    this.#gameState.hasDrawnThisTurn = true;
    this.#transitionPhase(GamePhase.MELD);

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
  .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT)
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
  const humanPlayerHand = this.#remi.getPlayerHand(0)
  humanPlayerHand.forEach((card, cardIndex) => {
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
      this.input.setDraggable(
        cardGameObject,
        !cardGameObject.getData("isSelected")
      );

      cardGameObject.setFrame(this.#getCardFrame(card));
      this.#makeCardSelectable(cardGameObject);
    }
  });
  }

  #makeCardSelectable(cardGameObject: Phaser.GameObjects.Image): void {
  let pointerDownTime = 0;
  let pointerDownPos = { x: 0, y: 0 };

  cardGameObject.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (!cardGameObject.getData("isSelected")) {
      this.input.setDraggable(cardGameObject, true);
    }
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
      // After toggle, update draggable state
      const isSelected = cardGameObject.getData("isSelected");
      this.input.setDraggable(cardGameObject, !isSelected);
    }
  });
  }

  #toggleCardSelection(cardGameObject: Phaser.GameObjects.Image): void {
  const isSelected = cardGameObject.getData("isSelected") as boolean;
  const cardRef = cardGameObject.getData("cardRef") as Card;
  //const originalY = cardGameObject.getData("originalY") as number;

  if (isSelected) {
    // cardGameObject.setData("isSelected", false);
    // this.input.setDraggable(cardGameObject, true);
    // this.#selectedCards.delete(cardGameObject);

    const meldContainingCard = this.#findMeldContainingCard(cardRef);

    if (meldContainingCard) {
      // DISBAND THE ENTIRE MELD
      this.#deselectEntireMeld(meldContainingCard);
    } else {
      // Just deselect this single card (not part of a meld)
      this.#deselectSingleCard(cardGameObject);
    }
  } else {
    // cardGameObject.setData("isSelected", true);
    // this.input.setDraggable(cardGameObject, false);
    // this.#selectedCards.add(cardGameObject);
    this.#selectSingleCard(cardGameObject);
  }
  // Validate after every selection change
  this.#validateSelectedMelds();
  }

  #findMeldContainingCard(card: Card): Card[] | null {
  // Check if this card is part of any current valid meld
  for (const meld of this.#currentMelds) {
    if (meld.includes(card)) {
      return meld;
    }
  }
  return null;
  }

  #deselectEntireMeld(meld: Card[]): void {
  // Find all game objects corresponding to cards in this meld
  meld.forEach((card) => {
    const cardGO = this.#cardsInHand.find(
      (go) => go.getData("cardRef") === card
    );

    if (cardGO && this.#selectedCards.has(cardGO)) {
      this.#deselectSingleCard(cardGO);
    }
  });
  }

  #deselectSingleCard(cardGameObject: Phaser.GameObjects.Image): void {
  cardGameObject.setData("isSelected", false);
  this.input.setDraggable(cardGameObject, true);
  this.#selectedCards.delete(cardGameObject);

  this.tweens.add({
    targets: cardGameObject,
    y: LAYOUT.PLAYER_HAND.y,
    duration: 150,
    ease: "Back.easeOut",
  });

  cardGameObject.clearTint();
  }

  #selectSingleCard(cardGameObject: Phaser.GameObjects.Image): void {
  cardGameObject.setData("isSelected", true);
  this.input.setDraggable(cardGameObject, false);
  this.#selectedCards.add(cardGameObject);

  this.tweens.add({
    targets: cardGameObject,
    y: LAYOUT.PLAYER_HAND.y - 10,
    duration: 150,
    ease: "Back.easeOut",
  });

  cardGameObject.setTint(0xffff00); // Yellow tint (will be recolored by validation)
  }

  #splitIntoMeldGroups(cardsByPosition: Card[]): Card[][] {
  const validMelds: Card[][] = [];

  if (cardsByPosition.length === 0) return validMelds;

  let currentGroup: Card[] = [cardsByPosition[0]];

    // We need to track actual hand indices to check if cards are consecutive
    const cardToIndex = new Map<Card, number>();
    this.#cardsInHand.forEach((cardGO, index) => {
      if (this.#selectedCards.has(cardGO)) {
        const card = cardGO.getData("cardRef") as Card;
        cardToIndex.set(card, index);
      }
    });

    for (let i = 1; i < cardsByPosition.length; i++) {
      const prevCard = cardsByPosition[i - 1];
      const currentCard = cardsByPosition[i];

      const prevIndex = cardToIndex.get(prevCard)!;
      const currentIndex = cardToIndex.get(currentCard)!;

      // Check if cards are physically next to each other in hand
      if (currentIndex === prevIndex + 1) {
        // ✅ NEW: Check for adjacent jokers BEFORE adding to group
        const isPrevJoker = this.#isJoker(prevCard);
        const isCurrentJoker = this.#isJoker(currentCard);

        if (isPrevJoker && isCurrentJoker) {
          // Adjacent jokers detected - break the group
          if (currentGroup.length >= 3) {
            const isValid =
            this.#remi.isValidSet(currentGroup) ||
            this.#remi.isValidRun(currentGroup);
            if (isValid) {
              validMelds.push([...currentGroup]);
            }
          }
          // Start new group with current card (the second joker)
          currentGroup = [currentCard];
          continue;
        }
        // Cards are adjacent, add to current group
        currentGroup.push(currentCard);

        // Check if current group is valid
        if (currentGroup.length >= 3) {
          const isValid =
          this.#remi.isValidSet(currentGroup) ||
          this.#remi.isValidRun(currentGroup);

          if (!isValid) {
            // Group became invalid, check if previous version was valid
            const groupWithoutLast = currentGroup.slice(0, -1);
            if (groupWithoutLast.length >= 3) {
              const wasValid =
              this.#remi.isValidSet(groupWithoutLast) ||
              this.#remi.isValidRun(groupWithoutLast);
              if (wasValid) {
                validMelds.push(groupWithoutLast);
                currentGroup = [currentCard];
              }
            }
          }
        }
      } else {
        // Cards are NOT adjacent, evaluate current group and start new one
        if (currentGroup.length >= 3) {
          const isValid =
          this.#remi.isValidSet(currentGroup) ||
          this.#remi.isValidRun(currentGroup);
          if (isValid) {
            validMelds.push([...currentGroup]);
          }
        }
        // Start new group
        currentGroup = [currentCard];
      }
    }

    // Don't forget to check the final group
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
  const selectedByPosition = this.#getSelectedCardsByHandPosition();

  // Split into groups based on validity (do this ONCE)
  this.#currentMelds = this.#splitIntoMeldGroups(selectedByPosition);

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

  #getSelectedCardsByHandPosition(): Card[] {
  // Get all selected cards with their hand positions
  const selectedWithIndices: { card: Card; index: number }[] = [];

  this.#cardsInHand.forEach((cardGO, handIndex) => {
    if (this.#selectedCards.has(cardGO)) {
      selectedWithIndices.push({
        card: cardGO.getData("cardRef") as Card,
                               index: handIndex,
      });
    }
  });
  // Sort by hand position (index), not selection order
  selectedWithIndices.sort((a, b) => a.index - b.index);

  // Return just the cards
  return selectedWithIndices.map((item) => item.card);
  }
  #updateSelectionVisuals(melds: Card[][]): void {
  const cardToMeld = new Map<Card, number>();
  melds.forEach((meld, meldIndex) => {
    meld.forEach((card) => cardToMeld.set(card, meldIndex));
  });

  const meldColors = [0x00ff00, 0x00ffff, 0xff00ff, 0xffff00];

  this.#cardsInHand.forEach((cardGO) => {
    if (this.#selectedCards.has(cardGO)) {
      const cardRef = cardGO.getData("cardRef") as Card;
      const meldIndex = cardToMeld.get(cardRef);

      if (meldIndex !== undefined) {
        cardGO.setTint(meldColors[meldIndex % meldColors.length]);
      } else {
        cardGO.setTint(0xff0000); // Invalid
      }
    }
  });
  }

  #resetSelectionVisuals(): void {
  this.#selectedCards.forEach((cardGO) => {
    cardGO.setTint(0xffff00);
  });
  }

  #makeTableMeldInteractive(
  meldVisuals: Phaser.GameObjects.Image[],
  meldIndex: number
  ): void {
    // Only after initial meld is opened
    if (!this.#hasOpenedInitialMeld) return;

    // Create drop zone for this meld (to add cards from hand)
    const position = this.#calculateMeldPositions()[meldIndex];

    const dropZone = this.add
    .zone(
      position.x,
      position.y,
      position.width + 100, // Extra space to drop
      CARD_HEIGHT * SCALE * 0.8 + 20
    )
    .setOrigin(0)
    .setRectangleDropZone(
      position.width + 100,
      CARD_HEIGHT * SCALE * 0.8 + 20
    )
    .setData({
      zoneType: "MELD_TABLE",
      meldIndex: meldIndex,
    });
  }

  #cardPointValue(card: Card): number {
  if (card.value === 1) return 10; // Ace
  if (card.value >= 11 && card.value <= 13) return 10; // J/Q/K
  if (card.value === 14) return 0; // Joker has no intrinsic value
  return card.value; // 2–10
  }

  #calculateMeldValue(meld: Card[]): number {
  // First, determine what type of meld this is
  const isRun = this.#remi.isValidRun(meld);
  const isSet = this.#remi.isValidSet(meld);

  if (!isRun && !isSet) return 0; // Invalid meld has no value

  return meld.reduce((sum, card) => {
    // If it's a joker, calculate its value based on context
    if (this.#isJoker(card)) {
      return sum + this.#getJokerValueInMeld(card, meld, isRun);
    }

    return sum + this.#cardPointValue(card);
  }, 0);
  }

  #isJoker(card: Card): boolean {
  return (
    card.suit === "JOKER_RED" ||
    card.suit === "JOKER_BLACK" ||
    card.value === 14
  );
  }

  #getJokerValueInMeld(joker: Card, meld: Card[], isRun: boolean): number {
  const regularCards = meld.filter((c) => !this.#isJoker(c));

  if (regularCards.length === 0) return 0; // Shouldn't happen in valid meld

  if (!isRun) {
    // In a SET: joker takes the value of the set
    // Example: 7♥ 7♠ JOKER → joker counts as 7
    const setValue = regularCards[0].value;

    if (setValue === 1) return 10; // Ace
    if (setValue >= 11 && setValue <= 14) return 10; // Face card
    return setValue; // Number card
  }

  // In a RUN: determine what card the joker represents
  // Example: 2♥ 3♥ JOKER → joker is 4♥, worth 4 points
  // Example: 10♥ JOKER Q♥ → joker is J♥, worth 10 points
  return this.#getJokerValueInRun(meld, regularCards);
  }

  #getJokerValueInRun(meld: Card[], regularCards: Card[]): number {
  // Sort regular cards by value to find gaps
  const sorted = [...regularCards].sort((a, b) => a.value - b.value);
  const values = new Set(sorted.map((c) => c.value));

  const minValue = sorted[0].value;
  const maxValue = sorted[sorted.length - 1].value;

  // Count jokers in the meld
  const jokerCount = meld.length - regularCards.length;

  if (jokerCount > 1) {
    return 0;
  }

  // Find the first gap in the sequence
  for (let val = minValue + 1; val < maxValue; val++) {
    if (!values.has(val)) {
      // // Found a gap - joker fills this position
      // if (val === 1) return 10; // Ace
      // if (val >= 11 && val <= 13) return 10; // Face card
      // return val; // Number card
      return this.#cardPointValue({ suit: "HEART", value: val } as Card);
    }
  }

  // No gap found - joker extends sequence at beginning or end
  // Check if joker is before the minimum
  const beforeMin = minValue - 1;
  if (beforeMin >= 1 && beforeMin <= 14) {
    if (beforeMin === 1) return 10;
    if (beforeMin >= 11 && beforeMin <= 14) return 10;
    return beforeMin;
  }

  // Joker extends after maximum
  const afterMax = maxValue + 1;
  if (afterMax >= 1 && afterMax <= 14) {
    if (afterMax === 1) return 10;
    if (afterMax >= 11 && afterMax <= 14) return 10;
    return afterMax;
  }

  // Fallback (shouldn't normally reach here)
  return 10;
  }

  #layDownMelds(): void {
  if (this.#currentMelds.length === 0) return;

  if (
    this.#gameState.phase !== GamePhase.MELD &&
    this.#gameState.phase !== GamePhase.DISCARD
  ) {
    this.#showMessage("Draw a card first!");
    return;
  }

  // Validate score requirement
  const meetsRequirement =
  this.#hasOpenedInitialMeld || this.#currentMeldScore >= 51;
  if (!meetsRequirement) return;

  // Store the melds we're laying down
  const meldsToLayDown = [...this.#currentMelds];
    const newMeldVisuals: Phaser.GameObjects.Image[][] = [];
    const newMeldData: Card[][] = [];

    meldsToLayDown.forEach((meld) => {
      const meldVisuals: Phaser.GameObjects.Image[] = [];
      const currentPlayerHand = this.#remi.getPlayerHand(this.#gameState.currentPlayer);

      meld.forEach((card) => {
        const cardIndex = currentPlayerHand.indexOf(card);
        if (cardIndex !== -1) {
          this.#remi.removeCardFromHand(this.#gameState.currentPlayer, card);
          // Find the visual card
          const visualIndex = this.#cardsInHand.findIndex(
            (go) => go.getData("cardRef") === card
          );

          if (visualIndex !== -1) {
            const cardGO = this.#cardsInHand[visualIndex];

            // Remove from selected set if it's there
            this.#selectedCards.delete(cardGO);

            // Remove from hand array
            this.#cardsInHand.splice(visualIndex, 1);

            // COMPLETELY reset card state and remove ALL listeners
            cardGO.setData("isSelected", false);
            cardGO.setData("zoneType", ZONE_TYPE.MELD_TABLE);
            cardGO.clearTint();
            cardGO.removeAllListeners(); // Remove ALL listeners first
            cardGO.disableInteractive(); // Then disable interaction
            this.input.setDraggable(cardGO, false); // Ensure not draggable

            // Store for meld table
            meldVisuals.push(cardGO);
          }
        }
      });

      // Store both visual and logic representations
      if (meldVisuals.length > 0) {
        newMeldVisuals.push(meldVisuals);
        newMeldData.push([...meld]);
      }
    });

    // Add to the laid down melds (for human player only)
    this.#laidDownMelds.push(...newMeldVisuals);
    this.#laidDownMeldData.push(...newMeldData);

    const currentPlayer = this.#gameState.currentPlayer;
    const playerData = this.#playerMelds.get(currentPlayer);
    if (playerData) {
      // For human player (index 0), store the actual visuals
      // For AI players, this shouldn't be called, but if it is, store properly
      playerData.melds.push(...newMeldVisuals);
      playerData.meldData.push(...newMeldData);
    }

    // Update icon to show player has melds
    this.#updatePlayerIconStatus(currentPlayer, true);

    // Update game state
    this.#hasOpenedInitialMeld = true;
    this.#selectedCards.clear(); // Clear the selected cards set
    this.#currentMelds = [];
    this.#currentMeldScore = 0;

    // Refresh visuals
    this.#updateCardsInHand();
    this.#updateDropZonesForHand();
    this.#updateMeldScoreDisplay();
    this.#displayMeldsOnTable(); // NEW: Arrange melds visually
  }

  #displayMeldsOnTable(): void {
  const { START_X, START_Y, MELD_SPACING_X, CARD_SPACING_IN_MELD } =
  LAYOUT.MELD_TABLE;

  // Calculate positions for all melds first
  const meldPositions = this.#calculateMeldPositions();

  this.#meldDropZones.forEach((zone) => zone.destroy());
  this.#meldDropZones = [];

  this.#laidDownMelds.forEach((meldVisuals, meldIndex) => {
    const position = meldPositions[meldIndex];

    meldVisuals.forEach((cardGO, cardIndex) => {
      const targetX = position.x + cardIndex * CARD_SPACING_IN_MELD;
      const targetY = position.y;

      // CRITICAL: Completely disable all interaction for melded cards
      cardGO.disableInteractive();
      cardGO.removeAllListeners();
      this.input.setDraggable(cardGO, false);
      cardGO.setData("zoneType", ZONE_TYPE.MELD_TABLE);
      cardGO.setData("meldIndex", meldIndex);
      cardGO.setData("isSelected", false);
      cardGO.clearTint();

      this.tweens.add({
        targets: cardGO,
        x: targetX,
        y: targetY,
        scale: SCALE * 0.8,
        duration: 300,
        ease: "Back.easeOut",
        delay: meldIndex * 100 + cardIndex * 50,
      });

      cardGO.setDepth(1 * cardIndex);
    });

    this.#createMeldDropZone(
      position.x,
      position.y,
      position.width,
      meldIndex
    );
  });
  }

  #createMeldDropZone(
  x: number,
  y: number,
  width: number,
  meldIndex: number
  ): void {
    const expansion = LAYOUT.DROP_ZONE_EXPANSION;

    const zone = this.add
    .zone(
      x - expansion / 2,
      y - expansion / 2,
      width + expansion,
      CARD_HEIGHT * SCALE * 0.8 + expansion
    )
    .setOrigin(0)
    .setRectangleDropZone(
      width + expansion,
      CARD_HEIGHT * SCALE * 0.8 + expansion
    )
    .setData({
      zoneType: ZONE_TYPE.MELD_TABLE,
      meldIndex: meldIndex,
    })
    .setDepth(-1);

    // Visual feedback on hover
    const highlight = this.add
    .rectangle(zone.x, zone.y, zone.width, zone.height, 0xffff00, 0)
    .setOrigin(0)
    .setDepth(-1);

    // Show highlight when dragging card over this zone
    this.input.on(
      "dragenter",
      (
        _pointer: Phaser.Input.Pointer,
       _gameObject: Phaser.GameObjects.GameObject,
       dropZone: Phaser.GameObjects.Zone
      ) => {
        if (dropZone === zone) {
          highlight.setAlpha(0.3);
        }
      }
    );

    this.input.on(
      "dragleave",
      (
        _pointer: Phaser.Input.Pointer,
       _gameObject: Phaser.GameObjects.GameObject,
       dropZone: Phaser.GameObjects.Zone
      ) => {
        if (dropZone === zone) {
          highlight.setAlpha(0);
        }
      }
    );

    // Clear highlight on drop
    zone.on("drop", () => {
      highlight.setAlpha(0);
    });

    this.#meldDropZones.push(zone);
  }

  #handleAddCardToMeld(
  gameObject: Phaser.GameObjects.Image,
  meldIndex: number
  ): void {
    // Check if player can add to melds (must have opened first)
    if (!this.#hasOpenedInitialMeld) {
      this.#showMessage("You must open with 51+ points first!");
      gameObject.setPosition(
        gameObject.getData("origX") as number,
                             gameObject.getData("origY") as number
      );
      return;
    }

    // Check if in correct phase
    if (
      this.#gameState.phase !== GamePhase.MELD &&
      this.#gameState.phase !== GamePhase.DISCARD
    ) {
      this.#showMessage("Draw a card first!");
      gameObject.setPosition(
        gameObject.getData("origX") as number,
                             gameObject.getData("origY") as number
      );
      return;
    }

    const cardRef = gameObject.getData("cardRef") as Card;
    if (!cardRef) {
      console.error("Card missing cardRef!");
      return;
    }

    // Get the existing meld
    const existingMeld = this.#laidDownMeldData[meldIndex];
    if (!existingMeld) {
      console.error("Meld not found!");
      return;
    }

    // Try adding the card to the meld
    const testMeld = [...existingMeld, cardRef];

    // Check if the new meld is valid
    const isValidRun = this.#remi.isValidRun(testMeld);
    const isValidSet = this.#remi.isValidSet(testMeld);

    if (!isValidRun && !isValidSet) {
      this.#showMessage("Card doesn't fit in this meld!");
      gameObject.setPosition(
        gameObject.getData("origX") as number,
                             gameObject.getData("origY") as number
      );
      return;
    }

    // Valid! Add card to meld
    this.#addCardToExistingMeld(gameObject, cardRef, meldIndex);
  }

  #addCardToExistingMeld(
  gameObject: Phaser.GameObjects.Image,
  card: Card,
  meldIndex: number
  ): void {
    // Remove from hand (logic) - use player 0 (human)
    this.#remi.removeCardFromHand(0, card);

    // Remove from hand (visual)
    const visualIndex = this.#cardsInHand.indexOf(gameObject);
    if (visualIndex !== -1) {
      this.#cardsInHand.splice(visualIndex, 1);
    }

    // Add to meld data
    this.#laidDownMeldData[meldIndex].push(card);

    // Reconfigure the game object for table display
    gameObject.setData("zoneType", ZONE_TYPE.MELD_TABLE);
    gameObject.setData("meldIndex", meldIndex);
    gameObject.setData("isSelected", false);
    gameObject.clearTint();

    gameObject.disableInteractive(); // ADD THIS
    this.input.setDraggable(gameObject, false);
    gameObject.removeAllListeners(); // ADD THIS   gameObject.clearTint();

    // Add to meld visuals
    this.#laidDownMelds[meldIndex].push(gameObject);

    // Re-display all melds with updated positions
    this.#displayMeldsOnTable();

    // Update hand
    this.#updateCardsInHand();
    this.#updateDropZonesForHand();

    this.#showMessage("Card added to meld!");
  }

  #calculateMeldPositions(): { x: number; y: number; width: number }[] {
  const {
    START_X,
    START_Y,
    MELD_SPACING_X,
    MELD_SPACING_Y,
    CARD_SPACING_IN_MELD,
  } = LAYOUT.MELD_TABLE;

  const positions: { x: number; y: number; width: number }[] = [];
  let currentX = START_X;
  let currentY = START_Y;
  let meldsInRow = 0;

  this.#laidDownMelds.forEach((meldVisuals) => {
    const meldWidth =
    CARD_SPACING_IN_MELD * (meldVisuals.length - 1) +
    CARD_WIDTH * SCALE * 0.8;

    // Wrap to next row if needed
    // if (meldsInRow >= MAX_MELDS_PER_ROW) {
    //   currentX = START_X;
    //   currentY += MELD_SPACING_Y;
    //   meldsInRow = 0;
    // }

    positions.push({ x: currentX, y: currentY, width: meldWidth });

    currentX += meldWidth + MELD_SPACING_X;
    //meldsInRow++;
  });

  return positions;
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
      gameObject.setDepth(1000);
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
      } else if (zoneType === ZONE_TYPE.MELD_TABLE) {
        // ADD THIS NEW HANDLER:
        const meldIndex = dropZone.getData("meldIndex") as number;
        this.#handleAddCardToMeld(gameObject, meldIndex);
      }
    }
  );
  }

  #handleMoveCardToDiscard(gameObject: Phaser.GameObjects.Image): void {
  if (
    this.#gameState.phase !== GamePhase.MELD &&
    this.#gameState.phase !== GamePhase.DISCARD
  ) {
    this.#showMessage("Draw a card first!");
    gameObject.setPosition(
      gameObject.getData("origX") as number,
                           gameObject.getData("origY") as number
    );
    return;
  }

  const cardRef = gameObject.getData("cardRef") as Card;

  if (!cardRef) {
    console.error("Card missing cardRef data!");
    gameObject.destroy();
    return;
  }

  // Find the card in the logic layer (player 0's hand)
  const currentPlayerHand = this.#remi.getPlayerHand(0);
  const currentCardIndex = currentPlayerHand.indexOf(cardRef);

  if (currentCardIndex === -1) {
    console.error("Card not found in hand!", cardRef);
    gameObject.destroy();
    return;
  }

  this.#remi.discardCard(0, cardRef);

  this.#discardPileCard.setFrame(this.#getCardFrame(cardRef));

  // Remove from visual layer
  const visualIndex = this.#cardsInHand.indexOf(gameObject);
  if (visualIndex !== -1) {
    this.#cardsInHand.splice(visualIndex, 1);
  }
  gameObject.destroy();

  // Refresh hand
  this.#updateCardsInHand();
  this.#updateDropZonesForHand();

  this.#endTurn();
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
    const playerHand = this.#remi.getPlayerHand(0);
    const [movedLogicCard] = playerHand.splice(currentCardIndex, 1);
    const [movedGameObject] = this.#cardsInHand.splice(currentCardIndex, 1);

    // 2. Insert the card into the target position
    playerHand.splice(targetPosition, 0, movedLogicCard);
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
    )
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
  #endTurn(): void {
  this.#gameState.currentPlayer =
  (this.#gameState.currentPlayer + 1) % this.#gameState.totalPlayers;
  if (this.#gameState.currentPlayer === 0) {
    // Human player
    this.#transitionPhase(GamePhase.DRAW);
  } else {
    // AI turn
    this.time.delayedCall(800, () => {
      this.#aiTakeTurn();
    });
  }
  }
  #aiTakeTurn(): void {
  if (this.#gameState.currentPlayer !== 1) return;

  const aiHand = this.#remi.getPlayerHand(1);
    let drewFromDiscard = false;

    // === STEP 1: Smart draw decision ===
    if (this.#remi.discardPile.length > 0) {
      const topDiscard = this.#remi.discardPile[this.#remi.discardPile.length - 1];

      // Check if this card helps us
      if (this.#shouldTakeDiscard(aiHand, topDiscard)) {
        this.#remi.drawFromDiscard(1);
        this.#discardPileCard.setVisible(this.#remi.discardPile.length > 0);
        if (this.#remi.discardPile.length > 0) {
          this.#discardPileCard.setFrame(
            this.#getCardFrame(
              this.#remi.discardPile[this.#remi.discardPile.length - 1]
            )
          );
        }
        drewFromDiscard = true;
      }
    }

    // Draw from deck if didn't take discard
    if (!drewFromDiscard) {
      if (this.#remi.drawPile.length > 0) {
        this.#remi.drawCard(1);
      } else {
        this.#remi.shuffleDiscardPile();
        if (this.#remi.drawPile.length > 0) {
          this.#remi.drawCard(1);
        } else {
          this.#endTurn();
          return;
        }
      }
    }

    // === STEP 2: Meld decision ===
    const updatedAiHand = this.#remi.getPlayerHand(1);
    const hasOpened = this.#gameState.playerHasMelds[1];

    if (!hasOpened) {
      // Try to open with 51+ points
      const bestMeldCombination = this.#findBestMeldCombination(updatedAiHand);
      if (bestMeldCombination.score >= 51) {
        this.#aiLayDownMelds(bestMeldCombination.melds);
      }
    } else {
      // After opening, lay down any valid melds
      const allMelds = this.#findAllValidMelds(updatedAiHand);
      if (allMelds.length > 0) {
        this.#aiLayDownMelds(allMelds);
      }

      // TODO: Try to add cards to existing melds on table
      // This would be an advanced feature for later
    }

    // === STEP 3: Smart discard ===
    const finalAiHand = this.#remi.getPlayerHand(1);
    if (finalAiHand.length > 0) {
      const cardToDiscard = this.#selectSmartDiscard(finalAiHand);
      this.#remi.discardCard(1, cardToDiscard);
      this.#discardPileCard.setFrame(this.#getCardFrame(cardToDiscard));
      this.#discardPileCard.setVisible(true);
    }

    this.#endTurn();
  }

  #shouldTakeDiscard(hand: Card[], discardCard: Card): boolean {
  // Don't take if hand is full
  if (hand.length >= 14) return false;

  const testHand = [...hand, discardCard];

    // Strategy 1: Does it complete an immediate meld?
    const currentMelds = this.#findAllValidMelds(hand);
    const newMelds = this.#findAllValidMelds(testHand);

    if (newMelds.length > currentMelds.length) {
      return true; // Completes a meld!
    }

    // Strategy 2: Does it get us closer to a meld? (within 1 card)
    const getsCloser = this.#cardGetsCloserToMeld(hand, discardCard);

    // Strategy 3: Is it a useful card? (joker, ace, or face card)
    const isValuable = this.#isJoker(discardCard) ||
    discardCard.value === 1 ||
    discardCard.value >= 10;

    // Take if it gets us closer OR if it's valuable (60% chance for valuable cards)
    return getsCloser || (isValuable && Math.random() < 0.6);
  }

  #cardGetsCloserToMeld(hand: Card[], newCard: Card): boolean {
  // Check for potential sets (2 of same value)
  const sameValueCount = hand.filter(c =>
  !this.#isJoker(c) && !this.#isJoker(newCard) && c.value === newCard.value
  ).length;

  if (sameValueCount >= 1) return true; // Would make a pair

  // Check for potential runs (cards within 2 of each other in same suit)
  const sameSuitCards = hand.filter(c =>
  !this.#isJoker(c) && c.suit === newCard.suit
  );

  for (const card of sameSuitCards) {
    const diff = Math.abs(card.value - newCard.value);
    if (diff <= 2 && diff >= 1) return true; // Close to forming a run
  }

  return false;
  }

  #findBestMeldCombination(hand: Card[]): { melds: Card[][], score: number } {
  // Try to find the combination of melds that gives the highest score
  // This is a simplified greedy approach

  const allPossibleMelds = this.#findAllPossibleMelds(hand);
  const usedCards = new Set<Card>();
  const selectedMelds: Card[][] = [];
  let totalScore = 0;

  // Sort melds by value (highest first)
  allPossibleMelds.sort((a, b) =>
  this.#calculateMeldValue(b) - this.#calculateMeldValue(a)
  );

  // Greedily select non-overlapping melds
  for (const meld of allPossibleMelds) {
    const hasOverlap = meld.some(card => usedCards.has(card));

    if (!hasOverlap) {
      selectedMelds.push(meld);
      totalScore += this.#calculateMeldValue(meld);
      meld.forEach(card => usedCards.add(card));
    }
  }

  return { melds: selectedMelds, score: totalScore };
  }

  #findAllPossibleMelds(hand: Card[]): Card[][] {
  const melds: Card[][] = [];

  // Find all possible sets (3-4 of same value)
  const valueGroups = new Map<number, Card[]>();
  hand.forEach(card => {
    if (this.#isJoker(card)) return; // Handle jokers separately
    if (!valueGroups.has(card.value)) {
      valueGroups.set(card.value, []);
    }
    valueGroups.get(card.value)!.push(card);
  });

  // Check each value group for sets
  valueGroups.forEach((cards) => {
    if (cards.length >= 3) {
      // Try all combinations of 3 or 4
      for (let i = 0; i < cards.length - 2; i++) {
        for (let j = i + 1; j < cards.length - 1; j++) {
          for (let k = j + 1; k < cards.length; k++) {
            const testSet = [cards[i], cards[j], cards[k]];
            if (this.#remi.isValidSet(testSet)) {
              melds.push(testSet);
            }
            // Try with 4 cards if possible
            if (k + 1 < cards.length) {
              const testSet4 = [...testSet, cards[k + 1]];
              if (this.#remi.isValidSet(testSet4)) {
                melds.push(testSet4);
              }
            }
          }
        }
      }
    }
  });

  // Find all possible runs (3+ consecutive cards of same suit)
  const suitGroups = new Map<string, Card[]>();
  hand.forEach(card => {
    if (this.#isJoker(card)) return;
    if (!suitGroups.has(card.suit)) {
      suitGroups.set(card.suit, []);
    }
    suitGroups.get(card.suit)!.push(card);
  });

  suitGroups.forEach((cards) => {
    if (cards.length >= 3) {
      cards.sort((a, b) => a.value - b.value);

      // Try all possible runs of length 3+
      for (let i = 0; i < cards.length - 2; i++) {
        for (let j = i + 2; j < cards.length; j++) {
          const testRun = cards.slice(i, j + 1);
          if (this.#remi.isValidRun(testRun)) {
            melds.push(testRun);
          }
        }
      }
    }
  });

  // Add jokers to existing melds (simplified - just try adding to each meld)
  const jokers = hand.filter(c => this.#isJoker(c));
  if (jokers.length > 0) {
    const meldsWithJokers: Card[][] = [];
    melds.forEach(meld => {
      jokers.forEach(joker => {
        const testMeld = [...meld, joker];
        if (this.#remi.isValidRun(testMeld) || this.#remi.isValidSet(testMeld)) {
          meldsWithJokers.push(testMeld);
        }
      });
    });
    melds.push(...meldsWithJokers);
  }

  return melds;
  }

  #findAllValidMelds(hand: Card[]): Card[][] {
  // Similar to findBestMeldCombination but returns all non-overlapping melds
  const allPossibleMelds = this.#findAllPossibleMelds(hand);
  const usedCards = new Set<Card>();
  const selectedMelds: Card[][] = [];

  // Sort by value
  allPossibleMelds.sort((a, b) =>
  this.#calculateMeldValue(b) - this.#calculateMeldValue(a)
  );

  for (const meld of allPossibleMelds) {
    const hasOverlap = meld.some(card => usedCards.has(card));

    if (!hasOverlap) {
      selectedMelds.push(meld);
      meld.forEach(card => usedCards.add(card));
    }
  }

  return selectedMelds;
  }

  #aiLayDownMelds(melds: Card[][]): void {
  if (melds.length === 0) return;

  const meldCards = new Set<Card>();
    melds.forEach(m => m.forEach(c => meldCards.add(c)));

    // Remove from hand
    meldCards.forEach(card => {
      this.#remi.removeCardFromHand(1, card);
    });

    // Store in player melds
    const playerData = this.#playerMelds.get(1)!;
    playerData.meldData.push(...melds);

    // Create dummy visuals
    const dummyVisuals = melds.map((meld) =>
    meld.map((card) => {
      const frame = this.#getCardFrame(card);
      return this.add
      .image(0, 0, ASSET_KEYS.CARDS, frame)
      .setVisible(false);
    })
    );
    playerData.melds.push(...dummyVisuals);

    this.#updatePlayerIconStatus(1, true);
  }

  #selectSmartDiscard(hand: Card[]): Card {
  // Strategy: Keep cards that are close to forming melds
  // Discard high-value cards that don't fit anywhere

  const cardScores = hand.map(card => ({
    card,
    score: this.#evaluateCardKeepValue(card, hand)
  }));

  // Sort by score (lowest = least useful = discard first)
  cardScores.sort((a, b) => a.score - b.score);

  // Return the least useful card
  return cardScores[0].card;
  }

  #evaluateCardKeepValue(card: Card, hand: Card[]): number {
  let score = 0;

  // Jokers are always valuable
  if (this.#isJoker(card)) return 1000;

  // Check how many cards of same value we have (potential set)
  const sameValue = hand.filter(c =>
  !this.#isJoker(c) && c !== card && c.value === card.value
  ).length;
  score += sameValue * 30;

  // Check how many cards of same suit nearby (potential run)
  const sameSuitNearby = hand.filter(c =>
  !this.#isJoker(c) &&
  c !== card &&
  c.suit === card.suit &&
  Math.abs(c.value - card.value) <= 2
  ).length;
  score += sameSuitNearby * 25;

  // Aces and face cards are more valuable
  if (card.value === 1 || card.value >= 10) {
    score += 15;
  }

  // Middle value cards (5-9) are more versatile for runs
  if (card.value >= 5 && card.value <= 9) {
    score += 10;
  }

  // Penalty for high point value (we want to get rid of high cards if they don't fit)
  score -= this.#cardPointValue(card) * 0.5;

  return score;
  }

}
