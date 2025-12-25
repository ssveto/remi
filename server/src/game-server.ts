// server/src/game-server.ts
import { Server, Socket } from 'socket.io';
import { RoomManager } from './room-manager';
import { ServerGameState } from './models/ServerGameState';
import { Player } from './models/Room';
import {
  SocketEvent,
  JoinRoomRequest,
  DrawCardRequest,
  DiscardCardRequest,
  LayMeldsRequest,
  AddToMeldRequest,
  ReorderHandRequest,
  ChatMessageRequest,
  SkipMeldRequest,
  ErrorCode,
  createError,
} from '../../shared';

import type { CreateRoomRequest, RoundEndedData, RoundStartedData, StartNewRoundRequest } from '../../shared/types/socket-events';

/**
 * Main game server class
 * Handles all Socket.io events and coordinates game logic
 */
export class GameServer {
  private roomManager: RoomManager;
  private gameStates: Map<string, ServerGameState> = new Map();
  private socketToPlayer: Map<string, string> = new Map(); // socketId -> playerId
  private totalRounds: number = 10;

  constructor(private io: Server) {
    this.roomManager = new RoomManager();
    this.setupSocketHandlers();
    console.log('🎮 GameServer initialized');
  }

  /**
   * Set up all Socket.io event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Connection events
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // Room management
      socket.on(SocketEvent.CREATE_ROOM, (data: CreateRoomRequest) =>
        this.handleCreateRoom(socket, data)
      );
      socket.on(SocketEvent.JOIN_ROOM, (data: JoinRoomRequest) =>
        this.handleJoinRoom(socket, data)
      );
      socket.on(SocketEvent.LEAVE_ROOM, () => this.handleLeaveRoom(socket));
      socket.on(SocketEvent.START_GAME, () => this.handleStartGame(socket));
      socket.on(SocketEvent.RECONNECT, (data: { roomId: string; playerId: string }) =>
        this.handleReconnect(socket, data)
      );

      socket.on(SocketEvent.START_NEW_ROUND, (data: StartNewRoundRequest) =>
        this.handleStartNewRound(socket, data)
      );

      socket.on(SocketEvent.GET_ROOMS, () => {
        const publicRooms = this.roomManager.getPublicRooms();
        socket.emit(SocketEvent.ROOM_LIST, publicRooms); // Send list only to the requester
      });

      // Game actions
      socket.on(SocketEvent.DRAW_CARD, (data: DrawCardRequest) =>
        this.handleDrawCard(socket, data)
      );
      socket.on(SocketEvent.DRAW_FROM_DISCARD, (data: DrawCardRequest) =>
        this.handleDrawFromDiscard(socket, data)
      );
      socket.on(SocketEvent.TAKE_FINISHING_CARD, (data: DrawCardRequest) =>
        this.handleTakeFinishingCard(socket, data)
      );
      socket.on(SocketEvent.DISCARD_CARD, (data: DiscardCardRequest) =>
        this.handleDiscardCard(socket, data)
      );
      socket.on(SocketEvent.LAY_MELDS, (data: LayMeldsRequest) =>
        this.handleLayMelds(socket, data)
      );
      socket.on(SocketEvent.SKIP_MELD, (data: SkipMeldRequest) =>
        this.handleSkipMeld(socket, data)
      );
      socket.on(SocketEvent.ADD_TO_MELD, (data: AddToMeldRequest) =>
        this.handleAddToMeld(socket, data)
      );
      socket.on(SocketEvent.REORDER_HAND, (data: ReorderHandRequest) =>
        this.handleReorderHand(socket, data)
      );
      socket.on(SocketEvent.UNDO_SPECIAL_DRAW, (data: { roomId: string }) =>
        this.handleUndoSpecialDraw(socket, data)
      );

      // Chat
      socket.on(SocketEvent.CHAT_MESSAGE, (data: ChatMessageRequest) =>
        this.handleChatMessage(socket, data)
      );
    });
  }

  // ==========================================================================
  // CONNECTION HANDLERS
  // ==========================================================================

  private handleDisconnect(socket: Socket): void {
    console.log(`🔌 Client disconnected: ${socket.id}`);

    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const roomId = this.roomManager.getRoomIdForPlayer(playerId);
    if (!roomId) return;

    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Mark player as disconnected
    const player = room.getPlayer(playerId);
    if (player) {
      player.isConnected = false;

      // Update game state connection status
      const gameState = this.gameStates.get(roomId);
      if (gameState) {
        gameState.setPlayerConnected(playerId, false);
      }

      // Notify other players
      this.io.to(roomId).emit(SocketEvent.PLAYER_LEFT, {
        playerId,
        playerName: player.name,
        disconnected: true,
      });

      console.log(`👋 ${player.name} disconnected from room ${roomId}`);
    }

    // Clean up if game hasn't started
    if (!room.hasStarted) {
      this.roomManager.leaveRoom(playerId);
      this.socketToPlayer.delete(socket.id);
    }
  }

  // ==========================================================================
  // ROOM MANAGEMENT HANDLERS
  // ==========================================================================

  private handleCreateRoom(socket: Socket, data: CreateRoomRequest): void {
    try {
      const playerId = socket.id; // Use socket ID as player ID
      const player: Player = {
        id: playerId,
        name: data.playerName,
        socketId: socket.id,
        isHost: true,
        isConnected: true,
        joinedAt: Date.now(),
      };

      const room = this.roomManager.createRoom(
        player,
        data.maxPlayers,
        data.isPrivate,
        data.password
      );

      // Join socket to room
      socket.join(room.id);
      this.socketToPlayer.set(socket.id, playerId);

      // Send confirmation to creator
      socket.emit(SocketEvent.ROOM_CREATED, {
        success: true,
        roomId: room.id,
        playerId,
      });

      // Send room state
      socket.emit(SocketEvent.ROOM_UPDATED, room.toJSON());

      console.log(`✅ Room ${room.id} created by ${data.playerName}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.INTERNAL_SERVER_ERROR));
    }
  }

  private handleJoinRoom(socket: Socket, data: JoinRoomRequest): void {
    try {
      const playerId = socket.id;
      const player: Player = {
        id: playerId,
        name: data.playerName,
        socketId: socket.id,
        isHost: false,
        isConnected: true,
        joinedAt: Date.now(),
      };

      const result = this.roomManager.joinRoom(data.roomId, player, data.password);

      if (!result.success) {
        socket.emit(SocketEvent.ERROR, createError(ErrorCode.ROOM_NOT_FOUND, result.error));
        return;
      }

      // Join socket to room
      socket.join(data.roomId);
      this.socketToPlayer.set(socket.id, playerId);

      // Notify player they joined
      socket.emit(SocketEvent.ROOM_JOINED, {
        success: true,
        roomId: data.roomId,
        playerId,
      });

      // Notify all players in room
      this.io.to(data.roomId).emit(SocketEvent.PLAYER_JOINED, {
        playerId,
        playerName: data.playerName,
      });

      // Send updated room state to all
      this.io.to(data.roomId).emit(SocketEvent.ROOM_UPDATED, result.room!.toJSON());

      // Auto-start if room is full
      if (result.room!.isFull() && !result.room!.hasStarted) {
        setTimeout(() => this.startGame(data.roomId), 1000);
      }

      console.log(`👤 ${data.playerName} joined room ${data.roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.INTERNAL_SERVER_ERROR));
    }
  }

  private handleLeaveRoom(socket: Socket): void {
    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const result = this.roomManager.leaveRoom(playerId);
    if (!result.success || !result.roomId) return;

    // Leave socket room
    socket.leave(result.roomId);
    this.socketToPlayer.delete(socket.id);

    // Notify others
    this.io.to(result.roomId).emit(SocketEvent.PLAYER_LEFT, { playerId });

    // Send updated room state
    const room = this.roomManager.getRoom(result.roomId);
    if (room) {
      this.io.to(result.roomId).emit(SocketEvent.ROOM_UPDATED, room.toJSON());
    }
  }

  private handleStartGame(socket: Socket): void {
    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const roomId = this.roomManager.getRoomIdForPlayer(playerId);
    if (!roomId) return;

    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Only host can start
    if (!room.isHost(playerId)) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.NOT_HOST));
      return;
    }

    this.startGame(roomId);
  }

  private handleReconnect(socket: Socket, data: { roomId: string; playerId: string }): void {
    try {
      const room = this.roomManager.getRoom(data.roomId);
      if (!room) {
        socket.emit(SocketEvent.ERROR, createError(ErrorCode.ROOM_NOT_FOUND));
        return;
      }

      const player = room.getPlayer(data.playerId);
      if (!player) {
        socket.emit(SocketEvent.ERROR, createError(ErrorCode.PLAYER_NOT_FOUND));
        return;
      }

      // Update socket mapping
      player.socketId = socket.id;
      player.isConnected = true;
      this.socketToPlayer.set(socket.id, data.playerId);
      socket.join(data.roomId);

      // Update game state
      const gameState = this.gameStates.get(data.roomId);
      if (gameState) {
        gameState.setPlayerConnected(data.playerId, true);
      }

      // Notify others
      this.io.to(data.roomId).emit(SocketEvent.PLAYER_RECONNECTED, {
        playerId: data.playerId,
        playerName: player.name,
      });

      // Send current state to reconnected player
      if (gameState) {
        socket.emit(SocketEvent.GAME_STATE_UPDATE, gameState.getState(data.playerId));
      }

      console.log(`🔄 ${player.name} reconnected to room ${data.roomId}`);
    } catch (error) {
      console.error('Error reconnecting:', error);
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.INTERNAL_SERVER_ERROR));
    }
  }

  private startGame(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Check minimum players
    if (room.players.length < 2) {
      this.io.to(roomId).emit(SocketEvent.ERROR, createError(ErrorCode.TOO_FEW_PLAYERS));
      return;
    }

    // Mark room as started
    room.startGame();

    // Create game state with total rounds
    const playerIds = room.players.map(p => p.id);
    const playerNames = new Map(room.players.map(p => [p.id, p.name]));
    const gameState = new ServerGameState(playerIds, playerNames, this.totalRounds);
    this.gameStates.set(roomId, gameState);

    // Notify all players
    this.io.to(roomId).emit(SocketEvent.GAME_STARTED);

    // Emit round started (round 1)
    this.io.to(roomId).emit(SocketEvent.ROUND_STARTED, {
      round: 1,
      totalRounds: this.totalRounds,
    });

    // Send initial state to each player
    this.broadcastGameState(roomId);

    console.log(`🎲 Game started in room ${roomId} (${this.totalRounds} rounds)`);
  }

  // ==========================================================================
  // GAME ACTION HANDLERS
  // ==========================================================================

  private handleDrawCard(socket: Socket, data: DrawCardRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.drawCard(playerId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    // Broadcast updated state
    this.broadcastGameState(data.roomId);
  }

  private handleDrawFromDiscard(socket: Socket, data: DrawCardRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.drawFromDiscard(playerId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    this.broadcastGameState(data.roomId);
  }

  private handleTakeFinishingCard(socket: Socket, data: DrawCardRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.takeFinishingCard(playerId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    this.broadcastGameState(data.roomId);
  }

  private handleDiscardCard(socket: Socket, data: DiscardCardRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.discardCard(playerId, data.cardId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    // Check for round end (not necessarily game end)
    if (result.roundOver && result.winner) {
      this.handleRoundEnd(data.roomId, result.winner);
      return;
    }

    this.broadcastGameState(data.roomId);
  }

  private handleRoundEnd(roomId: string, winnerId: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Calculate round results
    const roundResults = gameState.handleRoundEnd(winnerId);
    const { roundScores, cumulativeScores, isFinalRound } = roundResults;
    
    const currentRound = gameState.getCurrentRound();

    // Prepare round ended data
    const roundEndData: RoundEndedData = {
      round: currentRound,
      winner: {
        id: winnerId,
        name: gameState.getPlayerName(winnerId) || 'Unknown',
      },
      roundScores: Array.from(roundScores.entries()).map(([playerId, score]) => ({
        playerId,
        playerName: gameState.getPlayerName(playerId) || 'Unknown',
        score,
      })),
      cumulativeScores: Array.from(cumulativeScores.entries()).map(([playerId, score]) => ({
        playerId,
        playerName: gameState.getPlayerName(playerId) || 'Unknown',
        score,
      })),
    };

    // Emit round ended event
    this.io.to(roomId).emit(SocketEvent.ROUND_ENDED, roundEndData);

    if (isFinalRound) {
      // Final round - game over
      console.log(`🎉 Final round completed! Game over for room ${roomId}`);
      
      // Wait a bit before showing final results
      setTimeout(() => {
        const stats = gameState.getGameStats(winnerId);
        this.io.to(roomId).emit(SocketEvent.GAME_OVER, stats);
        
        // Clean up game state
        this.gameStates.delete(roomId);
        room.hasStarted = false;
      }, 3000);
    } else {
      // Not final round - start next round after delay
      console.log(`🔄 Round ${currentRound} completed, starting next round in 5 seconds...`);
      
      setTimeout(() => {
        this.startNewRound(roomId);
      }, 5000); // 5 second delay
    }
  }

/**
 * Start a new round in the same room
 */
private startNewRound(roomId: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    try {
      gameState.startNewRound();
      
      const roundStartedData: RoundStartedData = {
        round: gameState.getCurrentRound(),
        totalRounds: gameState.getTotalRounds(),
      };
      
      // Emit round started event
      this.io.to(roomId).emit(SocketEvent.ROUND_STARTED, roundStartedData);
      
      console.log(`🔄 Round ${gameState.getCurrentRound()} started in room ${roomId}`);
      
      // Broadcast updated game state
      this.broadcastGameState(roomId);
    } catch (error) {
      console.error('Error starting new round:', error);
      this.io.to(roomId).emit(SocketEvent.ERROR, 
        createError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to start new round')
      );
    }
  }

  /**
   * Handle request to start new round (host only)
   */
  private handleStartNewRound(socket: Socket, data: StartNewRoundRequest): void {
    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.PLAYER_NOT_FOUND));
      return;
    }

    const room = this.roomManager.getRoom(data.roomId);
    if (!room) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.ROOM_NOT_FOUND));
      return;
    }

    // Only host can start new round
    if (!room.isHost(playerId)) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.NOT_HOST));
      return;
    }

    // Check if game has started
    if (!room.hasStarted) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.GAME_NOT_STARTED));
      return;
    }

    this.startNewRound(data.roomId);
  }

  private handleUndoSpecialDraw(socket: Socket, data: { roomId: string }): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.undoSpecialDraw(playerId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    socket.emit(SocketEvent.UNDO_CONFIRMED, { type: 'SPECIAL_DRAW' });
    this.broadcastGameState(data.roomId);
  }

  private handleLayMelds(socket: Socket, data: LayMeldsRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.layMelds(playerId, data.melds);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    this.broadcastGameState(data.roomId);
  }

  /**
   * Handle skip meld phase - THIS WAS MISSING!
   */
  private handleSkipMeld(socket: Socket, data: SkipMeldRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.skipMeld(playerId);

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    // Optionally emit a specific event
    this.io.to(data.roomId).emit(SocketEvent.MELD_PHASE_SKIPPED, { playerId });

    this.broadcastGameState(data.roomId);
  }

  private handleAddToMeld(socket: Socket, data: AddToMeldRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    const result = gameState.addToMeld(
      playerId,
      data.cardId,
      data.meldOwner,
      data.meldIndex
    );

    if (!result.success) {
      socket.emit(SocketEvent.ERROR, result.error);
      return;
    }

    this.broadcastGameState(data.roomId);
  }

  private handleReorderHand(socket: Socket, data: ReorderHandRequest): void {
    const { playerId, gameState } = this.getGameContext(socket, data.roomId);
    if (!playerId || !gameState) return;

    gameState.reorderHand(playerId, data.fromIndex, data.toIndex);

    // Only send updated state to the player who reordered
    const state = gameState.getState(playerId);
    socket.emit(SocketEvent.GAME_STATE_UPDATE, state);
  }





  private handleChatMessage(socket: Socket, data: ChatMessageRequest): void {
    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const room = this.roomManager.getRoom(data.roomId);
    if (!room) return;

    const player = room.getPlayer(playerId);
    if (!player) return;

    // Broadcast chat message to all in room
    this.io.to(data.roomId).emit(SocketEvent.CHAT_MESSAGE, {
      playerId,
      playerName: player.name,
      message: data.message,
      timestamp: Date.now(),
    });
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private getGameContext(socket: Socket, roomId: string) {
    const playerId = this.socketToPlayer.get(socket.id);
    const gameState = this.gameStates.get(roomId);

    if (!playerId) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.PLAYER_NOT_FOUND));
      return { playerId: null, gameState: null };
    }

    if (!gameState) {
      socket.emit(SocketEvent.ERROR, createError(ErrorCode.GAME_NOT_STARTED));
      return { playerId: null, gameState: null };
    }

    return { playerId, gameState };
  }

  private broadcastGameState(roomId: string): void {
    const gameState = this.gameStates.get(roomId);
    if (!gameState) return;

    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // Send personalized state to each player
    for (const player of room.players) {
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (socket) {
        // getState now requires playerId and returns GameStateUpdate with myHand
        const personalizedState = gameState.getState(player.id);
        socket.emit(SocketEvent.GAME_STATE_UPDATE, personalizedState);
      }
    }
  }



  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  getStats() {
    return {
      ...this.roomManager.getStats(),
      activeGames: this.gameStates.size,
    };
  }

  getPublicRooms() {
    return this.roomManager.getPublicRooms();
  }

  destroy(): void {
    this.roomManager.destroy();
    this.gameStates.clear();
    this.socketToPlayer.clear();
  }
}