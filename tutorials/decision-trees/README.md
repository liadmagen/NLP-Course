# Decision Trees & Random Forests — a visual HTML5 tutorial

A scroll-driven, animated single-page tutorial (`index.html`) introducing the first ML model of the course:

1. The toy dataset and the classification problem
2. Inference — walking a point down a trained tree
3. Gini impurity — the math, worked examples, and the G(p) curve
4. Entropy — bits, the H(p) curve, and Gini vs. entropy
5. Training (CART) — the recursive algorithm, candidate-split scanning, and stop conditions
6. Decision boundaries — depth 1 → 2 → 6, axis-parallel regions
7. Overfitting — train vs. fresh-data accuracy on noisy data
8. Random forests — bagging, bootstrap samples, and majority voting
9. Boosting and AdaBoost — stumps, weighted error, reweighting, and the final vote F(x) = Σ αₜ·hₜ(x)

## Run it

Open `index.html` directly in any modern browser — no server, no network, no libraries.

## Files

- `index.html` — markup, copy, and CSS for the scrollytelling layout
- `app.js` — the nine scroll-driven SVG animations (pure DOM/SVG, no dependencies)
- `ml-math.js` — the actual math: Gini, entropy, CART splitting/training, prediction, decision-boundary
  partitioning, bootstrap, and AdaBoost on a 1-D problem. Also loadable in Node (`module.exports`).
- `ml-math.test.js` — unit tests for the math module. Run with:

  ```bash
  node tutorials/decision-trees/ml-math.test.js
  ```

Inspired by [R2D3 — A Visual Introduction to Machine Learning](https://www.r2d3.us/visual-intro-to-machine-learning-part-1/).
Pairs with the exercise notebook `exercises_notebooks/02_LM_extracting_information_from_news_with_regex.ipynb`.

Formulas are rendered with [KaTeX](https://katex.org/) from a CDN when the page is viewed online; without network access they fall back to readable plain text.
