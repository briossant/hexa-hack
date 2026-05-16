import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { generateAIMessage, generateAIVote } from '../ai/aiPlayer';
import type { InternalPlayer, SocketData } from '../types';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  GamePhase,
  PublicPlayer,
  GameMessage,
  EliminatedPlayer,
  RoundLog,
  GameRejoinSuccessPayload,
} from '@hexa-hack/shared';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const TIMINGS: Record<GamePhase, number> = {
  mayor_vote: parseInt(process.env.VOTE_TIME_MS ?? '') || 30_000,
  discussion: parseInt(process.env.DISCUSSION_TIME_MS ?? '') || 120_000,
  vote: parseInt(process.env.VOTE_TIME_MS ?? '') || 30_000,
  ended: 0,
};

export class GameState {
  readonly gameId: string;
  private readonly io: IoServer;
  phase: GamePhase | null = null;
  round = 0;
  phaseEndsAt: number | null = null;
  readonly messages: GameMessage[] = [];
  readonly votes = new Map<string, string>(); // voterId → targetId
  mayorId: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly log: RoundLog[] = [];
  readonly players = new Map<string, InternalPlayer>();

  constructor(gameId: string, players: Omit<InternalPlayer, 'isAlive' | 'isMayor'>[], io: IoServer) {
    this.gameId = gameId;
    this.io = io;
    for (const p of players) {
      this.players.set(p.id, { ...p, isAlive: true, isMayor: false });
    }
  }

  // ─── Core ──────────────────────────────────────────────────────────────────

  /**
   * Called once by queue.ts after game:start has been sent to all clients.
   * Sets up the initial phase silently (no phase:change emitted) and returns
   * the initial state so queue.ts can bundle it into the game:start payload,
   * avoiding the race condition where phase:change arrives before Game mounts.
   */
  start(): { phase: GamePhase; round: number; phaseEndsAt: number } {
    this.round = 1;
    this.phase = 'discussion';
    const duration = TIMINGS.discussion;
    this.phaseEndsAt = Date.now() + duration;
    this.timer = setTimeout(() => {
      if (!this.mayorId) this._startPhase('mayor_vote');
      else this._startPhase('vote');
    }, duration);
    this._scheduleAIMessages();
    return { phase: this.phase, round: this.round, phaseEndsAt: this.phaseEndsAt };
  }

  private emit<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io.to(this.gameId) as any).emit(event, ...args);
  }

  getAlivePlayers(): InternalPlayer[] {
    return [...this.players.values()].filter((p) => p.isAlive);
  }

  // ─── Phase management ──────────────────────────────────────────────────────

  private _startPhase(phase: GamePhase): void {
    if (this.timer) clearTimeout(this.timer);
    this.phase = phase;
    this.votes.clear();

    const duration = TIMINGS[phase];
    this.phaseEndsAt = Date.now() + duration;
    this.emit('phase:change', { phase, phaseEndsAt: this.phaseEndsAt, round: this.round });

    if (phase === 'mayor_vote') {
      this.timer = setTimeout(() => this._endMayorVote(), duration);
      this._scheduleAIVotes('mayor_vote');
    } else if (phase === 'discussion') {
      this.timer = setTimeout(() => {
        if (!this.mayorId) this._startPhase('mayor_vote');
        else this._startPhase('vote');
      }, duration);
      this._scheduleAIMessages();
    } else if (phase === 'vote') {
      this.timer = setTimeout(() => this._endVote(), duration);
      this._scheduleAIVotes('vote');
    }
  }

  private _endMayorVote(): void {
    const winnerId = this._resolveVote();
    if (winnerId) {
      this.mayorId = winnerId;
      const mayor = this.players.get(winnerId)!;
      mayor.isMayor = true;
      this.emit('mayor:elected', { playerId: winnerId, playerName: mayor.name });
    }
    this._startPhase('vote');
  }

  private _startRound(): void {
    this.round++;
    this._startPhase('discussion');
  }

  private _endVote(): void {
    const eliminatedId = this._resolveVote();
    const voteSnapshot = Object.fromEntries(this.votes);

    if (eliminatedId) {
      const p = this.players.get(eliminatedId)!;
      p.isAlive = false;
      const eliminatedInfo: EliminatedPlayer = {
        id: eliminatedId,
        name: p.name,
        isAI: p.isAI,
        ...(p.isAI ? { modelName: p.modelName } : {}),
      };
      this.log.push({
        round: this.round,
        eliminated: eliminatedInfo,
        votes: voteSnapshot,
        messages: this.messages.filter((m) => m.round === this.round),
      });
      this.emit('round:end', { eliminated: eliminatedInfo, votes: voteSnapshot, round: this.round });
    } else {
      this.emit('round:end', { eliminated: null, votes: voteSnapshot, round: this.round });
    }

    const winner = this._checkWin();
    if (winner) {
      this._endGame(winner);
    } else {
      setTimeout(() => this._startRound(), 3_000);
    }
  }

  private _checkWin(): 'humans' | 'ai' | null {
    const alive = this.getAlivePlayers();
    const aiCount = alive.filter((p) => p.isAI).length;
    const humanCount = alive.filter((p) => !p.isAI).length;
    if (aiCount === 0) return 'humans';
    if (aiCount >= humanCount) return 'ai';
    return null;
  }

  private _endGame(winner: 'humans' | 'ai'): void {
    if (this.timer) clearTimeout(this.timer);
    this.phase = 'ended';
    this.emit('game:over', { winner, players: this._publicPlayers(), log: this.log });
  }

  private _resolveVote(): string | null {
    const counts: Record<string, number> = {};
    for (const targetId of this.votes.values()) {
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) return null;

    const max = Math.max(...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    if (leaders.length === 1) return leaders[0];

    // Tie: mayor's vote decides
    if (this.mayorId && this.votes.has(this.mayorId)) {
      const mayorPick = this.votes.get(this.mayorId)!;
      if (leaders.includes(mayorPick)) return mayorPick;
    }
    return null;
  }

  // ─── Public actions ────────────────────────────────────────────────────────

  addMessage(playerId: string, text: string): boolean {
    if (this.phase !== 'discussion') return false;
    const player = this.players.get(playerId);
    if (!player?.isAlive) return false;

    const msg: GameMessage = {
      id: uuidv4(),
      playerId,
      playerName: player.name,
      text,
      timestamp: Date.now(),
      round: this.round,
    };
    this.messages.push(msg);
    this.emit('game:message', msg);
    return true;
  }

  castVote(voterId: string, targetId: string): boolean {
    if (this.phase !== 'vote' && this.phase !== 'mayor_vote') return false;
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);
    if (!voter?.isAlive || !target?.isAlive || voterId === targetId) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, targetId });

    // Auto-advance when all alive players have voted
    if (this.votes.size >= this.getAlivePlayers().length) {
      if (this.timer) clearTimeout(this.timer);
      if (this.phase === 'mayor_vote') this._endMayorVote();
      else this._endVote();
    }
    return true;
  }

  // ─── Snapshot (for rejoin) ─────────────────────────────────────────────────

  getSnapshot(forPlayerId: string): GameRejoinSuccessPayload {
    return {
      gameId: this.gameId,
      yourId: forPlayerId,
      phase: this.phase!,
      round: this.round,
      phaseEndsAt: this.phaseEndsAt!,
      messages: this.messages,
      votes: Object.fromEntries(this.votes),
      mayorId: this.mayorId,
      players: this._publicPlayers(forPlayerId),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private _publicPlayers(perspectiveId?: string): PublicPlayer[] {
    return [...this.players.values()].map((p): PublicPlayer => ({
      id: p.id,
      name: p.name,
      avatarSeed: p.avatarSeed,
      isAlive: p.isAlive,
      isMayor: p.isMayor,
      // Reveal AI identity only after elimination (or to the player themselves)
      ...(p.isAlive && p.id !== perspectiveId
        ? {}
        : { isAI: p.isAI, ...(p.isAI ? { modelName: p.modelName } : {}) }),
    }));
  }

  // ─── AI scheduling ─────────────────────────────────────────────────────────

  private _scheduleAIMessages(): void {
    for (const ai of this.getAlivePlayers().filter((p) => p.isAI)) {
      // First message: 15–60 s in
      setTimeout(async () => {
        if (this.phase !== 'discussion') return;
        const text = await generateAIMessage(ai, this.messages, [...this.players.values()]);
        this.addMessage(ai.id, text);
      }, Math.random() * 45_000 + 15_000);

      // Optional second message: 70–110 s in
      if (Math.random() > 0.4) {
        setTimeout(async () => {
          if (this.phase !== 'discussion') return;
          const text = await generateAIMessage(ai, this.messages, [...this.players.values()]);
          this.addMessage(ai.id, text);
        }, Math.random() * 40_000 + 70_000);
      }
    }
  }

  private _scheduleAIVotes(phase: 'vote' | 'mayor_vote'): void {
    for (const ai of this.getAlivePlayers().filter((p) => p.isAI)) {
      setTimeout(async () => {
        if (this.phase !== phase) return;
        const targetId = await generateAIVote(ai, this.getAlivePlayers());
        if (targetId) this.castVote(ai.id, targetId);
      }, Math.random() * 20_000 + 5_000);
    }
  }
}
