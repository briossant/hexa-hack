export type GamePhase = 'mayor_vote' | 'vote' | 'ended';
export type WinnerType = 'humans' | 'ai';

/** A player as visible to all clients. isAI/modelName/realName only present after elimination. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatarSeed: string;
  isAlive: boolean;
  isMayor: boolean;
  isAI?: boolean;
  modelName?: string;
  realName?: string;
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
  realName?: string;
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
  playerId: string | null;
  playerName: string | null;
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
  'queue:join': (payload: { realName?: string }) => void;
  'game:message': (payload: SendMessagePayload) => void;
  'game:vote': (payload: CastVotePayload) => void;
  'game:rejoin': (payload: RejoinPayload) => void;
}

// ─── Turing Trace Analyzer (GLiNER2 via Pioneer) ─────────────────────────────

export type ForensicSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface ForensicEvidence {
  round: number;
  quote: string;
}

export interface ForensicSection {
  label: string;
  headline: string;
  description: string;
  occurrences: number;
  evidence: ForensicEvidence[];
}

export interface ForensicReport {
  game_id: string;
  suspected_player: string;
  ground_truth_is_bot: boolean;
  severity: ForensicSeverity;
  verdict: string;
  total_patterns: number;
  distinct_patterns: number;
  sections: ForensicSection[];
}

export interface BotAnalysisReport {
  player_name: string;
  player_id: string;
  model_name: string | null;
  survived_rounds: number;
  was_eliminated: boolean;
  report: ForensicReport;
}

export type ExposedBotReport = BotAnalysisReport;

export interface GameAnalysisResponse {
  game_id: string;
  winner: WinnerType;
  total_rounds: number;
  model_used: string;
  analyzed_bots_count: number;
  eliminated_bots_count: number;
  bot_reports: BotAnalysisReport[];
  /** @deprecated Use analyzed_bots_count. Kept for older clients. */
  exposed_bots_count: number;
  /** @deprecated Use bot_reports. Kept for older clients. */
  forensic_reports: BotAnalysisReport[];
  cached?: boolean;
}

export interface PatternStat {
  label: string;
  headline: string;
  description: string;
  occurrences: number;
  bots_affected: number;
}

export interface PatternStatsResponse {
  model_used: string;
  total_games_analyzed: number;
  total_bots_analyzed: number;
  patterns: PatternStat[];
}

export interface ModelPatternStat {
  label: string;
  headline: string;
  description: string;
  occurrences: number;
  bots_affected: number;
  bots_affected_pct: number;
}

export interface ModelPatternStats {
  model_name: string;
  bots_count: number;
  patterns: ModelPatternStat[];
}

export interface PatternStatsByModelResponse {
  model_used: string;
  models: ModelPatternStats[];
}
