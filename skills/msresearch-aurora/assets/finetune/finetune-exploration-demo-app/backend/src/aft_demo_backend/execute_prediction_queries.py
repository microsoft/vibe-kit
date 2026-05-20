"""Script to pre-populate the LMDB cache by calling the prediction API for all combinations."""

import itertools
import time
import urllib.request
import urllib.error
import urllib.parse

# API endpoint
API_BASE = "http://localhost:8000"

# All possible input combinations
DATASETS = [
    "dec25_dec31_2023",
    "nov1_dec31_2023",
    "jul1_dec31_2023",
]
VARIABLES = ["tcc"]
NUM_EPOCHS = list(range(9))  # 0-8
SAMPLE_INDICES = list(range(26))  # 0-25


def call_prediction_api(dataset: str, variable: str, num_epochs: int, sample_index: int) -> bool:
    """Call the prediction heatmap API endpoint. Returns True on success."""
    params = urllib.parse.urlencode(
        {
            "dataset": dataset,
            "variable": variable,
            "num_epochs": num_epochs,
            "sample_index": sample_index,
        }
    )
    url = f"{API_BASE}/api/heatmap/prediction?{params}"

    try:
        with urllib.request.urlopen(url, timeout=300) as response:
            response.read()
            return True
    except urllib.error.HTTPError as e:
        print(f"  HTTP Error {e.code}: {e.reason}")
        return False
    except urllib.error.URLError as e:
        print(f"  URL Error: {e.reason}")
        return False


def main():
    # Generate all combinations
    combinations = list(itertools.product(DATASETS, VARIABLES, NUM_EPOCHS, SAMPLE_INDICES))
    total = len(combinations)

    print(f"Total combinations to cache: {total}")
    print(f"  Datasets: {len(DATASETS)}")
    print(f"  Variables: {len(VARIABLES)}")
    print(f"  Epochs: {len(NUM_EPOCHS)}")
    print(f"  Sample indices: {len(SAMPLE_INDICES)}")
    print()

    success_count = 0
    fail_count = 0
    start_time = time.time()

    for i, (dataset, variable, num_epochs, sample_index) in enumerate(combinations, 1):
        print(
            f"[{i}/{total}] dataset={dataset}, var={variable}, epochs={num_epochs}, sample={sample_index}"
        )

        if call_prediction_api(dataset, variable, num_epochs, sample_index):
            success_count += 1
        else:
            fail_count += 1

        # Progress update every 10 calls
        if i % 10 == 0:
            elapsed = time.time() - start_time
            rate = i / elapsed
            remaining = (total - i) / rate if rate > 0 else 0
            print(
                f"  --- Progress: {i}/{total} ({100*i/total:.1f}%), ~{remaining/60:.1f} min remaining ---"
            )

    elapsed = time.time() - start_time
    print()
    print(f"Done!")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Total time: {elapsed/60:.1f} minutes")


if __name__ == "__main__":
    main()
