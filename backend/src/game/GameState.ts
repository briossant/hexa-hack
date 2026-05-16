import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { invokeAgent } from '../ai/aiPlayer';
import { persistGame } from '../db/persist';
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

// Both active phases last 2 minutes; break between phases is 10 seconds (handled inline).
const PHASE_DURATION_MS = parseInt(process.env.PHASE_TIME_MS ?? '') || 120_000;
const BREAK_DURATION_MS = 10_000;

const AI_COOLDOWN_MS = 25_000; // min time between two messages from the same AI

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

  private readonly aiDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly aiLastSpoke = new Map<string, number>();
  private startedAt = 0;

  constructor(gameId: string, players: Omit<InternalPlayer, 'isAlive' | 'isMayor'>[], io: IoServer) {
    this.gameId = gameId;
    this.io = io;
    for (const p of players) {
      this.players.set(p.id, { ...p, isAlive: true, isMayor: false });
    }
  }

  // ─── Core ──────────────────────────────────────────────────────────────────

  start(): { phase: GamePhase; round: number; phaseEndsAt: number } {
    this.startedAt = Date.now();
    this.round = 1;
    this._beginPhase('mayor_vote');
    return { phase: this.phase!, round: this.round, phaseEndsAt: this.phaseEndsAt! };
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

  /** Immediately starts a phase: emits phase:change and arms the timer. */
  private _beginPhase(phase: 'mayor_vote' | 'vote'): void {
    if (this.timer) clearTimeout(this.timer);
    this.phase = phase;
    this.votes.clear();
    this.phaseEndsAt = Date.now() + PHASE_DURATION_MS;
    this.emit('phase:change', { phase, phaseEndsAt: this.phaseEndsAt, round: this.round });

    if (phase === 'mayor_vote') {
      this.timer = setTimeout(() => this._endMayorVote(), PHASE_DURATION_MS);
    } else {
      this.timer = setTimeout(() => this._endVote(), PHASE_DURATION_MS);
    }

    // AIs participate in every active phase: they can chat and vote
    this._scheduleAIVotes(phase);
    this._scheduleProactiveMessages(phase);
  }

  private _endMayorVote(): void {
    if (this.timer) clearTimeout(this.timer);

    // Clear old mayor
    if (this.mayorId) {
      const prev = this.players.get(this.mayorId);
      if (prev) prev.isMayor = false;
    }

    // Tally votes — on tie, pick randomly among leaders
    const counts: Record<string, number> = {};
    for (const targetId of this.votes.values()) {
      counts[targetId] = (counts[targetId] ?? 0) + 1;
    }
    let winnerId: string | null = null;
    if (Object.keys(counts).length > 0) {
      const max = Math.max(...Object.values(counts));
      const leaders = Object.keys(counts).filter((id) => counts[id] === max);
      winnerId = leaders[Math.floor(Math.random() * leaders.length)];
    }

    if (winnerId) {
      this.mayorId = winnerId;
      const mayor = this.players.get(winnerId)!;
      mayor.isMayor = true;
    } else {
      this.mayorId = null;
    }

    // Always emit result so client can show the break alert
    this.emit('mayor:elected', {
      playerId: winnerId ?? null,
      playerName: winnerId ? (this.players.get(winnerId)?.name ?? null) : null,
    });

    // 10-second break before vote phase
    setTimeout(() => this._beginPhase('vote'), BREAK_DURATION_MS);
  }

  private _startRound(): void {
    this.round++;
    // Reset mayor for the new round
    if (this.mayorId) {
      const prev = this.players.get(this.mayorId);
      if (prev) prev.isMayor = false;
      this.mayorId = null;
    }
    this._beginPhase('mayor_vote');
  }

  private _endVote(): void {
    if (this.timer) clearTimeout(this.timer);
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
        ...(p.realName ? { realName: p.realName } : {}),
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
      // Small delay so clients receive round:end before game:over
      setTimeout(() => this._endGame(winner), 500);
    } else {
      // 10-second break before next round
      setTimeout(() => this._startRound(), BREAK_DURATION_MS);
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
    this.emit('game:over', { winner, players: this._publicPlayers(true), log: this.log });

    persistGame({
      gameId: this.gameId,
      winner,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      totalRounds: this.round,
      players: [...this.players.values()],
      log: this.log,
    }).catch((err) => console.error('[db] Failed to persist game:', err));
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

    if (this.mayorId && this.votes.has(this.mayorId)) {
      const mayorPick = this.votes.get(this.mayorId)!;
      if (leaders.includes(mayorPick)) return mayorPick;
    }
    return null;
  }

  // ─── Public actions ────────────────────────────────────────────────────────

  addMessage(playerId: string, text: string): boolean {
    if (this.phase !== 'mayor_vote' && this.phase !== 'vote') return false;
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

    // React to human messages only — avoids AI→AI infinite loops
    if (!player.isAI) {
      this._debounceAIReaction();
    }

    return true;
  }

  castVote(voterId: string, targetId: string): boolean {
    if (this.phase !== 'vote' && this.phase !== 'mayor_vote') return false;
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);
    if (!voter?.isAlive || !target?.isAlive || voterId === targetId) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, targetId });

    if (this.votes.size >= this.getAlivePlayers().length) {
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
      players: this._publicPlayers(false, forPlayerId),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private _publicPlayers(revealAll = false, perspectiveId?: string): PublicPlayer[] {
    return [...this.players.values()].map((p): PublicPlayer => ({
      id: p.id,
      name: p.name,
      avatarSeed: p.avatarSeed,
      isAlive: p.isAlive,
      isMayor: p.isMayor,
      ...(revealAll || !p.isAlive || p.id === perspectiveId
        ? {
            isAI: p.isAI,
            ...(p.isAI ? { modelName: p.modelName } : {}),
            ...(p.realName ? { realName: p.realName } : {}),
          }
        : {}),
    }));
  }

  // ─── AI agent orchestration ────────────────────────────────────────────────

  // Debounce per-AI: collapses rapid human messages into a single agent invocation
  private _debounceAIReaction(): void {
    if (this.phase !== 'mayor_vote' && this.phase !== 'vote') return;
    const currentPhase = this.phase;
    for (const ai of this.getAlivePlayers().filter((p) => p.isAI)) {
      const existing = this.aiDebounceTimers.get(ai.id);
      if (existing) clearTimeout(existing);
      const delay = Math.random() * 7_000 + 3_000; // 3–10 s after last human message
      this.aiDebounceTimers.set(
        ai.id,
        setTimeout(() => this._runAIAgent(ai, currentPhase), delay),
      );
    }
  }

  // Proactive fallback: fire once per AI so they speak even if no human does
  private _scheduleProactiveMessages(phase: 'mayor_vote' | 'vote'): void {
    for (const ai of this.getAlivePlayers().filter((p) => p.isAI)) {
      const delay = Math.random() * 45_000 + 20_000; // 20–65 s into phase
      setTimeout(() => this._runAIAgent(ai, phase), delay);
    }
  }

  // Each AI agent decides who to vote for (scheduled once per phase)
  private _scheduleAIVotes(phase: 'vote' | 'mayor_vote'): void {
    for (const ai of this.getAlivePlayers().filter((p) => p.isAI)) {
      const delay = Math.random() * 50_000 + 30_000; // 30–80 s into phase
      setTimeout(() => this._runAIAgent(ai, phase), delay);
    }
  }

  // Single agent invocation — handles tool result
  private async _runAIAgent(ai: InternalPlayer, phase: GamePhase): Promise<void> {
    if (this.phase !== phase) return;

    // Cooldown: prevent the same AI from spamming messages
    const lastSpoke = this.aiLastSpoke.get(ai.id) ?? 0;
    if (Date.now() - lastSpoke < AI_COOLDOWN_MS) return;

    const result = await invokeAgent(ai, this.messages, this.getAlivePlayers(), phase);
    if (!result) return;

    if (result.name === 'send_message' && (this.phase === 'mayor_vote' || this.phase === 'vote')) {
      this.addMessage(ai.id, result.args.text);
      this.aiLastSpoke.set(ai.id, Date.now());
    } else if (result.name === 'vote' && (this.phase === 'vote' || this.phase === 'mayor_vote')) {
      this.castVote(ai.id, result.args.targetId);
    }
    // 'pass' → do nothing
  }
}
