import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;

  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  _pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err);
  });

  return _pool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    game_id      TEXT PRIMARY KEY,
    winner       TEXT NOT NULL,
    started_at   BIGINT NOT NULL,
    ended_at     BIGINT NOT NULL,
    total_rounds INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_id         TEXT NOT NULL REFERENCES games(game_id),
    player_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    is_ai           BOOLEAN NOT NULL,
    model_name      TEXT,
    real_name       TEXT,
    survived_rounds INTEGER NOT NULL,
    was_eliminated  BOOLEAN NOT NULL,
    PRIMARY KEY (game_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    message_id  TEXT PRIMARY KEY,
    game_id     TEXT NOT NULL REFERENCES games(game_id),
    player_id   TEXT NOT NULL,
    player_name TEXT NOT NULL,
    text        TEXT NOT NULL,
    round       INTEGER NOT NULL,
    sent_at     BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    game_id   TEXT NOT NULL REFERENCES games(game_id),
    round     INTEGER NOT NULL,
    voter_id  TEXT NOT NULL,
    target_id TEXT NOT NULL,
    PRIMARY KEY (game_id, round, voter_id)
  );
`;

export async function initDb(): Promise<void> {
  const pool = getPool();
  await pool.query(SCHEMA);
  console.log('[db] PostgreSQL ready');
}
