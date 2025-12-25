// client/scenes/managers/DragDropManager.ts
import * as Phaser from 'phaser';
import { Card } from '../../lib/card';
import { CardData } from '../../../shared/types/socket-events';
import { GamePhase } from '../../lib/game-event';
import { DEPTHS, CARD_WIDTH, CARD_HEIGHT } from '../common';

// =============================================================================
// CONSTANTS
// =============================================================================

const SCALE = 1;

export const DROP_ZONE_CONFIG = {
    EXPANSION: 60,  // Extra size around drop zones for easier targeting
    DRAG_DEPTH: 1000,
} as const;

// =============================================================================
// TYPES
// =============================================================================

export type ZoneType = 'DISCARD' | 'CARDS_IN_HAND' | 'MELD_TABLE';

export interface CardGameObject extends Phaser.GameObjects.Image {
    cardData?: Card | CardData;
    labelText?: Phaser.GameObjects.Text;
}

export interface DropResult {
    success: boolean;
    error?: string;
}

export interface DragDropCallbacks {
    // State queries
    isMyTurn: () => boolean;
    getCurrentPhase: () => GamePhase;
    isMultiplayer: () => boolean;

    // Card queries
    isCardSelected: (cardGO: CardGameObject) => boolean;
    getCardSpriteIndex: (cardGO: CardGameObject) => number;

    // Actions
    onCardDeselect: (cardGO: CardGameObject) => void;
    onHandReorder: (fromIndex: number, toIndex: number) => void;
    onDiscardDrop: (card: Card, cardGO: CardGameObject) => void;
    onMeldDrop: (card: Card, cardGO: CardGameObject, meldOwner: number | string, meldIndex: number) => void;

    // UI feedback
    showMessage: (text: string) => void;
    updateHandDisplay: () => void;
}

export interface DiscardZoneConfig {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

// =============================================================================
// DRAG DROP MANAGER
// =============================================================================

/**
 * Manages all drag and drop functionality for cards.
 *
 * Responsibilities:
 * - Setting up Phaser drag/drop event listeners
 * - Tracking drag state (original position, depth)
 * - Validating drops against game rules (phase, turn)
 * - Routing valid drops to appropriate handlers
 * - Managing the discard pile drop zone
 * - Snap-back animation for invalid drops
 */
export class DragDropManager {
    private scene: Phaser.Scene;
    private callbacks: DragDropCallbacks;

    // Drop zones
    private discardDropZone: Phaser.GameObjects.Zone | null = null;
    private discardHighlight: Phaser.GameObjects.Rectangle | null = null;

    // State
    private isDragEnabled: boolean = true;

    constructor(scene: Phaser.Scene, callbacks: DragDropCallbacks) {
        this.scene = scene;
        this.callbacks = callbacks;
    }

    // ===========================================================================
    // PUBLIC API - SETUP
    // ===========================================================================

    /**
     * Initialize all drag and drop event listeners
     */
    setup(): void {
        this.scene.input.on(
            Phaser.Input.Events.DRAG_START,
            this.onDragStart,
            this
        );

        this.scene.input.on(
            Phaser.Input.Events.DRAG,
            this.onDrag,
            this
        );

        this.scene.input.on(
            Phaser.Input.Events.DRAG_END,
            this.onDragEnd,
            this
        );

        this.scene.input.on(
            Phaser.Input.Events.DROP,
            this.onDrop,
            this
        );
    }

    /**
     * Remove all drag and drop event listeners
     */
    teardown(): void {
        this.scene.input.off(Phaser.Input.Events.DRAG_START, this.onDragStart, this);
        this.scene.input.off(Phaser.Input.Events.DRAG, this.onDrag, this);
        this.scene.input.off(Phaser.Input.Events.DRAG_END, this.onDragEnd, this);
        this.scene.input.off(Phaser.Input.Events.DROP, this.onDrop, this);
    }

    // ===========================================================================
    // PUBLIC API - DROP ZONES
    // ===========================================================================

    /**
     * Create the discard pile drop zone
     */
    createDiscardDropZone(config: DiscardZoneConfig): void {
        const width = config.width ?? CARD_WIDTH * SCALE + DROP_ZONE_CONFIG.EXPANSION;
        const height = config.height ?? CARD_HEIGHT * SCALE + DROP_ZONE_CONFIG.EXPANSION;

        // // Create highlight rectangle (hidden by default)
        // this.discardHighlight = this.scene.add.rectangle(
        //     config.x,
        //     config.y,
        //     width,
        //     height
        // )
        // .setStrokeStyle(3, 0xff6666, 0)
        // .setFillStyle(0xff6666, 0)
        // .setDepth(DEPTHS.CARDS - 1);

        // Create drop zone
        this.discardDropZone = this.scene.add.zone(
            config.x,
            config.y,
            width,
            height
        )
        .setRectangleDropZone(width, height)
        .setData('zoneType', 'DISCARD' as ZoneType);

        // Highlight effects
        this.discardDropZone.on('dragenter', () => {
            this.discardHighlight?.setStrokeStyle(3, 0xff6666, 1);
            this.discardHighlight?.setFillStyle(0xff6666, 0.2);
        });

        this.discardDropZone.on('dragleave', () => {
            this.discardHighlight?.setStrokeStyle(3, 0xff6666, 0);
            this.discardHighlight?.setFillStyle(0xff6666, 0);
        });

        this.discardDropZone.on('drop', () => {
            this.discardHighlight?.setStrokeStyle(3, 0xff6666, 0);
            this.discardHighlight?.setFillStyle(0xff6666, 0);
        });
    }

    /**
     * Get the discard drop zone
     */
    getDiscardDropZone(): Phaser.GameObjects.Zone | null {
        return this.discardDropZone;
    }

    /**
     * Show/hide discard zone highlight programmatically
     */
    setDiscardHighlight(visible: boolean): void {
        if (this.discardHighlight) {
            if (visible) {
                this.discardHighlight.setStrokeStyle(3, 0xff6666, 0.5);
                this.discardHighlight.setFillStyle(0xff6666, 0.1);
            } else {
                this.discardHighlight.setStrokeStyle(3, 0xff6666, 0);
                this.discardHighlight.setFillStyle(0xff6666, 0);
            }
        }
    }

    // ===========================================================================
    // PUBLIC API - CONTROL
    // ===========================================================================

    /**
     * Enable or disable drag functionality
     */
    setEnabled(enabled: boolean): void {
        this.isDragEnabled = enabled;
    }

    /**
     * Check if drag is enabled
     */
    isEnabled(): boolean {
        return this.isDragEnabled;
    }

    /**
     * Make a game object draggable
     */
    makeDraggable(gameObject: Phaser.GameObjects.Image, draggable: boolean = true): void {
        this.scene.input.setDraggable(gameObject, draggable);
    }

    // ===========================================================================
    // PUBLIC API - UTILITIES
    // ===========================================================================

    /**
     * Snap a card back to its original position with animation
     */
    snapBack(cardGO: CardGameObject, animate: boolean = true): void {
        const origX = cardGO.getData('origX') as number;
        const origY = cardGO.getData('origY') as number;

        if (animate) {
            this.scene.tweens.add({
                targets: cardGO,
                x: origX,
                y: origY,
                duration: 150,
                ease: 'Back.easeOut',
            });
        } else {
            cardGO.setPosition(origX, origY);
        }
    }

    /**
     * Check if a drop would be valid based on current game state
     */
    canDropOnDiscard(): DropResult {
        const phase = this.callbacks.getCurrentPhase();

        if (phase !== GamePhase.MELD && phase !== GamePhase.DISCARD) {
            return { success: false, error: 'Draw a card first!' };
        }

        if (!this.callbacks.isMyTurn()) {
            return { success: false, error: 'Not your turn!' };
        }

        return { success: true };
    }

    /**
     * Check if a drop on meld would be valid
     */
    canDropOnMeld(): DropResult {
        const phase = this.callbacks.getCurrentPhase();

        if (phase === GamePhase.DRAW) {
            return { success: false, error: 'Draw a card first!' };
        }

        if (!this.callbacks.isMyTurn()) {
            return { success: false, error: 'Not your turn!' };
        }

        return { success: true };
    }

    // ===========================================================================
    // PUBLIC API - CLEANUP
    // ===========================================================================

    /**
     * Destroy all managed objects and listeners
     */
    destroy(): void {
        this.teardown();

        if (this.discardDropZone) {
            this.discardDropZone.removeAllListeners();
            this.discardDropZone.destroy();
            this.discardDropZone = null;
        }

        if (this.discardHighlight) {
            this.discardHighlight.destroy();
            this.discardHighlight = null;
        }
    }

    // ===========================================================================
    // PRIVATE - EVENT HANDLERS
    // ===========================================================================

    private onDragStart(
        pointer: Phaser.Input.Pointer,
        gameObject: CardGameObject
    ): void {
        if (!this.isDragEnabled) return;

        // Store original position for snap-back
        gameObject.setData('origX', gameObject.x);
        gameObject.setData('origY', gameObject.y);
        gameObject.setData('wasDropped', false);

        // Bring to front while dragging
        gameObject.setDepth(DROP_ZONE_CONFIG.DRAG_DEPTH);

        // Deselect if selected (can't drag selected cards)
        if (this.callbacks.isCardSelected(gameObject)) {
            this.callbacks.onCardDeselect(gameObject);
        }
    }

    private onDrag(
        pointer: Phaser.Input.Pointer,
        gameObject: CardGameObject,
        dragX: number,
        dragY: number
    ): void {
        if (!this.isDragEnabled) return;

        gameObject.setPosition(dragX, dragY);
    }

    private onDragEnd(
        pointer: Phaser.Input.Pointer,
        gameObject: CardGameObject
    ): void {
        // Reset depth
        gameObject.setDepth(DEPTHS.CARDS);

        // Snap back if not dropped on valid zone
        if (!gameObject.getData('wasDropped')) {
            this.snapBack(gameObject, false);
        }

        gameObject.setData('wasDropped', false);
    }

    private onDrop(
        pointer: Phaser.Input.Pointer,
        gameObject: CardGameObject,
        dropZone: Phaser.GameObjects.Zone
    ): void {
        gameObject.setData('wasDropped', true);

        const zoneType = dropZone.getData('zoneType') as ZoneType;

        switch (zoneType) {
            case 'CARDS_IN_HAND':
                this.handleDropOnHand(gameObject, dropZone);
                break;
            case 'DISCARD':
                this.handleDropOnDiscard(gameObject);
                break;
            case 'MELD_TABLE':
                this.handleDropOnMeld(gameObject, dropZone);
                break;
            default:
                // Unknown zone type - snap back
                this.snapBack(gameObject);
        }
    }

    // ===========================================================================
    // PRIVATE - DROP HANDLERS
    // ===========================================================================

    private handleDropOnHand(
        cardGO: CardGameObject,
        dropZone: Phaser.GameObjects.Zone
    ): void {
        const targetIndex = dropZone.getData('positionIndex') as number;
        const currentIndex = this.callbacks.getCardSpriteIndex(cardGO);

        if (currentIndex === -1 || currentIndex === targetIndex) {
            // No reorder needed, just update display
            this.callbacks.updateHandDisplay();
            return;
        }

        // Delegate reorder to scene
        this.callbacks.onHandReorder(currentIndex, targetIndex);
    }

    private handleDropOnDiscard(cardGO: CardGameObject): void {
        // Validate drop
        const validation = this.canDropOnDiscard();

        if (!validation.success) {
            this.callbacks.showMessage(validation.error!);
            this.snapBack(cardGO);
            return;
        }

        // Get card data
        const card = cardGO.cardData as Card;

        if (!card) {
            console.error('No card data on sprite');
            this.snapBack(cardGO);
            return;
        }

        // Delegate actual discard handling to scene
        this.callbacks.onDiscardDrop(card, cardGO);
    }

    private handleDropOnMeld(
        cardGO: CardGameObject,
        dropZone: Phaser.GameObjects.Zone
    ): void {
        // Validate drop
        const validation = this.canDropOnMeld();

        if (!validation.success) {
            this.callbacks.showMessage(validation.error!);
            this.snapBack(cardGO);
            return;
        }

        // Get drop zone data
        const meldIndex = dropZone.getData('meldIndex') as number;
        const meldOwner = dropZone.getData('playerIndex') as string | number;

        // Get card data
        const card = cardGO.cardData as Card;

        if (!card) {
            console.error('No card data on sprite');
            this.snapBack(cardGO);
            return;
        }

        // Delegate actual meld handling to scene
        this.callbacks.onMeldDrop(card, cardGO, meldOwner, meldIndex);
    }
}
