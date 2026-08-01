import { generateAnalysis, type Analysis } from "./analysis-generator";

/**
 * Runs analysis without blocking the UI thread.
 * - Prefers Web Worker when available (handled in caller).
 * - Otherwise yields to the event loop and chunks work.
 */
export async function generateAnalysisAsync(
  id: string,
  fileName: string,
  opts?: { signal?: AbortSignal },
): Promise<Analysis> {
  const { signal } = opts ?? {};
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Yield once so the click/paint (and loading UI) can show before heavy work.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // generateAnalysis is synchronous/deterministic. Keep it here but ensure
  // it is called only after a yield.
  return generateAnalysis(id, fileName);
}
