"""Parallel analysis of shrinkage data.

Reads data/measurements.csv and writes data/analysis.json with summary stats,
curves, and multiprocessing speedup metrics.
"""
from __future__ import print_function

import csv
import json
import math
import os
import time
import multiprocessing as mp

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
WEB_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "StoreFactory.Web", "wwwroot", "data")
IN_CSV = os.path.join(DATA_DIR, "synthetic_large.csv")
OUT_JSON = os.path.join(DATA_DIR, "analysis_performance.json")
OUT_WEB_JSON = os.path.join(WEB_DATA_DIR, "analysis_performance.json")

# Increase CPU work per row to demonstrate parallel speedup on typical hardware.
WORK_UNITS = 250

SAFE_MIN = 0.95
SAFE_MAX = 1.05


def read_rows():
    rows = []
    with open(IN_CSV, "r") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "material": r["material"],
                "temperature_c": float(r["temperature_c"]),
                "dwell_min": float(r["dwell_min"]),
                "length_factor": float(r["length_factor"]),
                "width_factor": float(r["width_factor"]),
                "sleeve_factor": float(r["sleeve_factor"]),
            })
    return rows


def chunkify(items, n_chunks):
    n = len(items)
    size = int(math.ceil(float(n) / float(n_chunks)))
    return [items[i:i + size] for i in range(0, n, size)]


def aggregate_chunk(rows):
    # aggregate per material
    acc = {}
    for r in rows:
        # Simulate heavier numeric processing
        v = r["length_factor"] + r["width_factor"] + r["sleeve_factor"]
        for _ in range(WORK_UNITS):
            v = math.sin(v) * math.cos(v) + 1.0000001
        r["_work"] = v

        m = r["material"]
        if m not in acc:
            acc[m] = {
                "count": 0,
                "sum_l": 0.0,
                "sum_w": 0.0,
                "sum_s": 0.0,
                "sum_l2": 0.0,
                "sum_w2": 0.0,
                "sum_s2": 0.0,
            }
        a = acc[m]
        a["count"] += 1
        a["sum_l"] += r["length_factor"]
        a["sum_w"] += r["width_factor"]
        a["sum_s"] += r["sleeve_factor"]
        a["sum_l2"] += r["length_factor"] ** 2
        a["sum_w2"] += r["width_factor"] ** 2
        a["sum_s2"] += r["sleeve_factor"] ** 2
    return acc


def merge_accumulators(accs):
    merged = {}
    for acc in accs:
        for m, a in acc.items():
            if m not in merged:
                merged[m] = dict(a)
            else:
                for k in a:
                    merged[m][k] += a[k]
    return merged


def finalize_stats(merged):
    stats = {}
    for m, a in merged.items():
        n = float(a["count"])
        mean_l = a["sum_l"] / n
        mean_w = a["sum_w"] / n
        mean_s = a["sum_s"] / n

        var_l = max(0.0, (a["sum_l2"] / n) - mean_l ** 2)
        var_w = max(0.0, (a["sum_w2"] / n) - mean_w ** 2)
        var_s = max(0.0, (a["sum_s2"] / n) - mean_s ** 2)

        stats[m] = {
            "mean": {
                "length": round(mean_l, 4),
                "width": round(mean_w, 4),
                "sleeve": round(mean_s, 4),
            },
            "variance": {
                "length": round(var_l, 6),
                "width": round(var_w, 6),
                "sleeve": round(var_s, 6),
            },
            "count": int(n),
        }
    return stats


def build_curves(rows, materials, factor_key):
    # Average factor by temperature bins and dwell bins
    temp_bins = [30, 60, 90, 120, 150, 180, 200]
    dwell_bins = [1, 5, 9, 13, 17, 20]

    curves = {"temperature": {}, "dwell": {}}
    for m in materials:
        curves["temperature"][m] = []
        curves["dwell"][m] = []

    for m in materials:
        # temperature curve
        for i in range(len(temp_bins) - 1):
            lo, hi = temp_bins[i], temp_bins[i + 1]
            vals = [r[factor_key] for r in rows if r["material"] == m and lo <= r["temperature_c"] < hi]
            avg = sum(vals) / float(len(vals)) if vals else 0.0
            curves["temperature"][m].append({"x": (lo + hi) / 2.0, "y": round(avg, 4)})

        # dwell curve
        for i in range(len(dwell_bins) - 1):
            lo, hi = dwell_bins[i], dwell_bins[i + 1]
            vals = [r[factor_key] for r in rows if r["material"] == m and lo <= r["dwell_min"] < hi]
            avg = sum(vals) / float(len(vals)) if vals else 0.0
            curves["dwell"][m].append({"x": (lo + hi) / 2.0, "y": round(avg, 4)})

    curves["temperature_bins"] = temp_bins
    curves["dwell_bins"] = dwell_bins
    return curves


def build_histogram(values, lo=0.85, hi=1.10, bins=20):
    step = (hi - lo) / float(bins)
    edges = [round(lo + i * step, 4) for i in range(bins + 1)]
    counts = [0 for _ in range(bins)]
    for v in values:
        if v < lo:
            idx = 0
        elif v >= hi:
            idx = bins - 1
        else:
            idx = int((v - lo) / step)
        counts[idx] += 1
    return {"edges": edges, "counts": counts}


def build_risk_index(rows, materials, threshold):
    totals = {m: 0 for m in materials}
    risky = {m: 0 for m in materials}
    for r in rows:
        m = r["material"]
        totals[m] += 1
        if r["length_factor"] < threshold:
            risky[m] += 1
    return {m: round((risky[m] / float(totals[m])) * 100.0, 2) if totals[m] else 0.0 for m in materials}


def build_stability_grid(rows, temp_bins, dwell_bins, safe_min, safe_max):
    totals = [[0 for _ in range(len(temp_bins) - 1)] for _ in range(len(dwell_bins) - 1)]
    safe = [[0 for _ in range(len(temp_bins) - 1)] for _ in range(len(dwell_bins) - 1)]

    for r in rows:
        t = r["temperature_c"]
        d = r["dwell_min"]
        ti = None
        di = None
        for i in range(len(temp_bins) - 1):
            if temp_bins[i] <= t < temp_bins[i + 1]:
                ti = i
                break
        for j in range(len(dwell_bins) - 1):
            if dwell_bins[j] <= d < dwell_bins[j + 1]:
                di = j
                break
        if ti is None or di is None:
            continue

        totals[di][ti] += 1
        if safe_min <= r["length_factor"] <= safe_max:
            safe[di][ti] += 1

    values = []
    for j in range(len(dwell_bins) - 1):
        row = []
        for i in range(len(temp_bins) - 1):
            if totals[j][i] == 0:
                row.append(0.0)
            else:
                row.append(round((safe[j][i] / float(totals[j][i])) * 100.0, 2))
        values.append(row)
    return {
        "temperatures": temp_bins,
        "dwellTimes": dwell_bins,
        "values": values,
    }


def run_single(rows):
    acc = aggregate_chunk(rows)
    stats = finalize_stats(acc)
    return stats


def run_parallel(rows, workers):
    chunks = chunkify(rows, workers)
    pool = mp.Pool(processes=workers)
    accs = pool.map(aggregate_chunk, chunks)
    pool.close()
    pool.join()
    merged = merge_accumulators(accs)
    stats = finalize_stats(merged)
    return stats


def main(workers=None):
    rows = read_rows()
    materials = sorted(list(set([r["material"] for r in rows])))
    if not os.path.isdir(WEB_DATA_DIR):
        os.makedirs(WEB_DATA_DIR)
    if workers is None:
        workers = max(2, mp.cpu_count())

    # single-process timing
    t0 = time.time()
    stats_single = run_single(rows)
    t1 = time.time()
    single_s = t1 - t0

    # multi-process timing
    t2 = time.time()
    stats_parallel = run_parallel(rows, workers)
    t3 = time.time()
    parallel_s = t3 - t2
    speedup = (single_s / parallel_s) if parallel_s > 0 else 0.0

    # Scaling series: workers -> seconds and speedup
    max_workers = min(workers, 12)
    scaling = []
    for w in range(1, max_workers + 1):
        ts0 = time.time()
        if w == 1:
            _ = run_single(rows)
        else:
            _ = run_parallel(rows, w)
        ts1 = time.time()
        sec = ts1 - ts0
        scaling.append({
            "workers": w,
            "seconds": round(sec, 4),
            "speedup": round((single_s / sec) if sec > 0 else 0.0, 3)
        })

    curves = build_curves(rows, materials, "length_factor")
    length_values = [r["length_factor"] for r in rows]
    histogram = build_histogram(length_values)
    risk_index = build_risk_index(rows, materials, SAFE_MIN)
    stability_grid = build_stability_grid(rows, curves["temperature_bins"], curves["dwell_bins"], SAFE_MIN, SAFE_MAX)

    radar = {
        "labels": ["length", "width", "sleeve"],
        "materials": materials,
        "values": {m: stats_parallel[m]["mean"] for m in materials}
    }

    efficiency = []
    overhead = []
    for point in scaling:
        workers = point["workers"]
        seconds = point["seconds"]
        efficiency.append({
            "workers": workers,
            "efficiency": round((point["speedup"] / workers) if workers else 0.0, 4)
        })
        overhead.append({
            "workers": workers,
            "overhead": round(max(0.0, seconds - (single_s / workers)), 4)
        })

    payload = {
        "meta": {
            "rows": len(rows),
            "materials": materials,
            "workers": workers,
        },
        "timing": {
            "single_seconds": round(single_s, 4),
            "parallel_seconds": round(parallel_s, 4),
            "speedup": round(speedup, 3),
        },
        "scaling": scaling,
        "stats": stats_parallel,
        "curves": curves,
        "simulation": {
            "histogram": histogram,
            "riskIndex": risk_index,
            "radar": radar,
            "stability": stability_grid,
        },
        "performance": {
            "efficiency": efficiency,
            "overhead": overhead,
        },
    }

    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)

    with open(OUT_WEB_JSON, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)

    print("Wrote", OUT_JSON)
    print("Wrote", OUT_WEB_JSON)


if __name__ == "__main__":
    main()