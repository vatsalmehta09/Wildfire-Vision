# 🔥 Wildfire Vision

An AI-powered wildfire prediction and analysis platform for India, using NASA MODIS satellite data, Facebook Prophet time-series forecasting, and Google Gemini AI for intelligent risk insights.

---

## 📸 Overview

This is a **monorepo** containing both the frontend and backend:

| Component | Tech Stack | Description |
|---|---|---|
| **Backend** | FastAPI + Prophet + Gemini AI | REST API serving wildfire forecasts, historical data, and AI-generated risk insights |
| **Frontend** | Next.js 15 + React 19 + Leaflet | Interactive dashboard with live maps, charts, and AI insights |

---

## 🏗️ Repository Structure

```
wildfire-vision/
├── backend/                       # Python FastAPI backend
│   ├── wildfire_webapp.py         # Main API server
│   ├── prophet_wildfire_model.joblib  # Trained Prophet model
│   ├── processed_daily_fire_data.csv  # Pre-processed fire data
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment variable template
│   └── model_training.ipynb       # Data exploration & model training
│
├── frontend/                      # Next.js frontend
│   ├── app/                       # Next.js App Router pages
│   ├── components/                # Reusable UI components
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and **npm**
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

---

### ⚙️ Backend Setup

```bash
# 1. Navigate to the backend folder
cd backend

# 2. (Recommended) Create and activate a virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Then open .env and replace the placeholder with your actual Gemini API key

# 5. Start the development server
uvicorn wildfire_webapp:app --reload --port 5000
```

The backend API will be available at **http://localhost:5000**

You can explore the interactive API docs at **http://localhost:5000/docs**

---

### 🖥️ Frontend Setup

```bash
# 1. Navigate to the frontend folder
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The frontend will be available at **http://localhost:3000**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/next-30-days` | 30-day fire activity forecast + hotspot locations |
| `GET` | `/api/past?year=&month=` | Historical fire data filtered by year/month |
| `GET` | `/api/predictions?year=&month=` | Prophet model predictions for a given period |
| `GET` | `/api/forecast` | Regional forecast with lat/lon bounding box |
| `GET` | `/api/historical-monthly` | Monthly median FRP for a selected region |
| `GET` | `/api/historical-map` | Historical fire map data with geographic filter |
| `POST` | `/api/insights` | AI risk analysis using Google Gemini |
| `POST` | `/api/insights-stream` | Streaming AI insights (Server-Sent Events) |
| `POST` | `/api/insights-progressive` | Progressive section-by-section AI analysis |

---

## 🗃️ Data Sources

- **[NASA FIRMS MODIS](https://firms.modaps.eosdis.nasa.gov/)** — Active fire detections via satellite
  - Data covers India, 2018–2024
  - Key attribute: **FRP** (Fire Radiative Power, in megawatts)

> **Note:** The raw MODIS CSV files are large (50–80 MB each) and are **not included in this repository**. Only `processed_daily_fire_data.csv` (the daily-aggregated output used by the API) is included. To re-train the model or work with raw data, download the MODIS data from the NASA FIRMS website.

---

## 🤖 AI Features

- **Risk Summary**: A natural language summary of fire risk for the next 30 days
- **Trend Analysis**: Key observations about FRP trends
- **High-Risk Region Identification**: States/regions most likely to be affected
- **Prevention Measures**: Actionable recommendations
- **Post-Fire Actions**: Emergency response guidance
- **Recovery Recommendations**: Long-term ecological and community recovery advice

Powered by **Google Gemini 2.5 Flash**.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key |

---

## 📄 License

This project is open source. Feel free to use it for educational and research purposes.

---

## 🙏 Acknowledgements

- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) for the MODIS fire data
- [Facebook Prophet](https://facebook.github.io/prophet/) for time-series forecasting
- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI insights
