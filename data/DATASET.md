# Dataset

## Source

**UCI Appliances Energy Prediction**
- UCI Machine Learning Repository, dataset #374: https://archive.ics.uci.edu/dataset/374/appliances+energy+prediction
- Paper: Candanedo, L. M., Feldheim, V., & Deramaix, D. (2017). *Data driven prediction models of energy use of appliances in a low-energy house.* Energy and Buildings, 140, 81–97. https://doi.org/10.1016/j.enbuild.2017.01.083
- **License: Creative Commons Attribution 4.0 (CC BY 4.0).** We may use and share it if we credit the source (above).

## What it measures

The dataset records **appliance electricity consumption of one low-energy house in Belgium**. It is **not** data from a school or an office.

| Item | Value |
|---|---|
| What one row is | one **10-minute interval** |
| Target column | `Appliances`, renamed `appliances_wh` |
| Units | **Wh per 10-minute interval** (energy used by appliances in those 10 minutes) |
| Date range | 2016-01-11 17:00 to 2016-05-27 18:00 (about 4.5 months) |
| Rows | 19,735 |
| Measurement interval | exactly 10 minutes for every row |

Other columns:

| Columns | Meaning | Units |
|---|---|---|
| `lights` (`lights_wh`) | energy used by light fixtures | Wh per 10 min |
| `T1`–`T9` | temperature in 9 rooms/areas of the house (inside and outside the building) | °C |
| `RH_1`–`RH_9` | relative humidity in the same areas | % |
| `T_out`, `RH_out`, `Press_mm_hg`, `Windspeed`, `Visibility`, `Tdewpoint` | outdoor weather from the nearest airport weather station (Chièvres) | °C, %, mm Hg, m/s, km, °C |
| `rv1`, `rv2` | random numbers the authors added on purpose to test feature selection | – (**dropped**) |

**Typical values:** median 60 Wh, mean 98 Wh, max 1,080 Wh per 10 min. The data is **spiky**: most intervals sit around 50–100 Wh, and short bursts above 300 Wh happen in about 6% of intervals.

## Cleaning results (`results/data_quality.json`)

| Check | Result |
|---|---|
| Duplicate timestamps | 0 |
| Missing timestamps | 0 |
| Inconsistent intervals | none (all exactly 10 minutes) |
| Negative / impossible energy values | 0 |
| Missing values (any column) | 0 |
| Columns dropped | `rv1`, `rv2` (random noise by design) |

The rules in `ml/prepare_data.py` would still handle problems if the data changed. Missing energy values are never filled in. Sensor values could only be filled **forward** (copying the past), which cannot leak future information.

To re-download the raw file: `python ml/get_data.py`.
