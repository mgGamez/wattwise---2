"""Step 0 (optional): re-download the raw data from the UCI repository.

data/raw/energydata_complete.csv is already in the repo; this only shows where it came from.

Run:  python ml/get_data.py
"""
import io
import urllib.request
import zipfile
from pathlib import Path

URL = "https://archive.ics.uci.edu/static/public/374/appliances+energy+prediction.zip"
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL) as r:
        zipfile.ZipFile(io.BytesIO(r.read())).extract("energydata_complete.csv", RAW)
    print("Wrote", RAW / "energydata_complete.csv")


if __name__ == "__main__":
    main()
