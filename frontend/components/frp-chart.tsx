// components/frp-chart.tsx

'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';

interface FRPChartProps {
  data: any[];
  title: string;
  isMonthly: boolean;
}

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
