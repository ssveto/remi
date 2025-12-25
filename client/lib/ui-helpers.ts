// client/lib/ui-helpers.ts
import * as Phaser from 'phaser';
import { COLORS } from '../scenes/common';

/**
 * Helper functions for creating common UI elements
 */
export class UIHelpers {
  /**
   * Create a styled button
   */
  static createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color: string | number = COLORS.PRIMARY,
    width: number = 400,
    height: number = 70
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    // Convert hex string to number if needed
    const colorNum = typeof color === 'string' 
      ? parseInt(color.replace('#', '0x')) 
      : color;

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, 0x2E8B57, 0.8);
    bg.setStrokeStyle(3, colorNum);

    // Text
    const label = scene.add.text(0, 0, text, {
      fontSize: `${Math.floor(height * 0.4)}px`,
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(width, height);
    container.setInteractive();

    // Hover effect
    container.on('pointerover', () => {
      bg.setFillStyle(colorNum, 0.3);
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power2',
      });
    });

    container.on('pointerout', () => {
      bg.setFillStyle(0x2E8B57, 0.8);
      scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });
    });

    // Store references
    (container as any).background = bg;
    (container as any).label = label;

    return container;
  }

  /**
   * Create a text input field using DOM
   */
  static createTextInput(
    scene: Phaser.Scene,
    x: number,
    y: number,
    placeholder: string,
    id: string,
    width: number = 300,
    height: number = 50,
    maxLength: number = 20
  ): Phaser.GameObjects.DOMElement {
    return scene.add.dom(x, y).createFromHTML(`
      <input type="text" 
             id="${id}" 
             placeholder="${placeholder}" 
             maxlength="${maxLength}"
             style="
               width: ${width}px;
               height: ${height}px;
               font-size: ${Math.floor(height * 0.5)}px;
               text-align: center;
               border: 2px solid #4CAF50;
               border-radius: 8px;
               background: #1a1a1a;
               color: white;
               padding: 8px;
             ">
    `);
  }

  /**
   * Show a toast message
   */
  static showToast(
    scene: Phaser.Scene,
    message: string,
    duration: number = 2000,
    color: number = COLORS.SUCCESS
  ): Phaser.GameObjects.Text {
    const text = scene.add.text(
      scene.scale.width / 2,
      scene.scale.height - 50,
      message,
      {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setDepth(1000);

    scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 30,
      duration: duration,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    return text;
  }

  /**
   * Create a modal dialog
   */
  static createModal(
    scene: Phaser.Scene,
    title: string,
    message: string,
    buttons: Array<{ text: string; callback: () => void; color?: number }>
  ): Phaser.GameObjects.Container {
    const { width, height } = scene.scale;
    const container = scene.add.container(0, 0).setDepth(2000);

    // Overlay
    const overlay = scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.8
    );
    overlay.setInteractive();

    // Modal background
    const modalWidth = Math.min(600, width * 0.9);
    const modalHeight = Math.min(400, height * 0.7);
    const modal = scene.add.rectangle(
      width / 2,
      height / 2,
      modalWidth,
      modalHeight,
      0x1a1a1a
    );
    modal.setStrokeStyle(3, COLORS.PRIMARY);

    // Title
    const titleText = scene.add.text(width / 2, height / 2 - modalHeight / 3, title, {
      fontSize: '36px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Message
    const messageText = scene.add.text(width / 2, height / 2, message, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: modalWidth - 40 },
    }).setOrigin(0.5);

    container.add([overlay, modal, titleText, messageText]);

    // Buttons
    const buttonY = height / 2 + modalHeight / 3.5;
    const buttonSpacing = modalWidth / (buttons.length + 1);

    buttons.forEach((btn, index) => {
      const x = width / 2 - modalWidth / 2 + buttonSpacing * (index + 1);
      const button = this.createButton(
        scene,
        x,
        buttonY,
        btn.text,
        btn.color || COLORS.PRIMARY,
        200,
        60
      );

      button.on('pointerdown', () => {
        btn.callback();
        container.destroy();
      });

      container.add(button);
    });


    return container;
  }

  /**
   * Create a loading spinner
   */
  static createLoadingSpinner(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number = 50
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    // Create circle segments
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      
      const segment = scene.add.circle(x, y, 4, 0xffffff, 1 - i / segments);
      container.add(segment);
    }

    // Rotate animation
    scene.tweens.add({
      targets: container,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear',
    });

    return container;
  }

  /**
   * Create a progress bar
   */
  static createProgressBar(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number = COLORS.SUCCESS
  ): { container: Phaser.GameObjects.Container; setProgress: (value: number) => void } {
    const container = scene.add.container(x, y);

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, 0x333333);
    bg.setStrokeStyle(2, 0x666666);

    // Fill
    const fill = scene.add.rectangle(-width / 2, 0, 0, height, fillColor);
    fill.setOrigin(0, 0.5);

    container.add([bg, fill]);

    const setProgress = (value: number) => {
      value = Phaser.Math.Clamp(value, 0, 1);
      scene.tweens.add({
        targets: fill,
        width: width * value,
        duration: 200,
        ease: 'Power2',
      });
    };

    return { container, setProgress };
  }

  /**
   * Create a player info card
   */
  static createPlayerCard(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerName: string,
    isActive: boolean = false,
    cardCount: number = 0,
    score: number = 0
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);

    const width = 250;
    const height = 100;

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, 0x1a1a1a, 0.9);
    bg.setStrokeStyle(3, isActive ? COLORS.SUCCESS : 0x333333);

    // Name
    const nameText = scene.add.text(-width / 2 + 10, -height / 2 + 15, playerName, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: isActive ? '#4CAF50' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0);

    // Card count
    const cardText = scene.add.text(-width / 2 + 10, 0, `🃏 ${cardCount} cards`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#cccccc',
    }).setOrigin(0);

    // Score
    const scoreText = scene.add.text(-width / 2 + 10, height / 2 - 15, `Score: ${score}`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: score >= 0 ? '#4CAF50' : '#F44336',
    }).setOrigin(0, 1);

    container.add([bg, nameText, cardText, scoreText]);

    // Store references for updates
    (container as any).updateInfo = (name: string, active: boolean, cards: number, scr: number) => {
      nameText.setText(name);
      nameText.setColor(active ? '#4CAF50' : '#ffffff');
      cardText.setText(`🃏 ${cards} cards`);
      scoreText.setText(`Score: ${scr}`);
      scoreText.setColor(scr >= 0 ? '#4CAF50' : '#F44336');
      bg.setStrokeStyle(3, active ? COLORS.SUCCESS : 0x333333);
    };

    return container;
  }

  /**
   * Shake effect for errors
   */
  static shake(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
    scene.tweens.add({
      targets: target,
      x: (target as any).x + 10,
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: 'Power2',
    });
  }

  /**
   * Pulse effect for emphasis
   */
  static pulse(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject, scale: number = 1.1): void {
    scene.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration: 300,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Fade in animation
   */
  static fadeIn(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    duration: number = 500
  ): void {
    (target as any).alpha = 0;
    scene.tweens.add({
      targets: target,
      alpha: 1,
      duration,
      ease: 'Power2',
    });
  }

  /**
   * Fade out animation
   */
  static fadeOut(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    duration: number = 500,
    destroy: boolean = true
  ): void {
    scene.tweens.add({
      targets: target,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => {
        if (destroy) {
          target.destroy();
        }
      },
    });
  }

  /**
   * Slide in from side
   */
  static slideIn(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    from: 'left' | 'right' | 'top' | 'bottom',
    duration: number = 500
  ): void {
    const startPos: any = {};
    const endPos: any = {};

    switch (from) {
      case 'left':
        startPos.x = -(target as any).x - 100;
        endPos.x = (target as any).x;
        break;
      case 'right':
        startPos.x = scene.scale.width + 100;
        endPos.x = (target as any).x;
        break;
      case 'top':
        startPos.y = -(target as any).y - 100;
        endPos.y = (target as any).y;
        break;
      case 'bottom':
        startPos.y = scene.scale.height + 100;
        endPos.y = (target as any).y;
        break;
    }

    Object.assign(target, startPos);
    scene.tweens.add({
      targets: target,
      ...endPos,
      duration,
      ease: 'Back.easeOut',
    });
  }
}