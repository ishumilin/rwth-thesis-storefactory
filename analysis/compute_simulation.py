"""Simulation analysis for real (measurement) data.

Reads data/measurements.csv and writes data/analysis_simulation.json with
fabric-focused metrics for the Simulation Analysis tab.
"""
from __future__ import print_function

import csv
import json
import math
import os


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
WEB_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "StoreFactory.Web", "wwwroot", "data")
IN_CSV = os.path.join(DATA_DIR, "measurements.csv")
OUT_JSON = os.path.join(DATA_DIR, "analysis_simulation.json")
OUT_WEB_JSON = os.path.join(WEB_DATA_DIR, "analysis_simulation.json")

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


def build_curves(rows, materials, factor_key):
    temp_bins = [30, 60, 90, 120, 150, 180, 200]
    dwell_bins = [1, 5, 9, 13, 17, 20]

    curves = {"temperature": {}, "dwell": {}}
    for m in materials:
        curves["temperature"][m] = []
        curves["dwell"][m] = []

    for m in materials:
        for i in range(len(temp_bins) - 1):
            lo, hi = temp_bins[i], temp_bins[i + 1]
            vals = [r[factor_key] for r in rows if r["material"] == m and lo <= r["temperature_c"] < hi]
            avg = sum(vals) / float(len(vals)) if vals else 0.0
            curves["temperature"][m].append({"x": (lo + hi) / 2.0, "y": round(avg, 4)})

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


def build_stats(rows, materials):
    acc = {m: {"count": 0, "sum_l": 0.0, "sum_w": 0.0, "sum_s": 0.0} for m in materials}
    for r in rows:
        a = acc[r["material"]]
        a["count"] += 1
        a["sum_l"] += r["length_factor"]
        a["sum_w"] += r["width_factor"]
        a["sum_s"] += r["sleeve_factor"]
    stats = {}
    for m, a in acc.items():
        n = float(a["count"]) if a["count"] else 1
        stats[m] = {
            "mean": {
                "length": round(a["sum_l"] / n, 4),
                "width": round(a["sum_w"] / n, 4),
                "sleeve": round(a["sum_s"] / n, 4),
            },
            "count": int(a["count"])
        }
    return stats


def main():
    rows = read_rows()
    materials = sorted(list(set([r["material"] for r in rows])))
    if not os.path.isdir(WEB_DATA_DIR):
        os.makedirs(WEB_DATA_DIR)

    curves = build_curves(rows, materials, "length_factor")
    length_values = [r["length_factor"] for r in rows]
    histogram = build_histogram(length_values)
    risk_index = build_risk_index(rows, materials, SAFE_MIN)
    stability_grid = build_stability_grid(rows, curves["temperature_bins"], curves["dwell_bins"], SAFE_MIN, SAFE_MAX)
    stats = build_stats(rows, materials)

    radar = {
        "labels": ["length", "width", "sleeve"],
        "materials": materials,
        "values": {m: stats[m]["mean"] for m in materials}
    }

    payload = {
        "meta": {
            "rows": len(rows),
            "materials": materials,
        },
        "curves": curves,
        "stats": stats,
        "simulation": {
            "histogram": histogram,
            "riskIndex": risk_index,
            "radar": radar,
            "stability": stability_grid,
        }
    }

    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)

    with open(OUT_WEB_JSON, "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)

    print("Wrote", OUT_JSON)
    print("Wrote", OUT_WEB_JSON)


if __name__ == "__main__":
    main()