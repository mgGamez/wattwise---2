"""Step 1: clean the raw data and write a data-quality report.

Input:  data/raw/rat_education_dann_electricity.csv, data/raw/rat_site_weather.csv
Output: data/processed/cleaned.csv, results/data_quality.json

Run:  python ml/prepare_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
CLEAN_PATH = ROOT / "data" / "processed" / "cleaned.csv"
QUALITY_PATH = ROOT / "results" / "data_quality.json"


def relative_humidity(temp_c, dew_c):
    """Relative humidity (%) from air temperature and dew point (Magnus formula)."""
    a, b = 17.625, 243.04
    return 100 * np.exp(a * dew_c / (b + dew_c)) / np.exp(a * temp_c / (b + temp_c))


def gap_summary(missing_index):
    """Group consecutive missing hours into gaps: [(start, end, hours), ...]."""
    s = missing_index.to_series()
    groups = s.diff().ne(pd.Timedelta("1h")).cumsum()
    return [
        {"start": str(g.min()), "end": str(g.max()), "hours": int(len(g))}
        for _, g in s.groupby(groups)
    ]


def main():
    elec = pd.read_csv(RAW / "rat_education_dann_electricity.csv", parse_dates=["timestamp"])
    weather = pd.read_csv(RAW / "rat_site_weather.csv", parse_dates=["timestamp"])
    report = {"raw_rows_electricity": len(elec), "raw_rows_weather": len(weather)}

    # Duplicate timestamps: keep the first reading.
    report["duplicate_timestamps_electricity"] = int(elec.timestamp.duplicated().sum())
    report["duplicate_timestamps_weather"] = int(weather.timestamp.duplicated().sum())
    elec = elec.drop_duplicates("timestamp").set_index("timestamp").sort_index()
    weather = weather.drop_duplicates("timestamp").set_index("timestamp").sort_index()

    # Inconsistent intervals: put everything on one regular hourly grid.
    steps = elec.index.to_series().diff().dropna().value_counts()
    report["measurement_intervals_found"] = {str(k): int(v) for k, v in steps.items()}
    full_index = pd.date_range(elec.index.min(), elec.index.max(), freq="h", name="timestamp")
    report["missing_timestamps_electricity"] = int(len(full_index.difference(elec.index)))
    df = elec.reindex(full_index)

    # Negative / impossible values -> treat as missing (never invented).
    bad = (df.electricity_kwh < 0) | ~np.isfinite(df.electricity_kwh.fillna(0))
    report["negative_or_impossible_values"] = int(bad.sum())
    df.loc[bad, "electricity_kwh"] = np.nan

    # Suspiciously low readings (<10% of median) are flagged, not removed.
    median = df.electricity_kwh.median()
    report["suspiciously_low_values_below_10pct_of_median"] = int((df.electricity_kwh < 0.1 * median).sum())

    # Missing energy values: we do NOT fill the target. Those hours are excluded from modelling.
    missing = df.index[df.electricity_kwh.isna()]
    report["missing_energy_values"] = int(len(missing))
    report["missing_energy_gaps"] = gap_summary(missing)

    # Weather: forward-fill short gaps (max 3 h). Forward-fill only copies the PAST,
    # so it cannot leak future information (unlike interpolation).
    weather = weather.reindex(full_index)
    report["missing_weather_values_before_fill"] = {c: int(weather[c].isna().sum()) for c in weather}
    weather = weather.ffill(limit=3)
    report["missing_weather_values_after_fill"] = {c: int(weather[c].isna().sum()) for c in weather}

    df["temperature_c"] = weather.airTemperature
    df["humidity_pct"] = relative_humidity(weather.airTemperature, weather.dewTemperature).clip(0, 100).round(1)

    report["clean_rows"] = len(df)
    report["date_range"] = [str(df.index.min()), str(df.index.max())]
    report["electricity_kwh_summary"] = df.electricity_kwh.describe().round(2).to_dict()

    CLEAN_PATH.parent.mkdir(parents=True, exist_ok=True)
    QUALITY_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(CLEAN_PATH)
    QUALITY_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
