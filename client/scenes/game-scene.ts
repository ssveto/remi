// client/scenes/game-scene.ts (FINAL - ULTRA LEAN)
//
// Complete refactoring with:
// - 5 Managers: Hand, Meld, PlayerIcon, DragDrop, AI
// - 2 Handlers: SinglePlayer, Multiplayer
//
// GameScene is now ~350 lines - just initialization, UI, and coordination

import * as Phaser from 'phaser';
import { Card } from '../lib/card';
import { GamePhase } from '../lib/game-event';
import { NetworkManager } from '../lib/network-manager';
import { SCENE_KEYS, COLORS, DEPTHS, CARD_WIDTH, CARD_HEIGHT, ASSET_KEYS } from './common';
import { UIHelpers } from '../lib/ui-helpers';
import { AIDifficulty } from '../lib/ai-player';
import { CardData } from '../../shared/types/socket-events';
// Import managers
import {
  HandManager,
  MeldManager,
  PlayerIconManager,
  DragDropManager,
  AIManager,
  CardGameObject,
  PlayerDisplayInfo,
} from './managers';

// Import handlers
import {
  SinglePlayerHandler,
  MultiplayerHandler,
} from './handlers';

import { GameSceneInterface } from './handlers';

// =============================================================================
// CONSTANTS
// =============================================================================

const SCALE = 1;

const LAYOUT = {
  DISCARD_PILE: { x: 780, y: 340 },
  DRAW_PILE: { x: 490, y: 340 },
  FINISHING_CARD: { x: 640, y: 320 },
} as const;



// =============================================================================
// GAME SCENE - LEAN COORDINATOR
// =============================================================================

export class GameScene extends Phaser.Scene {
  // -------------------------------------------------------------------------
  // Mode Configuration
  // -------------------------------------------------------------------------
  private isMultiplayer: boolean = false;
  private networkManager: NetworkManager | null = null;
  private myPlayerId: string | null = null;


  // Single player configuration
  private numPlayers: number = 4;  // Default value
  private numRounds: number = 10;   // Default value
  private currentRound: number = 1;        // Add this
  private totalScores: Map<number | string, number> = new Map();  // Track scores across rounds
  private aiDifficulty: AIDifficulty = AIDifficulty.EXPERT;  // Default value

  // -------------------------------------------------------------------------
  // Managers
  // -------------------------------------------------------------------------
  public handManager!: HandManager;
  public meldManager!: MeldManager;
  public playerIconManager!: PlayerIconManager;
  public dragDropManager!: DragDropManager;
  public aiManager!: AIManager;

  // -------------------------------------------------------------------------
  // Mode Handlers
  // -------------------------------------------------------------------------
  private singlePlayerHandler: SinglePlayerHandler | null = null;
  private multiplayerHandler: MultiplayerHandler | null = null;

  // -------------------------------------------------------------------------
  // Game Objects
  // -------------------------------------------------------------------------
  private drawPileSprites: Phaser.GameObjects.Image[] = [];
  public discardPileSprite: Phaser.GameObjects.Image | null = null;
  public finishingCardSprite: Phaser.GameObjects.Image | null = null;
  private drawZone: Phaser.GameObjects.Zone | null = null;

  // -------------------------------------------------------------------------
  // UI Elements
  // -------------------------------------------------------------------------
  private phaseText: Phaser.GameObjects.Text | null = null;
  private turnIndicator: Phaser.GameObjects.Text | null = null;
  private myScoreText: Phaser.GameObjects.Text | null = null;
  private meldScoreText: Phaser.GameObjects.Text | null = null;
  private meldButton: Phaser.GameObjects.Container | null = null;
  private undoDialog: Phaser.GameObjects.Container | null = null;
  private scoreDisplay: Phaser.GameObjects.Container | null = null;
  private roundTitleText: Phaser.GameObjects.Text | null = null;
  private standingsTitleText: Phaser.GameObjects.Text | null = null;
  private scoreDisplayShown: boolean = false;
  private standingsListContainer: Phaser.GameObjects.Container | null = null;

  // -------------------------------------------------------------------------
  // State (public for handlers)
  // -------------------------------------------------------------------------
  public isMyTurn: boolean = false;
  public currentPhase: GamePhase = GamePhase.DRAW;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  // ==========================================================================
  // PHASER LIFECYCLE
  // ==========================================================================

  init(data: any): void {
    this.isMultiplayer = data.isMultiplayer || false;

    if (this.isMultiplayer) {
      this.networkManager = data.networkManager;
      this.myPlayerId = this.networkManager?.getPlayerId() || null;
    } else {
      if (data.gameConfig) {
        this.numPlayers = data.gameConfig.maxPlayers || 4;
        this.numRounds = data.gameConfig.rounds || 3;
        this.aiDifficulty = AIDifficulty.EXPERT; // Or get from data if available
      } else {
        // Fallback for direct scene start
        this.numPlayers = data.numPlayers || 4;
        this.numRounds = data.numRounds || 3;
        this.aiDifficulty = data.aiDifficulty || AIDifficulty.EXPERT;
      }

      this.currentRound = 1;
      this.totalScores = new Map();
      // Initialize total scores for all players
      for (let i = 0; i < this.numPlayers; i++) {
        this.totalScores.set(i, 0);
      }
    }
  }

  create(): void {
    this.initializeManagers();
    this.createUI();

    if (this.isMultiplayer) {
      this.setupMultiplayerMode();
    } else {
      this.setupSinglePlayerMode();
    }

    this.createScoreDisplay();
  }


  shutdown(): void {
    this.singlePlayerHandler?.destroy();
    this.multiplayerHandler?.destroy();

    this.singlePlayerHandler = null;
    this.multiplayerHandler = null;

    this.handManager.destroy();
    this.meldManager.destroy();
    this.playerIconManager.destroy();
    this.dragDropManager.destroy();
    this.aiManager.destroy();

    this.undoDialog?.destroy();
    this.scoreDisplay?.destroy();

    this.isMyTurn = false;
    this.currentPhase = GamePhase.DRAW;
  }

  // ==========================================================================
  // STATE SETTERS (for handlers)
  // ==========================================================================

  setIsMyTurn(value: boolean): void {
    this.isMyTurn = value;
  }

  setCurrentPhase(phase: GamePhase): void {
    this.currentPhase = phase;
  }


  // ==========================================================================
  // MANAGER INITIALIZATION
  // ==========================================================================

  private initializeManagers(): void {
    this.handManager = new HandManager(this, {
      isMultiplayer: () => this.isMultiplayer,
      getCardId: (card) => this.isMultiplayer ? (card as any).serverId || card.id : card.id,
      hasPlayerOpened: () => this.getHandler()?.hasPlayerOpened(0) ?? false,
      onSelectionChanged: () => { this.updateMeldUI(); },
    });

    this.meldManager = new MeldManager(this, {
      isMultiplayer: () => this.isMultiplayer,
      getMyPlayerIndex: () => this.isMultiplayer
        ? this.multiplayerHandler?.getMyPlayerIndex() ?? 0
        : 0,
      getOpponentIndex: (idx) => {
        const myIdx = this.isMultiplayer ? this.multiplayerHandler?.getMyPlayerIndex() ?? 0 : 0;
        return idx < myIdx ? idx : idx - 1;
      },
      showMessage: (text) => this.showMessage(text),
    });

    this.playerIconManager = new PlayerIconManager(this, {
      getPlayersInfo: () => this.getPlayersDisplayInfo(),
      onPlayerClick: (idx) => this.viewPlayerMelds(idx),
    });

    this.dragDropManager = new DragDropManager(this, {
      isMyTurn: () => this.isMyTurn,
      getCurrentPhase: () => this.currentPhase,
      isMultiplayer: () => this.isMultiplayer,
      isCardSelected: (cardGO) => this.handManager.isSelected(cardGO),
      getCardSpriteIndex: (cardGO) => this.handManager.getSpriteIndex(cardGO),
      onCardDeselect: (cardGO) => this.handManager.deselectCard(cardGO),
      onHandReorder: (from, to) => this.handleHandReorder(from, to),
      onDiscardDrop: (card, cardGO) => this.handleDiscardDrop(card, cardGO),
      onMeldDrop: (card, cardGO, owner, idx) => this.handleMeldDrop(card, cardGO, owner, idx),
      showMessage: (text) => this.showMessage(text),
      updateHandDisplay: () => this.handManager.updateHandDisplay(),
    });
    this.dragDropManager.setup();

    this.aiManager = new AIManager(this, {
      getLogic: () => this.singlePlayerHandler?.getLogic() ?? null,
      showMessage: (text) => this.showMessage(text),
      updatePlayerIcons: () => this.playerIconManager.updateAll(),
      onOpponentOpened: (idx) => {
        const melds = this.singlePlayerHandler?.getPlayerMelds(idx) ?? [];
        this.meldManager.showOpponentMelds(idx, melds);
      },
    }, { difficulty: AIDifficulty.EXPERT });
  }

  // ==========================================================================
  // MODE SETUP
  // ==========================================================================

  private setupSinglePlayerMode(): void {
    this.singlePlayerHandler = new SinglePlayerHandler(this, {
      numPlayers: this.numPlayers,
      numRounds: this.numRounds,        // Add this
      aiDifficulty: this.aiDifficulty,   // Add this
      layout: LAYOUT,
    });
    this.singlePlayerHandler.setup();
  }

  private setupMultiplayerMode(): void {
    if (!this.networkManager || !this.myPlayerId) {
      console.error('Missing network configuration');
      return;
    }

    this.multiplayerHandler = new MultiplayerHandler(this, {
      networkManager: this.networkManager,
      myPlayerId: this.myPlayerId,
      layout: LAYOUT,
    });
    this.multiplayerHandler.setup();
  }

  private getHandler(): SinglePlayerHandler | MultiplayerHandler | null {
    return this.isMultiplayer ? this.multiplayerHandler : this.singlePlayerHandler;
  }

  // ==========================================================================
  // DRAG/DROP CALLBACKS
  // ==========================================================================

  private handleHandReorder(from: number, to: number): void {
    this.singlePlayerHandler?.handleReorderHand(from, to);
    this.handManager.reorderCard(from, to);
  }

  private handleDiscardDrop(card: Card, cardGO: CardGameObject): void {
    let success = false;

    if (this.isMultiplayer && this.multiplayerHandler) {
      success = this.multiplayerHandler.handleDiscard(card, cardGO);
    } else if (this.singlePlayerHandler) {
      success = this.singlePlayerHandler.handleDiscard(card, cardGO);
    }

    if (!success) {
      this.dragDropManager.snapBack(cardGO);
    }
  }

  private handleMeldDrop(card: Card, cardGO: CardGameObject, owner: number | string, idx: number): void {
    let success = false;

    if (this.isMultiplayer && this.multiplayerHandler) {
      success = this.multiplayerHandler.handleAddToMeld(card, cardGO, owner as string, idx);
    } else if (this.singlePlayerHandler) {
      success = this.singlePlayerHandler.handleAddToMeld(card, owner as number, idx);
    }

    if (!success) {
      this.dragDropManager.snapBack(cardGO);
    }
  }

  // ==========================================================================
  // USER ACTIONS
  // ==========================================================================

  private handleDrawPileClick(): void {
    if (!this.isMyTurn || this.currentPhase !== GamePhase.DRAW) {
      this.showMessage('Cannot draw now');
      return;
    }

    if (this.isMultiplayer) {
      this.multiplayerHandler?.handleDrawPileClick();
    } else {
      this.singlePlayerHandler?.handleDrawPileClick();
    }
  }

  private handleDiscardPileClick(): void {
    if (!this.isMyTurn || this.currentPhase !== GamePhase.DRAW) {
      this.showMessage('Cannot draw from discard now');
      return;
    }

    if (this.isMultiplayer) {
      this.multiplayerHandler?.handleDiscardPileClick();
    } else {
      this.singlePlayerHandler?.handleDiscardPileClick();
    }
  }

  private handleFinishingCardClick(): void {
    if (!this.isMyTurn || this.currentPhase !== GamePhase.DRAW) return;

    if (this.isMultiplayer) {
      this.multiplayerHandler?.handleFinishingCardClick();
    } else {
      this.singlePlayerHandler?.handleFinishingCardClick();
    }
  }

  private handleLayMelds(): void {
    const selectedCards = this.handManager.getSelectedCardsInOrder();
    if (selectedCards.length < 3) {
      this.showMessage('Select at least 3 cards');
      return;
    }

    if (this.isMultiplayer) {
      this.multiplayerHandler?.handleLayMelds(selectedCards);
    } else if (this.singlePlayerHandler?.handleLayMelds(selectedCards)) {
      this.handManager.clearSelection();
      this.updateMeldUI();
    }
  }

  private viewPlayerMelds(playerIndex: number): void {
    const hasMelds = this.isMultiplayer
      ? this.multiplayerHandler?.hasPlayerOpened(playerIndex) ?? false
      : this.singlePlayerHandler?.hasPlayerOpened(playerIndex) ?? false;

    if (!hasMelds) {
      this.showMessage(`Player ${playerIndex + 1} has no melds yet`);
      return;
    }

    const getMelds = () => this.isMultiplayer
      ? this.multiplayerHandler?.getPlayerMelds(playerIndex) ?? []
      : this.singlePlayerHandler?.getPlayerMelds(playerIndex) ?? [];

    this.meldManager.togglePlayerMelds(playerIndex, getMelds);
  }

  // ==========================================================================
  // UI CREATION
  // ==========================================================================

  private createUI(): void {
    const { width, height } = this.scale;

    this.phaseText = this.add.text(width / 2, height / 2 - 140, '', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(DEPTHS.UI);

    this.turnIndicator = this.add.text(width / 2, height / 2 - 115, '', {
      fontSize: '18px', fontFamily: 'Arial', color: '#4CAF50', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTHS.UI);

    this.meldScoreText = this.add.text(60, 50, '0', {
      fontSize: '32px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTHS.UI);

    this.meldButton = this.createMeldButton();
    this.meldButton.setVisible(false);

    const backBtn = UIHelpers.createButton(this, 60, 100, '← Menu', COLORS.PRIMARY, 100, 40);
    backBtn.setDepth(DEPTHS.UI);
    backBtn.on('pointerdown', () => this.handleBackToMenu());
  }

  private createMeldButton(): Phaser.GameObjects.Container {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(0, 0, 180, 50, COLORS.SUCCESS).setStrokeStyle(3, 0xffffff);
    const text = this.add.text(0, 0, '📋 Lay Melds', {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.add.container(width / 2, height - 200, [bg, text]);
    container.setSize(200, 60).setInteractive({ useHandCursor: true }).setDepth(DEPTHS.UI);
    container.on('pointerover', () => bg.setFillStyle(0x66BB6A));
    container.on('pointerout', () => bg.setFillStyle(COLORS.SUCCESS));
    container.on('pointerdown', () => this.handleLayMelds());

    return container;
  }

  private createScoreDisplay(): void {
    const { width } = this.scale;

    // Create container for score display
    this.scoreDisplay = this.add.container(20, 150);

    // Title
    this.roundTitleText = this.add.text(0, 0, `Round ${this.currentRound}/${this.numRounds}`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#FFC107',
      fontStyle: 'bold'
    }).setOrigin(0, 0);

    this.standingsTitleText = this.add.text(0, 35, 'STANDINGS ▼', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#4CAF50',
      fontStyle: 'bold'
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    this.standingsListContainer = this.add.container(0, 75);
    this.standingsListContainer.setVisible(false); // Hidden by default

    this.scoreDisplay.add([this.roundTitleText, this.standingsTitleText, this.standingsListContainer]);
    this.scoreDisplay.setDepth(DEPTHS.UI);


    this.standingsTitleText.on('pointerdown', () => {
      this.scoreDisplayShown = !this.scoreDisplayShown;
      if (this.standingsListContainer === null) return;
      this.standingsListContainer.setVisible(this.scoreDisplayShown);

      if (this.standingsTitleText === null) return;
      this.standingsTitleText.setText(this.scoreDisplayShown ? 'STANDINGS ▲' : 'STANDINGS ▼');
      this.updateScoreDisplay();

    })
  }

  public updateScoreDisplay(): void {
    if (!this.scoreDisplay || !this.standingsListContainer) return;

    // 1. Always clear the old list inside the nested container
    this.standingsListContainer.removeAll(true);

    // 2. If the menu is closed, we stop here
    if (!this.scoreDisplayShown) return;

    // Get current standings
    const standings = this.getCurrentStandings();

    // Display rankings
    standings.forEach((player, index) => {
      const yPos = index * 40;
      const place = index + 1;
      const crown = place === 1 ? '👑 ' : '';
      const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;

      const scoreText = this.add.text(0, yPos,
        `${crown}${medal} ${player.name}: ${player.totalScore} pts`,
        {
          fontSize: '18px',
          fontFamily: 'Arial',
          color: player.isMe ? '#4CAF50' :
            player.isCurrentPlayer ? '#FFC107' : '#FFFFFF'
        }
      ).setOrigin(0, 0);

      this.standingsListContainer!.add(scoreText);
    });
  }

  private getCurrentStandings(): Array<{
    id: number | string;
    name: string;
    totalScore: number;
    isMe: boolean;
    isCurrentPlayer: boolean;
  }> {
    const players = this.getPlayersDisplayInfo();


    const standings = players.map(player => ({
      id: player.id,
      name: player.name,
      totalScore: this.totalScores.get(player.id) || 0,
      isMe: player.isMe,
      isCurrentPlayer: player.isCurrentPlayer
    }));

    return standings.sort((a, b) => a.totalScore - b.totalScore);
  }

  public getTotalScores(): Map<number | string, number> {
    return this.totalScores;
  }

  // ==========================================================================
  // PILE CREATION (called by handlers)
  // ==========================================================================

  createDrawPile(): void {
    this.drawPileSprites = [];
    for (let i = 0; i < 3; i++) {
      const sprite = this.add.image(
        LAYOUT.DRAW_PILE.x + i * 3, LAYOUT.DRAW_PILE.y, ASSET_KEYS.CARDS, 54
      ).setScale(SCALE).setDepth(DEPTHS.CARDS + i);
      this.drawPileSprites.push(sprite);
    }

    this.drawZone = this.add.zone(
      LAYOUT.DRAW_PILE.x, LAYOUT.DRAW_PILE.y, CARD_WIDTH * SCALE + 20, CARD_HEIGHT * SCALE + 20
    ).setInteractive({ useHandCursor: true });
    this.drawZone.on('pointerdown', () => this.handleDrawPileClick());
  }

  createDiscardPile(): void {
    this.add.rectangle(
      LAYOUT.DISCARD_PILE.x, LAYOUT.DISCARD_PILE.y,
      CARD_WIDTH * SCALE, CARD_HEIGHT * SCALE, 0x333333, 0.3
    ).setStrokeStyle(2, 0x666666).setDepth(DEPTHS.CARDS - 1);

    this.discardPileSprite = this.add.image(
      LAYOUT.DISCARD_PILE.x, LAYOUT.DISCARD_PILE.y, ASSET_KEYS.CARDS, 0
    ).setScale(SCALE).setDepth(DEPTHS.CARDS).setVisible(false);

    this.discardPileSprite.setInteractive({ useHandCursor: true });
    this.discardPileSprite.on('pointerdown', () => this.handleDiscardPileClick());
  }

  createFinishingCardDisplay(): void {
    const logic = this.singlePlayerHandler?.getLogic();
    if (!logic) return;

    const card = logic.getFinishingCard();
    if (!card) return;

    this.finishingCardSprite = this.add.image(
      LAYOUT.FINISHING_CARD.x, LAYOUT.FINISHING_CARD.y,
      ASSET_KEYS.CARDS, this.handManager.getCardFrame(card)
    ).setScale(SCALE * 0.9).setDepth(DEPTHS.CARDS);

    this.finishingCardSprite.setInteractive({ useHandCursor: true });
    this.finishingCardSprite.on('pointerdown', () => this.handleFinishingCardClick());
  }

  createFinishingCardFromServer(card: CardData): void {
    this.finishingCardSprite = this.add.image(
      LAYOUT.FINISHING_CARD.x, LAYOUT.FINISHING_CARD.y,
      ASSET_KEYS.CARDS, this.handManager.getCardFrame(card as any)
    ).setScale(SCALE * 0.9).setDepth(DEPTHS.CARDS);

    this.finishingCardSprite.setInteractive({ useHandCursor: true });
    this.finishingCardSprite.on('pointerdown', () => this.handleFinishingCardClick());
  }

  // ==========================================================================
  // UI UPDATES (called by handlers)
  // ==========================================================================

  updatePhaseUI(): void {
    const phaseNames: Record<GamePhase, string> = {
      [GamePhase.DRAW]: 'VUCI KARTU',
      [GamePhase.MELD]: 'IGRAJ',
      [GamePhase.DISCARD]: 'IZBACI KARTU',
      [GamePhase.GAME_OVER]: 'IGRA ZAVRSENA',
    };

    this.phaseText?.setText(this.isMyTurn ? phaseNames[this.currentPhase] : '');
    this.turnIndicator?.setText(this.isMyTurn ? 'TI SI NA REDU' : 'SACEKAJ...');
    this.turnIndicator?.setColor(this.isMyTurn ? '#4CAF50' : '#FFC107');
  }

  updateMeldUI(): void {
    const selectedCards = this.handManager.getSelectedCardsInOrder();

    let validation = { score: 0, isValid: false, meetsOpenRequirement: false };

    if (this.singlePlayerHandler) {
      validation = this.singlePlayerHandler.validateSelection(selectedCards);
    } else if (this.multiplayerHandler) {
      validation = this.multiplayerHandler.validateSelection(selectedCards);
    }

    // Update score text
    if (this.meldScoreText) {
      this.meldScoreText.setText(`${validation.score}`);
      this.meldScoreText.setColor(
        validation.score === 0 ? '#ffffff' :
          validation.meetsOpenRequirement ? '#00ff00' : '#ff0000'
      );
    }
    // Update button visibility
    if (this.meldButton) {
      const show = this.isMyTurn &&
        this.currentPhase === GamePhase.MELD &&
        selectedCards.length >= 3 &&
        validation.isValid &&
        validation.meetsOpenRequirement;
      this.meldButton.setVisible(show);
    }
  }

  public updateScores(): void {
    this.updateScoreDisplay();
    this.playerIconManager.updateAll();
  }

  showMessage(text: string, duration: number = 2000): void {
    const msg = this.add.text(this.scale.width / 2, this.scale.height / 2 + 100, text, {
      fontSize: '24px', fontFamily: 'Arial', color: '#ffffff',
      backgroundColor: '#000000', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: msg, alpha: 0, y: msg.y - 30, duration,
      ease: 'Power2', onComplete: () => msg.destroy(),
    });
  }

  showUndoOption(cardGO: CardGameObject, onUndo: () => void, onCancel: () => void): void {
    // Return card to original position
    cardGO.setPosition(
      cardGO.getData('origX'),
      cardGO.getData('origY')
    );

    // Destroy existing dialog if any
    this.undoDialog?.destroy();

    const message = this.add.text(
      LAYOUT.DRAW_PILE.x - 50, LAYOUT.DRAW_PILE.y + 80,
      'Kartu uzetu sa stola moras i da iskoristis!\n\nPonisti potez i vuci kartu iz spila?',
      {
        fontSize: '18px',
        color: '#000000',
        align: 'center',
        wordWrap: { width: 450 }
      }
    ).setOrigin(0);

    const undoBtn = this.add.rectangle(480, 540, 100, 40, 0x4CAF50)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => undoBtn.setFillStyle(0x66BB6A))
      .on('pointerout', () => undoBtn.setFillStyle(0x4CAF50))
      .on('pointerdown', () => {
        this.undoDialog?.destroy();
        this.undoDialog = null;
        onUndo();
      });

    const undoText = this.add.text(480, 540, 'DA!', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const cancelBtn = this.add.rectangle(800, 540, 100, 40, 0xF44336)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => cancelBtn.setFillStyle(0xE57373))
      .on('pointerout', () => cancelBtn.setFillStyle(0xF44336))
      .on('pointerdown', () => {
        this.undoDialog?.destroy();
        this.undoDialog = null;
        onCancel();
      });

    const cancelText = this.add.text(800, 540, 'NE!', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.undoDialog = this.add.container(0, 0, [
      message,
      undoBtn,
      undoText,
      cancelBtn,
      cancelText
    ]).setDepth(1000);
  }

  showFinishingCardUndoOption(cardGO: CardGameObject, onUndo: () => void, onCancel: () => void): void {
    // Return card to original position
    cardGO.setPosition(
      cardGO.getData('origX'),
      cardGO.getData('origY')
    );

    // Destroy existing dialog if any
    this.undoDialog?.destroy();

    const message = this.add.text(
      LAYOUT.DRAW_PILE.x - 50, LAYOUT.DRAW_PILE.y + 80,
      'S obzirom da si uzeo specijalnu kartu, moras i zavrsiti igru sada!\n\nPonisti potez i vuci kartu iz spila?',
      {
        fontSize: '18px',
        color: '#000000',
        align: 'center',
        wordWrap: { width: 450 }
      }
    ).setOrigin(0);

    const undoBtn = this.add.rectangle(480, 540, 100, 40, 0x4CAF50)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => undoBtn.setFillStyle(0x66BB6A))
      .on('pointerout', () => undoBtn.setFillStyle(0x4CAF50))
      .on('pointerdown', () => {
        this.undoDialog?.destroy();
        this.undoDialog = null;
        onUndo();
      });

    const undoText = this.add.text(480, 540, 'DA!', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const cancelBtn = this.add.rectangle(800, 540, 100, 40, 0xF44336)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => cancelBtn.setFillStyle(0xE57373))
      .on('pointerout', () => cancelBtn.setFillStyle(0xF44336))
      .on('pointerdown', () => {
        this.undoDialog?.destroy();
        this.undoDialog = null;
        onCancel();
      });

    const cancelText = this.add.text(800, 540, 'NE!', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.undoDialog = this.add.container(0, 0, [
      message,
      undoBtn,
      undoText,
      cancelBtn,
      cancelText
    ]).setDepth(1000);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getPlayersDisplayInfo(): PlayerDisplayInfo[] {
    if (this.isMultiplayer && this.multiplayerHandler) {
      const state = this.multiplayerHandler.getServerState();
      if (!state) return [];
      return state.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        handSize: p.handSize,
        hasOpened: p.hasOpened,
        isCurrentPlayer: p.id === state.currentPlayerId,
        isMe: p.id === this.myPlayerId,
        score: this.totalScores.get(p.id) || 0, // Get cumulative score
      }));
    } else if (this.singlePlayerHandler) {
      const logic = this.singlePlayerHandler.getLogic();
      if (!logic) return [];
      const state = logic.getState();

      // Always use the configured number of players, not just what's in state
      const totalPlayers = this.numPlayers;

      const players: PlayerDisplayInfo[] = [];
      for (let i = 0; i < totalPlayers; i++) {
        // Get cumulative score from totalScores, default to 0
        const cumulativeScore = this.totalScores.get(i) || 0;

        players.push({
          id: i,
          name: i === 0 ? 'You' : `Bot ${i}`, // Bot numbering starts from 1 for AI
          handSize: state.handSizes && state.handSizes[i] ? state.handSizes[i] : 0,
          hasOpened: state.playersHaveOpened && state.playersHaveOpened[i] ? state.playersHaveOpened[i] : false,
          isCurrentPlayer: i === state.currentPlayer,
          isMe: i === 0,
          score: cumulativeScore, // Use cumulative score, not hand penalty
        });
      }
      return players;
    }

    // Fallback: return basic player list using numPlayers even without handler
    const fallbackPlayers: PlayerDisplayInfo[] = [];
    for (let i = 0; i < this.numPlayers; i++) {
      fallbackPlayers.push({
        id: i,
        name: i === 0 ? 'You' : `Bot ${i}`,
        handSize: 0,
        hasOpened: false,
        isCurrentPlayer: i === 0,
        isMe: i === 0,
        score: this.totalScores.get(i) || 0, // Use cumulative score if available
      });
    }
    return fallbackPlayers;
  }

  private handleBackToMenu(): void {
    UIHelpers.createModal(this, 'Leave Game?', 'Are you sure?', [
      { text: 'Stay', callback: () => { }, color: COLORS.SECONDARY },
      {
        text: 'Leave',
        callback: () => {
          this.multiplayerHandler?.leaveRoom();
          this.multiplayerHandler?.disconnect();
          this.scene.stop(SCENE_KEYS.GAME);
          this.scene.start(SCENE_KEYS.MENU);
        },
        color: COLORS.ERROR,
      },
    ]);
  }

  // Add these methods to the GameScene class

  addRoundScore(playerId: number | string, score: number): void {
    const current = this.totalScores.get(playerId) || 0;
    this.totalScores.set(playerId, current + score);
    this.updateScoreDisplay();
    this.playerIconManager.updateAll();
  }

  setCurrentRound(round: number): void {
    this.currentRound = round;

    // Update the round display
    if (this.roundTitleText) {
      this.roundTitleText.setText(`Round ${this.currentRound}/${this.numRounds}`);
    }
  }

  public showFinalResults(results: any): void {
    const { winner, totalScores } = results;
    const winnerName = winner === 0 ? 'You' : `Bot ${winner}`;

    // Convert Map to array for sorting
    const scoresArray: [number | string, number][] = Array.from(totalScores.entries()); 
    const sortedScores = scoresArray.sort((a, b) => b[1] - a[1]); 

    let message = `🎉 GAME OVER! 🎉\n\n`;
    message += `🏆 Winner: ${winnerName}\n\n`;
    message += `FINAL STANDINGS:\n`;

    sortedScores.forEach(([playerId, score], index) => {
      const rank = index + 1;
      const playerName = playerId === 0 ? 'You' : `Bot ${playerId}`;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      message += `${medal} ${playerName}: ${score} points\n`;
    });

    UIHelpers.createModal(this, 'Game Complete!', message, [
      {
        text: 'Back to Menu',
        callback: () => {
          this.scene.start(SCENE_KEYS.MENU);
        },
        color: COLORS.PRIMARY
      },
      {
        text: 'Play Again',
        callback: () => {
          // Reset and start new game
          this.totalScores.clear();
          this.currentRound = 1;
          this.singlePlayerHandler?.destroy();
          this.setupSinglePlayerMode();
        },
        color: COLORS.SUCCESS
      }
    ]);
  }

}
