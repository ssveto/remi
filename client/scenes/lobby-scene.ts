// client/scenes/lobby-scene.ts
import * as Phaser from "phaser";
import { SCENE_KEYS } from "./common";
import { NetworkManager } from "../lib/network-manager";
import { SocketEvent } from "../../shared/types/socket-events";

// ============================================================================
// CONFIGURATION - Edit these to customize appearance and layout
// ============================================================================

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const CONFIG = {
  // Layout spacing (in pixels)
  layout: {
    titleY: 80, // Title distance from top
    contentStartY: 0.3, // Content starts at 30% of screen height
    elementSpacing: 80, // Vertical space between elements
    inputSpacing: 100, // Vertical space between input groups
    bottomPadding: 120, // Space from bottom for action buttons
  },

  // Typography
  fonts: {
    title: { size: "48px", family: "Arial", style: "bold" },
    heading: { size: "32px", family: "Arial", style: "normal" },
    label: { size: "24px", family: "Arial", style: "normal" },
    body: { size: "20px", family: "Arial", style: "normal" },
    button: { size: "28px", family: "Arial", style: "normal" },
    smallButton: { size: "20px", family: "Arial", style: "normal" },
    roomCode: { size: "48px", family: "Arial", style: "bold" },
    playerName: { size: "28px", family: "Arial", style: "normal" },
  },

  // Colors
  colors: {
    text: {
      primary: "#ffffff",
      secondary: "#cccccc",
      accent: "#FFD700", // Gold for room codes
      success: "#4CAF50",
      error: "#f44336",
    },
    buttons: {
      create: "#4CAF50", // Green
      join: "#2196F3", // Blue
      browse: "#9C27B0", // Purple
      back: "#757575", // Gray
      start: "#4CAF50", // Green
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
  MAIN_MENU = "main_menu",
  CREATE_ROOM = "create_room",
  JOIN_ROOM = "join_room",
  WAITING_ROOM = "waiting_room",
  PUBLIC_ROOMS = "public_rooms",
}

// ============================================================================
// LOBBY SCENE CLASS
// ============================================================================

export class LobbyScene extends Phaser.Scene {
  private networkManager!: NetworkManager;
  private currentRoomId: string | null = null;
  private currentState: LobbyState = LobbyState.MAIN_MENU;

  // Design Resolution constants - Ensure these match your Game Scene

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
  // SCALING LOGIC
  // ==========================================================================

  /**
   * Calculates the scale factor based on current window size vs design resolution.
   * Uses the logic provided for the game scene.
   */
  private getDynamicScale(): number {
    const width = this.scale.width;
    const height = this.scale.height;

    const scaleX = width / DESIGN_WIDTH;
    const scaleY = height / DESIGN_HEIGHT;

    let scale = Math.min(scaleX, scaleY);

    scale = Math.max(0.6, Math.min(scale, 2.0));
    return scale;
  }

  /**
   * Helper to scale a font size string (e.g. '48px' -> '24px')
   */
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
  // UI GROUP MANAGEMENT - Makes adding/removing elements easy
  // ==========================================================================

  private createUIGroups(): void {
    // Create groups for each state's UI elements
    Object.values(LobbyState).forEach((state) => {
      this.uiGroups.set(state, this.add.group());
    });
    // Special group for messages/toasts
    this.uiGroups.set("messages", this.add.group());
  }

  private addToGroup(
    groupName: string,
    element: Phaser.GameObjects.GameObject
  ): void {
    const group = this.uiGroups.get(groupName);
    if (group) {
      group.add(element);
    }
  }

  private clearGroup(groupName: string): void {
    const group = this.uiGroups.get(groupName);
    if (group) {
      group.clear(true, true); // removeFromScene = true, destroyChild = true
    }
  }

  private clearDynamicUI(): void {
    Object.values(LobbyState).forEach((state) => {
      this.clearGroup(state);
    });
    this.playerListTexts = [];
    this.startButton = null;
    this.roomCodeText = null;
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  private transitionTo(newState: LobbyState): void {
    this.clearDynamicUI();
    this.currentState = newState;

    if (this.titleText) {
      this.titleText.setVisible(newState !== LobbyState.PUBLIC_ROOMS);
    }

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
    const scale = this.getDynamicScale();

    // Back button (top-left)
    this.backButton = this.createButton(
      50,
      50,
      "← Back",
      CONFIG.colors.buttons.back,
      "small"
    );
    this.backButton.on("pointerdown", () => this.handleBack());

    // Title
    const fontConfig = this.getScaledFont(CONFIG.fonts.title);
    this.titleText = this.add
      .text(width / 2, CONFIG.layout.titleY, "Multiplayer Lobby", {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: CONFIG.colors.text.primary,
        fontStyle: fontConfig.fontStyle,
      })
      .setOrigin(0.5);
  }

  private handleBack(): void {
    if (this.currentState === LobbyState.WAITING_ROOM && this.currentRoomId) {
      this.networkManager.leaveRoom();
      this.currentRoomId = null;
    }

    if (this.currentState === LobbyState.MAIN_MENU) {
      this.networkManager.disconnect();
      this.scene.start(SCENE_KEYS.MENU);
    } else {
      this.transitionTo(LobbyState.MAIN_MENU);
    }
  }

  // ==========================================================================
  // MAIN MENU STATE
  // ==========================================================================

  private buildMainMenu(): void {
    const { width, height } = this.scale;
    const group = LobbyState.MAIN_MENU;
    const scale = this.getDynamicScale();

    const layout = new VerticalLayout(
      width / 2,
      height * CONFIG.layout.contentStartY,
      CONFIG.layout.elementSpacing,
      scale
    );

    // Create Room Button
    const createBtn = this.createButton(
      layout.x,
      layout.nextY(),
      "🎮 Create Room",
      CONFIG.colors.buttons.create,
      "large"
    );
    createBtn.on("pointerdown", () =>
      this.transitionTo(LobbyState.CREATE_ROOM)
    );
    this.addToGroup(group, createBtn);

    // Join Room Button
    const joinBtn = this.createButton(
      layout.x,
      layout.nextY(),
      "🚪 Join Room",
      CONFIG.colors.buttons.join,
      "large"
    );
    joinBtn.on("pointerdown", () => this.transitionTo(LobbyState.JOIN_ROOM));
    this.addToGroup(group, joinBtn);

    // Browse Public Rooms Button
    const browseBtn = this.createButton(
      layout.x,
      layout.nextY(),
      "📋 Browse Public Rooms",
      CONFIG.colors.buttons.browse,
      "small"
    );
    browseBtn.on("pointerdown", () =>
      this.transitionTo(LobbyState.PUBLIC_ROOMS)
    );
    this.addToGroup(group, browseBtn);
  }

  // ==========================================================================
  // CREATE ROOM STATE
  // ==========================================================================

  private buildCreateRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.CREATE_ROOM;
    const scale = this.getDynamicScale();

    const layout = new VerticalLayout(
      width / 2,
      height * CONFIG.layout.contentStartY,
      CONFIG.layout.inputSpacing,
      scale
    );

    const label = this.createLabel(
      layout.x,
      layout.nextY(),
      "Enter your name:"
    );
    this.addToGroup(group, label);

    const inputY = layout.currentY + 50 * scale; // Scale spacing too
    const inputContainer = this.createTextInput(
      layout.x,
      inputY,
      "playerNameInput",
      "Your Name",
      20,
      CONFIG.colors.buttons.create
    );
    this.addToGroup(group, inputContainer);
    layout.advance(20 * scale);

    const privacyLabel = this.createLabel(
      layout.x,
      layout.nextY(),
      "Room Visibility:"
    );
    this.addToGroup(group, privacyLabel);

    const checkboxY = layout.currentY + 40 * scale;
    const privacyToggle = this.add.dom(layout.x, checkboxY).createFromHTML(`
  <div style="display: flex; align-items: center; color: white; font-family: Arial; font-size: ${
    15 * scale
  }px;">
    <input type="checkbox" id="isPublicCheckbox" style="width: ${
      15 * scale
    }px; height: ${15 * scale}px; margin-right: 10px;">
    <label for="isPublicCheckbox">Make Room Private</label>
  </div>
`);
    this.addToGroup(group, privacyToggle);
    layout.advance(20 * scale);

    const confirmBtn = this.createButton(
      layout.x,
      layout.nextY(),
      "Create Room",
      CONFIG.colors.buttons.create,
      "large"
    );
    confirmBtn.on("pointerdown", () => this.handleCreateRoom());
    this.addToGroup(group, confirmBtn);
  }

  private handleCreateRoom(): void {
    const input = document.getElementById(
      "playerNameInput"
    ) as HTMLInputElement;
    const publicCheckbox = document.getElementById(
      "isPublicCheckbox"
    ) as HTMLInputElement;
    const playerName = input?.value.trim() || "Player";
    const isPublic = publicCheckbox?.checked || false;

    if (playerName.length < 2) {
      this.showMessage("Name must be at least 2 characters!");
      return;
    }

    this.networkManager.createRoom(playerName, 6, isPublic);
    this.showLoadingMessage("Creating room...");
  }

  // ==========================================================================
  // JOIN ROOM STATE
  // ==========================================================================

  private buildJoinRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.JOIN_ROOM;
    const scale = this.getDynamicScale();

    const layout = new VerticalLayout(width / 2, height * 0.25, 60, scale);

    const roomLabel = this.createLabel(
      layout.x,
      layout.nextY(),
      "Enter Room Code:"
    );
    this.addToGroup(group, roomLabel);

    const roomInputY = layout.currentY + 40 * scale;
    const roomInput = this.createTextInput(
      layout.x,
      roomInputY,
      "roomCodeInput",
      "ABC123",
      6,
      CONFIG.colors.buttons.join,
      { uppercase: true, letterSpacing: true, large: true }
    );
    this.addToGroup(group, roomInput);
    layout.advance(100 * scale);

    const nameLabel = this.createLabel(layout.x, layout.nextY(), "Your Name:");
    this.addToGroup(group, nameLabel);

    const nameInputY = layout.currentY + 40 * scale;
    const nameInput = this.createTextInput(
      layout.x,
      nameInputY,
      "playerNameJoinInput",
      "Your Name",
      20,
      CONFIG.colors.buttons.join
    );
    this.addToGroup(group, nameInput);
    layout.advance(100 * scale);

    const joinBtn = this.createButton(
      layout.x,
      layout.nextY(),
      "Join Room",
      CONFIG.colors.buttons.join,
      "large"
    );
    joinBtn.on("pointerdown", () => this.handleJoinRoom());
    this.addToGroup(group, joinBtn);
  }

  private handleJoinRoom(): void {
    const roomInput = document.getElementById(
      "roomCodeInput"
    ) as HTMLInputElement;
    const nameInput = document.getElementById(
      "playerNameJoinInput"
    ) as HTMLInputElement;

    const roomCode = roomInput?.value.trim().toUpperCase() || "";
    const playerName = nameInput?.value.trim() || "Player";

    if (roomCode.length !== 3) {
      // Note: Input maxlength is 6, but code checks 3? Kept original logic.
      this.showMessage("Room code must be 6 characters!");
      return;
    }

    if (playerName.length < 2) {
      this.showMessage("Name must be at least 2 characters!");
      return;
    }

    this.networkManager.joinRoom(roomCode, playerName);
    this.showLoadingMessage("Joining room...");
  }

  // ==========================================================================
  // WAITING ROOM STATE
  // ==========================================================================

  private buildWaitingRoom(): void {
    const { width, height } = this.scale;
    const group = LobbyState.WAITING_ROOM;
    const scale = this.getDynamicScale();

    const fontConfigRoom = this.getScaledFont(CONFIG.fonts.roomCode);
    this.roomCodeText = this.add
      .text(width / 2, 150, `Room: ${this.currentRoomId}`, {
        fontSize: fontConfigRoom.fontSize,
        fontFamily: fontConfigRoom.fontFamily,
        color: CONFIG.colors.text.accent,
        fontStyle: fontConfigRoom.fontStyle,
      })
      .setOrigin(0.5);
    this.addToGroup(group, this.roomCodeText);

    const fontConfigBody = this.getScaledFont(CONFIG.fonts.body);
    const subtitle = this.add
      .text(width / 2, 210, "Share this code with friends!", {
        fontSize: fontConfigBody.fontSize,
        fontFamily: fontConfigBody.fontFamily,
        color: CONFIG.colors.text.secondary,
      })
      .setOrigin(0.5);
    this.addToGroup(group, subtitle);

    const copyBtn = this.createButton(
      width / 2,
      260,
      "📋 Copy Code",
      CONFIG.colors.buttons.browse,
      "small"
    );
    copyBtn.on("pointerdown", () => {
      if (this.currentRoomId) {
        navigator.clipboard.writeText(this.currentRoomId);
        this.showMessage("Code copied!", 1500);
      }
    });
    this.addToGroup(group, copyBtn);

    const fontConfigHeading = this.getScaledFont(CONFIG.fonts.heading);
    const playersHeader = this.add
      .text(width / 2, 350, "Players:", {
        fontSize: fontConfigHeading.fontSize,
        fontFamily: fontConfigHeading.fontFamily,
        color: CONFIG.colors.text.primary,
      })
      .setOrigin(0.5);
    this.addToGroup(group, playersHeader);

    this.startButton = this.createButton(
      width / 2,
      height - CONFIG.layout.bottomPadding,
      "▶️ Start Game",
      CONFIG.colors.buttons.start,
      "large"
    );
    this.startButton.on("pointerdown", () => this.networkManager.startGame());
    this.startButton.setVisible(false);
    this.addToGroup(group, this.startButton);
  }

  private updatePlayerList(players: any[]): void {
    if (this.currentState !== LobbyState.WAITING_ROOM) return;

    const { width } = this.scale;
    const group = LobbyState.WAITING_ROOM;
    const scale = this.getDynamicScale();

    this.playerListTexts.forEach((text) => text.destroy());
    this.playerListTexts = [];

    let yPos = 400;
    const spacing = 50 * scale;

    const fontConfigPlayer = this.getScaledFont(CONFIG.fonts.playerName);

    players.forEach((player) => {
      const icon = player.isHost ? "👑" : "👤";
      const status = player.isConnected ? "🟢" : "🔴";

      const playerText = this.add
        .text(width / 2, yPos, `${icon} ${player.name} ${status}`, {
          fontSize: fontConfigPlayer.fontSize,
          fontFamily: fontConfigPlayer.fontFamily,
          color: CONFIG.colors.text.primary,
        })
        .setOrigin(0.5);

      this.addToGroup(group, playerText);
      this.playerListTexts.push(playerText);
      yPos += spacing;
    });

    const myPlayerId = this.networkManager.getPlayerId();
    const isHost = players.some((p) => p.id === myPlayerId && p.isHost);
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
    const scale = this.getDynamicScale();

    const layout = new VerticalLayout(
      width / 2,
      CONFIG.layout.titleY,
      60,
      scale
    );

    const fontConfigTitle = this.getScaledFont(CONFIG.fonts.title);
    const title = this.add
      .text(layout.x, layout.nextY(), "Available Public Rooms", {
        fontSize: fontConfigTitle.fontSize,
        fontFamily: fontConfigTitle.fontFamily,
        color: CONFIG.colors.text.primary,
        fontStyle: fontConfigTitle.fontStyle,
      })
      .setOrigin(0.5);
    this.addToGroup(group, title);

    const label = this.createLabel(
      layout.x,
      layout.nextY(),
      "Enter your name:"
    );
    this.addToGroup(group, label);

    const inputY = layout.currentY + 40 * scale;
    const inputContainer = this.createTextInput(
      layout.x,
      inputY,
      "publicPlayerNameInput",
      "Your Name",
      20,
      CONFIG.colors.buttons.browse
    );
    this.addToGroup(group, inputContainer);
    layout.advance(80 * scale);

    const listContainer = this.add.container(0, layout.currentY);
    this.addToGroup(group, listContainer);

    this.networkManager.requestPublicRooms();
    this.showMessage("Fetching rooms...", 1000);
  }

  // ==========================================================================
  // NETWORK EVENT HANDLERS
  // ==========================================================================

  private setupNetworkListeners(): void {
    this.networkManager.on(SocketEvent.ROOM_CREATED, (data: any) => {
      console.log("Room created:", data.roomId);
      this.currentRoomId = data.roomId;
      this.transitionTo(LobbyState.WAITING_ROOM);
    });

    this.networkManager.on(SocketEvent.ROOM_JOINED, (data: any) => {
      console.log("Room joined:", data.roomId);
      this.currentRoomId = data.roomId;
      this.transitionTo(LobbyState.WAITING_ROOM);
    });

    this.networkManager.on(SocketEvent.ROOM_UPDATED, (roomState: any) => {
      console.log("Room updated:", roomState);
      this.updatePlayerList(roomState.players);
    });

    this.networkManager.on(SocketEvent.PLAYER_JOINED, (data: any) => {
      console.log("Player joined:", data.playerName);
      this.showMessage(`${data.playerName} joined!`, 2000);
    });

    this.networkManager.on(SocketEvent.PLAYER_LEFT, (data: any) => {
      console.log("Player left:", data.playerId);
      this.showMessage("A player left", 2000);
    });

    this.networkManager.on(SocketEvent.GAME_STARTED, () => {
      console.log("Game starting!");
      this.showMessage("Game starting...", CONFIG.animation.sceneTransition);

      this.time.delayedCall(CONFIG.animation.sceneTransition, () => {
        this.scene.start(SCENE_KEYS.GAME, {
          isMultiplayer: true,
          networkManager: this.networkManager,
          roomId: this.currentRoomId,
        });
      });
    });

    this.networkManager.on(SocketEvent.ERROR, (error: any) => {
      console.error("Network error:", error);
      this.showMessage(error.message || "An error occurred", 3000);
    });

    this.networkManager.on(SocketEvent.ROOM_LIST, (rooms: any[]) => {
      this.updatePublicRoomsList(rooms);
    });
  }

  // ==========================================================================
  // UI COMPONENT FACTORIES
  // ==========================================================================

  private createButton(
    x: number,
    y: number,
    text: string,
    color: string,
    size: "large" | "small" = "large"
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const scale = this.getDynamicScale();

    const { width, height, borderWidth } = CONFIG.buttons[size];
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledBorder = borderWidth * scale;

    const bg = this.add.rectangle(
      0,
      0,
      scaledWidth,
      scaledHeight,
      CONFIG.colors.background,
      CONFIG.colors.backgroundAlpha
    );
    bg.setStrokeStyle(scaledBorder, parseInt(color.replace("#", "0x")));

    const baseFont =
      size === "large" ? CONFIG.fonts.button : CONFIG.fonts.smallButton;
    const fontConfig = this.getScaledFont(baseFont);

    const label = this.add
      .text(0, 0, text, {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: CONFIG.colors.text.primary,
      })
      .setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(scaledWidth, scaledHeight);
    container.setInteractive();

    // Hover effects
    const hoverColor = parseInt(color.replace("#", "0x"));
    container.on("pointerover", () => {
      bg.setFillStyle(hoverColor, 0.3);
      this.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: CONFIG.animation.hoverScale,
      });
    });

    container.on("pointerout", () => {
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

  private createLabel(
    x: number,
    y: number,
    text: string
  ): Phaser.GameObjects.Text {
    const fontConfig = this.getScaledFont(CONFIG.fonts.label);
    return this.add
      .text(x, y, text, {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: CONFIG.colors.text.primary,
      })
      .setOrigin(0.5);
  }

  private updatePublicRoomsList(rooms: any[]): void {
    if (this.currentState !== LobbyState.PUBLIC_ROOMS) return;

    const { width } = this.scale;
    const group = LobbyState.PUBLIC_ROOMS;

    this.uiGroups
      .get(group)
      ?.getChildren()
      .forEach((child) => {
        if (
          child instanceof Phaser.GameObjects.Container &&
          (child as any).isRoomButton
        ) {
          child.destroy();
        }
      });

    const scale = this.getDynamicScale();

    if (rooms.length === 0) {
      const fontConfig = this.getScaledFont(CONFIG.fonts.body);
      const noRooms = this.add
        .text(width / 2, 400, "No public rooms found.", {
          fontSize: fontConfig.fontSize,
          fontFamily: fontConfig.fontFamily,
          color: CONFIG.colors.text.primary,
        })
        .setOrigin(0.5);
      this.addToGroup(group, noRooms);
      (noRooms as any).isRoomButton = true;
      return;
    }

    rooms.forEach((room, index) => {
      const yPos = 300 + index * 80 * scale;
      const roomBtn = this.createButton(
        width / 2,
        yPos,
        `Join ${room.hostName}'s Room (${room.playerCount}/${room.maxPlayers})`,
        CONFIG.colors.buttons.join,
        "small"
      );

      roomBtn.on("pointerdown", () => {
        const nameInput = document.getElementById(
          "publicPlayerNameInput"
        ) as HTMLInputElement;
        const playerName = nameInput?.value.trim() || "Player";

        if (playerName.length < 2) {
          this.showMessage("Please enter a name first!");
          return;
        }

        this.networkManager.joinRoom(room.id, playerName);
      });

      (roomBtn as any).isRoomButton = true;
      this.addToGroup(group, roomBtn);
    });
  }

  private createTextInput(
    x: number,
    y: number,
    id: string,
    placeholder: string,
    maxLength: number,
    borderColor: string,
    options: {
      uppercase?: boolean;
      letterSpacing?: boolean;
      large?: boolean;
    } = {}
  ): Phaser.GameObjects.DOMElement {
    const scale = this.getDynamicScale();

    let width = options.large ? 250 : 300;
    let height = options.large ? 60 : 50;
    let fontSize = options.large ? 32 : 24;

    width = width * scale;
    height = height * scale;
    fontSize = fontSize * scale;
    const borderWidth = 2 * scale;

    const style = `
      width: ${width}px;
      height: ${height}px;
      font-size: ${fontSize}px;
      text-align: center;
      ${options.uppercase ? "text-transform: uppercase;" : ""}
      border: ${borderWidth}px solid ${borderColor};
      border-radius: 8px;
      background: #1a1a1a;
      color: white;
      padding: 8px;
      ${options.letterSpacing ? "letter-spacing: 8px;" : ""}
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

  private showMessage(
    text: string,
    duration: number = CONFIG.animation.messageFade
  ): void {
    const fontConfig = this.getScaledFont(CONFIG.fonts.label);
    const message = this.add
      .text(this.scale.width / 2, this.scale.height - 50, text, {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: CONFIG.colors.text.primary,
        backgroundColor: "#000000",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(1000);

    this.addToGroup("messages", message);

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 30,
      duration,
      ease: "Power2",
      onComplete: () => message.destroy(),
    });
  }

  private showLoadingMessage(text: string): void {
    this.clearGroup(this.currentState);
    const fontConfig = this.getScaledFont(CONFIG.fonts.heading);

    const loadingText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, text, {
        fontSize: fontConfig.fontSize,
        fontFamily: fontConfig.fontFamily,
        color: CONFIG.colors.text.primary,
      })
      .setOrigin(0.5);

    this.addToGroup(this.currentState, loadingText);
  }

  shutdown(): void {
    //this.scale.off("resize", this.updateLayout, this); // <--- ADD THIS LINE

    this.networkManager?.removeAllListeners();
    this.children.removeAll(true);
    this.uiGroups.clear();
  }
}

// ============================================================================
// HELPER CLASS: Vertical Layout Calculator
// ============================================================================

class VerticalLayout {
  public x: number;
  public currentY: number;
  private spacing: number;
  private isFirst: boolean = true;

  constructor(
    x: number,
    startY: number,
    baseSpacing: number,
    scaleFactor: number
  ) {
    this.x = x;
    this.currentY = startY;
    this.spacing = baseSpacing * scaleFactor;
  }

  nextY(): number {
    if (this.isFirst) {
      this.isFirst = false;
      return this.currentY;
    }
    this.currentY += this.spacing;
    return this.currentY;
  }

  advance(amount: number): void {
    this.currentY += amount;
  }

  reset(newY: number): void {
    this.currentY = newY;
    this.isFirst = true;
  }
}
