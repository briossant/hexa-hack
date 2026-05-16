import "dotenv/config";
import { createServer } from "node:http";
import { analyzeGame, BASELINE_MODEL, FINETUNED_MODEL } from "./analyzeBotPattern.js";
import { generateReport } from "./generateReport.js";

const PORT = process.env.PORT ?? 3002;

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/analyze") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const game = JSON.parse(body);
        const modelId = req.headers["x-model"] === "finetuned" ? FINETUNED_MODEL : BASELINE_MODEL;
        const analyzed = await analyzeGame(game, { modelId });
        const report = generateReport(analyzed);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(report));
      } catch (err) {
        const status = err.message.startsWith("Pioneer API 4") ? 502 : 500;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`turing-trace-analyzer listening on port ${PORT}`);
  console.log(`  baseline model:   ${BASELINE_MODEL}`);
  console.log(`  fine-tuned model: ${FINETUNED_MODEL}`);
});
