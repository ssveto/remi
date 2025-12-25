// server/src/models/Room.ts
import { v4 as uuidv4 } from 'uuid';

export interface Player {
  id: string;
  name: string;
  socketId: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export class Room {
  public readonly id: string;
  public readonly hostId: string;
  public readonly maxPlayers: number;
  public readonly isPrivate: boolean;
  public readonly password?: string;
  public readonly createdAt: number;
  
  public players: Player[] = [];
  public hasStarted: boolean = false;
  public gameStartedAt: number | null = null;
  public lastActivityAt: number;

  constructor(
    hostPlayer: Player,
    maxPlayers: number = 3,
    isPrivate: boolean = false,
    password?: string
  ) {
    this.id = this.generateRoomId();
    this.hostId = hostPlayer.id;
    this.maxPlayers = maxPlayers;
    this.isPrivate = isPrivate;
    this.password = password;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    
    // Add host as first player
    this.players.push({ ...hostPlayer, isHost: true });
  }

  /**
   * Add a player to the room
   */
  addPlayer(player: Omit<Player, 'isHost'>): boolean {
    if (this.isFull()) {
      return false;
    }

    if (this.hasStarted) {
      return false;
    }

    // Check if player already exists (reconnection case)
    const existingPlayer = this.players.find(p => p.id === player.id);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      existingPlayer.socketId = player.socketId;
      this.updateActivity();
      return true;
    }

    // Add new player
    this.players.push({
      ...player,
      isHost: false,
      joinedAt: Date.now(),
    });
    
    this.updateActivity();
    return true;
  }

  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): boolean {
    const index = this.players.findIndex(p => p.id === playerId);
    
    if (index === -1) {
      return false;
    }

    // If game has started, mark as disconnected instead of removing
    if (this.hasStarted) {
      this.players[index].isConnected = false;
      this.updateActivity();
      return true;
    }

    // Remove player if game hasn't started
    this.players.splice(index, 1);
    this.updateActivity();
    
    return true;
  }

  /**
   * Get a player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Get a player by socket ID
   */
  getPlayerBySocketId(socketId: string): Player | undefined {
    return this.players.find(p => p.socketId === socketId);
  }

  /**
   * Check if room is full
   */
  isFull(): boolean {
    return this.players.length >= this.maxPlayers;
  }

  /**
   * Check if room is empty
   */
  isEmpty(): boolean {
    return this.players.length === 0;
  }

  /**
   * Get the number of connected players
   */
  getConnectedPlayerCount(): number {
    return this.players.filter(p => p.isConnected).length;
  }

  /**
   * Check if a player is the host
   */
  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  /**
   * Transfer host to another player (if host leaves)
   */
  transferHost(): boolean {
    if (this.isEmpty()) {
      return false;
    }

    // Find first connected player
    const newHost = this.players.find(p => p.isConnected);
    if (!newHost) {
      return false;
    }

    // Remove old host status
    this.players.forEach(p => p.isHost = false);
    
    // Set new host
    newHost.isHost = true;
    (this as any).hostId = newHost.id; // Override readonly for this case
    
    return true;
  }

  /**
   * Start the game
   */
  startGame(): boolean {
    if (this.hasStarted) {
      return false;
    }

    if (this.players.length < 2) {
      return false;
    }

    this.hasStarted = true;
    this.gameStartedAt = Date.now();
    this.updateActivity();
    
    return true;
  }

  /**
   * Check if password is correct
   */
  checkPassword(password: string): boolean {
    if (!this.isPrivate || !this.password) {
      return true;
    }
    
    return this.password === password;
  }

  /**
   * Get room state for clients
   */
  toJSON() {
    return {
      id: this.id,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      isPrivate: this.isPrivate,
      hasStarted: this.hasStarted,
      createdAt: this.createdAt,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isConnected: p.isConnected,
      })),
    };
  }

  /**
   * Check if room should be deleted (inactive for too long)
   */
  shouldDelete(inactiveTimeoutMs: number = 30 * 60 * 1000): boolean {
    // Delete if no connected players
    if (this.getConnectedPlayerCount() === 0) {
      return true;
    }

    // Delete if inactive for too long
    const inactiveDuration = Date.now() - this.lastActivityAt;
    return inactiveDuration > inactiveTimeoutMs;
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.lastActivityAt = Date.now();
  }

  /**
   * Generate a unique room ID
   */
  private generateRoomId(): string {
    // Generate 6-character uppercase alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
}