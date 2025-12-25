// client/scenes/managers/HandManager.ts
import * as Phaser from "phaser";
import { Card } from "../../lib/card";
import { CardData } from "../../../shared/types/socket-events";
import { MeldValidator, GAME_CONFIG } from "../../../shared";
import { DEPTHS, CARD_WIDTH, CARD_HEIGHT, ASSET_KEYS } from "../common";

// =============================================================================
// CONSTANTS
// =============================================================================

const SCALE = 1;

const SUIT_FRAMES: Record<string, number> = {
  HEART: 26,
  DIAMOND: 13,
  SPADE: 39,
  CLUB: 0,
  JOKER_RED: 52,
  JOKER_BLACK: 53,
};

export const HAND_LAYOUT = {
  MAX_HAND_WIDTH: 570 * 2,
  CARD_SPACING: 38 * 2,
  MIN_SCALE: 0.4,
  MAX_CARDS_IN_HAND: 15,
  PLAYER_HAND: { x: 60, y: 580 },
  ANIMATION_DURATION: 300,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface CardGameObject extends Phaser.GameObjects.Image {
  cardData?: Card | CardData;
  labelText?: Phaser.GameObjects.Text;
}

export interface HandLayout {
  startX: number;
  spacing: number;
  scaleFactor: number;
  numCards: number;
}

export interface SelectionValidation {
  isValid: boolean;
  validMelds: Card[][];
  error?: string;
}

// =============================================================================
// HAND MANAGER
// =============================================================================

/**
 * Manages the player's hand - card sprites, selection, layout, and drop zones.
 *
 * Responsibilities:
 * - Creating and destroying card sprites
 * - Managing card selection state
 * - Calculating and animating hand layout
 * - Managing hand drop zones for reordering
 * - Validating meld selections
 */
export class HandManager {
  private scene: Phaser.Scene;

  // Card state
  private handSprites: CardGameObject[] = [];
  private handCards: Card[] = [];
  private selectedCards: Set<CardGameObject> = new Set();
  private handDropZones: Phaser.GameObjects.Zone[] = [];

  // Meld validation state
  private currentValidMelds: Card[][] = [];

  // Configuration callbacks
  private isMultiplayer: () => boolean;
  private getCardId: (card: Card) => string;
  private hasPlayerOpened: () => boolean;
  private onSelectionChanged?: () => void;

  constructor(
    scene: Phaser.Scene,
    config: {
      isMultiplayer: () => boolean;
      getCardId: (card: Card) => string;
      hasPlayerOpened: () => boolean;
      onSelectionChanged?: () => void;
    }
  ) {
    this.scene = scene;
    this.isMultiplayer = config.isMultiplayer;
    this.getCardId = config.getCardId;
    this.hasPlayerOpened = config.hasPlayerOpened;
    this.onSelectionChanged = config.onSelectionChanged;
  }

  // ===========================================================================
  // PUBLIC API - HAND MANAGEMENT
  // ===========================================================================

  /**
   * Get current hand cards
   */
  getHandCards(): Card[] {
    return [...this.handCards];
  }

  /**
   * Get current hand sprites
   */
  getHandSprites(): CardGameObject[] {
    return [...this.handSprites];
  }

  /**
   * Set the hand data and create visuals
   */
  setHand(cards: Card[]): void {
    this.handCards = [...cards];
    this.createHandVisuals();
  }

  /**
   * Add a card to the hand
   */
  addCard(card: Card, fromX?: number, fromY?: number): CardGameObject {
    this.handCards.push(card);

    const startX = fromX ?? this.scene.scale.width / 2;
    const startY = fromY ?? HAND_LAYOUT.PLAYER_HAND.y;

    const cardGO = this.createCardSprite(card, startX, startY);
    this.handSprites.push(cardGO);

    // Animate to hand position
    const targetX = this.calculateHandPosition(this.handSprites.length - 1);
    this.scene.tweens.add({
      targets: cardGO,
      x: targetX,
      y: HAND_LAYOUT.PLAYER_HAND.y,
      duration: HAND_LAYOUT.ANIMATION_DURATION,
      ease: "Back.easeOut",
      onStart: () => cardGO.setDepth(30),
      onComplete: () => {
        this.makeCardInteractive(cardGO);
        this.updateHandDisplay();
        this.updateHandDropZones();
      },
    });

    return cardGO;
  }

  /**
   * Remove a card from the hand by card data
   */
  removeCard(card: Card): CardGameObject | null {
    const index = this.handSprites.findIndex(
      (go) => (go.cardData as Card)?.id === card.id
    );

    if (index === -1) return null;

    const cardGO = this.handSprites[index];
    this.handSprites.splice(index, 1);
    this.handCards.splice(index, 1);

    // Remove from selection if selected
    if (this.selectedCards.has(cardGO)) {
      this.selectedCards.delete(cardGO);
    }

    return cardGO;
  }

  /**
   * Remove cards that match the given IDs
   */
  removeCardsByIds(cardIds: Set<string>): CardGameObject[] {
    const removed: CardGameObject[] = [];

    this.handSprites = this.handSprites.filter((sprite) => {
      const card = sprite.cardData as Card;
      if (cardIds.has(card.id)) {
        this.destroyCardSafely(sprite);
        removed.push(sprite);
        return false;
      }
      return true;
    });

    this.handCards = this.handCards.filter((card) => !cardIds.has(card.id));
    this.updateHandDisplay();
    this.updateHandDropZones();

    return removed;
  }

  /**
   * Reorder card in hand (for drag-drop reordering)
   */
  reorderCard(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= this.handSprites.length) return;
    if (toIndex < 0 || toIndex >= this.handSprites.length) return;

    // Update sprites array
    const [movedSprite] = this.handSprites.splice(fromIndex, 1);
    this.handSprites.splice(toIndex, 0, movedSprite);

    // Update cards array
    const [movedCard] = this.handCards.splice(fromIndex, 1);
    this.handCards.splice(toIndex, 0, movedCard);

    this.updateHandDisplay();
    this.updateHandDropZones();
  }

  /**
   * Find sprite by card index in hand
   */
  getSpriteByIndex(index: number): CardGameObject | null {
    return this.handSprites[index] ?? null;
  }

  /**
   * Find sprite index for a card game object
   */
  getSpriteIndex(cardGO: CardGameObject): number {
    return this.handSprites.indexOf(cardGO);
  }

  // ===========================================================================
  // PUBLIC API - SELECTION
  // ===========================================================================

  /**
   * Handle card click - toggles selection
   */
  handleCardClick(cardGO: CardGameObject): void {
    if (this.selectedCards.has(cardGO)) {
      const card = cardGO.cardData as Card;
      if (card) {
        const meldContainingCard = this.findMeldContainingCard(card);
        if (meldContainingCard) {
          this.deselectEntireMeld(meldContainingCard);
        } else {
          this.deselectCard(cardGO);
        }
      } else {
        this.deselectCard(cardGO);
      }
    } else {
      this.selectCard(cardGO);
    }

    this.validateCurrentSelection();
  }

  findCardSprite(card: Card): CardGameObject | null {
  return this.handSprites.find(
    go => (go.cardData as Card)?.id === card.id
  ) || null;
}

  /**
   * Select a card
   */
  selectCard(cardGO: CardGameObject): void {
    this.selectedCards.add(cardGO);
    cardGO.setTint(0xffff00);

    this.scene.tweens.add({
      targets: cardGO,
      y: HAND_LAYOUT.PLAYER_HAND.y - 10,
      duration: 100,
      ease: "Back.easeOut",
    });

    this.scene.input.setDraggable(cardGO, false);
  }

  /**
   * Deselect a card
   */
  deselectCard(cardGO: CardGameObject): void {
    this.selectedCards.delete(cardGO);
    cardGO.clearTint();

    this.scene.tweens.add({
      targets: cardGO,
      y: HAND_LAYOUT.PLAYER_HAND.y,
      duration: 100,
      ease: "Back.easeOut",
    });

    this.scene.input.setDraggable(cardGO, true);
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedCards.forEach((cardGO) => {
      cardGO.clearTint();
      cardGO.setY(HAND_LAYOUT.PLAYER_HAND.y);
      if (cardGO.input) {
        this.scene.input.setDraggable(cardGO, false);
      }
    });
    this.selectedCards.clear();
    this.currentValidMelds = [];
    this.onSelectionChanged?.();
  }

  clearHand(): void {
    // Destroy all card sprites
    this.handSprites.forEach((sprite) => {
      this.scene.tweens.killTweensOf(sprite);
      sprite.removeAllListeners();
      sprite.destroy();
    });
    this.handSprites = [];
    this.handCards = [];

    // Clear drop zones
    this.handDropZones.forEach((zone) => zone.destroy());
    this.handDropZones = [];

    // Clear selection
    this.clearSelection();
  }

  /**
   * Get selected cards in hand order
   */
  getSelectedCardsInOrder(): Card[] {
    const selectedWithIndices: Array<{ card: Card; index: number }> = [];

    this.handSprites.forEach((cardGO, handIndex) => {
      if (this.selectedCards.has(cardGO)) {
        const card = cardGO.cardData as Card;
        if (card) {
          selectedWithIndices.push({ card, index: handIndex });
        }
      }
    });

    selectedWithIndices.sort((a, b) => a.index - b.index);
    return selectedWithIndices.map((item) => item.card);
  }

  /**
   * Get the current valid melds from selection
   */
  getCurrentValidMelds(): Card[][] {
    return this.currentValidMelds;
  }

  /**
   * Check if any cards are selected
   */
  hasSelection(): boolean {
    return this.selectedCards.size > 0;
  }

  /**
   * Get selected card count
   */
  getSelectionCount(): number {
    return this.selectedCards.size;
  }

  /**
   * Check if a specific card is selected
   */
  isSelected(cardGO: CardGameObject): boolean {
    return this.selectedCards.has(cardGO);
  }

  // ===========================================================================
  // PUBLIC API - DISPLAY
  // ===========================================================================

  /**
   * Update hand display positions with animation
   */
  updateHandDisplay(): void {
    const layout = this.calculateHandLayout();
    if (layout.numCards === 0) return;

    this.handSprites.forEach((sprite, index) => {
      const finalX = layout.startX + index * layout.spacing;
      const isSelected = this.selectedCards.has(sprite);

      this.scene.tweens.add({
        targets: sprite,
        x: finalX,
        y: isSelected
          ? HAND_LAYOUT.PLAYER_HAND.y - 10
          : HAND_LAYOUT.PLAYER_HAND.y,
        duration: HAND_LAYOUT.ANIMATION_DURATION,
        ease: "Sine.easeOut",
      });

      sprite.setData("cardIndex", index);
      sprite.setData("zoneType", "CARDS_IN_HAND");
    });
  }

  /**
   * Update drop zones for hand reordering
   */
  updateHandDropZones(): void {
    // Clear existing zones
    this.handDropZones.forEach((zone) => zone.destroy());
    this.handDropZones = [];

    const layout = this.calculateHandLayout();
    if (layout.numCards === 0) return;

    // Create new zones
    this.handSprites.forEach((sprite, index) => {
      const finalX = layout.startX + index * layout.spacing;
      const zone = this.scene.add
        .zone(
          finalX,
          HAND_LAYOUT.PLAYER_HAND.y,
          CARD_WIDTH,
          CARD_HEIGHT * SCALE
        )
        .setRectangleDropZone(CARD_WIDTH * SCALE, CARD_HEIGHT * SCALE)
        .setOrigin(0)
        .setData({
          zoneType: "CARDS_IN_HAND",
          positionIndex: index,
        })
        .setDepth(-1);

      this.handDropZones.push(zone);
    });
  }

  /**
   * Get hand drop zones
   */
  getHandDropZones(): Phaser.GameObjects.Zone[] {
    return this.handDropZones;
  }

  // ===========================================================================
  // PUBLIC API - UTILITIES
  // ===========================================================================

  /**
   * Get the frame number for a card
   */
  getCardFrame(card: Card | CardData): number {
    if (
      card.value === 14 ||
      card.suit === "JOKER_RED" ||
      card.suit === "JOKER_BLACK"
    ) {
      return card.suit === "JOKER_RED" ? 52 : 53;
    }
    return (SUIT_FRAMES[card.suit] || 0) + card.value - 1;
  }

  /**
   * Create a card sprite (public for external use like draw animations)
   */
  createCardSprite(
    card: Card | CardData,
    x: number,
    y: number
  ): CardGameObject {
    const frame = this.getCardFrame(card);

    const sprite = this.scene.add
      .image(x, y, ASSET_KEYS.CARDS, frame)
      .setOrigin(0)
      .setScale(SCALE)
      .setInteractive()
      .setData({
        cardId: card.id,
        isSelected: false,
      }) as CardGameObject;

    if ((card as Card).isFaceUp) {
      this.scene.input.setDraggable(sprite);
    }

    sprite.setScale(SCALE);
    sprite.setDepth(DEPTHS.CARDS);
    sprite.cardData = card;

    return sprite;
  }

  /**
   * Make a card interactive (clickable, draggable)
   */
  makeCardInteractive(cardGO: CardGameObject): void {
    cardGO.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(cardGO, true);

    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    cardGO.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointerDownTime = this.scene.time.now;
      pointerDownPos = { x: pointer.x, y: pointer.y };
    });

    cardGO.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const distance = Phaser.Math.Distance.Between(
        pointerDownPos.x,
        pointerDownPos.y,
        pointer.x,
        pointer.y
      );
      const duration = this.scene.time.now - pointerDownTime;

      // Click (not drag) - toggle selection
      if (distance < 10 && duration < 300) {
        this.handleCardClick(cardGO);
      }
    });
  }

  /**
   * Safely destroy a card game object
   */
  destroyCardSafely(cardGO: Phaser.GameObjects.Image | CardGameObject): void {
    if (!cardGO || !cardGO.scene) return;

    this.scene.tweens.killTweensOf(cardGO);
    cardGO.removeAllListeners();

    try {
      this.scene.input.setDraggable(cardGO, false);
    } catch (e) {
      // Ignore
    }

    // Destroy label text if exists
    if ((cardGO as CardGameObject).labelText) {
      (cardGO as CardGameObject).labelText!.destroy();
    }

    cardGO.destroy();
  }

  /**
   * Clean up all hand resources
   */
  destroy(): void {
    this.handSprites.forEach((sprite) => this.destroyCardSafely(sprite));
    this.handSprites = [];
    this.handCards = [];
    this.selectedCards.clear();
    this.handDropZones.forEach((zone) => zone.destroy());
    this.handDropZones = [];
    this.currentValidMelds = [];
  }

  // ===========================================================================
  // PRIVATE - LAYOUT CALCULATION
  // ===========================================================================

  private calculateHandPosition(index: number): number {
    const totalCards = Math.max(this.handSprites.length, index + 1);
    const spacing = Math.min(
      HAND_LAYOUT.CARD_SPACING,
      HAND_LAYOUT.MAX_HAND_WIDTH / totalCards
    );
    const totalWidth = (totalCards - 1) * spacing;
    const startX = (this.scene.scale.width - totalWidth) / 2;
    return startX + index * spacing;
  }

  private calculateHandLayout(): HandLayout {
    const numCards = this.handSprites.length;

    if (numCards === 0) {
      return {
        startX: HAND_LAYOUT.PLAYER_HAND.x,
        spacing: 0,
        scaleFactor: 1,
        numCards: 0,
      };
    }

    // Calculate how wide the hand would be without scaling
    const unscaledTotalWidth =
      CARD_WIDTH + (numCards - 1) * HAND_LAYOUT.CARD_SPACING;

    // Scale down if too wide, but never smaller than MIN_SCALE
    let scaleFactor = Math.min(
      1,
      HAND_LAYOUT.MAX_HAND_WIDTH / unscaledTotalWidth
    );
    scaleFactor = Math.max(scaleFactor, HAND_LAYOUT.MIN_SCALE);

    // Calculate actual width after scaling
    const scaledTotalWidth =
      CARD_WIDTH * scaleFactor +
      (numCards - 1) * (HAND_LAYOUT.CARD_SPACING * scaleFactor);

    // Center the hand by calculating empty space on sides
    const emptySpace = HAND_LAYOUT.MAX_HAND_WIDTH - scaledTotalWidth;
    const startX = HAND_LAYOUT.PLAYER_HAND.x + emptySpace / 2;
    const spacing = HAND_LAYOUT.CARD_SPACING * scaleFactor;

    return { startX, spacing, scaleFactor, numCards };
  }

  // ===========================================================================
  // PRIVATE - HAND CREATION
  // ===========================================================================

  private createHandVisuals(): void {
    // Clear existing sprites
    this.handSprites.forEach((sprite) => this.destroyCardSafely(sprite));
    this.handSprites = [];

    this.handCards.forEach((card, index) => {
      const x = this.calculateHandPosition(index);
      const cardGO = this.createCardSprite(card, x, HAND_LAYOUT.PLAYER_HAND.y);
      this.makeCardInteractive(cardGO);
      this.handSprites.push(cardGO);
    });

    this.updateHandDisplay();
    this.updateHandDropZones();
  }

  // ===========================================================================
  // PRIVATE - SELECTION HELPERS
  // ===========================================================================

  private findMeldContainingCard(card: Card): Card[] | null {
    const cardId = this.getCardId(card);

    for (const meld of this.currentValidMelds) {
      const found = meld.some((m) => this.getCardId(m) === cardId);
      if (found) {
        return meld;
      }
    }
    return null;
  }

  private deselectEntireMeld(meld: Card[]): void {
    meld.forEach((card) => {
      const cardId = this.getCardId(card);

      const cardGO = this.handSprites.find((go) => {
        const goCard = go.cardData as Card;
        if (!goCard) return false;
        return this.getCardId(goCard) === cardId;
      });

      if (cardGO && this.selectedCards.has(cardGO)) {
        this.deselectCard(cardGO);
      }
    });
  }

  private validateCurrentSelection(): void {
    const selectedCards = this.getSelectedCardsInOrder();

    if (selectedCards.length < 3) {
      this.currentValidMelds = [];
      this.onSelectionChanged?.();
      return;
    }

    const hasOpened = this.hasPlayerOpened();

    // Convert to CardData for validator
    const cardDataArray = selectedCards.map((card) =>
      this.cardToCardData(card)
    );

    // Use MeldValidator directly
    const validation = MeldValidator.validateMelds(
      cardDataArray,
      hasOpened,
      GAME_CONFIG.OPENING_REQUIREMENT
    );

    if (validation.isValid && validation.validMelds.length > 0) {
      // Convert CardData[][] back to Card[][] and store
      this.currentValidMelds = this.cardDataMeldsToCards(
        validation.validMelds,
        selectedCards
      );
      this.updateMeldVisualFeedback(validation);
    } else {
      this.currentValidMelds = [];
      // Show invalid cards in yellow
      this.selectedCards.forEach((cardGO) => {
        cardGO.setTint(0xffffc5);
      });
    }

    this.onSelectionChanged?.();
  }

  private cardToCardData(card: Card): CardData {
    return {
      id: this.getCardId(card),
      suit: card.suit,
      value: card.value,
      isFaceUp: card.isFaceUp ?? true,
    };
  }

  private cardDataMeldsToCards(
    meldData: CardData[][],
    selectedCards: Card[]
  ): Card[][] {
    return meldData.map((meld) =>
      meld
        .map((cardData) => {
          return selectedCards.find(
            (card) => this.getCardId(card) === cardData.id
          );
        })
        .filter((c): c is Card => c !== undefined)
    );
  }

  private updateMeldVisualFeedback(result: {
    validMelds?: CardData[][];
  }): void {
    if (!result.validMelds) return;

    // Map card IDs to meld index
    const cardIdToMeld = new Map<string, number>();
    result.validMelds.forEach((meld: CardData[], meldIndex: number) => {
      meld.forEach((card) => cardIdToMeld.set(card.id, meldIndex));
    });

    const meldColors = [0x00ff00, 0x00ffff, 0xff00ff, 0xffff00];

    this.selectedCards.forEach((cardGO) => {
      const card = cardGO.cardData as Card;
      if (!card) return;

      const cardId = this.getCardId(card);
      const meldIndex = cardIdToMeld.get(cardId);

      if (meldIndex !== undefined) {
        const color = meldColors[meldIndex % meldColors.length];
        cardGO.setTint(color);
      } else {
        cardGO.setTint(0xffffc5); // Invalid - yellow
      }
    });
  }
}
