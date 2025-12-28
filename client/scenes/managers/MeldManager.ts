// client/scenes/managers/MeldManager.ts
import * as Phaser from "phaser";
import { Card } from "../../lib/card";
import { CardData } from "../../../shared/types/socket-events";
import { DEPTHS, CARD_WIDTH, CARD_HEIGHT, ASSET_KEYS } from "../common";

// =============================================================================
// CONSTANTS
// =============================================================================

const SUIT_FRAMES: Record<string, number> = {
  HEART: 26,
  DIAMOND: 13,
  SPADE: 39,
  CLUB: 0,
  JOKER_RED: 52,
  JOKER_BLACK: 53,
};

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

export const MELD_CONFIG = {
  START_X: 0.2,
  START_Y: 0.7,
  CARD_OVERLAP: 0.01,
  MELD_SPACING: 0.15,
  ROW_SPACING: 0.1,
  MAX_MELDS_PER_ROW: 5,
  CARD_SCALE: 1,
  DROP_ZONE_PADDING: 25,
  ANIMATION_DURATION: 400,
  STAGGER_DELAY: 50,
} as const;

const OPPONENT_MELD_CONFIG = {
  START_X: 0.2,
  START_Y: 0.15,
  MELD_SPACING: 0.15,
  ROW_SPACING: 0.1,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface PlayerMeld {
  meldIndex: number;
  meldOwner: number;
  cards: Phaser.GameObjects.Image[];
  cardData: Card[];
  position: { x: number; y: number };
  dropZone: Phaser.GameObjects.Zone | null;
  highlight: Phaser.GameObjects.Rectangle | null;
}

export interface MeldManagerConfig {
  isMultiplayer: () => boolean;
  getMyPlayerIndex: () => number;
  getOpponentIndex: (playerIndex: number) => number;
  showMessage: (text: string) => void;
}

export interface JokerReplacementResult {
  replacedJoker: Card;
  jokerStartPosition: { x: number; y: number };
}

// =============================================================================
// MELD MANAGER
// =============================================================================

/**
 * Manages meld display, drop zones, and opponent meld viewing.
 *
 * Responsibilities:
 * - Creating and managing meld visuals for all players
 * - Creating drop zones for adding cards to melds
 * - Handling opponent meld display (show/hide on demand)
 * - Managing joker replacement visuals
 * - Calculating meld positions
 */
export class MeldManager {
  private scene: Phaser.Scene;

  // Meld state
  private allPlayerMelds: Map<number, PlayerMeld[]> = new Map();

  // Opponent meld viewing
  private displayedOpponentMelds: number | null = null;
  private opponentMeldDisplay: Phaser.GameObjects.Container | null = null;

  // Configuration callbacks
  private config: MeldManagerConfig;

  constructor(scene: Phaser.Scene, config: MeldManagerConfig) {
    this.scene = scene;
    this.config = config;
  }

  // ===========================================================================
  // PUBLIC API - MELD STATE
  // ===========================================================================

  /**
   * Get all melds for a player
   */
  getPlayerMelds(playerIndex: number): PlayerMeld[] {
    return this.allPlayerMelds.get(playerIndex) || [];
  }

  /**
   * Get a specific meld by owner and index
   */
  getMeld(meldOwner: number, meldIndex: number): PlayerMeld | null {
    const playerMelds = this.allPlayerMelds.get(meldOwner) || [];
    return playerMelds.find((m) => m.meldIndex === meldIndex) ?? null;
  }

  /**
   * Check if a player has any melds
   */
  hasPlayerMelds(playerIndex: number): boolean {
    const melds = this.allPlayerMelds.get(playerIndex);
    return melds !== undefined && melds.length > 0;
  }

  /**
   * Get total meld count for a player
   */
  getMeldCount(playerIndex: number): number {
    return this.getPlayerMelds(playerIndex).length;
  }

  /**
   * Initialize meld storage for players
   */
  initializeForPlayers(numPlayers: number): void {
    this.allPlayerMelds.clear();
    for (let i = 0; i < numPlayers; i++) {
      this.allPlayerMelds.set(i, []);
    }
  }

  private getDynamicScale(): number {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    
    // Calculate how much the width differs from design
    const scaleX = width / DESIGN_WIDTH;
    // Calculate how much the height differs from design
    const scaleY = height / DESIGN_HEIGHT;

    // Pick the smaller scale. 
    // If screen is narrow (portrait), scale by width.
    // If screen is short (landscape monitor), scale by height.
    // This ensures no content goes off-screen.
    let scale = Math.min(scaleX, scaleY);

    scale = scale / 3;

    // Clamp scale: Don't let cards get microscopic (< 40%) or gigantic (> 150%)
    scale = Math.max(0.4, Math.min(scale, 1.5));
    
    return scale;
  }

  // ===========================================================================
  // PUBLIC API - MELD CREATION
  // ===========================================================================

  /**
   * Create visual representation of a meld
   * Only creates permanent visuals for the local player's melds
   */

  public createMeldVisual(
    playerIndex: number,
    cards: Card[],
    meldIndex: number
  ): void {
    const {width, height} = this.scene.scale;
    const isMe = this.isMyMeld(playerIndex);
    const position = this.calculateMeldPosition(meldIndex, playerIndex);

    const meld: PlayerMeld = {
      meldIndex,
      meldOwner: playerIndex,
      cards: [],
      cardData: [...cards],
      position,
      dropZone: null,
      highlight: null,
    };

    // Create card visuals FOR EVERYONE (not just me)
    cards.forEach((card, cardIndex) => {
      const x = position.x + cardIndex * width * MELD_CONFIG.CARD_OVERLAP;
      const y = position.y;

      const cardGO = this.scene.add
        .image(x, y, ASSET_KEYS.CARDS, this.getCardFrame(card))
        .setScale(this.getDynamicScale() * MELD_CONFIG.CARD_SCALE)
        .setDepth(DEPTHS.CARDS + cardIndex)
        .setData("cardId", card.id) // <--- CRITICAL FIX: This links the visual to the logic
        .setInteractive({ draggable: false }); // Good practice to ensure meld cards aren't draggable

      // If it's an opponent meld, hide the card initially
      if (!isMe) {
        cardGO.setVisible(false);
      }

      meld.cards.push(cardGO);
    });

    // Create drop zones
    const { dropZone, highlight } = this.createMeldDropZone(
      position,
      cards.length,
      meldIndex,
      playerIndex
    );

    // If it's an opponent meld, hide the drop zone initially
    if (!isMe) {
      dropZone.setVisible(false);
      highlight.setVisible(false);
    }

    meld.dropZone = dropZone;
    meld.highlight = highlight;

    // Store meld
    const playerMelds = this.allPlayerMelds.get(playerIndex) || [];
    playerMelds.push(meld);
    this.allPlayerMelds.set(playerIndex, playerMelds);
  }

  /**
   * Create drop zone for a meld (allows adding cards)
   */
  createMeldDropZone(
    position: { x: number; y: number },
    cardCount: number,
    meldIndex: number,
    playerIndex: number
  ): {
    dropZone: Phaser.GameObjects.Zone;
    highlight: Phaser.GameObjects.Rectangle;
  } {

    const {width, height} = this.scene.scale;
    const owidth =
      cardCount * width * MELD_CONFIG.CARD_OVERLAP +
      CARD_WIDTH * this.getDynamicScale() +
      MELD_CONFIG.DROP_ZONE_PADDING * 2;
    const oheight = CARD_HEIGHT * this.getDynamicScale() + MELD_CONFIG.DROP_ZONE_PADDING * 2;

    const centerX =
      position.x + ((cardCount - 1) * width * MELD_CONFIG.CARD_OVERLAP) / 2;

    const highlight = this.scene.add
      .rectangle(centerX, position.y, owidth, oheight)
      .setStrokeStyle(2, 0x00ff00, 0)
      .setFillStyle(0x00ff00, 0)
      .setDepth(DEPTHS.CARDS - 1);

    const dropZone = this.scene.add
      .zone(centerX, position.y, owidth, oheight)
      .setRectangleDropZone(owidth, oheight)
      .setData({
        zoneType: "MELD_TABLE",
        meldIndex,
        playerIndex,
      });

    // Highlight on drag over
    dropZone.on("dragenter", () => {
      highlight.setStrokeStyle(3, 0x00ff00, 1);
      highlight.setFillStyle(0x00ff00, 0.2);
    });

    dropZone.on("dragleave", () => {
      highlight.setStrokeStyle(2, 0x00ff00, 0);
      highlight.setFillStyle(0x00ff00, 0);
    });

    //this.scene.input.enableDebug(dropZone, 0xff0000);

    return { dropZone, highlight };
  }

  updateLayout(): void {
        const { width, height } = this.scene.scale;
        const baseScale = this.getDynamicScale();

        // Iterate through all players' melds
        this.allPlayerMelds.forEach((playerMelds, playerIndex) => {
            playerMelds.forEach((meld) => {
                // 1. Recalculate the base position of this meld
                const newPos = this.calculateMeldPosition(meld.meldIndex, playerIndex);
                meld.position = newPos;

                // 2. Move the cards
                meld.cards.forEach((cardGO, cardIndex) => {
                    const cardX = newPos.x + cardIndex * width * MELD_CONFIG.CARD_OVERLAP;
                    const cardY = newPos.y;

                    cardGO.setScale(baseScale);
                    
                    // We use setPosition directly to avoid animation lag during resize
                    cardGO.setPosition(cardX, cardY);
                });

                // 3. Recreate the drop zone (as its size and position depend on screen width)
                this.recreateMeldDropZone(meld);
            });
        });
    }

  // ===========================================================================
  // PUBLIC API - ADD TO MELD
  // ===========================================================================

  /**
   * Add a card to a meld visual (animate card to meld position)
   */
  public addCardToMeldVisual(
    meld: PlayerMeld,
    cardGO: Phaser.GameObjects.Image,
    card: Card,
    sortedMeldData: Card[]
  ): void {
    // 1. Stop any active tweens (like the drag cursor follow) to prevent fighting
    this.scene.tweens.killTweensOf(cardGO);
    const {width, height} = this.scene.scale;

    // 2. Set the cardId on the new sprite so we can match it
    cardGO.setData("cardId", card.id);

    // 3. Add new sprite to the array
    meld.cards.push(cardGO);

    // 4. Update cardData to match logic's sorted version
    meld.cardData = [...sortedMeldData];

    // 5. Ensure consistent properties (Scale, Origin, Alpha)
    // This fixes the "displayed correctly" issue if hand cards were smaller/larger
    cardGO.setScale(this.getDynamicScale() * MELD_CONFIG.CARD_SCALE);
    cardGO.setOrigin(0.5, 0.5); // Ensure center origin for consistent alignment
    cardGO.setAlpha(1); // Ensure it's fully visible

    // 6. Reposition ALL cards based on sorted order
    sortedMeldData.forEach((cardData, index) => {
      const finalX = meld.position.x + index * width * MELD_CONFIG.CARD_OVERLAP;
      const finalY = meld.position.y;

      // Find the sprite for this card
      const sprite = meld.cards.find(
        (go) => go.getData("cardId") === cardData.id
      );

      if (sprite) {
        sprite.clearTint();
        sprite.setData("isSelected", false);

        // Animate to correct sorted position
        this.scene.tweens.add({
          targets: sprite,
          x: finalX,
          y: finalY,
          duration: 150,
          ease: "Back.easeOut",
          onComplete: () => {
            sprite.disableInteractive();
            sprite.setDepth(DEPTHS.CARDS + index);
          },
        });
      }
    });

    // 7. Recreate drop zone with new size
    this.recreateMeldDropZone(meld);
  }

  /**
   * Handle joker replacement - returns the joker that was replaced
   */
  handleJokerReplacement(
    meld: PlayerMeld,
    cardGO: Phaser.GameObjects.Image,
    card: Card,
    replacedJoker: Card,
    sortedMeldData: Card[]
  ): JokerReplacementResult | null {
    const jokerGO = meld.cards.find(
      (go) => go.getData("cardId") === replacedJoker.id
    );
    const {width, height} = this.scene.scale;

    const jokerPosition = jokerGO
      ? { x: jokerGO.x, y: jokerGO.y }
      : { x: meld.position.x, y: meld.position.y };

    // Set cardId on new sprite
    cardGO.setData("cardId", card.id);
    cardGO.setScale(this.getDynamicScale() * MELD_CONFIG.CARD_SCALE);
    cardGO.setOrigin(0.5, 0.5);

    // Remove joker sprite from array
    if (jokerGO) {
      const jokerIdx = meld.cards.indexOf(jokerGO);
      if (jokerIdx !== -1) {
        meld.cards.splice(jokerIdx, 1);
      }
      this.destroyCardSafely(jokerGO);
    }

    // Add new card sprite
    meld.cards.push(cardGO);

    // Update cardData to match sorted logic data
    meld.cardData = [...sortedMeldData];

    // Reposition ALL cards based on sorted order
    sortedMeldData.forEach((cardData, index) => {
      const finalX = meld.position.x + index * width * MELD_CONFIG.CARD_OVERLAP;
      const finalY = meld.position.y;

      const sprite = meld.cards.find(
        (go) => go.getData("cardId") === cardData.id
      );

      if (sprite) {
        this.scene.tweens.add({
          targets: sprite,
          x: finalX,
          y: finalY,
          duration: 300,
          ease: "Back.easeOut",
          onComplete: () => {
            sprite.disableInteractive();
          },
        });
        sprite.setDepth(DEPTHS.CARDS + index);
      }
    });

    this.recreateMeldDropZone(meld);
    this.config.showMessage("Joker replaced and returned to hand!");

    return {
      replacedJoker,
      jokerStartPosition: jokerPosition,
    };
  }

  /**
   * Update meld data without visual (for AI adding to AI melds)
   */
  addCardDataToMeld(meldOwner: number, meldIndex: number, card: Card): void {
    // Logic layer already updated cardData - nothing to do here
    // This method exists just for compatibility/clarity
  }

  // ===========================================================================
  // PUBLIC API - OPPONENT MELD VIEWING
  // ===========================================================================

  /**
   * Toggle viewing of a player's melds
   */
  togglePlayerMelds(
    playerIndex: number,
    getMeldsData: () => Card[][] | CardData[][]
  ): void {
    if (this.displayedOpponentMelds === playerIndex) {
      //this.hideOpponentMelds();
    } else {
      this.showOpponentMelds(playerIndex, getMeldsData());
    }
  }

  /**
   * Show opponent's melds in the display area
   */
  public showOpponentMelds(
    playerIndex: number,
    melds: Card[][] | CardData[][]
  ): void {
    // 1. Hide all opponent melds/drop-zones first
    this.allPlayerMelds.forEach((playerMelds, pIndex) => {
      if (!this.isMyMeld(pIndex)) {
        playerMelds.forEach((meld) => {
          meld.cards.forEach((c) => c.setVisible(false));
          meld.dropZone?.setVisible(false);
          meld.highlight?.setVisible(false);
        });
      }
    });

    // 2. Show the specific opponent's melds
    const playerMelds = this.allPlayerMelds.get(playerIndex);
    if (playerMelds) {
      playerMelds.forEach((meld) => {
        meld.cards.forEach((c) => c.setVisible(true));
        meld.dropZone?.setVisible(true);
        meld.highlight?.setVisible(true);
      });
    }

    this.displayedOpponentMelds = playerIndex;

    // Clean up the old display container if it exists to avoid conflicts
    if (this.opponentMeldDisplay) {
      this.opponentMeldDisplay.destroy();
      this.opponentMeldDisplay = null;
    }
  }

  /**
   * Hide opponent meld display
   */
  public hideOpponentMelds(): void {
    this.displayedOpponentMelds = null;

    this.allPlayerMelds.forEach((playerMelds, pIndex) => {
      if (!this.isMyMeld(pIndex)) {
        playerMelds.forEach((meld) => {
          meld.cards.forEach((c) => c.setVisible(false));
          meld.dropZone?.setVisible(false);
          meld.highlight?.setVisible(false);
        });
      }
    });

    // Clean up old container
    if (this.opponentMeldDisplay) {
      this.opponentMeldDisplay.destroy();
      this.opponentMeldDisplay = null;
    }
  }

  /**
   * Refresh currently displayed opponent melds (call when melds update)
   */
  refreshMeldViewIfOpen(
    getMeldsData: (playerIndex: number) => Card[][] | CardData[][]
  ): void {
    if (this.displayedOpponentMelds !== null) {
      const playerIndex = this.displayedOpponentMelds;
      this.showOpponentMelds(playerIndex, getMeldsData(playerIndex));
    }
  }

  /**
   * Check if opponent melds are currently displayed
   */
  isOpponentMeldsDisplayed(): boolean {
    return this.displayedOpponentMelds !== null;
  }

  /**
   * Get currently displayed opponent index
   */
  getDisplayedOpponentIndex(): number | null {
    return this.displayedOpponentMelds;
  }

  // ===========================================================================
  // PUBLIC API - SERVER SYNC (Multiplayer)
  // ===========================================================================

  /**
   * Clear all melds and rebuild from server state
   */
  updateFromServerState(
    players: Array<{ id: string; melds: CardData[][] }>,
    myPlayerId: string,
    convertCards: (cards: CardData[]) => Card[]
  ): void {
    console.log("Updating melds from server");

    // Clear existing meld displays
    this.clearAllMelds();

    // Recreate melds for all players
    players.forEach((player, playerIndex) => {
      this.allPlayerMelds.set(playerIndex, []);

      player.melds.forEach((meld: CardData[], meldIndex: number) => {
        const cards = convertCards(meld);
        // Use 0 for "me" index when it's my melds
        this.createMeldVisual(playerIndex, cards, meldIndex);
      });
    });
  }

  // ===========================================================================
  // PUBLIC API - CLEANUP
  // ===========================================================================

  /**
   * Clear all melds for a specific player
   */
  clearPlayerMelds(playerIndex: number): void {
    const melds = this.allPlayerMelds.get(playerIndex) || [];
    melds.forEach((meld) => {
      meld.cards.forEach((cardGO) => this.destroyCardSafely(cardGO));
      meld.dropZone?.destroy();
      meld.highlight?.destroy();
    });
    this.allPlayerMelds.set(playerIndex, []);
  }

  /**
   * Clear all melds
   */
  clearAllMelds(): void {
    this.allPlayerMelds.forEach((melds, playerIndex) => {
      melds.forEach((meld) => {
        meld.cards.forEach((cardGO) => this.destroyCardSafely(cardGO));
        meld.dropZone?.destroy();
        meld.highlight?.destroy();
      });
    });
    this.allPlayerMelds.clear();
  }

  /**
   * Clear melds created after a snapshot (for undo)
   */
  clearMeldsAfterIndex(playerIndex: number, keepCount: number): void {
    const melds = this.allPlayerMelds.get(playerIndex) || [];
    const meldsToDestroy = melds.slice(keepCount);

    meldsToDestroy.forEach((meld) => {
      meld.cards.forEach((cardGO) => this.destroyCardSafely(cardGO));
      meld.dropZone?.destroy();
      meld.highlight?.destroy();
    });

    this.allPlayerMelds.set(playerIndex, melds.slice(0, keepCount));
  }

  /**
   * Full cleanup
   */
  destroy(): void {
    this.clearAllMelds();
    this.hideOpponentMelds();
  }

  // ===========================================================================
  // PUBLIC API - UTILITIES
  // ===========================================================================

  /**
   * Calculate meld position for a given player
   */
  calculateMeldPosition(
    meldIndex: number,
    playerIndex: number
  ): { x: number; y: number } {
    const isMe = this.isMyMeld(playerIndex);
    const { width, height } = this.scene.scale;

    if (isMe) {
      // My melds - bottom area
      const row = Math.floor(meldIndex / MELD_CONFIG.MAX_MELDS_PER_ROW);
      const col = meldIndex % MELD_CONFIG.MAX_MELDS_PER_ROW;

      return {
        x: width * MELD_CONFIG.START_X + col * width * MELD_CONFIG.MELD_SPACING,
        y: height * MELD_CONFIG.START_Y /*+ row * MELD_CONFIG.ROW_SPACING*/,
      };
    } else {
      // Opponent melds - top area
      const row = Math.floor(meldIndex / MELD_CONFIG.MAX_MELDS_PER_ROW);
      const col = meldIndex % MELD_CONFIG.MAX_MELDS_PER_ROW;

      // Offset vertically for each opponent
      const opponentIndex = this.config.getOpponentIndex(playerIndex);
      const playerYOffset = opponentIndex * height * OPPONENT_MELD_CONFIG.ROW_SPACING;

      return {
        x:
          width * OPPONENT_MELD_CONFIG.START_X +
          col * width * OPPONENT_MELD_CONFIG.MELD_SPACING,
        y: height * OPPONENT_MELD_CONFIG.START_Y,
        // playerYOffset +
        // row * OPPONENT_MELD_CONFIG.ROW_SPACING,
      };
    }
  }

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

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private isMyMeld(playerIndex: number): boolean {
    return this.config.isMultiplayer()
      ? playerIndex === this.config.getMyPlayerIndex()
      : playerIndex === 0;
  }

  private recreateMeldDropZone(meld: PlayerMeld): void {
    const { width, height } = this.scene.scale;
    if (meld.dropZone) {
      meld.dropZone.destroy();
      meld.dropZone = null;
    }
    if (meld.highlight) {
      meld.highlight.destroy();
      meld.highlight = null;
    }

    // No delay needed! We calculate based on logic, not animation.

    const cardCount = meld.cards.length;
    if (cardCount === 0) return;

    // 1. Calculate Center based on Logic (not animation)
    // The first card is at 'meld.position.x'.
    // The cards extend to the right by (count-1)*overlap.
    const offset = ((cardCount - 1) * width * MELD_CONFIG.CARD_OVERLAP) / 2;
    const centerX = meld.position.x + offset;
    const centerY = meld.position.y;

    // 2. Calculate Correct Width
    // Actual visual span = (Count-1) * Overlap + CardWidth
    const contentWidth =
      (cardCount - 1) * width * MELD_CONFIG.CARD_OVERLAP + CARD_WIDTH * this.getDynamicScale();
    const owidth = contentWidth + MELD_CONFIG.DROP_ZONE_PADDING * 2;
    const oheight = CARD_WIDTH * this.getDynamicScale() + MELD_CONFIG.DROP_ZONE_PADDING * 2;

    // 3. Create Highlight
    const highlight = this.scene.add
      .rectangle(centerX, centerY, owidth, oheight)
      .setStrokeStyle(2, 0x00ff00, 0)
      .setFillStyle(0x00ff00, 0)
      .setDepth(DEPTHS.CARDS - 1);

    // 4. Create Drop Zone
    const dropZone = this.scene.add
      .zone(centerX, centerY, owidth, oheight)
      .setRectangleDropZone(owidth, oheight)
      .setData({
        zoneType: "MELD_TABLE",
        meldIndex: meld.meldIndex,
        playerIndex: meld.meldOwner,
      });

    // 5. Add Interaction Events
    dropZone.on("dragenter", () => {
      highlight.setStrokeStyle(3, 0x00ff00, 1);
      highlight.setFillStyle(0x00ff00, 0.2);
    });

    dropZone.on("dragleave", () => {
      highlight.setStrokeStyle(2, 0x00ff00, 0);
      highlight.setFillStyle(0x00ff00, 0);
    });

    // Assign back to meld
    meld.dropZone = dropZone;
    meld.highlight = highlight;
  }

  private destroyCardSafely(cardGO: Phaser.GameObjects.Image): void {
    if (!cardGO || !cardGO.scene) return;

    this.scene.tweens.killTweensOf(cardGO);
    cardGO.removeAllListeners();

    try {
      this.scene.input.setDraggable(cardGO, false);
    } catch (e) {
      // Ignore
    }

    cardGO.destroy();
  }
}
