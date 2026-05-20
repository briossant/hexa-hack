import { BOT_DETECTION_LABELS } from "./labels.js";

const PIONEER_URL = "https://api.pioneer.ai/inference";
export const BASELINE_MODEL = "fastino/gliner2-base-v1";
export const FINETUNED_MODEL = process.env.FINETUNED_MODEL_ID ?? "hunt-the-bot-v1";

const ROUND_CONTEXT_BEFORE = 6;
const ROUND_CONTEXT_AFTER = 2;
const PREVIOUS_TARGET_MESSAGES = 5;

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
  const previousTargetMessages = [];

  for (const round of game.rounds) {
    const messages = round.messages ?? [];

    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const m = messages[messageIndex];
      if (m.player !== target) continue;

      const res = await analyzeMessage({
        playerId: target,
        round: round.round,
        message: buildContextualMessage({
          round,
          target,
          targetMessage: m,
          messageIndex,
          previousTargetMessages,
        }),
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

      previousTargetMessages.push({
        round: round.round,
        text: m.text,
        sent_at: m.sent_at ?? null,
      });
    }
  }

  return {
    game_id: game.game_id,
    suspected_player: target,
    ground_truth_is_bot: game.ground_truth_is_bot,
    detected_patterns: detectedPatterns,
  };
}

export function buildContextualMessage({
  round,
  target,
  targetMessage,
  messageIndex,
  previousTargetMessages = [],
}) {
  const messages = round.messages ?? [];
  const roundStart = firstTimestamp(messages);
  const contextStart = Math.max(0, messageIndex - ROUND_CONTEXT_BEFORE);
  const contextEnd = Math.min(messages.length, messageIndex + ROUND_CONTEXT_AFTER + 1);
  const roundContext = messages
    .slice(contextStart, contextEnd)
    .map((m, offset) => {
      const absoluteIndex = contextStart + offset;
      const marker = absoluteIndex === messageIndex ? "CURRENT" : "context";
      return `${marker}: ${formatMessageLine(m, target, roundStart)}`;
    })
    .join("\n");

  const previousLines = previousTargetMessages
    .slice(-PREVIOUS_TARGET_MESSAGES)
    .map((m) => `round ${m.round}: "${m.text}"`)
    .join("\n");

  return [
    `[MESSAGE UNDER REVIEW]`,
    `${target}: "${targetMessage.text}"`,
    ``,
    `[TIMING METADATA]`,
    formatTiming({ messages, targetMessage, messageIndex, previousTargetMessages }),
    ``,
    `[RECENT ROUND CHAT]`,
    roundContext || "(no chat context recorded)",
    ``,
    `[EARLIER MESSAGES BY SAME PLAYER]`,
    previousLines || "(none recorded)",
    ``,
    `[RECORDED ROUND VOTES]`,
    formatVotes(round.votes ?? []),
  ].join("\n");
}

function formatMessageLine(message, target, roundStart) {
  const playerTag = message.player === target ? `${message.player} (player under review)` : message.player;
  const time = formatRelativeTime(message.sent_at, roundStart);
  return `${time}${playerTag}: "${message.text}"`;
}

function formatTiming({ messages, targetMessage, messageIndex, previousTargetMessages }) {
  const lines = [`position_in_round_chat: ${messageIndex + 1}/${messages.length}`];
  const previousMessage = messages[messageIndex - 1];
  const sincePrevious = diffMs(targetMessage.sent_at, previousMessage?.sent_at);
  const previousTarget = previousTargetMessages[previousTargetMessages.length - 1];
  const sinceOwnPrevious = diffMs(targetMessage.sent_at, previousTarget?.sent_at);

  lines.push(`seconds_since_previous_chat_message: ${formatSeconds(sincePrevious)}`);
  lines.push(`seconds_since_same_player_previous_message: ${formatSeconds(sinceOwnPrevious)}`);
  return lines.join("\n");
}

function formatVotes(votes) {
  if (votes.length === 0) return "(no votes recorded)";
  return votes.map((v) => `${v.from} -> ${v.to}`).join("\n");
}

function diffMs(current, previous) {
  if (current == null || previous == null) return null;
  const delta = Number(current) - Number(previous);
  return Number.isFinite(delta) && delta >= 0 ? delta : null;
}

function formatSeconds(deltaMs) {
  return deltaMs == null ? "unknown" : (deltaMs / 1000).toFixed(1);
}

function firstTimestamp(messages) {
  for (const message of messages) {
    if (message.sent_at != null) return Number(message.sent_at);
  }
  return null;
}

function formatRelativeTime(sentAt, roundStart) {
  const delta = diffMs(sentAt, roundStart);
  return delta == null ? "" : `t+${formatSeconds(delta)}s `;
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
