const { v4: uuidv4 } = require('uuid');
const { GameState } = require('../game/GameState');

const PLAYERS_PER_GAME = parseInt(process.env.PLAYERS_PER_GAME) || 6;
const AI_COUNT = parseInt(process.env.AI_COUNT) || 2;
const HUMAN_SLOTS = PLAYERS_PER_GAME - AI_COUNT;
const QUEUE_TIMEOUT_MS = 30_000;

const NAME_THEMES = {
  colors:  ['Red', 'Blue', 'Green', 'Gold', 'Pink', 'Cyan', 'Jade', 'Teal', 'Rust', 'Amber', 'Rose', 'Slate', 'Ivory', 'Onyx', 'Pearl', 'Coral', 'Dusk', 'Navy', 'Sage', 'Lime'],
  animals: ['Fox', 'Bear', 'Owl', 'Wolf', 'Crow', 'Seal', 'Elk', 'Frog', 'Lynx', 'Hawk', 'Deer', 'Swan', 'Mole', 'Hare', 'Pike', 'Crab', 'Bison', 'Vole', 'Ibis', 'Newt'],
};

let activePool = []; // set once per game, names from one chosen theme
const usedNames = new Set();

function generateAnonymousName() {
  const available = activePool.filter((n) => !usedNames.has(n));
  const name = available[Math.floor(Math.random() * available.length)];
  usedNames.add(name);
  return name;
}

const queue = []; // { socketId, playerId, anonymousName }
const activeGames = new Map(); // gameId -> GameState

let queueTimer = null;

function addToQueue(socketId, io) {
  const playerId = uuidv4();
  queue.push({ socketId, playerId });

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

  // Pick theme for this game, then assign names to everyone
  const themes = Object.values(NAME_THEMES);
  activePool = themes[Math.floor(Math.random() * themes.length)];
  usedNames.clear();

  humanPlayers.forEach((p) => {
    p.anonymousName = generateAnonymousName();
  });

  const aiPlayers = Array.from({ length: AI_COUNT }, () => {
    const anonymousName = generateAnonymousName();
    return {
      id: uuidv4(),
      name: anonymousName,
      avatarSeed: anonymousName,
      isAI: true,
      socketId: null,
      modelName: 'gpt-4o-mini',
    };
  });

  const allPlayers = [
    ...humanPlayers.map((p) => ({
      id: p.playerId,
      name: p.anonymousName,
      avatarSeed: p.anonymousName,
      isAI: false,
      socketId: p.socketId,
    })),
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
