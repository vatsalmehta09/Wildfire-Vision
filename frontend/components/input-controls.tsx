// components/input-controls.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface InputControlsProps {
  onLoadHistorical: (params: HistoricalParams) => void;
  onGenerateForecast: (params: ForecastParams) => void;
  isLoading: boolean;
}

export interface HistoricalParams {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  year: number;
  month?: number;
}

export interface ForecastParams extends HistoricalParams {}

export function InputControls({ onLoadHistorical, onGenerateForecast, isLoading }: InputControlsProps) {
  const [minLat, setMinLat] = useState(7.97);
  const [maxLat, setMaxLat] = useState(37.12);
  const [minLon, setMinLon] = useState(65.84);
  const [maxLon, setMaxLon] = useState(97.54);
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState<number | undefined>();

  const handleLoadHistorical = () => {
    onLoadHistorical({
      minLatitude: minLat,
      maxLatitude: maxLat,
      minLongitude: minLon,
      maxLongitude: maxLon,
      year,
      month: month || undefined,
    });
  };

  const handleGenerateForecast = () => {
    onGenerateForecast({
      minLatitude: minLat,
      maxLatitude: maxLat,
      minLongitude: minLon,
      maxLongitude: maxLon,
      year,
      month: month || undefined,
    });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

  return (
    <Card className="bg-card border-border p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-foreground mb-6">Geographic & Time Filters</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Geographic Filters */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Min Latitude
          </label>
          <input
            type="number"
            step="0.01"
            value={minLat}
            onChange={(e) => setMinLat(parseFloat(e.target.value))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Max Latitude
          </label>
          <input
            type="number"
            step="0.01"
            value={maxLat}
            onChange={(e) => setMaxLat(parseFloat(e.target.value))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Min Longitude
          </label>
          <input
            type="number"
            step="0.01"
            value={minLon}
            onChange={(e) => setMinLon(parseFloat(e.target.value))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Max Longitude
          </label>
          <input
            type="number"
            step="0.01"
            value={maxLon}
            onChange={(e) => setMaxLon(parseFloat(e.target.value))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Date Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Year
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Month (Optional)
          </label>
          <select
            value={month || ''}
            onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleLoadHistorical}
          disabled={isLoading}
          className="flex-1 w-fit bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md transition-colors"
        >
          {isLoading ? 'Loading...' : 'Load Historical Data'}
        </Button>
        {/* <Button
          onClick={handleGenerateForecast}
          disabled={isLoading}
          className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-medium py-2 rounded-md transition-colors"
        >
          {isLoading ? 'Generating...' : 'Generate Forecast'}
        </Button> */}
      </div>
    </Card>
  );
}
