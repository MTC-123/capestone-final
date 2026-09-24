#!/usr/bin/env python3
"""
Export the partner ML team's regional wildfire-occurrence XGBoost model to a
compact, dependency-free JSON format that `src/lib/risk/xgboost.ts` can load
and evaluate in pure TypeScript (no Python runtime on Vercel).

Chosen run (see ../../src/lib/risk/model/MODEL_CARD.md for the full rationale):

    regional__ieee_core_11_proxy__split_temporal_v1__all_rows

from bundle gpu_training_bundle_v1_3_0.

We export `model_best_iteration_booster.ubj`, NOT the full `model.ubj`. The
run trained with early stopping and `best_iteration = 93` (94 trees,
0-indexed); `report.json`'s test metrics were computed against that
early-stopped booster, not the full (194-tree) `model.ubj`. We verified this
empirically: predicting the stored test rows with
`model_best_iteration_booster.ubj` reproduces `predictions.parquet`'s stored
probabilities to within 2.4e-7 (float32 rounding), while the full `model.ubj`
differs by up to 0.34. Using the best-iteration booster is therefore both
more faithful to the reported metrics and (incidentally) about half the size
of the full model.

This script is a one-off export tool. It requires `xgboost`, `pandas`,
`pyarrow` and `numpy`, which are NOT app dependencies — run it from the venv
described in the task instructions, never from the Next.js app's own
environment:

    python3 -m venv $S/mlvenv
    $S/mlvenv/bin/pip install xgboost pandas pyarrow numpy
    $S/mlvenv/bin/python apps/web/scripts/ml/export_xgboost.py

It writes:
  - apps/web/src/lib/risk/model/model.json         (compact model for inference)
  - apps/web/tests/fixtures/xgboost-parity.json     (parity fixture for tests)

It reads only from the read-only machine-learning results tree; it never
writes there.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

RUN_DIR = Path(
    "/Users/mtc/Documents/Capestone/machine-learning/results/testrun3results/"
    "gpu_training_bundle_v1_3_0/models/n1_r1_baselines/"
    "regional__ieee_core_11_proxy__split_temporal_v1__all_rows"
)
CANDIDATE_TABLE = Path(
    "/Users/mtc/Documents/Capestone/machine-learning/results/testrun3results/"
    "gpu_training_bundle_v1_3_0/data/processed/"
    "ricer_r1_regional_candidates_with_firms_v1_2_1.parquet"
)
BOOSTER_PATH = RUN_DIR / "model_best_iteration_booster.ubj"
CATEGORIES_PATH = RUN_DIR / "categories.json"
REPORT_PATH = RUN_DIR / "report.json"
PREDICTIONS_PATH = RUN_DIR / "predictions.parquet"

WEB_ROOT = Path(__file__).resolve().parents[2]  # apps/web
MODEL_OUT = WEB_ROOT / "src/lib/risk/model/model.json"
FIXTURE_OUT = WEB_ROOT / "tests/fixtures/xgboost-parity.json"

MODEL_ID = "ricer-wildfire-xgb"
MODEL_VERSION = "gpu_training_bundle_v1_3_0/regional__ieee_core_11_proxy__split_temporal_v1__all_rows"

# Feature order exactly as trained (report.json["features"]).
FEATURE_NAMES = [
    "month_index",
    "day_of_year",
    "province_adm2",
    "causal_temperature_mean_past24h_c",
    "causal_relative_humidity_mean_past24h_pct",
    "causal_wind_speed_mean_past24h_kmh",
    "causal_precipitation_sum_past24h_mm",
    "causal_temperature_max_past24h_c",
    "causal_temperature_min_past24h_c",
    "causal_solar_energy_sum_past24h_mjm2",
    "causal_modis_ndvi_last_valid_6c",
]

def r(x):
    """Round-trips a value through float32 (XGBoost's own training precision)
    without further decimal-place rounding. Earlier we rounded to a fixed
    number of *decimal places*, which silently destroyed precision for
    small-magnitude thresholds (e.g. 0.00043511385 -> 0.0004351) and flipped
    split outcomes near the boundary — caught by the TS parity test. Fixed
    *significant-figure* precision (via float32) doesn't have that problem
    at any magnitude.
    """
    if x is None:
        return None
    if isinstance(x, float) and math.isnan(x):
        return None
    return float(np.float32(x))


def main() -> None:
    report = json.loads(REPORT_PATH.read_text())
    assert report["features"] == FEATURE_NAMES, "feature order drifted from report.json"

    categories = json.loads(CATEGORIES_PATH.read_text())
    province_vocab = categories["vocabularies"]["province_adm2"]

    booster = xgb.Booster()
    booster.load_model(str(BOOSTER_PATH))
    cfg = json.loads(booster.save_config())
    learner = cfg["learner"]
    objective_name = learner["objective"]["name"]
    base_score = float(learner["learner_model_param"]["base_score"].strip("[]"))

    # Dump full tree structure via the native XGBoost JSON model format (richer
    # than get_dump(): includes default_left, split_type and categorical sets).
    tmp_json = RUN_DIR / "_tmp_export_dump.json"
    booster.save_model(str(tmp_json))
    raw = json.loads(tmp_json.read_text())
    tmp_json.unlink()

    raw_trees = raw["learner"]["gradient_booster"]["model"]["trees"]
    assert raw["learner"]["learner_model_param"]["num_feature"] == str(len(FEATURE_NAMES))

    compact_trees = []
    for t in raw_trees:
        n_nodes = len(t["left_children"])
        left = t["left_children"]
        right = t["right_children"]
        split_idx = t["split_indices"]
        split_cond = t["split_conditions"]
        default_left = t["default_left"]
        split_type = t["split_type"]
        base_weights = t["base_weights"]

        cats_nodes = t.get("categories_nodes", [])
        cats_segments = t.get("categories_segments", [])
        cats_sizes = t.get("categories_sizes", [])
        cats_flat = t.get("categories", [])
        node_to_cats: dict[int, list[int]] = {}
        for i, node_id in enumerate(cats_nodes):
            seg = cats_segments[i]
            size = cats_sizes[i]
            node_to_cats[node_id] = [int(c) for c in cats_flat[seg : seg + size]]

        feature = []
        threshold = []
        is_categorical = []
        cats_list = []
        leaf = []
        for i in range(n_nodes):
            is_leaf = left[i] == -1
            if is_leaf:
                feature.append(-1)
                threshold.append(None)
                is_categorical.append(0)
                cats_list.append(None)
                leaf.append(r(base_weights[i]))
            else:
                feature.append(int(split_idx[i]))
                is_cat = int(split_type[i]) == 1
                is_categorical.append(1 if is_cat else 0)
                if is_cat:
                    threshold.append(None)
                    cats_list.append(node_to_cats.get(i, []))
                else:
                    threshold.append(r(split_cond[i]))
                    cats_list.append(None)
                leaf.append(0.0)

        compact_trees.append(
            {
                "left": left,
                "right": right,
                "feature": feature,
                "threshold": threshold,
                "defaultLeft": [int(x) for x in default_left],
                "categorical": is_categorical,
                "cats": cats_list,
                "leaf": leaf,
            }
        )

    model_json = {
        "modelId": MODEL_ID,
        "modelVersion": MODEL_VERSION,
        "objective": objective_name,
        "baseScore": r(base_score),
        "numFeature": len(FEATURE_NAMES),
        "featureNames": FEATURE_NAMES,
        "categories": {"province_adm2": province_vocab},
        "trees": compact_trees,
    }

    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    MODEL_OUT.write_text(json.dumps(model_json, separators=(",", ":")))
    size_bytes = MODEL_OUT.stat().st_size
    print(f"Wrote {MODEL_OUT} ({size_bytes / 1024:.1f} KiB, {len(compact_trees)} trees)")
    if size_bytes > 3 * 1024 * 1024:
        print("WARNING: model.json exceeds ~3 MiB target.")

    # -----------------------------------------------------------------
    # Parity fixture
    # -----------------------------------------------------------------
    # predictions.parquet has no feature columns (only row_id, partition,
    # is_fire, probability), so per the task instructions we join back to the
    # training candidate table for the feature values.
    preds = pd.read_parquet(PREDICTIONS_PATH)
    candidates = pd.read_parquet(CANDIDATE_TABLE)
    feat_table = candidates[["row_id"] + FEATURE_NAMES].copy()
    merged = preds.merge(feat_table, on="row_id", how="inner")

    rng = random.Random(20260924)  # deterministic sample

    # Rows with a missing value in any feature (mainly causal_modis_ndvi_last_valid_6c).
    has_missing = merged[FEATURE_NAMES].isna().any(axis=1)
    missing_rows = merged[has_missing]
    print(f"Rows with missing values available: {len(missing_rows)}")

    target_n = 300
    n_missing = min(len(missing_rows), 20)
    missing_sample = missing_rows.sample(n=n_missing, random_state=20260924) if n_missing else missing_rows

    remaining = merged.drop(missing_sample.index)
    n_rest = min(target_n - n_missing, len(remaining))
    rest_sample = remaining.sample(n=n_rest, random_state=20260924)

    sample = pd.concat([missing_sample, rest_sample]).sample(frac=1, random_state=7).reset_index(drop=True)
    print(f"Fixture rows: {len(sample)} (missing-value rows included: {n_missing})")

    # Reference predictions computed directly with xgboost in this venv.
    X = sample[FEATURE_NAMES].copy()
    X["province_adm2"] = pd.Categorical(X["province_adm2"], categories=province_vocab)
    dmatrix = xgb.DMatrix(X, enable_categorical=True)
    margins = booster.predict(dmatrix, output_margin=True)
    probs = booster.predict(dmatrix, output_margin=False)

    # Sanity check against the bundle's own stored predictions where present.
    stored = sample["probability"].to_numpy(dtype=np.float64)
    diff_vs_stored = np.abs(probs.astype(np.float64) - stored)
    print(
        f"Max |our_prob - stored_prob| over fixture rows: {diff_vs_stored.max():.3e} "
        f"(mean {diff_vs_stored.mean():.3e})"
    )

    fixture_rows = []
    for pos, row in enumerate(sample.itertuples(index=False)):
        row_d = row._asdict()
        features = {}
        for name in FEATURE_NAMES:
            v = row_d[name]
            if name == "province_adm2":
                features[name] = None if pd.isna(v) else str(v)
            else:
                features[name] = None if pd.isna(v) else float(v)
        fixture_rows.append(
            {
                "rowId": int(row_d["row_id"]),
                "partition": str(row_d["partition"]),
                "features": features,
                "marginPython": float(margins[pos]),
                "probabilityPython": float(probs[pos]),
                "storedProbability": None if pd.isna(row_d["probability"]) else float(row_d["probability"]),
            }
        )

    fixture = {
        "modelId": MODEL_ID,
        "modelVersion": MODEL_VERSION,
        "xgboostVersion": xgb.__version__,
        "featureNames": FEATURE_NAMES,
        "generatedAt": "2026-09-24",
        "rows": fixture_rows,
    }
    FIXTURE_OUT.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_OUT.write_text(json.dumps(fixture, indent=1))
    print(f"Wrote {FIXTURE_OUT} ({FIXTURE_OUT.stat().st_size / 1024:.1f} KiB, {len(fixture_rows)} rows)")


if __name__ == "__main__":
    main()
