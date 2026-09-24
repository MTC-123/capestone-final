import { describe, expect, it } from 'vitest';
import { predictMargin, predictProbability, type XgbModel } from '@/lib/risk/xgboost';

/**
 * Small, hand-built models (not the real wildfire model) so missing-value
 * and categorical routing can be verified in isolation and deterministically.
 */

function numericModel(defaultLeft: 0 | 1): XgbModel {
  return {
    modelId: 'test',
    modelVersion: 'test',
    objective: 'binary:logistic',
    baseScore: 0.5, // logit(0.5) = 0 → margin equals the leaf value directly
    numFeature: 1,
    featureNames: ['temp'],
    categories: {},
    trees: [
      {
        left: [1, -1, -1],
        right: [2, -1, -1],
        feature: [0, -1, -1],
        threshold: [10, null, null],
        defaultLeft: [defaultLeft, 0, 0],
        categorical: [0, 0, 0],
        cats: [null, null, null],
        leaf: [0, -3, 5], // node 1 (left, "x < 10") = -3; node 2 (right) = 5
      },
    ],
  };
}

function categoricalModel(defaultLeft: 0 | 1): XgbModel {
  return {
    modelId: 'test',
    modelVersion: 'test',
    objective: 'binary:logistic',
    baseScore: 0.5,
    numFeature: 1,
    featureNames: ['province'],
    categories: { province: ['A', 'B', 'C'] },
    trees: [
      {
        left: [1, -1, -1],
        right: [2, -1, -1],
        feature: [0, -1, -1],
        threshold: [null, null, null],
        defaultLeft: [defaultLeft, 0, 0],
        categorical: [1, 0, 0],
        // category code 1 ("B") routes right; everything else routes left.
        cats: [[1], null, null],
        leaf: [0, -3, 5],
      },
    ],
  };
}

describe('xgboost.ts missing-value routing', () => {
  it('routes a missing numeric value left when default_left = 1', () => {
    const model = numericModel(1);
    expect(predictMargin({ temp: null }, model)).toBe(-3);
    expect(predictMargin({ temp: undefined }, model)).toBe(-3);
    expect(predictMargin({ temp: NaN }, model)).toBe(-3);
  });

  it('routes a missing numeric value right when default_left = 0', () => {
    const model = numericModel(0);
    expect(predictMargin({ temp: null }, model)).toBe(5);
  });

  it('still splits present numeric values on the threshold regardless of default_left', () => {
    const model = numericModel(1);
    expect(predictMargin({ temp: 5 }, model)).toBe(-3); // 5 < 10 → left
    expect(predictMargin({ temp: 10 }, model)).toBe(5); // 10 < 10 is false → right
    expect(predictMargin({ temp: 15 }, model)).toBe(5);
  });

  it('routes a missing categorical value using default_left', () => {
    const left = categoricalModel(1);
    expect(predictMargin({ province: null }, left)).toBe(-3);

    const right = categoricalModel(0);
    expect(predictMargin({ province: null }, right)).toBe(5);
  });

  it('routes a present categorical value by set membership, not default_left', () => {
    const model = categoricalModel(1);
    expect(predictMargin({ province: 'B' }, model)).toBe(5); // code 1, in set → right
    expect(predictMargin({ province: 'A' }, model)).toBe(-3); // code 0, not in set → left
    expect(predictMargin({ province: 'C' }, model)).toBe(-3); // code 2, not in set → left
  });

  it('treats an unrecognized category as missing (default_left)', () => {
    const model = categoricalModel(1);
    expect(predictMargin({ province: 'unknown-category' }, model)).toBe(-3);
  });

  it('converts margin to probability via the logistic link for binary:logistic', () => {
    const model = numericModel(1);
    // margin = logit(0.5) + 5 = 5 → sigmoid(5)
    const probability = predictProbability({ temp: 99 }, model);
    expect(probability).toBeCloseTo(1 / (1 + Math.exp(-5)), 10);
  });
});
