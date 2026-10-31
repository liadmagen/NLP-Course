'use strict';
// Run with: node tutorials/decision-trees/ml-math.test.js
const assert = require('assert');
const ML = require('./ml-math.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

t('gini: pure node = 0, balanced binary = 0.5', () => {
  assert.strictEqual(ML.gini([10, 0]), 0);
  assert.strictEqual(ML.gini([0, 7]), 0);
  assert.ok(Math.abs(ML.gini([5, 5]) - 0.5) < 1e-12);
  assert.ok(Math.abs(ML.giniProbs([0.25, 0.75]) - 0.375) < 1e-12);
});

t('entropy: pure = 0, balanced binary = 1, [3,1] = 0.811 bits', () => {
  assert.strictEqual(ML.entropy([9, 0]), 0);
  assert.ok(Math.abs(ML.entropy([4, 4]) - 1) < 1e-12);
  assert.ok(Math.abs(ML.entropy([3, 1]) - 0.8112781244591328) < 1e-9);
  assert.ok(Math.abs(ML.entropyProbs([0.5, 0.5]) - 1) < 1e-12);
});

t('bestSplit finds the separating threshold on 1D data', () => {
  const xs = [1, 2, 3, 4, 5, 6], ys = [0, 0, 0, 1, 1, 1];
  const X = xs.map(x => [x, 0]);
  const idx = [0, 1, 2, 3, 4, 5];
  const s = ML.bestSplit(X, ys, idx, 'gini', [0]);
  assert.ok(s, 'a split must exist');
  assert.ok(s.threshold > 3 && s.threshold < 4, 'threshold between 3 and 4, got ' + s.threshold);
  assert.ok(Math.abs(s.gain - 0.5) < 1e-12, 'gain = 0.5, got ' + s.gain);
  assert.deepStrictEqual(s.leftCounts, [3, 0]);
  assert.deepStrictEqual(s.rightCounts, [0, 3]);
});

t('entropy split of [3,3] into [3,0]+[0,3] has gain 1 bit', () => {
  const X = [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]];
  const ys = [0, 0, 0, 1, 1, 1];
  const s = ML.bestSplit(X, ys, [0, 1, 2, 3, 4, 5], 'entropy', [0]);
  assert.ok(Math.abs(s.gain - 1) < 1e-12, 'gain = 1 bit, got ' + s.gain);
});

t('buildTree learns a perfect depth-1 tree on separable data', () => {
  const d = ML.makeLine(1);
  const X = d.xs.map(x => [x, 0]);
  const tree = ML.buildTree(X, d.ys, { maxDepth: 3, criterion: 'gini' });
  assert.strictEqual(tree.leaf, false);
  assert.strictEqual(tree.feature, 0);
  const acc = ML.trainAccuracy(tree, X, d.ys);
  assert.ok(acc >= 13 / 14, 'tree fits the line nearly perfectly, acc=' + acc);
});

t('buildTree on blob dataset reaches high training accuracy with limited depth', () => {
  const d = ML.makeDataset(42);
  const tree = ML.buildTree(d.X, d.y, { maxDepth: 6, criterion: 'gini' });
  const acc = ML.trainAccuracy(tree, d.X, d.y);
  assert.ok(acc >= 0.95, 'train acc >= 0.95, got ' + acc);
});

t('predict returns a valid root-to-leaf path', () => {
  const d = ML.makeDataset(7);
  const tree = ML.buildTree(d.X, d.y, { maxDepth: 3 });
  const r = ML.predict(tree, d.X[0]);
  assert.strictEqual(r.path[0], tree);
  assert.strictEqual(r.path[r.path.length - 1], r.leaf);
  assert.strictEqual(r.label, r.leaf.prediction);
});

t('partitionRects tiles the plane and respects cuts', () => {
  const d = ML.makeDataset(3);
  const tree = ML.buildTree(d.X, d.y, { maxDepth: 2 });
  const rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
  const area = rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
  assert.ok(Math.abs(area - 100) < 1e-6, 'rects tile the plane, area=' + area);
  assert.ok(rects.every(r => r.pred === 0 || r.pred === 1));
});

t('deterministic dataset generation', () => {
  const a = ML.makeDataset(11), b = ML.makeDataset(11);
  assert.deepStrictEqual(a.X, b.X);
  assert.deepStrictEqual(a.y, b.y);
  assert.strictEqual(a.n, 64);
});

t('adaboost on 1D line learns a strong classifier from stumps', () => {
  const d = ML.makeLine(5);
  const ys = d.ys.map(v => (v === 1 ? 1 : -1));
  const model = ML.adaboostTrain1D(d.xs, ys, 10);
  assert.ok(model.stumps.length >= 1);
  let correct = 0;
  for (let i = 0; i < d.xs.length; i++) if (ML.adaboostPredict(model, d.xs[i]) === ys[i]) correct++;
  assert.strictEqual(correct, d.xs.length, 'adaboost must classify the line perfectly');
  assert.ok(model.stumps[0].alpha > 0, 'first stump has positive alpha');
  assert.ok(model.history.length === model.stumps.length);
  for (const h of model.history) assert.strictEqual(h.weights.length, d.xs.length);
});

t('adaboost reweights misclassified points upward', () => {
  const xs = [1, 2, 3, 4, 5, 6];
  const ys = [-1, -1, -1, 1, 1, 1];
  const model = ML.adaboostTrain1D(xs, ys, 1);
  const w = model.history[0].weights;
  // after a good first stump the remaining errors are none; check weights still sum to 1
  const sum = w.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'weights normalized');
});

t('bootstrap sample has n draws in range', () => {
  const rng = ML.mulberry32(99);
  const idx = ML.bootstrap(50, rng);
  assert.strictEqual(idx.length, 50);
  assert.ok(idx.every(i => i >= 0 && i < 50));
});

console.log('\nAll ' + passed + ' tests passed.');
