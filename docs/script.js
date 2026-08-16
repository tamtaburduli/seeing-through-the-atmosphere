/* =========================================================================
   Seeing Through the Atmosphere — script.js
   ---------------------------------------------------------------------
   IMPORTANT: every spectrum and "signature" in this file is SYNTHETIC.
   It is a simplified educational model built to illustrate a scientific
   IDEA (that some wavelengths carry more discriminating information than
   others), not a reproduction of measured or published research data.
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. NAVIGATION (mobile menu toggle)
   ------------------------------------------------------------------------- */
(function setupNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
})();

/* -------------------------------------------------------------------------
   2. SYNTHETIC SPECTRAL MODEL
   ------------------------------------------------------------------------- 
   We model a simplified absorption feature in the style of the O2 A-band
   near 760 nm: a cluster of narrow Gaussian-shaped absorption lines sitting
   on top of a flat, mostly-transparent baseline. This is a qualitative
   illustration of "fine rotational-line structure", not a radiative-
   transfer calculation and not real measured line positions/depths.
   ------------------------------------------------------------------------- */

const WL_MIN = 758;   // nm, synthetic plotting range start
const WL_MAX = 772;   // nm, synthetic plotting range end
const PLOT_STEP = 0.1; // nm, resolution used only for drawing smooth curves

// Fixed synthetic absorption-line positions/widths (illustrative, not published data)
const SYNTHETIC_LINES = [
  { center: 759.4, width: 0.22, depth: 0.28 },
  { center: 760.3, width: 0.18, depth: 0.55 },
  { center: 761.1, width: 0.20, depth: 0.42 },
  { center: 762.0, width: 0.25, depth: 0.30 },
  { center: 763.2, width: 0.20, depth: 0.48 },
  { center: 764.4, width: 0.18, depth: 0.35 },
  { center: 765.6, width: 0.22, depth: 0.50 },
  { center: 766.8, width: 0.20, depth: 0.33 },
  { center: 768.1, width: 0.24, depth: 0.40 },
  { center: 769.5, width: 0.20, depth: 0.27 },
];

// Four synthetic "signatures" represent, e.g., different atmospheric path
// lengths: a longer optical path deepens oxygen absorption, so we simply
// scale every line's depth by a per-signature factor. This is a stand-in
// for the real physical relationship, built for teaching purposes only.
const SIGNATURES = [
  { id: 'A', label: 'Signature A (short path)', scale: 0.55, color: '#4fb8e6' },
  { id: 'B', label: 'Signature B', scale: 0.80, color: '#8fd3f4' },
  { id: 'C', label: 'Signature C', scale: 1.05, color: '#f2a154' },
  { id: 'D', label: 'Signature D (long path)', scale: 1.35, color: '#ef5b4a' },
];

// transmission(wl, scale) -> a value in roughly [0,1]. 1.0 = fully
// transparent baseline; dips toward 0 near absorption line centers.
function transmission(wl, scale) {
  let t = 1.0;
  for (const line of SYNTHETIC_LINES) {
    const g = Math.exp(-Math.pow((wl - line.center) / line.width, 2));
    t -= line.depth * scale * g;
  }
  return Math.max(0, Math.min(1, t));
}

// Full-resolution curve for plotting (array of {wl, t})
function buildCurve(scale) {
  const pts = [];
  for (let wl = WL_MIN; wl <= WL_MAX + 1e-9; wl += PLOT_STEP) {
    pts.push({ wl: Number(wl.toFixed(2)), t: transmission(wl, scale) });
  }
  return pts;
}

// Candidate wavelength grid used for band SELECTION (coarser than the
// plotting resolution — this is the finite set of wavelengths a visitor,
// or the optimizer, is allowed to choose from).
const CANDIDATE_STEP = 0.5; // nm
const CANDIDATE_GRID = [];
for (let wl = WL_MIN + 1; wl <= WL_MAX - 1 + 1e-9; wl += CANDIDATE_STEP) {
  CANDIDATE_GRID.push(Number(wl.toFixed(2)));
}

function nearestCandidate(wl) {
  let best = CANDIDATE_GRID[0], bestDist = Infinity;
  for (const c of CANDIDATE_GRID) {
    const d = Math.abs(c - wl);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/* -------------------------------------------------------------------------
   3. SEPARABILITY METRIC
   -------------------------------------------------------------------------
   Given a set of chosen wavelengths (bands), how well do the four synthetic
   signatures separate from one another when we only look at those bands?

   For every pair of signatures, we compute the Euclidean distance between
   their transmission values restricted to the chosen bands, then average
   that distance across all pairs. A HIGHER average distance means the
   signatures are easier to tell apart using just those wavelengths — this
   is the same core idea (informative-band selection improves
   discrimination) described in the page text, implemented here as a
   simple, transparent, educational metric.
   ------------------------------------------------------------------------- */
function separabilityScore(bands) {
  if (!bands || bands.length === 0) return 0;
  const vectors = SIGNATURES.map(sig => bands.map(wl => transmission(wl, sig.scale)));
  let total = 0, pairs = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      let sumSq = 0;
      for (let k = 0; k < bands.length; k++) {
        const d = vectors[i][k] - vectors[j][k];
        sumSq += d * d;
      }
      total += Math.sqrt(sumSq);
      pairs++;
    }
  }
  return pairs ? total / pairs : 0;
}

/* -------------------------------------------------------------------------
   4. EXHAUSTIVE FIVE-BAND OPTIMIZER
   -------------------------------------------------------------------------
   Searches every combination of 5 wavelengths from CANDIDATE_GRID and keeps
   the combination with the highest separabilityScore(). With 25 candidate
   wavelengths, C(25,5) = 53,130 combinations — small enough to check every
   single one directly in the browser. This is intentionally exhaustive and
   transparent rather than a black-box search.
   ------------------------------------------------------------------------- */
function optimizeBands() {
  const n = CANDIDATE_GRID.length;
  const combo = [0, 1, 2, 3, 4];
  let bestScore = -Infinity;
  let bestCombo = null;

  function scoreCurrentCombo() {
    const bands = combo.map(idx => CANDIDATE_GRID[idx]);
    const score = separabilityScore(bands);
    if (score > bestScore) {
      bestScore = score;
      bestCombo = bands.slice();
    }
  }

  // standard k-combination enumeration (5 nested increasing indices)
  function enumerate(pos, start) {
    if (pos === 5) { scoreCurrentCombo(); return; }
    for (let i = start; i < n; i++) {
      combo[pos] = i;
      enumerate(pos + 1, i + 1);
    }
  }
  enumerate(0, 0);

  return { bands: bestCombo.sort((a, b) => a - b), score: bestScore };
}

/* -------------------------------------------------------------------------
   5. NOISE / MONTE CARLO CLASSIFICATION SIMULATION
   -------------------------------------------------------------------------
   For a given noise level (as a fraction of full-scale signal) and a given
   set of 5 bands, we repeatedly simulate a noisy measurement of each of the
   4 signatures, then classify it by nearest-signature matching: compare the
   noisy sample to each signature's noiseless template (restricted to the
   chosen bands) using Euclidean distance, and pick the closest one. The
   reported "accuracy" is the fraction of simulated trials where that
   nearest-match classification was correct. This directly mirrors the
   nearest-signature / Euclidean-distance classification idea described on
   the page, using purely synthetic data.
   ------------------------------------------------------------------------- */
function monteCarloAccuracy(bands, noiseFraction, trials = 400) {
  if (!bands || bands.length === 0) return 0;
  const templates = SIGNATURES.map(sig => bands.map(wl => transmission(wl, sig.scale)));
  let correct = 0, total = 0;

  for (const sig of SIGNATURES) {
    const truth = bands.map(wl => transmission(wl, sig.scale));
    for (let t = 0; t < trials; t++) {
      // Add independent Gaussian-ish noise (via Box-Muller) to each band
      const noisy = truth.map(v => v + noiseFraction * gaussianNoise());
      // Nearest-signature classification
      let bestIdx = 0, bestDist = Infinity;
      templates.forEach((tpl, idx) => {
        let sumSq = 0;
        for (let k = 0; k < bands.length; k++) {
          const d = noisy[k] - tpl[k];
          sumSq += d * d;
        }
        if (sumSq < bestDist) { bestDist = sumSq; bestIdx = idx; }
      });
      if (SIGNATURES[bestIdx].id === sig.id) correct++;
      total++;
    }
  }
  return total ? correct / total : 0;
}

function gaussianNoise() {
  // Box-Muller transform for approximately normal random noise
  const u1 = Math.max(Math.random(), 1e-9);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/* -------------------------------------------------------------------------
   6. GENERIC CANVAS PLOTTING HELPERS
   ------------------------------------------------------------------------- */
function getCtx(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx;
}

// Maps data space -> pixel space for a spectrum plot (x = wavelength, y = transmission 0..1)
function makeSpectrumMapper(canvas, padding = { l: 46, r: 20, t: 20, b: 34 }) {
  const w = canvas.width, h = canvas.height;
  const plotW = w - padding.l - padding.r;
  const plotH = h - padding.t - padding.b;
  return {
    x: wl => padding.l + ((wl - WL_MIN) / (WL_MAX - WL_MIN)) * plotW,
    y: t => padding.t + (1 - t) * plotH,
    invX: px => WL_MIN + ((px - padding.l) / plotW) * (WL_MAX - WL_MIN),
    padding, plotW, plotH
  };
}

function drawAxes(ctx, canvas, mapper, yLabel) {
  const { padding, plotW, plotH } = mapper;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#5c6a82';

  // horizontal gridlines at 0, 0.25, 0.5, 0.75, 1
  for (let v = 0; v <= 1.001; v += 0.25) {
    const y = mapper.y(v);
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(padding.l + plotW, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(2), 8, y + 3);
  }

  // vertical ticks every 2nm
  for (let wl = WL_MIN; wl <= WL_MAX; wl += 2) {
    const x = mapper.x(wl);
    ctx.beginPath();
    ctx.moveTo(x, padding.t + plotH);
    ctx.lineTo(x, padding.t + plotH + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.fillText(wl.toFixed(0), x - 8, padding.t + plotH + 18);
  }
}

function drawCurve(ctx, mapper, curve, color, dash) {
  ctx.beginPath();
  ctx.setLineDash(dash || []);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  curve.forEach((p, i) => {
    const x = mapper.x(p.wl), y = mapper.y(p.t);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBandLines(ctx, mapper, bands, color) {
  bands.forEach(wl => {
    const x = mapper.x(wl);
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, mapper.padding.t);
    ctx.lineTo(x, mapper.padding.t + mapper.plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

/* -------------------------------------------------------------------------
   7. SECTION 2 — BASE SPECTRUM PLOT (with hover tooltip)
   ------------------------------------------------------------------------- */
(function setupBaseSpectrum() {
  const canvas = document.getElementById('baseSpectrumCanvas');
  const tooltip = document.getElementById('baseTooltip');
  if (!canvas) return;
  const ctx = getCtx(canvas);
  const mapper = makeSpectrumMapper(canvas);
  const curve = buildCurve(1.0); // reference-depth synthetic curve

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAxes(ctx, canvas, mapper);
    drawCurve(ctx, mapper, curve, '#4fb8e6');
  }
  render();

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const wl = Math.min(WL_MAX, Math.max(WL_MIN, mapper.invX(px)));
    const t = transmission(wl, 1.0);
    tooltip.hidden = false;
    tooltip.style.left = (e.clientX - rect.left) + 'px';
    tooltip.style.top = (e.clientY - rect.top) + 'px';
    tooltip.textContent = `${wl.toFixed(1)} nm — transmission ${t.toFixed(2)}`;
  });
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
})();

/* -------------------------------------------------------------------------
   8. SECTION 4 — CHOOSE FIVE BANDS (interactive)
   ------------------------------------------------------------------------- */
const chooseState = { bands: [] };

(function setupChoose() {
  const canvas = document.getElementById('chooseCanvas');
  const tooltip = document.getElementById('chooseTooltip');
  const listEl = document.getElementById('selectedBandsList');
  const resetBtn = document.getElementById('resetChoose');
  const scoreReadout = document.getElementById('chooseScoreReadout');
  const scoreValue = document.getElementById('chooseScoreValue');
  if (!canvas) return;
  const ctx = getCtx(canvas);
  const mapper = makeSpectrumMapper(canvas);
  const curves = SIGNATURES.map(sig => ({ sig, curve: buildCurve(sig.scale) }));

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAxes(ctx, canvas, mapper);
    curves.forEach(({ sig, curve }) => drawCurve(ctx, mapper, curve, sig.color, [5, 3]));
    if (chooseState.bands.length) drawBandLines(ctx, mapper, chooseState.bands, '#ef5b4a');
  }

  function updateUI() {
    if (chooseState.bands.length === 0) {
      listEl.innerHTML = '<span class="placeholder">Selected bands: none yet</span>';
    } else {
      listEl.innerHTML = chooseState.bands
        .slice().sort((a, b) => a - b)
        .map(wl => `<span class="band-chip">${wl.toFixed(1)} nm</span>`).join('');
    }
    if (chooseState.bands.length === 5) {
      const score = separabilityScore(chooseState.bands);
      scoreReadout.hidden = false;
      scoreValue.textContent = score.toFixed(3);
    } else {
      scoreReadout.hidden = true;
    }
    const hint = document.getElementById('optimizeHint');
    if (hint) {
      hint.textContent = chooseState.bands.length === 5
        ? 'Ready — click "Optimize five bands" below to compare.'
        : `Choose ${5 - chooseState.bands.length} more band(s) above, then optimize to compare.`;
    }
  }

  canvas.addEventListener('click', (e) => {
    if (chooseState.bands.length >= 5) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const wl = nearestCandidate(mapper.invX(px));
    if (chooseState.bands.includes(wl)) return;
    chooseState.bands.push(wl);
    render();
    updateUI();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const wl = Math.min(WL_MAX, Math.max(WL_MIN, mapper.invX(px)));
    tooltip.hidden = false;
    tooltip.style.left = (e.clientX - rect.left) + 'px';
    tooltip.style.top = (e.clientY - rect.top) + 'px';
    tooltip.textContent = `${wl.toFixed(1)} nm`;
  });
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  resetBtn.addEventListener('click', () => {
    chooseState.bands = [];
    render();
    updateUI();
  });

  render();
  updateUI();
})();

/* -------------------------------------------------------------------------
   9. SECTION 5 — OPTIMIZE BANDS
   ------------------------------------------------------------------------- */
const optimizeState = { bands: null, score: null };

(function setupOptimize() {
  const canvas = document.getElementById('optimizeCanvas');
  const btn = document.getElementById('optimizeBtn');
  const compareGrid = document.getElementById('compareGrid');
  const hint = document.getElementById('optimizeHint');
  if (!canvas || !btn) return;
  const ctx = getCtx(canvas);
  const mapper = makeSpectrumMapper(canvas);
  const curves = SIGNATURES.map(sig => ({ sig, curve: buildCurve(sig.scale) }));

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawAxes(ctx, canvas, mapper);
    curves.forEach(({ sig, curve }) => drawCurve(ctx, mapper, curve, sig.color, [5, 3]));
    if (chooseState.bands.length) drawBandLines(ctx, mapper, chooseState.bands, '#93a1b8');
    if (optimizeState.bands) drawBandLines(ctx, mapper, optimizeState.bands, '#ef5b4a');
  }
  render();

  btn.addEventListener('click', () => {
    if (chooseState.bands.length !== 5) {
      hint.textContent = 'Choose five bands in the section above first, then optimize to compare.';
      return;
    }
    // Run the exhaustive search (see optimizeBands() in section 4 above)
    const result = optimizeBands();
    optimizeState.bands = result.bands;
    optimizeState.score = result.score;

    const userScore = separabilityScore(chooseState.bands);
    document.getElementById('compareUserBands').textContent =
      chooseState.bands.slice().sort((a,b)=>a-b).map(b => b.toFixed(1)).join(', ') + ' nm';
    document.getElementById('compareUserScore').textContent = userScore.toFixed(3);
    document.getElementById('compareOptBands').textContent =
      optimizeState.bands.map(b => b.toFixed(1)).join(', ') + ' nm';
    document.getElementById('compareOptScore').textContent = optimizeState.score.toFixed(3);

    compareGrid.hidden = false;
    hint.textContent = 'Grey dashed lines = your bands. Red dashed lines = optimized bands.';
    render();

    const noiseHint = document.getElementById('noiseHint');
    if (noiseHint) noiseHint.textContent = 'Ready — choose a noise level and run the simulation below.';
  });
})();

/* -------------------------------------------------------------------------
   10. SECTION 6 — NOISE / MONTE CARLO SIMULATION
   ------------------------------------------------------------------------- */
(function setupNoise() {
  const canvas = document.getElementById('noiseCanvas');
  const runBtn = document.getElementById('runNoiseBtn');
  const noiseBtns = document.querySelectorAll('.noise-btn');
  const hint = document.getElementById('noiseHint');
  if (!canvas || !runBtn) return;
  const ctx = getCtx(canvas);
  let selectedNoise = 0;

  noiseBtns.forEach(b => b.addEventListener('click', () => {
    noiseBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedNoise = Number(b.dataset.noise);
  }));

  const NOISE_LEVELS = [0, 1, 2, 5, 10]; // percent

  function drawAccuracyChart(userSeries, optSeries) {
    const w = canvas.width, h = canvas.height;
    const padding = { l: 50, r: 20, t: 20, b: 36 };
    const plotW = w - padding.l - padding.r;
    const plotH = h - padding.t - padding.b;
    ctx.clearRect(0, 0, w, h);

    const xFor = i => padding.l + (i / (NOISE_LEVELS.length - 1)) * plotW;
    const yFor = v => padding.t + (1 - v) * plotH;

    // gridlines / axis labels (accuracy 0..1)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#5c6a82';
    for (let v = 0; v <= 1.001; v += 0.25) {
      const y = yFor(v);
      ctx.beginPath(); ctx.moveTo(padding.l, y); ctx.lineTo(padding.l + plotW, y); ctx.stroke();
      ctx.fillText(v.toFixed(2), 8, y + 3);
    }
    NOISE_LEVELS.forEach((n, i) => {
      const x = xFor(i);
      ctx.fillText(n + '%', x - 8, padding.t + plotH + 18);
    });

    function drawSeries(series, color) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      series.forEach((v, i) => {
        const x = xFor(i), y = yFor(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      series.forEach((v, i) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(xFor(i), yFor(v), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawSeries(userSeries, '#93a1b8');
    drawSeries(optSeries, '#ef5b4a');

    // legend
    ctx.fillStyle = '#93a1b8'; ctx.fillText('— your bands', padding.l, 14);
    ctx.fillStyle = '#ef5b4a'; ctx.fillText('— optimized bands', padding.l + 110, 14);
  }

  runBtn.addEventListener('click', () => {
    if (chooseState.bands.length !== 5 || !optimizeState.bands) {
      hint.textContent = 'Choose bands and run the optimizer above first, then run the noise simulation.';
      return;
    }
    hint.textContent = 'Running Monte Carlo simulation…';
    // slight timeout so the "Running…" message can paint before the (fast) computation
    setTimeout(() => {
      const userSeries = NOISE_LEVELS.map(n => monteCarloAccuracy(chooseState.bands, n / 100));
      const optSeries = NOISE_LEVELS.map(n => monteCarloAccuracy(optimizeState.bands, n / 100));
      drawAccuracyChart(userSeries, optSeries);
      const idx = NOISE_LEVELS.indexOf(selectedNoise);
      const uAcc = (userSeries[idx] * 100).toFixed(1);
      const oAcc = (optSeries[idx] * 100).toFixed(1);
      hint.textContent = `At ${selectedNoise}% noise: your bands classified correctly ${uAcc}% of trials, optimized bands ${oAcc}% of trials (${NOISE_LEVELS.length}-point curve shown for all noise levels).`;
    }, 30);
  });
})();
/* =========================================================
   QUIZ
   ========================================================= */

const checkQuizBtn = document.getElementById('checkQuiz');
const resetQuizBtn = document.getElementById('resetQuiz');
const quizResult = document.getElementById('quizResult');

if (checkQuizBtn && resetQuizBtn && quizResult) {

  checkQuizBtn.addEventListener('click', () => {

    const questions = document.querySelectorAll('.quiz-question');

    let score = 0;
    let answered = 0;

    questions.forEach((question) => {

      const selected = question.querySelector(
        'input[type="radio"]:checked'
      );

      question.classList.remove('correct', 'incorrect');

      if (!selected) {
        return;
      }

      answered++;

      const correctAnswer = question.dataset.answer;

      if (selected.value === correctAnswer) {
        score++;
        question.classList.add('correct');
      } else {
        question.classList.add('incorrect');
      }

    });


    quizResult.style.display = 'block';


    if (answered < questions.length) {

      quizResult.textContent =
        `You've answered ${answered} of ${questions.length} questions. Complete all five to see your final score.`;

      return;
    }


    if (score === 5) {

      quizResult.textContent =
        '5/5 — Excellent. You’re thinking like a remote-sensing scientist.';

    } else if (score >= 3) {

      quizResult.textContent =
        `${score}/5 — Nice work. You’ve got the main ideas. Review the sections you missed and try again.`;

    } else {

      quizResult.textContent =
        `${score}/5 — Keep exploring the signal. Revisit the atmosphere, wavelengths, and physics-informed ML sections and try again.`;

    }

  });


  resetQuizBtn.addEventListener('click', () => {

    document
      .querySelectorAll('.quiz-question')
      .forEach((question) => {

        question.classList.remove('correct', 'incorrect');

        question
          .querySelectorAll('input[type="radio"]')
          .forEach((input) => {
            input.checked = false;
          });

      });

    quizResult.style.display = 'none';
    quizResult.textContent = '';

  });

}
