export interface PlayerInfo {
    id: string;
    name: string;
    socketId: string;
    isHost: boolean;
    isConnected: boolean;
    joinedAt: number;
}
export interface PlayerInfoSimple {
    id: string;
    name: string;
    isHost: boolean;
    isConnected: boolean;
}
export interface RoomState {
    id: string;
    hostId: string;
    maxPlayers: number;
    players: PlayerInfo[];
    hasStarted: boolean;
    isPrivate: boolean;
    password?: string;
    createdAt: number;
    lastActivityAt: number;
}
export interface RoomStateClient {
    roomId: string;
    hostId: string;
    maxPlayers: number;
    players: PlayerInfoSimple[];
    hasStarted: boolean;
    isPrivate: boolean;
}
export interface PublicRoomInfo {
    id: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    hasStarted: boolean;
    createdAt: number;
}
export interface PlayerActionHistory {
    playerId: string;
    actions: PlayerAction[];
}
export declare const PlayerActionType: {
    readonly DRAW: "DRAW";
    readonly DRAW_DISCARD: "DRAW_DISCARD";
    readonly DRAW_FINISHING: "DRAW_FINISHING";
    readonly DISCARD: "DISCARD";
    readonly LAY_MELD: "LAY_MELD";
    readonly ADD_TO_MELD: "ADD_TO_MELD";
    readonly SKIP_MELD: "SKIP_MELD";
};
export type PlayerActionType = typeof PlayerActionType[keyof typeof PlayerActionType];
export interface PlayerAction {
    type: PlayerActionType;
    timestamp: number;
    cardId?: string;
    meldIds?: string[];
}
export interface PlayerPreferences {
    playerId: string;
    autoSort: boolean;
    confirmDiscard: boolean;
    showTips: boolean;
    soundEnabled: boolean;
    theme: 'light' | 'dark';
}
//# sourceMappingURL=player.types.d.ts.map