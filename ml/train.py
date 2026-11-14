"""Step 3: baseline, three ML models, comparison, anomalies, failure analysis.

Run:  python ml/train.py   (after prepare_data.py)
"""
import json
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from features import FEATURES, PATTERN_FEATURES, TARGET, make_features, model_ready
from wattwise import MODEL_PATH, flag_anomalies

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"
SPLIT_DATE = "2017-01-01"     # train: 2016, test: 2017 (never shuffled)
ANOMALY_TOP_PERCENT = 5       # top 5% of positive residuals
N_FAILURES = 10


def scores(y, pred):
    return {
        "MAE_kwh": round(float(mean_absolute_error(y, pred)), 2),
        "RMSE_kwh": round(float(np.sqrt(mean_squared_error(y, pred))), 2),
    }


def make_models():
    # Settings fixed in advance (not tuned on the test year).
    return {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(n_estimators=200, min_samples_leaf=5, n_jobs=-1, random_state=42),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=4, random_state=42),
    }


def compare_models(train, test, features):
    """Fit the three ML models on one feature set; return scores, predictions, models."""
    table, preds, fitted = {}, {}, {}
    for name, model in make_models().items():
        model.fit(train[features], train[TARGET])
        preds[name] = model.predict(test[features])
        fitted[name] = model
        table[name] = scores(test[TARGET], preds[name])
    return table, preds, fitted


def injection_test(clean, model, features, threshold, n_events=30, hours=12, boost=1.25, seed=0):
    """We have no labelled 'real' anomalies, so we add fake ones we DO know about:
    n_events windows in the test year where usage is raised by 25% for 12 hours.
    Then we check how many of those hours the detector flags (recall) and how many
    untouched hours it flags (false flags). Training data is never modified."""
    rng = np.random.default_rng(seed)
    starts = rng.choice(pd.date_range("2017-01-15", "2017-12-15", freq="h"), n_events, replace=False)
    injected = clean.copy()
    mask = pd.Series(False, index=clean.index)
    for s in starts:
        mask[s: s + pd.Timedelta(hours=hours - 1)] = True
    injected.loc[mask, TARGET] *= boost
    data = model_ready(make_features(injected))
    test = data[data.index >= SPLIT_DATE]
    flagged = (test[TARGET] - model.predict(test[features])) >= threshold
    is_injected = mask.reindex(test.index)
    return {
        "events": n_events,
        "hours_per_event": hours,
        "increase": f"+{round((boost - 1) * 100)}%",
        "injected_hours_flagged_pct": round(100 * float(flagged[is_injected].mean()), 1),
        "events_with_at_least_one_flag": int(sum(flagged[s: s + pd.Timedelta(hours=hours - 1)].any() for s in starts)),
        "flags_on_untouched_hours": int((flagged & ~is_injected).sum()),
    }


def main():
    RESULTS.mkdir(exist_ok=True)
    FIGURES.mkdir(exist_ok=True)
    clean = pd.read_csv(ROOT / "data/processed/cleaned.csv", index_col="timestamp", parse_dates=True)
    data = model_ready(make_features(clean))

    # ---- Chronological split (never shuffled) -------------------------------
    train, test = data[data.index < SPLIT_DATE], data[data.index >= SPLIT_DATE]
    y_test = test[TARGET]

    # ---- Baseline: training-period average for the same weekday + hour -------
    profile = train.groupby(["day_of_week", "hour"])[TARGET].mean()
    baseline_pred = profile.reindex(pd.MultiIndex.from_arrays([test.day_of_week, test.hour])).values
    references = {
        "Baseline (2016 average for same weekday + hour)": scores(y_test, baseline_pred),
        "Reference: copy the previous hour (no ML)": scores(y_test, test.previous_hour_consumption),
    }

    # ---- Two feature sets ----------------------------------------------------
    # The "pattern model" (used for anomaly detection) and an "all features" model
    # that also sees the previous hour (more accurate, worse at catching long spikes).
    pattern_table, pattern_preds, pattern_models = compare_models(train, test, PATTERN_FEATURES)
    full_table, _, full_models = compare_models(train, test, FEATURES)

    best_name = min(pattern_table, key=lambda n: pattern_table[n]["MAE_kwh"])
    best_model = pattern_models[best_name]
    comparison = {**references, **pattern_table}
    print(pd.DataFrame(comparison).T)
    print("Best pattern model (lowest test MAE):", best_name)

    # ---- Anomalies -----------------------------------------------------------
    pred = pd.DataFrame({"actual_kwh": y_test, "predicted_kwh": pattern_preds[best_name]}, index=test.index)
    residuals = pred.actual_kwh - pred.predicted_kwh
    positive = residuals[residuals > 0].values
    threshold = float(np.percentile(positive, 100 - ANOMALY_TOP_PERCENT))
    results = flag_anomalies(pred, threshold, positive)
    results.insert(1, "baseline_kwh", baseline_pred.round(2))
    anomalies = results[results.is_anomaly].drop(columns="is_anomaly")
    results.to_csv(RESULTS / "predictions.csv", index_label="timestamp")
    anomalies.to_csv(RESULTS / "anomalies.csv", index_label="timestamp")

    # ---- Injection test: pattern model vs all-features model -----------------
    full_model = full_models[best_name]
    full_res = y_test - full_model.predict(test[FEATURES])
    full_threshold = float(np.percentile(full_res[full_res > 0], 100 - ANOMALY_TOP_PERCENT))
    detection = {
        f"{best_name} - pattern features (used)": injection_test(clean, best_model, PATTERN_FEATURES, threshold),
        f"{best_name} - all features incl. previous hour": injection_test(clean, full_model, FEATURES, full_threshold),
    }

    joblib.dump(
        {
            "model": best_model,
            "model_name": best_name,
            "features": PATTERN_FEATURES,
            "threshold_kwh": threshold,
            "reference_positive_residuals": positive,
            "trained_on": [str(train.index.min()), str(train.index.max())],
        },
        MODEL_PATH,
        compress=3,
    )

    importances = (
        dict(zip(PATTERN_FEATURES, np.round(best_model.feature_importances_, 4).tolist()))
        if hasattr(best_model, "feature_importances_") else None
    )
    metrics = {
        "building": "Rat_education_Dann (K-12 school, Washington DC, BDG2)",
        "train_period": [str(train.index.min()), str(train.index.max())],
        "test_period": [str(test.index.min()), str(test.index.max())],
        "train_rows": len(train),
        "test_rows": len(test),
        "test_mean_consumption_kwh": round(float(y_test.mean()), 2),
        "model_comparison": comparison,
        "model_comparison_features": PATTERN_FEATURES,
        "best_model": best_name,
        "selection_rule": "lowest MAE on the unseen 2017 test year (pattern feature set)",
        "best_model_feature_importances": importances,
        "experiment_all_features_including_previous_hour": full_table,
        "injection_test": detection,
        "anomaly_detection": {
            "rule": f"residual >= {100 - ANOMALY_TOP_PERCENT}th percentile of positive test residuals",
            "threshold_kwh": round(threshold, 2),
            "positive_residual_hours": int(len(positive)),
            "flagged_hours": int(len(anomalies)),
            "flagged_periods": int(anomalies.period_id.nunique()),
        },
    }
    (RESULTS / "metrics.json").write_text(json.dumps(metrics, indent=2))

    write_failure_analysis(test, results)
    make_figures(results, comparison, threshold)
    print(json.dumps(metrics, indent=2))


def write_failure_analysis(test, results):
    """The largest absolute errors, described only by what the model could observe."""
    err = results.actual_kwh - results.predicted_kwh
    worst = err.abs().nlargest(N_FAILURES).index
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    holidays = USFederalHolidayCalendar().holidays("2016-12-01", "2018-01-01")
    lines = [
        "# Failure analysis: the model's largest prediction errors (2017 test year)",
        "",
        "These are the hours where the model was most wrong, in either direction.",
        "We do **not** know why these hours were unusual. The table only shows what the",
        "model could see when it made the prediction.",
        "",
        "| Timestamp | Day | Holiday | Yesterday was | Temp prev hr (°C) | Same hour yesterday (kWh) | Last-24h avg (kWh) | Last-7-day avg (kWh) | Predicted | Actual | Error | Direction |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for ts in worst:
        f, r = test.loc[ts], results.loc[ts]
        e = r.actual_kwh - r.predicted_kwh
        y = ts - pd.Timedelta("1D")
        yesterday = "holiday" if y.normalize() in holidays else ("weekend" if y.day_of_week >= 5 else "weekday")
        lines.append(
            f"| {ts:%Y-%m-%d %H:%M} | {days[int(f.day_of_week)]} | {'yes' if f.is_holiday else 'no'} | {yesterday} "
            f"| {f.temperature_prev_hour:.1f} | {f.previous_day_same_hour:.1f} | {f.rolling_24h_average:.1f} "
            f"| {f.rolling_7day_average:.1f} | {r.predicted_kwh:.1f} | {r.actual_kwh:.1f} | {e:+.1f} "
            f"| {'used MORE than expected' if e > 0 else 'used LESS than expected'} |"
        )
    lines += [
        "",
        "## What the model can observe",
        "",
        "- The clock and calendar: hour, weekday, month, weekend and US federal holidays.",
        "- Outdoor temperature and humidity from the previous hour.",
        "- This building's own recent consumption: same hour yesterday, last-24-hour and last-7-day averages.",
        "  (It deliberately does NOT use the previous hour - see docs/ML_EXPLAINED.md.)",
        "",
        "## What the model cannot observe",
        "",
        "- The school timetable: term dates, exam weeks, snow days, teacher-only days, summer programmes.",
        "- Occupancy: how many people are in the building.",
        "- Events: evening events, sports, rentals, building works.",
        "- Equipment: what is switched on, maintenance, faults, setpoint or schedule changes.",
        "- Metering problems: a wrong reading looks the same to the model as real usage.",
        "",
        "Any of these could explain a large error, and the model cannot tell them apart.",
        "A flagged hour is a **period requiring investigation**, not proof of waste.",
        "",
        "## Patterns visible from the data alone",
        "",
        "- The model leans on 'same hour yesterday' and the 24-hour average, so the first",
        "  day after a change in routine (e.g. a weekday after a day off, or a day off after",
        "  a normal weekday) tends to produce large errors.",
        "- Federal holidays are known to the model, but school-specific closures are not.",
    ]
    (RESULTS / "failure_analysis.md").write_text("\n".join(lines), encoding="utf-8")


def make_figures(results, comparison, threshold):
    # 1. Model comparison
    names = list(comparison)
    fig, ax = plt.subplots(figsize=(9, 4))
    x = np.arange(len(names))
    ax.bar(x - 0.2, [comparison[n]["MAE_kwh"] for n in names], 0.4, label="MAE")
    ax.bar(x + 0.2, [comparison[n]["RMSE_kwh"] for n in names], 0.4, label="RMSE")
    ax.set_xticks(x, [n.replace(" (", "\n(").replace(": ", ":\n") for n in names], fontsize=7)
    ax.set_ylabel("kWh (lower is better)")
    ax.set_title("Prediction error on unseen 2017 data")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "model_comparison.png", dpi=120)
    plt.close(fig)

    # 2. Residual distribution with threshold
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(results.residual_kwh, bins=100, color="grey")
    ax.axvline(threshold, color="red", label=f"anomaly threshold = {threshold:.1f} kWh")
    ax.set_xlabel("Residual = actual - predicted (kWh)")
    ax.set_ylabel("Hours")
    ax.set_title("Residuals on 2017 test data (red: top 5% of positive residuals)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "residual_distribution.png", dpi=120)
    plt.close(fig)

    # 3. Week around the largest positive residual
    top = results.residual_kwh.idxmax()
    week = results.loc[top - pd.Timedelta("3D"): top + pd.Timedelta("4D")]
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(week.index, week.actual_kwh, label="actual")
    ax.plot(week.index, week.predicted_kwh, label="expected (model)")
    flagged = week[week.is_anomaly]
    ax.scatter(flagged.index, flagged.actual_kwh, color="red", zorder=3, label="flagged for investigation")
    ax.set_ylabel("kWh per hour")
    ax.set_title("Week around the largest positive residual")
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(FIGURES / "example_week.png", dpi=120)
    plt.close(fig)


if __name__ == "__main__":
    main()
