const { v4: uuidv4 } = require('uuid');
const { generateAIMessage, generateAIVote } = require('../ai/aiPlayer');

const TIMINGS = {
  mayor_vote: parseInt(process.env.VOTE_TIME_MS) || 30_000,
  discussion: parseInt(process.env.DISCUSSION_TIME_MS) || 120_000,
  vote: parseInt(process.env.VOTE_TIME_MS) || 30_000,
};

class GameState {
  constructor(gameId, players, io) {
    this.gameId = gameId;
    this.io = io;
    this.phase = null;
    this.round = 0;
    this.messages = [];
    this.votes = new Map(); // voterId -> targetId
    this.mayorId = null;
    this.timer = null;
    this.log = [];

    this.players = new Map();
    players.forEach((p) => this.players.set(p.id, { ...p, isAlive: true, isMayor: false }));
  }

  // --- Core ---

  start() {
    this._startPhase('mayor_vote');
  }

  emit(event, data) {
    this.io.to(this.gameId).emit(event, data);
  }

  getAlivePlayers() {
    return [...this.players.values()].filter((p) => p.isAlive);
  }

  // --- Phase management ---

  _startPhase(phase) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.votes.clear();

    const duration = TIMINGS[phase];
    this.emit('phase:change', { phase, duration, round: this.round });

    if (phase === 'mayor_vote') {
      this.timer = setTimeout(() => this._endMayorVote(), duration);
      this._scheduleAIVotes();
    } else if (phase === 'discussion') {
      this.timer = setTimeout(() => this._startPhase('vote'), duration);
      this._scheduleAIMessages();
    } else if (phase === 'vote') {
      this.timer = setTimeout(() => this._endVote(), duration);
      this._scheduleAIVotes();
    }
  }

  _endMayorVote() {
    const winnerId = this._resolveVote();
    if (winnerId) {
      this.mayorId = winnerId;
      const mayor = this.players.get(winnerId);
      mayor.isMayor = true;
      this.emit('mayor:elected', { playerId: winnerId, playerName: mayor.name });
    }
    this._startRound();
  }

  _startRound() {
    this.round++;
    this._startPhase('discussion');
  }

  _endVote() {
    const eliminatedId = this._resolveVote();
    const voteSnapshot = Object.fromEntries(this.votes);

    if (eliminatedId) {
      const p = this.players.get(eliminatedId);
      p.isAlive = false;
      this.log.push({
        round: this.round,
        eliminated: { id: eliminatedId, name: p.name, isAI: p.isAI },
        votes: voteSnapshot,
        messages: this.messages.filter((m) => m.round === this.round),
      });
      this.emit('round:end', {
        eliminated: { id: eliminatedId, name: p.name, isAI: p.isAI },
        votes: voteSnapshot,
        round: this.round,
      });
    } else {
      this.emit('round:end', { eliminated: null, votes: voteSnapshot, round: this.round });
    }

    const winner = this._checkWin();
    if (winner) {
      this._endGame(winner);
    } else {
      setTimeout(() => this._startRound(), 3000);
    }
  }

  _checkWin() {
    const alive = this.getAlivePlayers();
    const aiCount = alive.filter((p) => p.isAI).length;
    const humanCount = alive.filter((p) => !p.isAI).length;
    if (aiCount === 0) return 'humans';
    if (aiCount >= humanCount) return 'ai';
    return null;
  }

  _endGame(winner) {
    clearTimeout(this.timer);
    this.phase = 'ended';
    this.emit('game:over', { winner, players: [...this.players.values()], log: this.log });
  }

  _resolveVote() {
    const counts = {};
    for (const targetId of this.votes.values()) {
      counts[targetId] = (counts[targetId] || 0) + 1;
    }
    if (!Object.keys(counts).length) return null;

    const max = Math.max(...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    if (leaders.length === 1) return leaders[0];

    // Tie: mayor's vote decides
    if (this.mayorId && this.votes.has(this.mayorId)) {
      const mayorPick = this.votes.get(this.mayorId);
      if (leaders.includes(mayorPick)) return mayorPick;
    }
    return null; // Unresolved tie — no elimination
  }

  // --- Public actions ---

  addMessage(playerId, text) {
    if (this.phase !== 'discussion') return false;
    const player = this.players.get(playerId);
    if (!player?.isAlive) return false;

    const msg = {
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

  castVote(voterId, targetId) {
    if (this.phase !== 'vote' && this.phase !== 'mayor_vote') return false;
    const voter = this.players.get(voterId);
    const target = this.players.get(targetId);
    if (!voter?.isAlive || !target?.isAlive || voterId === targetId) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, targetId });

    // Auto-advance when everyone has voted
    if (this.votes.size >= this.getAlivePlayers().length) {
      clearTimeout(this.timer);
      if (this.phase === 'mayor_vote') this._endMayorVote();
      else this._endVote();
    }
    return true;
  }

  // --- Snapshot (for rejoin) ---

  getSnapshot(forPlayerId) {
    return {
      gameId: this.gameId,
      yourId: forPlayerId,
      phase: this.phase,
      round: this.round,
      messages: this.messages,
      votes: Object.fromEntries(this.votes),
      mayorId: this.mayorId,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isMayor: p.isMayor,
        // Only reveal AI identity after elimination
        ...(p.isAlive ? {} : { isAI: p.isAI, modelName: p.modelName }),
      })),
    };
  }

  // --- AI scheduling ---

  _scheduleAIMessages() {
    const aiPlayers = this.getAlivePlayers().filter((p) => p.isAI);
    aiPlayers.forEach((ai) => {
      // First message: 15–60s in
      setTimeout(async () => {
        if (this.phase !== 'discussion') return;
        const text = await generateAIMessage(ai, this.messages, [...this.players.values()]);
        this.addMessage(ai.id, text);
      }, Math.random() * 45_000 + 15_000);

      // Optional second message: 70–110s in
      if (Math.random() > 0.4) {
        setTimeout(async () => {
          if (this.phase !== 'discussion') return;
          const text = await generateAIMessage(ai, this.messages, [...this.players.values()]);
          this.addMessage(ai.id, text);
        }, Math.random() * 40_000 + 70_000);
      }
    });
  }

  _scheduleAIVotes() {
    const aiPlayers = this.getAlivePlayers().filter((p) => p.isAI);
    aiPlayers.forEach((ai) => {
      setTimeout(async () => {
        if (this.phase !== 'vote') return;
        const targetId = await generateAIVote(ai, this.getAlivePlayers());
        if (targetId) this.castVote(ai.id, targetId);
      }, Math.random() * 20_000 + 5_000);
    });
  }
}

module.exports = { GameState };
