// client/managers/state-sync.ts
import type { GameStateUpdate, PlayerState } from '../../shared/types/socket-events';
import type { CardData } from '../../shared/types/card.types';

import { Card } from '../lib/card';
import { CardValue } from 'lib/common';

/**
 * Manages synchronization between server game state and client visuals
 * Converts server data to client objects and vice versa
 */
export class StateSync {
  /**
   * Convert server CardData to client Card instance
   */
  //   static serverCardToClient(serverCard: CardData): Card {
  //   const card = new Card(serverCard.suit, serverCard.value as CardValue);
  //   if (serverCard.isFaceUp) {
  //     card.flip();
  //   }
  //   // Preserve server ID for synchronization
  //   (card as any).serverId = serverCard.id;
  //   return card;
  // }

  static serverCardToClient(serverCard: CardData): Card {
    return new Card(serverCard.suit, serverCard.value as CardValue, serverCard.isFaceUp, serverCard.id);
  }
  /**
   * Convert client Card to server CardData
   */
  static clientCardToServer(clientCard: Card): CardData {
    return {
      id: (clientCard as any).serverId || clientCard.id,
      suit: clientCard.suit,
      value: clientCard.value,
      isFaceUp: clientCard.isFaceUp,
    };
  }

  /**
   * Convert array of server cards to client cards
   */
  static serverCardsToClient(serverCards: CardData[]): Card[] {
    return serverCards.map(card => this.serverCardToClient(card));
  }

  /**
   * Convert array of client cards to server cards
   */
  static clientCardsToServer(clientCards: Card[]): CardData[] {
    return clientCards.map(card => this.clientCardToServer(card));
  }

  /**
   * Extract card IDs from client cards
   */
  static getCardIds(cards: Card[]): string[] {
    return cards.map(card => (card as any).serverId || card.id);
  }

  /**
   * Find client card by server ID
   */
  static findCardByServerId(cards: Card[], serverId: string): Card | undefined {
    return cards.find(card => (card as any).serverId === serverId || card.id === serverId);
  }

  /**
   * Compare if two card sets are equal (by IDs)
   */
  static areCardSetsEqual(cards1: Card[], cards2: CardData[]): boolean {
    if (cards1.length !== cards2.length) return false;

    const ids1 = cards1.map(c => (c as any).serverId || c.id).sort();
    const ids2 = cards2.map(c => c.id).sort();

    return ids1.every((id, index) => id === ids2[index]);
  }

  /**
   * Get difference between two card sets
   * Returns { added, removed }
   */
  static getCardSetDiff(
    oldCards: Card[],
    newServerCards: CardData[]
  ): { added: CardData[]; removed: Card[] } {
    const oldIds = new Set(oldCards.map(c => (c as any).serverId || c.id));
    const newIds = new Set(newServerCards.map(c => c.id));

    const added = newServerCards.filter(c => !oldIds.has(c.id));
    const removed = oldCards.filter(c => !newIds.has((c as any).serverId || c.id));

    return { added, removed };
  }

  /**
   * Extract player info for display
   */
  static getPlayerInfo(player: PlayerState): {
    name: string;
    handSize: number;
    meldCount: number;
    hasOpened: boolean;
    score: number;
  } {
    return {
      name: player.name,
      handSize: player.handSize,
      meldCount: player.melds.length,
      hasOpened: player.hasOpened,
      score: player.score,
    };
  }

  /**
   * Get my player from game state
   */
  static getMyPlayer(gameState: GameStateUpdate, myPlayerId: string): PlayerState | undefined {
    return gameState.players.find(p => p.id === myPlayerId);
  }

  /**
   * Get opponent players
   */
  static getOpponents(gameState: GameStateUpdate, myPlayerId: string): PlayerState[] {
    return gameState.players.filter(p => p.id !== myPlayerId);
  }

  /**
   * Check if it's my turn
   */
  static isMyTurn(gameState: GameStateUpdate, myPlayerId: string): boolean {
    return gameState.currentPlayerId === myPlayerId;
  }

  /**
   * Get current phase display text
   */
  static getPhaseText(phase: string, isMyTurn: boolean): string {
    const phaseNames: Record<string, string> = {
      'DRAW': 'Draw Phase',
      'MELD': 'Meld Phase',
      'DISCARD': 'Discard Phase',
      'GAME_OVER': 'Game Over',
    };

    const prefix = isMyTurn ? 'YOUR TURN - ' : 'OPPONENT\'S TURN - ';
    return prefix + (phaseNames[phase] || phase);
  }

  /**
   * Format player name for display
   */
  static formatPlayerName(
    player: PlayerState,
    myPlayerId: string,
    maxLength: number = 15
  ): string {
    let name = player.name;

    if (player.id === myPlayerId) {
      name = 'You';
    } else if (name.length > maxLength) {
      name = name.substring(0, maxLength - 3) + '...';
    }

    return name;
  }

  /**
   * Calculate deadwood display
   */
  // static getDeadwoodDisplay(player: PlayerState): string {
  //   if (player.deadwood === 0) return '0';
  //   return `-${player.deadwood}`;
  // }

  /**
   * Get score display with sign
   */
  static getScoreDisplay(player: PlayerState): string {
    const score = player.score;
    if (score === 0) return '0';
    return score > 0 ? `+${score}` : `${score}`;
  }

  /**
   * Sort melds for display (sets first, then runs)
   */
  static sortMeldsForDisplay(melds: CardData[][]): CardData[][] {
    return [...melds].sort((a, b) => {
      // Check if meld is a set (same values)
      const aIsSet = a.length > 0 && new Set(a.map(c => c.value)).size === 1;
      const bIsSet = b.length > 0 && new Set(b.map(c => c.value)).size === 1;

      // Sets before runs
      if (aIsSet && !bIsSet) return -1;
      if (!aIsSet && bIsSet) return 1;

      // Within same type, sort by first card value
      const aValue = a[0]?.value || 0;
      const bValue = b[0]?.value || 0;
      return aValue - bValue;
    });
  }

  /**
   * Check if game state indicates game over
   */
  static isGameOver(gameState: GameStateUpdate): boolean {
    return gameState.phase === 'GAME_OVER';
  }

  /**
   * Get winner from game state
   */
  static getWinner(gameState: GameStateUpdate): PlayerState | undefined {
    // Winner is the player with empty hand or highest score
    return gameState.players.find(p => p.handSize === 0) ||
      gameState.players.reduce((prev, curr) =>
        curr.score > prev.score ? curr : prev
      );
  }

  /**
   * Create empty game state (for initialization)
   */
  static createEmptyState(playerId: string): Partial<GameStateUpdate> {
    return {
      currentPlayerId: '',
      currentPlayerName: '',
      phase: 'DRAW',
      players: [],
      drawPileSize: 0,
      discardPileTop: null,
      finishingCard: null,
      finishingCardDrawn: false,
      myHand: [],
      turnNumber: 0,
      gameStartTime: Date.now(),
    };
  }

  /**
   * Validate game state structure
   */
  static isValidGameState(state: any): state is GameStateUpdate {
    return (
      state &&
      typeof state.currentPlayerId === 'string' &&
      typeof state.phase === 'string' &&
      Array.isArray(state.players) &&
      typeof state.drawPileSize === 'number'
    );
  }
}

/**
 * Helper class for tracking state changes
 */
export class StateChangeTracker {
  private previousState: GameStateUpdate | null = null;

  /**
   * Detect what changed between states
   */
  detectChanges(newState: GameStateUpdate): {
    phaseChanged: boolean;
    turnChanged: boolean;
    handChanged: boolean;
    meldsChanged: boolean;
    discardChanged: boolean;
  } {
    if (!this.previousState) {
      this.previousState = newState;
      return {
        phaseChanged: true,
        turnChanged: true,
        handChanged: true,
        meldsChanged: true,
        discardChanged: true,
      };
    }

    const changes = {
      phaseChanged: newState.phase !== this.previousState.phase,
      turnChanged: newState.currentPlayerId !== this.previousState.currentPlayerId,
      handChanged: !this.areHandsEqual(newState.myHand, this.previousState.myHand),
      meldsChanged: this.haveMeldsChanged(newState, this.previousState),
      discardChanged: this.hasDiscardChanged(newState, this.previousState),
    };

    this.previousState = newState;
    return changes;
  }

  private areHandsEqual(hand1?: CardData[], hand2?: CardData[]): boolean {
    if (!hand1 || !hand2) return hand1 === hand2;
    if (hand1.length !== hand2.length) return false;

    const ids1 = hand1.map(c => c.id).sort();
    const ids2 = hand2.map(c => c.id).sort();

    return ids1.every((id, i) => id === ids2[i]);
  }

  // private haveMeldsChanged(state1: GameStateUpdate, state2: GameStateUpdate): boolean {
  //   // Check if any player's melds changed
  //   return state1.players.some((player, index) => {
  //     const prevPlayer = state2.players[index];
  //     if (!prevPlayer) return true;

  //     return player.melds.length !== prevPlayer.melds.length ||
  //            JSON.stringify(player.melds) !== JSON.stringify(prevPlayer.melds);
  //   });
  // }

  private haveMeldsChanged(state1: GameStateUpdate, state2: GameStateUpdate): boolean {
    return state1.players.some((player, index) => {
      const prevPlayer = state2.players[index];
      if (!prevPlayer) return true;

      if (player.melds.length !== prevPlayer.melds.length) return true;

      // Compare meld by meld, card by card
      return player.melds.some((meld, meldIndex) => {
        const prevMeld = prevPlayer.melds[meldIndex];
        if (!prevMeld || meld.length !== prevMeld.length) return true;

        return meld.some((card, cardIndex) => {
          const prevCard = prevMeld[cardIndex];
          return !prevCard || card.id !== prevCard.id;
        });
      });
    });
  }

  private hasDiscardChanged(state1: GameStateUpdate, state2: GameStateUpdate): boolean {
    const top1 = state1.discardPileTop;
    const top2 = state2.discardPileTop;

    if (!top1 || !top2) return top1 !== top2;
    return top1.id !== top2.id;
  }

  reset(): void {
    this.previousState = null;
  }
}