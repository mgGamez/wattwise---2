"""Step 2: candidate features.

LEAKAGE RULE: the feature row for interval t may only use the calendar (known in
advance) and measurements from BEFORE t. Every lag/rolling/sensor feature therefore
starts with .shift(1) = "look one 10-minute interval into the past".
train.py checks this automatically (leakage_check).
"""
import numpy as np
import pandas as pd

TARGET = "appliances_wh"
INTERVAL = pd.Timedelta("10min")
PER_HOUR = 6           # 10-minute intervals per hour
PER_DAY = 144

OUTDOOR = ["outdoor_temp_c", "outdoor_humidity_pct", "pressure_mm_hg", "windspeed_m_s", "visibility_km", "dewpoint_c"]
INDOOR = [f"T{i}" for i in range(1, 10)] + [f"RH_{i}" for i in range(1, 10)]

# Candidate name -> columns it adds. Groups are tested (added/removed) together.
CANDIDATES = {
    "hour": ["hour"],
    "hour_cyclic": ["hour_sin", "hour_cos"],
    "day_of_week": ["day_of_week"],
    "day_of_week_cyclic": ["dow_sin", "dow_cos"],
    "is_weekend": ["is_weekend"],
    "previous_interval": ["previous_interval"],
    "previous_hour": ["previous_hour"],
    "previous_day_same_time": ["previous_day_same_time"],
    "rolling_1h_mean": ["rolling_1h_mean"],
    "rolling_6h_mean": ["rolling_6h_mean"],
    "rolling_24h_mean": ["rolling_24h_mean"],
    "lights_previous_interval": ["lights_previous_interval"],
    "outdoor_weather_previous_interval": [f"{c}_prev" for c in OUTDOOR],
    "indoor_conditions_previous_interval": [f"{c}_prev" for c in INDOOR],
}


def columns_for(candidates):
    return [c for name in candidates for c in CANDIDATES[name]]


def make_features(df):
    """df: 10-minute DataFrame indexed by timestamp (cleaned.csv)."""
    df = df.asfreq(INTERVAL)
    out = pd.DataFrame(index=df.index)
    out[TARGET] = df[TARGET]
    t = df.index

    # Calendar (known in advance)
    hour = t.hour + t.minute / 60
    out["hour"] = t.hour
    out["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    out["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    out["day_of_week"] = t.dayofweek
    out["dow_sin"] = np.sin(2 * np.pi * t.dayofweek / 7)
    out["dow_cos"] = np.cos(2 * np.pi * t.dayofweek / 7)
    out["is_weekend"] = (t.dayofweek >= 5).astype(int)

    # Past consumption
    past = df[TARGET].shift(1)
    out["previous_interval"] = past                                   # t - 10 min
    out["previous_hour"] = df[TARGET].shift(PER_HOUR)                # t - 60 min
    out["previous_day_same_time"] = df[TARGET].shift(PER_DAY)        # t - 24 h
    out["rolling_1h_mean"] = past.rolling(PER_HOUR).mean()           # mean of the 6 intervals before t
    out["rolling_6h_mean"] = past.rolling(6 * PER_HOUR).mean()
    out["rolling_24h_mean"] = past.rolling(PER_DAY).mean()

    # Other sensors, previous interval only
    out["lights_previous_interval"] = df["lights_wh"].shift(1)
    for c in OUTDOOR + INDOOR:
        out[f"{c}_prev"] = df[c].shift(1)
    return out


def model_ready(features, columns):
    return features.dropna(subset=columns + [TARGET])
