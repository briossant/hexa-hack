import { Server, Socket } from 'socket.io';
import { addToQueue, getGame } from '../matchmaking/queue';
import type { ServerToClientEvents, ClientToServerEvents } from '@hexa-hack/shared';
import type { SocketData } from '../types';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerHandlers(socket: AppSocket, io: IoServer): void {
  socket.on('queue:join', () => {
    addToQueue(socket.id, io);
  });

  socket.on('game:message', ({ gameId, text }) => {
    if (!text || typeof text !== 'string') return;
    const game = getGame(gameId ?? socket.data.gameId ?? '');
    game?.addMessage(socket.data.playerId ?? '', text.trim().slice(0, 300));
  });

  socket.on('game:vote', ({ gameId, targetId }) => {
    const game = getGame(gameId ?? socket.data.gameId ?? '');
    game?.castVote(socket.data.playerId ?? '', targetId);
  });

  socket.on('game:rejoin', ({ gameId, playerId }) => {
    const game = getGame(gameId);
    if (!game || !game.players.has(playerId) || game.phase === 'ended') {
      socket.emit('game:rejoin:failed');
      return;
    }
    socket.join(gameId);
    socket.data.playerId = playerId;
    socket.data.gameId = gameId;
    socket.emit('game:rejoin:success', game.getSnapshot(playerId));
  });
}
