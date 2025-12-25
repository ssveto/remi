import { Remi } from "./remi";
import { Card } from "./card";

export enum AIDifficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
  EXPERT = "EXPERT",
}

export interface AIConfig {
  difficulty: AIDifficulty;
  thinkDelay: number;
  randomness: number;
}

interface MeldCandidate {
  cards: Card[];
  score: number;
  type: 'RUN' | 'SET';
  efficiency: number;
  priority: number;
  flexibility: number;
}

interface HandSolution {
  melds: Card[][];
  remainingCards: Card[];
  totalScore: number;
  deadwoodValue: number;
  canGoOut: boolean;
  turnsToWin: number;
}

interface OpponentModel {
  playerIndex: number;
  discardedCards: Card[];
  pickedFromDiscard: Card[];
  estimatedDeadwood: number;
  hasOpened: boolean;
  meldCount: number;
  handSize: number;
  likelyNeeds: Map<string, number>;
  likelyHas: Map<string, number>;
  dangerLevel: number;
  playStyle: 'aggressive' | 'defensive' | 'balanced';
}

// =============================================================================
// EXPERT AI PLAYER - FIXED VERSION
// =============================================================================

export class AIPlayer {
  private config: AIConfig;
  
  // Card tracking
  private seenCards: Map<string, Card> = new Map();
  private deckCardsRemaining: Map<string, number> = new Map();
  
  // Opponent modeling
  private opponentModels: Map<number, OpponentModel> = new Map();
  
  // Game state
  private turnNumber: number = 0;
  private gamePhase: 'early' | 'mid' | 'late' = 'early';
  
  // Reduced simulation count for performance
  private readonly SIMULATION_COUNT = 20;
  private readonly LOOKAHEAD_DEPTH = 2;

  // Cache for expensive computations
  private solutionCache: Map<string, HandSolution> = new Map();

  constructor(config: AIConfig) {
    this.config = config;
    this.resetTracking();
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  public shouldDrawFromDiscard(logic: Remi, playerIndex: number): boolean {
    try {
      const state = logic.getState();
      const topDiscard = state.topDiscardCard;

      if (!topDiscard || state.discardPileSize === 0) return false;

      const hand = logic.getPlayerHand(playerIndex);
      const hasOpened = logic.hasPlayerOpened(playerIndex);

      this.trackSeenCard(topDiscard);

      // Simulate adding the card
      const simulatedHand = [...hand, topDiscard];
      const solution = this.solveHandWithValidation(simulatedHand, logic, playerIndex);

      // Determine melds to lay
      const meldsToLay = this.determineMeldsToLay(
        solution, hasOpened, simulatedHand, logic, playerIndex
      );

      if (meldsToLay.length === 0) {
        return false;
      }

      // Check if discard card is used
      const discardCardIsInMelds = meldsToLay.some(meld =>
        meld.some(card => card.id === topDiscard.id)
      );

      const cardsInMelds = meldsToLay.flat();
      const cardsAfterMelds = simulatedHand.filter(c =>
        !cardsInMelds.some(mc => mc.id === c.id)
      );
      const discardCardIsTheFinalDiscard = solution.canGoOut && 
        cardsAfterMelds.length === 1 && 
        cardsAfterMelds[0].id === topDiscard.id;

      if (!discardCardIsInMelds && !discardCardIsTheFinalDiscard) {
        return false;
      }

      // Check 51-point requirement
      if (!hasOpened) {
        const totalScore = meldsToLay.reduce((sum, meld) =>
          sum + this.calcScore(meld), 0
        );
        if (totalScore < 51) {
          return false;
        }
      }

      // Strategic evaluation
      if (this.config.difficulty === AIDifficulty.EXPERT || 
          this.config.difficulty === AIDifficulty.HARD) {
        // Can win immediately?
        if (solution.canGoOut) return true;

        // Deny opponent critical card
        const opponentDanger = this.getHighestOpponentDanger();
        if (opponentDanger.dangerLevel > 70) {
          const wouldHelp = this.wouldHelpOpponent(topDiscard, opponentDanger.playerIndex);
          if (wouldHelp) return true;
        }

        // Score improvement check (simplified - no Monte Carlo blocking)
        const currentSolution = this.solveHandWithValidation(hand, logic, playerIndex);
        const improvement = solution.totalScore - currentSolution.totalScore;
        
        return improvement >= 3;
      }

      // Medium/Easy
      const currentSolution = this.solveHandWithValidation(hand, logic, playerIndex);
      return solution.totalScore - currentSolution.totalScore >= 5;

    } catch (error) {
      console.error('[AI] Error in shouldDrawFromDiscard:', error);
      return false;
    }
  }

  public shouldTakeFinishingCard(logic: Remi, playerIndex: number): boolean {
    try {
      const finishingCard = logic.getFinishingCard();
      if (!finishingCard) return false;
      if (logic.hasDrawnFinishingCard()) return false;
      if (logic.hasPlayerOpened(playerIndex)) return false;

      const hand = logic.getPlayerHand(playerIndex);
      if (hand.length !== 14) return false;

      const simulatedHand = [...hand, finishingCard];
      const solution = this.solveHandWithValidation(simulatedHand, logic, playerIndex);

      if (!solution.canGoOut) return false;
      if (solution.totalScore < 51) return false;

      const finishingCardIsInMeld = solution.melds.some(meld =>
        meld.some(c => c.id === finishingCard.id)
      );
      const finishingCardIsTheDiscard = solution.remainingCards.length === 1 &&
        solution.remainingCards[0].id === finishingCard.id;

      return finishingCardIsInMeld || finishingCardIsTheDiscard;

    } catch (error) {
      console.error('[AI] Error in shouldTakeFinishingCard:', error);
      return false;
    }
  }

  public planMeldAndDiscard(logic: Remi, playerIndex: number): {
    meldsToLay: Card[][];
    cardToDiscard: Card;
    cardsToAddToMelds?: Array<{ card: Card; meldOwner: number; meldIndex: number }>;
  } {
    try {
      const hand = logic.getPlayerHand(playerIndex);
      const hasOpened = logic.hasPlayerOpened(playerIndex);
      const state = logic.getState();

      // Ensure we have cards
      if (hand.length === 0) {
        throw new Error('No cards in hand');
      }

      this.updateGamePhase(state, logic);
      this.turnNumber++;

      // Clear cache periodically
      if (this.turnNumber % 5 === 0) {
        this.solutionCache.clear();
      }

      const solution = this.solveHandWithValidation(hand, logic, playerIndex);

      // DEBUG LOGGING
      console.log(`[AI ${playerIndex}] Turn ${this.turnNumber}: hand=${hand.length} cards, hasOpened=${hasOpened}, solution.totalScore=${solution.totalScore}, solution.melds=${solution.melds.length}, canGoOut=${solution.canGoOut}`);

      let meldsToLay: Card[][] = [];
      const cardsToAddToMelds: Array<{ card: Card; meldOwner: number; meldIndex: number }> = [];

      // Determine melds to lay
      meldsToLay = this.determineMeldsToLay(solution, hasOpened, hand, logic, playerIndex);
      
      console.log(`[AI ${playerIndex}] Decision: laying ${meldsToLay.length} melds (total score: ${meldsToLay.reduce((sum, m) => sum + this.calcScore(m), 0)})`);

      // Order cards properly
      meldsToLay = meldsToLay.map(meld => this.orderCardsInMeldAdvanced(meld));

      // Ensure at least 1 card remains for discard
      const cardsInMelds = meldsToLay.flat();
      const cardsRemainingAfterMelds = hand.filter(c =>
        !cardsInMelds.some(mc => mc.id === c.id)
      );

      if (cardsRemainingAfterMelds.length === 0 && meldsToLay.length > 0) {
        const meldScores = meldsToLay.map((meld, index) => ({
          meld, index, score: this.calcScore(meld)
        }));
        meldScores.sort((a, b) => a.score - b.score);
        meldsToLay = meldsToLay.filter((_, idx) => idx !== meldScores[0].index);
      }

      // Find meld additions (only if opened)
      if (hasOpened && (this.config.difficulty === AIDifficulty.EXPERT || 
                        this.config.difficulty === AIDifficulty.HARD)) {
        const additions = this.findOptimalMeldAdditions(
          hand, meldsToLay, logic, state, playerIndex
        );
        cardsToAddToMelds.push(...additions);
      }

      // Select discard
      const usedCardIds = new Set([
        ...meldsToLay.flat().map(c => c.id),
        ...cardsToAddToMelds.map(a => a.card.id)
      ]);
      const cardsAvailableToDiscard = hand.filter(c => !usedCardIds.has(c.id));

      let cardToDiscard: Card;
      if (cardsAvailableToDiscard.length === 0) {
        if (meldsToLay.length > 0) {
          cardToDiscard = this.selectCardFromMelds(meldsToLay, hand);
        } else {
          // Fallback - pick any non-joker card
          const nonJoker = hand.find(c => !this.isJoker(c));
          cardToDiscard = nonJoker || hand[0]; // Only use joker as absolute last resort
        }
      } else {
        cardToDiscard = this.selectBestDiscardAdvanced(
          cardsAvailableToDiscard, state, playerIndex, logic, hand
        );
      }

      this.trackSeenCard(cardToDiscard);
      
      console.log(`[AI ${playerIndex}] Discarding: ${cardToDiscard.suit} ${cardToDiscard.value}`);

      return { meldsToLay, cardToDiscard, cardsToAddToMelds };

    } catch (error) {
      console.error('[AI] Error in planMeldAndDiscard:', error);
      
      // Emergency fallback - discard first non-joker card
      const hand = logic.getPlayerHand(playerIndex);
      const nonJoker = hand.find(c => !this.isJoker(c));
      return {
        meldsToLay: [],
        cardToDiscard: nonJoker || hand[0], // Only joker as absolute last resort
        cardsToAddToMelds: []
      };
    }
  }

  // ===========================================================================
  // OPPONENT MODELING
  // ===========================================================================

  public updateOpponentModel(
    playerIndex: number,
    action: 'discard' | 'pick_discard' | 'draw_deck' | 'lay_melds' | 'open',
    card?: Card,
    melds?: Card[][]
  ): void {
    try {
      let model = this.opponentModels.get(playerIndex);
      
      // Auto-create model if needed
      if (!model) {
        model = {
          playerIndex,
          discardedCards: [],
          pickedFromDiscard: [],
          estimatedDeadwood: 140,
          hasOpened: false,
          meldCount: 0,
          handSize: 14,
          likelyNeeds: new Map(),
          likelyHas: new Map(),
          dangerLevel: 0,
          playStyle: 'balanced'
        };
        this.opponentModels.set(playerIndex, model);
      }

      switch (action) {
        case 'discard':
          if (card) {
            model.discardedCards.push(card);
            this.trackSeenCard(card);
            this.reduceNeedProbability(model, card);
            model.handSize = Math.max(0, model.handSize - 1);
            this.updateDangerLevel(model);
          }
          break;

        case 'pick_discard':
          if (card) {
            model.pickedFromDiscard.push(card);
            this.inferLikelyNeeds(model, card);
            model.handSize++;
            model.likelyHas.set(this.getCardKey(card), 100);
            model.dangerLevel = Math.min(100, model.dangerLevel + 15);
          }
          break;

        case 'draw_deck':
          model.handSize++;
          break;

        case 'lay_melds':
          if (melds) {
            model.meldCount += melds.length;
            const cardsLaid = melds.flat().length;
            model.handSize = Math.max(0, model.handSize - cardsLaid);
            melds.flat().forEach(c => this.trackSeenCard(c));
            this.updateDangerLevel(model);
          }
          break;

        case 'open':
          model.hasOpened = true;
          model.dangerLevel = Math.min(100, model.dangerLevel + 20);
          break;
      }

      this.detectPlayStyle(model);

    } catch (error) {
      console.error('[AI] Error updating opponent model:', error);
    }
  }

  private inferLikelyNeeds(model: OpponentModel, pickedCard: Card): void {
    if (this.isJoker(pickedCard)) return;

    const suits = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
    for (const suit of suits) {
      if (suit !== pickedCard.suit) {
        const key = `${pickedCard.value}-${suit}`;
        const current = model.likelyNeeds.get(key) || 0;
        model.likelyNeeds.set(key, Math.min(100, current + 40));
      }
    }

    for (let delta = -2; delta <= 2; delta++) {
      if (delta === 0) continue;
      const adjValue = pickedCard.value + delta;
      if (adjValue >= 1 && adjValue <= 13) {
        const key = `${adjValue}-${pickedCard.suit}`;
        const current = model.likelyNeeds.get(key) || 0;
        const boost = Math.abs(delta) === 1 ? 50 : 25;
        model.likelyNeeds.set(key, Math.min(100, current + boost));
      }
    }
  }

  private reduceNeedProbability(model: OpponentModel, discardedCard: Card): void {
    const suits = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
    for (const suit of suits) {
      const key = `${discardedCard.value}-${suit}`;
      const current = model.likelyNeeds.get(key) || 0;
      model.likelyNeeds.set(key, Math.max(0, current - 30));
    }

    for (let delta = -1; delta <= 1; delta++) {
      if (delta === 0) continue;
      const adjValue = discardedCard.value + delta;
      if (adjValue >= 1 && adjValue <= 13) {
        const key = `${adjValue}-${discardedCard.suit}`;
        const current = model.likelyNeeds.get(key) || 0;
        model.likelyNeeds.set(key, Math.max(0, current - 15));
      }
    }
  }

  private updateDangerLevel(model: OpponentModel): void {
    let danger = Math.max(0, (14 - model.handSize)) * 6;
    if (model.hasOpened) danger += 20;
    danger += model.meldCount * 10;
    danger += model.pickedFromDiscard.length * 8;
    model.dangerLevel = Math.min(100, danger);
  }

  private detectPlayStyle(model: OpponentModel): void {
    const discardCount = model.discardedCards.length;
    const pickCount = model.pickedFromDiscard.length;

    if (discardCount > 0) {
      const pickRatio = pickCount / discardCount;
      if (pickRatio > 0.5) {
        model.playStyle = 'aggressive';
      } else if (model.discardedCards.some(c => this.getCardPoints(c) >= 10)) {
        model.playStyle = 'defensive';
      } else {
        model.playStyle = 'balanced';
      }
    }
  }

  private wouldHelpOpponent(card: Card, opponentIndex: number): boolean {
    const model = this.opponentModels.get(opponentIndex);
    if (!model) return false;

    const key = this.getCardKey(card);
    const needProbability = model.likelyNeeds.get(key) || 0;
    return needProbability > 50;
  }

  private getHighestOpponentDanger(): { playerIndex: number; dangerLevel: number } {
    let highest = { playerIndex: -1, dangerLevel: 0 };

    this.opponentModels.forEach((model, index) => {
      if (model.dangerLevel > highest.dangerLevel) {
        highest = { playerIndex: index, dangerLevel: model.dangerLevel };
      }
    });

    return highest;
  }

  // ===========================================================================
  // DISCARD SELECTION
  // ===========================================================================

  public selectBestDiscardAdvanced(
    cards: Card[],
    state: any,
    playerIndex: number,
    logic: Remi,
    fullHand: Card[]
  ): Card {
    try {
      if (cards.length === 0) {
        throw new Error('No cards available to discard');
      }

      // NEVER discard a joker if there's any alternative
      const nonJokers = cards.filter(c => !this.isJoker(c));
      if (nonJokers.length > 0) {
        // Use non-jokers only for discard selection
        cards = nonJokers;
      } else {
        // Only jokers left - this is a critical situation, but we have to discard something
        console.warn('[AI] Only jokers available to discard!');
        return cards[0];
      }

      if (cards.length === 1) {
        return cards[0];
      }

      const scores = cards.map(card => {
        let score = 0;
        const cardValue = this.getCardPoints(card);
        
        // Penalty for high value (prefer discarding low-value cards)
        // LOWER score = more likely to discard
        score -= cardValue * 2;

        // Synergy bonus (keep useful cards - ADD to score to protect them)
        const synergy = this.evaluateCardSynergyAdvanced(card, cards);
        score += synergy * 2;

        // Future potential (ADD to score to protect cards with potential)
        const potential = this.evaluateFuturePotential(card, fullHand);
        score += potential * 2;

        // Expert/Hard: Opponent denial
        if (this.config.difficulty === AIDifficulty.EXPERT ||
            this.config.difficulty === AIDifficulty.HARD) {
          // If opponents want this card, we should KEEP it (don't give them what they need)
          // Higher score = less likely to discard
          const opponentDangerScore = this.calculateOpponentDangerScore(card);
          score += opponentDangerScore * 4; // Cards opponents want = KEEP them (higher score)

          // If it's safe to discard (similar cards already seen), lower the score
          const safetyScore = this.calculateDiscardSafety(card);
          score -= safetyScore * 2; // Safe to discard = LOWER score = more likely to discard

          // Dead cards (can't form any meld) should be discarded
          if (this.isDeadCard(card, fullHand)) {
            score -= 50; // Dead cards should be discarded = LOWER score
          }
        }

        // Isolation penalty - isolated cards should be discarded
        const isolation = this.calculateIsolationScore(card, fullHand);
        score -= isolation; // More isolated = lower score = discard

        // Game phase adjustments
        if (this.gamePhase === 'late') {
          score -= cardValue * 2; // In late game, discard high value cards
        }

        return { card, score };
      });

      // Sort by score: LOWEST score = best to discard
      scores.sort((a, b) => a.score - b.score);

      // Slight randomization for unpredictability
      if (this.config.randomness > 0 && scores.length > 1) {
        if (Math.random() < this.config.randomness) {
          return scores[Math.min(1, scores.length - 1)].card;
        }
      }

      return scores[0].card;

    } catch (error) {
      console.error('[AI] Error in selectBestDiscardAdvanced:', error);
      // Fallback: return first non-joker
      const nonJoker = cards.find(c => !this.isJoker(c));
      if (nonJoker) return nonJoker;
      // Absolute last resort
      return cards[0];
    }
  }

  private calculateOpponentDangerScore(card: Card): number {
    let totalDanger = 0;

    this.opponentModels.forEach(model => {
      const key = this.getCardKey(card);
      const needProb = model.likelyNeeds.get(key) || 0;
      const weightedNeed = needProb * (model.dangerLevel / 100);
      totalDanger += weightedNeed;

      for (let delta = -1; delta <= 1; delta++) {
        if (delta === 0) continue;
        const adjValue = card.value + delta;
        if (adjValue >= 1 && adjValue <= 13) {
          const adjKey = `${adjValue}-${card.suit}`;
          const adjNeed = model.likelyNeeds.get(adjKey) || 0;
          totalDanger += adjNeed * 0.3 * (model.dangerLevel / 100);
        }
      }
    });

    return totalDanger;
  }

  private calculateDiscardSafety(card: Card): number {
    const sameValueSeen = Array.from(this.seenCards.values())
      .filter(c => c.value === card.value).length;

    const adjSeen = Array.from(this.seenCards.values())
      .filter(c => c.suit === card.suit && Math.abs(c.value - card.value) <= 2).length;

    return sameValueSeen * 10 + adjSeen * 5;
  }

  private isDeadCard(card: Card, hand: Card[]): boolean {
    const sameValue = hand.filter(c => c.value === card.value && c.id !== card.id);
    const jokers = hand.filter(c => this.isJoker(c));
    const setPotential = sameValue.length + jokers.length >= 2;

    const sameSuit = hand.filter(c => c.suit === card.suit && c.id !== card.id);
    let runPotential = false;
    for (const other of sameSuit) {
      if (Math.abs(other.value - card.value) <= 3) {
        runPotential = true;
        break;
      }
    }

    return !setPotential && !runPotential;
  }

  // ===========================================================================
  // MELD ADDITION
  // ===========================================================================

  private findOptimalMeldAdditions(
    hand: Card[],
    meldsToLay: Card[][],
    logic: Remi,
    state: any,
    playerIndex: number
  ): Array<{ card: Card; meldOwner: number; meldIndex: number }> {
    try {
      const usedInMelds = new Set(meldsToLay.flat().map(c => c.id));
      const availableForAdding = hand.filter(c => !usedInMelds.has(c.id));
      
      const maxCardsToAdd = Math.max(0, availableForAdding.length - 1);
      if (maxCardsToAdd === 0) return [];

      const allTableMelds = this.getAllTableMelds(logic, state);
      const possibleAdditions: Array<{
        card: Card;
        meldOwner: number;
        meldIndex: number;
        value: number;
      }> = [];

      for (const card of availableForAdding) {
        for (const meld of allTableMelds) {
          if (this.canAddCardToMeld(card, meld.cards)) {
            const value = this.evaluateMeldAdditionValue(card, meld, playerIndex);
            if (value > 0) {
              possibleAdditions.push({
                card,
                meldOwner: meld.owner,
                meldIndex: meld.index,
                value
              });
            }
          }
        }
      }

      possibleAdditions.sort((a, b) => b.value - a.value);

      const result: Array<{ card: Card; meldOwner: number; meldIndex: number }> = [];
      const usedCards = new Set<string>();

      for (const addition of possibleAdditions) {
        if (result.length >= maxCardsToAdd) break;
        if (usedCards.has(addition.card.id)) continue;

        result.push({
          card: addition.card,
          meldOwner: addition.meldOwner,
          meldIndex: addition.meldIndex
        });
        usedCards.add(addition.card.id);
      }

      return result;

    } catch (error) {
      console.error('[AI] Error finding meld additions:', error);
      return [];
    }
  }

  private evaluateMeldAdditionValue(
    card: Card,
    meld: { cards: Card[]; owner: number; index: number },
    playerIndex: number
  ): number {
    let value = this.getCardPoints(card) * 5;

    const hasJoker = meld.cards.some(c => this.isJoker(c));
    if (hasJoker && this.wouldReplaceJokerInMeld(card, meld.cards)) {
      value += 200;
    }

    if (meld.owner === playerIndex) {
      value += 20;
    }

    if (this.gamePhase === 'late') {
      value += 30;
    }

    return value;
  }

  private wouldReplaceJokerInMeld(card: Card, meld: Card[]): boolean {
    if (this.isJoker(card)) return false;
    
    const jokerIndex = meld.findIndex(c => this.isJoker(c));
    if (jokerIndex === -1) return false;

    const meldCopy = [...meld];
    meldCopy[jokerIndex] = card;

    return this.isValidSet(meldCopy) || this.isValidRun(meldCopy);
  }

  private canAddCardToMeld(card: Card, meld: Card[]): boolean {
    const testMeld = [...meld, card];
    return this.isValidSet(testMeld) || this.isValidRun(testMeld);
  }

  // ===========================================================================
  // MELD DETERMINATION
  // ===========================================================================

  private determineMeldsToLay(
    solution: HandSolution,
    hasOpened: boolean,
    hand: Card[],
    logic: Remi,
    playerIndex: number
  ): Card[][] {
    let meldsToLay: Card[][] = [];
    const totalScore = solution.totalScore;

    // No melds found
    if (solution.melds.length === 0) {
      return [];
    }

    if (this.config.difficulty === AIDifficulty.HARD || 
        this.config.difficulty === AIDifficulty.EXPERT) {
      if (hasOpened) {
        // Already opened - be more strategic about laying additional melds
        if (solution.canGoOut && solution.remainingCards.length === 1) {
          // Can win! Lay everything
          meldsToLay = solution.melds;
        } else if (solution.remainingCards.length <= 3 && solution.deadwoodValue <= 15) {
          // Close to winning - lay melds
          meldsToLay = solution.melds;
        } else if (totalScore >= 20) {
          // Decent melds - lay them to reduce hand size
          meldsToLay = solution.melds;
        } else if (solution.melds.length > 0) {
          // Lay at least some melds to reduce hand size
          meldsToLay = solution.melds;
        }
      } else {
        // Not opened yet - need 51+ points to open
        if (totalScore >= 51) {
          const remainingAfterMelds = hand.filter(c =>
            !solution.melds.flat().some(mc => mc.id === c.id)
          );
          const remainingDeadwood = this.calculateDeadwood(remainingAfterMelds);

          // STRATEGIC DECISION: Should we open now?
          // 
          // In Rummy, opening is almost ALWAYS good because:
          // 1. You can start adding cards to your melds
          // 2. You reduce your hand size (less penalty if someone else wins)
          // 3. You put pressure on opponents
          //
          // The ONLY reason to hold back is if you're about to win anyway
          // and don't want to reveal your hand.

          // Can win immediately? Always lay!
          if (solution.canGoOut && remainingAfterMelds.length === 1) {
            meldsToLay = solution.melds;
          }
          // Very close to winning (2-3 cards, low deadwood) - MAYBE hold back
          else if (remainingDeadwood <= 15 && remainingAfterMelds.length <= 3) {
            // Only hold back 30% of the time for unpredictability
            if (Math.random() < 0.3) {
              console.log(`[AI ${playerIndex}] Holding back - close to winning`);
              meldsToLay = [];
            } else {
              meldsToLay = solution.melds;
            }
          }
          // DEFAULT: If we have 51+ points, OPEN!
          else {
            meldsToLay = solution.melds;
          }
        }
      }
    } else {
      // MEDIUM/EASY difficulty - simple logic: if you can open, open!
      if (hasOpened) {
        meldsToLay = solution.melds;
      } else if (totalScore >= 51) {
        meldsToLay = solution.melds;
      }
    }

    return meldsToLay;
  }

  // ===========================================================================
  // CARD TRACKING
  // ===========================================================================

  private resetTracking(): void {
    this.seenCards.clear();
    this.opponentModels.clear();
    this.solutionCache.clear();
    this.turnNumber = 0;
    this.gamePhase = 'early';
    
    this.deckCardsRemaining.clear();
    const suits = ['HEART', 'DIAMOND', 'CLUB', 'SPADE'];
    for (const suit of suits) {
      for (let value = 1; value <= 13; value++) {
        this.deckCardsRemaining.set(`${value}-${suit}`, 2);
      }
    }
    this.deckCardsRemaining.set('JOKER', 4);
  }

  private trackSeenCard(card: Card): void {
    const key = this.getCardKey(card);
    this.seenCards.set(key, card);

    const remaining = this.deckCardsRemaining.get(key) || 0;
    this.deckCardsRemaining.set(key, Math.max(0, remaining - 1));
  }

  private getCardKey(card: Card): string {
    if (this.isJoker(card)) return 'JOKER';
    return `${card.value}-${card.suit}`;
  }

  private updateGamePhase(state: any, logic: Remi): void {
    const avgHandSize = state.handSizes.reduce((a: number, b: number) => a + b, 0) / state.numPlayers;
    
    if (avgHandSize > 10) {
      this.gamePhase = 'early';
    } else if (avgHandSize > 5) {
      this.gamePhase = 'mid';
    } else {
      this.gamePhase = 'late';
    }
  }

  // ===========================================================================
  // HAND SOLVING (OPTIMIZED)
  // ===========================================================================

  private solveHandWithValidation(hand: Card[], logic: Remi, playerIndex: number): HandSolution {
    // Use cache for repeated calculations
    const cacheKey = hand.map(c => c.id).sort().join(',');
    const cached = this.solutionCache.get(cacheKey);
    if (cached) return cached;

    const candidates = this.findAllValidCandidates(hand, logic, playerIndex);
    
    candidates.sort((a, b) => {
      if (Math.abs(b.efficiency - a.efficiency) > 0.5) {
        return b.efficiency - a.efficiency;
      }
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.score - a.score;
    });

    const solution = this.findBestCombination(candidates, hand, [], 0, 0);
    const deadwoodValue = this.calculateDeadwood(solution.remainingCards);
    const canGoOut = solution.remainingCards.length === 1;

    const result: HandSolution = {
      ...solution,
      deadwoodValue,
      canGoOut,
      turnsToWin: canGoOut ? 0 : Math.ceil(solution.remainingCards.length / 2)
    };

    // Cache result
    this.solutionCache.set(cacheKey, result);

    return result;
  }

  private findAllValidCandidates(hand: Card[], logic: Remi, playerIndex: number): MeldCandidate[] {
    const candidates: MeldCandidate[] = [];

    // Limit combination sizes for performance
    const maxSize = Math.min(hand.length, 8);

    for (let size = 3; size <= maxSize; size++) {
      const combinations = this.getCombinations(hand, size);

      for (const combo of combinations) {
        const validation = logic.validateMelds(playerIndex, combo);

        if (validation.validMelds.length > 0) {
          for (let i = 0; i < validation.validMelds.length; i++) {
            const meld = validation.validMelds[i];
            const score = validation.meldScores[i];
            const type = this.isValidSet(meld) ? 'SET' : 'RUN';

            candidates.push({
              cards: meld,
              score,
              type,
              efficiency: score / meld.length,
              priority: this.calculateMeldPriority(meld, hand, type),
              flexibility: this.calculateMeldFlexibility(meld, hand)
            });
          }
        }
      }
    }

    return this.deduplicateCandidates(candidates);
  }

  private calculateMeldPriority(meld: Card[], hand: Card[], type: string): number {
    let priority = meld.length * 2;
    const jokerCount = meld.filter(c => this.isJoker(c)).length;
    priority += jokerCount * 5;
    if (type === 'RUN') priority += 3;
    const highValueCards = meld.filter(c => this.getCardPoints(c) >= 10);
    priority += highValueCards.length * 2;
    return priority;
  }

  private calculateMeldFlexibility(meld: Card[], hand: Card[]): number {
    let flexibility = 0;

    if (this.isValidRun(meld)) {
      const suit = meld.find(c => !this.isJoker(c))?.suit;
      const values = meld.filter(c => !this.isJoker(c)).map(c => c.value);
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (hand.some(c => c.suit === suit && c.value === min - 1)) flexibility += 10;
        if (hand.some(c => c.suit === suit && c.value === max + 1)) flexibility += 10;
      }
    }

    if (this.isValidSet(meld) && meld.length < 4) {
      const value = meld.find(c => !this.isJoker(c))?.value;
      const usedSuits = new Set(meld.filter(c => !this.isJoker(c)).map(c => c.suit));
      if (hand.some(c => c.value === value && !usedSuits.has(c.suit) && !meld.includes(c))) {
        flexibility += 15;
      }
    }

    return flexibility;
  }

  private deduplicateCandidates(candidates: MeldCandidate[]): MeldCandidate[] {
    const seen = new Set<string>();
    const unique: MeldCandidate[] = [];

    for (const candidate of candidates) {
      const key = candidate.cards.map(c => c.id).sort().join(',');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(candidate);
      }
    }

    return unique;
  }

  private findBestCombination(
    candidates: MeldCandidate[],
    availableCards: Card[],
    chosenMelds: Card[][],
    currentScore: number,
    depth: number
  ): HandSolution {
    // Limit depth for performance
    if (depth > 15) {
      return {
        melds: chosenMelds,
        remainingCards: availableCards,
        totalScore: currentScore,
        deadwoodValue: this.calculateDeadwood(availableCards),
        canGoOut: availableCards.length === 1,
        turnsToWin: 99
      };
    }

    let bestSolution: HandSolution = {
      melds: chosenMelds,
      remainingCards: availableCards,
      totalScore: currentScore,
      deadwoodValue: this.calculateDeadwood(availableCards),
      canGoOut: availableCards.length === 1,
      turnsToWin: 99
    };

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      if (this.canMakeMeld(candidate.cards, availableCards)) {
        const remainingAfterMeld = this.removeCards(availableCards, candidate.cards);
        const newMelds = [...chosenMelds, candidate.cards];
        const newScore = currentScore + candidate.score;

        const subResult = this.findBestCombination(
          candidates.slice(i + 1),
          remainingAfterMeld,
          newMelds,
          newScore,
          depth + 1
        );

        if (this.isBetterSolution(subResult, bestSolution)) {
          bestSolution = subResult;
        }
      }
    }

    return bestSolution;
  }

  private isBetterSolution(candidate: HandSolution, current: HandSolution): boolean {
    if (candidate.canGoOut && !current.canGoOut) return true;
    if (!candidate.canGoOut && current.canGoOut) return false;
    if (candidate.totalScore > current.totalScore + 5) return true;
    if (current.totalScore > candidate.totalScore + 5) return false;
    if (Math.abs(candidate.totalScore - current.totalScore) <= 5) {
      return candidate.deadwoodValue < current.deadwoodValue;
    }
    return candidate.totalScore > current.totalScore;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  private getAllTableMelds(logic: Remi, state: any): Array<{ cards: Card[]; owner: number; index: number }> {
    const allMelds: Array<{ cards: Card[]; owner: number; index: number }> = [];

    for (let owner = 0; owner < state.numPlayers; owner++) {
      const playerMelds = logic.getPlayerMelds(owner);
      playerMelds.forEach((meld, index) => {
        allMelds.push({ cards: meld, owner, index });
      });
    }

    return allMelds;
  }

  private orderCardsInMeldAdvanced(meld: Card[]): Card[] {
    if (!this.isValidRun(meld)) {
      return [...meld].sort((a, b) => {
        if (this.isJoker(a)) return 1;
        if (this.isJoker(b)) return -1;
        return a.suit.localeCompare(b.suit);
      });
    }

    const jokers = meld.filter(c => this.isJoker(c));
    const regulars = meld.filter(c => !this.isJoker(c));

    if (regulars.length === 0) return meld;

    const hasHighCards = regulars.some(r => r.value >= 11);

    regulars.sort((a, b) => {
      const aVal = a.value === 1 && hasHighCards ? 14 : a.value;
      const bVal = b.value === 1 && hasHighCards ? 14 : b.value;
      return aVal - bVal;
    });

    const result: Card[] = [];
    let jokerIdx = 0;

    for (let i = 0; i < regulars.length; i++) {
      const current = regulars[i];
      const next = regulars[i + 1];

      result.push(current);

      if (next) {
        const currentVal = current.value === 1 && hasHighCards ? 14 : current.value;
        const nextVal = next.value === 1 && hasHighCards ? 14 : next.value;
        const gap = nextVal - currentVal - 1;

        const jokersToInsert = Math.min(gap, jokers.length - jokerIdx);
        for (let j = 0; j < jokersToInsert; j++) {
          result.push(jokers[jokerIdx++]);
        }
      }
    }

    while (jokerIdx < jokers.length) {
      result.push(jokers[jokerIdx++]);
    }

    return result;
  }

  private evaluateCardSynergyAdvanced(card: Card, hand: Card[]): number {
    if (this.isJoker(card)) return 100;

    let synergy = 0;
    const regulars = hand.filter(c => !this.isJoker(c) && c.id !== card.id);

    const sameValue = regulars.filter(c => c.value === card.value);
    synergy += sameValue.length * 12;
    if (sameValue.length >= 2) synergy += 20;

    const sameSuit = regulars.filter(c => c.suit === card.suit);
    for (const other of sameSuit) {
      const distance = Math.abs(other.value - card.value);
      if (distance === 1) synergy += 15;
      else if (distance === 2) synergy += 8;
      else if (distance === 3) synergy += 3;
    }

    const jokerCount = hand.filter(c => this.isJoker(c)).length;
    if (jokerCount > 0 && sameValue.length > 0) synergy += jokerCount * 10;

    return synergy;
  }

  private evaluateFuturePotential(card: Card, fullHand: Card[]): number {
    let potential = 0;

    const sameValue = fullHand.filter(c => c.value === card.value && c.id !== card.id);
    potential += sameValue.length * 5;
    if (sameValue.length === 2) potential += 15;

    const sameSuit = fullHand.filter(c => c.suit === card.suit && c.id !== card.id);
    for (const other of sameSuit) {
      if (Math.abs(other.value - card.value) <= 2) {
        potential += 5;
      }
    }

    return potential;
  }

  private calculateIsolationScore(card: Card, hand: Card[]): number {
    if (this.isJoker(card)) return 0;

    let connections = 0;
    connections += hand.filter(c => c.value === card.value && c.id !== card.id).length * 5;

    const sameSuit = hand.filter(c => c.suit === card.suit && c.id !== card.id);
    for (const other of sameSuit) {
      const distance = Math.abs(other.value - card.value);
      if (distance <= 3) connections += (4 - distance) * 3;
    }

    return Math.max(0, 20 - connections);
  }

  private selectCardFromMelds(melds: Card[][], hand: Card[]): Card {
    const allMeldCards = melds.flat();
    
    // Filter out jokers - never discard them
    const nonJokers = allMeldCards.filter(c => !this.isJoker(c));
    const cardsToConsider = nonJokers.length > 0 ? nonJokers : allMeldCards;
    
    const scores = cardsToConsider.map(card => ({
      card,
      score: this.isJoker(card) ? 9999 : this.getCardPoints(card) // Jokers last resort
    }));
    scores.sort((a, b) => a.score - b.score);
    return scores[0].card;
  }

  private isJoker(card: Card): boolean {
    return card.suit === "JOKER_RED" || card.suit === "JOKER_BLACK";
  }

  private getCardPoints(card: Card): number {
    if (this.isJoker(card)) return 0;
    if (card.value === 1) return 10;
    if (card.value >= 2 && card.value <= 10) return card.value;
    if (card.value >= 11 && card.value <= 13) return 10;
    if (card.value === 14) return 10;
    return 0;
  }

  private calcScore(meld: Card[]): number {
    return meld.reduce((sum, c) => sum + this.getCardPoints(c), 0);
  }

  private calculateDeadwood(cards: Card[]): number {
    return cards.reduce((sum, card) => sum + this.getCardPoints(card), 0);
  }

  private canMakeMeld(meldCards: Card[], availableCards: Card[]): boolean {
    const tempHand = [...availableCards];
    for (const card of meldCards) {
      const index = tempHand.findIndex(c => c.id === card.id);
      if (index === -1) return false;
      tempHand.splice(index, 1);
    }
    return true;
  }

  private removeCards(source: Card[], toRemove: Card[]): Card[] {
    const res = [...source];
    for (const card of toRemove) {
      const idx = res.findIndex(c => c.id === card.id);
      if (idx !== -1) res.splice(idx, 1);
    }
    return res;
  }

  private getCombinations<T>(arr: T[], size: number): T[][] {
    if (size > arr.length) return [];
    if (size === 1) return arr.map(i => [i]);

    const result: T[][] = [];
    for (let i = 0; i < arr.length - size + 1; i++) {
      const head = arr[i];
      const tailCombinations = this.getCombinations(arr.slice(i + 1), size - 1);
      tailCombinations.forEach(tail => result.push([head, ...tail]));
    }
    return result;
  }

  // ===========================================================================
  // MELD VALIDATION
  // ===========================================================================

  private isValidSet(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    const regulars = cards.filter(c => !this.isJoker(c));
    const jokers = cards.filter(c => this.isJoker(c));

    if (regulars.length === 0) return false;

    const targetValue = regulars[0].value;
    if (!regulars.every(c => c.value === targetValue)) return false;

    const suits = new Set(regulars.map(c => c.suit));
    if (suits.size !== regulars.length) return false;

    if (regulars.length + jokers.length > 4) return false;

    return true;
  }

  private isValidRun(cards: Card[]): boolean {
    if (cards.length < 3) return false;

    const regularCards = cards.filter(c => !this.isJoker(c));

    if (regularCards.length === 0) return false;

    const targetSuit = regularCards[0].suit;
    if (!regularCards.every(c => c.suit === targetSuit)) return false;

    const sortedCards = this.sortRunCardsForValidation(cards);
    return this.validatePositionalRun(sortedCards);
  }

  private sortRunCardsForValidation(cards: Card[]): Card[] {
    const jokers = cards.filter(c => this.isJoker(c));
    const regulars = cards.filter(c => !this.isJoker(c));

    const hasHighCards = regulars.some(r => r.value >= 11);
    regulars.sort((a, b) => {
      const aVal = a.value === 1 && hasHighCards ? 14 : a.value;
      const bVal = b.value === 1 && hasHighCards ? 14 : b.value;
      return aVal - bVal;
    });

    const result: Card[] = [];
    let jokerIdx = 0;

    for (let i = 0; i < regulars.length; i++) {
      const current = regulars[i];
      const next = regulars[i + 1];

      result.push(current);

      if (next) {
        const currentVal = current.value === 1 && hasHighCards ? 14 : current.value;
        const nextVal = next.value === 1 && hasHighCards ? 14 : next.value;
        const gap = nextVal - currentVal - 1;

        const jokersToInsert = Math.min(gap, jokers.length - jokerIdx);
        for (let j = 0; j < jokersToInsert; j++) {
          result.push(jokers[jokerIdx++]);
        }
      }
    }

    while (jokerIdx < jokers.length) {
      result.push(jokers[jokerIdx++]);
    }

    return result;
  }

  private validatePositionalRun(cards: Card[]): boolean {
    const indexedRegulars = cards
      .map((card, index) => ({ card, index, isJoker: this.isJoker(card) }))
      .filter(item => !item.isJoker);

    if (indexedRegulars.length < 2) return true;

    let isAscending: boolean | null = null;

    for (let i = 0; i < indexedRegulars.length - 1; i++) {
      const current = indexedRegulars[i];
      const next = indexedRegulars[i + 1];

      const jokersBetween = next.index - current.index - 1;
      const requiredGap = jokersBetween + 1;

      const v1 = current.card.value;
      const v2 = next.card.value;

      let diff = v2 - v1;
      let validStep = false;
      let stepDirectionIsAscending = true;

      if (Math.abs(diff) === requiredGap) {
        validStep = true;
        stepDirectionIsAscending = diff > 0;
      }

      if (!validStep && (v1 === 1 || v2 === 1)) {
        const v1High = v1 === 1 ? 14 : v1;
        const v2High = v2 === 1 ? 14 : v2;
        const diffHigh = v2High - v1High;

        if (Math.abs(diffHigh) === requiredGap) {
          validStep = true;
          stepDirectionIsAscending = diffHigh > 0;
        }
      }

      if (!validStep) return false;

      if (isAscending === null) {
        isAscending = stepDirectionIsAscending;
      } else if (isAscending !== stepDirectionIsAscending) {
        return false;
      }
    }

    return true;
  }
}