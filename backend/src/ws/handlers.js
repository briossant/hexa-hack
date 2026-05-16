const { addToQueue, getGame } = require('../matchmaking/queue');

function registerHandlers(socket, io) {
  socket.on('queue:join', ({ name } = {}) => {
    if (!name || typeof name !== 'string') return;
    addToQueue(socket.id, name.trim().slice(0, 20), io);
  });

  socket.on('game:message', ({ gameId, text } = {}) => {
    if (!text || typeof text !== 'string') return;
    const game = getGame(gameId || socket.data.gameId);
    game?.addMessage(socket.data.playerId, text.trim().slice(0, 300));
  });

  socket.on('game:vote', ({ gameId, targetId } = {}) => {
    const game = getGame(gameId || socket.data.gameId);
    game?.castVote(socket.data.playerId, targetId);
  });

  socket.on('game:rejoin', ({ gameId, playerId } = {}) => {
    const game = getGame(gameId);
    if (!game || !game.players.has(playerId) || game.phase === 'ended') {
      return socket.emit('game:rejoin:failed');
    }
    socket.join(gameId);
    socket.data.playerId = playerId;
    socket.data.gameId = gameId;
    socket.emit('game:rejoin:success', game.getSnapshot(playerId));
  });
}

module.exports = { registerHandlers };
