import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { BOT_DETECTION_LABELS } from "../src/labels.js";

const REVIEW_MD = "data/real-games-review.md";
const OUT_JSONL = "data/real-games-training.jsonl";
const APPROVED = new Set(["approve", "approved"]);
const SKIPPED = new Set(["review", "todo", "reject", "rejected", "skip", "skipped", ""]);
const VALID_LABELS = new Set(BOT_DETECTION_LABELS);

async function main() {
  const markdown = await readFile(REVIEW_MD, "utf-8");
  const rows = parseReviewRows(markdown);
  const approved = [];
  const rejected = [];
  const pending = [];

  for (const row of rows) {
    const decision = normalizeCell(row.decision).toLowerCase();
    const label = stripCode(row.reviewedLabel || row.baselineLabel);

    if (APPROVED.has(decision)) {
      if (!VALID_LABELS.has(label)) {
        throw new Error(`Row ${row.index}: approved label "${label}" is not in BOT_DETECTION_LABELS`);
      }
      approved.push({
        text: row.message,
        classifications: { bot_detection_patterns: label },
      });
    } else if (SKIPPED.has(decision)) {
      if (decision === "review" || decision === "todo" || decision === "") pending.push(row);
      else rejected.push(row);
    } else {
      throw new Error(`Row ${row.index}: unknown decision "${row.decision}"`);
    }
  }

  if (approved.length === 0) {
    await removeIfExists(OUT_JSONL);
  } else {
    await ensureDir(OUT_JSONL);
    const jsonl = approved.map((item) => JSON.stringify(item)).join("\n");
    await writeFile(OUT_JSONL, `${jsonl}\n`, "utf-8");
  }

  console.log(approved.length > 0 ? `wrote ${OUT_JSONL}` : `no approved rows; ${OUT_JSONL} not written`);
  console.log(`  approved: ${approved.length}`);
  console.log(`  rejected/skipped: ${rejected.length}`);
  console.log(`  still pending review: ${pending.length}`);
}

function parseReviewRows(markdown) {
  const rows = [];
  const lines = markdown.split("\n").filter((line) => line.startsWith("|"));
  for (const line of lines) {
    if (line.includes("---") || line.includes("Decision")) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 7) continue;
    rows.push({
      index: cells[0],
      decision: cells[1],
      reviewedLabel: cells[2],
      baselineLabel: cells[3],
      model: cells[4],
      round: cells[5],
      message: cells.slice(6).join(" | "),
    });
  }
  return rows;
}

function splitMarkdownRow(line) {
  const cells = [];
  let current = "";
  let escaped = false;

  for (let i = 1; i < line.length - 1; i++) {
    const ch = line[i];
    if (escaped) {
      current += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === "|") {
      cells.push(normalizeCell(current));
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(normalizeCell(current));
  return cells;
}

function normalizeCell(value) {
  return value.trim().replace(/\\\|/g, "|");
}

function stripCode(value) {
  return normalizeCell(value).replace(/^`|`$/g, "");
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function removeIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
