// lib/fetchInsights.ts

// =====================================
// Types
// =====================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/** A loosely-typed record whose values may be any JSON-serialisable value. */
type AnyRecord = Record<string, any>;

// =====================================
// Stream Insights (plain text stream)
// =====================================
/**
 * Streams plain-text AI insights from the backend for the given forecast and
 * location data, invoking a callback for every received chunk.
 *
 * @async
 * @param forecast - Array of forecast data records to analyse.
 * @param locations - Array of map/location records associated with the forecast.
 * @param onChunk - Callback invoked with each decoded text chunk as it arrives
 *   from the server-sent stream.
 * @returns Promise<string> Resolves with the full concatenated response text
 *   once the stream is exhausted.
 * @throws {Error} When the server response body is null (no stream returned).
 *
 * @example
 * ```typescript
 * const fullText = await streamInsights(forecastData, locationData, (chunk) => {
 *   console.log("Received chunk:", chunk);
 * });
 * console.log("Full response:", fullText);
 * ```
 */
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
/**
 * Streams a Newline-Delimited JSON (NDJSON) response from the given URL,
 * parsing each complete line as a JSON object and forwarding it to a callback.
 *
 * Incomplete lines that arrive mid-chunk are buffered until the next read so
 * that every object passed to `onObject` is fully formed.
 *
 * @async
 * @param url - The endpoint URL to POST the request to.
 * @param body - The JSON-serialisable request body to send.
 * @param onObject - Callback invoked with each successfully parsed JSON object
 *   from the NDJSON stream.
 * @returns Promise<void> Resolves when the stream ends.
 * @throws {Error} When the server response body is null (no stream returned).
 *
 * @example
 * ```typescript
 * await streamNDJSON(
 *   "http://localhost:5000/api/data-stream",
 *   { query: "wildfire" },
 *   (obj) => console.log("Parsed object:", obj)
 * );
 * ```
 */
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
