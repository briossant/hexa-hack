import type { GameAnalysisResponse } from '@hexa-hack/shared';

const DEFAULT_ANALYZER_URL = 'http://localhost:3002';
const ANALYZER_TIMEOUT_MS = parseInt(process.env.ANALYZER_TIMEOUT_MS ?? '', 10) || 120_000;

function getAnalyzerUrl(gameId: string): string {
  const baseUrl = (process.env.ANALYZER_URL ?? DEFAULT_ANALYZER_URL).replace(/\/+$/, '');
  const url = new URL(`analyze/${encodeURIComponent(gameId)}`, `${baseUrl}/`);
  const model = process.env.ANALYZER_MODEL?.trim();

  if (model) {
    url.searchParams.set('model', model);
  }

  return url.toString();
}

export async function analyzeCompletedGame(gameId: string): Promise<GameAnalysisResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZER_TIMEOUT_MS);

  try {
    const response = await fetch(getAnalyzerUrl(gameId), {
      method: 'POST',
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const detail = body ? `: ${body.slice(0, 300)}` : '';
      throw new Error(`analyzer responded ${response.status}${detail}`);
    }

    return (await response.json()) as GameAnalysisResponse;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`analyzer timed out after ${ANALYZER_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
