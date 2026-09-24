# Wildfire-occurrence model — model card

**This model was trained by the partner machine-learning team (M. Erraisse,
R. Souane, W. Hara). The RICER Ifrane web app only integrates a
pure-TypeScript re-implementation of their trained XGBoost booster for
inference on Vercel — it does not retrain, fine-tune or otherwise modify the
model.** All modeling decisions (feature engineering, splits, hyperparameters,
target definition) are theirs, made under `gpu_training_bundle_v1_3_0`. This
document only records which of their published runs the app uses and why.

## Identity

| | |
|---|---|
| Model ID | `ricer-wildfire-xgb` |
| Model version | `gpu_training_bundle_v1_3_0/regional__ieee_core_11_proxy__split_temporal_v1__all_rows` |
| Source bundle | `gpu_training_bundle_v1_3_0` (testrun3results), `models/n1_r1_baselines/` |
| Algorithm | XGBoost, `binary:logistic`, 94 trees (early-stopped, `best_iteration = 93`) |
| xgboost version (training) | 3.4.1 |
| Exported artifact | `model_best_iteration_booster.ubj` → `src/lib/risk/model/model.json` (198.7 KiB) |
| Target | `is_fire` (binary fire occurrence) |

## Why this run

The task requires a model whose scope matches Ifrane (Middle Atlas) and whose
inputs the app can actually compute live. Three choices were made, in this
order, each constraining the next:

### 1. Scope: `regional`, not `national`

Per `docs/DATASET_NOTES_FOR_PRESENTATIONS.md`: *"Regional scope: Ifrane,
Sefrou and El Hajeb, extracted exactly from the [national dataset]."* This is
an exact match for Ifrane Province — the national dataset instead spans all
of Morocco, and while it reports much higher headline metrics (e.g.
`national__ieee_core_11_proxy__split_temporal_v1`: ROC AUC 0.951 vs 0.688
regional), a country-wide fit is more likely to pick up relationships driven
by regions with very different climate/vegetation than the Middle Atlas. We
chose the model whose training population *is* Ifrane over the model with
better aggregate numbers.

### 2. Feature set: `ieee_core_11_proxy`, not `environment_core`

`environment_core` (60 features) includes MODIS NDVI/EVI/NBR time series
(6 features each), topography (elevation, slope, aspect, ruggedness) and a
land-cover category — much of this the app cannot compute live. The app's
`/api/ndvi` route only serves a NASA GIBS *map tile* for visual overlay, not
a per-point pixel value, so no reliable live NDVI/EVI/NBR series exists.

`ieee_core_11_proxy` (11 features) is a deliberately small proxy for the
reference IEEE-style feature set. Every feature except one is directly
computable from Open-Meteo (already used elsewhere in the app,
`src/lib/weather`, `src/app/api/weather/*`) plus the request date:

| Feature | Unit | Source |
|---|---|---|
| `month_index` | 1–12 | calendar date |
| `day_of_year` | 1–366 | calendar date |
| `province_adm2` | category (`El Hajeb`, `Ifrane`, `Sefrou`) | fixed `"Ifrane"` — the app only serves Ifrane Province |
| `causal_temperature_mean_past24h_c` | °C | Open-Meteo hourly, past 24 h mean |
| `causal_relative_humidity_mean_past24h_pct` | % | Open-Meteo hourly, past 24 h mean |
| `causal_wind_speed_mean_past24h_kmh` | km/h | Open-Meteo hourly, past 24 h mean |
| `causal_precipitation_sum_past24h_mm` | mm | Open-Meteo hourly, past 24 h sum |
| `causal_temperature_max_past24h_c` | °C | Open-Meteo hourly, past 24 h max |
| `causal_temperature_min_past24h_c` | °C | Open-Meteo hourly, past 24 h min |
| `causal_solar_energy_sum_past24h_mjm2` | MJ/m² | Open-Meteo hourly shortwave radiation, past 24 h sum |
| `causal_modis_ndvi_last_valid_6c` | NDVI (−1..1) | **not available live** — treated as missing (see Limitations) |

`province_adm2` is a fixed value in the app's context, not a live input:
the app only serves points inside Ifrane Province, so it is always encoded
as `"Ifrane"`.

`causal_modis_ndvi_last_valid_6c` cannot be sourced live with what the app
already has. It is the model's 2nd-highest-gain feature (see Feature
importance, below), so dropping it outright would meaningfully change
predictions. XGBoost trees carry a learned `default_left` direction for
every split specifically to route missing values, so we pass it as
`NaN`/missing rather than fabricating a value — see Limitations.

### 3. Split: `split_temporal_v1`, preferred over spatial/weather-station/random

Regional runs are evaluated on four splits. We prefer genuinely out-of-sample
splits over the random split (which leaks spatial/temporal correlation and
inflates metrics: ROC AUC 0.758 on `ieee_core_11_proxy`, clearly optimistic).
Among the remaining three:

| Split | ROC AUC (test) | Avg. precision | Brier | Log loss | Test fire rate | n (test) |
|---|---|---|---|---|---|---|
| `split_random_firecluster_v1` (not used — leaky) | 0.758 | 0.851 | 0.266 | 0.811 | 0.730 | 5,696 |
| `split_regional_spatial_25km_purged5km_v1` | 0.588 | 0.685 | 0.238 | 0.669 | 0.616 | 6,339 |
| **`split_temporal_v1` (chosen)** | **0.688** | 0.260 | 0.204 | 0.594 | 0.156 | 1,291 |
| `split_weather_station_v1` | 0.522 | 0.566 | 0.475 | 1.473 | 0.553 | 12,836 |

`split_temporal_v1` was chosen because it is the scenario the app actually
faces: it evaluates on *later dates in the same known places* (train on
earlier years, test on later ones), which matches "predict today's risk for
a point inside Ifrane Province" much better than `spatial` (unseen places)
or `weather_station` (unseen stations, and the weakest model of the three —
ROC AUC 0.522, barely better than chance). Its test fire rate (15.6%) is also
much closer to real-world sparsity than the ~55–73% fire rates the other
splits carry, which matters for the risk-level thresholds below.

For comparison, `environment_core` on the same `split_temporal_v1` scores
higher (ROC AUC 0.850) — the extra topography/vegetation features do help —
but is not usable given the app's live-data constraints (see above).

## Chosen run's full test metrics (`split_temporal_v1`, n=1,291, fire rate 15.6%)

- ROC AUC: **0.6878**
- Average precision: 0.2603 (average precision above prevalence: 0.1046)
- Brier score: 0.2038 (skill score: −0.550, i.e. worse than always predicting
  the base rate — see calibration limitation below)
- Log loss: 0.5939
- Calibration: intercept −1.489, slope 0.444 (test partition) — the model is
  systematically overconfident; see Limitations
- Validation-selected F1 threshold: 0.0952 (`validation_selected_threshold`
  in `report.json`)
- At the fixed 0.5 threshold: precision 0.296, recall 0.612, F1 0.399,
  balanced accuracy 0.672

## Risk-level thresholds

The app maps the model's probability to four levels. Given the documented
calibration problem (slope 0.44 — raw probabilities are compressed and
skewed high), thresholds are anchored to the run's own reported operating
points rather than naive quantiles of `[0,1]`:

| Level | Range | Rationale |
|---|---|---|
| `low` | `p < 0.0952` | Below `validation_selected_threshold`, the run's own F1-optimal cut on the validation partition |
| `moderate` | `0.0952 ≤ p < 0.5` | Between the validation-selected cut and the conventional decision boundary |
| `high` | `0.5 ≤ p < 0.75` | Above the conventional boundary reported in `report.json`'s `thresholds.fixed_0_5` block |
| `very_high` | `p ≥ 0.75` | Upper band of the observed test-probability range (`probability_max` ≈ 0.93) |

## Limitations (from `report.json["limitations"]`, plus integration-specific ones)

- **Untuned baseline only** — no hyperparameter search was run.
- **No probability calibration** — calibration slope 0.44 on the test
  partition; treat `score` as a relative ranking signal more than a
  well-calibrated probability. The app surfaces discrete `level` bands for
  this reason rather than raw percentages as the primary UI signal.
- **Balanced sampled population is not operational prevalence** — training
  and validation partitions were resampled toward a higher fire rate than
  the test partition's 15.6%; absolute scores should not be read as
  real-world fire probabilities.
- **Target and negative-sampling provenance remain unresolved** (partner
  team's own caveat, carried through unchanged).
- **NDVI is always missing in this integration.** The app has no live
  per-point NDVI source, so `causal_modis_ndvi_last_valid_6c` is always
  passed as missing and routed via each split's learned `default_left`
  direction. This is the model's 2nd highest-gain feature
  (`feature_importance.csv`: gain 44.26, 2nd of 11), so predictions are
  systematically less informed than the partner team's own offline
  evaluation, which had this feature for all but 2 of 32,476 rows. This is
  the single biggest fidelity gap in the integration and a good target for a
  future live-NDVI data source.
- **Valid only inside the training geography** — Ifrane, Sefrou and El Hajeb
  provinces. The app returns `status: 'unavailable', reason:
  'outside_model_domain'` for points outside its configured bounding box
  (see `riskService.ts`).
- **Small test set** (n=1,291) — metrics carry real sampling uncertainty.

## Files

- `src/lib/risk/model/model.json` — exported model (trees, base score,
  objective, feature names, categories). Generated by
  `scripts/ml/export_xgboost.py` from `model_best_iteration_booster.ubj`.
- `tests/fixtures/xgboost-parity.json` — 300-row parity fixture (Python
  `booster.predict(..., output_margin=True)` margins and probabilities for
  TypeScript parity tests), including 2 rows with a missing
  `causal_modis_ndvi_last_valid_6c` value.
