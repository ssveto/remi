// server/src/room-manager.ts
import { Room, Player } from './models/Room';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages all active game rooms
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map(); // playerId -> roomId
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    this.startCleanupTask();
  }

  /**
   * Create a new room
   */
  createRoom(
    hostPlayer: Player,
    maxPlayers: number = 6,
    isPrivate: boolean = false,
    password?: string
  ): Room {
    const room = new Room(hostPlayer, maxPlayers, isPrivate, password);
    
    this.rooms.set(room.id, room);
    this.playerToRoom.set(hostPlayer.id, room.id);
    
    console.log(`✅ Room created: ${room.id} by ${hostPlayer.name}`);
    
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(
    roomId: string,
    player: Player,
    password?: string
  ): { success: boolean; error?: string; room?: Room } {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Check password for private rooms
    if (!room.checkPassword(password || '')) {
      return { success: false, error: 'Incorrect password' };
    }

    // Check if room is full
    if (room.isFull()) {
      return { success: false, error: 'Room is full' };
    }

    // Check if game already started
    if (room.hasStarted) {
      // Allow reconnection
      const existingPlayer = room.getPlayer(player.id);
      if (!existingPlayer) {
        return { success: false, error: 'Game already in progress' };
      }
    }

    // Check if player is already in another room
    const currentRoom = this.playerToRoom.get(player.id);
    if (currentRoom && currentRoom !== roomId) {
      return { success: false, error: 'Already in another room' };
    }

    // Add player to room
    const added = room.addPlayer(player);
    if (!added) {
      return { success: false, error: 'Failed to join room' };
    }

    this.playerToRoom.set(player.id, roomId);
    
    console.log(`👤 ${player.name} joined room ${roomId}`);
    
    return { success: true, room };
  }

  /**
   * Remove a player from their room
   */
  leaveRoom(playerId: string): { success: boolean; roomId?: string; wasHost?: boolean } {
    const roomId = this.playerToRoom.get(playerId);
    
    if (!roomId) {
      return { success: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.playerToRoom.delete(playerId);
      return { success: false };
    }

    const wasHost = room.isHost(playerId);
    
    // Remove player from room
    room.removePlayer(playerId);
    this.playerToRoom.delete(playerId);

    console.log(`👋 Player ${playerId} left room ${roomId}`);

    // If room is empty and game hasn't started, delete it
    if (room.isEmpty() && !room.hasStarted) {
      this.deleteRoom(roomId);
      return { success: true, roomId, wasHost };
    }

    // If host left, transfer host to another player
    if (wasHost && !room.isEmpty()) {
      room.transferHost();
      console.log(`🔄 Host transferred in room ${roomId}`);
    }

    return { success: true, roomId, wasHost };
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room ID for a player
   */
  getRoomIdForPlayer(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }

  /**
   * Get all public rooms (for room list)
   */
  getPublicRooms(): Array<{
    id: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    hasStarted: boolean;
    createdAt: number;
  }> {
    const publicRooms: any[] = [];

    for (const room of this.rooms.values()) {
      if (!room.isPrivate && !room.hasStarted) {
        const host = room.players.find(p => p.isHost);
        publicRooms.push({
          id: room.id,
          hostName: host?.name || 'Unknown',
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          hasStarted: room.hasStarted,
          createdAt: room.createdAt,
        });
      }
    }

    return publicRooms;
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Remove all players from playerToRoom map
    for (const player of room.players) {
      this.playerToRoom.delete(player.id);
    }

    this.rooms.delete(roomId);
    
    console.log(`🗑️ Room deleted: ${roomId}`);
    
    return true;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRooms: number;
    activeGames: number;
    totalPlayers: number;
    publicRooms: number;
    privateRooms: number;
  } {
    let activeGames = 0;
    let totalPlayers = 0;
    let publicRooms = 0;
    let privateRooms = 0;

    for (const room of this.rooms.values()) {
      if (room.hasStarted) activeGames++;
      if (room.isPrivate) privateRooms++;
      else publicRooms++;
      totalPlayers += room.getConnectedPlayerCount();
    }

    return {
      totalRooms: this.rooms.size,
      activeGames,
      totalPlayers,
      publicRooms,
      privateRooms,
    };
  }

  /**
   * Start periodic cleanup task
   */
  private startCleanupTask(): void {
    // Clean up inactive rooms every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up inactive rooms
   */
  private cleanupInactiveRooms(): void {
    const roomsToDelete: string[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      if (room.shouldDelete()) {
        roomsToDelete.push(roomId);
      }
    }

    for (const roomId of roomsToDelete) {
      this.deleteRoom(roomId);
    }

    if (roomsToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${roomsToDelete.length} inactive rooms`);
    }
  }

  /**
   * Cleanup when shutting down
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as unknown as NodeJS.Timeout);
      this.cleanupInterval = null;
    }

    // Delete all rooms
    for (const roomId of this.rooms.keys()) {
      this.deleteRoom(roomId);
    }
  }
}