import * as Phaser from "phaser";
import { SCENE_KEYS } from "./common";

/**
 * Single Player Setup Scene - Configure AI players and game rounds
 * Matches the Lobby Scene's minimal, clean UI style
 */
export class SinglePlayerSetupScene extends Phaser.Scene {
  // Design Resolution constants - Ensure these match your Game Scene
  private readonly DESIGN_WIDTH = 1280;
  private readonly DESIGN_HEIGHT = 720;

  private titleText!: Phaser.GameObjects.Text;
  private aiLabel!: Phaser.GameObjects.Text;
  private aiText!: Phaser.GameObjects.Text;
  private aiLeftArrow!: Phaser.GameObjects.Container;
  private aiRightArrow!: Phaser.GameObjects.Container;

  private roundsLabel!: Phaser.GameObjects.Text;
  private roundsText!: Phaser.GameObjects.Text;
  private roundsLeftArrow!: Phaser.GameObjects.Container;
  private roundsRightArrow!: Phaser.GameObjects.Container;

  private startBtn!: Phaser.GameObjects.Container;
  private backBtn!: Phaser.GameObjects.Container;

  private readonly CONFIG = {
    colors: {
      background: 0x2e8b57,
      text: "#ffffff",
      accent: "#FFD700",
      disabled: "#666666",
      primary: "#4CAF50",
      secondary: "#2196F3",
    },
    fonts: {
      title: { size: "48px", family: "Arial", style: "bold" },
      label: { size: "32px", family: "Arial" },
      value: { size: "36px", family: "Arial", style: "bold" },
      button: { size: "32px", family: "Arial" },
    },
    layout: {
      titleY: 80,
      sectionY: 0.35,
      sectionSpacing: 0.22,
    },
    buttons: {
      large: { width: 400, height: 70, borderWidth: 3 },
      small: { width: 300, height: 50, borderWidth: 2 },
      arrow: { radius: 50 },
    },
    animation: {
      hoverScale: 100,
    },
  };

  private selectedAICount: number = 2;
  private selectedRounds: number = 3;
  private aiCountText!: Phaser.GameObjects.Text;
  private totalPlayersText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.SINGLE_PLAYER_SETUP });
  }

  create(): void {

    
    this.createBackground();
    this.createTitle();
    this.createAISelection();
    this.createRoundsSelection();
    this.createActionButtons();
    this.scale.on("resize", this.updateLayout, this);
  }
  shutdown(): void {
    this.scale.off("resize", this.updateLayout, this);
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

    scale = Math.max(0.6, Math.min(scale, 2.0));
    return scale;
  }

  private getScaledFont(fontConfig: {
    size: string;
    family: string;
    style?: string;
  }): {
    fontSize: string;
    fontFamily: string;
    fontStyle?: string;
    color?: string;
  } {
    const sizeVal = parseInt(fontConfig.size);
    const scaledSize = Math.round(sizeVal * this.getDynamicScale());

    return {
      fontSize: `${scaledSize}px`,
      fontFamily: fontConfig.family,
      fontStyle: fontConfig.style,
    };
  }

  // ==========================================================================
  // UI CREATION
  // ==========================================================================

  private updateLayout(gameSize: Phaser.Structs.Size): void {
    if (!this.scene.isActive() || !this.titleText || !this.titleText.canvas) {
    return;
  }
    
    const { width, height } = gameSize;
    const scale = this.getDynamicScale();
    const yBase = this.CONFIG.layout.sectionY;

    // Helper to update text
    const updText = (
      txt: Phaser.GameObjects.Text,
      x: number,
      y: number,
      sizePx: number
    ) => {
      if (!txt || !txt.canvas) return; // Critical safety check
      txt.setPosition(x, y).setFontSize(`${sizePx * scale}px`);
    };

    // Helper to update arrow
    const updArrow = (
      arr: Phaser.GameObjects.Container,
      x: number,
      y: number
    ) => {
      const bg = arr.getAt(0) as Phaser.GameObjects.Arc;
      const txt = arr.getAt(1) as Phaser.GameObjects.Text;

      const r = this.CONFIG.buttons.arrow.radius * scale;
      bg.setRadius(r);
      txt.setFontSize(`${48 * scale}px`);

      arr.setPosition(x, y);
      arr.setSize(r * 2, r * 2);
    };

    // 1. Title
    updText(this.titleText, width / 2, this.CONFIG.layout.titleY, 48);

    // 2. AI Section
    updText(this.aiLabel, width / 2, height * yBase - 15, 32);
    updText(this.aiText, width / 2, height * yBase + 60 * scale, 36);
    updArrow(
      this.aiLeftArrow,
      width / 2 - 120 * scale,
      height * yBase + 60 * scale
    );
    updArrow(
      this.aiRightArrow,
      width / 2 + 120 * scale,
      height * yBase + 60 * scale
    );

    // 3. Rounds Section
    const yRounds = height * (yBase + this.CONFIG.layout.sectionSpacing);
    updText(this.roundsLabel, width / 2, yRounds - 15, 32);
    updText(this.roundsText, width / 2, yRounds + 60 * scale, 36);
    updArrow(
      this.roundsLeftArrow,
      width / 2 - 120 * scale,
      yRounds + 60 * scale
    );
    updArrow(
      this.roundsRightArrow,
      width / 2 + 120 * scale,
      yRounds + 60 * scale
    );

    // 4. Buttons (Re-use logic from MenuScene or do manually)
    const updBtn = (
      btn: Phaser.GameObjects.Container,
      x: number,
      y: number,
      isLarge: boolean
    ) => {
      const base = isLarge
        ? { w: 400, h: 70, s: 32 }
        : { w: 300, h: 50, s: 20 };
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      const txt = btn.getAt(1) as Phaser.GameObjects.Text;

      bg.setSize(base.w * scale, base.h * scale);
      txt.setFontSize(`${base.s * scale}px`);
      btn.setPosition(x, y);
      btn.setSize(base.w * scale, base.h * scale);
    };

    updBtn(this.startBtn, width / 2, height * 0.85, true);
    updBtn(this.backBtn, 100, 50, false);
  }

  private createBackground(): void {
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      this.CONFIG.colors.background
    );
  }

  private createTitle(): void {
    const fontConfig = this.getScaledFont(this.CONFIG.fonts.title);
    this.titleText = this.add
      .text(
        this.scale.width / 2,
        this.CONFIG.layout.titleY,
        "Single Player Setup",
        {
          fontSize: fontConfig.fontSize,
          fontFamily: fontConfig.fontFamily,
          color: this.CONFIG.colors.text,
          fontStyle: fontConfig.fontStyle,
        }
      )
      .setOrigin(0.5);
  }

  private createAISelection(): void {
    const centerX = this.scale.width / 2;
    const y = this.scale.height * this.CONFIG.layout.sectionY;
    const scale = this.getDynamicScale();

    const labelConfig = this.getScaledFont(this.CONFIG.fonts.label);
    this.aiLabel = this.add
      .text(centerX, y - 15, "BROJ BOTOVA:", {
        fontSize: labelConfig.fontSize,
        fontFamily: labelConfig.fontFamily,
        color: this.CONFIG.colors.text,
      })
      .setOrigin(0.5);

    const selectionY = y + 60 * scale;
    this.aiLeftArrow = this.createArrowButton(
      centerX - 120 * scale,
      selectionY,
      "←",
      () => this.decreaseAICount(),
      this.selectedAICount <= 1
    );

    const valueConfig = this.getScaledFont(this.CONFIG.fonts.value);
    this.aiText = this.add
      .text(centerX, selectionY, `${this.selectedAICount}`, {
        fontSize: valueConfig.fontSize,
        fontFamily: valueConfig.fontFamily,
        color: this.CONFIG.colors.accent,
        fontStyle: valueConfig.fontStyle,
      })
      .setOrigin(0.5);

    this.aiRightArrow = this.createArrowButton(
      centerX + 120 * scale,
      selectionY,
      "→",
      () => this.increaseAICount(),
      this.selectedAICount >= 5
    );
  }

  private createRoundsSelection(): void {
    const centerX = this.scale.width / 2;
    const y =
      this.scale.height *
      (this.CONFIG.layout.sectionY + this.CONFIG.layout.sectionSpacing);
    const scale = this.getDynamicScale();

    const labelConfig = this.getScaledFont(this.CONFIG.fonts.label);
    this.roundsLabel = this.add
      .text(centerX, y - 15, "BROJ RUNDI:", {
        fontSize: labelConfig.fontSize,
        fontFamily: labelConfig.fontFamily,
        color: this.CONFIG.colors.text,
      })
      .setOrigin(0.5);

    const selectionY = y + 60 * scale;
    this.roundsLeftArrow = this.createArrowButton(
      centerX - 120 * scale,
      selectionY,
      "←",
      () => this.decreaseRounds(),
      this.selectedRounds <= 1
    );

    const valueConfig = this.getScaledFont(this.CONFIG.fonts.value);
    this.roundsText = this.add
      .text(centerX, selectionY, `${this.selectedRounds}`, {
        fontSize: valueConfig.fontSize,
        fontFamily: valueConfig.fontFamily,
        color: this.CONFIG.colors.accent,
        fontStyle: valueConfig.fontStyle,
      })
      .setOrigin(0.5);

    this.roundsRightArrow = this.createArrowButton(
      centerX + 120 * scale,
      selectionY,
      "→",
      () => this.increaseRounds(),
      this.selectedRounds >= 15
    );
  }

  private createArrowButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    disabled: boolean = false
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const scale = this.getDynamicScale();

    const radius = this.CONFIG.buttons.arrow.radius * scale;

    const bg = this.add.circle(0, 0, radius, disabled ? 0x333333 : 0x666666);

    const fontSize = 48 * scale;
    const arrow = this.add
      .text(0, 0, text, {
        fontSize: `${fontSize}px`,
        color: disabled ? "#555555" : "#ffffff",
      })
      .setOrigin(0.5);

    container.add([bg, arrow]);
    container.setSize(radius * 2, radius * 2);

    if (!disabled) {
      container.setInteractive({ useHandCursor: true });

      container.on("pointerover", () => {
        bg.setFillStyle(0x4caf50);
        this.tweens.add({
          targets: container,
          scale: 1.1,
          duration: this.CONFIG.animation.hoverScale,
        });
      });

      container.on("pointerout", () => {
        bg.setFillStyle(0x666666);
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: this.CONFIG.animation.hoverScale,
        });
      });

      container.on("pointerdown", callback);
    }

    return container;
  }

  private increaseAICount(): void {
    if (this.selectedAICount < 5) {
      this.selectedAICount++;
      //this.scene.restart();
      this.aiText.setText(`${this.selectedAICount}`);
    }
  }

  private decreaseAICount(): void {
    if (this.selectedAICount > 1) {
      this.selectedAICount--;
      //this.scene.restart();
      this.aiText.setText(`${this.selectedAICount}`);
    }
  }

  private increaseRounds(): void {
    if (this.selectedRounds < 15) {
      this.selectedRounds++;
      this.updateRoundsDisplay();
    }
  }

  private decreaseRounds(): void {
    if (this.selectedRounds > 1) {
      this.selectedRounds--;
      this.updateRoundsDisplay();
    }
  }

  private updateRoundsDisplay(): void {
    this.roundsText.setText(`${this.selectedRounds}`);
  }

  private createActionButtons(): void {
    const { width, height } = this.scale;
    const buttonY = height * 0.85;

    // Start Button
    this.startBtn = this.createButton(
      width / 2,
      buttonY,
      "🎮 Start Game",
      this.CONFIG.colors.primary,
      "large"
    );
    this.startBtn.on("pointerdown", () => this.startGame());

    // Back Button
    this.backBtn = this.createButton(
      100, // Scaled manually? Usually fixed position is okay, but let's leave it or use relative
      50,
      "← Back",
      this.CONFIG.colors.disabled,
      "small"
    );
    this.backBtn.on("pointerdown", () => this.goBack());
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: string,
    size: "large" | "small" = "large"
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const scale = this.getDynamicScale();

    const { width, height, borderWidth } = this.CONFIG.buttons[size];

    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledBorder = borderWidth * scale;

    const bg = this.add.rectangle(
      0,
      0,
      scaledWidth,
      scaledHeight,
      0x000000,
      0.8
    );
    bg.setStrokeStyle(scaledBorder, parseInt(color.replace("#", "0x")));

    const baseFont =
      size === "large"
        ? this.CONFIG.fonts.button
        : { size: "20px", family: "Arial" };
    const fontConfig = this.getScaledFont(baseFont);

    const label = this.add
      .text(0, 0, text, {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: this.CONFIG.colors.text,
      })
      .setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(scaledWidth, scaledHeight);
    container.setInteractive({ useHandCursor: true });

    const hoverColor = parseInt(color.replace("#", "0x"));
    container.on("pointerover", () => {
      bg.setFillStyle(hoverColor, 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: this.CONFIG.animation.hoverScale,
      });
    });

    container.on("pointerout", () => {
      bg.setFillStyle(0x000000, 0.8);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: this.CONFIG.animation.hoverScale,
      });
    });

    return container;
  }

  private startGame(): void {
    const scale = this.getDynamicScale();
    const loadingText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Starting game...", {
        fontSize: `${32 * scale}px`,
        color: this.CONFIG.colors.text,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: loadingText,
      alpha: 0,
      y: loadingText.y - 50,
      duration: 1000,
      onComplete: () => {
        this.scene.start(SCENE_KEYS.GAME, {
          isMultiplayer: false,
          gameConfig: {
            maxPlayers: this.selectedAICount + 1,
            rounds: this.selectedRounds,
            aiCount: this.selectedAICount,
          },
        });
      },
    });
  }

  private goBack(): void {
    this.scene.start(SCENE_KEYS.MENU);
  }

  
}
