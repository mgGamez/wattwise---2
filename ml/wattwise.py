"""Reusable WATTWISE functions (used by train.py and, later, by the website).

    from wattwise import analyse_consumption
    results, anomalies = analyse_consumption(hourly_df)

hourly_df: DataFrame indexed by hourly timestamp with columns
electricity_kwh, temperature_c, humidity_pct.
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from features import TARGET, make_features, model_ready

MODEL_PATH = Path(__file__).resolve().parents[1] / "model" / "wattwise_model.joblib"


def load_model(path=MODEL_PATH):
    """Returns the saved bundle: {"model", "model_name", "features",
    "threshold_kwh", "reference_positive_residuals", ...}."""
    return joblib.load(path)


def predict_expected_usage(hourly_df, bundle=None):
    """Expected (normal) consumption for every hour that has enough history.
    The first ~7 days of any input cannot be predicted (rolling 7-day feature)."""
    bundle = bundle or load_model()
    X = model_ready(make_features(hourly_df))
    return pd.DataFrame(
        {"actual_kwh": X[TARGET], "predicted_kwh": bundle["model"].predict(X[bundle["features"]])},
        index=X.index,
    )


def anomaly_score(residuals, reference_positive_residuals):
    """Percentile (0-100) of each residual within the reference distribution of
    positive residuals. 99 = larger than 99% of the positive surprises seen in testing.
    Hours with residual <= 0 (used less than expected) get 0."""
    ref = np.sort(np.asarray(reference_positive_residuals))
    pct = np.searchsorted(ref, residuals, side="right") / len(ref) * 100
    return np.where(residuals > 0, pct, 0.0)


def flag_anomalies(pred, threshold_kwh, reference_positive_residuals):
    """Adds residual, percent above prediction, score and anomaly flag."""
    out = pred.copy()
    out["residual_kwh"] = out.actual_kwh - out.predicted_kwh
    out["pct_above_prediction"] = 100 * out.residual_kwh / out.predicted_kwh
    out["anomaly_percentile"] = anomaly_score(out.residual_kwh.values, reference_positive_residuals)
    out["is_anomaly"] = out.residual_kwh >= threshold_kwh
    # Consecutive flagged hours form one "period requiring investigation".
    starts = out.is_anomaly & ~out.is_anomaly.shift(1, fill_value=False)
    contiguous = out.index.to_series().diff().eq(pd.Timedelta("1h"))
    starts |= out.is_anomaly & ~contiguous
    out["period_id"] = np.where(out.is_anomaly, starts.cumsum(), 0)
    return out.round(2)


def analyse_consumption(hourly_df, bundle=None):
    """Predict expected usage, compare with actual, and flag unusually high hours
    using the threshold learned on the test period.
    Returns (all_hours, anomalies_only)."""
    bundle = bundle or load_model()
    pred = predict_expected_usage(hourly_df, bundle)
    res = flag_anomalies(pred, bundle["threshold_kwh"], bundle["reference_positive_residuals"])
    return res, res[res.is_anomaly]
