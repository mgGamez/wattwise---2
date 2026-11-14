"""Reusable WATTWISE functions (used by train.py and, later, by the website).

    from wattwise import analyse_consumption
    results, anomalies = analyse_consumption(df)

df: 10-minute DataFrame indexed by timestamp with the columns of
data/processed/cleaned.csv (appliances_wh, lights_wh, sensors...).
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from features import INTERVAL, TARGET, make_features, model_ready

MODEL_PATH = Path(__file__).resolve().parents[1] / "model" / "wattwise_model.joblib"


def load_model(path=MODEL_PATH):
    """Saved bundle: {"model", "model_name", "features", "threshold_wh",
    "reference_positive_residuals", ...}."""
    return joblib.load(path)


def predict_expected_usage(df, bundle=None):
    """Expected (normal) consumption for every interval with enough history.
    The first 24 hours of any input are history only (rolling_24h / previous-day features)."""
    bundle = bundle or load_model()
    X = model_ready(make_features(df), bundle["features"])
    return pd.DataFrame(
        {"actual_wh": X[TARGET], "predicted_wh": bundle["model"].predict(X[bundle["features"]])},
        index=X.index,
    )


def anomaly_score(residuals, reference_positive_residuals):
    """Percentile (0-100) of each residual within the reference (validation) distribution
    of positive residuals. Intervals that used less than expected get 0."""
    ref = np.sort(np.asarray(reference_positive_residuals))
    pct = np.searchsorted(ref, residuals, side="right") / len(ref) * 100
    return np.where(residuals > 0, pct, 0.0)


def flag_anomalies(pred, threshold_wh, reference_positive_residuals):
    out = pred.copy()
    out["residual_wh"] = out.actual_wh - out.predicted_wh
    out["pct_above_prediction"] = 100 * out.residual_wh / out.predicted_wh
    out["anomaly_percentile"] = anomaly_score(out.residual_wh.values, reference_positive_residuals)
    out["is_anomaly"] = out.residual_wh >= threshold_wh
    # Consecutive flagged intervals form one "period requiring investigation".
    contiguous = out.index.to_series().diff().eq(INTERVAL)
    starts = out.is_anomaly & ~(out.is_anomaly.shift(1, fill_value=False) & contiguous)
    out["period_id"] = np.where(out.is_anomaly, starts.cumsum(), 0)
    return out.round(2)


def analyse_consumption(df, bundle=None):
    """Predict expected usage, compare with actual, flag unusually high intervals using
    the threshold calibrated on the validation period. Returns (all_intervals, anomalies)."""
    bundle = bundle or load_model()
    pred = predict_expected_usage(df, bundle)
    res = flag_anomalies(pred, bundle["threshold_wh"], bundle["reference_positive_residuals"])
    return res, res[res.is_anomaly]
