// client/scenes/lobby-scene.ts
import * as Phaser from 'phaser';
import { SCENE_KEYS } from './common';
import { NetworkManager } from '../lib/network-manager';
import { SocketEvent } from '../../shared/types/socket-events';

// ============================================================================
// CONFIGURATION - Edit these to customize appearance and layout
// ============================================================================

const CONFIG = {
  // Layout spacing (in pixels)
  layout: {
    titleY: 80,              // Title distance from top
    contentStartY: 0.30,     // Content starts at 30% of screen height
    elementSpacing: 80,      // Vertical space between elements
    inputSpacing: 100,       // Vertical space between input groups
    bottomPadding: 120,      // Space from bottom for action buttons
  },

  // Typography
  fonts: {
    title: { size: '48px', family: 'Arial', style: 'bold' },
    heading: { size: '32px', family: 'Arial', style: 'normal' },
    label: { size: '24px', family: 'Arial', style: 'normal' },
    body: { size: '20px', family: 'Arial', style: 'normal' },
    button: { size: '28px', family: 'Arial', style: 'normal' },
    smallButton: { size: '20px', family: 'Arial', style: 'normal' },
    roomCode: { size: '48px', family: 'Arial', style: 'bold' },
    playerName: { size: '28px', family: 'Arial', style: 'normal' },
  },

  // Colors
  colors: {
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      accent: '#FFD700',      // Gold for room codes
      success: '#4CAF50',
      error: '#f44336',
    },
    buttons: {
      create: '#4CAF50',      // Green
      join: '#2196F3',        // Blue
      browse: '#9C27B0',      // Purple
      back: '#757575',        // Gray
      start: '#4CAF50',       // Green
    },
    background: 0x000000,
    backgroundAlpha: 0.8,
  },

  // Button dimensions
  buttons: {
    large: { width: 400, height: 70, borderWidth: 3 },
    small: { width: 300, height: 50, borderWidth: 2 },
  },

  // Animation timings (ms)
  animation: {
    hoverScale: 100,
    messageFade: 2000,
    sceneTransition: 1000,
  },
};

// ============================================================================
// UI STATE ENUM - Different screens in the lobby
// ============================================================================

enum LobbyState {
  MAIN_MENU = 'main_menu',
  CREATE_ROOM = 'create_room',
  JOIN_ROOM = 'join_room',
  WAITING_ROOM = 'waiting_room',
  PUBLIC_ROOMS = 'public_rooms',
}

// ============================================================================
// LOBBY SCENE CLASS
// ============================================================================

export class LobbyScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private currentRoomId: string | null = null;
  private currentState: LobbyState = LobbyState.MAIN_MENU;

  // UI Groups - organized containers for easy cleanup
  private uiGroups: Map<string, Phaser.GameObjects.Group> = new Map();

  // Persistent elements (not cleared on state change)
  private backButton: Phaser.GameObjects.Container | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;

  // State-specific references
  private playerListTexts: Phaser.GameObjects.Text[] = [];
  private startButton: Phaser.GameObjects.Container | null = null;
  private roomCodeText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: SCENE_KEYS.LOBBY });
  }

  init(data: { networkManager: NetworkManager }): void {
    this.networkManager = data.networkManager;
  }

  create(): void {
    this.createUIGroups();
    this.createPersistentUI();
    this.setupNetworkListeners();
    this.transitionTo(LobbyState.MAIN_MENU);
  }

  // ==========================================================================
  // UI GROUP MANAGEMENT - Makes adding/removing elements easy
  // ==========================================================================

  private createUIGroups(): void {
    // Create groups for each state's UI elements
    Object.values(LobbyState).forEach(state => {
      this.uiGroups.set(state, this.add.group());
    });
    // Special group for messages/toasts
    this.uiGroups.set('messages', this.add.group());
  }

  /**
   * Add an element to a UI group for organized cleanup
   * @param groupName - Name of the group (usually the LobbyState)
   * @param element - The Phaser game object to add
   */
  private addToGroup(groupName: string, element: Phaser.GameObjects.GameObject): void {
    const group = this.uiGroups.get(groupName);
    if (group) {
      group.add(element);
    }
  }

  /**
   * Clear all elements from a specific group
   */
  private clearGroup(groupName: string): void {
    const group = this.uiGroups.get(groupName);
    if (group) {
      group.clear(true, true); // removeFromScene = true, destroyChild = true
    }
  }

  /**
   * Clear all dynamic UI (everything except persistent elements)
   */
  private clearDynamicUI(): void {
    Object.values(LobbyState).forEach(state => {
      this.clearGroup(state);
    });
    this.playerListTexts = [];
    this.startButton = null;
    this.roomCodeText = null;
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Transition to a new lobby state
   * This is the main method to switch between screens
   */
  private transitionTo(newState: LobbyState): void {
    // Clear previous state's UI
    this.clearDynamicUI();
    this.currentState = newState;

    if (this.titleText) {
      this.titleText.setVisible(newState !== LobbyState.PUBLIC_ROOMS);
    }

    // Build new state's UI
    switch (newState) {
      case LobbyState.MAIN_MENU:
        this.buildMainMenu();
        break;
      case LobbyState.CREATE_ROOM:
        this.buildCreateRoom();
        break;
      case LobbyState.JOIN_ROOM:
        this.buildJoinRoom();
        break;
      case LobbyState.WAITING_ROOM:
        this.buildWaitingRoom();
        break;
      case LobbyState.PUBLIC_ROOMS:
        this.buildPublicRooms();
        break;
    }
  }

  // ==========================================================================
  // PERSISTENT UI (Always visible)
  // ==========================================================================

  private createPersistentUI(): void {
    const { width } = this.scale;

    // Back button (top-left)
    this.backButton = this.createButton(
      50, 50,
      '← Back',
      CONFIG.colors.buttons.back,
      'small'
    );
    this.backButton.on('pointerdown', () => this.handleBack());

    // Title
    this.titleText = this.add.text(width / 2, CONFIG.layout.titleY, 'Multiplayer Lobby', {
      fontSize: CONFIG.fonts.title.size,
      fontFamily: CONFIG.fonts.title.family,
      color: CONFIG.colors.text.primary,
      fontStyle: CONFIG.fonts.title.style,
    }).setOrigin(0.5);
  }

  private handleBack(): void {
    if (this.currentState === LobbyState.WAITING_ROOM && this.currentRoomId) {
      this.networkManager.leaveRoom();
      this.currentRoomId = null;
    }

    if (this.currentState === LobbyState.MAIN_MENU) {
      // Leave lobby entirely
      this.networkManager.disconnect();
      this.scene.start(SCENE_KEYS.MENU);
    } else {
      // Go back to main menu within lobby
      this.transitionTo(LobbyState.MAIN_MENU);
    }
  }

  // ==========================================================================
  // MAIN MENU STATE
  // ==========================================================================

  private buildMainMenu(): void {
    const { width, height } = this.scale;
    const group = LobbyState.MAIN_MENU;

    // Calculate positions using a simple vertical stack
    const layout = new VerticalLayout(
      width / 2,
      height * CONFIG.layout.contentStartY,
      CONFIG.layout.elementSpacing
    );

    // Create Room Button
    const createBtn = this.createButton(
      layout.x, layout.nextY(),
      '🎮 Create Room',
      CONFIG.colors.buttons.create,
      'large'
    );
    createBtn.on('pointerdown', () => this.transitionTo(LobbyState.CREATE_ROOM));
    this.addToGroup(group, createBtn);

    // Join Room Button
    const joinBtn = this.createButton(
      layout.x, layout.nextY(),
      '🚪 Join Room',
      CONFIG.colors.buttons.join,
      'large'
    );
    joinBtn.on('pointerdown', () => this.transitionTo(LobbyState.JOIN_ROOM));
    this.addToGroup(group, joinBtn);

    // Browse Public Rooms Button
    const browseBtn = this.createButton(
      layout.x, layout.nextY(),
      '📋 Browse Public Rooms',
      CONFIG.colors.buttons.browse,
      'small'
    );
    browseBtn.on('pointerdown', () => this.transitionTo(LobbyState.PUBLIC_ROOMS));
    this.addToGroup(group, browseBtn);
  }

  // ==========================================================================
  // CREATE ROOM STATE
  // ==========================================================================

  private buildCreateRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.CREATE_ROOM;

    const layout = new VerticalLayout(
      width / 2,
      height * CONFIG.layout.contentStartY,
      CONFIG.layout.inputSpacing
    );

    // Label
    const label = this.createLabel(layout.x, layout.nextY(), 'Enter your name:');
    this.addToGroup(group, label);

    // Name input
    const inputY = layout.currentY + 50;
    const inputContainer = this.createTextInput(
      layout.x, inputY,
      'playerNameInput',
      'Your Name',
      20,
      CONFIG.colors.buttons.create
    );
    this.addToGroup(group, inputContainer);
    layout.advance(20); // Account for input height

    const privacyLabel = this.createLabel(layout.x, layout.nextY(), 'Room Visibility:');
    this.addToGroup(group, privacyLabel);

    // Create a simple DOM checkbox or a custom toggle button
    // Using a DOM element for simplicity and consistency with your inputs:
    const checkboxY = layout.currentY + 40;
    const privacyToggle = this.add.dom(layout.x, checkboxY).createFromHTML(`
  <div style="display: flex; align-items: center; color: white; font-family: Arial; font-size: 15px;">
    <input type="checkbox" id="isPublicCheckbox" style="width: 15px; height: 15px; margin-right: 10px;">
    <label for="isPublicCheckbox">Make Room Private</label>
  </div>
`);
    this.addToGroup(group, privacyToggle);
    layout.advance(20);

    // Create button
    const confirmBtn = this.createButton(
      layout.x, layout.nextY(),
      'Create Room',
      CONFIG.colors.buttons.create,
      'large'
    );
    confirmBtn.on('pointerdown', () => this.handleCreateRoom());
    this.addToGroup(group, confirmBtn);
  }

  private handleCreateRoom(): void {
    const input = document.getElementById('playerNameInput') as HTMLInputElement;
    const publicCheckbox = document.getElementById('isPublicCheckbox') as HTMLInputElement;
    const playerName = input?.value.trim() || 'Player';
    const isPublic = publicCheckbox?.checked || false;

    if (playerName.length < 2) {
      this.showMessage('Name must be at least 2 characters!');
      return;
    }

    this.networkManager.createRoom(playerName, 6, isPublic);
    this.showLoadingMessage('Creating room...');
  }

  // ==========================================================================
  // JOIN ROOM STATE
  // ==========================================================================

  private buildJoinRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.JOIN_ROOM;

    const layout = new VerticalLayout(
      width / 2,
      height * 0.25, // Start a bit higher for more inputs
      60
    );

    // Room code label
    const roomLabel = this.createLabel(layout.x, layout.nextY(), 'Enter Room Code:');
    this.addToGroup(group, roomLabel);

    // Room code input
    const roomInputY = layout.currentY + 40;
    const roomInput = this.createTextInput(
      layout.x, roomInputY,
      'roomCodeInput',
      'ABC123',
      6,
      CONFIG.colors.buttons.join,
      { uppercase: true, letterSpacing: true, large: true }
    );
    this.addToGroup(group, roomInput);
    layout.advance(100);

    // Name label
    const nameLabel = this.createLabel(layout.x, layout.nextY(), 'Your Name:');
    this.addToGroup(group, nameLabel);

    // Name input
    const nameInputY = layout.currentY + 40;
    const nameInput = this.createTextInput(
      layout.x, nameInputY,
      'playerNameJoinInput',
      'Your Name',
      20,
      CONFIG.colors.buttons.join
    );
    this.addToGroup(group, nameInput);
    layout.advance(100);

    // Join button
    const joinBtn = this.createButton(
      layout.x, layout.nextY(),
      'Join Room',
      CONFIG.colors.buttons.join,
      'large'
    );
    joinBtn.on('pointerdown', () => this.handleJoinRoom());
    this.addToGroup(group, joinBtn);
  }

  private handleJoinRoom(): void {
    const roomInput = document.getElementById('roomCodeInput') as HTMLInputElement;
    const nameInput = document.getElementById('playerNameJoinInput') as HTMLInputElement;

    const roomCode = roomInput?.value.trim().toUpperCase() || '';
    const playerName = nameInput?.value.trim() || 'Player';

    if (roomCode.length !== 3) {
      this.showMessage('Room code must be 6 characters!');
      return;
    }

    if (playerName.length < 2) {
      this.showMessage('Name must be at least 2 characters!');
      return;
    }

    this.networkManager.joinRoom(roomCode, playerName);
    this.showLoadingMessage('Joining room...');
  }

  // ==========================================================================
  // WAITING ROOM STATE
  // ==========================================================================

  private buildWaitingRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.WAITING_ROOM;

    // Room code display
    this.roomCodeText = this.add.text(width / 2, 150, `Room: ${this.currentRoomId}`, {
      fontSize: CONFIG.fonts.roomCode.size,
      fontFamily: CONFIG.fonts.roomCode.family,
      color: CONFIG.colors.text.accent,
      fontStyle: CONFIG.fonts.roomCode.style,
    }).setOrigin(0.5);
    this.addToGroup(group, this.roomCodeText);

    // Subtitle
    const subtitle = this.add.text(width / 2, 210, 'Share this code with friends!', {
      fontSize: CONFIG.fonts.body.size,
      fontFamily: CONFIG.fonts.body.family,
      color: CONFIG.colors.text.secondary,
    }).setOrigin(0.5);
    this.addToGroup(group, subtitle);

    // Copy button (optional enhancement)
    const copyBtn = this.createButton(width / 2, 260, '📋 Copy Code', CONFIG.colors.buttons.browse, 'small');
    copyBtn.on('pointerdown', () => {
      if (this.currentRoomId) {
        navigator.clipboard.writeText(this.currentRoomId);
        this.showMessage('Code copied!', 1500);
      }
    });
    this.addToGroup(group, copyBtn);

    // Players header
    const playersHeader = this.add.text(width / 2, 350, 'Players:', {
      fontSize: CONFIG.fonts.heading.size,
      fontFamily: CONFIG.fonts.heading.family,
      color: CONFIG.colors.text.primary,
    }).setOrigin(0.5);
    this.addToGroup(group, playersHeader);

    // Start button (bottom)
    this.startButton = this.createButton(
      width / 2,
      height - CONFIG.layout.bottomPadding,
      '▶️ Start Game',
      CONFIG.colors.buttons.start,
      'large'
    );
    this.startButton.on('pointerdown', () => this.networkManager.startGame());
    this.startButton.setVisible(false);
    this.addToGroup(group, this.startButton);
  }

  /**
   * Update the player list in waiting room
   * Called when ROOM_UPDATED event is received
   */
  private updatePlayerList(players: any[]): void {
    if (this.currentState !== LobbyState.WAITING_ROOM) return;

    const { width } = this.scale;
    const group = LobbyState.WAITING_ROOM;

    // Clear old player texts
    this.playerListTexts.forEach(text => text.destroy());
    this.playerListTexts = [];

    // Create new player list
    let yPos = 400;
    const spacing = 50;

    players.forEach((player) => {
      const icon = player.isHost ? '👑' : '👤';
      const status = player.isConnected ? '🟢' : '🔴';

      const playerText = this.add.text(
        width / 2,
        yPos,
        `${icon} ${player.name} ${status}`,
        {
          fontSize: CONFIG.fonts.playerName.size,
          fontFamily: CONFIG.fonts.playerName.family,
          color: CONFIG.colors.text.primary,
        }
      ).setOrigin(0.5);

      this.addToGroup(group, playerText);
      this.playerListTexts.push(playerText);
      yPos += spacing;
    });

    // Update start button visibility
    const myPlayerId = this.networkManager.getPlayerId();
    const isHost = players.some(p => p.id === myPlayerId && p.isHost);
    const canStart = isHost && players.length >= 2;

    if (this.startButton) {
      this.startButton.setVisible(canStart);
    }
  }

  // ==========================================================================
  // PUBLIC ROOMS STATE (Placeholder)
  // ==========================================================================

  private buildPublicRooms(): void {
    const { width, height } = this.scale;
    const group = LobbyState.PUBLIC_ROOMS;

    const layout = new VerticalLayout(
      width / 2,
      CONFIG.layout.titleY, // Start higher to leave room for the list
      60
    );

    const title = this.add.text(layout.x, layout.nextY(), 'Available Public Rooms', {
      fontSize: CONFIG.fonts.title.size,
      fontFamily: CONFIG.fonts.title.family,
      color: CONFIG.colors.text.primary,
      fontStyle: CONFIG.fonts.title.style,
    }).setOrigin(0.5);
    this.addToGroup(group, title);

    const label = this.createLabel(layout.x, layout.nextY(), 'Enter your name:');
    this.addToGroup(group, label);

    // Name input - We give this a specific ID to find it later
    const inputY = layout.currentY + 40;
    const inputContainer = this.createTextInput(
      layout.x, inputY,
      'publicPlayerNameInput', // Unique ID for this screen
      'Your Name',
      20,
      CONFIG.colors.buttons.browse
    );
    this.addToGroup(group, inputContainer);
    layout.advance(80);

    // Container for the room list (to clear/refresh independently)
    const listContainer = this.add.container(0, layout.currentY);
    this.addToGroup(group, listContainer);

    // Request the rooms from the server
    this.networkManager.requestPublicRooms();
    this.showMessage('Fetching rooms...', 1000);
  }

  // ==========================================================================
  // NETWORK EVENT HANDLERS
  // ==========================================================================

  private setupNetworkListeners(): void {
    this.networkManager.on(SocketEvent.ROOM_CREATED, (data: any) => {
      console.log('Room created:', data.roomId);
      this.currentRoomId = data.roomId;
      this.transitionTo(LobbyState.WAITING_ROOM);
    });

    this.networkManager.on(SocketEvent.ROOM_JOINED, (data: any) => {
      console.log('Room joined:', data.roomId);
      this.currentRoomId = data.roomId;
      this.transitionTo(LobbyState.WAITING_ROOM);
    });

    this.networkManager.on(SocketEvent.ROOM_UPDATED, (roomState: any) => {
      console.log('Room updated:', roomState);
      this.updatePlayerList(roomState.players);
    });

    this.networkManager.on(SocketEvent.PLAYER_JOINED, (data: any) => {
      console.log('Player joined:', data.playerName);
      this.showMessage(`${data.playerName} joined!`, 2000);
    });

    this.networkManager.on(SocketEvent.PLAYER_LEFT, (data: any) => {
      console.log('Player left:', data.playerId);
      this.showMessage('A player left', 2000);
    });

    this.networkManager.on(SocketEvent.GAME_STARTED, () => {
      console.log('Game starting!');
      this.showMessage('Game starting...', CONFIG.animation.sceneTransition);

      this.time.delayedCall(CONFIG.animation.sceneTransition, () => {
        this.scene.start(SCENE_KEYS.GAME, {
          isMultiplayer: true,
          networkManager: this.networkManager,
          roomId: this.currentRoomId,
        });
      });
    });

    this.networkManager.on(SocketEvent.ERROR, (error: any) => {
      console.error('Network error:', error);
      this.showMessage(error.message || 'An error occurred', 3000);
    });

    this.networkManager.on(SocketEvent.ROOM_LIST, (rooms: any[]) => {
      this.updatePublicRoomsList(rooms);
    });

  }


  // ==========================================================================
  // UI COMPONENT FACTORIES
  // ==========================================================================

  /**
   * Create a styled button
   * 
   * To add a new button style, add an entry to CONFIG.buttons and pass the key
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    color: string,
    size: 'large' | 'small' = 'large'
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const { width, height, borderWidth } = CONFIG.buttons[size];
    const fontSize = size === 'large' ? CONFIG.fonts.button.size : CONFIG.fonts.smallButton.size;

    const bg = this.add.rectangle(0, 0, width, height, CONFIG.colors.background, CONFIG.colors.backgroundAlpha);
    bg.setStrokeStyle(borderWidth, parseInt(color.replace('#', '0x')));

    const label = this.add.text(0, 0, text, {
      fontSize,
      fontFamily: CONFIG.fonts.button.family,
      color: CONFIG.colors.text.primary,
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(width, height);
    container.setInteractive();

    // Hover effects
    const hoverColor = parseInt(color.replace('#', '0x'));
    container.on('pointerover', () => {
      bg.setFillStyle(hoverColor, 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: CONFIG.animation.hoverScale,
      });
    });

    container.on('pointerout', () => {
      bg.setFillStyle(CONFIG.colors.background, CONFIG.colors.backgroundAlpha);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: CONFIG.animation.hoverScale,
      });
    });

    return container;
  }

  /**
   * Create a text label
   */
  private createLabel(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontSize: CONFIG.fonts.label.size,
      fontFamily: CONFIG.fonts.label.family,
      color: CONFIG.colors.text.primary,
    }).setOrigin(0.5);
  }

  private updatePublicRoomsList(rooms: any[]): void {
    if (this.currentState !== LobbyState.PUBLIC_ROOMS) return;

    const { width } = this.scale;
    const group = LobbyState.PUBLIC_ROOMS;

    // Clear any existing room buttons in this state
    // (We use a filter to keep the name input and title)
    this.uiGroups.get(group)?.getChildren().forEach(child => {
      if (child instanceof Phaser.GameObjects.Container && (child as any).isRoomButton) {
        child.destroy();
      }
    });

    if (rooms.length === 0) {
      const noRooms = this.add.text(width / 2, 400, 'No public rooms found.', {
        fontSize: CONFIG.fonts.body.size,
        color: CONFIG.colors.text.primary
      }).setOrigin(0.5);
      this.addToGroup(group, noRooms);
      (noRooms as any).isRoomButton = true; // Mark for cleanup
      return;
    }

    rooms.forEach((room, index) => {
      const yPos = 300 + (index * 80);
      const roomBtn = this.createButton(
        width / 2,
        yPos,
        `Join ${room.hostName}'s Room (${room.playerCount}/${room.maxPlayers})`,
        CONFIG.colors.buttons.join,
        'small'
      );

      roomBtn.on('pointerdown', () => {
        const nameInput = document.getElementById('publicPlayerNameInput') as HTMLInputElement;
        const playerName = nameInput?.value.trim() || 'Player';

        if (playerName.length < 2) {
          this.showMessage('Please enter a name first!');
          return;
        }

        this.networkManager.joinRoom(room.id, playerName);
      });

      (roomBtn as any).isRoomButton = true; // Mark so we can refresh the list
      this.addToGroup(group, roomBtn);
    });
  }

  /**
   * Create an HTML text input
   * 
   * Options:
   * - uppercase: Force uppercase text
   * - letterSpacing: Add spacing between characters (for codes)
   * - large: Use larger dimensions
   */
  private createTextInput(
    x: number,
    y: number,
    id: string,
    placeholder: string,
    maxLength: number,
    borderColor: string,
    options: { uppercase?: boolean; letterSpacing?: boolean; large?: boolean } = {}
  ): Phaser.GameObjects.DOMElement {
    const width = options.large ? 250 : 300;
    const height = options.large ? 60 : 50;
    const fontSize = options.large ? 32 : 24;

    const style = `
      width: ${width}px;
      height: ${height}px;
      font-size: ${fontSize}px;
      text-align: center;
      ${options.uppercase ? 'text-transform: uppercase;' : ''}
      border: 2px solid ${borderColor};
      border-radius: 8px;
      background: #1a1a1a;
      color: white;
      padding: 8px;
      ${options.letterSpacing ? 'letter-spacing: 8px;' : ''}
    `;

    return this.add.dom(x, y).createFromHTML(`
      <input type="text" 
             id="${id}" 
             placeholder="${placeholder}" 
             maxlength="${maxLength}"
             style="${style}">
    `);
  }

  // ==========================================================================
  // MESSAGES & FEEDBACK
  // ==========================================================================

  /**
   * Show a temporary message at the bottom of the screen
   */
  private showMessage(text: string, duration: number = CONFIG.animation.messageFade): void {
    const message = this.add.text(
      this.scale.width / 2,
      this.scale.height - 50,
      text,
      {
        fontSize: CONFIG.fonts.label.size,
        fontFamily: CONFIG.fonts.label.family,
        color: CONFIG.colors.text.primary,
        backgroundColor: '#000000',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setDepth(1000);

    this.addToGroup('messages', message);

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 30,
      duration,
      ease: 'Power2',
      onComplete: () => message.destroy(),
    });
  }

  /**
   * Show a loading message (clears current state UI temporarily)
   */
  private showLoadingMessage(text: string): void {
    this.clearGroup(this.currentState);

    const loadingText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      text,
      {
        fontSize: CONFIG.fonts.heading.size,
        fontFamily: CONFIG.fonts.heading.family,
        color: CONFIG.colors.text.primary,
      }
    ).setOrigin(0.5);

    this.addToGroup(this.currentState, loadingText);
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  shutdown(): void {
    this.networkManager?.removeAllListeners();
    this.children.removeAll(true);

    this.uiGroups.clear();
  }
}

// ============================================================================
// HELPER CLASS: Vertical Layout Calculator
// ============================================================================

/**
 * Simple helper to calculate vertical positions for stacked elements
 * 
 * Usage:
 *   const layout = new VerticalLayout(centerX, startY, spacing);
 *   element1.setY(layout.nextY()); // Returns startY
 *   element2.setY(layout.nextY()); // Returns startY + spacing
 *   element3.setY(layout.nextY()); // Returns startY + spacing * 2
 */
class VerticalLayout {
  public x: number;
  public currentY: number;
  private spacing: number;
  private isFirst: boolean = true;

  constructor(x: number, startY: number, spacing: number) {
    this.x = x;
    this.currentY = startY;
    this.spacing = spacing;
  }

  /**
   * Get the next Y position and advance
   */
  nextY(): number {
    if (this.isFirst) {
      this.isFirst = false;
      return this.currentY;
    }
    this.currentY += this.spacing;
    return this.currentY;
  }

  /**
   * Manually advance by a custom amount (useful for varying element heights)
   */
  advance(amount: number): void {
    this.currentY += amount;
  }

  /**
   * Reset to a new position
   */
  reset(newY: number): void {
    this.currentY = newY;
    this.isFirst = true;
  }
}

// ============================================================================
// CUSTOMIZATION GUIDE
// ============================================================================

/*
HOW TO CUSTOMIZE THIS LOBBY:

1. CHANGING COLORS/FONTS/SIZES:
   - Edit the CONFIG object at the top of the file
   - All visual properties are centralized there

2. ADDING A NEW BUTTON:
   - Use this.createButton(x, y, text, color, size)
   - Add it to a group: this.addToGroup(groupName, button)
   - Available sizes: 'large', 'small'
   - To add a new size, add entry to CONFIG.buttons

3. ADDING A NEW SCREEN/STATE:
   - Add to LobbyState enum
   - Add case in transitionTo() method
   - Create buildYourState() method
   - All elements should use: this.addToGroup(LobbyState.YOUR_STATE, element)

4. CHANGING LAYOUT:
   - Use VerticalLayout helper for stacked elements
   - Edit CONFIG.layout for global spacing values
   - For custom layouts, calculate positions manually

5. ADDING NEW INPUT TYPES:
   - Extend createTextInput() or create new factory method
   - Follow the pattern of returning the DOM element

6. HANDLING OVERLAP:
   - Use VerticalLayout.advance() for custom spacing after large elements
   - Check CONFIG.layout.elementSpacing vs element heights

7. ADDING ANIMATIONS:
   - Add timing to CONFIG.animation
   - Use this.tweens.add() for Phaser animations

EXAMPLE - Adding a "Settings" button to main menu:

  private buildMainMenu(): void {
    // ... existing buttons ...

    // Add settings button
    const settingsBtn = this.createButton(
      layout.x, layout.nextY(),
      '⚙️ Settings',
      '#607D8B',  // Blue-gray
      'small'
    );
    settingsBtn.on('pointerdown', () => this.transitionTo(LobbyState.SETTINGS));
    this.addToGroup(group, settingsBtn);
  }

Then add LobbyState.SETTINGS and buildSettings() method.
*/