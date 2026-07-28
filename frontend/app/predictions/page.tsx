'use client';

import { useEffect, useState } from 'react';
import { PredictionChart } from '@/components/prediction-chart';
import { FRPChart } from '@/components/frp-chart';
import { FireMap } from '@/components/fire-map';
import { AIInsights } from './AIInsights';

export default function PredictionsPage() {
  const [data, setData] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/next-30-days");
      const dat = await res.json();

      // ----- Format forecast data for charts -----
      const formatted = dat.forecast.map((d: any) => ({
        ds: new Date(d.ds).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric"
        }),
        y: d.yhat,           // predicted FRP
        yhat: d.yhat,        // for prediction chart
        yhat_upper: d.yhat_upper,
        yhat_lower: d.yhat_lower
      }));

      setData(formatted);
      setLocations(dat.locations);

    } catch (err) {
      console.error("Prediction error:", err);
    }

    setIsLoading(false);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Next 30-Day Forecast
      </h1>

      {isLoading && (
        <div className="text-center text-muted-foreground py-8">
          Loading predictions...
        </div>
      )}

      {!isLoading && data.length > 0 && (
        <div className="space-y-8">
          
          {/* Top forecast chart */}
          <PredictionChart data={data} />

          {/* FRP chart */}
          <FRPChart
            data={data.map((d) => ({ date: d.ds, frp: d.y }))}
            title="Predicted Daily FRP"
            isMonthly={false}
          />

          {/* Fire map */}
          <FireMap title="Predicted Fire Hotspots" locations={locations} />

        </div>
      )}

      {!isLoading && data.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No forecast data available.
        </div>
      )}

      {data.length > 0 && (
        <AIInsights forecast={data} locations={locations} />
        )}

    </main>
  );
}
