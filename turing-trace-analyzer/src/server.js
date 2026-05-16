import "dotenv/config";
import { createServer } from "node:http";
import { analyzeGame, BASELINE_MODEL, FINETUNED_MODEL } from "./analyzeBotPattern.js";
import { generateReport } from "./generateReport.js";
import {
  fetchGame,
  listGames,
  initSchema,
  loadGameReports,
  saveExposedBotReport,
  listEndedGameIds,
  listAnalyzedGameIds,
  getPatternStats,
  getPatternStatsByModel,
} from "./db.js";
import { buildAnalysisInput, getExposedBots } from "./gameTransformer.js";
import { LABEL_HEADLINES, LABEL_DESCRIPTIONS } from "./labels.js";

const PORT = process.env.PORT ?? 3002;

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { status: "ok" });
    }

    if (req.method === "GET" && req.url === "/games") {
      const games = await listGames();
      return json(res, 200, { games });
    }

    if (req.method === "GET" && req.url === "/stats/patterns/by-model") {
      const byModel = await getPatternStatsByModel();
      return json(res, 200, { models: byModel.map(decorateModelStats) });
    }

    if (req.method === "GET" && req.url?.startsWith("/stats/patterns")) {
      const stats = await getPatternStats();
      return json(res, 200, decoratePatternStats(stats));
    }

    const analyzeMatch = req.url?.match(/^\/analyze\/([\w-]+)(?:\?(.*))?$/);
    if (req.method === "POST" && analyzeMatch) {
      const gameId = analyzeMatch[1];
      const params = new URLSearchParams(analyzeMatch[2] ?? "");
      const modelId = params.get("model") === "finetuned" ? FINETUNED_MODEL : BASELINE_MODEL;

      const result = await analyzeGameById(gameId, modelId);
      if (!result) return json(res, 404, { error: `game ${gameId} not found` });
      return json(res, 200, result);
    }

    if (req.method === "POST" && req.url === "/analyze") {
      const body = await readBody(req);
      const game = JSON.parse(body);
      const modelId = req.headers["x-model"] === "finetuned" ? FINETUNED_MODEL : BASELINE_MODEL;
      const analyzed = await analyzeGame(game, { modelId });
      const report = generateReport(analyzed);
      return json(res, 200, report);
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    const status = err.message?.startsWith("Pioneer API 4") ? 502 : 500;
    return json(res, status, { error: err.message });
  }
});

async function analyzeGameById(gameId, modelId) {
  const cached = await loadGameReports(gameId);
  if (cached) {
    const gameRes = await fetchGame(gameId);
    if (!gameRes) return null;
    return {
      game_id: gameId,
      winner: gameRes.game.winner,
      total_rounds: gameRes.game.total_rounds,
      model_used: cached.model_used ?? modelId,
      exposed_bots_count: cached.reports.length,
      forensic_reports: cached.reports,
      cached: true,
    };
  }

  const gameData = await fetchGame(gameId);
  if (!gameData) return null;

  const exposedBots = getExposedBots(gameData);
  const reports = [];

  for (const bot of exposedBots) {
    const analysisInput = buildAnalysisInput(gameData, bot.player_id);
    const analyzed = await analyzeGame(analysisInput, { modelId });
    const report = generateReport(analyzed);
    reports.push({
      player_name: bot.name,
      player_id: bot.player_id,
      model_name: bot.model_name,
      survived_rounds: bot.survived_rounds,
      report,
    });
    await saveExposedBotReport({ gameId, bot, report, modelUsed: modelId });
  }

  return {
    game_id: gameData.game.game_id,
    winner: gameData.game.winner,
    total_rounds: gameData.game.total_rounds,
    model_used: modelId,
    exposed_bots_count: exposedBots.length,
    forensic_reports: reports,
    cached: false,
  };
}

function decorateModelStats(entry) {
  return {
    model_name: entry.model_name,
    bots_count: entry.bots_count,
    patterns: entry.patterns.map((p) => ({
      label: p.label,
      headline: LABEL_HEADLINES[p.label] ?? p.label,
      description: LABEL_DESCRIPTIONS[p.label] ?? "",
      occurrences: p.occurrences,
      bots_affected: p.bots_affected,
      bots_affected_pct: entry.bots_count > 0
        ? Math.round((p.bots_affected / entry.bots_count) * 100)
        : 0,
    })),
  };
}

function decoratePatternStats(stats) {
  return {
    total_games_analyzed: stats.total_games_analyzed,
    total_bots_analyzed: stats.total_bots_analyzed,
    patterns: stats.patterns.map((p) => ({
      label: p.label,
      headline: LABEL_HEADLINES[p.label] ?? p.label,
      description: LABEL_DESCRIPTIONS[p.label] ?? "",
      occurrences: p.occurrences,
      bots_affected: p.bots_affected,
    })),
  };
}

async function runBackfill() {
  try {
    const [endedIds, analyzedIds] = await Promise.all([
      listEndedGameIds(),
      listAnalyzedGameIds(),
    ]);
    const analyzedSet = new Set(analyzedIds);
    const pending = endedIds.filter((id) => !analyzedSet.has(id));

    if (pending.length === 0) {
      console.log("[backfill] no pending games to analyze");
      return;
    }

    console.log(`[backfill] ${pending.length} game(s) to analyze in background`);
    for (const gameId of pending) {
      try {
        const result = await analyzeGameById(gameId, BASELINE_MODEL);
        if (!result) {
          console.log(`[backfill] ${gameId}: game disappeared, skipped`);
          continue;
        }
        if (result.exposed_bots_count === 0) {
          console.log(`[backfill] ${gameId}: no exposed bots`);
        } else {
          console.log(
            `[backfill] ${gameId}: analyzed ${result.exposed_bots_count} bot(s)`
          );
        }
      } catch (err) {
        console.error(`[backfill] ${gameId}: failed —`, err.message);
      }
    }
    console.log("[backfill] done");
  } catch (err) {
    console.error("[backfill] aborted:", err);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function main() {
  await initSchema();
  server.listen(PORT, () => {
    console.log(`turing-trace-analyzer listening on port ${PORT}`);
    console.log(`  baseline model:   ${BASELINE_MODEL}`);
    console.log(`  fine-tuned model: ${FINETUNED_MODEL}`);
  });
  // Run backfill in background (non-blocking)
  runBackfill();
}

main().catch((err) => {
  console.error("[startup] fatal:", err);
  process.exit(1);
});
