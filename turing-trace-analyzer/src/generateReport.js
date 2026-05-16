import { LABEL_DESCRIPTIONS, LABEL_HEADLINES } from "./labels.js";

const SEVERITY_TIERS = [
  { min: 4, label: "HIGH", verdict: "Strong indicators of AI-generated text and unnatural social behavior." },
  { min: 2, label: "MEDIUM", verdict: "Several patterns consistent with bot behavior." },
  { min: 1, label: "LOW", verdict: "One weak indicator. Not conclusive on its own." },
  { min: 0, label: "NONE", verdict: "No suspicious patterns detected by GLiNER2 zero-shot." },
];

export function generateReport(analyzedGame) {
  const grouped = groupByLabel(analyzedGame.detected_patterns);
  const severity = scoreSeverity(analyzedGame.detected_patterns.length);

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
    total_patterns: analyzedGame.detected_patterns.length,
    distinct_patterns: Object.keys(grouped).length,
    sections,
  };
}

export function renderReportText(report) {
  const header = `BOT DETECTION REPORT — ${report.suspected_player} (game ${report.game_id})`;
  const sev = `Severity: ${report.severity}   |   ${report.total_patterns} patterns, ${report.distinct_patterns} distinct`;

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

function scoreSeverity(count) {
  for (const tier of SEVERITY_TIERS) {
    if (count >= tier.min) return tier;
  }
  return SEVERITY_TIERS[SEVERITY_TIERS.length - 1];
}
