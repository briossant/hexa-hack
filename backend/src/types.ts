/** Full player record kept server-side. Never sent directly to clients. */
export interface InternalPlayer {
  id: string;
  name: string;
  avatarSeed: string;
  isAI: boolean;
  isAlive: boolean;
  isMayor: boolean;
  socketId: string | null;
  modelName?: string;
  realName?: string;
}

/** Shape of items stored in the matchmaking queue. */
export interface QueueEntry {
  socketId: string;
  playerId: string;
  anonymousName?: string;
  realName?: string;
}

/** Type for socket.data attached to each connection. */
export interface SocketData {
  playerId?: string;
  gameId?: string;
}
