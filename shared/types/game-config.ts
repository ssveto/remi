// shared/types/game-config.ts
export interface GameConfig {
  maxPlayers: number;     // Total players (including human)
  rounds: number;         // Total rounds to play
  aiCount: number;        // Number of AI players (single player only)
  
  // Optional multiplayer settings
  isPublic?: boolean;     // Room visibility
  roomName?: string;      // Custom room name
}