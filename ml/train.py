"""Step 3: feature selection, model selection, final test, anomalies, failure analysis.

Chronological split (never shuffled):
    TRAIN       first 70%  -> fit models
    VALIDATION  next 15%   -> choose features, model, hyperparameters, anomaly threshold
    TEST        last 15%   -> touched ONCE at the end, for the final report

Run:  python ml/train.py   (after prepare_data.py)
"""
import json
import time
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import CANDIDATES, PER_DAY, PER_HOUR, TARGET, columns_for, make_features, model_ready
from wattwise import MODEL_PATH, flag_anomalies

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"
TRAIN_FRAC, VAL_FRAC = 0.70, 0.15
ANOMALY_TOP_PERCENT = 5        # top 5% of positive VALIDATION residuals
MIN_IMPROVEMENT = 0.005        # forward selection: keep a feature only if val MAE improves >= 0.5%
N_FAILURES = 10

DEFAULTS = {
    "Linear Regression": {},
    "Random Forest": {"n_estimators": 100, "min_samples_leaf": 5, "n_jobs": -1, "random_state": 42},
    "Gradient Boosting": {"n_estimators": 200, "learning_rate": 0.05, "max_depth": 3, "random_state": 42},
}
# Modest grids, searched on VALIDATION only.
GRIDS = {
    "Linear Regression": [{}],
    "Random Forest": [
        {"max_depth": d, "min_samples_leaf": l, "max_features": f}
        for d in (None, 10) for l in (5, 25) for f in (1.0, 0.5)
    ],
    "Gradient Boosting": [
        {"learning_rate": lr, "max_depth": d} for lr in (0.05, 0.1) for d in (2, 3, 4)
    ],
}
CLASSES = {"Linear Regression": LinearRegression, "Random Forest": RandomForestRegressor,
           "Gradient Boosting": GradientBoostingRegressor}


def scores(y, pred):
    return {"MAE_wh": round(float(mean_absolute_error(y, pred)), 2),
            "RMSE_wh": round(float(np.sqrt(mean_squared_error(y, pred))), 2)}


def make_model(name, params=None):
    return CLASSES[name](**{**DEFAULTS[name], **(params or {})})


def fit_eval(name, cols, train, val, params=None):
    model = make_model(name, params).fit(train[cols], train[TARGET])
    return model, scores(train[TARGET], model.predict(train[cols])), scores(val[TARGET], model.predict(val[cols]))


def forward_selection(name, train, val):
    """Start with no features. Repeatedly add the candidate that lowers validation MAE
    the most. Stop when no candidate improves validation MAE by at least 0.5%."""
    selected, best, history = [], np.inf, []
    remaining = list(CANDIDATES)
    while remaining:
        trial = {c: fit_eval(name, columns_for(selected + [c]), train, val)[2]["MAE_wh"] for c in remaining}
        c = min(trial, key=trial.get)
        if trial[c] > best * (1 - MIN_IMPROVEMENT):
            break
        selected.append(c)
        remaining.remove(c)
        best = trial[c]
        history.append({"added": c, "validation_MAE_wh": best})
    return selected, history


def leakage_check(clean, n=20, seed=1):
    """Change every measurement at time t and later; features at t must not change."""
    base = make_features(clean)
    cols = base.columns.drop(TARGET)
    rng = np.random.default_rng(seed)
    for i in rng.choice(np.arange(PER_DAY * 2, len(clean) - 10), n, replace=False):
        t = clean.index[i]
        tampered = clean.copy()
        tampered.loc[t:] = tampered.loc[t:] * -3 + 999
        if not np.allclose(base.loc[t, cols].astype(float), make_features(tampered).loc[t, cols].astype(float), equal_nan=True):
            return {"passed": False, "failed_at": str(t)}
    return {"passed": True, "timestamps_tested": n,
            "method": "all measurements at and after t were changed; every feature at t stayed identical"}


def injection_test(clean, test_start, model, cols, threshold, n_events=30, length=PER_HOUR, extra_wh=150, seed=0):
    """Diagnostic only (no decisions are based on it): add +150 Wh to 30 random one-hour
    windows in the test period and check how many of those intervals get flagged."""
    rng = np.random.default_rng(seed)
    idx = clean.index[clean.index >= test_start][PER_DAY:-length]
    starts = rng.choice(idx, n_events, replace=False)
    step = pd.Timedelta("10min")
    injected, mask = clean.copy(), pd.Series(False, index=clean.index)
    for s in starts:
        mask[s: s + (length - 1) * step] = True
    injected.loc[mask, TARGET] += extra_wh
    data = model_ready(make_features(injected), cols)
    test = data[data.index >= test_start]
    flagged = (test[TARGET] - model.predict(test[cols])) >= threshold
    is_inj = mask.reindex(test.index)
    return {"events": n_events, "event_length_minutes": length * 10, "added_wh_per_interval": extra_wh,
            "injected_intervals_flagged_pct": round(100 * float(flagged[is_inj].mean()), 1),
            "events_with_at_least_one_flag": int(sum(flagged[s: s + (length - 1) * step].any() for s in starts)),
            "flags_on_untouched_intervals": int((flagged & ~is_inj).sum()),
            "note": "Diagnostic on the test period; not used for any choice."}


def period_stats(y, temp):
    return {"rows": len(y), "mean_wh": round(float(y.mean()), 1), "median_wh": float(y.median()),
            "std_wh": round(float(y.std()), 1), "p95_wh": float(y.quantile(0.95)),
            "share_above_300_wh": round(float((y > 300).mean()), 4),
            "mean_outdoor_temp_c": round(float(temp.mean()), 1)}


def main():
    RESULTS.mkdir(exist_ok=True)
    FIGURES.mkdir(exist_ok=True)
    clean = pd.read_csv(ROOT / "data/processed/cleaned.csv", index_col="timestamp", parse_dates=True)
    all_cols = columns_for(CANDIDATES)
    data = model_ready(make_features(clean), all_cols)   # same rows for every feature set

    # ---- Chronological split ------------------------------------------------
    n = len(clean)
    val_start = clean.index[int(n * TRAIN_FRAC)]
    test_start = clean.index[int(n * (TRAIN_FRAC + VAL_FRAC))]
    train = data[data.index < val_start]
    val = data[(data.index >= val_start) & (data.index < test_start)]
    test = data[data.index >= test_start]

    def period(d):
        return [str(d.index.min()), str(d.index.max())]

    # ---- Baseline: training-period average for the same weekday + hour -------
    profile = train.groupby(["day_of_week", "hour"])[TARGET].mean()

    def baseline(d):
        return profile.reindex(pd.MultiIndex.from_arrays([d.day_of_week, d.hour])).values

    # ---- 1. Feature selection per model (validation) ------------------------
    t0 = time.time()
    selection = {}
    for name in CLASSES:
        selected, history = forward_selection(name, train, val)
        selection[name] = {"selected": selected, "steps": history}
        print(f"{name}: {selected}  ({time.time() - t0:.0f}s)", flush=True)

    # ---- 2. Modest hyperparameter search (validation) ------------------------
    validation_comparison, tuned = {}, {}
    for name in CLASSES:
        cols = columns_for(selection[name]["selected"])
        trials = []
        for params in GRIDS[name]:
            model, tr, va = fit_eval(name, cols, train, val, params)
            trials.append({"params": params, "train": tr, "validation": va, "model": model})
        best = min(trials, key=lambda r: r["validation"]["MAE_wh"])
        tuned[name] = best
        validation_comparison[name] = {
            "features": selection[name]["selected"], "best_params": best["params"],
            "validation": best["validation"], "train": best["train"],
            "grid": [{k: v for k, v in r.items() if k != "model"} for r in trials],
        }
    validation_comparison["Baseline"] = {"validation": scores(val[TARGET], baseline(val))}

    selected_name = min(CLASSES, key=lambda m: tuned[m]["validation"]["MAE_wh"])
    model = tuned[selected_name]["model"]
    cols = columns_for(selection[selected_name]["selected"])
    print("Selected on validation:", selected_name, cols, flush=True)

    # ---- 3. Tree investigation (validation only) -----------------------------
    investigation = {
        "overfitting_train_vs_validation": {
            name: {"default_params_all_candidate_features": dict(zip(("train", "validation"), fit_eval(name, all_cols, train, val)[1:])),
                   "tuned_selected_features": {"train": tuned[name]["train"], "validation": tuned[name]["validation"]}}
            for name in CLASSES
        },
        "feature_scaling": {
            "linear_regression_unscaled": fit_eval("Linear Regression", cols, train, val)[2],
            "linear_regression_standard_scaled": scores(
                val[TARGET], make_pipeline(StandardScaler(), LinearRegression()).fit(train[cols], train[TARGET]).predict(val[cols])),
            "note": "Scaling does not change plain linear regression or tree predictions; trees split on thresholds.",
        },
        "lag_feature_quality": {
            f: {"corr_with_target_train": round(float(train[f].corr(train[TARGET])), 3),
                "corr_with_target_validation": round(float(val[f].corr(val[TARGET])), 3),
                "validation_MAE_if_used_as_prediction": scores(val[TARGET], val[f])["MAE_wh"]}
            for f in ["previous_interval", "previous_hour", "previous_day_same_time",
                      "rolling_1h_mean", "rolling_6h_mean", "rolling_24h_mean"]
        },
        "leakage_check": leakage_check(clean),
        "distribution_shift": {
            "train": period_stats(train[TARGET], train.outdoor_temp_c_prev),
            "validation": period_stats(val[TARGET], val.outdoor_temp_c_prev),
            "test": period_stats(test[TARGET], test.outdoor_temp_c_prev),
        },
    }

    # ---- 4. Anomaly threshold from VALIDATION residuals (pre-test) -----------
    val_res = val[TARGET] - model.predict(val[cols])
    ref_positive = val_res[val_res > 0].values
    threshold = float(np.percentile(ref_positive, 100 - ANOMALY_TOP_PERCENT))

    # ---- 5. FINAL TEST: evaluated once ---------------------------------------
    test_pred = model.predict(test[cols])
    final_model = scores(test[TARGET], test_pred)
    final_base = scores(test[TARGET], baseline(test))
    improvement = {k.replace("_wh", "_pct"): round(100 * (final_base[k] - final_model[k]) / final_base[k], 1)
                   for k in final_base}

    results = flag_anomalies(pd.DataFrame({"actual_wh": test[TARGET], "predicted_wh": test_pred}, index=test.index),
                             threshold, ref_positive)
    results.insert(1, "baseline_wh", baseline(test).round(2))
    anomalies = results[results.is_anomaly].drop(columns="is_anomaly")
    results.to_csv(RESULTS / "predictions.csv", index_label="timestamp")
    anomalies.to_csv(RESULTS / "anomalies.csv", index_label="timestamp")

    failures = failure_analysis(test, results, cols)

    joblib.dump({"model": model, "model_name": selected_name, "features": cols,
                 "params": tuned[selected_name]["params"], "threshold_wh": threshold,
                 "reference_positive_residuals": ref_positive, "trained_on": period(train)},
                MODEL_PATH, compress=3)

    metrics = {
        "dataset": {
            "name": "UCI Appliances Energy Prediction (Candanedo et al., 2017)",
            "what_is_measured": "appliance electricity use of one low-energy house, Wh per 10-minute interval",
            "rows": len(clean), "interval": "10 minutes", "units": "Wh per 10-minute interval",
            "license": "CC BY 4.0",
        },
        "split": "chronological 70% / 15% / 15%, never shuffled",
        "train_period": period(train),
        "validation_period": period(val),
        "test_period": period(test),
        "validation_model_comparison": {k: {kk: vv for kk, vv in v.items() if kk != "grid"}
                                        for k, v in validation_comparison.items()},
        "selected_model": {"name": selected_name, "features": selection[selected_name]["selected"],
                           "params": tuned[selected_name]["params"],
                           "selection_rule": "lowest validation MAE (test set not used)"},
        "final_test_baseline": final_base,
        "final_test_selected_model": final_model,
        "percentage_improvement_over_baseline": improvement,
        "reference_copy_previous_interval_no_ML": {
            "validation": scores(val[TARGET], val.previous_interval),
            "final_test": scores(test[TARGET], test.previous_interval),
            "note": "Naive rule 'next 10 minutes = last 10 minutes'. Reported for honesty; not used for selection.",
        },
        "anomaly_methodology": {
            "residual": "actual - predicted",
            "threshold_rule": f"{100 - ANOMALY_TOP_PERCENT}th percentile of POSITIVE residuals on the validation period",
            "threshold_wh": round(threshold, 2),
            "validation_positive_residuals": int(len(ref_positive)),
            "final_test_flagged_intervals": int(len(anomalies)),
            "final_test_flagged_periods": int(anomalies.period_id.nunique()),
            "score": "percentile of the residual within validation positive residuals",
            "injection_diagnostic": injection_test(clean, test_start, model, cols, threshold),
        },
        "failure_analysis": failures,
        "feature_selection": selection,
        "tree_model_investigation": investigation,
        "hyperparameter_grids": {k: v["grid"] for k, v in validation_comparison.items() if "grid" in v},
    }
    (RESULTS / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    make_figures(validation_comparison, results, threshold)
    print(json.dumps({k: metrics[k] for k in ["selected_model", "final_test_baseline", "final_test_selected_model",
                                              "percentage_improvement_over_baseline"]}, indent=2))


def failure_analysis(test, results, cols):
    """Largest absolute test errors, described only by what the model could observe."""
    err = results.actual_wh - results.predicted_wh
    worst = err.abs().nlargest(N_FAILURES).index
    shown = [c for c in ["previous_interval", "previous_hour", "rolling_1h_mean", "rolling_6h_mean",
                         "previous_day_same_time", "lights_previous_interval"] if c in cols]
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rows = []
    for ts in worst:
        r = results.loc[ts]
        rows.append({"timestamp": str(ts), "day": days[ts.day_of_week],
                     **{c: round(float(test.loc[ts, c]), 1) for c in shown},
                     "predicted_wh": float(r.predicted_wh), "actual_wh": float(r.actual_wh),
                     "error_wh": round(float(r.actual_wh - r.predicted_wh), 1)})
    over = sum(r["error_wh"] > 0 for r in rows)
    notes = [
        f"{over} of the {len(rows)} largest errors are intervals where actual use was HIGHER than predicted.",
        "The model sees only these inputs, all from BEFORE the predicted interval: " + ", ".join(cols) + ".",
        "It cannot see: which appliance was switched on, how many people were home, cooking/laundry/visitor "
        "schedules, or meter errors.",
        "Sudden switch-on events cannot be predicted from the past alone, so the first interval of a spike is always hard.",
        "We do not claim causes for these errors.",
    ]
    lines = ["# Failure analysis: largest prediction errors on the final test period", "",
             "Only what the model could observe is shown. We do **not** know why these intervals were unusual.", "",
             "| " + " | ".join(rows[0]) + " |", "|" + "---|" * len(rows[0])]
    lines += ["| " + " | ".join(str(v) for v in r.values()) + " |" for r in rows]
    lines += ["", "## Notes", ""] + [f"- {n}" for n in notes]
    lines += ["", "A flagged interval is a **period requiring investigation**, not proof of waste."]
    (RESULTS / "failure_analysis.md").write_text("\n".join(lines), encoding="utf-8")
    return {"largest_errors": rows, "notes": notes}


def make_figures(validation_comparison, results, threshold):
    names = ["Baseline", "Linear Regression", "Random Forest", "Gradient Boosting"]
    fig, ax = plt.subplots(figsize=(8, 4))
    x = np.arange(len(names))
    ax.bar(x - 0.2, [validation_comparison[n]["validation"]["MAE_wh"] for n in names], 0.4, label="MAE")
    ax.bar(x + 0.2, [validation_comparison[n]["validation"]["RMSE_wh"] for n in names], 0.4, label="RMSE")
    ax.set_xticks(x, names, fontsize=8)
    ax.set_ylabel("Wh per 10 min (lower is better)")
    ax.set_title("Validation error (used to choose the model)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "model_comparison.png", dpi=120)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(results.residual_wh, bins=120, color="grey")
    ax.axvline(threshold, color="red", label=f"threshold from validation = {threshold:.0f} Wh")
    ax.set_xlabel("Residual = actual - predicted (Wh)")
    ax.set_ylabel("10-minute intervals")
    ax.set_title("Final test residuals")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "residual_distribution.png", dpi=120)
    plt.close(fig)

    top = results.residual_wh.idxmax()
    day = results.loc[top - pd.Timedelta("12h"): top + pd.Timedelta("12h")]
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(day.index, day.actual_wh, label="actual")
    ax.plot(day.index, day.predicted_wh, label="expected (model)")
    flagged = day[day.is_anomaly]
    ax.scatter(flagged.index, flagged.actual_wh, color="red", zorder=3, label="flagged for investigation")
    ax.set_ylabel("Wh per 10 min")
    ax.set_title("24 hours around the largest positive residual (test period)")
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(FIGURES / "example_day.png", dpi=120)
    plt.close(fig)


if __name__ == "__main__":
    main()
