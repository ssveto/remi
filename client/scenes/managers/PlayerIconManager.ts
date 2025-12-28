// client/scenes/managers/PlayerIconManager.ts
import * as Phaser from 'phaser';
import { DEPTHS } from '../common';

// =============================================================================
// CONSTANTS
// =============================================================================


const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;

export const PLAYER_ICON_CONFIG = {

    SPACING: 70,
    CIRCLE_RADIUS: 25,
    INDICATOR_RADIUS: 6,

    // Colors
    CIRCLE_FILL: 0x666666,
    CIRCLE_FILL_ACTIVE: 0x888888,
    CIRCLE_STROKE: 0x333333,
    CIRCLE_STROKE_ACTIVE: 0xffff00,
    MELD_INDICATOR_COLOR: 0x00ff00,

    // Text styles
    NAME_FONT_SIZE: '14px',
    COUNT_FONT_SIZE: '12px',
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface PlayerDisplayInfo {
    id: string | number;
    name: string;
    handSize: number;
    hasOpened: boolean;
    isCurrentPlayer: boolean;
    isMe: boolean;
    score?: number;
}

export interface PlayerIcon {
    playerIndex: number;
    container: Phaser.GameObjects.Container;
    circle: Phaser.GameObjects.Arc;
    nameText: Phaser.GameObjects.Text;
    cardCount: Phaser.GameObjects.Text;
    meldIndicator: Phaser.GameObjects.Arc;
}

export interface PlayerIconManagerConfig {
    getPlayersInfo: () => PlayerDisplayInfo[];
    onPlayerClick?: (playerIndex: number) => void;
}

// =============================================================================
// PLAYER ICON MANAGER
// =============================================================================

/**
 * Manages player icon display, including avatars, names, card counts, and status indicators.
 *
 * Responsibilities:
 * - Creating player icon visuals (circle, name, card count, meld indicator)
 * - Updating icons when game state changes
 * - Handling click events on player icons
 * - Managing current player highlight
 */
export class PlayerIconManager {
    private scene: Phaser.Scene;

    // Icon state
    private playerIcons: Map<number, PlayerIcon> = new Map();

    // Configuration
    private config: PlayerIconManagerConfig;

    constructor(scene: Phaser.Scene, config: PlayerIconManagerConfig) {
        this.scene = scene;
        this.config = config;
    }

    // ===========================================================================
    // PUBLIC API - CREATION
    // ===========================================================================

    private getDynamicScale(): number {
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        const scaleX = width / DESIGN_WIDTH;
        const scaleY = height / DESIGN_HEIGHT;

        let scale = Math.min(scaleX, scaleY);

    scale = Math.max(0.6, Math.min(scale, 2.0));
        
        // Maybe a different clamping for UI?
        // Keeping it consistent ensures UI looks "part of the game".
        //scale = Math.max(0.6, Math.min(scale, 1.2)); 
        return scale;
    }

    /**
     * Create player icons for all players (except self)
     */


    createIcons(): void {
        // Clear any existing icons
        this.destroy();

        const players = this.config.getPlayersInfo();
        //const startX = this.scene.scale.width - PLAYER_ICON_CONFIG.START_X_OFFSET;
        const startX = this.scene.scale.width;

        let iconIndex = 0;

        players.forEach((player, playerIndex) => {
            if (player.isMe) return; // Skip self

            //const y = PLAYER_ICON_CONFIG.START_Y + iconIndex * PLAYER_ICON_CONFIG.SPACING;
            const y = iconIndex * PLAYER_ICON_CONFIG.SPACING;
            const icon = this.createPlayerIcon(playerIndex, player, startX, y);

            this.playerIcons.set(playerIndex, icon);
            iconIndex++;
        });
    }

    /**
     * Create a single player icon
     */
    private createPlayerIcon(
        playerIndex: number,
        player: PlayerDisplayInfo,
        x: number,
        y: number
    ): PlayerIcon {
        // Circle avatar
        const circle = this.scene.add.circle(
            0, 0,
            PLAYER_ICON_CONFIG.CIRCLE_RADIUS,
            PLAYER_ICON_CONFIG.CIRCLE_FILL,
            1
        ).setStrokeStyle(3, PLAYER_ICON_CONFIG.CIRCLE_STROKE);

        // Player name
        const nameText = this.scene.add.text(0, 0, this.truncateName(player.name), {
            fontSize: PLAYER_ICON_CONFIG.NAME_FONT_SIZE,
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // Card count badge
        const cardCount = this.scene.add.text(30, -20, `${player.handSize}`, {
            fontSize: PLAYER_ICON_CONFIG.COUNT_FONT_SIZE,
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 4, y: 2 },
        }).setOrigin(0.5);

        // Meld indicator (green dot for "has opened")
        const meldIndicator = this.scene.add.circle(
            20, 20,
            PLAYER_ICON_CONFIG.INDICATOR_RADIUS,
            PLAYER_ICON_CONFIG.MELD_INDICATOR_COLOR,
            1
        )
            .setStrokeStyle(2, 0xffffff)
            .setVisible(player.hasOpened);

        // Container for all elements
        const container = this.scene.add.container(x, y, [
            circle, nameText, cardCount, meldIndicator
        ]);
        container.setDepth(DEPTHS.UI);

        // Make circle interactive for clicking
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerdown', () => {
            this.config.onPlayerClick?.(playerIndex);
        });

        // Hover effects
        circle.on('pointerover', () => {
            if (!player.isCurrentPlayer) {
                circle.setScale(1.1);
            }
        });

        circle.on('pointerout', () => {
            circle.setScale(1.0);
        });

        // Apply current player highlight if needed
        if (player.isCurrentPlayer) {
            this.setCurrentPlayerStyle(circle, true);
        }

        return {
            playerIndex,
            container,
            circle,
            nameText,
            cardCount,
            meldIndicator,
        };
    }

    updateLayout(): void {
        if (this.playerIcons.size === 0) return;

        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        const scale = this.getDynamicScale();


        // Example: Place icons on the right side, vertically centered-ish
        // You can adjust these anchors to suit your design (e.g. top right corner)
        const anchorX = width * 0.95; 
        const anchorY = height * 0.1; 

        let iconIndex = 0;
        this.playerIcons.forEach((icon) => {
            // Calculate Y based on index
            const y = anchorY + iconIndex * PLAYER_ICON_CONFIG.SPACING * scale;
            
            icon.container.setScale(scale); 

            // Animate or set position
            icon.container.setPosition(anchorX, y);
            
            iconIndex++;
        });
    }

    // ===========================================================================
    // PUBLIC API - UPDATES
    // ===========================================================================

    /**
     * Update all player icons with current game state
     */
    updateAll(): void {
        const players = this.config.getPlayersInfo();

        players.forEach((player, playerIndex) => {
            if (player.isMe) return;

            const icon = this.playerIcons.get(playerIndex);
            if (!icon) return;

            this.updateIcon(icon, player);
        });
    }

    /**
     * Update a single player's icon
     */
    private updateIcon(icon: PlayerIcon, player: PlayerDisplayInfo): void {
        // Update name
        icon.nameText.setText(this.truncateName(player.name));

        // Update card count
        icon.cardCount.setText(`${player.handSize}`);

        // Update opened indicator
        icon.meldIndicator.setVisible(player.hasOpened);

        // Update current player highlight
        this.setCurrentPlayerStyle(icon.circle, player.isCurrentPlayer);
    }

    /**
     * Update only the card count for a specific player
     */
    updateCardCount(playerIndex: number): void {
        const players = this.config.getPlayersInfo();
        const player = players[playerIndex];
        if (!player) return;

        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        icon.cardCount.setText(`${player.handSize}`);
    }

    /**
     * Update only the meld indicator for a specific player
     */
    updateMeldStatus(playerIndex: number, hasOpened: boolean): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        icon.meldIndicator.setVisible(hasOpened);
    }

    /**
     * Set a player as the current turn player (highlight)
     */
    setCurrentPlayer(playerIndex: number): void {
        // Remove highlight from all
        this.playerIcons.forEach((icon) => {
            this.setCurrentPlayerStyle(icon.circle, false);
        });

        // Add highlight to current player
        const icon = this.playerIcons.get(playerIndex);
        if (icon) {
            this.setCurrentPlayerStyle(icon.circle, true);
        }
    }

    /**
     * Update a player's name
     */
    updatePlayerName(playerIndex: number, name: string): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        icon.nameText.setText(this.truncateName(name));
    }

    /**
 * Set player disconnected visual state (grays out their icon)
 */
    setPlayerDisconnected(playerIndex: number, disconnected: boolean): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        if (disconnected) {
            // Gray out the icon by reducing opacity
            icon.container.setAlpha(0.4);
        } else {
            // Restore normal appearance
            icon.container.setAlpha(1);
        }
    }

    /**
     * Update a player's score display (if you add score to icons)
     */
    updateScore(playerIndex: number, score: number): void {
        // Could extend to show score on icon
        // For now, this is a placeholder for future enhancement
    }

    // ===========================================================================
    // PUBLIC API - VISUAL EFFECTS
    // ===========================================================================

    /**
     * Pulse animation on a player icon (e.g., when it's their turn)
     */
    pulseIcon(playerIndex: number): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        this.scene.tweens.add({
            targets: icon.circle,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
        });
    }

    /**
     * Shake animation (e.g., when player makes invalid move)
     */
    shakeIcon(playerIndex: number): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        const originalX = icon.container.x;

        this.scene.tweens.add({
            targets: icon.container,
            x: originalX + 5,
            duration: 50,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                icon.container.x = originalX;
            },
        });
    }

    /**
     * Flash the meld indicator when player opens
     */
    flashMeldIndicator(playerIndex: number): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        icon.meldIndicator.setVisible(true);

        this.scene.tweens.add({
            targets: icon.meldIndicator,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.5,
            duration: 200,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                icon.meldIndicator.setScale(1);
                icon.meldIndicator.setAlpha(1);
            },
        });
    }

    /**
     * Highlight card count change (e.g., when cards drawn/discarded)
     */
    highlightCardCountChange(playerIndex: number, increased: boolean): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        const color = increased ? '#00ff00' : '#ff6666';
        const originalColor = '#ffffff';

        icon.cardCount.setColor(color);

        this.scene.time.delayedCall(500, () => {
            icon.cardCount.setColor(originalColor);
        });
    }

    // ===========================================================================
    // PUBLIC API - QUERIES
    // ===========================================================================

    /**
     * Get icon for a specific player
     */
    getIcon(playerIndex: number): PlayerIcon | undefined {
        return this.playerIcons.get(playerIndex);
    }

    /**
     * Check if icons have been created
     */
    hasIcons(): boolean {
        return this.playerIcons.size > 0;
    }

    /**
     * Get all player indices with icons
     */
    getPlayerIndices(): number[] {
        return Array.from(this.playerIcons.keys());
    }

    // ===========================================================================
    // PUBLIC API - CLEANUP
    // ===========================================================================

    /**
     * Remove a specific player's icon
     */
    removeIcon(playerIndex: number): void {
        const icon = this.playerIcons.get(playerIndex);
        if (!icon) return;

        icon.circle.removeAllListeners();
        icon.container.destroy();
        this.playerIcons.delete(playerIndex);
    }

    /**
     * Destroy all icons and clean up
     */
    destroy(): void {
        this.playerIcons.forEach((icon) => {
            icon.circle.removeAllListeners();
            icon.container.destroy();
        });
        this.playerIcons.clear();
    }

    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================

    /**
     * Apply current player styling to circle
     */
    private setCurrentPlayerStyle(circle: Phaser.GameObjects.Arc, isCurrent: boolean): void {
        if (isCurrent) {
            circle.setStrokeStyle(3, PLAYER_ICON_CONFIG.CIRCLE_STROKE_ACTIVE);
            circle.setFillStyle(PLAYER_ICON_CONFIG.CIRCLE_FILL_ACTIVE);
        } else {
            circle.setStrokeStyle(3, PLAYER_ICON_CONFIG.CIRCLE_STROKE);
            circle.setFillStyle(PLAYER_ICON_CONFIG.CIRCLE_FILL);
        }
    }

    /**
     * Truncate long names with ellipsis
     */
    private truncateName(name: string, maxLength: number = 6): string {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 1) + '…';
    }
}
