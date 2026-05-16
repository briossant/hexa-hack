import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './ws/handlers';
import { initDb, getPool } from './db/database';
import type { ServerToClientEvents, ClientToServerEvents } from '@hexa-hack/shared';
import type { SocketData } from './types';

const app = express();
const server = http.createServer(app);

export const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Analytics ────────────────────────────────────────────────────────────────

// GET /api/analytics/models — ranks AI models by mean survival rounds
app.get('/api/analytics/models', async (_req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      model_name,
      COUNT(*)::int                                                         AS games_played,
      ROUND(AVG(survived_rounds)::numeric, 2)                              AS mean_survival_rounds,
      SUM(CASE WHEN was_eliminated = false THEN 1 ELSE 0 END)::int         AS games_survived,
      ROUND(
        100.0 * SUM(CASE WHEN was_eliminated = false THEN 1 ELSE 0 END) / COUNT(*),
        1
      )                                                                     AS survival_rate_pct
    FROM game_players
    WHERE is_ai = true
    GROUP BY model_name
    ORDER BY mean_survival_rounds DESC
  `);
  res.json(rows);
});

// GET /api/analytics/games — recent games summary
app.get('/api/analytics/games', async (_req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT
      g.game_id,
      g.winner,
      g.started_at,
      g.ended_at,
      g.total_rounds,
      (SELECT COUNT(*)::int FROM game_players WHERE game_id = g.game_id AND is_ai = false) AS human_count,
      (SELECT COUNT(*)::int FROM game_players WHERE game_id = g.game_id AND is_ai = true)  AS ai_count,
      (SELECT STRING_AGG(model_name, ', ')
         FROM game_players
         WHERE game_id = g.game_id AND is_ai = true)                                       AS ai_models
    FROM games g
    ORDER BY g.ended_at DESC
    LIMIT 50
  `);
  res.json(rows);
});

// GET /api/analytics/replays?n=10 — last N games with full ordered chat + player info
app.get('/api/analytics/replays', async (req, res) => {
  const pool = getPool();
  const n = Math.min(Math.max(parseInt(req.query.n as string) || 10, 1), 100);

  const { rows: games } = await pool.query<{
    game_id: string; winner: string; started_at: string; ended_at: string; total_rounds: number;
  }>(
    `SELECT game_id, winner, started_at, ended_at, total_rounds
     FROM games
     ORDER BY ended_at DESC
     LIMIT $1`,
    [n],
  );

  if (games.length === 0) {
    res.json([]);
    return;
  }

  const gameIds = games.map((g) => g.game_id);

  const { rows: players } = await pool.query<{
    game_id: string; player_id: string; name: string;
    is_ai: boolean; model_name: string | null; real_name: string | null;
    survived_rounds: number; was_eliminated: boolean;
  }>(
    `SELECT game_id, player_id, name, is_ai, model_name, real_name, survived_rounds, was_eliminated
     FROM game_players
     WHERE game_id = ANY($1)`,
    [gameIds],
  );

  const { rows: messages } = await pool.query<{
    game_id: string; player_id: string; player_name: string;
    text: string; round: number; sent_at: string;
    is_ai: boolean; model_name: string | null; real_name: string | null;
  }>(
    `SELECT m.game_id, m.player_id, m.player_name, m.text, m.round, m.sent_at,
            gp.is_ai, gp.model_name, gp.real_name
     FROM messages m
     JOIN game_players gp ON gp.player_id = m.player_id AND gp.game_id = m.game_id
     WHERE m.game_id = ANY($1)
     ORDER BY m.sent_at ASC`,
    [gameIds],
  );

  const playersByGame = new Map<string, typeof players>(gameIds.map((id) => [id, []]));
  const messagesByGame = new Map<string, typeof messages>(gameIds.map((id) => [id, []]));
  for (const p of players) playersByGame.get(p.game_id)?.push(p);
  for (const m of messages) messagesByGame.get(m.game_id)?.push(m);

  const result = games.map((g) => ({
    game_id: g.game_id,
    winner: g.winner,
    started_at: Number(g.started_at),
    ended_at: Number(g.ended_at),
    total_rounds: g.total_rounds,
    players: (playersByGame.get(g.game_id) ?? []).map((p) => ({
      player_id: p.player_id,
      name: p.name,
      is_ai: p.is_ai,
      model_name: p.model_name,
      real_name: p.real_name,
      survived_rounds: p.survived_rounds,
      was_eliminated: p.was_eliminated,
    })),
    messages: (messagesByGame.get(g.game_id) ?? []).map((m) => ({
      round: m.round,
      sent_at: Number(m.sent_at),
      player_id: m.player_id,
      player_name: m.player_name,
      is_ai: m.is_ai,
      model_name: m.model_name,
      real_name: m.real_name,
      text: m.text,
    })),
  }));

  res.json(result);
});

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);
  registerHandlers(socket, io);
  socket.on('disconnect', () => console.log(`[-] ${socket.id}`));
});

const PORT = process.env.PORT ?? 3001;

initDb()
  .then(() => {
    server.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('[db] Failed to initialize database:', err);
    process.exit(1);
  });
