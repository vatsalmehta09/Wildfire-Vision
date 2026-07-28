// lib/insights.ts
// Legacy wrapper kept for backwards-compatibility with insights-panel.tsx
// New code should use streamInsights from @/lib/fetchInsights

/**
 * Fetches AI-generated wildfire insights from the backend using a single
 * blocking HTTP request (non-streaming).
 *
 * @deprecated Use {@link streamInsights} from `@/lib/fetchInsights` for new
 *   code — it provides real-time streaming and better UX.
 *
 * @async
 * @param forecast - Array of forecast data records to analyse.
 * @param map - Array of map/location records associated with the forecast.
 * @returns Promise<string> Resolves with the insights text returned by the
 *   server, or the error message if the server reports one, or a fallback
 *   string `"No response from server."` when both fields are absent.
 *
 * @example
 * ```typescript
 * const insights = await fetchInsights(forecastData, mapData);
 * console.log(insights);
 * ```
 */
export async function fetchInsights(
  forecast: Record<string, unknown>[],
  map: Record<string, unknown>[]
): Promise<string> {
  const res = await fetch("http://localhost:5000/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forecast, map }),
  });

  const data = await res.json() as { insights?: string; error?: string };
  return data.insights ?? data.error ?? "No response from server.";
}
