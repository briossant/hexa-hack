import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { GameState } from '../game/GameState';
import type { QueueEntry, SocketData } from '../types';
import type { ServerToClientEvents, ClientToServerEvents } from '@hexa-hack/shared';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const PLAYERS_PER_GAME = parseInt(process.env.PLAYERS_PER_GAME ?? '') || 6;
const AI_COUNT = parseInt(process.env.AI_COUNT ?? '') || 2;
const HUMAN_SLOTS = PLAYERS_PER_GAME - AI_COUNT;
const QUEUE_TIMEOUT_MS = 30_000;

const NAME_THEMES: Record<string, string[]> = {
  colors: ['Red', 'Blue', 'Green', 'Gold', 'Pink', 'Cyan', 'Jade', 'Teal', 'Rust', 'Amber', 'Rose', 'Slate', 'Ivory', 'Onyx', 'Pearl', 'Coral', 'Dusk', 'Navy', 'Sage', 'Lime'],
  animals: ['Fox', 'Bear', 'Owl', 'Wolf', 'Crow', 'Seal', 'Elk', 'Frog', 'Lynx', 'Hawk', 'Deer', 'Swan', 'Mole', 'Hare', 'Pike', 'Crab', 'Bison', 'Vole', 'Ibis', 'Newt'],
};

let activePool: string[] = [];
const usedNames = new Set<string>();

function generateAnonymousName(): string {
  const available = activePool.filter((n) => !usedNames.has(n));
  const name = available[Math.floor(Math.random() * available.length)];
  usedNames.add(name);
  return name;
}

const queue: QueueEntry[] = [];
const activeGames = new Map<string, GameState>();
let queueTimer: ReturnType<typeof setTimeout> | null = null;

export function addToQueue(socketId: string, io: IoServer, realName?: string): void {
  const playerId = uuidv4();
  queue.push({ socketId, playerId, realName });

  const socket = io.sockets.sockets.get(socketId);
  socket?.emit('queue:joined', { playerId, position: queue.length });

  if (queue.length >= HUMAN_SLOTS) {
    if (queueTimer) clearTimeout(queueTimer);
    _startGame(io);
  } else if (queue.length === 1) {
    queueTimer = setTimeout(() => {
      if (queue.length >= 1) _startGame(io);
    }, QUEUE_TIMEOUT_MS);
  }
}

function _startGame(io: IoServer): void {
  const humanPlayers = queue.splice(0, HUMAN_SLOTS);

  const themes = Object.values(NAME_THEMES);
  activePool = themes[Math.floor(Math.random() * themes.length)];
  usedNames.clear();

  for (const p of humanPlayers) {
    p.anonymousName = generateAnonymousName();
  }

  const AI_MODELS: { model: string; weight: number }[] = [
    { model: 'gpt-4o-mini',  weight: 40 },
    { model: 'gpt-4.1-nano', weight: 25 },
    { model: 'gpt-4.1-mini', weight: 20 },
    { model: 'gpt-4o',       weight: 10 },
    { model: 'o4-mini',      weight:  5 },
  ];
  const totalWeight = AI_MODELS.reduce((sum, m) => sum + m.weight, 0);

  function pickModel(): string {
    let r = Math.random() * totalWeight;
    for (const { model, weight } of AI_MODELS) {
      r -= weight;
      if (r <= 0) return model;
    }
    return AI_MODELS[0].model;
  }

  const aiPlayers = Array.from({ length: AI_COUNT }, () => {
    const anonymousName = generateAnonymousName();
    return {
      id: uuidv4(),
      name: anonymousName,
      avatarSeed: anonymousName,
      isAI: true as const,
      socketId: null,
      modelName: pickModel(),
    };
  });

  const allPlayers = [
    ...humanPlayers.map((p) => ({
      id: p.playerId,
      name: p.anonymousName!,
      avatarSeed: p.anonymousName!,
      isAI: false as const,
      socketId: p.socketId,
      ...(p.realName ? { realName: p.realName } : {}),
    })),
    ...aiPlayers,
  ];

  const gameId = uuidv4();
  const game = new GameState(gameId, allPlayers, io);
  activeGames.set(gameId, game);

  // start() sets up the initial phase silently and returns the state to bundle
  // into game:start, ensuring clients have phase/round/phaseEndsAt before any
  // phase:change event could arrive.
  const initialState = game.start();

  const publicPlayers = allPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    avatarSeed: p.avatarSeed,
    isAlive: true,
    isMayor: false,
  }));

  for (const p of humanPlayers) {
    const socket = io.sockets.sockets.get(p.socketId);
    if (!socket) continue;
    socket.join(gameId);
    socket.data.playerId = p.playerId;
    socket.data.gameId = gameId;
    socket.emit('game:start', {
      gameId,
      yourId: p.playerId,
      players: publicPlayers,
      phase: initialState.phase,
      round: initialState.round,
      phaseEndsAt: initialState.phaseEndsAt,
    });
  }

  console.log(`Game ${gameId} started (${humanPlayers.length} humans, ${aiPlayers.length} AIs)`);
}

export function getGame(gameId: string): GameState | undefined {
  return activeGames.get(gameId);
}

export function removeGame(gameId: string): void {
  activeGames.delete(gameId);
}
