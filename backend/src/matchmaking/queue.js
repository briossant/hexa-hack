const { v4: uuidv4 } = require('uuid');
const { GameState } = require('../game/GameState');

const PLAYERS_PER_GAME = parseInt(process.env.PLAYERS_PER_GAME) || 6;
const AI_COUNT = parseInt(process.env.AI_COUNT) || 2;
const HUMAN_SLOTS = PLAYERS_PER_GAME - AI_COUNT;
const QUEUE_TIMEOUT_MS = 30_000;

const AI_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Drew'];

const queue = []; // { socketId, playerId, name }
const activeGames = new Map(); // gameId -> GameState

let queueTimer = null;

function addToQueue(socketId, name, io) {
  const playerId = uuidv4();
  queue.push({ socketId, playerId, name });

  const socket = io.sockets.sockets.get(socketId);
  socket?.emit('queue:joined', { playerId, position: queue.length });

  if (queue.length >= HUMAN_SLOTS) {
    clearTimeout(queueTimer);
    _startGame(io);
  } else if (queue.length === 1) {
    queueTimer = setTimeout(() => {
      if (queue.length >= 1) _startGame(io);
    }, QUEUE_TIMEOUT_MS);
  }
}

function _startGame(io) {
  const humanPlayers = queue.splice(0, HUMAN_SLOTS);

  const aiPlayers = Array.from({ length: AI_COUNT }, () => ({
    id: uuidv4(),
    name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] + Math.floor(Math.random() * 99 + 1),
    isAI: true,
    socketId: null,
    modelName: 'gpt-4o-mini',
  }));

  const allPlayers = [
    ...humanPlayers.map((p) => ({ id: p.playerId, name: p.name, isAI: false, socketId: p.socketId })),
    ...aiPlayers,
  ];

  const gameId = uuidv4();
  const game = new GameState(gameId, allPlayers, io);
  activeGames.set(gameId, game);

  // Notify and join each human socket to the game room
  humanPlayers.forEach((p) => {
    const socket = io.sockets.sockets.get(p.socketId);
    if (!socket) return;
    socket.join(gameId);
    socket.data.playerId = p.playerId;
    socket.data.gameId = gameId;
    socket.emit('game:start', {
      gameId,
      yourId: p.playerId,
      // Strip internal fields; isAI and modelName are revealed only on elimination
      players: allPlayers.map(({ socketId: _s, isAI: _ai, modelName: _m, ...rest }) => ({
        ...rest,
        isAlive: true,
        isMayor: false,
      })),
    });
  });

  console.log(`Game ${gameId} started (${humanPlayers.length} humans, ${aiPlayers.length} AIs)`);
  game.start();
}

function getGame(gameId) {
  return activeGames.get(gameId);
}

function removeGame(gameId) {
  activeGames.delete(gameId);
}

module.exports = { addToQueue, getGame, removeGame };
