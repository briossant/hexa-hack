import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import { analyzeMessage, BASELINE_MODEL } from "../src/analyzeBotPattern.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://hexahack:hexahack@localhost:5432/hexahack",
});

const OUT_REVIEW = "data/real-games-review.md";
const MIN_TEXT_LEN = 8; // skip "hi", "ok", typos like "67"

async function main() {
  console.log("Fetching bot messages from DB…");
  const botMessages = await fetchMessages(true);
  console.log(`  found ${botMessages.length} bot messages (≥${MIN_TEXT_LEN} chars)`);

  console.log("Auto-annotating with baseline GLiNER2…");
  const annotated = [];
  for (const m of botMessages) {
    process.stdout.write(`  [${annotated.length + 1}/${botMessages.length}] ${m.player_name} (${m.model_name})… `);
    try {
      const res = await analyzeMessage({
        playerId: m.player_id,
        round: m.round,
        message: m.text,
        modelId: BASELINE_MODEL,
      });
      const label = res.analysis?.result?.data?.bot_detection_patterns ?? null;
      annotated.push({ ...m, label });
      console.log(label ?? "(none)");
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      annotated.push({ ...m, label: null, error: err.message });
    }
  }

  console.log("\nWriting outputs…");
  await ensureDir(OUT_REVIEW);
  const md = renderReview(annotated);
  await writeFile(OUT_REVIEW, md, "utf-8");
  console.log(`  ✓ ${OUT_REVIEW}`);
  console.log("  review required before JSONL export: run npm run build:training after approving rows");

  const counts = countLabels(annotated);
  console.log("\nLabel distribution:");
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(40)} ${count}`);
  }

  await pool.end();
}

async function fetchMessages(isAi) {
  const res = await pool.query(
    `SELECT m.message_id, m.game_id, m.player_id, m.player_name, m.text, m.round, gp.model_name
     FROM messages m
     JOIN game_players gp ON gp.game_id = m.game_id AND gp.player_id = m.player_id
     WHERE gp.is_ai = $1 AND length(m.text) >= $2
     ORDER BY m.game_id, m.sent_at`,
    [isAi, MIN_TEXT_LEN]
  );
  return res.rows;
}

function renderReview(annotated) {
  const lines = [
    "# Real games training data — review",
    "",
    `Auto-annotated with baseline GLiNER2 (\`${BASELINE_MODEL}\`).`,
    "Baseline labels are suggestions only. Do not fine-tune on this file directly.",
    "Set Decision to `approve` only after human review, and set Reviewed label to the final label.",
    "Use `reject` for false positives and `skip` for examples that should not enter training.",
    "Then run `npm run build:training` to create `data/real-games-training.jsonl`.",
    "",
    "| # | Decision | Reviewed label | Baseline label | Model | Round | Message |",
    "|---|----------|----------------|----------------|-------|-------|---------|",
  ];
  annotated.forEach((a, i) => {
    const label = a.label ?? "_(none)_";
    const text = a.text.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${i + 1} | review |  | \`${label}\` | ${a.model_name} | r${a.round} | ${text} |`);
  });
  return lines.join("\n") + "\n";
}

function countLabels(annotated) {
  const out = {};
  for (const a of annotated) {
    const k = a.label ?? "(none)";
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
