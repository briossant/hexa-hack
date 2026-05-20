import pg from "pg";
import { LABEL_DESCRIPTIONS, LABEL_HEADLINES } from "./labels.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://hexahack:hexahack@localhost:5432/hexahack",
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS analyzer_reports (
    game_id            TEXT NOT NULL,
    player_id          TEXT NOT NULL,
    player_name        TEXT NOT NULL,
    model_name         TEXT,
    model_used         TEXT NOT NULL,
    severity           TEXT NOT NULL,
    verdict            TEXT NOT NULL,
    total_patterns     INTEGER NOT NULL,
    distinct_patterns  INTEGER NOT NULL,
    survived_rounds    INTEGER NOT NULL,
    was_eliminated     BOOLEAN NOT NULL DEFAULT true,
    analyzed_at        BIGINT NOT NULL,
    PRIMARY KEY (game_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS analyzer_pattern_evidence (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT NOT NULL,
    player_id   TEXT NOT NULL,
    label       TEXT NOT NULL,
    round       INTEGER NOT NULL,
    quote       TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_analyzer_pattern_label
    ON analyzer_pattern_evidence(label);
  CREATE INDEX IF NOT EXISTS idx_analyzer_pattern_player
    ON analyzer_pattern_evidence(game_id, player_id);

  ALTER TABLE analyzer_reports
    ADD COLUMN IF NOT EXISTS was_eliminated BOOLEAN NOT NULL DEFAULT true;
`;

export async function initSchema() {
  await pool.query(SCHEMA);
  console.log("[analyzer-db] schema ready");
}

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

export async function loadGameReports(gameId) {
  const reportsRes = await pool.query(
    `SELECT * FROM analyzer_reports WHERE game_id = $1`,
    [gameId]
  );
  if (reportsRes.rowCount === 0) return null;

  const evidenceRes = await pool.query(
    `SELECT player_id, label, round, quote
     FROM analyzer_pattern_evidence
     WHERE game_id = $1
     ORDER BY player_id, round`,
    [gameId]
  );

  return rowsToGameAnalysis(reportsRes.rows, evidenceRes.rows);
}

export async function saveBotReport({ gameId, bot, report, modelUsed }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO analyzer_reports (
         game_id, player_id, player_name, model_name, model_used,
         severity, verdict, total_patterns, distinct_patterns,
         survived_rounds, was_eliminated, analyzed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (game_id, player_id) DO NOTHING`,
      [
        gameId,
        bot.player_id,
        bot.name,
        bot.model_name,
        modelUsed,
        report.severity,
        report.verdict,
        report.total_patterns,
        report.distinct_patterns,
        bot.survived_rounds,
        bot.was_eliminated,
        Date.now(),
      ]
    );

    // Only insert evidence rows if the report row was actually inserted
    // (avoid duplicating evidence on retried saves).
    const existing = await client.query(
      `SELECT 1 FROM analyzer_pattern_evidence WHERE game_id = $1 AND player_id = $2 LIMIT 1`,
      [gameId, bot.player_id]
    );
    if (existing.rowCount === 0) {
      for (const section of report.sections) {
        for (const ev of section.evidence) {
          await client.query(
            `INSERT INTO analyzer_pattern_evidence (game_id, player_id, label, round, quote)
             VALUES ($1,$2,$3,$4,$5)`,
            [gameId, bot.player_id, section.label, ev.round, ev.quote]
          );
        }
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listEndedGameIds() {
  const res = await pool.query(
    `SELECT game_id FROM games WHERE ended_at IS NOT NULL ORDER BY ended_at DESC`
  );
  return res.rows.map((r) => r.game_id);
}

export async function listFullyAnalyzedGameIds() {
  const res = await pool.query(`
    SELECT g.game_id
    FROM games g
    LEFT JOIN game_players gp
      ON gp.game_id = g.game_id AND gp.is_ai = true
    LEFT JOIN analyzer_reports ar
      ON ar.game_id = g.game_id AND ar.player_id = gp.player_id
    WHERE g.ended_at IS NOT NULL
    GROUP BY g.game_id
    HAVING COUNT(gp.player_id) = COUNT(ar.player_id)
  `);
  return res.rows.map((r) => r.game_id);
}

export async function getPatternStats() {
  const [{ rows: aggregateRows }, { rows: totalsRows }] = await Promise.all([
    pool.query(`
      SELECT
        e.label                        AS label,
        COUNT(*)::int                  AS occurrences,
        COUNT(DISTINCT (e.game_id, e.player_id))::int AS bots_affected
      FROM analyzer_pattern_evidence e
      GROUP BY e.label
      ORDER BY bots_affected DESC, occurrences DESC
    `),
    pool.query(`
      SELECT
        COUNT(*)::int                              AS total_bots_analyzed,
        COUNT(DISTINCT game_id)::int               AS total_games_analyzed
      FROM analyzer_reports
    `),
  ]);

  const totals = totalsRows[0] ?? { total_bots_analyzed: 0, total_games_analyzed: 0 };
  return {
    total_games_analyzed: totals.total_games_analyzed,
    total_bots_analyzed: totals.total_bots_analyzed,
    patterns: aggregateRows,
  };
}

export async function getPatternStatsByModel() {
  const [{ rows: botsRows }, { rows: patternRows }] = await Promise.all([
    pool.query(`
      SELECT model_name, COUNT(*)::int AS bots_count
      FROM analyzer_reports
      WHERE model_name IS NOT NULL
      GROUP BY model_name
    `),
    pool.query(`
      SELECT
        r.model_name                                    AS model_name,
        e.label                                         AS label,
        COUNT(*)::int                                   AS occurrences,
        COUNT(DISTINCT (e.game_id, e.player_id))::int   AS bots_affected
      FROM analyzer_reports r
      JOIN analyzer_pattern_evidence e
        ON e.game_id = r.game_id AND e.player_id = r.player_id
      WHERE r.model_name IS NOT NULL
      GROUP BY r.model_name, e.label
      ORDER BY r.model_name, bots_affected DESC, occurrences DESC
    `),
  ]);

  const byModel = new Map();
  for (const b of botsRows) {
    byModel.set(b.model_name, { model_name: b.model_name, bots_count: b.bots_count, patterns: [] });
  }
  for (const p of patternRows) {
    const entry = byModel.get(p.model_name);
    if (!entry) continue;
    entry.patterns.push({
      label: p.label,
      occurrences: p.occurrences,
      bots_affected: p.bots_affected,
    });
  }
  return [...byModel.values()];
}

export async function close() {
  await pool.end();
}

function rowsToGameAnalysis(reportRows, evidenceRows) {
  const evidenceByPlayer = new Map();
  for (const e of evidenceRows) {
    if (!evidenceByPlayer.has(e.player_id)) evidenceByPlayer.set(e.player_id, []);
    evidenceByPlayer.get(e.player_id).push(e);
  }

  const reports = reportRows.map((r) => {
    const playerEvidence = evidenceByPlayer.get(r.player_id) ?? [];
    const grouped = {};
    for (const ev of playerEvidence) {
      if (!grouped[ev.label]) grouped[ev.label] = [];
      grouped[ev.label].push({ round: ev.round, quote: ev.quote });
    }
    const sections = Object.entries(grouped).map(([label, evidence]) => ({
      label,
      headline: LABEL_HEADLINES[label] ?? label,
      description: LABEL_DESCRIPTIONS[label] ?? "",
      occurrences: evidence.length,
      evidence,
    }));

    return {
      player_name: r.player_name,
      player_id: r.player_id,
      model_name: r.model_name,
      survived_rounds: r.survived_rounds,
      was_eliminated: r.was_eliminated,
      report: {
        game_id: r.game_id,
        suspected_player: r.player_name,
        ground_truth_is_bot: true,
        severity: r.severity,
        verdict: r.verdict,
        total_patterns: r.total_patterns,
        distinct_patterns: r.distinct_patterns,
        sections,
      },
    };
  });

  return {
    reports,
    model_used: reportRows[0]?.model_used ?? null,
  };
}
