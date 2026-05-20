import { LABEL_DESCRIPTIONS, LABEL_HEADLINES } from "./labels.js";

const SEVERITY_TIERS = [
  { min: 2.2, label: "HIGH", verdict: "Strong normalized indicators of AI-generated text and unnatural social behavior." },
  { min: 1.15, label: "MEDIUM", verdict: "Several normalized signals are consistent with bot behavior." },
  { min: 0.35, label: "LOW", verdict: "Weak normalized signal. Not conclusive on its own." },
  { min: 0, label: "NONE", verdict: "No suspicious patterns detected by GLiNER2 zero-shot." },
];

export function generateReport(analyzedGame) {
  const patterns = analyzedGame.detected_patterns;
  const grouped = groupByLabel(patterns);
  const analyzedMessagesCount = analyzedGame.analyzed_messages_count ?? countMessagesWithPatterns(patterns);
  const suspiciousMessagesCount = countMessagesWithPatterns(patterns);
  const severityScore = scoreSeverity({
    patterns,
    grouped,
    analyzedMessagesCount,
    suspiciousMessagesCount,
  });
  const severity = severityTier(severityScore);

  const sections = Object.entries(grouped).map(([label, items]) => ({
    label,
    headline: LABEL_HEADLINES[label] ?? label,
    description: LABEL_DESCRIPTIONS[label] ?? "",
    occurrences: items.length,
    evidence: items.map((p) => ({ round: p.round, quote: p.evidence })),
  }));

  return {
    game_id: analyzedGame.game_id,
    suspected_player: analyzedGame.suspected_player,
    ground_truth_is_bot: analyzedGame.ground_truth_is_bot,
    severity: severity.label,
    verdict: severity.verdict,
    total_patterns: patterns.length,
    distinct_patterns: Object.keys(grouped).length,
    analyzed_messages_count: analyzedMessagesCount,
    suspicious_messages_count: suspiciousMessagesCount,
    severity_score: roundScore(severityScore),
    sections,
  };
}

export function renderReportText(report) {
  const header = `BOT DETECTION REPORT — ${report.suspected_player} (game ${report.game_id})`;
  const sev = [
    `Severity: ${report.severity}`,
    `${report.total_patterns} patterns`,
    `${report.distinct_patterns} distinct`,
    `${report.suspicious_messages_count ?? "?"}/${report.analyzed_messages_count ?? "?"} messages flagged`,
    `score ${report.severity_score ?? "n/a"}`,
  ].join("   |   ");

  const body =
    report.sections.length === 0
      ? "  (no suspicious patterns surfaced)"
      : report.sections
          .map((s) => {
            const evidence = s.evidence
              .map((e) => `    - r${e.round}: "${e.quote}"`)
              .join("\n");
            const count = s.occurrences > 1 ? ` (x${s.occurrences})` : "";
            return `  • ${s.headline}${count}\n${evidence}`;
          })
          .join("\n\n");

  return [
    "=".repeat(header.length),
    header,
    sev,
    "=".repeat(header.length),
    "",
    body,
    "",
    `Verdict: ${report.verdict}`,
  ].join("\n");
}

function groupByLabel(patterns) {
  const map = {};
  for (const p of patterns) {
    if (!map[p.label]) map[p.label] = [];
    map[p.label].push(p);
  }
  return map;
}

function scoreSeverity({ patterns, grouped, analyzedMessagesCount, suspiciousMessagesCount }) {
  if (patterns.length === 0 || analyzedMessagesCount === 0) return 0;

  const weightedPatternCount = patterns.reduce((sum, p) => sum + confidenceWeight(p.confidence), 0);
  const flaggedMessageRate = suspiciousMessagesCount / analyzedMessagesCount;
  const weightedPatternRate = weightedPatternCount / analyzedMessagesCount;
  const distinctCount = Object.keys(grouped).length;
  const diversityRatio = distinctCount / patterns.length;
  const diversityBonus = Math.min(distinctCount, 4) * 0.22;
  const repetitionPenalty = 0.55 + 0.45 * diversityRatio;
  const rawScore = ((flaggedMessageRate * 1.45) + (weightedPatternRate * 1.05) + diversityBonus) * repetitionPenalty;

  if (patterns.length === 1) return Math.min(rawScore, 0.75);
  if (distinctCount === 1) return Math.min(rawScore, 1.1);
  return rawScore;
}

function severityTier(score) {
  for (const tier of SEVERITY_TIERS) {
    if (score >= tier.min) return tier;
  }
  return SEVERITY_TIERS[SEVERITY_TIERS.length - 1];
}

function confidenceWeight(confidence) {
  if (confidence == null) return 0.75;
  const value = Number(confidence);
  if (!Number.isFinite(value)) return 0.75;
  return Math.min(Math.max(value, 0), 1);
}

function countMessagesWithPatterns(patterns) {
  const keys = new Set(patterns.map((p) => `${p.round}:${p.evidence}`));
  return keys.size;
}

function roundScore(score) {
  return Math.round(score * 100) / 100;
}
