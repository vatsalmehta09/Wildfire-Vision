"""
FASTAPI BACKEND FOR WILDFIRE PREDICTIONS
========================================
This backend uses:
  - Your saved Prophet model: prophet_wildfire_model.joblib
  - Your processed dataframe: processed_daily_fire_data.csv (daily median data)
  - FastAPI + pandas
  - Two endpoints:
        /api/past?year=2024&month=1
        /api/predictions?year=2025&month=12
  - Both endpoints return lat, lon, frp (historic or predicted)

How the backend works
---------------------
1. Loads trained Prophet model ONCE at server startup.
2. Loads your processed dataframe (daily aggregate with lat/long + FRP).
3. For prediction endpoint: 
       - Takes the same lat/long positions from the filtered dataframe
       - Builds Prophet `future` df with the filtered dates
       - Calls model.predict()
       - Merges yhat with lat/long

Run command:
    uvicorn server:app --reload --port 5000

Make sure these files exist in the same folder:
    prophet_wildfire_model.joblib
    processed_daily_fire_data.csv

"""

from fastapi.responses import StreamingResponse
import pandas as pd
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from joblib import load
from fastapi import Query
from datetime import datetime, timedelta
from google import genai
import os
from dotenv import load_dotenv
import json

# ------------------------------
# FASTAPI INITIALIZATION
# ------------------------------
app = FastAPI()

load_dotenv()  # load from .env

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Missing GEMINI_API_KEY environment variable")

client = genai.Client(api_key=api_key)

# Allow CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# LOAD MODEL + DATAFRAME
# ------------------------------
print("Loading Prophet model…")
model = load("prophet_wildfire_model.joblib")
print("Model loaded.")

print("Loading processed dataframe…")
df = pd.read_csv("processed_daily_fire_data.csv", parse_dates=["acq_date"])
df.set_index("acq_date", inplace=True)
print("Dataframe loaded.")

# Ensure numeric correctness
numeric_cols = ["latitude", "longitude", "frp"]
for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")


# ------------------------------
# HELPER — Filter by year/month
# ------------------------------
def filter_df(year: int, month: int | None = None):
    df_f = df[df.index.year == year]
    if month:
        df_f = df_f[df_f.index.month == month]
    return df_f.dropna(subset=["latitude", "longitude"]).copy()


@app.get("/api/next-30-days")
def next_30_days():
    """
    Returns the next 30 days of forecast starting TOMORROW
    relative to real 'today' date.
    """

    # 1) Build future df (1 year ahead)
    future = model.make_future_dataframe(periods=365)  # daily frequency
    forecast = model.predict(future)

    # 2) Compute today's date
    today = datetime.utcnow().date()

    # 3) Select dates strictly after today
    fut = forecast[forecast["ds"].dt.date > today].copy()

    # 4) Take next 30 days
    fcst = fut.head(30)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()

    # Format for JSON
    fcst["ds"] = fcst["ds"].astype(str)
    fcst = fcst.to_dict(orient="records")

    # -------------------------
    # 5) Generate fire hotspot predictions
    # -------------------------

    # Sample spatial locations from historical
    # NOTE: you could use model-based location prediction later
    df_filtered = df.sample(n=min(len(df), 80))

    map_json = (
        df_filtered
        .reset_index()
        .rename(columns={"acq_date": "ds"})
        [["ds", "latitude", "longitude", "frp"]]
        .to_dict(orient="records")
    )

    return {
        "forecast": fcst,
        "locations": map_json
    }


@app.post("/api/insights")
def get_insights(data: dict = Body(...)):
    """
    Takes wildfire data (forecast or map info) and returns:
      - summary
      - risk level
      - preventive actions
    """
    # Clean input data from frontend
    forecast = data.get("forecast", [])
    map_points = data.get("map", [])

    # Build a prompt using available info
    prompt = f"""
    You are a wildfire risk analyst.

    Based on this forecasted FRP data (next days):
    {forecast[:15]}

    And these hotspot locations:
    {map_points[:20]}

    Provide:
    1. Summary of wildfire risk
    2. Key trends
    3. Regions at highest risk (if possible)
    4. Preventive measures (practical, short bullet points)
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        text = response.text or "No response"
        return {"insights": text}

    except Exception as e:
        return {"error": str(e)}


# @app.post("/api/insights-stream")
# def stream_insights(data: dict = Body(...)):
#     forecast = data.get("forecast", [])
#     map_points = data.get("map", [])

#     prompt = f"""
#     You are a wildfire risk analyst.

#     Based on this forecasted FRP data (next days):
#     {forecast[:15]}

#     And these hotspot locations:
#     {map_points[:20]}

#     Provide:
#     - Summary of wildfire risk
#     - Key trends
#     - Regions at highest risk
#     - Preventive measures (bullet points)
#     Keep it concise.
#     """

#     def event_stream():
#         try:
#             stream = client.models.generate_content_stream(
#                 model="gemini-2.5-flash",
#                 contents=prompt
#             )
#             for chunk in stream:
#                 if chunk.text:
#                     yield chunk.text
#         except Exception as e:
#             yield f"\n\n[ERROR] {str(e)}"

#     return StreamingResponse(event_stream(), media_type="text/plain")



@app.post("/api/insights-stream")
def stream_insights(data: dict = Body(...)):
    forecast = data.get("forecast", [])
    map_points = data.get("map", [])

    # --- Extract rough region hint if available ---
    # e.g. India, or specific state if lat/lon cluster aligned
    # For now, use a simple heuristic:
    region_hint = data.get("region", "the geographic region of these hotspots")

    # Updated prompt
    prompt = f"""
        You are a wildfire risk analyst.

        Based on this forecasted FRP data (next days):
        {forecast[:15]}

        And these hotspot locations:
        {map_points[:20]}

        The geographical focus is: {region_hint}.

        Return ONLY valid JSON in the following structure:

        {{
        "summary": "text",
        "trends": ["text"],
        "high_risk_regions": ["text"],
        "prevention": ["text"],
        "post_fire_actions": ["text"],
        "recovery": ["text"]
        }}

        Rules:
        - DO NOT write explanations outside JSON
        - DO NOT include markdown or bullet symbols
        - Arrays must contain strings only
        - Keep content concise, professional
        """

    def event_stream():
        try:
            stream = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=prompt
            )
            for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f'{{"error":"{str(e)}"}}'

    return StreamingResponse(event_stream(), media_type="text/plain")
    # return StreamingResponse(event_stream(), media_type="application/json")

@app.post("/api/insights-progressive")
def insights_progressive(data: dict = Body(...)):
    forecast = data.get("forecast", [])
    map_points = data.get("map", [])
    region_hint = data.get("region", "the geographic region")

    def gen_section(title, prompt):
        """Helper to stream JSON objects per section."""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text or ""
        yield json.dumps({title: text}) + "\n"

    def stream():
        # 1) Summary
        yield from gen_section(
            "summary",
            f"Write a concise wildfire risk summary for {region_hint}"
        )

        # 2) Trends
        yield from gen_section(
            "trends",
            f"Provide key trends as a JSON array for FRP over next days"
        )

        # 3) High risk regions
        yield from gen_section(
            "high_risk_regions",
            f"List states/regions at greatest wildfire risk"
        )

        # 4) Prevention
        yield from gen_section(
            "prevention",
            f"Give short bullet actionable prevention advice"
        )

        # 5) Post-fire response
        yield from gen_section(
            "post_fire_actions",
            f"Provide practical post-fire emergency control actions"
        )

        # 6) Recovery
        yield from gen_section(
            "recovery",
            f"Give tailored long-term recovery recommendations"
        )

        # Final done marker
        yield json.dumps({"done": True}) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")



@app.get("/api/forecast")
def forecast_future(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
    year: int = Query(...),
    month: int | None = Query(None)
):
    """
    Returns:
    - 30-day Prophet future forecast (yhat, yhat_lower, yhat_upper)
    - Fire locations sampled from the selected region
    """

    # --------------------------
    # 1) Make future dataframe
    # --------------------------
    future = model.make_future_dataframe(periods=30)
    forecast = model.predict(future)

    # Keep last 30 future days only
    fcst = forecast.tail(30)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()

    # Convert to native types
    fcst["ds"] = fcst["ds"].astype(str)
    fcst = fcst.to_dict(orient="records")

    # --------------------------
    # 2) Get LAT/LON for map
    # --------------------------
    df_filtered = df[
        (df["latitude"] >= min_lat) &
        (df["latitude"] <= max_lat) &
        (df["longitude"] >= min_lon) &
        (df["longitude"] <= max_lon)
    ].dropna(subset=["latitude","longitude"])

    if month:
        df_filtered = df_filtered[df_filtered.index.month == month]

    # sample up to 80 representative fire points
    sample_n = min(len(df_filtered), 80)
    map_points = df_filtered.sample(n=sample_n) if sample_n > 0 else df_filtered

    map_json = map_points.reset_index().rename(
        columns={"acq_date": "ds"}
    )[["ds", "latitude", "longitude", "frp"]].to_dict(orient="records")

    return {
        "forecast": fcst,
        "locations": map_json
    }

# ------------------------------
# 1) PAST DATA ENDPOINT
# ------------------------------
@app.get("/api/past")
def get_past(year: int, month: int | None = None):
    """
    Returns actual historic FRP values.
    Format returned:
        [
          {"ds": "2024-01-01", "latitude": 23.7, "longitude": 86.3, "frp": 289.1},
          ...
        ]
    """

    df_filtered = filter_df(year, month)

    df_out = df_filtered.reset_index().rename(columns={"acq_date": "ds"})
    return df_out[["ds", "latitude", "longitude", "frp"]].to_dict(orient="records")


# ------------------------------
# 2) PREDICTIONS ENDPOINT
# ------------------------------
@app.get("/api/predictions")
def get_predictions(year: int, month: int | None = None):
    """
    Predict FRP for all points in the chosen year/month using Prophet.
    - Uses the SAME dates and SAME latitude/longitude as your daily dataframe
    - Runs model.predict() on those ds dates
    - Merges output yhat with lat/lon

    Output format:
        [
          {"ds": "2025-12-01", "latitude": 18.47, "longitude": 74.21, "frp": 21.3},
          ...
        ]
    """

    df_filtered = filter_df(year, month)
    if df_filtered.empty:
        return []

    # Prepare Prophet input
    future = df_filtered.reset_index()[["acq_date"]].rename(columns={"acq_date": "ds"})

    # Predict
    forecast = model.predict(future)

    # Merge lat/lon + predicted FRP
    merged = pd.concat([
        future["ds"],
        df_filtered[["latitude", "longitude"]].reset_index(drop=True),
        forecast[["yhat"]]
    ], axis=1)

    merged.rename(columns={"yhat": "frp"}, inplace=True)

    # Convert to clean JSON list
    merged["ds"] = merged["ds"].astype(str)
    merged["frp"] = merged["frp"].astype(float)

    return merged.to_dict(orient="records")


@app.get("/api/historical-monthly")
def get_historical_monthly(
    year: int = Query(...),
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
):
    """
    Returns MONTHLY median FRP for the selected region & year.
    """

    df_filtered = df[
        (df.index.year == year) &
        (df["latitude"] >= min_lat) &
        (df["latitude"] <= max_lat) &
        (df["longitude"] >= min_lon) &
        (df["longitude"] <= max_lon)
    ].copy()

    if df_filtered.empty:
        return []

    df_monthly = (
        df_filtered
        .resample("M")
        .median(numeric_only=True)[["frp"]]
    )

    df_monthly["month"] = df_monthly.index.month
    df_monthly["month_name"] = df_monthly.index.strftime("%b")

    return df_monthly.reset_index(drop=True).to_dict(orient="records")


@app.get("/api/historical-map")
def get_historical_map(
    year: int = Query(...),
    month: int | None = Query(None),
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
):
    """
    Returns LAT/LON FRP data for mapping.
    Filters by:
    - Year
    - Optional month
    - Geographic bounding box
    """

    df_filtered = df[
        (df.index.year == year) &
        (df["latitude"] >= min_lat) &
        (df["latitude"] <= max_lat) &
        (df["longitude"] >= min_lon) &
        (df["longitude"] <= max_lon)
    ]

    if month:
        df_filtered = df_filtered[df_filtered.index.month == month]

    df_filtered = df_filtered.dropna(subset=["latitude", "longitude"])

    return (
        df_filtered
        .reset_index()
        .rename(columns={"acq_date": "ds"})
        [["ds", "latitude", "longitude", "frp"]]
        .to_dict(orient="records")
    )


# ------------------------------
# ROOT ENDPOINT
# ------------------------------
@app.get("/")
def root():
    return {
        "message": "Wildfire Vision API — backend running.",
        "endpoints": ["/api/past", "/api/predictions"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)