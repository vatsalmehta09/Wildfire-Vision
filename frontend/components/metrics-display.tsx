// components/metrics-display.tsx

'use client';

import { Card } from '@/components/ui/card';

interface MetricsDisplayProps {
  mae?: number;
  mape?: number;
}

export function MetricsDisplay({ mae, mape }: MetricsDisplayProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-card border-border p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Mean Absolute Error</p>
            <p className="text-3xl font-bold text-primary mt-2">
              {mae !== undefined ? mae.toFixed(2) : '—'}
            </p>
          </div>
          <div className="text-4xl text-primary opacity-20">📊</div>
        </div>
      </Card>

      <Card className="bg-card border-border p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Mean Absolute Percentage Error</p>
            <p className="text-3xl font-bold text-accent mt-2">
              {mape !== undefined ? mape.toFixed(2) : '—'}%
            </p>
          </div>
          <div className="text-4xl text-accent opacity-20">📈</div>
        </div>
      </Card>
    </div>
  );
}
