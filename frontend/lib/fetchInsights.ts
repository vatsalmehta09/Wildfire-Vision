// lib/fetchInsights.ts

// =====================================
// Types
// =====================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// =====================================
// Stream Insights (plain text stream)
// =====================================
export async function streamInsights(
  forecast: AnyRecord[],
  locations: AnyRecord[],
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch("http://localhost:5000/api/insights-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      forecast,
      map: locations,
      region: "India" // optional hint
    }),
  });

  if (!res.body) {
    throw new Error("Response body is null — server did not return a stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    fullText += chunk;
    onChunk(chunk); // send partial chunk to UI
  }

  return fullText; // IMPORTANT
}

// =====================================
// Stream NDJSON (newline-delimited JSON stream)
// =====================================
export async function streamNDJSON(
  url: string,
  body: AnyRecord,
  onObject: (obj: AnyRecord) => void
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.body) {
    throw new Error("Response body is null — server did not return a stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep unfinished chunk

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as AnyRecord;
        onObject(obj);
      } catch (e) {
        console.warn("Skipping bad NDJSON chunk:", line);
      }
    }
  }
}
