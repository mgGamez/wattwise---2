"""Step 0 (optional): re-create data/raw/ from the original BDG2 files.

The two small CSVs in data/raw/ are already in the repo, so you only need this
to check where they came from. It downloads ~195 MB to a temporary folder.

Run:  python ml/get_data.py
"""
import tempfile
import urllib.request
from pathlib import Path

import pandas as pd

BASE = "https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/master/data/"
BUILDING, SITE = "Rat_education_Dann", "Rat"
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        elec_file, weather_file = Path(tmp, "electricity.csv"), Path(tmp, "weather.csv")
        urllib.request.urlretrieve(BASE + "meters/cleaned/electricity_cleaned.csv", elec_file)
        urllib.request.urlretrieve(BASE + "weather/weather.csv", weather_file)

        elec = pd.read_csv(elec_file, usecols=["timestamp", BUILDING])
        elec.rename(columns={BUILDING: "electricity_kwh"}).to_csv(RAW / "rat_education_dann_electricity.csv", index=False)

        weather = pd.read_csv(weather_file)
        weather = weather[weather.site_id == SITE][["timestamp", "airTemperature", "dewTemperature"]]
        weather.to_csv(RAW / "rat_site_weather.csv", index=False)
    print("Wrote", list(RAW.glob("*.csv")))


if __name__ == "__main__":
    main()
