"""
FastAPI backend for Wildfire Vision predictions.

This module serves as the REST API layer for the Wildfire Vision application.
It loads a pre-trained Facebook Prophet model and a processed historical fire
dataframe at startup, then exposes endpoints for past data retrieval, future
FRP (Fire Radiative Power) forecasting, Gemini-powered insights generation,
and geographic filtering of fire hotspots.

Artifacts required in the working directory:
    prophet_wildfire_model.joblib: Serialised Prophet model.
    processed_daily_fire_data.csv: Daily median fire data with columns
        ``acq_date``, ``latitude``, ``longitude``, and ``frp``.

Environment variables:
    GEMINI_API_KEY: API key for the Google Gemini generative AI client.

Run with::

    uvicorn wildfire_webapp:app --reload --port 5000

Endpoints:
    GET  /                           Health check.
    GET  /api/past                   Historical FRP records.
    GET  /api/predictions            Prophet-predicted FRP for a period.
    GET  /api/forecast               30-day forecast with spatial filtering.
    GET  /api/next-30-days           Next-30-day forecast from today.
    GET  /api/historical-monthly     Monthly median FRP for a bounding box.
    GET  /api/historical-map         Spatial FRP points for map rendering.
    POST /api/insights               Gemini-generated wildfire risk insights.
    POST /api/insights-stream        Streaming Gemini insights (NDJSON).
    POST /api/insights-progressive   Section-by-section progressive insights.
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
    """Filter the global fire dataframe by year and optional month.

    Rows with missing ``latitude`` or ``longitude`` values are dropped
    before the result is returned.

    Args:
        year: Calendar year to filter on (e.g. ``2024``).
        month: Optional calendar month (1–12) to further narrow the result.
            When ``None`` all months within the given year are included.

    Returns:
        A copy of the filtered ``pandas.DataFrame`` indexed by ``acq_date``,
        containing at minimum the columns ``latitude``, ``longitude``, and
        ``frp`` with no NaN coordinates.

    Example:
        >>> df_jan = filter_df(2024, month=1)
        >>> df_year = filter_df(2023)
    """
    df_f = df[df.index.year == year]
    if month:
        df_f = df_f[df_f.index.month == month]
    return df_f.dropna(subset=["latitude", "longitude"]).copy()


@app.get("/api/next-30-days")
def next_30_days():
    """Return a 30-day FRP forecast starting from tomorrow's date.

    Generates a one-year-ahead Prophet forecast, then slices the 30
    calendar days strictly after today (UTC). Spatial hotspot locations
    are sampled from the full historical dataframe to populate the map
    layer.

    Returns:
        dict: A JSON-serialisable dictionary with two keys:

        - ``forecast`` (list[dict]): Up to 30 records, each containing
          ``ds`` (ISO date string), ``yhat``, ``yhat_lower``,
          ``yhat_upper``.
        - ``locations`` (list[dict]): Up to 80 sampled historical fire
          points, each containing ``ds``, ``latitude``, ``longitude``,
          ``frp``.

    Example::

        GET /api/next-30-days
        # Response:
        # {
        #   "forecast": [{"ds": "2026-07-29", "yhat": 45.2, ...}, ...],
        #   "locations": [{"ds": "2024-03-15", "latitude": 23.7, ...}, ...]
        # }
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
    """Generate Gemini wildfire risk insights from forecast and hotspot data.

    Sends a structured prompt to the Gemini 2.5 Flash model containing
    forecast FRP values and map hotspot coordinates, then returns the
    model's plain-text analysis.

    Args:
        data (dict): Request body with the following optional keys:

            - ``forecast`` (list[dict]): Forecasted FRP records (first 15
              used). Defaults to ``[]``.
            - ``map`` (list[dict]): Hotspot location records (first 20
              used). Defaults to ``[]``.

    Returns:
        dict: On success, ``{"insights": str}`` containing the model's
        analysis text.  On failure, ``{"error": str}`` with the
        exception message.

    Raises:
        Exception: Any Gemini API error is caught internally and returned
            as ``{"error": "<message>"}`` rather than propagated.
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
    """Stream structured JSON wildfire insights via server-sent text chunks.

    Builds a Gemini prompt from the supplied forecast and hotspot data,
    instructing the model to respond with a single JSON object. The
    response is streamed chunk-by-chunk as plain text so the frontend can
    progressively parse it.

    Args:
        data (dict): Request body with the following optional keys:

            - ``forecast`` (list[dict]): Forecasted FRP records (first 15
              used). Defaults to ``[]``.
            - ``map`` (list[dict]): Hotspot location records (first 20
              used). Defaults to ``[]``.
            - ``region`` (str): Human-readable geographic focus label.
              Defaults to ``"the geographic region of these hotspots"``.

    Returns:
        StreamingResponse: A ``text/plain`` streaming response whose
        concatenated body is a single JSON object conforming to::

            {
              "summary": "...",
              "trends": ["..."],
              "high_risk_regions": ["..."],
              "prevention": ["..."],
              "post_fire_actions": ["..."],
              "recovery": ["..."]
            }

        On Gemini error, yields ``{"error": "<message>"}``.
    """
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
        """Generator that yields text chunks from the Gemini streaming API."""
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
    """Stream wildfire insights one section at a time as newline-delimited JSON.

    Issues six sequential Gemini calls (summary, trends, high-risk regions,
    prevention, post-fire actions, recovery), yielding each result as a
    separate NDJSON line immediately after it is received. A final
    ``{"done": true}`` line signals completion.

    Args:
        data (dict): Request body with the following optional keys:

            - ``forecast`` (list[dict]): Forecasted FRP records.
              Defaults to ``[]``.
            - ``map`` (list[dict]): Hotspot location records.
              Defaults to ``[]``.
            - ``region`` (str): Human-readable geographic focus label.
              Defaults to ``"the geographic region"``.

    Returns:
        StreamingResponse: An ``application/x-ndjson`` streaming response
        where each line is a JSON object with a single key corresponding
        to the section name, e.g.::

            {"summary": "High fire risk expected across ..."}
            {"trends": "FRP trending upward ..."}
            ...
            {"done": true}
    """
    forecast = data.get("forecast", [])
    map_points = data.get("map", [])
    region_hint = data.get("region", "the geographic region")

    def gen_section(title, prompt):
        """Call Gemini once and yield a single NDJSON line for a report section.

        Args:
            title (str): Key name for the yielded JSON object
                (e.g. ``"summary"`` or ``"trends"``).
            prompt (str): Instruction text sent to the Gemini model.

        Yields:
            str: A newline-terminated JSON string of the form
            ``'{"<title>": "<response text>"}\\n'``.
        """
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text or ""
        yield json.dumps({title: text}) + "\n"

    def stream():
        """Generator that sequences all six section calls and emits a done marker."""
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
    """Return a 30-day Prophet forecast and spatially filtered fire locations.

    Runs the Prophet model 30 periods ahead and returns the tail of the
    forecast. Simultaneously filters the historical dataframe by the
    supplied bounding box (and optional month) to provide representative
    spatial points for map rendering.

    Args:
        min_lat: Southern boundary of the bounding box (degrees).
        max_lat: Northern boundary of the bounding box (degrees).
        min_lon: Western boundary of the bounding box (degrees).
        max_lon: Eastern boundary of the bounding box (degrees).
        year: Calendar year used to filter spatial fire point data.
        month: Optional calendar month (1–12) to further filter fire
            point data. When ``None`` all months are included.

    Returns:
        dict: A JSON-serialisable dictionary with two keys:

        - ``forecast`` (list[dict]): 30 records each containing ``ds``
          (ISO date string), ``yhat``, ``yhat_lower``, ``yhat_upper``.
        - ``locations`` (list[dict]): Up to 80 sampled fire points from
          the bounding box, each containing ``ds``, ``latitude``,
          ``longitude``, ``frp``.

    Example::

        GET /api/forecast?min_lat=8&max_lat=37&min_lon=68&max_lon=97&year=2024
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
    """Return historical FRP records for a given year and optional month.

    Delegates filtering to :func:`filter_df`, then serialises the result
    to a list of JSON-compatible dictionaries.

    Args:
        year: Calendar year to retrieve data for (e.g. ``2024``).
        month: Optional calendar month (1–12). When omitted the entire
            year is returned.

    Returns:
        list[dict]: Each element represents one daily observation::

            [
              {"ds": "2024-01-01", "latitude": 23.7,
               "longitude": 86.3, "frp": 289.1},
              ...
            ]

    Example::

        GET /api/past?year=2024&month=1
    """

    df_filtered = filter_df(year, month)

    df_out = df_filtered.reset_index().rename(columns={"acq_date": "ds"})
    return df_out[["ds", "latitude", "longitude", "frp"]].to_dict(orient="records")


# ------------------------------
# 2) PREDICTIONS ENDPOINT
# ------------------------------
@app.get("/api/predictions")
def get_predictions(year: int, month: int | None = None):
    """Return Prophet-predicted FRP values for historical lat/lon positions.

    Filters the dataframe to the requested period, feeds the resulting
    dates into the Prophet model, and merges the predicted ``yhat`` values
    back with the original geographic coordinates. The ``yhat`` column is
    renamed to ``frp`` to keep the response schema consistent with
    :func:`get_past`.

    Args:
        year: Calendar year for which predictions are generated
            (e.g. ``2025``).
        month: Optional calendar month (1–12). When omitted predictions
            cover the entire year.

    Returns:
        list[dict]: Each element contains predicted fire data for one
        observation date::

            [
              {"ds": "2025-12-01", "latitude": 18.47,
               "longitude": 74.21, "frp": 21.3},
              ...
            ]

        Returns an empty list when no data matches the requested period.

    Example::

        GET /api/predictions?year=2025&month=12
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
    """Return monthly median FRP aggregates for a geographic bounding box.

    Filters the historical dataframe to the specified year and bounding
    box, then resamples to calendar-month frequency using the median FRP.
    Adds human-readable ``month`` (integer) and ``month_name`` (3-letter
    abbreviation) columns for charting convenience.

    Args:
        year: Calendar year to aggregate (e.g. ``2024``).
        min_lat: Southern boundary of the bounding box (degrees).
        max_lat: Northern boundary of the bounding box (degrees).
        min_lon: Western boundary of the bounding box (degrees).
        max_lon: Eastern boundary of the bounding box (degrees).

    Returns:
        list[dict]: One record per month that contains data::

            [
              {"frp": 120.5, "month": 3, "month_name": "Mar"},
              ...
            ]

        Returns an empty list when no data matches the filters.

    Example::

        GET /api/historical-monthly?year=2024&min_lat=8&max_lat=37&min_lon=68&max_lon=97
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
    """Return historical fire point data for map rendering.

    Applies three successive filters — year, optional month, and a
    geographic bounding box — then drops rows with missing coordinates
    before returning the full (unsampled) result set.

    Args:
        year: Calendar year to filter on (e.g. ``2024``).
        month: Optional calendar month (1–12). When ``None`` all months
            within ``year`` are included.
        min_lat: Southern boundary of the bounding box (degrees).
        max_lat: Northern boundary of the bounding box (degrees).
        min_lon: Western boundary of the bounding box (degrees).
        max_lon: Eastern boundary of the bounding box (degrees).

    Returns:
        list[dict]: All matching fire observation records::

            [
              {"ds": "2024-06-10", "latitude": 22.1,
               "longitude": 79.4, "frp": 55.0},
              ...
            ]

    Example::

        GET /api/historical-map?year=2024&month=6&min_lat=8&max_lat=37&min_lon=68&max_lon=97
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
    """Health-check endpoint confirming the API is running.

    Returns:
        dict: A static message and a list of primary API endpoints::

            {
              "message": "Wildfire Vision API — backend running.",
              "endpoints": ["/api/past", "/api/predictions"]
            }
    """
    return {
        "message": "Wildfire Vision API — backend running.",
        "endpoints": ["/api/past", "/api/predictions"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)