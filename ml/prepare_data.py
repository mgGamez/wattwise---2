"""Step 1: clean the raw data and write a data-quality report.

Input:  data/raw/energydata_complete.csv  (UCI Appliances Energy Prediction)
Output: data/processed/cleaned.csv, results/data_quality.json

Run:  python ml/prepare_data.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "energydata_complete.csv"
CLEAN_PATH = ROOT / "data" / "processed" / "cleaned.csv"
QUALITY_PATH = ROOT / "results" / "data_quality.json"
INTERVAL = "10min"

RENAME = {
    "date": "timestamp",
    "Appliances": "appliances_wh",
    "lights": "lights_wh",
    "T_out": "outdoor_temp_c",
    "RH_out": "outdoor_humidity_pct",
    "Press_mm_hg": "pressure_mm_hg",
    "Windspeed": "windspeed_m_s",
    "Visibility": "visibility_km",
    "Tdewpoint": "dewpoint_c",
}
# rv1 / rv2 are random numbers the dataset authors added on purpose to test
# feature selection. They carry no information, so we drop them.
DROP = ["rv1", "rv2"]


def gap_summary(missing_index):
    s = missing_index.to_series()
    groups = s.diff().ne(pd.Timedelta(INTERVAL)).cumsum()
    return [{"start": str(g.min()), "end": str(g.max()), "intervals": int(len(g))} for _, g in s.groupby(groups)]


def main():
    raw = pd.read_csv(RAW_PATH, parse_dates=["date"]).rename(columns=RENAME).drop(columns=DROP)
    report = {"raw_rows": len(raw), "dropped_columns": DROP}

    report["duplicate_timestamps"] = int(raw.timestamp.duplicated().sum())
    df = raw.drop_duplicates("timestamp").set_index("timestamp").sort_index()

    steps = df.index.to_series().diff().dropna().value_counts()
    report["measurement_intervals_found"] = {str(k): int(v) for k, v in steps.items()}
    full_index = pd.date_range(df.index.min(), df.index.max(), freq=INTERVAL, name="timestamp")
    report["missing_timestamps"] = int(len(full_index.difference(df.index)))
    df = df.reindex(full_index)

    # Negative or impossible energy values -> missing (never invented).
    for col in ["appliances_wh", "lights_wh"]:
        bad = df[col] < 0
        report[f"negative_values_{col}"] = int(bad.sum())
        df.loc[bad, col] = np.nan

    missing = df.index[df.appliances_wh.isna()]
    report["missing_energy_values"] = int(len(missing))
    report["missing_energy_gaps"] = gap_summary(missing) if len(missing) else []
    report["missing_values_other_columns"] = int(df.drop(columns="appliances_wh").isna().sum().sum())
    # Sensors: forward-fill only (copies the past, so no future leakage). Target is never filled.
    sensors = df.columns.drop(["appliances_wh"])
    df[sensors] = df[sensors].ffill(limit=3)

    report["clean_rows"] = len(df)
    report["date_range"] = [str(df.index.min()), str(df.index.max())]
    report["appliances_wh_summary"] = df.appliances_wh.describe().round(2).to_dict()
    report["share_of_intervals_above_300_wh"] = round(float((df.appliances_wh > 300).mean()), 4)

    CLEAN_PATH.parent.mkdir(parents=True, exist_ok=True)
    QUALITY_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(CLEAN_PATH)
    QUALITY_PATH.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
