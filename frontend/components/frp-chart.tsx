// components/frp-chart.tsx

'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';

/**
 * Properties for the FRPChart component.
 */
interface FRPChartProps {
  /** Array of data objects to plot (daily or monthly). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  /** Heading displayed above the chart. */
  title: string;
  /** Flag indicating if data is monthly (renders BarChart) or daily (renders LineChart). */
  isMonthly: boolean;
}

/**
 * Renders a chart visualizing Fire Radiative Power (FRP) over time.
 * Uses a BarChart for monthly aggregates and a LineChart for daily data.
 *
 * @param props - Component properties.
 * @returns JSX element containing the Recharts chart inside a Card.
 *
 * @example
 * ```tsx
 * <FRPChart data={chartData} title="Monthly FRP Trends" isMonthly={true} />
 * ```
 */
export function FRPChart({ data, title, isMonthly }: FRPChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
        <div className="text-muted-foreground text-center py-8">No data available</div>
      </Card>
    );
  }

  const ChartComponent = isMonthly ? BarChart : LineChart;

  return (
    <Card className="bg-card border-border p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="date"
            tickFormatter={(v) => v.replace("2024-", "")} // "05-18"
            stroke="var(--muted-foreground)" 
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
          {isMonthly ? (
            <Bar dataKey="medianFRP" fill="var(--chart-1)" name="Median FRP" />
          ) : (
            <Line type="monotone" dataKey="frp" stroke="var(--chart-1)" name="Daily FRP" strokeWidth={2} />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </Card>
  );
}
