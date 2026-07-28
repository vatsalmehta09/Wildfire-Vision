'use client';

import { useState } from "react";
import { fetchInsights } from "@/lib/insights";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function InsightsPanel({ forecast, map }: any) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await fetchInsights(forecast, map);
    setText(result);
    setLoading(false);
  };

  return (
    <Card className="bg-card border-border p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        AI Insights & Preventive Measures
      </h3>

      <Button 
        className="mb-4"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? "Analyzing..." : "Generate Insights"}
      </Button>

      {text && (
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-black/10 p-3 rounded-md mt-2">
          {text}
        </pre>
      )}
    </Card>
  );
}
