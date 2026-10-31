/* Scroll-driven visualizations for the decision-tree tutorial.
   All math comes from ml-math.js (window.MLM). No external libraries. */
(function () {
  'use strict';
  var ML = window.MLM;
  if (!ML) return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, str, attrs) {
    var t = el('text', attrs || {}, parent);
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.textContent = str;
    return t;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var C = {
    blue: '#2f6fed', orange: '#f08a1d', ink: '#1d2733', muted: '#5b6b7c',
    blueSoft: 'rgba(47,111,237,0.12)', orangeSoft: 'rgba(240,138,29,0.12)',
    line: '#e5e1d8', green: '#1f9d63', accent: '#6d5bd0'
  };

  var PW = 620, PH = 500, PX = 10, PY = 40;
  function sx(x) { return PX + (x / 10) * PW; }
  function sy(y) { return PY + PH - (y / 10) * PH; }

  function frame(svg, withAxes) {
    el('rect', { x: PX, y: PY, width: PW, height: PH, fill: '#fdfcfa', stroke: C.line, rx: 8 }, svg);
    if (withAxes) {
      for (var i = 0; i <= 10; i += 2) {
        el('line', { x1: sx(i), y1: sy(0), x2: sx(i), y2: sy(10), stroke: '#efede6', 'stroke-width': 1 }, svg);
        el('line', { x1: sx(0), y1: sy(i), x2: sx(10), y2: sy(i), stroke: '#efede6', 'stroke-width': 1 }, svg);
        txt(svg, sx(i), sy(0) + 16, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
        txt(svg, sx(0) - 8, sy(i) + 3, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'end', 'font-family': 'ui-monospace,monospace' });
      }
      txt(svg, sx(5), sy(0) + 32, 'feature x1', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      var yl = txt(svg, 16, sy(5), 'feature x2', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      yl.setAttribute('transform', 'rotate(-90 16 ' + sy(5) + ')');
    }
  }

  function drawPoints(svg, data, opts) {
    opts = opts || {};
    var g = el('g', {}, svg);
    var rng = ML.mulberry32(1234);
    var order = data.X.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    data.X.forEach(function (p, i) {
      var c = el('circle', {
        'class': 'anim', cx: sx(p[0]), cy: sy(p[1]), r: 0,
        fill: data.y[i] === 0 ? C.blue : C.orange,
        'fill-opacity': opts.fillOpacity != null ? opts.fillOpacity : 0.9,
        stroke: '#fff', 'stroke-width': 1.2
      }, g);
      c.dataset.order = order.indexOf(i);
      c.dataset.finalR = opts.r || 5.5;
      c.dataset.i = i;
    });
    return g;
  }

  function animatePointRadii(g, p) {
    var kids = g.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      var local = clamp(p * kids.length * 1.15 - (+c.dataset.order), 0, 1);
      c.setAttribute('r', (+c.dataset.finalR) * ease(local));
    }
  }

  /* ---------- scrollytelling engine ---------- */
  var chapters = [];
  function register(chapterEl, svgId, captionId, scenes) {
    chapters.push({
      el: chapterEl,
      svg: document.getElementById(svgId),
      caption: document.getElementById(captionId),
      steps: Array.prototype.slice.call(chapterEl.querySelectorAll('.step')),
      scenes: scenes
    });
  }

  var dotnav = document.getElementById('dotnav');
  var dotLinks = [];
  document.querySelectorAll('.chapter').forEach(function (chEl) {
    var a = document.createElement('a');
    a.href = '#' + chEl.id;
    var tag = chEl.querySelector('.tag');
    a.innerHTML = '<span>' + (tag ? tag.textContent : chEl.id) + '</span>';
    dotnav.appendChild(a);
    dotLinks.push({ a: a, el: chEl });
  });

  var active = [];
  var ticking = false;

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var center = vh * 0.5;
    chapters.forEach(function (ch, ci) {
      if (!active[ci]) active[ci] = { idx: -1, p: 0 };
      var best = 0, bestDist = Infinity, bp = 0;
      ch.steps.forEach(function (s, si) {
        var r = s.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        var d = Math.abs(mid - center);
        if (d < bestDist) { bestDist = d; best = si; }
        if (Math.abs(mid - center) < vh * 0.45) {
          bp = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.55), 0, 1);
        }
      });
      var changed = active[ci].idx !== best;
      active[ci] = { idx: best, p: bp };
      ch.steps.forEach(function (s, si) { s.classList.toggle('active', si === best); });
      var r = ch.el.getBoundingClientRect();
      dotLinks.forEach(function (dl, di) {
        if (dl.el === ch.el) dl.a.classList.toggle('on', r.top < center && r.bottom > center);
      });
      var scene = ch.scenes[ch.steps[best].dataset.scene];
      if (scene) scene.render(ch.svg, active[ci].p, ch.caption, changed);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ============================================================
     Chapter 1 - the dataset
     ============================================================ */
  var data1 = ML.makeDataset(42);

  register(document.getElementById('ch1'), 'viz1', 'cap1', {
    points: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 0, changed); } },
    labels: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 1, changed); } },
    question: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 2, changed); } },
    clusters: { render: function (svg, p, cap, changed) { ch1render(svg, p, cap, 3, changed); } }
  });

  function ch1render(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      frame(svg, true);
      var g = drawPoints(svg, data1, { r: 5.5 });
      var clusters = el('g', { opacity: 0, 'class': 'anim' }, svg);
      [[2.5, 7.5, 2.6], [7.5, 2.5, 2.6], [2.5, 2.5, 2.6], [7.5, 7.5, 2.6]].forEach(function (c) {
        el('ellipse', { cx: sx(c[0]), cy: sy(c[1]), rx: sx(c[2]) - sx(0), ry: sy(0) - sy(c[2]), fill: 'none', stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '7 6' }, clusters);
      });
      var qline = el('line', { x1: sx(5), y1: sy(0), x2: sx(5), y2: sy(10), stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '8 6', opacity: 0, 'class': 'anim' }, svg);
      var ql = txt(svg, sx(5) + 8, sy(9.6), 'x1 <= 5 ?', { 'font-size': 13, fill: C.accent, 'font-weight': 700, opacity: 0, 'class': 'anim' });
      svg._ch1 = { g: g, clusters: clusters, qline: qline, ql: ql };
    }
    var st = svg._ch1;
    animatePointRadii(st.g, p);
    var colored = stage >= 1;
    Array.prototype.forEach.call(st.g.children, function (c) {
      c.setAttribute('fill', colored ? (data1.y[+c.dataset.i] === 0 ? C.blue : C.orange) : '#9aa7b5');
    });
    st.qline.setAttribute('opacity', stage === 2 ? 1 : 0);
    st.ql.setAttribute('opacity', stage === 2 ? 1 : 0);
    st.clusters.setAttribute('opacity', stage === 3 ? 1 : 0);
    cap.textContent = ['64 examples, two features each - labels hidden for now.',
      'Labels: blue vs. orange class.',
      'Could a few yes/no questions separate them? e.g. "x1 <= 5?"',
      'Two clusters per class - separable with axis-parallel questions.'][stage];
  }

  /* ============================================================
     Chapter 2 - inference walk
     ============================================================ */
  var tree2 = ML.buildTree(data1.X, data1.y, { maxDepth: 3, criterion: 'gini' });
  var probe = [2.2, 1.9];
  var walk = ML.predict(tree2, probe);

  register(document.getElementById('ch2'), 'viz2', 'cap2', {
    root: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 0, changed); } },
    q1: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 1, changed); } },
    q2: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 2, changed); } },
    leaf: { render: function (svg, p, cap, changed) { ch2render(svg, p, cap, 3, changed); } }
  });

  function ch2render(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      var tg = el('g', {}, svg);
      ML.layoutTree(tree2, 40, 250, 70, 130, 26);
      var nodes = [], edges = [];
      (function collect(n) {
        nodes.push(n);
        if (!n.leaf) { edges.push([n, n.left]); edges.push([n, n.right]); collect(n.left); collect(n.right); }
      })(tree2);
      var edgeEls = edges.map(function (e) {
        return el('line', { x1: e[0].px, y1: e[0].py + 24, x2: e[1].px, y2: e[1].py - 24, stroke: '#c9c2b4', 'stroke-width': 2.5, 'class': 'anim' }, tg);
      });
      var nodeEls = nodes.map(function (n) {
        var g = el('g', { 'class': 'anim' }, tg);
        var c = el('circle', { cx: n.px, cy: n.py, r: 24, fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'class': 'anim' }, g);
        var label = n.leaf ? (n.prediction === 0 ? 'blue' : 'orange') : (n.feature === 0 ? 'x1<=' + n.threshold.toFixed(1) : 'x2<=' + n.threshold.toFixed(1));
        txt(g, n.px, n.py - 2, label, { 'font-size': n.leaf ? 11 : 10.5, 'text-anchor': 'middle', 'font-weight': 700, fill: n.leaf ? (n.prediction === 0 ? C.blue : C.orange) : C.ink });
        txt(g, n.px, n.py + 13, n.counts[0] + ' blue / ' + n.counts[1] + ' orange', { 'font-size': 9, 'text-anchor': 'middle', fill: C.muted });
        if (!n.leaf) {
          txt(g, n.px - 27, n.py + 38, 'yes', { 'font-size': 10, fill: C.green });
          txt(g, n.px + 27, n.py + 38, 'no', { 'font-size': 10, fill: C.red });
        }
        return { n: n, c: c };
      });
      var sg = el('g', {}, svg);
      el('rect', { x: 300, y: PY, width: 320, height: 420, fill: '#fdfcfa', stroke: C.line, rx: 8 }, sg);
      var region = el('rect', { x: 300, y: PY, width: 0, height: 420, fill: C.blueSoft, 'class': 'anim' }, sg);
      var region2 = el('rect', { x: 300, y: PY, width: 0, height: 0, fill: 'rgba(47,111,237,0.28)', 'class': 'anim' }, sg);
      var pts = el('g', {}, sg);
      data1.X.forEach(function (pt, i) {
        el('circle', { cx: 300 + (pt[0] / 10) * 320, cy: PY + 420 - (pt[1] / 10) * 420, r: 3.4, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.85 }, pts);
      });
      var probeEl = el('circle', { cx: 300 + (probe[0] / 10) * 320, cy: PY + 420 - (probe[1] / 10) * 420, r: 9, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'class': 'anim' }, sg);
      txt(sg, 308, PY + 14, 'probe point', { 'font-size': 10, fill: C.muted });
      svg._ch2 = { nodeEls: nodeEls, edgeEls: edgeEls, edges: edges, region: region, region2: region2, probeEl: probeEl, path: walk.path };
    }
    var st = svg._ch2;
    var pathIdx = clamp(stage, 0, st.path.length - 1);
    st.nodeEls.forEach(function (ne) {
      var pi = st.path.indexOf(ne.n);
      var onPath = pi !== -1 && pi <= pathIdx;
      ne.c.setAttribute('stroke', onPath ? C.accent : C.ink);
      ne.c.setAttribute('stroke-width', onPath ? 4 : 2);
      ne.c.setAttribute('fill', onPath ? '#efecfb' : '#fff');
    });
    st.edgeEls.forEach(function (ee, i) {
      var pi = st.path.indexOf(st.edges[i][0]);
      var ci = st.path.indexOf(st.edges[i][1]);
      var on = pi !== -1 && ci !== -1 && ci <= pathIdx;
      ee.setAttribute('stroke', on ? C.accent : '#c9c2b4');
      ee.setAttribute('stroke-width', on ? 4 : 2.5);
    });
    if (stage >= 1) st.region.setAttribute('width', (tree2.threshold / 10) * 320);
    else st.region.setAttribute('width', 0);
    if (stage >= 2 && st.path.length > 1) {
      var n2 = st.path[1];
      if (n2.feature === 1) {
        st.region2.setAttribute('x', 300);
        st.region2.setAttribute('width', (tree2.threshold / 10) * 320);
        st.region2.setAttribute('y', PY + 420 - (n2.threshold / 10) * 420);
        st.region2.setAttribute('height', (n2.threshold / 10) * 420);
      } else st.region2.setAttribute('width', 0);
    } else st.region2.setAttribute('width', 0);
    st.probeEl.setAttribute('r', stage >= 3 ? 10 : 8);
    cap.textContent = ['A trained tree is a flowchart - start at the root.',
      'Root asks: "x1 <= ' + tree2.threshold.toFixed(1) + '?" The probe answers yes -> left.',
      'Next node asks about x2 -> yes again. The shaded region shrinks.',
      'Leaf reached: region is pure -> predict BLUE. Inference = a path of questions.'][stage];
  }

  /* ============================================================
     Chapter 3 - Gini impurity
     ============================================================ */
  register(document.getElementById('ch3'), 'viz3', 'cap3', {
    intro: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 0, changed); } },
    calc1: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 1, changed); } },
    max: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 2, changed); } },
    pure: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 3, changed); } },
    curve: { render: function (svg, p, cap, changed) { giniRender(svg, p, cap, 4, changed); } }
  });

  function giniRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      el('rect', { x: 60, y: 90, width: 240, height: 300, rx: 16, fill: '#fdfcfa', stroke: C.line }, svg);
      txt(svg, 180, 70, 'one node', { 'font-size': 14, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      var dotsG = el('g', {}, svg);
      var formula = txt(svg, 340, 160, '', { 'font-size': 16, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var formula2 = txt(svg, 340, 192, '', { 'font-size': 16, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var gval = txt(svg, 340, 242, '', { 'font-size': 24, 'font-weight': 800, fill: C.accent, 'font-family': 'ui-monospace,monospace' });
      el('rect', { x: 340, y: 280, width: 240, height: 18, rx: 9, fill: '#efede6', stroke: C.line }, svg);
      var bar = el('rect', { x: 340, y: 280, width: 0, height: 18, rx: 9, fill: C.accent, 'class': 'anim' }, svg);
      txt(svg, 340, 322, '0', { 'font-size': 11, fill: C.muted });
      txt(svg, 580, 322, '0.5 (max, 2 classes)', { 'font-size': 11, fill: C.muted, 'text-anchor': 'end' });
      var cg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var cx0 = 340, cy0 = 470, cw = 240, ch = 130;
      el('rect', { x: cx0, y: cy0 - ch, width: cw, height: ch, fill: '#fdfcfa', stroke: C.line }, cg);
      var pts = [];
      for (var i = 0; i <= 60; i++) { var pp = i / 60; pts.push((cx0 + pp * cw) + ',' + (cy0 - (2 * pp * (1 - pp)) / 0.5 * ch)); }
      el('polyline', { points: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2.5 }, cg);
      txt(cg, cx0 + cw / 2, cy0 - ch - 8, 'G(p) = 2p(1-p),  p = fraction of blue', { 'font-size': 11, 'text-anchor': 'middle', fill: C.muted });
      var dot = el('circle', { cx: cx0, cy: cy0, r: 6, fill: C.orange, stroke: '#fff', 'stroke-width': 2, 'class': 'anim' }, cg);
      txt(cg, cx0 + 4, cy0 + 16, 'p=0', { 'font-size': 10, fill: C.muted });
      txt(cg, cx0 + cw - 4, cy0 + 16, 'p=1', { 'font-size': 10, fill: C.muted, 'text-anchor': 'end' });
      svg._gini = { dotsG: dotsG, formula: formula, formula2: formula2, gval: gval, bar: bar, cg: cg, dot: dot, cx0: cx0, cy0: cy0, cw: cw, ch: ch };
    }
    var st = svg._gini;
    var countsByStage = [[8, 2], [8, 2], [5, 5], [10, 0], [8, 2]];
    var counts = countsByStage[stage];
    var g = ML.gini(counts);
    st.dotsG.innerHTML = '';
    var total = counts[0] + counts[1];
    for (var i = 0; i < total; i++) {
      var ang = (i / total) * Math.PI * 2 - Math.PI / 2;
      var rr = 52 + (i % 3) * 14;
      el('circle', { cx: 180 + Math.cos(ang) * rr, cy: 240 + Math.sin(ang) * rr, r: 9, fill: i < counts[0] ? C.blue : C.orange, stroke: '#fff', 'stroke-width': 1.5 }, st.dotsG);
    }
    var f1 = '', f2 = '', gv = '';
    if (stage === 0 || stage === 4) { f1 = 'G = 1 - (p1^2 + p2^2)'; f2 = 'counts: ' + counts[0] + ' blue, ' + counts[1] + ' orange'; gv = 'G = ' + g.toFixed(2); }
    if (stage === 1) { f1 = 'G = 1 - (0.8^2 + 0.2^2)'; f2 = 'G = 1 - 0.68'; gv = 'G = 0.32'; }
    if (stage === 2) { f1 = 'G = 1 - (0.5^2 + 0.5^2)'; f2 = 'G = 1 - 0.50'; gv = 'G = 0.50  <- maximum'; }
    if (stage === 3) { f1 = 'G = 1 - (1^2 + 0^2)'; f2 = 'G = 1 - 1'; gv = 'G = 0  <- pure: stop!'; }
    st.formula.textContent = f1;
    st.formula2.textContent = f2;
    st.gval.textContent = gv;
    st.bar.setAttribute('width', (g / 0.5) * 240 * clamp(p * 1.4, 0, 1));
    st.cg.setAttribute('opacity', stage === 4 ? 1 : 0);
    if (stage === 4) {
      var pp = ease(clamp(p, 0, 1));
      st.dot.setAttribute('cx', st.cx0 + pp * st.cw);
      st.dot.setAttribute('cy', st.cy0 - (2 * pp * (1 - pp)) / 0.5 * st.ch);
    }
    cap.textContent = ['Node with 10 points: 8 blue, 2 orange. How mixed is it?',
      'p = (0.8, 0.2) -> G = 0.32. Moderately mixed.',
      'Half-and-half is the messiest: G = 0.5 for two classes.',
      'Pure node: G = 0 - a leaf. Majority vote is unanimous.',
      'Gini vs. the blue fraction: parabola peaking at 0.5.'][stage];
  }

  /* ============================================================
     Chapter 4 - Entropy
     ============================================================ */
  register(document.getElementById('ch4'), 'viz4', 'cap4', {
    intro: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 0, changed); } },
    calc: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 1, changed); } },
    curve: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 2, changed); } },
    compare: { render: function (svg, p, cap, changed) { entRender(svg, p, cap, 3, changed); } }
  });

  function entRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      el('rect', { x: 60, y: 90, width: 240, height: 300, rx: 16, fill: '#fdfcfa', stroke: C.line }, svg);
      txt(svg, 180, 70, 'the same node: 8 blue / 2 orange', { 'font-size': 14, 'text-anchor': 'middle', fill: C.muted, 'font-weight': 700 });
      for (var i = 0; i < 10; i++) {
        var ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
        var rr = 52 + (i % 3) * 14;
        el('circle', { cx: 180 + Math.cos(ang) * rr, cy: 240 + Math.sin(ang) * rr, r: 9, fill: i < 8 ? C.blue : C.orange, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      }
      var f1 = txt(svg, 340, 150, '', { 'font-size': 16, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var f2 = txt(svg, 340, 182, '', { 'font-size': 16, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var f3 = txt(svg, 340, 214, '', { 'font-size': 16, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var hv = txt(svg, 340, 262, '', { 'font-size': 24, 'font-weight': 800, fill: C.green, 'font-family': 'ui-monospace,monospace' });
      var cg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var cx0 = 340, cy0 = 480, cw = 250, ch = 120;
      el('rect', { x: cx0, y: cy0 - ch, width: cw, height: ch, fill: '#fdfcfa', stroke: C.line }, cg);
      var ptsH = [], ptsG = [];
      for (var k = 0; k <= 60; k++) {
        var pp = k / 60;
        var h = -(pp * Math.log2(pp || 1e-9) + (1 - pp) * Math.log2((1 - pp) || 1e-9));
        ptsH.push((cx0 + pp * cw) + ',' + (cy0 - h * ch));
        ptsG.push((cx0 + pp * cw) + ',' + (cy0 - (2 * pp * (1 - pp) / 0.5) * ch));
      }
      el('polyline', { points: ptsH.join(' '), fill: 'none', stroke: C.green, 'stroke-width': 2.5 }, cg);
      var gline = el('polyline', { points: ptsG.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2.5, 'stroke-dasharray': '6 4', opacity: 0, 'class': 'anim' }, cg);
      txt(cg, cx0 + 6, cy0 - ch + 14, 'H(p) entropy (green)', { 'font-size': 10, fill: C.green });
      var glab = txt(cg, cx0 + 6, cy0 - ch + 28, 'G(p)/0.5 gini (purple)', { 'font-size': 10, fill: C.accent, opacity: 0, 'class': 'anim' });
      txt(cg, cx0 + cw / 2, cy0 + 16, 'p = fraction of blue  ->  peak at p = 0.5', { 'font-size': 10, 'text-anchor': 'middle', fill: C.muted });
      var dot = el('circle', { cx: cx0 + 0.8 * cw, cy: cy0 - 0.7219 * ch, r: 6, fill: C.orange, stroke: '#fff', 'stroke-width': 2, 'class': 'anim' }, cg);
      svg._ent = { f1: f1, f2: f2, f3: f3, hv: hv, cg: cg, dot: dot, gline: gline, glab: glab, cx0: cx0, cy0: cy0, cw: cw, ch: ch };
    }
    var st = svg._ent;
    if (stage === 0) { st.f1.textContent = 'H = -sum p_k * log2(p_k)'; st.f2.textContent = 'units: bits'; st.f3.textContent = ''; st.hv.textContent = ''; }
    if (stage === 1) {
      st.f1.textContent = 'H = -(0.8*log2 0.8 + 0.2*log2 0.2)';
      st.f2.textContent = '  = -(-0.2575 - 0.4644)';
      st.f3.textContent = '5/5 -> 1 bit   10/0 -> 0 bits';
      st.hv.textContent = 'H = 0.72 bits';
    }
    if (stage === 2) { st.f1.textContent = 'H(p) = -p*log2 p - (1-p)*log2(1-p)'; st.f2.textContent = 'fair coin (p=0.5): exactly 1 bit'; st.f3.textContent = ''; st.hv.textContent = 'peak = 1 bit'; }
    if (stage === 3) { st.f1.textContent = 'Gain = H(parent) - weighted H(children)'; st.f2.textContent = 'both curves peak at p=0.5, so both'; st.f3.textContent = 'usually pick the same splits'; st.hv.textContent = 'CART: Gini - ID3/C4.5: entropy'; }
    st.cg.setAttribute('opacity', stage >= 2 ? 1 : 0);
    st.gline.setAttribute('opacity', stage >= 3 ? 1 : 0);
    st.glab.setAttribute('opacity', stage >= 3 ? 1 : 0);
    if (stage >= 2) {
      var pp = stage === 2 ? ease(clamp(p, 0, 1)) : 0.8;
      var h = -(pp * Math.log2(pp || 1e-9) + (1 - pp) * Math.log2((1 - pp) || 1e-9));
      st.dot.setAttribute('cx', st.cx0 + pp * st.cw);
      st.dot.setAttribute('cy', st.cy0 - h * st.ch);
    }
    cap.textContent = ['Entropy measures mixedness in bits - questions still needed.',
      'Same 8/2 node: H = 0.72 bits (vs. Gini 0.32 - different units).',
      'Entropy curve peaks at p = 0.5 with exactly 1 bit.',
      'Gini and entropy are both concave -> usually the same splits.'][stage];
  }

  /* ============================================================
     Chapter 5 - recursive training (CART)
     ============================================================ */
  var tree5 = ML.buildTree(data1.X, data1.y, { maxDepth: 4, criterion: 'gini' });
  var allIdx = data1.X.map(function (_, i) { return i; });
  var sweepSplit = ML.bestSplit(data1.X, data1.y, allIdx, 'gini', [0]);

  register(document.getElementById('ch5'), 'viz5', 'cap5', {
    code: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 0, changed); } },
    scan: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 1, changed); } },
    split1: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 2, changed); } },
    recurse: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 3, changed); } },
    stop: { render: function (svg, p, cap, changed) { trainRender(svg, p, cap, 4, changed); } }
  });

  function trainRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      frame(svg, true);
      var pts = drawPoints(svg, data1, { r: 5 });
      animatePointRadii(pts, 1);
      var sweep = el('line', { x1: sx(0), y1: sy(0), x2: sx(0), y2: sy(10), stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0, 'class': 'anim' }, svg);
      var gainLab = txt(svg, sx(0), sy(10) - 10, '', { 'font-size': 12, fill: C.accent, 'font-family': 'ui-monospace,monospace', opacity: 0, 'class': 'anim' });
      var commit = el('line', { x1: sx(sweepSplit.threshold), y1: sy(0), x2: sx(sweepSplit.threshold), y2: sy(10), stroke: C.ink, 'stroke-width': 3.5, opacity: 0, 'class': 'anim' }, svg);
      var sub = el('g', { opacity: 0, 'class': 'anim' }, svg);
      [tree5.left, tree5.right].forEach(function (n) {
        if (n && !n.leaf) {
          var horizontal = n.feature === 1;
          el('line', {
            x1: horizontal ? sx(0) : sx(n.threshold), y1: horizontal ? sy(n.threshold) : sy(0),
            x2: horizontal ? sx(10) : sx(n.threshold), y2: horizontal ? sy(n.threshold) : sy(10),
            stroke: C.accent, 'stroke-width': 2.5, opacity: 0.9
          }, sub);
        }
      });
      var chipL = txt(svg, sx(0.2), sy(0) + 18, '', { 'font-size': 12, fill: C.blue, 'font-family': 'ui-monospace,monospace', opacity: 0, 'class': 'anim' });
      var chipR = txt(svg, sx(9.8), sy(0) + 18, '', { 'font-size': 12, fill: C.orange, 'font-family': 'ui-monospace,monospace', opacity: 0, 'class': 'anim', 'text-anchor': 'end' });
      var leafNote = txt(svg, sx(5), sy(0) - 8, '', { 'font-size': 13, fill: C.green, 'text-anchor': 'middle', 'font-weight': 700, opacity: 0, 'class': 'anim' });
      svg._tr = { sweep: sweep, gainLab: gainLab, commit: commit, sub: sub, chipL: chipL, chipR: chipR, leafNote: leafNote };
    }
    var st = svg._tr;
    if (stage === 0) {
      st.sweep.setAttribute('opacity', 0); st.commit.setAttribute('opacity', 0);
      st.sub.setAttribute('opacity', 0); st.chipL.setAttribute('opacity', 0); st.chipR.setAttribute('opacity', 0); st.leafNote.setAttribute('opacity', 0);
      cap.textContent = 'train(node, data, depth) - one recursive procedure builds the whole tree.';
    }
    if (stage === 1) {
      var t = ease(clamp(p, 0, 1)) * 10;
      st.sweep.setAttribute('opacity', 1);
      st.sweep.setAttribute('x1', sx(t)); st.sweep.setAttribute('x2', sx(t));
      var idx = allIdx.filter(function (i) { return data1.X[i][0] <= t; });
      var c = idx.length ? ML.countsOf(data1.y, idx) : [0, 0];
      st.gainLab.setAttribute('opacity', 1);
      st.gainLab.setAttribute('x', clamp(sx(t) + 6, PX + 10, PX + PW - 90));
      st.gainLab.textContent = 'G(left)=' + ML.gini(c).toFixed(2);
      st.commit.setAttribute('opacity', 0);
      cap.textContent = 'Scan every candidate threshold on x1 (and x2) - score each by its gain.';
    }
    if (stage === 2) {
      st.sweep.setAttribute('opacity', 0); st.gainLab.setAttribute('opacity', 0);
      st.commit.setAttribute('opacity', 1);
      st.chipL.setAttribute('opacity', 1); st.chipR.setAttribute('opacity', 1);
      st.chipL.textContent = 'left: ' + sweepSplit.leftCounts[0] + 'B/' + sweepSplit.leftCounts[1] + 'O  G=' + ML.gini(sweepSplit.leftCounts).toFixed(2);
      st.chipR.textContent = 'right: ' + sweepSplit.rightCounts[0] + 'B/' + sweepSplit.rightCounts[1] + 'O  G=' + ML.gini(sweepSplit.rightCounts).toFixed(2);
      cap.textContent = 'Best cut: x1 <= ' + sweepSplit.threshold.toFixed(2) + ', gain = ' + sweepSplit.gain.toFixed(3) + '. Split!';
    }
    if (stage === 3) {
      st.sub.setAttribute('opacity', 1);
      cap.textContent = 'Recurse: left child scans horizontal cuts in the left half; right child scans its own half.';
    }
    if (stage === 4) {
      st.leafNote.setAttribute('opacity', 1);
      st.leafNote.textContent = 'Stop: pure node / max depth / too few samples -> leaf';
      cap.textContent = 'Each branch ends in a leaf (G=0, depth cap, or min-samples). The recursion terminates.';
    }
  }

  /* ============================================================
     Chapter 6 - decision boundary
     ============================================================ */
  var trees6 = {
    1: ML.buildTree(data1.X, data1.y, { maxDepth: 1 }),
    2: ML.buildTree(data1.X, data1.y, { maxDepth: 2 }),
    6: ML.buildTree(data1.X, data1.y, { maxDepth: 6 })
  };

  register(document.getElementById('ch6'), 'viz6', 'cap6', {
    d1: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 1, changed, false); } },
    d2: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 2, changed, false); } },
    d6: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 6, changed, false); } },
    note: { render: function (svg, p, cap, changed) { boundaryRender(svg, p, cap, 6, changed, true); } }
  });

  function boundaryRender(svg, p, cap, depth, changed, note) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pts = drawPoints(svg, data1, { r: 5 });
      animatePointRadii(pts, 1);
      var title = txt(svg, sx(5), sy(0) - 8, '', { 'font-size': 14, 'text-anchor': 'middle', 'font-weight': 700, fill: C.ink });
      svg._bd = { rg: rg, title: title };
    }
    var st = svg._bd;
    st.rg.innerHTML = '';
    var tree = trees6[depth];
    var rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
    rects.forEach(function (r, i) {
      var local = clamp(p * rects.length * 1.2 - i, 0, 1);
      el('rect', {
        x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)),
        fill: r.pred === 0 ? C.blue : C.orange, 'fill-opacity': 0.16 * ease(local),
        stroke: r.pred === 0 ? C.blue : C.orange, 'stroke-opacity': 0.55 * ease(local), 'stroke-width': 1.2
      }, st.rg);
    });
    st.title.textContent = note ? 'The boundary IS the model - axis-parallel only' : 'Depth ' + depth + ' tree: ' + rects.length + ' regions';
    cap.textContent = (depth === 1 ? 'One question -> one vertical cut. ' :
      depth === 2 ? 'Second level cuts regions again -> rectangles. ' :
      'Deep tree: staircase hugging the clusters - but only axis-parallel lines. ') +
      'Every leaf = one region = one majority vote.';
  }

  /* ============================================================
     Chapter 7 - overfitting
     ============================================================ */
  var dataNoisy = ML.makeNoisy(42);
  var treeDeep = ML.buildTree(dataNoisy.X, dataNoisy.y, { maxDepth: 8 });
  var treeShallow = ML.buildTree(dataNoisy.X, dataNoisy.y, { maxDepth: 2 });
  var testSet = { X: [], y: [] };
  (function () {
    var rngTest = ML.mulberry32(777);
    [[2.5, 7.5, 0], [7.5, 2.5, 0], [2.5, 2.5, 1], [7.5, 7.5, 1]].forEach(function (b) {
      for (var i = 0; i < 50; i++) {
        testSet.X.push([clamp(b[0] + ML.gaussian(rngTest) * 1.25, 0.2, 9.8), clamp(b[1] + ML.gaussian(rngTest) * 1.25, 0.2, 9.8)]);
        testSet.y.push(b[2]);
      }
    });
  })();

  register(document.getElementById('ch7'), 'viz7', 'cap7', {
    clean: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 0, changed); } },
    noise: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 1, changed); } },
    islands: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 2, changed); } },
    gap: { render: function (svg, p, cap, changed) { overRender(svg, p, cap, 3, changed); } }
  });

  function overRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pts = el('g', {}, svg);
      var chips = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var chipA = txt(chips, sx(0.2), sy(10) - 8, '', { 'font-size': 13, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var chipB = txt(chips, sx(0.2), sy(10) - 28, '', { 'font-size': 13, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      svg._ov = { rg: rg, pts: pts, chips: chips, chipA: chipA, chipB: chipB };
    }
    var st = svg._ov;
    var d = stage === 0 ? data1 : dataNoisy;
    st.pts.innerHTML = '';
    d.X.forEach(function (pt, i) {
      el('circle', { cx: sx(pt[0]), cy: sy(pt[1]), r: 5, fill: d.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.9, stroke: '#fff', 'stroke-width': 1.2 }, st.pts);
    });
    st.rg.innerHTML = '';
    var tree = stage === 0 ? ML.buildTree(data1.X, data1.y, { maxDepth: 6 }) : treeDeep;
    if (stage <= 2) {
      var rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
      rects.forEach(function (r, i) {
        var local = clamp(p * rects.length * 1.2 - i, 0, 1);
        el('rect', { x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)), fill: r.pred === 0 ? C.blue : C.orange, 'fill-opacity': 0.15 * ease(local), stroke: r.pred === 0 ? C.blue : C.orange, 'stroke-opacity': 0.5 * ease(local), 'stroke-width': 1 }, st.rg);
      });
    }
    if (stage === 3) {
      var rectsS = ML.partitionRects(treeShallow, { x0: 0, x1: 10, y0: 0, y1: 10 });
      rectsS.forEach(function (r) {
        el('rect', { x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)), fill: 'none', stroke: C.green, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, st.rg);
      });
      var rectsD = ML.partitionRects(treeDeep, { x0: 0, x1: 10, y0: 0, y1: 10 });
      rectsD.forEach(function (r) {
        el('rect', { x: sx(r.x0), y: sy(r.y1), width: Math.max(0.5, sx(r.x1) - sx(r.x0)), height: Math.max(0.5, sy(r.y0) - sy(r.y1)), fill: 'none', stroke: C.red, 'stroke-width': 1, 'stroke-opacity': 0.6 }, st.rg);
      });
      st.chips.setAttribute('opacity', 1);
      st.chipA.textContent = 'depth-8 (red):  train ' + (ML.trainAccuracy(treeDeep, dataNoisy) * 100).toFixed(0) + '%  fresh ' + (ML.trainAccuracy(treeDeep, testSet) * 100).toFixed(0) + '%';
      st.chipB.textContent = 'depth-2 (green): train ' + (ML.trainAccuracy(treeShallow, dataNoisy) * 100).toFixed(0) + '%  fresh ' + (ML.trainAccuracy(treeShallow, testSet) * 100).toFixed(0) + '%';
      cap.textContent = 'The deep tree memorizes outliers (tiny islands); the shallow one (green dashes) does better on fresh data.';
    } else {
      st.chips.setAttribute('opacity', 0);
      cap.textContent = ['Clean data: a deep tree fits perfectly - looks great.',
        'Add 4 mislabeled outliers (real data is noisy).',
        'Depth-8 carves islands around each outlier - 100% train accuracy, but it learned noise.'][stage];
    }
  }

  /* ============================================================
     Chapter 8 - random forest (bagging)
     ============================================================ */
  var rfTrees = [];
  (function () {
    var rng = ML.mulberry32(2024);
    for (var t = 0; t < 25; t++) {
      var idx = ML.bootstrap(data1.n, rng);
      var Xb = idx.map(function (i) { return data1.X[i]; });
      var yb = idx.map(function (i) { return data1.y[i]; });
      rfTrees.push(ML.buildTree(Xb, yb, { maxDepth: 4, criterion: 'gini', maxFeatures: 1, rng: rng }));
    }
  })();
  var miniTrees = rfTrees.slice(0, 5);

  register(document.getElementById('ch8'), 'viz8', 'cap8', {
    idea: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 0, changed); } },
    bootstrap: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 1, changed); } },
    trees: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 2, changed); } },
    vote: { render: function (svg, p, cap, changed) { rfRender(svg, p, cap, 3, changed); } }
  });

  function rfRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      frame(svg, true);
      var rg = el('g', {}, svg);
      var pg = el('g', {}, svg);
      var mg = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var panelW = 112, gap = 10, x0 = 14, y0 = 470;
      var panels = miniTrees.map(function (tree, i) {
        var g = el('g', {}, mg);
        el('rect', { x: x0 + i * (panelW + gap), y: y0, width: panelW, height: 70, rx: 6, fill: '#fdfcfa', stroke: C.line }, g);
        txt(g, x0 + i * (panelW + gap) + 4, y0 + 12, 'tree ' + (i + 1), { 'font-size': 9, fill: C.muted });
        return g;
      });
      svg._rf = { rg: rg, pg: pg, mg: mg, panels: panels, x0: x0, y0: y0, panelW: panelW, gap: gap };
    }
    var st = svg._rf;
    st.rg.innerHTML = ''; st.pg.innerHTML = ''; st.mg.setAttribute('opacity', 0);
    if (stage === 1) {
      var rng = ML.mulberry32(555);
      var idx = ML.bootstrap(data1.n, rng);
      var counts = {};
      idx.forEach(function (i) { counts[i] = (counts[i] || 0) + 1; });
      data1.X.forEach(function (pt, i) {
        var k = counts[i] || 0;
        el('circle', {
          cx: sx(pt[0]), cy: sy(pt[1]), r: 4 + k * 3,
          fill: data1.y[i] === 0 ? C.blue : C.orange,
          'fill-opacity': k === 0 ? 0.25 : 0.55 + 0.2 * Math.min(k, 2),
          stroke: k === 0 ? C.muted : '#fff', 'stroke-width': k === 0 ? 1.5 : 1,
          'stroke-dasharray': k === 0 ? '3 3' : 'none'
        }, st.pg);
      });
      cap.textContent = 'Bootstrap: n draws with replacement - bigger = drawn twice, dashed = left out (out-of-bag ~ 37%).';
    } else if (stage === 2) {
      st.mg.setAttribute('opacity', 1);
      miniTrees.forEach(function (tree, i) {
        var g = st.panels[i];
        var rects = ML.partitionRects(tree, { x0: 0, x1: 10, y0: 0, y1: 10 });
        var local = clamp(p * 5 - i, 0, 1);
        var px = st.x0 + i * (st.panelW + st.gap), py = st.y0 + 14;
        rects.forEach(function (r) {
          el('rect', {
            x: px + (r.x0 / 10) * st.panelW, y: py + (1 - r.y1 / 10) * 56,
            width: Math.max(0.4, ((r.x1 - r.x0) / 10) * st.panelW), height: Math.max(0.4, ((r.y1 - r.y0) / 10) * 56),
            fill: r.pred === 0 ? C.blue : C.orange, 'fill-opacity': 0.35 * ease(local)
          }, g);
        });
      });
      data1.X.forEach(function (pt, i) {
        el('circle', { cx: sx(pt[0]), cy: sy(pt[1]), r: 4, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.85 }, st.pg);
      });
      cap.textContent = '5 trees, 5 bootstrap samples (+ random feature subset per split): similar boundaries, not identical.';
    } else if (stage === 3) {
      var GX = 31, GY = 26;
      for (var gx = 0; gx < GX; gx++) for (var gy = 0; gy < GY; gy++) {
        var cx = (gx + 0.5) / GX * 10, cy = (gy + 0.5) / GY * 10;
        var votes = 0;
        rfTrees.forEach(function (t) { votes += ML.predict(t, [cx, cy]).label === 0 ? -1 : 1; });
        var pred = votes < 0 ? 0 : 1;
        var cellP = clamp(p * 1.6 - (gx / GX) * 0.6, 0, 1);
        el('rect', {
          x: sx(gx / GX * 10), y: sy((gy + 1) / GY * 10),
          width: sx((gx + 1) / GX * 10) - sx(gx / GX * 10), height: sy(gy / GY * 10) - sy((gy + 1) / GY * 10),
          fill: pred === 0 ? C.blue : C.orange, 'fill-opacity': 0.18 * ease(cellP)
        }, st.rg);
      }
      data1.X.forEach(function (pt, i) {
        el('circle', { cx: sx(pt[0]), cy: sy(pt[1]), r: 4.5, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.9, stroke: '#fff', 'stroke-width': 1 }, st.pg);
      });
      cap.textContent = '25 trees vote per point - the forest boundary is smoother and more robust than any single tree.';
    } else {
      data1.X.forEach(function (pt, i) {
        el('circle', { cx: sx(pt[0]), cy: sy(pt[1]), r: 5, fill: data1.y[i] === 0 ? C.blue : C.orange, 'fill-opacity': 0.9, stroke: '#fff', 'stroke-width': 1.2 }, st.pg);
      });
      cap.textContent = 'One tree = one opinion. A forest of trees, each on a bootstrap sample, votes together.';
    }
  }

  /* ============================================================
     Chapter 9 - boosting / AdaBoost
     ============================================================ */
  var line = ML.makeLine(5);
  var ys = line.ys.map(function (v) { return v === 1 ? 1 : -1; });
  var ada = ML.adaboostTrain1D(line.xs, ys, 8);

  register(document.getElementById('ch9'), 'viz9', 'cap9', {
    line: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 0, changed); } },
    stump1: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 1, changed); } },
    reweight: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 2, changed); } },
    rounds: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 3, changed); } },
    final: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 4, changed); } },
    summary: { render: function (svg, p, cap, changed) { adaRender(svg, p, cap, 5, changed); } }
  });

  function adaRender(svg, p, cap, stage, changed) {
    if (changed || !svg.dataset.built) {
      svg.dataset.built = '1';
      svg.innerHTML = '';
      var x0 = 40, x1 = 600;
      function ax(x) { return x0 + ((x - 0.5) / 9) * (x1 - x0); }
      var topY = 150, botY = 300;
      el('line', { x1: x0, y1: 230, x2: x1, y2: 230, stroke: C.line, 'stroke-width': 2 }, svg);
      txt(svg, x0, topY - 26, 'label +1', { 'font-size': 12, fill: C.orange, 'font-weight': 700 });
      txt(svg, x0, botY + 30, 'label -1', { 'font-size': 12, fill: C.blue, 'font-weight': 700 });
      for (var i = 0; i <= 9; i++) txt(svg, ax(i), 250, String(i), { 'font-size': 10, fill: C.muted, 'text-anchor': 'middle', 'font-family': 'ui-monospace,monospace' });
      txt(svg, (x0 + x1) / 2, 272, 'feature x', { 'font-size': 12, fill: C.muted, 'text-anchor': 'middle' });
      var ptG = el('g', {}, svg);
      var stumpG = el('g', {}, svg);
      var fG = el('g', { opacity: 0, 'class': 'anim' }, svg);
      var info = txt(svg, x0, 40, '', { 'font-size': 14, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var info2 = txt(svg, x0, 64, '', { 'font-size': 14, 'font-family': 'ui-monospace,monospace', fill: C.ink });
      var fx0 = x0, fx1 = x1, fy0 = 520, fy1 = 380;
      el('rect', { x: fx0, y: fy1, width: fx1 - fx0, height: fy0 - fy1, fill: '#fdfcfa', stroke: C.line, rx: 8 }, fG);
      el('line', { x1: fx0, y1: (fy0 + fy1) / 2, x2: fx1, y2: (fy0 + fy1) / 2, stroke: C.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }, fG);
      txt(fG, fx0 + 4, fy1 + 14, 'F(x) = sum alpha_t * h_t(x) - the boosted vote', { 'font-size': 11, fill: C.muted });
      svg._ada = { ptG: ptG, stumpG: stumpG, fG: fG, info: info, info2: info2, topY: topY, botY: botY, ax: ax, fx0: fx0, fx1: fx1, fy0: fy0, fy1: fy1 };
    }
    var st = svg._ada, ax = st.ax;
    st.ptG.innerHTML = ''; st.stumpG.innerHTML = '';
    var weights = stage === 0 ? line.xs.map(function () { return 1 / line.n; })
      : ada.history[Math.min(stage - 1, ada.history.length - 1)].weights;
    line.xs.forEach(function (x, i) {
      var y = ys[i] === 1 ? st.topY : st.botY;
      el('circle', { cx: ax(x), cy: y, r: 5 + weights[i] * line.n * 6, fill: ys[i] === 1 ? C.orange : C.blue, 'fill-opacity': 0.85, stroke: '#fff', 'stroke-width': 1 }, st.ptG);
    });
    var round = clamp(stage - 1, 0, ada.stumps.length - 1);
    if (stage >= 1 && stage <= 3) {
      for (var t = 0; t <= round; t++) {
        var s = ada.stumps[t];
        var alphaRel = clamp(s.alpha / (ada.stumps[0].alpha || 1), 0.25, 1);
        el('line', { x1: ax(s.threshold), y1: 100, x2: ax(s.threshold), y2: 330, stroke: t === round ? C.ink : '#b9b2a4', 'stroke-width': 2 + 3 * alphaRel, opacity: t === round ? 1 : 0.45 }, st.stumpG);
        var leftX = s.polarity === 1 ? ax(s.threshold) : ax(0.5);
        var rightX = s.polarity === 1 ? ax(9.5) : ax(s.threshold);
        el('rect', { x: Math.min(leftX, rightX), y: 100, width: Math.abs(rightX - leftX), height: 230, fill: C.orange, 'fill-opacity': 0.06 * (t === round ? 1 : 0.4) }, st.stumpG);
      }
      var h = ada.history[round];
      st.info.textContent = 'round ' + (round + 1) + ': threshold x <= ' + h.stump.threshold.toFixed(2) + ',  eps = ' + h.err.toFixed(3) + ',  alpha = ' + h.alpha.toFixed(3);
      st.info2.textContent = stage === 2 ? 'weights x e^(-alpha*y*h(x)): wrong points swell (bigger circles)' : 'alpha = 0.5*ln((1-eps)/eps) - accurate stumps speak louder';
    } else { st.info.textContent = ''; st.info2.textContent = ''; }
    if (stage === 4 || stage === 5) {
      st.fG.setAttribute('opacity', 1);
      var maxF = 1e-9, F = [];
      for (var k = 0; k <= 100; k++) { var f = ML.adaboostF(ada, 0.5 + (k / 100) * 9); F.push(f); maxF = Math.max(maxF, Math.abs(f)); }
      var midY = (st.fy0 + st.fy1) / 2;
      var pts = [];
      F.forEach(function (f, k) {
        pts.push((st.fx0 + (k / 100) * (st.fx1 - st.fx0)) + ',' + (midY - (f / maxF) * ((st.fy0 - st.fy1) / 2 - 8) * clamp(p * 1.5, 0, 1)));
      });
      el('polyline', { points: pts.join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 2.5 }, st.fG);
      var zx = null;
      for (var k2 = 0; k2 < F.length - 1; k2++) if (F[k2] === 0 || F[k2] * F[k2 + 1] < 0) { zx = 0.5 + ((k2 + 0.5) / 100) * 9; break; }
      if (zx != null) {
        el('line', { x1: ax(zx), y1: 100, x2: ax(zx), y2: 330, stroke: '#d64545', 'stroke-width': 3, 'stroke-dasharray': '5 4' }, st.stumpG);
        el('circle', { cx: st.fx0 + ((zx - 0.5) / 9) * (st.fx1 - st.fx0), cy: midY, r: 5, fill: '#d64545' }, st.fG);
      }
      st.info.textContent = ada.stumps.length + ' stumps, final: y_hat = sign( sum alpha_t * h_t(x) )';
      st.info2.textContent = 'where F(x) crosses 0 (red) is the ensemble boundary';
    } else st.fG.setAttribute('opacity', 0);
    cap.textContent = [
      'One feature x; -1 (blue) left, +1 (orange) right - boosting in 1-D is easiest to see.',
      'Round 1: every point weight 1/n; best stump = threshold with lowest weighted error.',
      'Reweight: w <- w * e^(-alpha*y*h(x)), renormalize - mistakes get bigger circles.',
      'Rounds 2..T: each stump aims where the ensemble is still wrong.',
      'Final vote F(x) = sum alpha_t*h_t(x); sign(F) decides - a strong classifier from weak stumps.',
      'Bagging = parallel trees on bootstrap samples; Boosting = sequential, error-focused reweighting.'][stage];
  }

  update();
})();
