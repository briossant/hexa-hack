import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://hexahack:hexahack@localhost:5432/hexahack",
});

export async function fetchGame(gameId) {
  const gameRes = await pool.query("SELECT * FROM games WHERE game_id = $1", [gameId]);
  if (gameRes.rowCount === 0) return null;
  const game = gameRes.rows[0];

  const [playersRes, messagesRes, votesRes] = await Promise.all([
    pool.query("SELECT * FROM game_players WHERE game_id = $1", [gameId]),
    pool.query("SELECT * FROM messages WHERE game_id = $1 ORDER BY sent_at", [gameId]),
    pool.query("SELECT * FROM votes WHERE game_id = $1 ORDER BY round", [gameId]),
  ]);

  return {
    game,
    players: playersRes.rows,
    messages: messagesRes.rows,
    votes: votesRes.rows,
  };
}

export async function listGames() {
  const res = await pool.query(
    "SELECT game_id, winner, total_rounds, started_at, ended_at FROM games ORDER BY started_at DESC"
  );
  return res.rows;
}

export async function close() {
  await pool.end();
}
