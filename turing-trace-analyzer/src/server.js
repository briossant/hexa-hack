import "dotenv/config";
import { createServer } from "node:http";
import { analyzeGame, BASELINE_MODEL, FINETUNED_MODEL } from "./analyzeBotPattern.js";
import { generateReport } from "./generateReport.js";
import { fetchGame, listGames } from "./db.js";
import { buildAnalysisInput, getExposedBots } from "./gameTransformer.js";

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

    const analyzeMatch = req.url?.match(/^\/analyze\/([\w-]+)(?:\?(.*))?$/);
    if (req.method === "POST" && analyzeMatch) {
      const gameId = analyzeMatch[1];
      const params = new URLSearchParams(analyzeMatch[2] ?? "");
      const modelId = params.get("model") === "baseline" ? BASELINE_MODEL : FINETUNED_MODEL;

      const result = await analyzeGameById(gameId, modelId);
      if (!result) return json(res, 404, { error: `game ${gameId} not found` });
      return json(res, 200, result);
    }

    if (req.method === "POST" && req.url === "/analyze") {
      const body = await readBody(req);
      const game = JSON.parse(body);
      const modelId = req.headers["x-model"] === "baseline" ? BASELINE_MODEL : FINETUNED_MODEL;
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
  }

  return {
    game_id: gameData.game.game_id,
    winner: gameData.game.winner,
    total_rounds: gameData.game.total_rounds,
    model_used: modelId,
    exposed_bots_count: exposedBots.length,
    forensic_reports: reports,
  };
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

server.listen(PORT, () => {
  console.log(`turing-trace-analyzer listening on port ${PORT}`);
  console.log(`  baseline model:   ${BASELINE_MODEL}`);
  console.log(`  fine-tuned model: ${FINETUNED_MODEL}`);
});
