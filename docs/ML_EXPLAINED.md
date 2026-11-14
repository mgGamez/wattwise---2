# How WATTWISE works – explained simply

This guide is for explaining the project to judges. All numbers come from `results/metrics.json`.

---

## 1. What does the model predict?

Every 10 minutes, the model predicts **how much energy the appliances would normally use in the next 10 minutes** (in Wh), based on what happened just before.

That's the **expected usage**. We compare it with what the meter actually measured. If usage was far higher than expected, that interval is worth a closer look.

> The model predicts "normal", not "waste". Anything far above normal is a **period requiring investigation**.

The data is one house's appliance energy (UCI Appliances Energy Prediction), in **Wh per 10-minute interval**. It's not a school or office.

---

## 2. What do the input features mean?

We built 14 candidate features (some are groups of columns). Every one uses only information from **before** the interval being predicted:

| Feature | Meaning |
|---|---|
| `hour`, `hour_cyclic` | time of day; the cyclic version uses sin/cos so 23:50 and 00:00 count as close together |
| `day_of_week`, `day_of_week_cyclic`, `is_weekend` | which day it is |
| `previous_interval` | Wh used in the previous 10 minutes |
| `previous_hour` | Wh used in the 10 minutes one hour ago |
| `previous_day_same_time` | Wh used at the same time yesterday |
| `rolling_1h_mean` / `rolling_6h_mean` / `rolling_24h_mean` | average use over the last 1 / 6 / 24 hours (not including now) |
| `lights_previous_interval` | lighting energy in the previous 10 minutes |
| outdoor / indoor sensors (previous interval) | weather, room temperatures and humidity, 10 minutes earlier |

**Only features that improved validation performance were kept.** The method is forward selection: start with nothing, repeatedly add the single feature that lowers validation MAE the most, and stop when no feature improves it by at least 0.5%. The selected Gradient Boosting model uses just three features:

- **previous_interval**
- **rolling_1h_mean**
- **rolling_6h_mean**

Time of day, weekday, weather and indoor sensors did **not** improve validation performance, so they were left out.

---

## 3. What is a baseline?

A **baseline** is the simplest reasonable method, used as a yardstick. Ours: *"for each weekday and hour, the average usage in the training period."* If ML can't beat it, ML isn't worth it.

We also report a second, tougher reference: **"copy the previous 10-minute reading"**. It isn't ML, but it's a strong guess (section 9).

---

## 4. Why train / validation / test, in time order?

We split the data **by time**:

| Period | Share | Purpose |
|---|---|---|
| Train (12 Jan – 16 Apr) | 70% | the models learn from this |
| Validation (16 Apr – 7 May) | 15% | we compare models, choose features and settings, and set the anomaly threshold |
| Test (7 May – 27 May) | 15% | looked at **once**, at the very end |

**Why not shuffle?** With shuffled rows, the model could learn from 10:00 and 10:20 and then be "tested" on 10:10. That's easy because the neighbours give the answer away. In real life you only have the past.

**Why a separate validation set?** If we picked the best model by looking at test results, the test score would be flattering: we'd have chosen whatever happened to fit that period. With validation used for every choice, the test score is an honest estimate of performance on new data.

### How we prevent data leakage
- Every lag and rolling feature starts with `.shift(1)`, so it ends at the previous interval.
- Sensors are taken from the previous interval.
- **Automatic check:** for 20 random times *t*, we changed every measurement at *t* and later, rebuilt the features, and confirmed that the features at *t* didn't change. Result: **passed**.

---

## 5. MAE

**Mean Absolute Error**: the average size of the error, ignoring direction. Errors of +10, −5 and +3 give MAE = 18 / 3 = **6 Wh**.

## 6. RMSE

**Root Mean Squared Error**: square the errors, average them, take the square root. Big errors count much more. The same errors give √((100 + 25 + 9) / 3) ≈ **6.7 Wh**.

When RMSE is much bigger than MAE, there are some large misses. In our data those are sudden spikes.

## Results

**Validation** (used for choosing):

| Model | MAE | RMSE |
|---|---|---|
| Baseline | 49.10 | 88.70 |
| Linear Regression | 26.04 | 61.88 |
| Random Forest | 26.81 | 60.89 |
| **Gradient Boosting (selected)** | **25.90** | **59.44** |

**Final test** (evaluated once):

| | MAE | RMSE |
|---|---|---|
| Baseline | 48.69 | 86.86 |
| **Gradient Boosting** | **26.26** | **60.42** |
| Improvement | **46.1%** | **30.4%** |

---

## 7. What is a residual?

```
residual = actual − predicted
```

A residual of +300 Wh means 300 Wh **more** than expected in those 10 minutes. We focus on large positive residuals.

## 8. How does anomaly detection work?

1. Calculate residuals on the **validation** period (never the test period).
2. Keep only the positive ones (1,049 intervals).
3. Take the value that only the top 5% exceed: **219 Wh**. This threshold comes from the data, not a hand-picked number.
4. On the test period, any interval with a residual of at least 219 Wh is flagged. That gives **49 intervals in 42 periods**.
5. Each flagged interval gets a percentile score, e.g. 99.5 means "bigger than 99.5% of the positive surprises seen in validation".

---

## 9. Honest findings

**ML only slightly beats "copy the last reading".** On the test period, copying the previous 10-minute value gets MAE 26.7. The model gets 26.3. The model's bigger advantage is RMSE (60.4 vs 66.8): when a spike ends, it returns to normal faster than a copy would. Appliance use in a house is mostly short, random switch-on events that the past can't predict.

**Why the tree models looked worse before.** When given **all** candidate features, Random Forest and Gradient Boosting overfit:

| | Train MAE | Validation MAE |
|---|---|---|
| Random Forest, all features | 19.7 | 32.9 |
| Gradient Boosting, all features | 28.6 | 38.0 |
| Random Forest, selected features | 30.4 | 26.8 |
| Gradient Boosting, selected features | 27.9 | 25.9 |

With many indoor and outdoor sensor columns, trees memorise training-period details. On top of that, the weather changes over time: the mean outdoor temperature is 5.7 °C in training, 8.2 °C in validation and 14.5 °C in test. Trees can't extrapolate to values they never saw. Using fewer features and modest settings (`min_samples_leaf=25`, `max_depth=4`) removed the overfitting. Feature scaling made no difference, as expected for these models.

**The detector only catches large jumps.** In a diagnostic, we added +150 Wh for one hour at 30 random times in the test period. Only 3.4% of those intervals were flagged. The reasons:
- the threshold (219 Wh) is above +150 Wh;
- after the first 10 minutes, the model's "previous interval" input already contains the extra usage, so it expects it.

So WATTWISE in its current form flags **big sudden spikes**, not moderate sustained increases.

---

## 10. What the model cannot know

The model only sees the last few hours of appliance usage. It cannot see:
- which appliance was switched on (oven, washing machine, kettle...)
- how many people are at home, or their schedule
- visitors, holidays or changes in routine
- meter errors

All 10 of the largest test errors were intervals where use was far **higher** than expected, typically 450–525 Wh above. These are sudden switch-ons that the past can't predict. We don't guess what caused them.

## 11. Remaining limitations

- **One house, 4.5 months.** The test period (May) is warmer than training (Jan–Apr).
- **The model is trained on the training period only.** It doesn't learn from validation data, because that data was needed to set the threshold honestly.
- **Validation scores are slightly optimistic**, because we chose features and settings with them. The test score is the honest number.
- **"Top 5%" is relative.** It always flags some intervals, even in a perfectly normal period.
- **No real labels.** We can't measure true detection accuracy on real anomalies.
