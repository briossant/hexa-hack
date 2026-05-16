import "dotenv/config";
import { readFile } from "node:fs/promises";
import { analyzeGame, BASELINE_MODEL, FINETUNED_MODEL } from "../src/analyzeBotPattern.js";

const games = JSON.parse(
  await readFile(new URL("../data/sample-games.json", import.meta.url), "utf-8")
);

console.log(`baseline:    ${BASELINE_MODEL}`);
console.log(`fine-tuned:  ${FINETUNED_MODEL}\n`);

const rows = [];

for (const game of games) {
  const [base, tuned] = await Promise.all([
    safeAnalyze(game, BASELINE_MODEL),
    safeAnalyze(game, FINETUNED_MODEL),
  ]);

  rows.push({
    game_id: game.game_id,
    suspect: game.suspected_player,
    is_bot: game.ground_truth_is_bot,
    baseline: summarize(base),
    finetuned: summarize(tuned),
  });

  printSideBySide(game, base, tuned);
}

console.log("\n=== final scorecard ===");
console.log("game_id   | bot  | baseline patterns | fine-tuned patterns");
console.log("----------+------+-------------------+--------------------");
for (const r of rows) {
  console.log(
    `${r.game_id.padEnd(9)} | ${String(r.is_bot).padEnd(5)}| ${r.baseline.padEnd(18)}| ${r.finetuned}`
  );
}

const baseHits = rows.filter((r) => r.is_bot && r.baseline !== "ERROR" && r.baseline !== "0").length;
const tunedHits = rows.filter((r) => r.is_bot && r.finetuned !== "ERROR" && r.finetuned !== "0").length;
const totalBots = rows.filter((r) => r.is_bot).length;
console.log(`\nbots detected — baseline: ${baseHits}/${totalBots}, fine-tuned: ${tunedHits}/${totalBots}`);

async function safeAnalyze(game, modelId) {
  try {
    return await analyzeGame(game, { modelId });
  } catch (err) {
    return { error: err.message, detected_patterns: [] };
  }
}

function summarize(result) {
  if (result.error) return "ERROR";
  return String(result.detected_patterns.length);
}

function printSideBySide(game, base, tuned) {
  const header = `${game.game_id} — suspect: ${game.suspected_player} (is_bot=${game.ground_truth_is_bot})`;
  console.log("\n" + "=".repeat(header.length));
  console.log(header);
  console.log("=".repeat(header.length));

  console.log(`\n  [baseline]`);
  printPatterns(base);

  console.log(`\n  [fine-tuned]`);
  printPatterns(tuned);
}

function printPatterns(result) {
  if (result.error) {
    console.log(`    ERROR: ${result.error}`);
    return;
  }
  if (result.detected_patterns.length === 0) {
    console.log("    (none)");
    return;
  }
  for (const p of result.detected_patterns) {
    console.log(`    r${p.round}: ${p.label}  ::  "${truncate(p.evidence)}"`);
  }
}

function truncate(s, n = 70) {
  return s.length > n ? s.slice(0, n) + "..." : s;
}
