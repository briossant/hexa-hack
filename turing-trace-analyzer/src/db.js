import pg from "pg";
import { BASELINE_MODEL } from "./analyzeBotPattern.js";
import { LABEL_DESCRIPTIONS, LABEL_HEADLINES } from "./labels.js";

const { Pool } = pg;
const DEFAULT_ANALYSIS_MODEL = BASELINE_MODEL;
const ANALYSIS_VERSION = "contextual-v2";
const LEGACY_ANALYSIS_VERSION = "message-only-v1";

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
    analysis_version   TEXT NOT NULL DEFAULT '${ANALYSIS_VERSION}',
    severity           TEXT NOT NULL,
    verdict            TEXT NOT NULL,
    total_patterns     INTEGER NOT NULL,
    distinct_patterns  INTEGER NOT NULL,
    analyzed_messages_count INTEGER NOT NULL DEFAULT 0,
    suspicious_messages_count INTEGER NOT NULL DEFAULT 0,
    severity_score     REAL NOT NULL DEFAULT 0,
    survived_rounds    INTEGER NOT NULL,
    was_eliminated     BOOLEAN NOT NULL DEFAULT true,
    analyzed_at        BIGINT NOT NULL,
    PRIMARY KEY (game_id, player_id, model_used)
  );

  CREATE TABLE IF NOT EXISTS analyzer_pattern_evidence (
    id          BIGSERIAL PRIMARY KEY,
    game_id     TEXT NOT NULL,
    player_id   TEXT NOT NULL,
    model_used  TEXT NOT NULL DEFAULT '${DEFAULT_ANALYSIS_MODEL}',
    analysis_version TEXT NOT NULL DEFAULT '${ANALYSIS_VERSION}',
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
  ALTER TABLE analyzer_reports
    ADD COLUMN IF NOT EXISTS analyzed_messages_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE analyzer_reports
    ADD COLUMN IF NOT EXISTS suspicious_messages_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE analyzer_reports
    ADD COLUMN IF NOT EXISTS severity_score REAL NOT NULL DEFAULT 0;
  ALTER TABLE analyzer_reports
    ADD COLUMN IF NOT EXISTS analysis_version TEXT;
  UPDATE analyzer_reports
    SET analysis_version = '${LEGACY_ANALYSIS_VERSION}'
    WHERE analysis_version IS NULL;
  ALTER TABLE analyzer_reports
    ALTER COLUMN analysis_version SET DEFAULT '${ANALYSIS_VERSION}';
  ALTER TABLE analyzer_reports
    ALTER COLUMN analysis_version SET NOT NULL;

  ALTER TABLE analyzer_pattern_evidence
    ADD COLUMN IF NOT EXISTS model_used TEXT NOT NULL DEFAULT '${DEFAULT_ANALYSIS_MODEL}';
  ALTER TABLE analyzer_pattern_evidence
    ADD COLUMN IF NOT EXISTS analysis_version TEXT;

  UPDATE analyzer_pattern_evidence e
  SET model_used = ar.model_used
  FROM analyzer_reports ar
  WHERE e.game_id = ar.game_id
    AND e.player_id = ar.player_id
    AND e.model_used = '${DEFAULT_ANALYSIS_MODEL}'
    AND (
      SELECT COUNT(*)
      FROM analyzer_reports ar2
      WHERE ar2.game_id = e.game_id
        AND ar2.player_id = e.player_id
        AND ar2.analysis_version = '${LEGACY_ANALYSIS_VERSION}'
    ) = 1;

  UPDATE analyzer_pattern_evidence
    SET analysis_version = '${LEGACY_ANALYSIS_VERSION}'
    WHERE analysis_version IS NULL;
  ALTER TABLE analyzer_pattern_evidence
    ALTER COLUMN analysis_version SET DEFAULT '${ANALYSIS_VERSION}';
  ALTER TABLE analyzer_pattern_evidence
    ALTER COLUMN analysis_version SET NOT NULL;

  ALTER TABLE analyzer_reports
    DROP CONSTRAINT IF EXISTS analyzer_reports_pkey;
  ALTER TABLE analyzer_reports
    ADD PRIMARY KEY (game_id, player_id, model_used);

  CREATE INDEX IF NOT EXISTS idx_analyzer_pattern_player_model
    ON analyzer_pattern_evidence(game_id, player_id, model_used, analysis_version);
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

export async function loadGameReports(gameId, modelUsed = DEFAULT_ANALYSIS_MODEL) {
  const reportsRes = await pool.query(
    `SELECT *
     FROM analyzer_reports
     WHERE game_id = $1 AND model_used = $2 AND analysis_version = $3`,
    [gameId, modelUsed, ANALYSIS_VERSION]
  );
  if (reportsRes.rowCount === 0) return null;

  const evidenceRes = await pool.query(
    `SELECT player_id, label, round, quote
     FROM analyzer_pattern_evidence
     WHERE game_id = $1 AND model_used = $2 AND analysis_version = $3
     ORDER BY player_id, round`,
    [gameId, modelUsed, ANALYSIS_VERSION]
  );

  return rowsToGameAnalysis(reportsRes.rows, evidenceRes.rows);
}

export async function saveBotReport({ gameId, bot, report, modelUsed }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO analyzer_reports (
         game_id, player_id, player_name, model_name, model_used, analysis_version,
         severity, verdict, total_patterns, distinct_patterns,
         analyzed_messages_count, suspicious_messages_count, severity_score,
         survived_rounds, was_eliminated, analyzed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (game_id, player_id, model_used) DO NOTHING`,
      [
        gameId,
        bot.player_id,
        bot.name,
        bot.model_name,
        modelUsed,
        ANALYSIS_VERSION,
        report.severity,
        report.verdict,
        report.total_patterns,
        report.distinct_patterns,
        report.analyzed_messages_count,
        report.suspicious_messages_count,
        report.severity_score,
        bot.survived_rounds,
        bot.was_eliminated,
        Date.now(),
      ]
    );

    await client.query(
      `UPDATE analyzer_reports
       SET player_name = $4,
           model_name = $5,
           analysis_version = $6,
           severity = $7,
           verdict = $8,
           total_patterns = $9,
           distinct_patterns = $10,
           analyzed_messages_count = $11,
           suspicious_messages_count = $12,
           severity_score = $13,
           survived_rounds = $14,
           was_eliminated = $15,
           analyzed_at = $16
       WHERE game_id = $1 AND player_id = $2 AND model_used = $3`,
      [
        gameId,
        bot.player_id,
        modelUsed,
        bot.name,
        bot.model_name,
        ANALYSIS_VERSION,
        report.severity,
        report.verdict,
        report.total_patterns,
        report.distinct_patterns,
        report.analyzed_messages_count,
        report.suspicious_messages_count,
        report.severity_score,
        bot.survived_rounds,
        bot.was_eliminated,
        Date.now(),
      ]
    );

    await client.query(
      `DELETE FROM analyzer_pattern_evidence
       WHERE game_id = $1 AND player_id = $2 AND model_used = $3`,
      [gameId, bot.player_id, modelUsed]
    );

    for (const section of report.sections) {
      for (const ev of section.evidence) {
        await client.query(
          `INSERT INTO analyzer_pattern_evidence (
             game_id, player_id, model_used, analysis_version, label, round, quote
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [gameId, bot.player_id, modelUsed, ANALYSIS_VERSION, section.label, ev.round, ev.quote]
        );
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

export async function listFullyAnalyzedGameIds(modelUsed = DEFAULT_ANALYSIS_MODEL) {
  const res = await pool.query(`
    SELECT g.game_id
    FROM games g
    LEFT JOIN game_players gp
      ON gp.game_id = g.game_id AND gp.is_ai = true
    LEFT JOIN analyzer_reports ar
      ON ar.game_id = g.game_id
     AND ar.player_id = gp.player_id
     AND ar.model_used = $1
     AND ar.analysis_version = $2
    WHERE g.ended_at IS NOT NULL
    GROUP BY g.game_id
    HAVING COUNT(gp.player_id) = COUNT(ar.player_id)
  `, [modelUsed, ANALYSIS_VERSION]);
  return res.rows.map((r) => r.game_id);
}

export async function getPatternStats(modelUsed = DEFAULT_ANALYSIS_MODEL) {
  const [{ rows: aggregateRows }, { rows: totalsRows }] = await Promise.all([
    pool.query(`
      SELECT
        e.label                        AS label,
        COUNT(*)::int                  AS occurrences,
        COUNT(DISTINCT (e.game_id, e.player_id))::int AS bots_affected
      FROM analyzer_pattern_evidence e
      WHERE e.model_used = $1 AND e.analysis_version = $2
      GROUP BY e.label
      ORDER BY bots_affected DESC, occurrences DESC
    `, [modelUsed, ANALYSIS_VERSION]),
    pool.query(`
      SELECT
        COUNT(*)::int                              AS total_bots_analyzed,
        COUNT(DISTINCT game_id)::int               AS total_games_analyzed
      FROM analyzer_reports
      WHERE model_used = $1 AND analysis_version = $2
    `, [modelUsed, ANALYSIS_VERSION]),
  ]);

  const totals = totalsRows[0] ?? { total_bots_analyzed: 0, total_games_analyzed: 0 };
  return {
    total_games_analyzed: totals.total_games_analyzed,
    total_bots_analyzed: totals.total_bots_analyzed,
    patterns: aggregateRows,
  };
}

export async function getPatternStatsByModel(modelUsed = DEFAULT_ANALYSIS_MODEL) {
  const [{ rows: botsRows }, { rows: patternRows }] = await Promise.all([
    pool.query(`
      SELECT model_name, COUNT(*)::int AS bots_count
      FROM analyzer_reports
      WHERE model_name IS NOT NULL AND model_used = $1 AND analysis_version = $2
      GROUP BY model_name
    `, [modelUsed, ANALYSIS_VERSION]),
    pool.query(`
      SELECT
        r.model_name                                    AS model_name,
        e.label                                         AS label,
        COUNT(*)::int                                   AS occurrences,
        COUNT(DISTINCT (e.game_id, e.player_id))::int   AS bots_affected
      FROM analyzer_reports r
      JOIN analyzer_pattern_evidence e
        ON e.game_id = r.game_id
       AND e.player_id = r.player_id
       AND e.model_used = r.model_used
       AND e.analysis_version = r.analysis_version
      WHERE r.model_name IS NOT NULL
        AND r.model_used = $1
        AND r.analysis_version = $2
      GROUP BY r.model_name, e.label
      ORDER BY r.model_name, bots_affected DESC, occurrences DESC
    `, [modelUsed, ANALYSIS_VERSION]),
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
        analyzed_messages_count: r.analyzed_messages_count,
        suspicious_messages_count: r.suspicious_messages_count,
        severity_score: r.severity_score,
        sections,
      },
    };
  });

  return {
    reports,
    model_used: reportRows[0]?.model_used ?? null,
  };
}
