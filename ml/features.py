"""Step 2: turn the cleaned hourly table into model features.

LEAKAGE RULE: every feature for hour t uses only information from before hour t
(or the calendar, which is known in advance). Every consumption- and weather-based
feature therefore starts with .shift(1) = "look one hour into the past".
"""
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

TARGET = "electricity_kwh"

FEATURES = [
    # calendar (known in advance)
    "hour", "day_of_week", "month", "is_weekend", "is_holiday",
    # weather from the previous hour
    "temperature_prev_hour", "humidity_prev_hour",
    # past consumption
    "previous_hour_consumption", "previous_day_same_hour",
    "rolling_24h_average", "rolling_7day_average",
]

# The anomaly detector deliberately leaves out previous_hour_consumption.
# With it, the model mostly copies the last hour, so a spike that lasts many hours
# looks "expected" after its first hour. train.py measures this (injection test).
PATTERN_FEATURES = [f for f in FEATURES if f != "previous_hour_consumption"]


def make_features(df):
    """df: hourly DataFrame indexed by timestamp with columns
    electricity_kwh, temperature_c, humidity_pct. Index must be a regular hourly grid
    (gaps present as NaN rows), so that shift(24) really means 24 hours earlier."""
    df = df.asfreq("h")
    out = pd.DataFrame(index=df.index)
    out[TARGET] = df[TARGET]

    t = df.index
    out["hour"] = t.hour
    out["day_of_week"] = t.dayofweek  # 0 = Monday
    out["month"] = t.month
    out["is_weekend"] = (t.dayofweek >= 5).astype(int)
    holidays = USFederalHolidayCalendar().holidays(t.min(), t.max())
    out["is_holiday"] = t.normalize().isin(holidays).astype(int)

    out["temperature_prev_hour"] = df["temperature_c"].shift(1)
    out["humidity_prev_hour"] = df["humidity_pct"].shift(1)

    past = df[TARGET].shift(1)  # consumption known before hour t
    out["previous_hour_consumption"] = past
    out["previous_day_same_hour"] = df[TARGET].shift(24)
    # min_periods lets a short gap pass, but a mostly-missing window gives NaN
    out["rolling_24h_average"] = past.rolling(24, min_periods=20).mean()
    out["rolling_7day_average"] = past.rolling(168, min_periods=150).mean()
    return out


def model_ready(features):
    """Rows where the target and every feature are present."""
    return features.dropna(subset=FEATURES + [TARGET])
