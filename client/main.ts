// client/main.ts
import * as Phaser from 'phaser';
import { MenuScene } from './scenes/menu-scene';
import { LobbyScene } from './scenes/lobby-scene';
import { GameScene } from './scenes/game-scene';
import { PreloadScene } from './scenes/preload-scene';
import { SinglePlayerSetupScene } from './scenes/single-player-setup-scene';

/**
 * Main Phaser game configuration
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  
  backgroundColor: '#2E8B57',
  
  dom: {
    createContainer: true, // Enable DOM elements for input fields
  },
  scene: [
    PreloadScene,
    MenuScene,
    SinglePlayerSetupScene,
    LobbyScene,
    GameScene,
  ],
  input: {
    activePointers: 3,
    touch: true,
    smoothFactor: 0,
    windowEvents: true,
  },
  scale: {
    parent: 'game-container',
    width: 1280,
    height: 720,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    mode: Phaser.Scale.FIT,
    
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

// Create and start the game
const game = new Phaser.Game(config);

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Game error:', event.error);
});

// Export for debugging
(window as any).game = game;

export default game;