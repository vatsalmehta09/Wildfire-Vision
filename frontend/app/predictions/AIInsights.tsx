"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { streamInsights } from "@/lib/fetchInsights";

// =====================================
// Types
// =====================================
interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

interface LocationPoint {
  ds: string;
  latitude: number;
  longitude: number;
  frp: number;
}

interface InsightsData {
  summary?: string;
  trends?: string[];
  high_risk_regions?: string[];
  prevention?: string[];
  post_fire_actions?: string[];
  recovery?: string[];
}

interface AIInsightsProps {
  forecast: ForecastPoint[];
  locations: LocationPoint[];
}

interface SectionProps {
  title: string;
  body: string | undefined;
}

interface ListSectionProps {
  title: string;
  items: string[] | undefined;
}

// =====================================
// Main Component
// =====================================
export function AIInsights({ forecast, locations }: AIInsightsProps) {
  const [streaming, setStreaming] = useState(false);
  const [raw, setRaw] = useState("");
  const [data, setData] = useState<InsightsData | null>(null);

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
