"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { streamInsights } from "@/lib/fetchInsights";

// =====================================
// Types
// =====================================
/** A single day's Prophet forecast output. */
interface ForecastPoint {
  /** ISO date string for the forecast day. */
  ds: string;
  /** Predicted FRP value (yhat). */
  yhat: number;
  /** Lower bound of the 80 % confidence interval. */
  yhat_lower: number;
  /** Upper bound of the 80 % confidence interval. */
  yhat_upper: number;
}

/** A fire hotspot location returned by the forecast API. */
interface LocationPoint {
  /** ISO date string associated with the detected fire event. */
  ds: string;
  /** Geographic latitude of the fire hotspot. */
  latitude: number;
  /** Geographic longitude of the fire hotspot. */
  longitude: number;
  /** Fire Radiative Power (MW) at this location. */
  frp: number;
}

/** Structured AI-generated wildfire insights parsed from the streamed LLM response. */
interface InsightsData {
  /** Narrative overview of the forecast period. */
  summary?: string;
  /** List of key fire behaviour trends observed in the forecast. */
  trends?: string[];
  /** Geographic regions with elevated fire risk. */
  high_risk_regions?: string[];
  /** Recommended preventive actions before fires occur. */
  prevention?: string[];
  /** Mitigation steps to take immediately after a fire event. */
  post_fire_actions?: string[];
  /** Long-term strategies for ecosystem and community recovery. */
  recovery?: string[];
}

/** Props for the {@link AIInsights} component. */
interface AIInsightsProps {
  /** Array of 30-day Prophet forecast points to send to the AI model. */
  forecast: ForecastPoint[];
  /** Array of predicted fire hotspot locations to include in the AI prompt. */
  locations: LocationPoint[];
}

/** Props for the {@link Section} helper component. */
interface SectionProps {
  /** Heading text displayed above the body paragraph. */
  title: string;
  /** Body text content; falls back to "No data available" when undefined. */
  body: string | undefined;
}

/** Props for the {@link ListSection} helper component. */
interface ListSectionProps {
  /** Heading text displayed above the bullet list. */
  title: string;
  /** Array of list item strings; renders a fallback message when empty or undefined. */
  items: string[] | undefined;
}

// =====================================
// Main Component
// =====================================
/**
 * Displays AI-generated wildfire insights derived from forecast and location data.
 *
 * In its initial state the component shows a raw streaming text preview while
 * the LLM response is being received. Once the full JSON payload is parsed it
 * switches to a tabbed card layout with sections for summary, trends, high-risk
 * regions, prevention, post-fire actions, and recovery strategies.
 *
 * @param props - {@link AIInsightsProps} containing forecast points and fire locations.
 * @returns A card JSX element showing either the streaming preview or tabbed insights.
 */
export function AIInsights({ forecast, locations }: AIInsightsProps) {
  const [streaming, setStreaming] = useState(false);
  const [raw, setRaw] = useState("");
  const [data, setData] = useState<InsightsData | null>(null);

  /**
   * Streams AI-generated insights from the backend, accumulating raw text chunks
   * as they arrive, then parses the complete response as JSON and stores the
   * structured {@link InsightsData} in component state.
   */
  const generate = async () => {
    setStreaming(true);
    setRaw("");
    setData(null);

    const text = await streamInsights(forecast, locations, (chunk) => {
      setRaw((prev) => prev + chunk);
    });

    try {
      const cleaned = text.trim();

      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");

      if (start === -1 || end === -1) {
        throw new Error("No JSON object found in stream");
      }

      const jsonString = cleaned.slice(start, end + 1);

      const parsed: InsightsData = JSON.parse(jsonString);

      setData(parsed);
    } catch (e) {
      console.warn("Failed to parse streamed JSON", e, "RAW:", text);
    }

    setStreaming(false);
  };
  

  // ======================
  // 1) NO DATA YET
  // ======================
  if (!data) {
    return (
      <Card className="bg-card mt-8 border border-border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">AI Insights</h3>

          <Button onClick={generate} disabled={streaming}>
            {streaming ? "Analyzing..." : "Generate Insights"}
          </Button>
        </div>

        <pre className="text-sm text-muted-foreground bg-muted p-4 rounded-md min-h-[150px] overflow-y-auto whitespace-pre-wrap font-mono">
          {streaming ? raw + "▋" : "Click Generate to start"}
        </pre>
      </Card>
    );
  }

  // ======================
  // 2) DATA AVAILABLE
  // ======================
  return (
    <Card className="bg-card mt-8 border border-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">AI Insights</h3>

        <Button onClick={generate} disabled={streaming}>
          {streaming ? "Updating..." : "Regenerate"}
        </Button>
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="grid grid-cols-6 gap-2 mb-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="risk">High Risk</TabsTrigger>
          <TabsTrigger value="prevention">Prevention</TabsTrigger>
          <TabsTrigger value="post">Post-Fire</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Section title="Summary" body={data.summary} />
        </TabsContent>

        <TabsContent value="trends">
          <ListSection title="Key Trends" items={data.trends} />
        </TabsContent>

        <TabsContent value="risk">
          <ListSection title="Regions at High Risk" items={data.high_risk_regions} />
        </TabsContent>

        <TabsContent value="prevention">
          <ListSection title="Immediate Preventive Measures" items={data.prevention} />
        </TabsContent>

        <TabsContent value="post">
          <ListSection title="Post-Fire Control & Mitigation" items={data.post_fire_actions} />
        </TabsContent>

        <TabsContent value="recovery">
          <ListSection title="Long-Term Recovery Strategies" items={data.recovery} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// =====================================
// Helper Components
// =====================================

/**
 * Renders a titled paragraph section for plain-text AI insight content.
 *
 * @param props - {@link SectionProps} with a title and optional body text.
 * @returns A `<div>` containing a heading and a paragraph.
 */
function Section({ title, body }: SectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {body || "No data available"}
      </p>
    </div>
  );
}

/**
 * Renders a titled bullet list for AI insight content that consists of multiple
 * items. Falls back to a plain {@link Section} when `items` is empty or undefined.
 *
 * @param props - {@link ListSectionProps} with a title and an optional items array.
 * @returns A `<div>` containing a heading and a `<ul>` bullet list, or a
 *   {@link Section} fallback.
 */
function ListSection({ title, items }: ListSectionProps) {
  if (!items || !items.length) {
    return <Section title={title} body="No data available" />;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-lg font-semibold">{title}</h4>
      <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
        {items.map((i: string, idx: number) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
