import * as Phaser from 'phaser';
import { SCENE_KEYS } from './common';

/**
 * Single Player Setup Scene - Configure AI players and game rounds
 * Matches the Lobby Scene's minimal, clean UI style
 */
export class SinglePlayerSetupScene extends Phaser.Scene {
  private readonly CONFIG = {
    colors: {
      background: 0x2E8B57,
      text: '#ffffff',
      accent: '#FFD700',
      disabled: '#666666',
      primary: '#4CAF50',
      secondary: '#2196F3',
    },
    fonts: {
      title: { size: '48px', family: 'Arial', style: 'bold' },
      label: { size: '32px', family: 'Arial' },
      value: { size: '36px', family: 'Arial', style: 'bold' },
      button: { size: '32px', family: 'Arial' },
    },
    layout: {
      titleY: 80,
      sectionY: 0.35,      // AI selection at 35% screen height
      sectionSpacing: 0.22, // 20% gap between sections
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
private roundsText!: Phaser.GameObjects.Text;  // <-- ADD THIS
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
    this.add.text(
      this.scale.width / 2,
      this.CONFIG.layout.titleY,
      'Single Player Setup',
      {
        fontSize: this.CONFIG.fonts.title.size,
        fontFamily: this.CONFIG.fonts.title.family,
        color: this.CONFIG.colors.text,
        fontStyle: this.CONFIG.fonts.title.style,
      }
    ).setOrigin(0.5);
  }

  private createAISelection(): void {
    const centerX = this.scale.width / 2;
    const y = this.scale.height * this.CONFIG.layout.sectionY;

    // Label
    this.add.text(centerX, y - 15, 'BROJ BOTOVA:', {
      fontSize: this.CONFIG.fonts.label.size,
      fontFamily: this.CONFIG.fonts.label.family,
      color: this.CONFIG.colors.text,
    }).setOrigin(0.5);

    // Selection controls
    const selectionY = y + 60;
    const leftArrow = this.createArrowButton(
      centerX - 120,
      selectionY,
      '←',
      () => this.decreaseAICount(),
      this.selectedAICount <= 1
    );

    this.add.text(centerX, selectionY, `${this.selectedAICount}`, {
      fontSize: this.CONFIG.fonts.value.size,
      fontFamily: this.CONFIG.fonts.value.family,
      color: this.CONFIG.colors.accent,
      fontStyle: this.CONFIG.fonts.value.style,
    }).setOrigin(0.5);

    const rightArrow = this.createArrowButton(
      centerX + 120,
      selectionY,
      '→',
      () => this.increaseAICount(),
      this.selectedAICount >= 5
    );

    // // Total players indicator
    // this.add.text(centerX, selectionY + 50, 
    //   `Total: ${this.selectedAICount + 1} players`, {
    //   fontSize: '24px',
    //   color: this.CONFIG.colors.disabled,
    // }).setOrigin(0.5);
  }

  private createRoundsSelection(): void {
    const centerX = this.scale.width / 2;
    const y = this.scale.height * (this.CONFIG.layout.sectionY + this.CONFIG.layout.sectionSpacing);

    // Label
    this.add.text(centerX, y - 15, 'BROJ RUNDI:', {
      fontSize: this.CONFIG.fonts.label.size,
      fontFamily: this.CONFIG.fonts.label.family,
      color: this.CONFIG.colors.text,
    }).setOrigin(0.5);

    // Selection controls
    const selectionY = y + 60;
    const leftArrow = this.createArrowButton(
      centerX - 120,
      selectionY,
      '←',
      () => this.decreaseRounds(),
      this.selectedRounds <= 1
    );

    this.roundsText = this.add.text(centerX, selectionY, `${this.selectedRounds}`, {
      fontSize: this.CONFIG.fonts.value.size,
      fontFamily: this.CONFIG.fonts.value.family,
      color: this.CONFIG.colors.accent,
      fontStyle: this.CONFIG.fonts.value.style,
    }).setOrigin(0.5);

    const rightArrow = this.createArrowButton(
      centerX + 120,
      selectionY,
      '→',
      () => this.increaseRounds(),
      this.selectedRounds >= 15
    );

    // // Visual dots indicator
    // this.createRoundsIndicator(centerX, selectionY + 60);
  }

//   private createRoundsIndicator(x: number, y: number): void {
//     const container = this.add.container(x, y);
//     for (let i = 0; i < 10; i++) {
//       const dot = this.add.circle((i - 4.5) * 30, 0, 8,
//         i < this.selectedRounds ? 0x4CAF50 : 0x333333
//       );
//       container.add(dot);
//     }
//     this.roundsIndicatorContainer = container;
//   }

  private createArrowButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    disabled: boolean = false
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const radius = this.CONFIG.buttons.arrow.radius;

    const bg = this.add.circle(0, 0, radius, disabled ? 0x333333 : 0x666666);
    const arrow = this.add.text(0, 0, text, {
      fontSize: '48px',
      color: disabled ? '#555555' : '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, arrow]);
    container.setSize(radius * 2, radius * 2);

    if (!disabled) {
      container.setInteractive({ useHandCursor: true });

      container.on('pointerover', () => {
        bg.setFillStyle(0x4CAF50);
        this.tweens.add({
          targets: container,
          scale: 1.1,
          duration: this.CONFIG.animation.hoverScale,
        });
      });

      container.on('pointerout', () => {
        bg.setFillStyle(0x666666);
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: this.CONFIG.animation.hoverScale,
        });
      });

      container.on('pointerdown', callback);
    }

    return container;
  }

  private increaseAICount(): void {
    if (this.selectedAICount < 5) {
      this.selectedAICount++;
      this.scene.restart(); // Simplest way to refresh UI
    }
  }

  private decreaseAICount(): void {
    if (this.selectedAICount > 1) {
      this.selectedAICount--;
      this.scene.restart();
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
    
    // // Update dots
    // if (this.roundsIndicatorContainer) {
    //   this.roundsIndicatorContainer.destroy();
    // }
    //this.createRoundsIndicator(this.scale.width / 2, this.scale.height * 0.61);
  }

  private createActionButtons(): void {
    const { width, height } = this.scale;
    const buttonY = height * 0.85;

    // Start Button
    const startBtn = this.createButton(
      width / 2,
      buttonY,
      '🎮 Start Game',
      this.CONFIG.colors.primary,
      'large'
    );
    startBtn.on('pointerdown', () => this.startGame());

    // Back Button
    const backBtn = this.createButton(
      100,
      50,
      '← Back',
      this.CONFIG.colors.disabled,
      'small'
    );
    backBtn.on('pointerdown', () => this.goBack());
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: string,
    size: 'large' | 'small' = 'large'
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const { width, height, borderWidth } = this.CONFIG.buttons[size];
    const fontSize = size === 'large' 
      ? this.CONFIG.fonts.button.size 
      : '20px';

    // Black background + colored border (matching lobby)
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    bg.setStrokeStyle(borderWidth, parseInt(color.replace('#', '0x')));

    const label = this.add.text(0, 0, text, {
      fontSize,
      fontFamily: this.CONFIG.fonts.button.family,
      color: this.CONFIG.colors.text,
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });

    // Hover effects (match lobby)
    const hoverColor = parseInt(color.replace('#', '0x'));
    container.on('pointerover', () => {
      bg.setFillStyle(hoverColor, 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: this.CONFIG.animation.hoverScale,
      });
    });

    container.on('pointerout', () => {
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
    const loadingText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'Starting game...',
      {
        fontSize: '32px',
        color: this.CONFIG.colors.text,
      }
    ).setOrigin(0.5);

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