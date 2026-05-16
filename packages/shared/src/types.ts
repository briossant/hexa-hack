export type GamePhase = 'discussion' | 'mayor_vote' | 'vote' | 'ended';
export type WinnerType = 'humans' | 'ai';

/** A player as visible to all clients. isAI/modelName only present after elimination. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatarSeed: string;
  isAlive: boolean;
  isMayor: boolean;
  isAI?: boolean;
  modelName?: string;
}

export interface GameMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  round: number;
}

export interface EliminatedPlayer {
  id: string;
  name: string;
  isAI: boolean;
  modelName?: string;
}

export interface RoundLog {
  round: number;
  eliminated: EliminatedPlayer | null;
  votes: Record<string, string>;
  messages: GameMessage[];
}

// ─── Shared game state shape (used for game:start and as base for rejoin) ────

export interface GameData {
  gameId: string;
  yourId: string;
  players: PublicPlayer[];
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  // Present on rejoin, absent on initial start
  messages?: GameMessage[];
  votes?: Record<string, string>;
  mayorId?: string | null;
}

// ─── Server → Client events ──────────────────────────────────────────────────

/** Payload of 'game:start' is the full GameData (messages/votes/mayorId absent). */
export type GameStartPayload = Omit<GameData, 'messages' | 'votes' | 'mayorId'>;

export interface PhaseChangePayload {
  phase: GamePhase;
  phaseEndsAt: number;
  round: number;
}

export interface VoteCastPayload {
  voterId: string;
  targetId: string;
}

export interface MayorElectedPayload {
  playerId: string;
  playerName: string;
}

export interface RoundEndPayload {
  eliminated: EliminatedPlayer | null;
  votes: Record<string, string>;
  round: number;
}

export interface GameOverPayload {
  winner: WinnerType;
  players: PublicPlayer[];
  log: RoundLog[];
}

export interface QueueJoinedPayload {
  playerId: string;
  position: number;
}

/** Payload of 'game:rejoin:success' — full state snapshot including history. */
export interface GameRejoinSuccessPayload {
  gameId: string;
  yourId: string;
  players: PublicPlayer[];
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  messages: GameMessage[];
  votes: Record<string, string>;
  mayorId: string | null;
}

// ─── Socket event maps ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'queue:joined': (payload: QueueJoinedPayload) => void;
  'game:start': (payload: GameStartPayload) => void;
  'phase:change': (payload: PhaseChangePayload) => void;
  'game:message': (payload: GameMessage) => void;
  'vote:cast': (payload: VoteCastPayload) => void;
  'mayor:elected': (payload: MayorElectedPayload) => void;
  'round:end': (payload: RoundEndPayload) => void;
  'game:over': (payload: GameOverPayload) => void;
  'game:rejoin:success': (payload: GameRejoinSuccessPayload) => void;
  'game:rejoin:failed': () => void;
}

// ─── Client → Server events ──────────────────────────────────────────────────

export interface SendMessagePayload {
  gameId: string;
  text: string;
}

export interface CastVotePayload {
  gameId: string;
  targetId: string;
}

export interface RejoinPayload {
  gameId: string;
  playerId: string;
}

export interface ClientToServerEvents {
  'queue:join': () => void;
  'game:message': (payload: SendMessagePayload) => void;
  'game:vote': (payload: CastVotePayload) => void;
  'game:rejoin': (payload: RejoinPayload) => void;
}
