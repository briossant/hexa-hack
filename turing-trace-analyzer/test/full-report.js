import "dotenv/config";
import { readFile } from "node:fs/promises";
import { analyzeGame } from "../src/analyzeBotPattern.js";
import { generateReport, renderReportText } from "../src/generateReport.js";

const games = JSON.parse(
  await readFile(new URL("../data/sample-games.json", import.meta.url), "utf-8")
);

for (const game of games) {
  try {
    const analyzed = await analyzeGame(game);
    const report = generateReport(analyzed);
    console.log("\n" + renderReportText(report) + "\n");
  } catch (err) {
    console.error(`ERROR on ${game.game_id}: ${err.message}`);
  }
}
