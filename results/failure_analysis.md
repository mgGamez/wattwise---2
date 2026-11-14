# Failure analysis: the model's largest prediction errors (2017 test year)

These are the hours where the model was most wrong, in either direction.
We do **not** know why these hours were unusual. The table only shows what the
model could see when it made the prediction.

| Timestamp | Day | Holiday | Yesterday was | Temp prev hr (°C) | Same hour yesterday (kWh) | Last-24h avg (kWh) | Last-7-day avg (kWh) | Predicted | Actual | Error | Direction |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2017-05-30 09:00 | Tue | no | holiday | 17.2 | 149.5 | 159.8 | 181.4 | 162.1 | 308.7 | +146.7 | used MORE than expected |
| 2017-09-11 09:00 | Mon | no | weekend | 16.7 | 195.5 | 203.2 | 230.0 | 191.0 | 334.2 | +143.2 | used MORE than expected |
| 2017-05-30 10:00 | Tue | no | holiday | 17.8 | 153.3 | 166.5 | 181.9 | 165.1 | 300.8 | +135.8 | used MORE than expected |
| 2017-09-11 10:00 | Mon | no | weekend | 18.3 | 200.8 | 208.9 | 230.9 | 198.5 | 322.9 | +124.4 | used MORE than expected |
| 2017-08-31 08:00 | Thu | no | weekday | 21.1 | 200.7 | 192.2 | 220.8 | 204.3 | 323.3 | +119.0 | used MORE than expected |
| 2017-09-05 09:00 | Tue | no | holiday | 22.2 | 186.9 | 195.6 | 211.7 | 216.9 | 335.2 | +118.4 | used MORE than expected |
| 2017-08-31 09:00 | Thu | no | weekday | 22.2 | 212.2 | 197.3 | 220.9 | 207.6 | 324.4 | +116.7 | used MORE than expected |
| 2017-09-05 08:00 | Tue | no | holiday | 21.7 | 180.8 | 190.0 | 211.6 | 197.9 | 314.3 | +116.5 | used MORE than expected |
| 2017-04-27 10:00 | Thu | no | weekday | 20.0 | 175.0 | 169.4 | 153.4 | 177.8 | 294.2 | +116.4 | used MORE than expected |
| 2017-09-11 11:00 | Mon | no | weekend | 20.6 | 202.7 | 214.0 | 231.7 | 203.3 | 317.0 | +113.7 | used MORE than expected |

## What the model can observe

- The clock and calendar: hour, weekday, month, weekend and US federal holidays.
- Outdoor temperature and humidity from the previous hour.
- This building's own recent consumption: same hour yesterday, last-24-hour and last-7-day averages.
  (It deliberately does NOT use the previous hour - see docs/ML_EXPLAINED.md.)

## What the model cannot observe

- The school timetable: term dates, exam weeks, snow days, teacher-only days, summer programmes.
- Occupancy: how many people are in the building.
- Events: evening events, sports, rentals, building works.
- Equipment: what is switched on, maintenance, faults, setpoint or schedule changes.
- Metering problems: a wrong reading looks the same to the model as real usage.

Any of these could explain a large error, and the model cannot tell them apart.
A flagged hour is a **period requiring investigation**, not proof of waste.

## Patterns visible from the data alone

- The model leans on 'same hour yesterday' and the 24-hour average, so the first
  day after a change in routine (e.g. a weekday after a day off, or a day off after
  a normal weekday) tends to produce large errors.
- Federal holidays are known to the model, but school-specific closures are not.