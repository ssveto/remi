// client/lib/network-manager.ts
import { io, Socket } from 'socket.io-client';
import {
  SocketEvent,
  CreateRoomRequest,
  JoinRoomRequest,
  DrawCardRequest,
  DiscardCardRequest,
  LayMeldsRequest,
  AddToMeldRequest,
  GameStateUpdate,
  ErrorResponse,
  RoomState,
  GameOverData,
  ChatMessageRequest,
  ChatMessage,
  InfoMessage,
} from '../../shared/';
import { RoundEndedData, RoundStartedData } from '@shared/types/socket-events';

// =============================================================================
// BROWSER-COMPATIBLE EVENT EMITTER
// =============================================================================

type EventCallback = (...args: any[]) => void;

class BrowserEventEmitter {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
    return this;
  }

  off(event: string, callback: EventCallback): this {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const callbacks = this.events.get(event);
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
      return true;
    }
    return false;
  }

  once(event: string, callback: EventCallback): this {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      callback(...args);
    };
    return this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }
}

// =============================================================================
// NETWORK MANAGER
// =============================================================================

export class NetworkManager extends BrowserEventEmitter {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private playerId: string | null | undefined = null;
  private playerName: string | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private lastGameState: GameStateUpdate | null = null;

  constructor() {
    super();
  }

  /**
   * Connect to the game server
   */
  async connect(serverUrl: string = 'http://localhost:3000'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('✅ Connected to game server');
        this.isConnected = true;
        this.playerId = this.socket!.id;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected:', reason);
        this.isConnected = false;
        this.emit('disconnected', reason);
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
        this.emit('reconnected');
      });

      this.socket.on('reconnect_attempt', (attemptNumber: number) => {
        this.reconnectAttempts = attemptNumber;
        console.log(`🔄 Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
        this.emit('reconnecting', attemptNumber);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed');
        this.emit('reconnect_failed');
      });

      // Set up all game event listeners
      this.setupEventListeners();
    });
  }

  /**
   * Set up all Socket.io event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Room events
    this.socket.on(SocketEvent.ROOM_CREATED, (data) => {
      console.log('🎮 Room created:', data);
      this.roomId = data.roomId;
      this.emit(SocketEvent.ROOM_CREATED, data);
    });

    this.socket.on(SocketEvent.ROOM_JOINED, (data) => {
      console.log('👥 Room joined:', data);
      this.roomId = data.roomId;
      this.emit(SocketEvent.ROOM_JOINED, data);
    });

    this.socket.on(SocketEvent.ROOM_UPDATED, (roomState: RoomState) => {
      console.log('🔄 Room updated:', roomState);
      this.emit(SocketEvent.ROOM_UPDATED, roomState);
    });

    this.socket.on(SocketEvent.PLAYER_JOINED, (data) => {
      console.log('👤 Player joined:', data);
      this.emit(SocketEvent.PLAYER_JOINED, data);
    });

    this.socket.on(SocketEvent.PLAYER_LEFT, (data) => {
      console.log('👋 Player left:', data);
      this.emit(SocketEvent.PLAYER_LEFT, data);
    });

    // Player reconnection event
    this.socket.on(SocketEvent.PLAYER_RECONNECTED, (data) => {
      console.log('🔄 Player reconnected:', data);
      this.emit(SocketEvent.PLAYER_RECONNECTED, data);
    });

    this.socket.on(SocketEvent.ROOM_LIST, (rooms: any[]) => {
      console.log('📋 Public rooms received:', rooms);
      this.emit(SocketEvent.ROOM_LIST, rooms);
    });

    this.socket.on(SocketEvent.GAME_STARTED, () => {
      console.log('🎲 Game started!');
      this.emit(SocketEvent.GAME_STARTED);
    });

    // Game state events
    this.socket.on(SocketEvent.GAME_STATE_UPDATE, (state: GameStateUpdate) => {
      this.lastGameState = state;  // Cache it
      console.log('📊 Game state update');
      this.emit(SocketEvent.GAME_STATE_UPDATE, state);
    });

    this.socket.on(SocketEvent.ROUND_STARTED, (data: RoundStartedData) => {
      console.log(`🔄 Round ${data.round} started`);
      this.emit(SocketEvent.ROUND_STARTED, data);
    });

    this.socket.on(SocketEvent.ROUND_ENDED, (data: RoundEndedData) => {
      console.log(`🎮 Round ${data.round} ended, winner: ${data.winner.name}`);
      this.emit(SocketEvent.ROUND_ENDED, data);
    });

    this.socket.on(SocketEvent.TURN_CHANGED, (data) => {
      console.log('🔄 Turn changed:', data);
      this.emit(SocketEvent.TURN_CHANGED, data);
    });

    this.socket.on(SocketEvent.CARD_DRAWN, (data) => {
      console.log('🎴 Card drawn');
      this.emit(SocketEvent.CARD_DRAWN, data);
    });

    this.socket.on(SocketEvent.CARD_DISCARDED, (data) => {
      console.log('🗑️ Card discarded');
      this.emit(SocketEvent.CARD_DISCARDED, data);
    });

    this.socket.on(SocketEvent.MELDS_LAID, (data) => {
      console.log('📋 Melds laid');
      this.emit(SocketEvent.MELDS_LAID, data);
    });

    // Meld phase skipped event
    this.socket.on(SocketEvent.MELD_PHASE_SKIPPED, (data) => {
      console.log('⏭️ Meld phase skipped');
      this.emit(SocketEvent.MELD_PHASE_SKIPPED, data);
    });

    // Card added to meld event
    this.socket.on(SocketEvent.CARD_ADDED_TO_MELD, (data) => {
      console.log('➕ Card added to meld');
      this.emit(SocketEvent.CARD_ADDED_TO_MELD, data);
    });

    this.socket.on(SocketEvent.GAME_OVER, (data: GameOverData) => {
      console.log('🏆 Game over:', data);
      this.emit(SocketEvent.GAME_OVER, data);
    });

    // Chat events
    this.socket.on(SocketEvent.CHAT_MESSAGE, (message: ChatMessage) => {
      this.emit(SocketEvent.CHAT_MESSAGE, message);
    });

    // Error and info
    this.socket.on(SocketEvent.ERROR, (error: ErrorResponse) => {
      console.error('⚠️ Server error:', error);
      this.emit(SocketEvent.ERROR, error);
    });

    this.socket.on(SocketEvent.INFO, (info: InfoMessage) => {
      console.log('ℹ️ Info:', info);
      this.emit(SocketEvent.INFO, info);
    });
  }

  // =============================================================================
  // ROOM MANAGEMENT
  // =============================================================================

  /**
   * Create a new game room
   */
  createRoom(playerName: string, maxPlayers: number = 3, isPrivate: boolean = false): void {
    if (!this.socket) {
      console.error('Not connected to server');
      return;
    }

    this.playerName = playerName;

    const request: CreateRoomRequest = {
      playerName,
      maxPlayers,
      isPrivate,
    };

    this.socket.emit(SocketEvent.CREATE_ROOM, request);
  }

  /**
   * Join an existing room
   */
  joinRoom(roomId: string, playerName: string, password?: string): void {
    if (!this.socket) {
      console.error('Not connected to server');
      return;
    }

    this.playerName = playerName;

    const request: JoinRoomRequest = {
      roomId,
      playerName,
      password,
    };

    this.socket.emit(SocketEvent.JOIN_ROOM, request);
  }

  /**
   * Leave the current room
   */
  leaveRoom(): void {
    if (!this.socket) return;

    // Clear ALL listeners for this room
    this.socket.off(SocketEvent.GAME_STATE_UPDATE);
    this.socket.off(SocketEvent.TURN_CHANGED);
    // ... clear all game-related events

    // Then leave
    this.socket.emit(SocketEvent.LEAVE_ROOM, { roomId: this.roomId });

    // Clear state
    this.lastGameState = null;
    this.roomId = null;
  }

  requestPublicRooms(): void {
    if (!this.socket) {
      console.error('Not connected to server');
      return;
    }

    console.log('🔍 Requesting public room list...');
    this.socket.emit(SocketEvent.GET_ROOMS);
  }

  /**
   * Start the game (host only)
   */
  startGame(): void {
    if (!this.socket || !this.roomId) return;

    this.socket.emit(SocketEvent.START_GAME, { roomId: this.roomId });
  }

  startNewRound(): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.START_NEW_ROUND, {
      roomId: this.roomId!,
    });
  }

  // =============================================================================
  // GAME ACTIONS
  // =============================================================================

  /**
   * Draw a card from the deck
   */
  drawCard(): void {
    if (!this.validateGameAction()) return;

    const request: DrawCardRequest = {
      roomId: this.roomId!,
    };

    this.socket!.emit(SocketEvent.DRAW_CARD, request);
  }

  /**
   * Draw the top card from the discard pile
   */
  drawFromDiscard(): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.DRAW_FROM_DISCARD, {
      roomId: this.roomId!,
    });
  }

  /**
   * Take the finishing card
   */
  takeFinishingCard(): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.TAKE_FINISHING_CARD, {
      roomId: this.roomId!,
      playerId: this.playerId,
    });
  }

  /**
   * Discard a card
   */
  discardCard(cardId: string): void {
    if (!this.validateGameAction()) return;

    const request: DiscardCardRequest = {
      roomId: this.roomId!,
      cardId,
    };

    this.socket!.emit(SocketEvent.DISCARD_CARD, request);
  }

  undoSpecialDraw(): void {
    this.socket!.emit(SocketEvent.UNDO_SPECIAL_DRAW, {
      roomId: this.roomId!,
    });
  }

  /**
   * Lay down melds
   */
  layMelds(melds: string[][]): void {
    if (!this.validateGameAction()) return;

    const request: LayMeldsRequest = {
      roomId: this.roomId!,
      melds,
    };

    this.socket!.emit(SocketEvent.LAY_MELDS, request);
  }

  /**
   * Skip the meld phase and move to discard
   * CRITICAL: This notifies the server to transition phases
   */
  skipMeld(): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.SKIP_MELD, {
      roomId: this.roomId!,
      playerId: this.playerId,
    });
  }

  /**
   * Add a card to an existing meld
   */
  /**
   * Add a card to an existing meld
   * @param cardId - ID of the card to add
   * @param meldOwner - Player ID who owns the meld
   * @param meldIndex - Index of the meld (0-indexed)
   */
  addCardToMeld(cardId: string, meldOwner: string, meldIndex: number): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.ADD_TO_MELD, {
      roomId: this.roomId!,
      playerId: this.playerId,
      cardId,
      meldOwner,
      meldIndex,
    });
  }

  /**
   * Reorder cards in hand (visual only, no validation)
   */
  reorderHand(fromIndex: number, toIndex: number): void {
    if (!this.validateGameAction()) return;

    this.socket!.emit(SocketEvent.REORDER_HAND, {
      roomId: this.roomId!,
      fromIndex,
      toIndex,
    });
  }

  // =============================================================================
  // CHAT & SOCIAL
  // =============================================================================

  /**
   * Send a chat message
   */
  sendChatMessage(message: string): void {
    if (!this.socket || !this.roomId) return;

    const request: ChatMessageRequest = {
      roomId: this.roomId,
      message,
    };

    this.socket.emit(SocketEvent.CHAT_MESSAGE, request);
  }

  /**
   * Send an emote
   */
  sendEmote(emoteType: 'nice' | 'oops' | 'thinking' | 'gg'): void {
    if (!this.socket || !this.roomId) return;

    this.socket.emit(SocketEvent.EMOTE, {
      roomId: this.roomId,
      emoteType,
    });
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

  /**
   * Validate that we can perform a game action
   */
  private validateGameAction(): boolean {
    if (!this.socket) {
      console.error('Not connected to server');
      return false;
    }

    if (!this.isConnected) {
      console.error('Connection lost');
      return false;
    }

    if (!this.roomId) {
      console.error('Not in a room');
      return false;
    }

    return true;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    this.roomId = null;
    this.playerId = null;
    this.playerName = null;
    this.isConnected = false;
    this.lastGameState = null;
  }

  // =============================================================================
  // GETTERS
  // =============================================================================

  getRoomId(): string | null {
    return this.roomId;
  }

  getPlayerId(): string | null | undefined {
    return this.playerId;
  }

  getPlayerName(): string | null {
    return this.playerName;
  }

  isInRoom(): boolean {
    return this.roomId !== null;
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' {
    if (this.isConnected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }
  getLastGameState(): GameStateUpdate | null {
    return this.lastGameState;
  }
}