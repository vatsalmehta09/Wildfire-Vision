# 📖 Wildfire Vision — Full Technical Documentation

> **Repo:** [github.com/vatsalmehta09/Wildfire-Vision](https://github.com/vatsalmehta09/Wildfire-Vision)  
> **Stack:** FastAPI · Facebook Prophet · Google Gemini AI · Next.js 15 · React 19 · Leaflet · Recharts

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Architecture & Data Flow](#3-architecture--data-flow)
4. [Backend Documentation](#4-backend-documentation)
   - [Setup & Running](#41-setup--running)
   - [Environment Variables](#42-environment-variables)
   - [Data Files](#43-data-files)
   - [API Endpoints](#44-api-endpoints)
   - [Model: Facebook Prophet](#45-model-facebook-prophet)
5. [Frontend Documentation](#5-frontend-documentation)
   - [Setup & Running](#51-setup--running)
   - [Pages](#52-pages)
   - [Components](#53-components)
   - [Lib / Utilities](#54-lib--utilities)
6. [AI Insights System](#6-ai-insights-system)
7. [Known Issues & Notes](#7-known-issues--notes)

---

## 1. Project Overview

**Wildfire Vision** is a full-stack platform that predicts and visualises wildfire activity across India using NASA MODIS satellite data (2018–2024). It combines:

| Layer | What it does |
|---|---|
| **Data** | NASA FIRMS MODIS fire detections — 7 years of daily India fire observations |
| **ML Model** | Facebook Prophet time-series model trained on daily median FRP (Fire Radiative Power) |
| **Backend API** | FastAPI server that serves historical data, model predictions, and streams Google Gemini AI analysis |
| **Frontend** | Next.js interactive dashboard with a Leaflet fire map, Recharts FRP charts, and a streaming AI insights panel |

**FRP (Fire Radiative Power)** is measured in megawatts (MW) and indicates the intensity of a fire. Higher FRP = more intense fire.

---

## 2. Repository Structure

```
wildfire-vision/
│
├── backend/                          # Python FastAPI backend
│   ├── wildfire_webapp.py            # ← Main API server (all endpoints)
│   ├── prophet_wildfire_model.joblib # ← Trained Prophet model (serialised)
│   ├── processed_daily_fire_data.csv # ← Pre-processed daily fire data
│   ├── model_training.ipynb          # ← Jupyter notebook: EDA + model training
│   ├── requirements.txt              # ← Python dependencies
│   └── .env.example                  # ← Environment variable template
│
├── frontend/                         # Next.js 15 frontend
│   ├── app/
│   │   ├── layout.tsx                # ← Root layout: header, footer, nav
│   │   ├── page.tsx                  # ← Home / Historical dashboard page
│   │   ├── globals.css               # ← Global styles
│   │   ├── historical/
│   │   │   └── page.tsx              # ← (Unused) Historical page stub
│   │   └── predictions/
│   │       ├── page.tsx              # ← 30-day Forecast page
│   │       ├── AIInsights.tsx        # ← Streaming AI analysis panel
│   │       └── insights-panel.tsx    # ← (Legacy) non-streaming insights panel
│   ├── components/
│   │   ├── fire-map.tsx              # ← Leaflet map wrapper (SSR-safe)
│   │   ├── frp-chart.tsx             # ← Bar/Line chart for FRP data
│   │   ├── prediction-chart.tsx      # ← Forecast chart with confidence bands
│   │   ├── input-controls.tsx        # ← Geographic + date filter form
│   │   ├── map-inner.tsx             # ← Actual Leaflet map (client-only)
│   │   ├── metrics-display.tsx       # ← MAE / MAPE metric cards
│   │   ├── theme-provider.tsx        # ← next-themes dark mode provider
│   │   └── ui/                       # ← shadcn/ui component library
│   ├── lib/
│   │   ├── fetchInsights.ts          # ← API calls: streaming + NDJSON helpers
│   │   ├── insights.ts               # ← Legacy non-streaming fetchInsights()
│   │   └── utils.ts                  # ← cn() class merge utility
│   ├── hooks/
│   │   ├── use-mobile.ts             # ← Responsive breakpoint hook
│   │   └── use-toast.ts              # ← Toast notification hook
│   ├── package.json
│   ├── next.config.mjs
│   └── tsconfig.json
│
├── .gitignore                        # ← Root-level, covers both Python + Node
└── README.md
```

---

## 3. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│                                                             │
│  ┌──────────────────┐     ┌──────────────────────────────┐  │
│  │  Home Page       │     │  Predictions Page            │  │
│  │  (app/page.tsx)  │     │  (app/predictions/page.tsx)  │  │
│  │                  │     │                              │  │
│  │  InputControls   │     │  Auto-loads on mount         │  │
│  │  FRPChart        │     │  PredictionChart             │  │
│  │  FireMap         │     │  FRPChart                    │  │
│  └────────┬─────────┘     │  FireMap                     │  │
│           │               │  AIInsights (streaming)      │  │
└───────────┼───────────────┴──────────────┬───────────────┘  │
            │                              │
            ▼ HTTP requests               ▼ HTTP requests
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend  (localhost:5000)               │
│                                                             │
│  /api/historical-monthly  ─── pandas resample → JSON        │
│  /api/historical-map      ─── pandas filter   → JSON        │
│  /api/past                ─── pandas filter   → JSON        │
│  /api/next-30-days        ─── Prophet predict → JSON        │
│  /api/predictions         ─── Prophet predict → JSON        │
│  /api/forecast            ─── Prophet predict → JSON        │
│  /api/insights            ─── Gemini AI       → JSON        │
│  /api/insights-stream ────────────────────────► SSE stream  │
│  /api/insights-progressive ───────────────────► NDJSON      │
│                                                             │
│  [prophet_wildfire_model.joblib]  ← loaded at startup       │
│  [processed_daily_fire_data.csv]  ← loaded at startup       │
│                                                             │
│  [Google Gemini 2.5 Flash]        ← external AI call       │
└─────────────────────────────────────────────────────────────┘
```

### Request Lifecycle (Historical Data)

1. User sets lat/lon bounds, year, optional month in `InputControls`
2. Clicks **"Load Historical Data"**
3. `page.tsx` calls `handleLoadHistorical()` which fires two parallel `fetch()` calls:
   - `/api/historical-monthly` or `/api/past` → FRP chart data
   - `/api/historical-map` → map dot locations
4. Backend queries `processed_daily_fire_data.csv` with pandas, returns JSON
5. Frontend formats dates and renders `FRPChart` + `FireMap`

### Request Lifecycle (30-Day Forecast)

1. `predictions/page.tsx` calls `loadForecast()` on mount
2. Fetches `/api/next-30-days`
3. Backend calls `model.make_future_dataframe(periods=365)` then `model.predict()`
4. Selects next 30 days after today, samples 80 historical hotspot locations
5. Returns `{ forecast: [...], locations: [...] }`
6. Frontend renders `PredictionChart`, `FRPChart`, `FireMap`
7. User clicks **Generate Insights** → `streamInsights()` POSTs to `/api/insights-stream`
8. Gemini response streams back chunk by chunk, rendered live in the `AIInsights` panel

---

## 4. Backend Documentation

### 4.1 Setup & Running

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

# Start server
uvicorn wildfire_webapp:app --reload --port 5000
```

- API available at: `http://localhost:5000`
- Interactive Swagger docs: `http://localhost:5000/docs`
- ReDoc: `http://localhost:5000/redoc`

---

### 4.2 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |

Copy `.env.example` → `.env` and fill in your key. The `.env` file is git-ignored and will never be committed.

---

### 4.3 Data Files

| File | Size | Description |
|---|---|---|
| `processed_daily_fire_data.csv` | ~202 KB | **Required at runtime.** Daily-aggregated fire data: `acq_date`, `latitude`, `longitude`, `frp` |
| `prophet_wildfire_model.joblib` | ~372 KB | **Required at runtime.** Serialised trained Prophet model |
| `model_training.ipynb` | ~245 KB | Jupyter notebook documenting data loading, cleaning, feature engineering, and Prophet training |

> Raw MODIS files (50–80 MB each) are excluded from the repo via `.gitignore`. Download from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) if you need to re-train.

#### `processed_daily_fire_data.csv` Schema

| Column | Type | Description |
|---|---|---|
| `acq_date` | `datetime` | Fire acquisition date (index after loading) |
| `latitude` | `float` | Latitude of fire detection |
| `longitude` | `float` | Longitude of fire detection |
| `frp` | `float` | Fire Radiative Power in megawatts (MW) |

---

### 4.4 API Endpoints

#### `GET /`
Health check. Returns status message and list of endpoints.

**Response:**
```json
{
  "message": "Wildfire Vision API — backend running.",
  "endpoints": ["/api/past", "/api/predictions"]
}
```

---

#### `GET /api/next-30-days`
Returns the next 30 days of Prophet forecast + a sample of historical hotspot locations for the map.

**Response:**
```json
{
  "forecast": [
    {
      "ds": "2025-07-29",
      "yhat": 32.14,
      "yhat_lower": 18.5,
      "yhat_upper": 45.8
    }
  ],
  "locations": [
    {
      "ds": "2024-03-15",
      "latitude": 23.74,
      "longitude": 86.32,
      "frp": 41.2
    }
  ]
}
```

> **Note:** `locations` are sampled from historical data (up to 80 points), not spatially predicted. They show *where* fires historically occurred.

---

#### `GET /api/past`
Returns actual historical FRP readings filtered by year and optional month.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `year` | `int` | ✅ | Year to filter (e.g. `2024`) |
| `month` | `int` | ❌ | Month to filter (1–12) |

**Response:**
```json
[
  {
    "ds": "2024-01-15",
    "latitude": 23.7,
    "longitude": 86.3,
    "frp": 289.1
  }
]
```

---

#### `GET /api/predictions`
Runs Prophet predictions for the same lat/lon/date combinations from the historical dataframe for a given year/month.

**Query Parameters:** Same as `/api/past` (`year`, `month`)

**Response:**
```json
[
  {
    "ds": "2025-12-01",
    "latitude": 18.47,
    "longitude": 74.21,
    "frp": 21.3
  }
]
```

> `frp` here is `yhat` from Prophet — the model's predicted FRP value.

---

#### `GET /api/forecast`
Returns a 30-day Prophet forecast + fire locations filtered by a geographic bounding box.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `min_lat` | `float` | ✅ | Southern boundary latitude |
| `max_lat` | `float` | ✅ | Northern boundary latitude |
| `min_lon` | `float` | ✅ | Western boundary longitude |
| `max_lon` | `float` | ✅ | Eastern boundary longitude |
| `year` | `int` | ✅ | Year for location sampling |
| `month` | `int` | ❌ | Optional month filter |

**Response:** Same shape as `/api/next-30-days`.

---

#### `GET /api/historical-monthly`
Returns monthly median FRP for a region + year. Used for the bar chart on the Home page when no specific month is selected.

**Query Parameters:** `year`, `min_lat`, `max_lat`, `min_lon`, `max_lon`

**Response:**
```json
[
  { "frp": 45.2, "month": 1, "month_name": "Jan" },
  { "frp": 61.8, "month": 2, "month_name": "Feb" }
]
```

---

#### `GET /api/historical-map`
Returns fire location points for a region/year/month, used to populate the Leaflet map dots.

**Query Parameters:** `year`, `min_lat`, `max_lat`, `min_lon`, `max_lon`, `month` (optional)

**Response:**
```json
[
  { "ds": "2024-05-12", "latitude": 22.4, "longitude": 88.3, "frp": 78.2 }
]
```

---

#### `POST /api/insights`
Non-streaming. Sends forecast + map data to Gemini and returns a complete AI analysis JSON object.

**Request Body:**
```json
{
  "forecast": [...],
  "map": [...],
  "region": "India"
}
```

**Response:**
```json
{
  "insights": "Based on the forecasted FRP data..."
}
```

---

#### `POST /api/insights-stream` ⭐ Primary AI endpoint
**Streaming.** Sends prompt to Gemini 2.5 Flash and streams back the response chunk by chunk as plain text. The frontend accumulates chunks, then parses the full text as a JSON object.

**Request Body:** Same as `/api/insights`

**Response:** `text/plain` stream. The streamed content is a JSON string:
```json
{
  "summary": "...",
  "trends": ["...", "..."],
  "high_risk_regions": ["..."],
  "prevention": ["..."],
  "post_fire_actions": ["..."],
  "recovery": ["..."]
}
```

---

#### `POST /api/insights-progressive`
**NDJSON stream.** Generates each insight section in a separate Gemini call and streams each section as a separate newline-delimited JSON object. Allows the UI to progressively render results section by section.

**Response:** `application/x-ndjson` — one JSON object per line:
```
{"summary": "..."}
{"trends": "..."}
{"high_risk_regions": "..."}
{"prevention": "..."}
{"post_fire_actions": "..."}
{"recovery": "..."}
{"done": true}
```

---

### 4.5 Model: Facebook Prophet

The model is a univariate time-series model trained on **daily median FRP** values for India (2018–2024).

- **Target variable (`y`):** Daily median FRP (MW)
- **Date column (`ds`):** Acquisition date
- **Seasonality:** Yearly (wildfire seasonality in India peaks March–May)
- **Serialisation:** Saved with `joblib.dump()` → `prophet_wildfire_model.joblib`
- **Loaded at:** Server startup (once, in global scope)

> The model predicts **national aggregate fire intensity** trends, not per-location FRP. Location data is sampled from historical records to populate the map.

---

## 5. Frontend Documentation

### 5.1 Setup & Running

```bash
cd frontend
npm install
npm run dev      # → http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
```

**Tech stack:**

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.0.3 | React framework with App Router |
| `react` | 19.2.0 | UI library |
| `react-leaflet` | 5.0.0-rc | Interactive fire map |
| `leaflet` | 1.9.4 | Map engine |
| `recharts` | latest | FRP + forecast charts |
| `tailwindcss` | 4.x | Utility CSS |
| `@radix-ui/*` | various | Accessible UI primitives (via shadcn/ui) |
| `react-markdown` | 10.x | Markdown rendering for AI output |
| `next-themes` | 0.4.6 | Dark mode support |

---

### 5.2 Pages

#### `app/layout.tsx` — Root Layout
Wraps every page. Contains:
- **Header**: sticky top bar with 🔥 logo, "Wildfire Vision" title, and navigation links (Home / Predictions)
- **Footer**: brand name + tagline
- **Dark mode**: `className="dark"` set on `<html>` — always dark
- **Analytics**: `@vercel/analytics` injected globally
- **Fonts**: `Inter` (body) + `Space_Mono` (code) loaded via `next/font/google`
- **`NavLink`**: highlights active route using `usePathname()`

> ⚠️ This file uses `'use client'` because of `usePathname`. This means `metadata` export won't work here — move to a server component if you need SEO metadata.

---

#### `app/page.tsx` — Home / Historical Dashboard
The main interactive page. Contains:

**State:**
| State | Type | Description |
|---|---|---|
| `isLoading` | `boolean` | Disables buttons while fetching |
| `historicalData` | `any[]` | FRP data for the chart |
| `historicalLocations` | `any[]` | Lat/lon points for the map |
| `predictionData` | `any[]` | Forecast data (currently mock) |
| `isMonthly` | `boolean` | Switches chart between bar/line |
| `metrics` | `{ mae, mape }` | Static model metrics shown when forecast is active |

**Key functions:**
- `handleLoadHistorical(params)` — fetches real data from `/api/historical-monthly` or `/api/past` + `/api/historical-map`
- `handleGenerateForecast(params)` — currently uses **mock data** (the real API call is commented out)

> **TODO in code:** The `handleGenerateForecast` real API call is commented out. The live forecast for the home page uses mock random data for now.

---

#### `app/predictions/page.tsx` — 30-Day Forecast Page
Auto-loads on mount. No user interaction needed — it immediately fetches from `/api/next-30-days`.

**Flow:**
1. `useEffect` → `loadForecast()` on mount
2. Fetches `/api/next-30-days`
3. Formats `dat.forecast` dates to `"Jul 29"` format
4. Renders `PredictionChart` → `FRPChart` → `FireMap` → `AIInsights`

---

### 5.3 Components

#### `components/input-controls.tsx` — Geographic & Time Filters

**Props:**
| Prop | Type | Description |
|---|---|---|
| `onLoadHistorical` | `(params: HistoricalParams) => void` | Called when "Load Historical Data" is clicked |
| `onGenerateForecast` | `(params: ForecastParams) => void` | Called when "Generate Forecast" is clicked (button currently hidden) |
| `isLoading` | `boolean` | Disables buttons while loading |

**Exported interfaces:**
```ts
interface HistoricalParams {
  minLatitude: number;   // Default: 7.97 (southern India)
  maxLatitude: number;   // Default: 37.12 (northern India)
  minLongitude: number;  // Default: 65.84 (western India)
  maxLongitude: number;  // Default: 97.54 (eastern India)
  year: number;          // Default: 2024
  month?: number;        // Optional. If omitted → monthly aggregate mode
}

type ForecastParams = HistoricalParams;
```

Default lat/lon bounds cover the entirety of India.

---

#### `components/fire-map.tsx` — Leaflet Map Wrapper

SSR-safe wrapper around `MapInner`. Uses Next.js `dynamic()` with `{ ssr: false }` to prevent Leaflet from running on the server (Leaflet requires `window`).

**Props:**
| Prop | Type | Description |
|---|---|---|
| `title` | `string` | Card heading |
| `locations` | `FireLocation[]` | Array of `{ latitude, longitude, frp }` |

Shows an empty state message if `locations` is empty or undefined.

---

#### `components/map-inner.tsx` — Leaflet Map (Client-Only)

The actual interactive map. Renders a Leaflet `MapContainer` with `CircleMarker` dots for each fire location.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `locations` | `FireLocation[]` | required | Fire points to render |
| `height` | `number` | `700` | Map container height in px |

**FRP Color scale:**

| FRP Range | Color | Label |
|---|---|---|
| ≥ 40 MW | 🔴 `#ff3333` | High intensity |
| 25–39 MW | 🟠 `#ff6633` | Medium intensity |
| 10–24 MW | 🟡 `#ffbb33` | Low intensity |
| < 10 MW | 🟡 `#ffee55` | Very low intensity |

**Marker size:** `Math.max(8, Math.sqrt(frp) * 2)` — scales with FRP intensity.

**Map center:** Auto-calculated as mean of all lat/lon points in `locations`.

**`ResizeFix`** component: Calls `map.invalidateSize()` after 200ms to fix tile misalignment that occurs when Leaflet renders inside a container that hasn't fully mounted yet.

---

#### `components/frp-chart.tsx` — FRP Bar/Line Chart

Dual-mode chart using Recharts. Automatically switches between `BarChart` (monthly aggregate) and `LineChart` (daily data) based on the `isMonthly` prop.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `data` | `any[]` | Must contain `{ date, frp }` (daily) or `{ date, medianFRP }` (monthly) |
| `title` | `string` | Card heading |
| `isMonthly` | `boolean` | `true` → BarChart with `medianFRP`, `false` → LineChart with `frp` |

Theming uses CSS variables (`var(--border)`, `var(--muted-foreground)`, `var(--chart-1)`) so it automatically adapts to dark mode.

---

#### `components/prediction-chart.tsx` — Forecast Confidence Band Chart

Renders a Prophet forecast with three lines:
- **Forecast** (`yhat`) — dashed orange line
- **Upper Bound** (`yhat_upper`) — thin grey dashed
- **Lower Bound** (`yhat_lower`) — thin grey dashed

**Props:**
| Prop | Type | Description |
|---|---|---|
| `data` | `any[]` | Must contain `{ ds, yhat, yhat_upper, yhat_lower }` |

> The `y` (actual) line is intentionally commented out since future predictions have no actual values.

---

#### `components/metrics-display.tsx` — Model Performance Cards

Displays MAE and MAPE in two side-by-side cards. Currently shows static values (`mae: 45.3`, `mape: 12.7`) set in `page.tsx` state.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `mae` | `number?` | Mean Absolute Error |
| `mape` | `number?` | Mean Absolute Percentage Error (%) |

---

#### `app/predictions/AIInsights.tsx` — Streaming AI Analysis Panel

The most complex component. Triggers a streaming call to `/api/insights-stream` and progressively renders the Gemini response.

**Props:**
```ts
interface AIInsightsProps {
  forecast: ForecastPoint[];   // { ds, yhat, yhat_lower, yhat_upper }
  locations: LocationPoint[];  // { ds, latitude, longitude, frp }
}
```

**States:**
| State | Description |
|---|---|
| `streaming` | `true` while Gemini is generating |
| `raw` | Accumulated raw text chunks (shown during streaming) |
| `data` | Parsed `InsightsData` object (shown after streaming completes) |

**Flow:**
1. User clicks **"Generate Insights"**
2. `generate()` calls `streamInsights()` from `lib/fetchInsights.ts`
3. Chunks arrive → appended to `raw` state → shown live with `▋` cursor
4. When stream ends → searches for `{` and `}` in accumulated text to extract JSON
5. Parses into `InsightsData` → renders tabbed UI

**Tabs:** Summary · Trends · High Risk · Prevention · Post-Fire · Recovery

---

### 5.4 Lib / Utilities

#### `lib/fetchInsights.ts`

**`streamInsights(forecast, locations, onChunk)`**
```ts
async function streamInsights(
  forecast: AnyRecord[],
  locations: AnyRecord[],
  onChunk: (text: string) => void
): Promise<string>
```
POSTs to `/api/insights-stream`. Reads the response body as a `ReadableStream`, calling `onChunk` for each decoded chunk. Returns the full accumulated text when the stream ends.

**`streamNDJSON(url, body, onObject)`**
```ts
async function streamNDJSON(
  url: string,
  body: AnyRecord,
  onObject: (obj: AnyRecord) => void
): Promise<void>
```
Handles newline-delimited JSON streams. Buffers incomplete lines and calls `onObject` for each complete parsed JSON line. Used with `/api/insights-progressive`.

---

#### `lib/insights.ts` (Legacy)
```ts
async function fetchInsights(forecast, map): Promise<string>
```
Non-streaming version. POSTs to `/api/insights` and returns the plain text `insights` field. Used by the legacy `insights-panel.tsx` component.

---

#### `lib/utils.ts`
```ts
function cn(...inputs: ClassValue[]): string
```
Merges Tailwind class names using `clsx` + `tailwind-merge`. Standard shadcn/ui utility.

---

## 6. AI Insights System

The AI system uses **Google Gemini 2.5 Flash** and is designed around three endpoints offering different UX tradeoffs:

| Endpoint | Method | Best for |
|---|---|---|
| `/api/insights` | Blocking JSON | Simple one-shot result |
| `/api/insights-stream` | SSE / text stream | Live typing effect (current UI) |
| `/api/insights-progressive` | NDJSON stream | Section-by-section progressive reveal |

### Gemini Prompt Structure (`/api/insights-stream`)
```
You are a wildfire risk analyst.

Based on this forecasted FRP data (next days): [first 15 forecast points]
And these hotspot locations: [first 20 location points]
The geographical focus is: India.

Return ONLY valid JSON in the following structure:
{
  "summary": "text",
  "trends": ["text"],
  "high_risk_regions": ["text"],
  "prevention": ["text"],
  "post_fire_actions": ["text"],
  "recovery": ["text"]
}

Rules:
- DO NOT write explanations outside JSON
- DO NOT include markdown or bullet symbols
- Arrays must contain strings only
```

### JSON Extraction Strategy
Because Gemini sometimes wraps JSON in markdown code fences (` ```json ... ``` `), the frontend uses a resilient extraction strategy:
```ts
const start = cleaned.indexOf("{");
const end = cleaned.lastIndexOf("}");
const jsonString = cleaned.slice(start, end + 1);
```
This skips any markdown prefix/suffix and extracts just the raw JSON object.

---

## 7. Known Issues & Notes

| Issue | Location | Detail |
|---|---|---|
| Forecast button hidden | `input-controls.tsx` L163–169 | The "Generate Forecast" button is commented out. The real API call in `handleGenerateForecast` is also commented out — it currently uses mock random data |
| Static metrics | `app/page.tsx` L84 | MAE (45.3) and MAPE (12.7%) are hardcoded. These should come from the model evaluation step in `model_training.ipynb` |
| Historical page unused | `app/historical/page.tsx` | Exists but is not linked from navigation (nav link is commented out in `layout.tsx` L64) |
| `layout.tsx` is client component | `app/layout.tsx` | Uses `'use client'` for `usePathname`. This prevents static `metadata` export from working. Consider extracting `NavLink` to its own client component and keeping layout as a server component for SEO |
| `insights-panel.tsx` legacy | `app/predictions/insights-panel.tsx` | Old non-streaming panel. Not rendered anywhere in the current app but kept for reference |
| Prophet spatial limitation | `backend/wildfire_webapp.py` | The model predicts national FRP trends only. Map dots are sampled from historical data, not spatially predicted |
| CORS wildcard | `backend/wildfire_webapp.py` L61 | `allow_origins=["*"]` — fine for development, should be restricted to your frontend domain in production |
