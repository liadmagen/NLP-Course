(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MLM = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    let u = 0;
    while (u === 0) u = rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makeDataset(seed) {
    const rng = mulberry32(seed);
    const X = [], y = [];
    const blobs = [
      { c: [2.5, 7.5], label: 0, n: 15 },
      { c: [7.5, 2.5], label: 0, n: 15 },
      { c: [2.5, 2.5], label: 1, n: 15 },
      { c: [7.5, 7.5], label: 1, n: 15 },
    ];
    for (const b of blobs) {
      for (let i = 0; i < b.n; i++) {
        const x = Math.min(9.8, Math.max(0.2, b.c[0] + gaussian(rng) * 1.25));
        const yy = Math.min(9.8, Math.max(0.2, b.c[1] + gaussian(rng) * 1.25));
        X.push([x, yy]); y.push(b.label);
      }
    }
    const noise = [[5.0, 5.0, 0], [5.4, 4.7, 1], [4.6, 5.5, 0], [5.5, 5.3, 1]];
    for (const [x, yy, l] of noise) { X.push([x, yy]); y.push(l); }
    return { X, y, n: X.length };
  }

  function makeNoisy(seed) {
    const d = makeDataset(seed);
    const outliers = [[7.6, 8.0, 0], [8.2, 7.2, 0], [2.2, 2.0, 1], [1.8, 2.8, 1]];
    for (const [x, yy, l] of outliers) { d.X.push([x, yy]); d.y.push(l); }
    d.n = d.X.length;
    return d;
  }

  function makeLine(seed) {
    const xs = [1.0, 1.6, 2.2, 2.8, 3.4, 4.0, 5.2, 5.8, 6.4, 7.0, 7.6, 8.2, 3.1, 7.9];
    const ys = xs.map(x => (x <= 4.0 ? 0 : 1));
    return { xs, ys, n: xs.length };
  }

  function countsOf(y, idx) {
    let c0 = 0, c1 = 0;
    for (const i of idx) (y[i] === 0 ? c0++ : c1++);
    return [c0, c1];
  }

  function probs(counts) {
    const n = counts[0] + counts[1];
    if (n === 0) return [0, 0];
    return [counts[0] / n, counts[1] / n];
  }

  function giniProbs(p) { return 1 - (p[0] * p[0] + p[1] * p[1]); }
  function gini(counts) { return giniProbs(probs(counts)); }

  function entropyProbs(p) {
    let h = 0;
    for (const pk of p) if (pk > 0) h -= pk * Math.log2(pk);
    return h;
  }
  function entropy(counts) { return entropyProbs(probs(counts)); }

  function impurity(criterion, counts) {
    return criterion === 'entropy' ? entropy(counts) : gini(counts);
  }

  function bestSplit(X, y, idx, criterion, features) {
    const parent = countsOf(y, idx);
    const parentImp = impurity(criterion, parent);
    let best = null;
    const feats = features || [0, 1];
    for (const f of feats) {
      const vals = idx.map(i => X[i][f]).sort((a, b) => a - b);
      const seen = new Set();
      for (let k = 0; k < vals.length - 1; k++) {
        const t = (vals[k] + vals[k + 1]) / 2;
        if (seen.has(t)) continue;
        seen.add(t);
        const left = [], right = [];
        for (const i of idx) (X[i][f] <= t ? left : right).push(i);
        if (!left.length || !right.length) continue;
        const cl = countsOf(y, left), cr = countsOf(y, right);
        const nl = left.length, nr = right.length, n = idx.length;
        const wImp = (nl * impurity(criterion, cl) + nr * impurity(criterion, cr)) / n;
        const gain = parentImp - wImp;
        if (!best || gain > best.gain) {
          best = {
            feature: f, threshold: t, gain,
            left, right, leftCounts: cl, rightCounts: cr,
            parentCounts: parent, parentImpurity: parentImp, weightedImpurity: wImp,
          };
        }
      }
    }
    return best;
  }

  function majority(counts) { return counts[1] > counts[0] ? 1 : 0; }

  function buildTree(X, y, opts) {
    opts = opts || {};
    const maxDepth = opts.maxDepth != null ? opts.maxDepth : 4;
    const minSplit = opts.minSamplesSplit != null ? opts.minSamplesSplit : 2;
    const criterion = opts.criterion || 'gini';
    const maxFeatures = opts.maxFeatures || null;
    const rng = opts.rng || Math.random;
    const allIdx = X.map((_, i) => i);

    function recurse(idx, depth) {
      const counts = countsOf(y, idx);
      const node = { n: idx.length, counts, depth, prediction: majority(counts), leaf: false };
      const pure = counts[0] === 0 || counts[1] === 0;
      if (depth >= maxDepth || idx.length < minSplit || pure) {
        node.leaf = true;
        return node;
      }
      let feats = [0, 1];
      if (maxFeatures && maxFeatures < feats.length) {
        feats = feats.slice();
        for (let i = feats.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = feats[i]; feats[i] = feats[j]; feats[j] = tmp;
        }
        feats = feats.slice(0, maxFeatures);
      }
      const split = bestSplit(X, y, idx, criterion, feats);
      if (!split || split.gain <= 1e-12) { node.leaf = true; return node; }
      node.feature = split.feature;
      node.threshold = split.threshold;
      node.gain = split.gain;
      node.left = recurse(split.left, depth + 1);
      node.right = recurse(split.right, depth + 1);
      return node;
    }
    return recurse(allIdx, 0);
  }

  function predict(tree, x) {
    const path = [tree];
    let node = tree;
    while (!node.leaf) {
      node = x[node.feature] <= node.threshold ? node.left : node.right;
      path.push(node);
    }
    return { label: node.prediction, leaf: node, path };
  }

  function treeWidth(node, minLeafW) {
    if (node.leaf) return Math.max(minLeafW || 8, node.n);
    return treeWidth(node.left, minLeafW) + treeWidth(node.right, minLeafW);
  }

  function layoutTree(root, x0, x1, y0, levelH, minLeafW) {
    const totalW = treeWidth(root, minLeafW);
    const span = Math.min(x1 - x0, totalW);
    const startX = x0 + ((x1 - x0) - span) / 2;
    function place(node, xa, xb, depth) {
      node.px = (xa + xb) / 2;
      node.py = y0 + depth * levelH;
      if (!node.leaf) {
        const wl = treeWidth(node.left, minLeafW);
        place(node.left, xa, xa + wl, depth + 1);
        place(node.right, xa + wl, xb, depth + 1);
      }
    }
    place(root, startX, startX + span, 0);
    return root;
  }

  function partitionRects(tree, bounds, maxDepth) {
    const rects = [];
    function walk(node, b) {
      if (node.leaf || (maxDepth != null && node.depth >= maxDepth)) {
        rects.push({
          x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1,
          pred: node.prediction, counts: node.counts, depth: node.depth, cut: !node.leaf,
        });
        return;
      }
      if (node.feature === 0) {
        walk(node.left, { x0: b.x0, x1: Math.min(node.threshold, b.x1), y0: b.y0, y1: b.y1 });
        walk(node.right, { x0: Math.max(node.threshold, b.x0), x1: b.x1, y0: b.y0, y1: b.y1 });
      } else {
        walk(node.left, { x0: b.x0, x1: b.x1, y0: b.y0, y1: Math.min(node.threshold, b.y1) });
        walk(node.right, { x0: b.x0, x1: b.x1, y0: Math.max(node.threshold, b.y0), y1: b.y1 });
      }
    }
    walk(tree, bounds);
    return rects;
  }

  function bootstrap(n, rng) {
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(Math.floor(rng() * n));
    return idx;
  }

  function trainAccuracy(tree, X, y) {
    let ok = 0;
    for (let i = 0; i < X.length; i++) if (predict(tree, X[i]).label === y[i]) ok++;
    return ok / X.length;
  }

  function stumpPredict(s, x) { return s.polarity * (x > s.threshold ? 1 : -1); }

  function adaboostTrain1D(xs, ys, T) {
    const n = xs.length;
    let w = xs.map(() => 1 / n);
    const stumps = [];
    const history = [];
    for (let t = 0; t < T; t++) {
      let best = null;
      const vals = [...new Set(xs)].sort((a, b) => a - b);
      for (let k = 0; k < vals.length - 1; k++) {
        const thr = (vals[k] + vals[k + 1]) / 2;
        for (const pol of [1, -1]) {
          let err = 0;
          for (let i = 0; i < n; i++) {
            const h = pol * (xs[i] > thr ? 1 : -1);
            if (h !== ys[i]) err += w[i];
          }
          if (!best || err < best.err) best = { threshold: thr, polarity: pol, err };
        }
      }
      if (!best) break;
      const err = Math.min(Math.max(best.err, 1e-12), 1 - 1e-12);
      const alpha = 0.5 * Math.log((1 - err) / err);
      const stump = { threshold: best.threshold, polarity: best.polarity, err, alpha };
      stumps.push(stump);
      const wNew = xs.map((x, i) => w[i] * Math.exp(-alpha * ys[i] * stumpPredict(stump, x)));
      const z = wNew.reduce((a, b) => a + b, 0);
      w = wNew.map(v => v / z);
      let trainErr = 0;
      for (let i = 0; i < n; i++) if (adaboostPredict({ stumps }, xs[i]) !== ys[i]) trainErr++;
      history.push({ stump, weights: w.slice(), err, alpha, trainErr: trainErr / n });
      if (trainErr === 0) break;
    }
    return { stumps, history };
  }

  function adaboostF(model, x) {
    let F = 0;
    for (const s of model.stumps) F += s.alpha * stumpPredict(s, x);
    return F;
  }

  function adaboostPredict(model, x) { return Math.sign(adaboostF(model, x)) || 1; }

  return {
    mulberry32, gaussian, makeDataset, makeNoisy, makeLine,
    countsOf, probs, gini, giniProbs, entropy, entropyProbs, impurity,
    bestSplit, buildTree, predict, layoutTree, partitionRects,
    bootstrap, trainAccuracy, majority,
    stumpPredict, adaboostTrain1D, adaboostF, adaboostPredict,
  };
});
