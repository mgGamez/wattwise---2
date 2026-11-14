# Failure analysis: largest prediction errors on the final test period

Only what the model could observe is shown. We do **not** know why these intervals were unusual.

| timestamp | day | previous_interval | rolling_1h_mean | rolling_6h_mean | predicted_wh | actual_wh | error_wh |
|---|---|---|---|---|---|---|---|
| 2016-05-21 09:40:00 | Sat | 390.0 | 181.7 | 93.6 | 264.98 | 790.0 | 525.0 |
| 2016-05-27 09:40:00 | Fri | 50.0 | 73.3 | 80.8 | 60.33 | 580.0 | 519.7 |
| 2016-05-16 17:40:00 | Mon | 110.0 | 100.0 | 145.0 | 118.31 | 630.0 | 511.7 |
| 2016-05-26 11:40:00 | Thu | 100.0 | 123.3 | 156.4 | 104.22 | 600.0 | 495.8 |
| 2016-05-26 09:50:00 | Thu | 460.0 | 161.7 | 95.8 | 329.89 | 820.0 | 490.1 |
| 2016-05-07 18:10:00 | Sat | 80.0 | 81.7 | 87.8 | 87.06 | 560.0 | 472.9 |
| 2016-05-21 11:10:00 | Sat | 110.0 | 356.7 | 179.4 | 122.86 | 590.0 | 467.1 |
| 2016-05-13 07:50:00 | Fri | 80.0 | 98.3 | 77.2 | 94.11 | 560.0 | 465.9 |
| 2016-05-13 11:10:00 | Fri | 110.0 | 80.0 | 149.4 | 136.25 | 600.0 | 463.8 |
| 2016-05-21 13:10:00 | Sat | 80.0 | 196.7 | 269.7 | 104.02 | 550.0 | 446.0 |

## Notes

- 10 of the 10 largest errors are intervals where actual use was HIGHER than predicted.
- The model sees only these inputs, all from BEFORE the predicted interval: previous_interval, rolling_1h_mean, rolling_6h_mean.
- It cannot see: which appliance was switched on, how many people were home, cooking/laundry/visitor schedules, or meter errors.
- Sudden switch-on events cannot be predicted from the past alone, so the first interval of a spike is always hard.
- We do not claim causes for these errors.

A flagged interval is a **period requiring investigation**, not proof of waste.