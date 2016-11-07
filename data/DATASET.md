# Dataset Documentation

This repository contains two primary datasets under `data/`:

- `data/measurements.csv` — real measurement dataset used by the web simulator and analysis pipeline.
- `data/synthetic_large.csv` — large *static* dataset used specifically for parallel performance benchmarking.

The same datasets are also copied into the web app for runtime use under `StoreFactory.Web/wwwroot/data/`.

---

## 1) `measurements.csv` (measurement dataset)

### Purpose
`measurements.csv` is the canonical dataset used by the web simulator. It represents shrinkage **factors** over a 2D process space:

- `temperature_c` (30 .. 200)
- `dwell_min` (1 .. 20)

The dataset represents an empirical measurement grid (kept dense/rectangular for stable interpolation and visualization).

### Schema
CSV header:

- `material` (string)
- `temperature_c` (float)
- `dwell_min` (float)
- `length_factor` (float)
- `width_factor` (float)
- `sleeve_factor` (float)

All `*_factor` columns are dimension ratios (e.g., 0.94 corresponds to ~6% shrink).

### Provenance
`measurements.csv` is an empirical dataset derived from physical shrinkage measurements. It is used by the simulator as the source table for interpolation in the (temperature, dwell time) process space.

To preserve confidentiality and reduce the risk of unintended disclosure, identifiers that could be supplier- or product-specific are omitted or anonymized. The dataset is published in a form suitable for academic evaluation and software reproducibility, not as a complete record of the underlying measurement campaign.

---

## 2) `synthetic_large.csv` (static benchmark dataset)

### Purpose
`synthetic_large.csv` is used as input to the multiprocessing benchmark in `analysis/compute_parallel.py`:

```py
IN_CSV = os.path.join(DATA_DIR, "synthetic_large.csv")
```

It exists to stress-test aggregation with a **larger row count** than `measurements.csv` in order to produce clearer scaling/speedup curves on typical hardware.

### Schema
It uses the same schema as `measurements.csv`:

- `material`
- `temperature_c`
- `dwell_min`
- `length_factor`
- `width_factor`
- `sleeve_factor`

### Reproducibility status
A generator script for `synthetic_large.csv` is **not currently included** in this repository. The file is stored as a static artifact so performance results can be reproduced from a clean checkout without requiring additional tooling.

If a fully reproducible (from-source) benchmark is required, add a generator script that creates `synthetic_large.csv` deterministically (same schema as `measurements.csv`) and document it in this file.

---

## 3) Notes on data copies under `wwwroot/`
The web application loads datasets from `StoreFactory.Web/wwwroot/data/` at runtime. Generation scripts and analysis scripts typically write to both locations:

- `data/` (source-of-truth for analysis inputs)
- `StoreFactory.Web/wwwroot/data/` (static assets served by the ASP.NET app)

This duplication is intentional to keep the web app runnable without additional build steps.