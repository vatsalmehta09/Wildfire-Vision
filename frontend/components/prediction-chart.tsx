// components/prediction-chart.tsx

'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';

/**
 * Properties for the PredictionChart component.
 */
interface PredictionChartProps {
  /** Array of forecast data objects containing dates, predictions (yhat), and bounds. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
}

/**
 * Renders a line chart visualizing the Prophet forecast for Fire Radiative Power (FRP).
 * Displays the predicted values (`yhat`) alongside upper and lower confidence bounds.
 *
 * @param props - Component properties.
 * @returns JSX element containing the forecast chart.
 *
 * @example
 * ```tsx
 * <PredictionChart data={forecastData} />
 * ```
 */
export function PredictionChart({ data }: PredictionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Prediction vs Actual</h3>
        <div className="text-muted-foreground text-center py-8">No forecast data available</div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-foreground mb-4">Prediction</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {/* <XAxis dataKey="ds" stroke="var(--muted-foreground)" /> */}
          <XAxis
            dataKey="ds"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="var(--muted-foreground)" />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <Legend />
          {/* <Line type="monotone" dataKey="y" stroke="var(--chart-1)" name="Actual FRP" strokeWidth={2} /> */}
          <Line type="monotone" dataKey="yhat" stroke="var(--chart-2)" name="Forecast" strokeWidth={2} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="yhat_upper" stroke="var(--muted-foreground)" name="Upper Bound" strokeWidth={1} strokeDasharray="3 3" />
          <Line type="monotone" dataKey="yhat_lower" stroke="var(--muted-foreground)" name="Lower Bound" strokeWidth={1} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
