# How WATTWISE works – explained simply

This guide is for explaining the project to judges. All numbers come from `results/metrics.json`.

---

## 1. What does the model predict?

For every hour, the model predicts **how much electricity the school would normally use in that hour** (in kWh), given the time, the weather and the building's recent history.

We call this the **expected usage**. Then we compare it with what the meter actually measured. If the building used a lot more than expected, that hour is worth a closer look.

> The model does not predict "waste". It predicts "normal". Anything far above normal is a **period requiring investigation**.

---

## 2. What do the input features mean?

A *feature* is one piece of information the model gets to make its prediction. For the hour being predicted (call it hour *t*):

| Feature | Meaning | Why it helps |
|---|---|---|
| `hour` | 0–23 | Schools use more power during the school day |
| `day_of_week` | 0 = Monday … 6 = Sunday | Weekdays and weekends behave differently |
| `month` | 1–12 | Seasons (e.g. air-conditioning in summer) |
| `is_weekend` | 1 on Saturday/Sunday | Same idea, made explicit |
| `is_holiday` | 1 on a US federal holiday | Building is usually quiet |
| `temperature_prev_hour` | outdoor °C one hour before *t* | Hot weather means more cooling |
| `humidity_prev_hour` | outdoor % humidity one hour before *t* | Humid weather affects cooling |
| `previous_day_same_hour` | kWh used at the same hour yesterday | "Yesterday at 10am" is a good guess for "today at 10am" |
| `rolling_24h_average` | average kWh over the 24 hours before *t* | The building's current level |
| `rolling_7day_average` | average kWh over the 7 days before *t* | The building's level this week |

We also built `previous_hour_consumption` (kWh in the hour before *t*). We tested it, and then **chose not to use it** in the anomaly detector. See section 9.

---

## 3. What is a baseline?

A **baseline** is the simplest reasonable method, used as a yardstick. If our ML model can't beat it, the ML isn't worth using.

Our baseline: *"For each weekday and hour, take the average usage from 2016."* For example, the prediction for any Tuesday at 10:00 in 2017 = the average of all Tuesdays at 10:00 in 2016.

We also show a second simple reference: *"copy the previous hour"*. It's not ML at all, but it's a strong guess, and it shows why "more accurate" is not always "more useful" (section 9).

---

## 4. Why must the split be chronological?

We train on **2016** and test on **2017**. We never shuffle the hours.

If we shuffled, the model could be trained on Tuesday 10:00 and 12:00 and then "tested" on 11:00 on the same day. That's easy because it already saw the answer's neighbours. In real life a facilities manager only ever has the past and wants to judge the present. Testing on a whole year the model has never seen is the honest version of that.

### How we prevent data leakage (using the future by accident)
- Every consumption feature starts with `.shift(1)`, meaning "look at the past only". The 24-hour average for 10:00 uses 10:00 yesterday up to 09:00 today, never 10:00 itself.
- Weather is taken from the **previous** hour.
- Missing weather is filled by copying the **last** known value, never by averaging with a future value.
- The baseline averages use **2016 only**.
- No model settings were tuned by looking at 2017 results.

---

## 5. What does MAE mean?

**Mean Absolute Error**: on average, how many kWh the prediction is off by, ignoring whether it's too high or too low.

Example: errors of +10, −5 and +3 give MAE = (10 + 5 + 3) / 3 = **6 kWh**.

Our best model's MAE on 2017 is **11.1 kWh**. The school uses about 196 kWh per hour on average, so the typical error is about 6%.

## 6. What does RMSE mean?

**Root Mean Squared Error**: square every error, average them, then take the square root.

Squaring makes big errors count much more. Example: errors of +10, −5 and +3 give RMSE = √((100 + 25 + 9) / 3) ≈ **6.7 kWh**, which is higher than the MAE of 6.

If RMSE is much bigger than MAE, the model has some large misses. Ours: MAE 11.1, RMSE 17.5.

## Results on the unseen 2017 year

| Method | MAE (kWh) | RMSE (kWh) |
|---|---|---|
| Baseline (2016 weekday + hour average) | 44.64 | 52.40 |
| Linear Regression | 13.41 | 20.67 |
| **Random Forest (chosen)** | **11.12** | 17.49 |
| Gradient Boosting | 11.33 | 16.86 |

Random Forest has the lowest MAE, so we picked it. Gradient Boosting is almost the same and has slightly lower RMSE, so the two are essentially tied. All three ML models are about **4× better than the baseline**.

---

## 7. What is a residual?

```
residual = actual usage − predicted usage
```

- Residual **+50** means the building used 50 kWh **more** than expected in that hour.
- Residual **−20** means it used 20 kWh **less** than expected.

We only care about **large positive residuals** (unexpectedly high usage).

## 8. How does anomaly detection work?

1. Predict every hour of 2017 and calculate the residual.
2. Keep only the positive residuals (4,553 hours).
3. Find the value that only the **top 5%** of them exceed. For us that's **40.9 kWh**. We did not pick this number by hand; it comes from the data.
4. Every hour with a residual of at least 40.9 kWh is flagged. That gives **228 hours**, grouped into **49 periods** of consecutive hours.
5. Each flagged hour gets a **percentile score**. For example, 99 means "bigger than 99% of the positive surprises".

Saved in `results/anomalies.csv`: timestamp, actual, predicted, residual, % above prediction, percentile, period id.

**Limitation:** "top 5%" always flags 5% of positive hours, even in a perfectly normal year. It's a ranking ("look at these first"), not proof that something is wrong.

---

## 9. Our most interesting finding: more accurate ≠ better detector

With `previous_hour_consumption` included, the models are far more accurate (Random Forest MAE **4.2** instead of 11.1). However, just copying the previous hour without any ML already gets MAE **4.4**. That model mostly learns "next hour ≈ this hour".

The problem: if usage jumps up and **stays** up (say equipment left running all night), then after the first hour, "this hour" is already high. The model then expects high usage and stops flagging it.

**How we tested it.** Real anomalies aren't labelled, so we made fake ones. We picked 30 random 12-hour windows in 2017, raised usage by 25%, and checked what each detector flagged:

| Detector | Fake-spike hours flagged | Fake spikes noticed at all | Flags on normal hours |
|---|---|---|---|
| Pattern model (no previous hour) – **used** | **48.8%** | 22 / 30 | 211 |
| All features incl. previous hour | 33.7% | 29 / 30 | 192 |

This is a trade-off. The previous-hour model notices that *something* started in more cases. The pattern model keeps flagging the spike for **longer**, which is closer to the question a facilities manager cares about: *"how long was usage too high?"* We chose the pattern model and report both.

---

## 10. What the model cannot know

The model only sees the clock, the calendar, the outdoor weather and the meter's own history. It **cannot** see:

- the school timetable: term start/end, exam weeks, snow days, teacher-only days, summer programmes
- how many people are in the building
- events: evening events, sports, rentals, construction
- equipment: what's switched on, faults, maintenance, thermostat or schedule changes
- metering errors: a wrong reading looks just like real usage

Looking at the 10 biggest errors (`results/failure_analysis.md`), **all** of them are hours where the school used more than expected. They're all in the morning, and several fall on the first day back after a long weekend (the days after Memorial Day and Labor Day, and a Monday). The model leans on "yesterday" and "last 24 hours". When yesterday was a quiet day, it expects a quiet day today. We can see *when* the model fails, but we can't tell *why* the building used more energy, so we don't guess.

Most flagged hours are in late May and August–September, during the daytime. That's a pattern in *when* flags happen, not an explanation.

## 11. Other limitations

- **One building, two years.** Results may not carry over to other buildings.
- **One test year.** The model is trained on only one year, so it has seen each season only once.
- **Choosing the best model on the test year** is a small form of selection, but with three similar models it barely matters.
- **No real labels.** We can't measure true accuracy of anomaly detection on real data, which is why we used the fake-spike test.
