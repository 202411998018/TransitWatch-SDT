(() => {
  "use strict";

  const FORMAL_DURATION = 4000;

  const state = {
    difficulty: "medium",
    trials: [],
    trialIndex: 0,
    currentStimulus: null,
    currentStart: 0,
    timerId: null,
    practiceTrials: [],
    practiceIndex: 0,
    practiceCurrent: null,
    lastResult: { dPrime: 1.5, c: 0, hitRate: 0.5, falseAlarmRate: 0.5 }
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindNavigation();
    bindSettings();
    bindPractice();
    bindFormalTask();
    bindExplorer();

    drawTutorialExamples();
    showPage("home");
  }

  function bindNavigation() {
    document.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => showPage(button.dataset.page));
    });
  }

  function bindSettings() {
    $("prevalence").addEventListener("input", syncSettings);
    $("trialCount").addEventListener("input", syncSettings);

    document.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.addEventListener("click", () => {
        state.difficulty = button.dataset.difficulty;
        document.querySelectorAll("[data-difficulty]").forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        $("diffLabel").textContent = difficultyLabel(state.difficulty);
      });
    });

    syncSettings();
  }

  function bindPractice() {
    $("startPracticeBtn").addEventListener("click", startPractice);
    $("practiceYes").addEventListener("click", () => practiceRespond(true));
    $("practiceNo").addEventListener("click", () => practiceRespond(false));
  }

  function bindFormalTask() {
    $("startExperimentBtn").addEventListener("click", startExperiment);
    $("repeatExperimentBtn").addEventListener("click", startExperiment);
    $("formalYes").addEventListener("click", () => respond(true));
    $("formalNo").addEventListener("click", () => respond(false));

    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if ($("experiment").classList.contains("active")) {
        if (key === "f") respond(true);
        if (key === "j") respond(false);
      } else if ($("practice").classList.contains("active")) {
        if (key === "f") practiceRespond(true);
        if (key === "j") practiceRespond(false);
      }
    });
  }

  function bindExplorer() {
    $("dSlider").addEventListener("input", updateExplorer);
    $("cSlider").addEventListener("input", updateExplorer);
  }

  function showPage(id) {
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
    const target = $(id);
    if (!target) return;

    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (id === "tutorial") {
      requestAnimationFrame(() => {
        drawTutorialExamples();
        requestAnimationFrame(drawTutorialExamples);
      });
    }
  }

  function syncSettings() {
    $("prevLabel").textContent = `${$("prevalence").value}%`;
    $("trialLabel").textContent = $("trialCount").value;
  }

  function difficultyLabel(level) {
    return { easy: "简单", medium: "中等", hard: "困难" }[level];
  }

  // -----------------------------
  // Tutorial examples
  // -----------------------------
  function drawTutorialExamples() {
    const transitCanvas = $("tutorialTransit");
    const noiseCanvas = $("tutorialNoise");

    if (!transitCanvas || !noiseCanvas) return;

    drawTutorialCurve(transitCanvas, true);
    drawTutorialCurve(noiseCanvas, false);
  }

  function drawTutorialCurve(canvas, hasTransit) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = 120;
    const center = 64;
    const width = 28;
    const depth = 0.034;
    const data = [];

    for (let i = 0; i < N; i++) {
      let y = 1 + 0.0015 * Math.sin(i / 13) + randn() * 0.0033;

      if (hasTransit) {
        const distance = Math.abs(i - center);

        if (distance < width / 2) {
          const edge = 5;
          let shape = 1;

          if (distance > width / 2 - edge) {
            shape = (width / 2 - distance) / edge;
          }

          y -= depth * Math.max(0, shape);
        }
      } else {
        // Isolated low points are deliberately included as non-transit distractors.
        if (i === 30) y -= 0.017;
        if (i === 31) y -= 0.005;
        if (i === 88) y -= 0.015;
      }

      data.push(y);
    }

    drawLightCurveCanvas(
      canvas,
      data,
      hasTransit
        ? { from: center - width / 2, to: center + width / 2, label: "凌星区间" }
        : null,
      !hasTransit ? [30, 88] : []
    );
  }

  // -----------------------------
  // Practice
  // -----------------------------
  function startPractice() {
    state.practiceTrials = shuffle([true, false, true, false, true]);
    state.practiceIndex = 0;

    showPage("practice");
    nextPractice();
  }

  function nextPractice() {
    if (state.practiceIndex >= state.practiceTrials.length) {
      showPage("settings");
      return;
    }

    state.practiceCurrent = {
      signal: state.practiceTrials[state.practiceIndex],
      done: false
    };

    $("practiceLabel").textContent =
      `PRACTICE ${state.practiceIndex + 1} / ${state.practiceTrials.length}`;

    $("practiceFeedback").className = "practice-feedback";
    $("practiceFeedback").textContent = "";

    const stimulus = generateStimulus(state.practiceCurrent.signal, "easy");
    state.practiceCurrent.stimulus = stimulus;

    drawLightCurveCanvas($("practiceCurve"), stimulus.data, null, []);
  }

  function practiceRespond(choice) {
    const current = state.practiceCurrent;
    if (!current || current.done) return;

    current.done = true;

    const correct = choice === current.signal;
    const feedback = $("practiceFeedback");

    feedback.className = `practice-feedback ${correct ? "good" : "bad"}`;

    if (current.signal) {
      feedback.textContent = correct
        ? "✓ 正确：这条曲线存在连续的亮度下降—维持—恢复结构。"
        : "✗ 这条曲线其实有凌星。黄色区域标出了真实凌星位置。";

      drawLightCurveCanvas(
        $("practiceCurve"),
        current.stimulus.data,
        {
          from: current.stimulus.transitFrom,
          to: current.stimulus.transitTo,
          label: "真实凌星区间"
        },
        []
      );
    } else {
      feedback.textContent = correct
        ? "✓ 正确：这条曲线只是自然波动，没有持续的凌星凹槽。"
        : "✗ 这条曲线没有凌星；局部低点并不构成连续的下降—恢复结构。";
    }

    setTimeout(() => {
      state.practiceIndex += 1;
      nextPractice();
    }, 1500);
  }

  // -----------------------------
  // Formal experiment
  // -----------------------------
  function startExperiment() {
    clearInterval(state.timerId);

    const n = Number($("trialCount").value);
    const pSignal = Number($("prevalence").value) / 100;

    state.trials = Array.from({ length: n }, (_, i) => ({
      index: i + 1,
      signal: Math.random() < pSignal
    }));

    state.trialIndex = 0;
    state.currentStimulus = null;

    $("expPrev").textContent = `${Math.round(pSignal * 100)}%`;
    $("expDiff").textContent = difficultyLabel(state.difficulty);
    $("lastRT").textContent = "—";

    showPage("experiment");
    nextTrial();
  }

  function nextTrial() {
    if (state.trialIndex >= state.trials.length) {
      clearInterval(state.timerId);
      finishExperiment();
      return;
    }

    const trial = state.trials[state.trialIndex];
    const stimulus = generateStimulus(trial.signal, state.difficulty);

    trial.stimulus = stimulus;

    state.currentStimulus = trial;
    state.currentStart = performance.now();

    $("trialNow").textContent =
      `${state.trialIndex + 1} / ${state.trials.length}`;

    $("progressFill").style.width =
      `${(state.trialIndex / state.trials.length) * 100}%`;

    $("starLabel").textContent =
      `TARGET STAR K-${1800 + state.trialIndex * 7}`;

    drawLightCurveCanvas($("lightcurve"), stimulus.data, null, []);

    clearInterval(state.timerId);
    $("timerFill").style.width = "100%";

    state.timerId = setInterval(() => {
      const elapsed = performance.now() - state.currentStart;
      const remain = Math.max(0, 1 - elapsed / FORMAL_DURATION);

      $("timerFill").style.width = `${remain * 100}%`;

      if (remain <= 0) {
        clearInterval(state.timerId);
        respond(null);
      }
    }, 100);
  }

  function respond(choice) {
    const trial = state.currentStimulus;
    if (!trial || trial.done) return;

    trial.done = true;
    clearInterval(state.timerId);

    const rt = Math.round(performance.now() - state.currentStart);

    trial.response = choice;
    trial.rt = rt;

    if (choice === null) trial.outcome = "timeout";
    else if (trial.signal && choice) trial.outcome = "hit";
    else if (trial.signal && !choice) trial.outcome = "miss";
    else if (!trial.signal && choice) trial.outcome = "fa";
    else trial.outcome = "cr";

    $("lastRT").textContent =
      choice === null ? "超时" : `${rt} ms`;

    state.trialIndex += 1;

    setTimeout(nextTrial, 280);
  }

  // -----------------------------
  // Stimulus generation
  // -----------------------------
  function generateStimulus(signal, level) {
    const cfg = {
      easy: {
        noise: 0.0045,
        depth: [0.026, 0.040],
        width: [22, 34],
        drift: 0.0025,
        outliers: 1
      },
      medium: {
        noise: 0.0070,
        depth: [0.018, 0.028],
        width: [19, 30],
        drift: 0.0040,
        outliers: 2
      },
      hard: {
        noise: 0.0095,
        depth: [0.013, 0.021],
        width: [16, 27],
        drift: 0.0055,
        outliers: 4
      }
    }[level];

    const N = 150;
    const data = [];

    const phase = Math.random() * Math.PI * 2;
    const driftSlope = (Math.random() - 0.5) * cfg.drift;
    const waveAmp = cfg.drift * (0.35 + 0.55 * Math.random());

    const center = 45 + Math.floor(Math.random() * 60);

    const transitWidth = Math.floor(
      cfg.width[0] + Math.random() * (cfg.width[1] - cfg.width[0])
    );

    const depth =
      cfg.depth[0] + Math.random() * (cfg.depth[1] - cfg.depth[0]);

    for (let i = 0; i < N; i++) {
      let y =
        1 +
        driftSlope * ((i - N / 2) / N) +
        waveAmp * Math.sin(i / 19 + phase) +
        randn() * cfg.noise;

      if (signal) {
        const d = Math.abs(i - center);

        if (d < transitWidth / 2) {
          const edge = transitWidth * 0.18;
          let shape = 1;

          if (d > transitWidth / 2 - edge) {
            shape = (transitWidth / 2 - d) / edge;
          }

          y -= depth * Math.max(0, Math.min(1, shape));
        }
      } else if (level !== "easy" && Math.random() < 0.016) {
        y -= cfg.depth[0] * (0.25 + 0.35 * Math.random());
      }

      data.push(y);
    }

    for (let k = 0; k < cfg.outliers; k++) {
      const idx = Math.floor(Math.random() * N);
      data[idx] += randn() * cfg.noise * 2.0;
    }

    return {
      data,
      transitFrom: center - transitWidth / 2,
      transitTo: center + transitWidth / 2
    };
  }

  // -----------------------------
  // Light curve renderer
  // -----------------------------
  function drawLightCurveCanvas(canvas, data, highlight = null, markedPoints = []) {
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const N = data.length;

    const margin = { l: 66, r: 26, t: 24, b: 52 };

    const innerW = w - margin.l - margin.r;
    const innerH = h - margin.t - margin.b;

    const ymin = 0.945;
    const ymax = 1.045;

    const xScale = (i) =>
      margin.l + (i / (N - 1)) * innerW;

    const yScale = (y) =>
      margin.t + ((ymax - y) / (ymax - ymin)) * innerH;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#08121e";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#17304a";
    ctx.lineWidth = 1;

    for (let j = 0; j <= 5; j++) {
      const y = margin.t + (j * innerH) / 5;

      ctx.beginPath();
      ctx.moveTo(margin.l, y);
      ctx.lineTo(w - margin.r, y);
      ctx.stroke();
    }

    for (let j = 0; j <= 6; j++) {
      const x = margin.l + (j * innerW) / 6;

      ctx.beginPath();
      ctx.moveTo(x, margin.t);
      ctx.lineTo(x, h - margin.b);
      ctx.stroke();
    }

    // Tutorial highlight
    if (highlight) {
      const x1 = xScale(highlight.from);
      const x2 = xScale(highlight.to);

      ctx.fillStyle = "rgba(255,201,107,.14)";
      ctx.fillRect(x1, margin.t, x2 - x1, innerH);

      ctx.strokeStyle = "rgba(255,201,107,.75)";
      ctx.strokeRect(x1, margin.t, x2 - x1, innerH);

      if (highlight.label) {
        ctx.fillStyle = "#ffc96b";
        ctx.font = "13px sans-serif";
        ctx.fillText(highlight.label, x1 + 8, margin.t + 18);
      }
    }

    // Baseline
    ctx.strokeStyle = "rgba(124,215,255,.28)";
    ctx.setLineDash([5, 6]);

    ctx.beginPath();
    ctx.moveTo(margin.l, yScale(1));
    ctx.lineTo(w - margin.r, yScale(1));
    ctx.stroke();

    ctx.setLineDash([]);

    // Main light curve
    ctx.strokeStyle = "#8fdcff";
    ctx.lineWidth = 2.5;

    ctx.beginPath();

    data.forEach((y, i) => {
      if (i === 0) ctx.moveTo(xScale(i), yScale(y));
      else ctx.lineTo(xScale(i), yScale(y));
    });

    ctx.stroke();

    // Sample points
    ctx.fillStyle = "rgba(184,166,255,.62)";

    for (let i = 0; i < N; i += 3) {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(data[i]), 1.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mark isolated low points in the no-transit tutorial example.
    markedPoints.forEach((idx) => {
      ctx.fillStyle = "#ffc96b";

      ctx.beginPath();
      ctx.arc(xScale(idx), yScale(data[idx]), 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "12px sans-serif";

      ctx.fillText(
        "随机低点",
        xScale(idx) - 24,
        Math.max(18, yScale(data[idx]) - 12)
      );
    });

    // Axes
    ctx.strokeStyle = "#4a6683";
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(margin.l, h - margin.b);
    ctx.lineTo(w - margin.r, h - margin.b);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(margin.l, margin.t);
    ctx.lineTo(margin.l, h - margin.b);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#9db0c5";
    ctx.font = "12px sans-serif";

    [0.95, 0.97, 0.99, 1.01, 1.03, 1.05].forEach((v) => {
      ctx.fillText(v.toFixed(2), 18, yScale(v) + 4);
    });

    ctx.fillText("Observation Time", w / 2 - 42, h - 15);

    ctx.save();
    ctx.translate(16, h / 2 + 40);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Relative Brightness", 0, 0);
    ctx.restore();
  }

  // -----------------------------
  // Results
  // -----------------------------
  function finishExperiment() {
    $("progressFill").style.width = "100%";

    const valid = state.trials.filter((t) => t.outcome !== "timeout");

    const hit =
      valid.filter((t) => t.outcome === "hit").length;

    const miss =
      valid.filter((t) => t.outcome === "miss").length;

    const fa =
      valid.filter((t) => t.outcome === "fa").length;

    const cr =
      valid.filter((t) => t.outcome === "cr").length;

    const nSignal = hit + miss;
    const nNoise = fa + cr;

    const hitRateRaw =
      nSignal ? hit / nSignal : 0;

    const falseAlarmRateRaw =
      nNoise ? fa / nNoise : 0;

    // Log-linear correction avoids infinite z scores at rates of 0 or 1.
    const hitRateCorrected =
      nSignal ? (hit + 0.5) / (nSignal + 1) : 0.5;

    const falseAlarmRateCorrected =
      nNoise ? (fa + 0.5) / (nNoise + 1) : 0.5;

    const zH = normInv(hitRateCorrected);
    const zF = normInv(falseAlarmRateCorrected);

    const dPrime = zH - zF;
    const criterionC = -0.5 * (zH + zF);

    const accuracy =
      valid.length ? (hit + cr) / valid.length : 0;

    const meanRT =
      valid.length
        ? Math.round(
            valid.reduce((sum, t) => sum + t.rt, 0) /
            valid.length
          )
        : 0;

    state.lastResult = {
      dPrime,
      c: criterionC,
      hitRate: hitRateRaw,
      falseAlarmRate: falseAlarmRateRaw
    };

    $("rHit").textContent = hit;
    $("rMiss").textContent = miss;
    $("rFA").textContent = fa;
    $("rCR").textContent = cr;

    $("rHR").textContent =
      `${(hitRateRaw * 100).toFixed(1)}%`;

    $("rFAR").textContent =
      `${(falseAlarmRateRaw * 100).toFixed(1)}%`;

    $("rAcc").textContent =
      `${(accuracy * 100).toFixed(1)}%`;

    $("rRT").textContent =
      `${meanRT} ms`;

    $("rDprime").textContent =
      dPrime.toFixed(2);

    $("rC").textContent =
      criterionC.toFixed(2);

    $("obsFA").textContent =
      falseAlarmRateRaw.toFixed(2);

    $("obsHit").textContent =
      hitRateRaw.toFixed(2);

    $("dprimeTag").textContent =
      dPrime >= 2
        ? "区分能力较强"
        : dPrime >= 1
        ? "区分能力中等"
        : dPrime >= 0.5
        ? "区分能力有限"
        : "区分能力较弱";

    $("cTag").textContent =
      criterionC > 0.25
        ? "偏保守"
        : criterionC < -0.25
        ? "偏宽松"
        : "判断标准较中性";

    drawObservedROC(falseAlarmRateRaw, hitRateRaw);

    $("dSlider").value =
      clamp(dPrime, 0, 3.5).toFixed(2);

    $("cSlider").value =
      clamp(criterionC, -2, 2).toFixed(2);

    updateExplorer();
    showPage("results");
  }

  function drawObservedROC(fa, hit) {
    const canvas = $("observedRoc");
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;

    const margin = { l: 50, r: 22, t: 18, b: 44 };

    const innerW = w - margin.l - margin.r;
    const innerH = h - margin.t - margin.b;

    const xScale = (x) =>
      margin.l + x * innerW;

    const yScale = (y) =>
      h - margin.b - y * innerH;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#08121e";
    ctx.fillRect(0, 0, w, h);

    drawRocGrid(ctx, w, h, margin, innerW, innerH);

    ctx.strokeStyle = "#9db0c5";
    ctx.setLineDash([5, 6]);

    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(0));
    ctx.lineTo(xScale(1), yScale(1));
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = "#ff7e8c";

    ctx.beginPath();
    ctx.arc(xScale(fa), yScale(hit), 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dceaff";
    ctx.font = "13px sans-serif";

    ctx.fillText(
      `Observed (${fa.toFixed(2)}, ${hit.toFixed(2)})`,
      Math.min(xScale(fa) + 10, w - 170),
      Math.max(yScale(hit) - 10, 24)
    );

    drawRocLabels(ctx, w, h);
  }

  // -----------------------------
  // Interactive SDT explorer
  // -----------------------------
  function updateExplorer() {
    const d = Number($("dSlider").value);
    const c = Number($("cSlider").value);

    $("dSliderVal").textContent =
      d.toFixed(2);

    $("cSliderVal").textContent =
      c.toFixed(2);

    // Equal-variance SDT:
    // noise mean = 0
    // signal mean = d'
    // criterion location k = c + d'/2
    const k = c + d / 2;

    const fa =
      1 - normalCDF(k);

    const hit =
      1 - normalCDF(k - d);

    const auc =
      normalCDF(d / Math.sqrt(2));

    $("theoryHit").textContent =
      hit.toFixed(2);

    $("theoryFA").textContent =
      fa.toFixed(2);

    $("theoryC").textContent =
      c.toFixed(2);

    $("theoryAuc").textContent =
      auc.toFixed(2);

    drawDistributionChart(d, c);
    drawROCChart(d, fa, hit);
  }

  function drawDistributionChart(d, c) {
    const canvas = $("distChart");
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;

    const margin = { l: 52, r: 24, t: 20, b: 36 };

    const innerW = w - margin.l - margin.r;
    const innerH = h - margin.t - margin.b;

    const criterion = c + d / 2;

    const xmin = -3.5;
    const xmax = Math.max(3.5, d + 3.5);

    const xScale = (x) =>
      margin.l +
      ((x - xmin) / (xmax - xmin)) *
        innerW;

    const yScale = (y) =>
      h - margin.b -
      (y * innerH) / 0.45;

    const pdf = (x, mu) =>
      Math.exp(-0.5 * (x - mu) ** 2) /
      Math.sqrt(2 * Math.PI);

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#08121e";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#183149";

    for (let i = 0; i <= 5; i++) {
      const y =
        margin.t +
        (innerH * i) / 5;

      ctx.beginPath();
      ctx.moveTo(margin.l, y);
      ctx.lineTo(w - margin.r, y);
      ctx.stroke();
    }

    shadeDistribution(
      ctx,
      criterion,
      xmax,
      (x) => pdf(x, 0),
      xScale,
      yScale,
      h,
      margin,
      "rgba(124,215,255,.10)"
    );

    shadeDistribution(
      ctx,
      criterion,
      xmax,
      (x) => pdf(x, d),
      xScale,
      yScale,
      h,
      margin,
      "rgba(184,166,255,.11)"
    );

    drawFunctionCurve(
      ctx,
      (x) => pdf(x, 0),
      xmin,
      xmax,
      xScale,
      yScale,
      "#7cd7ff",
      3
    );

    drawFunctionCurve(
      ctx,
      (x) => pdf(x, d),
      xmin,
      xmax,
      xScale,
      yScale,
      "#b8a6ff",
      3
    );

    ctx.strokeStyle = "#ffc96b";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.moveTo(
      xScale(criterion),
      margin.t
    );

    ctx.lineTo(
      xScale(criterion),
      h - margin.b
    );

    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#dceaff";
    ctx.font = "13px sans-serif";

    ctx.fillText(
      "Noise",
      xScale(0) - 20,
      yScale(pdf(0, 0)) - 10
    );

    ctx.fillText(
      "Signal",
      xScale(d) - 20,
      yScale(pdf(d, d)) - 10
    );

    ctx.fillStyle = "#ffc96b";

    ctx.fillText(
      "criterion",
      Math.min(
        xScale(criterion) + 8,
        w - 86
      ),
      margin.t + 18
    );

    ctx.fillStyle = "#9db0c5";
    ctx.font = "12px sans-serif";

    ctx.fillText(
      "internal evidence",
      w / 2 - 40,
      h - 10
    );
  }

  function shadeDistribution(
    ctx,
    from,
    to,
    fn,
    xScale,
    yScale,
    h,
    margin,
    color
  ) {
    if (from >= to) return;

    ctx.beginPath();
    ctx.moveTo(
      xScale(from),
      h - margin.b
    );

    const step =
      (to - from) / 100;

    for (let x = from; x <= to; x += step) {
      ctx.lineTo(
        xScale(x),
        yScale(fn(x))
      );
    }

    ctx.lineTo(
      xScale(to),
      h - margin.b
    );

    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawFunctionCurve(
    ctx,
    fn,
    xmin,
    xmax,
    xScale,
    yScale,
    color,
    width
  ) {
    const step =
      (xmax - xmin) / 220;

    ctx.beginPath();

    let first = true;

    for (let x = xmin; x <= xmax; x += step) {
      const px = xScale(x);
      const py = yScale(fn(x));

      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawROCChart(d, faPoint, hitPoint) {
    const canvas = $("rocChart");
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;

    const margin = { l: 44, r: 20, t: 18, b: 42 };

    const innerW =
      w - margin.l - margin.r;

    const innerH =
      h - margin.t - margin.b;

    const xScale = (x) =>
      margin.l + x * innerW;

    const yScale = (y) =>
      h - margin.b - y * innerH;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#08121e";
    ctx.fillRect(0, 0, w, h);

    drawRocGrid(
      ctx,
      w,
      h,
      margin,
      innerW,
      innerH
    );

    ctx.strokeStyle =
      "rgba(157,176,197,.55)";

    ctx.setLineDash([4, 6]);

    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(0));
    ctx.lineTo(xScale(1), yScale(1));
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.beginPath();

    for (let i = 1; i <= 200; i++) {
      const f = i / 200;

      const zf =
        normInv(
          clamp(f, 0.0001, 0.9999)
        );

      const hRate =
        normalCDF(d + zf);

      const px = xScale(f);
      const py = yScale(hRate);

      if (i === 1) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.strokeStyle = "#b8a6ff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#ffc96b";

    ctx.beginPath();
    ctx.arc(
      xScale(faPoint),
      yScale(hitPoint),
      5.5,
      0,
      Math.PI * 2
    );
    ctx.fill();

    drawRocLabels(ctx, w, h);
  }

  function drawRocGrid(
    ctx,
    w,
    h,
    margin,
    innerW,
    innerH
  ) {
    ctx.strokeStyle = "#183149";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const x =
        margin.l +
        (innerW * i) / 5;

      const y =
        margin.t +
        (innerH * i) / 5;

      ctx.beginPath();
      ctx.moveTo(x, margin.t);
      ctx.lineTo(x, h - margin.b);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(margin.l, y);
      ctx.lineTo(w - margin.r, y);
      ctx.stroke();
    }
  }

  function drawRocLabels(ctx, w, h) {
    ctx.fillStyle = "#9db0c5";
    ctx.font = "12px sans-serif";

    ctx.fillText(
      "False Alarm Rate",
      w / 2 - 42,
      h - 10
    );

    ctx.save();

    ctx.translate(
      13,
      h / 2 + 28
    );

    ctx.rotate(-Math.PI / 2);

    ctx.fillText(
      "Hit Rate",
      0,
      0
    );

    ctx.restore();
  }

  // -----------------------------
  // Math helpers
  // -----------------------------
  function randn() {
    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return (
      Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v)
    );
  }

  function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  }

  function erf(x) {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t =
      1 / (1 + p * x);

    const y =
      1 -
      (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-x * x));

    return sign * y;
  }

  // Peter John Acklam inverse-normal approximation.
  function normInv(p) {
    if (p <= 0 || p >= 1) return NaN;

    const a = [
      -39.6968302866538,
      220.946098424521,
      -275.928510446969,
      138.357751867269,
      -30.6647980661472,
      2.50662827745924
    ];

    const b = [
      -54.4760987982241,
      161.585836858041,
      -155.698979859887,
      66.8013118877197,
      -13.2806815528857
    ];

    const c = [
      -0.00778489400243029,
      -0.322396458041136,
      -2.40075827716184,
      -2.54973253934373,
      4.37466414146497,
      2.93816398269878
    ];

    const d = [
      0.00778469570904146,
      0.32246712907004,
      2.445134137143,
      3.75440866190742
    ];

    const plow = 0.02425;
    const phigh = 1 - plow;

    let q;
    let r;

    if (p < plow) {
      q = Math.sqrt(
        -2 * Math.log(p)
      );

      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    if (p > phigh) {
      q = Math.sqrt(
        -2 * Math.log(1 - p)
      );

      return -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    q = p - 0.5;
    r = q * q;

    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [copy[i], copy[j]] =
        [copy[j], copy[i]];
    }

    return copy;
  }
})();
