// app/page.tsx

'use client';

import { useState } from 'react';
import { InputControls, HistoricalParams, ForecastParams } from '@/components/input-controls';
import { FRPChart } from '@/components/frp-chart';
import { PredictionChart } from '@/components/prediction-chart';
import { FireMap } from '@/components/fire-map';
import { MetricsDisplay } from '@/components/metrics-display';

/**
 * Generates mock daily historical FRP data for demonstration purposes.
 *
 * @param params - Contains bounds and year.
 * @returns Array of 30 mock daily FRP records.
 */
const generateMockHistoricalData = (params: HistoricalParams) => {
  const days = 30;
  const data = [];
  for (let i = 0; i < days; i++) {
    data.push({
      date: `Day ${i + 1}`,
      frp: Math.random() * 150 + 20,
    });
  }
  return data;
};

/**
 * Generates mock monthly historical FRP data for demonstration purposes.
 *
 * @param params - Contains bounds and year.
 * @returns Array of 12 mock monthly FRP records.
 */
const generateMockMonthlyData = (params: HistoricalParams) => {
  const months = 12;
  const data = [];
  for (let i = 0; i < months; i++) {
    data.push({
      date: new Date(0, i).toLocaleString('default', { month: 'short' }),
      medianFRP: Math.random() * 100 + 30,
    });
  }
  return data;
};

/**
 * Generates mock Prophet forecast data for demonstration purposes.
 *
 * @returns Array of 60 mock prediction records with bounds.
 */
const generateMockPredictionData = () => {
  const days = 60;
  const data = [];
  let actualBase = 50;
  let forecastBase = 50;
  
  for (let i = 0; i < days; i++) {
    const actual = actualBase + (Math.random() - 0.5) * 40;
    const forecast = forecastBase + (Math.random() - 0.5) * 50;
    
    data.push({
      ds: `Day ${i + 1}`,
      y: Math.max(0, actual),
      yhat: Math.max(0, forecast),
      yhat_upper: Math.max(0, forecast + 30),
      yhat_lower: Math.max(0, forecast - 30),
    });

    actualBase += (Math.random() - 0.5) * 10;
    forecastBase += (Math.random() - 0.5) * 15;
  }
  
  return data;
};

/**
 * Generates mock fire locations bounded within the specified coordinates.
 *
 * @param params - Contains geographic boundaries.
 * @returns Array of randomly generated mock fire points.
 */
const generateMockFireLocations = (params: HistoricalParams) => {
  const locations = [];
  const count = Math.random() * 20 + 10;
  
  for (let i = 0; i < count; i++) {
    locations.push({
      latitude: Math.random() * (params.maxLatitude - params.minLatitude) + params.minLatitude,
      longitude: Math.random() * (params.maxLongitude - params.minLongitude) + params.minLongitude,
      frp: Math.random() * 250 + 20,
    });
  }
  
  return locations;
};

/**
 * The main Dashboard component representing the root page (/).
 * Manages the state for historical analysis and forecasting, fetching data
 * from the FastAPI backend and distributing it to charting and map components.
 *
 * @returns JSX element containing the full dashboard UI.
 */
export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historicalLocations, setHistoricalLocations] = useState<any[]>([]);
  const [predictionData, setPredictionData] = useState<any[]>([]);
  const [predictionLocations, setPredictionLocations] = useState<any[]>([]);
  const [isMonthly, setIsMonthly] = useState(false);
  const [metrics, setMetrics] = useState({ mae: 45.3, mape: 12.7 });

  // const handleLoadHistorical = (params: HistoricalParams) => {
  //   setIsLoading(true);
    
  //   // Simulate API call
  //   setTimeout(() => {
  //     const hasMonth = params.month !== undefined;
  //     const data = hasMonth ? generateMockHistoricalData(params) : generateMockMonthlyData(params);
  //     const locations = generateMockFireLocations(params);
      
  //     setHistoricalData(data);
  //     setHistoricalLocations(locations);
  //     setIsMonthly(!hasMonth);
  //     setPredictionData([]);
  //     setPredictionLocations([]);
  //     setIsLoading(false);
  //   }, 800);
  // };

  /**
   * Fetches historical data (either daily or monthly depending on `params.month`)
   * and fire hotspot locations from the backend, then updates component state.
   *
   * @param params - Geographic and temporal boundaries for the historical query.
   */
  const handleLoadHistorical = async (params: HistoricalParams) => {
    setIsLoading(true);

    try {
      const qs = `year=${params.year}&min_lat=${params.minLatitude}&max_lat=${params.maxLatitude}&min_lon=${params.minLongitude}&max_lon=${params.maxLongitude}${params.month ? `&month=${params.month}` : ""}`;

      // 1) Monthly or daily FRP data
      const frpUrl = params.month
        ? `http://localhost:5000/api/past?${qs}`
        : `http://localhost:5000/api/historical-monthly?${qs}`;

      const frpRes = await fetch(frpUrl);
      const frpData = await frpRes.json();

      // setHistoricalData(frpData);
      // setIsMonthly(!params.month);

      if (!params.month) {
        const formatted = frpData.map((d: any) => ({
          date: d.month_name,
          medianFRP: d.frp,
        }));
        setHistoricalData(formatted);
        setIsMonthly(true);
      } else {
        // daily mode
        const formatted = frpData.map((d: any) => ({
          date: new Date(d.ds).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          }),
          frp: d.frp,
        }));
        setHistoricalData(formatted);
        setIsMonthly(false);
      }


      // 2) Fire map locations
      const mapRes = await fetch(`http://localhost:5000/api/historical-map?${qs}`);
      const mapData = await mapRes.json();

      setHistoricalLocations(mapData);

      // Clear prediction section
      setPredictionData([]);
      setPredictionLocations([]);

    } catch (error) {
      console.error("Error loading historical data:", error);
    }

    setIsLoading(false);
  };

  /**
   * Fetches the predicted forecast and locations, simulating a delay, and
   * sets the resulting data to state. (Currently uses mock data).
   *
   * @param params - Geographic and temporal boundaries for the forecast query.
   */
  const handleGenerateForecast = (params: ForecastParams) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const data = generateMockPredictionData();
      const locations = generateMockFireLocations(params);
      
      setPredictionData(data);
      setPredictionLocations(locations);
      setIsLoading(false);
    }, 1000);
  };

  // const handleGenerateForecast = async (params: ForecastParams) => {
  // setIsLoading(true);

  // try {
  //   const qs =
  //     `min_lat=${params.minLatitude}&max_lat=${params.maxLatitude}` +
  //     `&min_lon=${params.minLongitude}&max_lon=${params.maxLongitude}` +
  //     `&year=${params.year}` +
  //     `${params.month ? `&month=${params.month}` : ""}`;

  //   const res = await fetch(`http://localhost:5000/api/forecast?${qs}`);
  //   const data = await res.json();

  //   // format forecast
  //   const formattedForecast = data.forecast.map((d: any) => ({
  //     ds: new Date(d.ds).toLocaleDateString("en-US", {
  //       month: "short",
  //       day: "numeric",
  //     }),
  //     y: d.yhat,                 // Prophet future has no actuals
  //     yhat: d.yhat,
  //     yhat_lower: d.yhat_lower,
  //     yhat_upper: d.yhat_upper,
  //   }));

  //   setPredictionData(formattedForecast);
  //   setPredictionLocations(data.locations);

  //   } catch (error) {
  //     console.error("Forecast loading error:", error);
  //   }

  //   setIsLoading(false);
  // };


  return (
    <>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Input Controls */}
        <InputControls 
          onLoadHistorical={handleLoadHistorical}
          onGenerateForecast={handleGenerateForecast}
          isLoading={isLoading}
        />

        {/* Results Section */}
        {(historicalData.length > 0 || predictionData.length > 0) && (
          <div className="mt-8 space-y-8">
            {/* Model Performance Metrics */}
            {predictionData.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Model Performance</h2>
                <MetricsDisplay mae={metrics.mae} mape={metrics.mape} />
              </div>
            )}

            {/* Historical Data Section */}
            {historicalData.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Historical Analysis</h2>
                <FRPChart 
                  data={historicalData}
                  title={isMonthly ? "Monthly Median FRP" : "Daily Fire Radiative Power"}
                  isMonthly={isMonthly}
                />
                <FireMap 
                  title="Intense Fires Map (FRP ≥ 100)"
                  // locations={historicalLocations.filter(l => l.frp >= 100)}
                  locations={historicalLocations}
                />
              </div>
            )}

            {/* Forecast Data Section */}
            {predictionData.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Forecast Analysis</h2>
                <PredictionChart data={predictionData} />
                <FireMap 
                  title="Predicted Fires Map"
                  locations={predictionLocations}
                />
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {historicalData.length === 0 && predictionData.length === 0 && (
          <div className="mt-16 text-center">
            <div className="text-6xl mb-4 opacity-50">📍</div>
            <p className="text-lg text-muted-foreground">
              Select your parameters and click "Load Historical Data" or "Generate Forecast" to begin
            </p>
          </div>
        )}
      </main>
    </>
  );
}
