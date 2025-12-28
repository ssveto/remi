// client/scenes/menu-scene.ts
import * as Phaser from "phaser";
import { SCENE_KEYS } from "./common";
import { NetworkManager } from "../lib/network-manager";

/**
 * Main menu scene - Choose between single player and multiplayer
 */
export class MenuScene extends Phaser.Scene {
  private networkManager: NetworkManager | null = null;

  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private singlePlayerBtn!: Phaser.GameObjects.Container;
  private multiplayerBtn!: Phaser.GameObjects.Container;
  private settingsBtn!: Phaser.GameObjects.Container;
  private versionText!: Phaser.GameObjects.Text;

  // Design Resolution constants - Ensure these match your Game Scene
  private readonly DESIGN_WIDTH = 1280;
  private readonly DESIGN_HEIGHT = 720;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {

    const { width, height } = this.scale;

    // this.input.once("pointerdown", () => {
    //   if (!this.scale.isFullscreen) {
    //     this.scale.startFullscreen();
    //   }
    // });

    const scale = this.getDynamicScale();

    // Title
    this.titleText = this.add
      .text(width / 2, height * 0.2, "REMI", {
        fontSize: `${52 * scale}px`,
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.subtitleText = this.add
      .text(width / 2, height * 0.25, "Card Game", {
        fontSize: `${22 * scale}px`,
        fontFamily: "Arial",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    // Single Player Button
    this.singlePlayerBtn = this.createButton(
      width / 2,
      height * 0.4,
      "🎮 Single Player",
      "#4CAF50"
    );

    this.singlePlayerBtn.on("pointerdown", () => {
      this.startSinglePlayerSetup();
    });

    // Multiplayer Button
    this.multiplayerBtn = this.createButton(
      width / 2,
      height * 0.55,
      "🌐 Multiplayer",
      "#2196F3"
    );

    this.multiplayerBtn.on("pointerdown", () => {
      this.startMultiplayer();
    });

    // Settings Button (optional)
    this.settingsBtn = this.createButton(
      width / 2,
      height * 0.7,
      "⚙️ Settings",
      "#757575"
    ); // Removed manual scale arg to use dynamic scaling

    this.settingsBtn.on("pointerdown", () => {
      this.showSettings();
    });

    // Version
    this.versionText = this.add
      .text(width - 10, height - 10, "by Sveto", {
        fontSize: `${16 * scale}px`,
        fontFamily: "Arial",
        color: "#666666",
      })
      .setOrigin(1, 1);

    this.scale.on("resize", this.updateLayout, this);
  }
  shutdown(): void {
    this.scale.off('resize', this.updateLayout, this);
  }

  private updateLayout(gameSize: Phaser.Structs.Size): void {
    if (!this.scene.isActive() || !this.titleText || !this.titleText.canvas) {
    return;
  }
    
    const { width, height } = gameSize;
    const scale = this.getDynamicScale();

    // 1. Update Text Position & Font Size
    this.titleText
      .setPosition(width / 2, height * 0.2)
      .setFontSize(`${52 * scale}px`);
    this.subtitleText
      .setPosition(width / 2, height * 0.25)
      .setFontSize(`${22 * scale}px`);
    this.versionText
      .setPosition(width - 10, height - 10)
      .setFontSize(`${16 * scale}px`);

    // 2. Update Buttons
    // Helper function to update a button's position and background size
    const updateButton = (
      btn: Phaser.GameObjects.Container,
      yPosRatio: number
    ) => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      const text = btn.getAt(1) as Phaser.GameObjects.Text;

      // Resize background
      bg.setSize(400 * scale, 80 * scale);
      bg.setStrokeStyle(3 * scale, parseInt(bg.strokeColor.toString())); // Keep same color

      // Resize text
      text.setFontSize(`${32 * scale}px`);

      // Move button to new center position
      btn.setPosition(width / 2, height * yPosRatio);
      btn.setSize(400 * scale, 80 * scale); // Update hit area
    };

    updateButton(this.singlePlayerBtn, 0.4);
    updateButton(this.multiplayerBtn, 0.55);
    updateButton(this.settingsBtn, 0.7);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: string
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const scaleFactor = this.getDynamicScale();

    // Background
    const bg = this.add.rectangle(
      0,
      0,
      400 * scaleFactor,
      80 * scaleFactor,
      0x000000,
      0.8
    );
    bg.setStrokeStyle(3 * scaleFactor, parseInt(color.replace("#", "0x")));

    // Text
    const label = this.add
      .text(0, 0, text, {
        fontSize: `${32 * scaleFactor}px`,
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(400 * scaleFactor, 80 * scaleFactor);
    container.setInteractive();

    // Hover effect
    container.on("pointerover", () => {
      bg.setFillStyle(parseInt(color.replace("#", "0x")), 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Power2",
      });
    });

    container.on("pointerout", () => {
      bg.setFillStyle(0x000000, 0.8);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: "Power2",
      });
    });

    return container;
  }

  private startSinglePlayerSetup(): void {
    console.log("Starting single player setup");
    this.scene.start(SCENE_KEYS.SINGLE_PLAYER_SETUP);
  }

  private startMultiplayer(): void {
    console.log("Starting multiplayer mode");
    const scale = this.getDynamicScale();

    // Show loading message
    const loadingText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        "Connecting to server...",
        {
          fontSize: `${24 * scale}px`,
          fontFamily: "Arial",
          color: "#ffffff",
        }
      )
      .setOrigin(0.5);

    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Connect to server
    this.networkManager
      .connect("http://localhost:3000")
      .then(() => {
        console.log("Connected to server!");
        loadingText.destroy();

        // Go to lobby scene
        this.scene.start(SCENE_KEYS.LOBBY, {
          networkManager: this.networkManager,
        });
      })
      .catch((error) => {
        console.error("Failed to connect:", error);
        loadingText.setText("Connection failed!\nClick to retry");

        loadingText.setInteractive();
        loadingText.on("pointerdown", () => {
          loadingText.destroy();
          this.startMultiplayer();
        });
      });
  }

  private showSettings(): void {
    console.log("Settings clicked");
    const scale = this.getDynamicScale();

    const message = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        "Settings coming soon!",
        {
          fontSize: `${32 * scale}px`,
          fontFamily: "Arial",
          color: "#ffffff",
          backgroundColor: "#000000",
          padding: { x: 20, y: 10 },
        }
      )
      .setOrigin(0.5)
      .setDepth(1000);

    this.time.delayedCall(2000, () => {
      message.destroy();
    });
  }

  // ==========================================================================
  // SCALING LOGIC
  // ==========================================================================

  private getDynamicScale(): number {
    const width = this.scale.width;
    const height = this.scale.height;

    const scaleX = width / this.DESIGN_WIDTH;
    const scaleY = height / this.DESIGN_HEIGHT;

    let scale = Math.min(scaleX, scaleY);
    //scale = scale / 3;

    scale = Math.max(0.6, Math.min(scale, 2.0));

    return scale;
  }

  
}
