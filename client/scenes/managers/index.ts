// client/scenes/managers/index.ts
// Barrel file for manager exports

export { HandManager, HAND_LAYOUT } from './HandManager';
export type { CardGameObject, HandLayout, SelectionValidation } from './HandManager';

export { MeldManager, MELD_CONFIG } from './MeldManager';
export type { PlayerMeld, MeldManagerConfig, JokerReplacementResult } from './MeldManager';

export { PlayerIconManager, PLAYER_ICON_CONFIG } from './PlayerIconManager';
export type { PlayerDisplayInfo, PlayerIcon, PlayerIconManagerConfig } from './PlayerIconManager';

export { DragDropManager, DROP_ZONE_CONFIG } from './DragDropManager';
export type { ZoneType, DragDropCallbacks, DiscardZoneConfig, DropResult } from './DragDropManager';

export { AIManager, AI_TIMING } from './AIManager';
export type { AIConfig, AIManagerCallbacks, AITurnPlan } from './AIManager';
