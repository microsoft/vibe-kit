"""Script to pre-populate the LMDB cache for validation-related endpoints."""

import time
import urllib.request
import urllib.error
import urllib.parse

# API endpoint
API_BASE = "http://localhost:8000"

# Input combinations
VARIABLES = ["tcc"]
SAMPLE_INDICES = list(range(26))  # 0-25


def call_api(endpoint: str, params: dict | None = None) -> bool:
    """Call an API endpoint. Returns True on success."""
    if params:
        query = urllib.parse.urlencode(params)
        url = f"{API_BASE}{endpoint}?{query}"
    else:
        url = f"{API_BASE}{endpoint}"

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
    total_calls = 1 + 1 + len(VARIABLES) * len(SAMPLE_INDICES) * 2  # sample-count + land-sea-mask + (ground-truth + persistence) * combos
    print(f"Total API calls to make: {total_calls}")
    print()

    success_count = 0
    fail_count = 0
    call_num = 0
    start_time = time.time()

    # 1. Validation sample count (1 call, no params)
    call_num += 1
    print(f"[{call_num}/{total_calls}] /api/validation-sample-count")
    if call_api("/api/validation-sample-count"):
        success_count += 1
    else:
        fail_count += 1

    # 2. Land-sea mask (1 call, no params)
    call_num += 1
    print(f"[{call_num}/{total_calls}] /api/heatmap/land-sea-mask")
    if call_api("/api/heatmap/land-sea-mask"):
        success_count += 1
    else:
        fail_count += 1

    # 3. Ground truth heatmaps (26 calls)
    for variable in VARIABLES:
        for sample_index in SAMPLE_INDICES:
            call_num += 1
            print(f"[{call_num}/{total_calls}] /api/heatmap/ground-truth var={variable}, sample={sample_index}")
            if call_api("/api/heatmap/ground-truth", {"variable": variable, "sample_index": sample_index}):
                success_count += 1
            else:
                fail_count += 1

            if call_num % 10 == 0:
                elapsed = time.time() - start_time
                rate = call_num / elapsed
                remaining = (total_calls - call_num) / rate if rate > 0 else 0
                print(f"  --- Progress: {call_num}/{total_calls} ({100*call_num/total_calls:.1f}%), ~{remaining:.1f}s remaining ---")

    # 4. Persistence heatmaps (26 calls)
    for variable in VARIABLES:
        for sample_index in SAMPLE_INDICES:
            call_num += 1
            print(f"[{call_num}/{total_calls}] /api/heatmap/persistence var={variable}, sample={sample_index}")
            if call_api("/api/heatmap/persistence", {"variable": variable, "sample_index": sample_index}):
                success_count += 1
            else:
                fail_count += 1

            if call_num % 10 == 0:
                elapsed = time.time() - start_time
                rate = call_num / elapsed
                remaining = (total_calls - call_num) / rate if rate > 0 else 0
                print(f"  --- Progress: {call_num}/{total_calls} ({100*call_num/total_calls:.1f}%), ~{remaining:.1f}s remaining ---")

    elapsed = time.time() - start_time
    print()
    print("Done!")
    print(f"  Success: {success_count}")
    print(f"  Failed: {fail_count}")
    print(f"  Total time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
