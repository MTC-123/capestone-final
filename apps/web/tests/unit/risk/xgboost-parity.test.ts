import { describe, expect, it } from 'vitest';
import { loadModel, predictMargin, predictProbability, type FeatureVector } from '@/lib/risk/xgboost';
import fixture from '../../fixtures/xgboost-parity.json';

const MAX_MARGIN_DIFF = 1e-4;
const MAX_PROBABILITY_DIFF = 1e-5;

describe('xgboost parity against Python booster.predict()', () => {
  const model = loadModel();

  it('has the fixture and model agree on feature names', () => {
    expect(fixture.featureNames).toEqual(model.featureNames);
  });

  it('matches Python margins and probabilities for every fixture row', () => {
    let maxMarginDiff = 0;
    let maxProbabilityDiff = 0;

    for (const row of fixture.rows) {
      const features = row.features as FeatureVector;
      const margin = predictMargin(features, model);
      const probability = predictProbability(features, model);

      maxMarginDiff = Math.max(maxMarginDiff, Math.abs(margin - row.marginPython));
      maxProbabilityDiff = Math.max(maxProbabilityDiff, Math.abs(probability - row.probabilityPython));
    }

    // eslint-disable-next-line no-console
    console.log(
      `xgboost parity: max |margin diff| = ${maxMarginDiff.toExponential(3)}, ` +
        `max |probability diff| = ${maxProbabilityDiff.toExponential(3)} over ${fixture.rows.length} rows`
    );

    expect(maxMarginDiff).toBeLessThanOrEqual(MAX_MARGIN_DIFF);
    expect(maxProbabilityDiff).toBeLessThanOrEqual(MAX_PROBABILITY_DIFF);
  });

  it('also matches the bundle-stored prediction where available', () => {
    let maxDiff = 0;
    let checked = 0;
    for (const row of fixture.rows) {
      if (row.storedProbability === null) continue;
      const probability = predictProbability(row.features as FeatureVector, model);
      maxDiff = Math.max(maxDiff, Math.abs(probability - row.storedProbability));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(maxDiff).toBeLessThanOrEqual(MAX_PROBABILITY_DIFF);
  });

  it('includes at least one row with a missing feature value', () => {
    const missingRows = fixture.rows.filter((row) => Object.values(row.features).some((v) => v === null));
    expect(missingRows.length).toBeGreaterThan(0);
  });
});
