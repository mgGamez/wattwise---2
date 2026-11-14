# Failure analysis: largest prediction errors on the final test period

Only what the model could observe is shown. We do **not** know why these intervals were unusual.

| timestamp | day | previous_interval | rolling_1h_mean | rolling_6h_mean | predicted_wh | actual_wh | error_wh | absolute_error_wh | direction | flagged_as_anomaly |
|---|---|---|---|---|---|---|---|---|---|---|
| 2016-05-21 09:40:00 | Sat | 390.0 | 181.7 | 93.6 | 264.98 | 790.0 | 525.0 | 525.0 | under-predicted (used more than expected) | True |
| 2016-05-27 09:40:00 | Fri | 50.0 | 73.3 | 80.8 | 60.33 | 580.0 | 519.7 | 519.7 | under-predicted (used more than expected) | True |
| 2016-05-16 17:40:00 | Mon | 110.0 | 100.0 | 145.0 | 118.31 | 630.0 | 511.7 | 511.7 | under-predicted (used more than expected) | True |
| 2016-05-26 11:40:00 | Thu | 100.0 | 123.3 | 156.4 | 104.22 | 600.0 | 495.8 | 495.8 | under-predicted (used more than expected) | True |
| 2016-05-26 09:50:00 | Thu | 460.0 | 161.7 | 95.8 | 329.89 | 820.0 | 490.1 | 490.1 | under-predicted (used more than expected) | True |
| 2016-05-26 10:00:00 | Thu | 820.0 | 276.7 | 116.9 | 643.97 | 350.0 | -294.0 | 294.0 | over-predicted (used less than expected) | False |
| 2016-05-21 11:00:00 | Sat | 470.0 | 383.3 | 178.3 | 384.65 | 110.0 | -274.6 | 274.6 | over-predicted (used less than expected) | False |
| 2016-05-18 16:50:00 | Wed | 240.0 | 106.7 | 81.4 | 333.12 | 60.0 | -273.1 | 273.1 | over-predicted (used less than expected) | False |
| 2016-05-19 18:00:00 | Thu | 520.0 | 208.3 | 91.4 | 396.22 | 160.0 | -236.2 | 236.2 | over-predicted (used less than expected) | False |
| 2016-05-21 11:40:00 | Sat | 600.0 | 516.7 | 228.6 | 492.16 | 260.0 | -232.2 | 232.2 | over-predicted (used less than expected) | False |

## Notes

- Shown: the 5 largest under-predictions and the 5 largest over-predictions on the final test period.
- The largest under-prediction is 525.0 Wh; the largest over-prediction is 294.0 Wh.
- The model sees only these inputs, all from BEFORE the predicted interval: previous_interval, rolling_1h_mean, rolling_6h_mean.
- It cannot see: which appliance was switched on, how many people were home, cooking/laundry/visitor schedules, or meter errors.
- Sudden switch-on events cannot be predicted from the past alone, so the first interval of a spike is always hard.
- We do not claim causes for these errors.

A flagged interval is a **period requiring investigation**, not proof of waste.