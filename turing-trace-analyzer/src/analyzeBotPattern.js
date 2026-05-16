import { BOT_DETECTION_LABELS } from "./labels.js";

const PIONEER_URL = "https://api.pioneer.ai/inference";
export const BASELINE_MODEL = "fastino/gliner2-base-v1";
export const FINETUNED_MODEL = process.env.FINETUNED_MODEL_ID ?? "hunt-the-bot-v1";

export async function analyzeMessage({
  playerId,
  round,
  message,
  threshold = 0.5,
  modelId = BASELINE_MODEL,
}) {
  const apiKey = process.env.PIONEER_API_KEY;
  if (!apiKey) throw new Error("PIONEER_API_KEY is missing from environment");

  const response = await fetch(PIONEER_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: modelId,
      text: message,
      schema: {
        classifications: [
          {
            task: "bot_detection_patterns",
            labels: BOT_DETECTION_LABELS,
          },
        ],
      },
      threshold,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pioneer API ${response.status}: ${body}`);
  }

  const result = await response.json();
  return { playerId, round, message, analysis: result };
}

export async function analyzeGame(game, { threshold = 0.5, modelId = BASELINE_MODEL } = {}) {
  const target = game.suspected_player;
  const detectedPatterns = [];

  for (const round of game.rounds) {
    const targetMessages = round.messages.filter((m) => m.player === target);

    for (const m of targetMessages) {
      const res = await analyzeMessage({
        playerId: target,
        round: round.round,
        message: m.text,
        threshold,
        modelId,
      });

      const classifications = extractClassifications(res.analysis);
      for (const c of classifications) {
        detectedPatterns.push({
          label: c.label,
          evidence: m.text,
          round: round.round,
          confidence: c.score ?? c.confidence ?? null,
        });
      }
    }
  }

  return {
    game_id: game.game_id,
    suspected_player: target,
    ground_truth_is_bot: game.ground_truth_is_bot,
    detected_patterns: detectedPatterns,
  };
}

function extractClassifications(apiResponse) {
  const data = apiResponse?.result?.data;
  if (!data) return [];

  const out = [];
  for (const value of Object.values(data)) {
    if (typeof value === "string") {
      out.push({ label: value, score: null });
    } else if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string") {
          out.push({ label: v, score: null });
        } else if (v && typeof v === "object" && v.label) {
          out.push({ label: v.label, score: v.score ?? v.confidence ?? null });
        }
      }
    } else if (value && typeof value === "object" && value.label) {
      out.push({ label: value.label, score: value.score ?? value.confidence ?? null });
    }
  }
  return out;
}
