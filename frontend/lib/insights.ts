// lib/insights.ts
// Legacy wrapper kept for backwards-compatibility with insights-panel.tsx
// New code should use streamInsights from @/lib/fetchInsights

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
