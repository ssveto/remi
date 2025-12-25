// client/scenes/menu-scene.ts
import * as Phaser from 'phaser';
import { SCENE_KEYS } from './common';
import { NetworkManager } from '../lib/network-manager';

/**
 * Main menu scene - Choose between single player and multiplayer
 */
export class MenuScene extends Phaser.Scene {
  private networkManager: NetworkManager | null = null;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, height * 0.2, 'REMI', {
      fontSize: '72px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.3, 'Card Game', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#cccccc',
    }).setOrigin(0.5);

    // Single Player Button
    const singlePlayerBtn = this.createButton(
      width / 2,
      height * 0.5,
      '🎮 Single Player',
      '#4CAF50'
    );

    singlePlayerBtn.on('pointerdown', () => {
      //this.startSinglePlayer();
      this.startSinglePlayerSetup();
    });

    // Multiplayer Button
    const multiplayerBtn = this.createButton(
      width / 2,
      height * 0.65,
      '🌐 Multiplayer',
      '#2196F3'
    );

    multiplayerBtn.on('pointerdown', () => {
      this.startMultiplayer();
    });

    // Settings Button (optional)
    const settingsBtn = this.createButton(
      width / 2,
      height * 0.8,
      '⚙️ Settings',
      '#757575',
      0.7
    );

    settingsBtn.on('pointerdown', () => {
      this.showSettings();
    });

    // Version
    this.add.text(width - 10, height - 10, 'v1.0.0', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#666666',
    }).setOrigin(1, 1);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: string,
    scale: number = 1
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.rectangle(0, 0, 400 * scale, 80 * scale, 0x000000, 0.8);
    bg.setStrokeStyle(3, parseInt(color.replace('#', '0x')));

    // Text
    const label = this.add.text(0, 0, text, {
      fontSize: `${32 * scale}px`,
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, bg, label]);
    container.setSize(400 * scale, 80 * scale);
    container.setInteractive();

    // Hover effect
    container.on('pointerover', () => {
      bg.setFillStyle(parseInt(color.replace('#', '0x')), 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power2',
      });
    });

    container.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0.8);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });
    });

    return container;
  }

  private startSinglePlayer(): void {
    console.log('Starting single player mode');
    
    // Start game scene in single player mode
    this.scene.start(SCENE_KEYS.GAME, {
      isMultiplayer: false,
    });
  }

  private startSinglePlayerSetup(): void {
  console.log('Starting single player setup');
  this.scene.start(SCENE_KEYS.SINGLE_PLAYER_SETUP);
}

  private startMultiplayer(): void {
    console.log('Starting multiplayer mode');
    
    // Show loading message
    const loadingText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'Connecting to server...',
      {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }
    ).setOrigin(0.5);

    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Connect to server
    this.networkManager.connect('http://localhost:3000')
      .then(() => {
        console.log('Connected to server!');
        loadingText.destroy();
        
        // Go to lobby scene
        this.scene.start(SCENE_KEYS.LOBBY, {
          networkManager: this.networkManager,
        });
      })
      .catch((error) => {
        console.error('Failed to connect:', error);
        loadingText.setText('Connection failed!\nClick to retry');
        
        loadingText.setInteractive();
        loadingText.on('pointerdown', () => {
          loadingText.destroy();
          this.startMultiplayer();
        });
      });
  }

  private showSettings(): void {
    // TODO: Implement settings scene
    console.log('Settings clicked');
    
    const message = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'Settings coming soon!',
      {
        fontSize: '32px',
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setDepth(1000);

    this.time.delayedCall(2000, () => {
      message.destroy();
    });
  }
}