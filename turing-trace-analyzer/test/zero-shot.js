import "dotenv/config";
import { readFile } from "node:fs/promises";
import { analyzeGame } from "../src/analyzeBotPattern.js";

const games = JSON.parse(
  await readFile(new URL("../data/sample-games.json", import.meta.url), "utf-8")
);

const results = [];
for (const game of games) {
  console.log(`\n=== ${game.game_id} (suspect: ${game.suspected_player}, bot: ${game.ground_truth_is_bot}) ===`);
  try {
    const r = await analyzeGame(game);
    results.push(r);
    if (r.detected_patterns.length === 0) {
      console.log("  no patterns detected above threshold");
    } else {
      for (const p of r.detected_patterns) {
        const conf = p.confidence != null ? p.confidence.toFixed(2) : "n/a";
        console.log(`  [r${p.round}] ${p.label} (${conf}) :: "${truncate(p.evidence)}"`);
      }
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
}

console.log("\n=== summary ===");
for (const r of results) {
  console.log(
    `${r.game_id}: ${r.detected_patterns.length} patterns | ground_truth_is_bot=${r.ground_truth_is_bot}`
  );
}

function truncate(s, n = 80) {
  return s.length > n ? s.slice(0, n) + "..." : s;
}
