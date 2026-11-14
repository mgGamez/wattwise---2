# Dataset

## Source

**Building Data Genome Project 2 (BDG2)**
- Repository: https://github.com/buds-lab/building-data-genome-project-2
- Paper: Miller, C. et al. (2020). *The Building Data Genome Project 2, energy meter data from the ASHRAE Great Energy Predictor III competition.* Scientific Data 7, 368. https://doi.org/10.1038/s41597-020-00712-x
- **License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).** We must credit the source (above), and any data we share that is derived from it (the files in `data/`) is shared under the same license.

BDG2 contains hourly meter data from 1,636 non-residential buildings. We use **one building**.

## The building we use

| Item | Value |
|---|---|
| Building ID | `Rat_education_Dann` |
| Type | Education, K-12 School |
| Location | Washington DC area, USA (timezone US/Eastern) |
| Floor area | 16,955 m² (182,500 ft²) |
| Year built | 1970 |

**Why this building?** We screened all 109 K-12 school buildings in BDG2 for data quality: few missing hours, no near-zero readings, no long stretches of identical readings, and a similar pattern in 2016 and 2017. `Rat_education_Dann` was one of the most stable. We first tried `Rat_education_Theo` (the school with the fewest missing hours), but its electricity dropped almost to zero from October 2016 to January 2017, and 2017 was about half the level of 2016. That looks like a building change or a meter problem, which would make "normal" impossible to learn.

## Files

| File | What one row is | Rows | Columns |
|---|---|---|---|
| `raw/rat_education_dann_electricity.csv` | one hour of electricity use | 17,544 | `timestamp`, `electricity_kwh` |
| `raw/rat_site_weather.csv` | one hourly weather observation for the site | 17,539 | `timestamp`, `airTemperature` (°C), `dewTemperature` (°C) |
| `processed/cleaned.csv` | one hour, building + weather joined | 17,544 | `timestamp`, `electricity_kwh`, `temperature_c`, `humidity_pct` |

- **Date range:** 2016-01-01 00:00 to 2017-12-31 23:00 (local time)
- **Measurement interval:** 1 hour (every interval in the file is exactly 1 hour)
- **Energy units:** kWh per hour. BDG2 meter readings are in kWh.
- **Electricity summary:** mean 195 kWh/h, min 110, max 360
- **Humidity** is not in BDG2. We calculate relative humidity from air temperature and dew point with the Magnus formula.

## Cleaning results (`results/data_quality.json`)

| Check | Result | What we did |
|---|---|---|
| Duplicate timestamps | 0 | (would keep the first) |
| Missing timestamps | 0 | data is put on a full hourly grid anyway |
| Inconsistent intervals | none (all 1 hour) | – |
| Negative / impossible values | 0 | (would be set to missing) |
| Suspiciously low (<10% of median) | 0 | (would be flagged, not removed) |
| Missing electricity values | 52 hours | **not filled in.** These are 2 full days (2016-05-24, 2017-06-27) and 4 single hours at daylight-saving changes. These hours are left out of training and testing. |
| Missing weather values | 11 temperature, 14 dew point | filled **forward** only (copy the last known value, max 3 hours). Forward-fill only uses the past, so it cannot leak future data. |

To re-download the raw files from the original source: `python ml/get_data.py`.
