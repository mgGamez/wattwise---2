"""Export the selected model for exact in-browser inference.

Writes (committed, consumed by the website):
  website/src/data/wattwise-model.json  - every tree of the Gradient Boosting model,
                                          feature order + definitions, anomaly calibration
  website/src/data/demo-samples.json    - real held-out TEST examples with their raw
                                          36-reading history (inputs only, plus the Python
                                          reference prediction for verification)
  website/src/data/golden.json          - golden cases: raw history -> Python features ->
                                          Python prediction / percentile / flag

The browser recomputes features from the raw readings and walks the trees itself.

Run:  python ml/export_web.py   (after train.py)
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from features import CANDIDATES, PER_DAY, TARGET, columns_for, make_features, model_ready

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "website" / "src" / "data"
HISTORY = 36  # rolling_6h_mean needs the 36 readings before t

FEATURE_DEFINITIONS = {
    "previous_interval": {"label": "Previous 10-minute reading", "rule": "reading at t - 10 min"},
    "rolling_1h_mean": {"label": "Average of the last hour", "rule": "mean of the 6 readings before t"},
    "rolling_6h_mean": {"label": "Average of the last 6 hours", "rule": "mean of the 36 readings before t"},
}


def export_trees(model):
    trees = []
    for est in model.estimators_[:, 0]:
        t = est.tree_
        trees.append({
            "left": t.children_left.tolist(),
            "right": t.children_right.tolist(),
            "feature": t.feature.tolist(),
            "threshold": t.threshold.tolist(),
            "value": t.value[:, 0, 0].tolist(),
        })
    return trees


def main():
    bundle = joblib.load(ROOT / "model" / "wattwise_model.joblib")
    model, features = bundle["model"], bundle["features"]
    assert type(model).__name__ == "GradientBoostingRegressor", "export_web.py expects the Gradient Boosting model"
    assert features == ["previous_interval", "rolling_1h_mean", "rolling_6h_mean"], features
    metrics = json.loads((ROOT / "results" / "metrics.json").read_text())

    clean = pd.read_csv(ROOT / "data/processed/cleaned.csv", index_col="timestamp", parse_dates=True)
    feats = make_features(clean)
    data = model_ready(feats, columns_for(CANDIDATES))
    train_end, test_start = pd.Timestamp(metrics["train_period"][1]), pd.Timestamp(metrics["test_period"][0])
    train, test = data[data.index <= train_end], data[data.index >= test_start]

    ref = np.sort(np.asarray(bundle["reference_positive_residuals"], dtype=float))
    threshold = float(bundle["threshold_wh"])

    def percentile(residual):
        if residual <= 0:
            return 0.0
        return float(np.searchsorted(ref, residual, side="right") / len(ref) * 100)

    model_json = {
        "format": "sklearn-gradient-boosting-regressor/v1",
        "modelName": bundle["model_name"],
        "params": bundle["params"],
        "features": features,
        "featureDefinitions": FEATURE_DEFINITIONS,
        "historyIntervals": HISTORY,
        "intervalMinutes": 10,
        "units": "Wh per 10-minute interval",
        "inputDtype": "float32",
        "init": float(model.init_.constant_.ravel()[0]),
        "learningRate": float(model.learning_rate),
        "trees": export_trees(model),
        "trainingRange": {f: [float(train[f].min()), float(train[f].max())] for f in features},
        "calibration": {
            "rule": metrics["anomaly_methodology"]["threshold_rule"],
            "thresholdWh": threshold,
            "referencePositiveResiduals": ref.tolist(),
        },
        "trainedOn": bundle["trained_on"],
    }

    def history_for(ts):
        i = clean.index.get_loc(ts)
        window = clean[TARGET].iloc[i - HISTORY:i]
        assert len(window) == HISTORY and window.notna().all()
        return [float(v) for v in window.values]

    def case(ts):
        row = test.loc[ts]
        x = row[features].to_frame().T.astype(float)
        pred = float(model.predict(x)[0])
        actual = float(row[TARGET])
        residual = actual - pred
        return {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M"),
            "actualWh": actual,
            "history": history_for(ts),
            "pythonFeatures": {f: float(row[f]) for f in features},
            "pythonExpectedWh": pred,
            "pythonResidualWh": residual,
            "pythonPercentile": percentile(residual),
            "pythonFlagged": bool(residual >= threshold),
        }

    # ---- demo samples: chosen by rules over the real test predictions
    preds = pd.Series(model.predict(test[features]), index=test.index)
    res = test[TARGET] - preds
    flagged = res >= threshold
    picks = []

    def add(ts, kind):
        if ts not in [p[0] for p in picks]:
            picks.append((ts, kind))

    add(res.idxmax(), "Largest unexpected spike in the test period")
    add(test[flagged][TARGET].idxmin(), "Lower reading the model flagged as unusual")
    normal_band = (~flagged) & (res.abs() <= 0.3 * threshold)
    add(test[normal_band][TARGET].idxmax(), "High reading the model considered normal")
    night = test[(test.index.hour == 3) & (res.abs() < 10)]
    add(night.index[len(night) // 2], "A quiet night-time reading")
    add(res.idxmin(), "Reading far below what the model expected")
    evening = test[(test.index.hour == 19) & (~flagged) & (res > 0)]
    add(evening.index[len(evening) // 2], "An ordinary evening reading")

    demos = []
    for ts, kind in picks:
        c = case(ts)
        demos.append({
            "id": ts.strftime("demo-%Y%m%d-%H%M"),
            "label": "Held-out test example",
            "description": kind,
            "timestamp": c["timestamp"],
            "actualWh": c["actualWh"],
            "history": c["history"],
            "pythonReference": {"expectedWh": c["pythonExpectedWh"], "percentile": c["pythonPercentile"]},
        })

    # ---- golden cases: the demos + evenly spaced test rows
    spaced = test.index[np.linspace(PER_DAY, len(test) - 1, 14).astype(int)]
    golden_ts = [p[0] for p in picks] + [ts for ts in spaced if ts not in [p[0] for p in picks]]
    golden = {
        "description": "Python reference outputs for browser inference tests (raw history -> features -> prediction)",
        "tolerance": {"expectedWh": 1e-6, "featureWh": 1e-9},
        "cases": [case(ts) for ts in golden_ts],
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "wattwise-model.json").write_text(json.dumps(model_json, separators=(",", ":")))
    (OUT / "demo-samples.json").write_text(json.dumps(demos, indent=1))
    (OUT / "golden.json").write_text(json.dumps(golden, indent=1))
    print(f"model: {len(model_json['trees'])} trees, init={model_json['init']:.6f}, lr={model_json['learningRate']}")
    print(f"demo samples: {len(demos)}  golden cases: {len(golden['cases'])}")
    for d in demos:
        print(f"  {d['timestamp']}  actual={d['actualWh']:.0f}  python expected={d['pythonReference']['expectedWh']:.2f}  {d['description']}")


if __name__ == "__main__":
    main()
