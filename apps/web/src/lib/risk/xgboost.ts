/**
 * Dependency-free XGBoost inference for the wildfire-occurrence model.
 *
 * Re-implements just enough of XGBoost's C++ prediction path to evaluate the
 * trees exported by `scripts/ml/export_xgboost.py` into `model/model.json`.
 * No Python / native XGBoost runtime is needed at request time, which keeps
 * this deployable on Vercel.
 *
 * Semantics matched against the partner team's model (verified in
 * `tests/unit/risk/xgboost-parity.test.ts` against
 * `tests/fixtures/xgboost-parity.json`, produced by `booster.predict(...)`
 * in the training venv):
 *
 *  - A value is "missing" when it is `null`, `undefined`, or `NaN`. Missing
 *    values are routed by each node's learned `default_left` flag, exactly
 *    like XGBoost does for values absent from the training DMatrix.
 *  - Numeric splits compare `x < threshold`. XGBoost trains and stores
 *    thresholds in float32, so both sides of the comparison are rounded with
 *    `Math.fround` before comparing to avoid float64/float32 mismatches at
 *    the boundary.
 *  - Categorical splits (only `province_adm2` in this model) route a value
 *    to the *right* child when its category code is a member of the split's
 *    category set, and to the left child otherwise — this is XGBoost's
 *    convention for categorical nodes (verified empirically against
 *    `trees_to_dataframe()`), which is the opposite of numeric nodes (where
 *    the "true" branch is left).
 *  - A tree's prediction is its reached leaf value. The booster's margin is
 *    `logit(baseScore) + sum(leaf values across all trees)`. For
 *    `binary:logistic`, the probability is `sigmoid(margin)`.
 */

import modelData from './model/model.json';

export interface XgbTree {
  /** Left child index per node, or -1 if the node is a leaf. */
  left: number[];
  /** Right child index per node, or -1 if the node is a leaf. */
  right: number[];
  /** Feature index (into `featureNames`) per node; -1 for leaves. */
  feature: number[];
  /** Split threshold per node (numeric splits only); null otherwise. */
  threshold: (number | null)[];
  /** Whether a missing value at this node routes left (1) or right (0). */
  defaultLeft: number[];
  /** Whether this node is a categorical split (1) or numeric (0). */
  categorical: number[];
  /** For categorical nodes: category codes that route to the right child. */
  cats: (number[] | null)[];
  /** Leaf value per node; 0 for internal nodes (unused). */
  leaf: number[];
}

export interface XgbModel {
  modelId: string;
  modelVersion: string;
  objective: string;
  baseScore: number;
  numFeature: number;
  featureNames: string[];
  categories: Record<string, string[]>;
  trees: XgbTree[];
}

/** A single feature's value: a number, a category string, or missing. */
export type FeatureValue = number | string | null | undefined;
/** Feature name -> value, keyed exactly as `model.featureNames`. */
export type FeatureVector = Record<string, FeatureValue>;

let cachedModel: XgbModel | null = null;

/** Loads (and memoizes) the exported model. */
export function loadModel(): XgbModel {
  if (!cachedModel) {
    cachedModel = modelData as unknown as XgbModel;
  }
  return cachedModel;
}

function isMissing(value: FeatureValue): boolean {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

function resolveCategoryCode(model: XgbModel, featureName: string, value: FeatureValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const vocab = model.categories[featureName];
  if (!vocab) return null;
  const idx = vocab.indexOf(value);
  return idx === -1 ? null : idx;
}

/** Walks a single tree for one row and returns the reached leaf's value. */
function evalTree(tree: XgbTree, features: FeatureVector, model: XgbModel): number {
  let node = 0;
  // A well-formed tree always terminates at a leaf; guard against malformed
  // data (e.g. a cycle) so a bad model.json can't hang a request.
  for (let steps = 0; steps < tree.left.length + 1; steps++) {
    const leftChild = tree.left[node];
    if (leftChild === -1) {
      return tree.leaf[node];
    }
    const rightChild = tree.right[node];
    const featureIdx = tree.feature[node];
    const featureName = model.featureNames[featureIdx];
    const raw = features[featureName];

    if (isMissing(raw)) {
      node = tree.defaultLeft[node] ? leftChild : rightChild;
      continue;
    }

    if (tree.categorical[node]) {
      const code = resolveCategoryCode(model, featureName, raw);
      if (code === null) {
        node = tree.defaultLeft[node] ? leftChild : rightChild;
        continue;
      }
      const cats = tree.cats[node] ?? [];
      node = cats.includes(code) ? rightChild : leftChild;
    } else {
      const x = Math.fround(Number(raw));
      const threshold = Math.fround(tree.threshold[node] ?? 0);
      node = x < threshold ? leftChild : rightChild;
    }
  }
  throw new Error('xgboost: tree traversal did not terminate (malformed model.json)');
}

function logit(p: number): number {
  return Math.log(p / (1 - p));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Raw margin (pre-link-function score): `logit(baseScore) + sum(leaves)`.
 * Matches `booster.predict(dmatrix, output_margin=True)`.
 */
export function predictMargin(features: FeatureVector, model: XgbModel = loadModel()): number {
  let margin = logit(model.baseScore);
  for (const tree of model.trees) {
    margin += evalTree(tree, features, model);
  }
  return margin;
}

/**
 * Predicted probability, applying the model's link function.
 * Matches `booster.predict(dmatrix, output_margin=False)`.
 */
export function predictProbability(features: FeatureVector, model: XgbModel = loadModel()): number {
  const margin = predictMargin(features, model);
  if (model.objective !== 'binary:logistic') {
    throw new Error(`xgboost: unsupported objective "${model.objective}"`);
  }
  return sigmoid(margin);
}
