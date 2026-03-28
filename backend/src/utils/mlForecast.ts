// src/utils/mlForecast.ts
// ─────────────────────────────────────────────────────────────────────────────
// Production ML Forecasting Engine — Pure TypeScript
// Models: Holt-Winters Triple Exponential Smoothing, ARIMA(1,1,1)-lite,
//         Seasonal Decomposition, Ensemble with auto-selection
// ─────────────────────────────────────────────────────────────────────────────

export interface ForecastOutput {
  model:          string;
  forecastQty:    number;
  confidence:     number;         // 0–100
  mape:           number;         // Mean Absolute Percentage Error
  rmse:           number;         // Root Mean Square Error
  mae:            number;         // Mean Absolute Error
  trend:          'RISING' | 'FALLING' | 'STABLE' | 'VOLATILE';
  seasonality:    boolean;
  periodicity:    number;         // detected seasonal period (0 = none)
  upperBound:     number;         // 95% prediction interval upper
  lowerBound:     number;         // 95% prediction interval lower
  fitted:         number[];       // in-sample fitted values
  residuals:      number[];       // actual - fitted
  modelParams:    Record<string, number>;
  explanation:    string;
}

// ── Utility functions ─────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function rmse(actual: number[], fitted: number[]): number {
  const n = Math.min(actual.length, fitted.length);
  if (n === 0) return 0;
  return Math.sqrt(actual.slice(0, n).reduce((s, v, i) => s + (v - fitted[i]) ** 2, 0) / n);
}

function mae(actual: number[], fitted: number[]): number {
  const n = Math.min(actual.length, fitted.length);
  if (n === 0) return 0;
  return actual.slice(0, n).reduce((s, v, i) => s + Math.abs(v - fitted[i]), 0) / n;
}

function mape(actual: number[], fitted: number[]): number {
  const n = Math.min(actual.length, fitted.length);
  let count = 0, total = 0;
  for (let i = 0; i < n; i++) {
    if (actual[i] !== 0) { total += Math.abs((actual[i] - fitted[i]) / actual[i]); count++; }
  }
  return count === 0 ? 0 : Math.round((total / count) * 100);
}

/** Autocorrelation at lag k — used to detect seasonality */
function autocorrelation(series: number[], lag: number): number {
  if (series.length <= lag) return 0;
  const m   = mean(series);
  const num = series.slice(lag).reduce((s, v, i) => s + (v - m) * (series[i] - m), 0);
  const den = series.reduce((s, v) => s + (v - m) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

/** Detect dominant seasonal period (checks 2,3,4,6,7,12,13) */
function detectSeasonality(series: number[]): number {
  if (series.length < 8) return 0;
  const candidates = [2, 3, 4, 6, 7, 12, 13];
  let bestPeriod = 0, bestAC = 0.15; // threshold
  for (const p of candidates) {
    if (series.length < p * 2) continue;
    const ac = autocorrelation(series, p);
    if (ac > bestAC) { bestAC = ac; bestPeriod = p; }
  }
  return bestPeriod;
}

/** Detect trend direction via slope significance */
function detectTrend(series: number[]): 'RISING' | 'FALLING' | 'STABLE' | 'VOLATILE' {
  if (series.length < 3) return 'STABLE';
  const cv = std(series) / (mean(series) || 1);
  if (cv > 1.2) return 'VOLATILE';
  const n     = series.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(series);
  const ssXX  = series.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
  const slope = ssXX === 0 ? 0 : series.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0) / ssXX;
  const relSlope = Math.abs(slope) / (yMean || 1);
  if (relSlope < 0.03) return 'STABLE';
  return slope > 0 ? 'RISING' : 'FALLING';
}

// ── Model 1: Holt-Winters Triple Exponential Smoothing ────────────────────────
// Handles level, trend, and seasonality simultaneously
// Optimises α, β, γ via grid search minimising SSE

export function holtwinters(
  series: number[],
  seasonPeriod: number = 0,
  horizon: number = 1
): ForecastOutput {
  const n = series.length;
  if (n < 4) return simpleExponentialSmoothing(series, horizon);

  const m = seasonPeriod > 1 && n >= seasonPeriod * 2 ? seasonPeriod : 0;
  const useSeasonality = m > 0;

  // Grid search for optimal α, β, γ
  let bestSSE = Infinity;
  let bestAlpha = 0.3, bestBeta = 0.1, bestGamma = 0.1;

  const alphas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const betas  = [0.05, 0.1, 0.2, 0.3, 0.4];
  const gammas = useSeasonality ? [0.1, 0.2, 0.3, 0.4] : [0];

  for (const α of alphas) {
    for (const β of betas) {
      for (const γ of gammas) {
        const { sse } = runHW(series, α, β, γ, m);
        if (sse < bestSSE) { bestSSE = sse; bestAlpha = α; bestBeta = β; bestGamma = γ; }
      }
    }
  }

  const { fitted, level, trend, seasonal } = runHW(series, bestAlpha, bestBeta, bestGamma, m);

  // Forecast h steps ahead
  let forecastVal = 0;
  for (let h = 1; h <= horizon; h++) {
    const seasonIdx = useSeasonality ? (n - m + ((h - 1) % m)) % m : 0;
    const s = useSeasonality ? seasonal[seasonIdx] ?? 1 : 1;
    forecastVal = (level + trend * h) * s;
  }
  forecastVal = Math.max(0, forecastVal);

  const res  = series.map((v, i) => v - (fitted[i] ?? 0));
  const σ    = std(res);
  const z95  = 1.96;

  const confidence = Math.max(20, Math.min(95, 95 - mape(series, fitted)));

  return {
    model:       useSeasonality ? 'Holt-Winters Triple Exponential Smoothing' : 'Holt-Winters Double Exponential Smoothing',
    forecastQty: Math.round(forecastVal),
    confidence,
    mape:        mape(series, fitted),
    rmse:        Math.round(rmse(series, fitted) * 100) / 100,
    mae:         Math.round(mae(series, fitted) * 100) / 100,
    trend:       detectTrend(series),
    seasonality: useSeasonality,
    periodicity: m,
    upperBound:  Math.round(forecastVal + z95 * σ * Math.sqrt(horizon)),
    lowerBound:  Math.max(0, Math.round(forecastVal - z95 * σ * Math.sqrt(horizon))),
    fitted,
    residuals:   res,
    modelParams: { alpha: bestAlpha, beta: bestBeta, gamma: bestGamma, seasonPeriod: m },
    explanation: `Holt-Winters with α=${bestAlpha} β=${bestBeta}${useSeasonality ? ` γ=${bestGamma} period=${m}` : ''}.` +
                 ` Captures level, trend, and ${useSeasonality ? 'seasonal' : 'no seasonal'} patterns.`,
  };
}

function runHW(series: number[], α: number, β: number, γ: number, m: number) {
  const n = series.length;
  const useS = m > 1;
  const fitted: number[] = [];

  // Initialise level, trend, seasonal
  let L = mean(series.slice(0, Math.min(m || 4, n)));
  let T = 0;
  if (n >= 2) {
    const half = Math.floor(n / 2);
    T = (mean(series.slice(half)) - mean(series.slice(0, half))) / half;
  }
  const S: number[] = useS
    ? series.slice(0, m).map(v => L !== 0 ? v / L : 1)
    : [1];

  let sse = 0;
  for (let t = 0; t < n; t++) {
    const sIdx = useS ? t % m : 0;
    const pred = (L + T) * (useS ? S[sIdx] : 1);
    fitted.push(Math.max(0, pred));
    sse += (series[t] - pred) ** 2;
    const prevL = L;
    L = α * (series[t] / (useS ? S[sIdx] || 1 : 1)) + (1 - α) * (L + T);
    T = β * (L - prevL) + (1 - β) * T;
    if (useS) S[sIdx] = γ * (series[t] / (L || 1)) + (1 - γ) * S[sIdx];
  }
  return { fitted, level: L, trend: T, seasonal: S, sse };
}

// ── Model 2: Simple Exponential Smoothing (fallback for short series) ─────────

function simpleExponentialSmoothing(series: number[], horizon: number): ForecastOutput {
  if (series.length === 0) return zeroForecast();

  // Optimise α
  let bestAlpha = 0.3, bestSSE = Infinity;
  for (let a = 0.05; a <= 0.95; a += 0.05) {
    let S = series[0], sse = 0;
    for (let i = 1; i < series.length; i++) {
      const pred = S;
      sse += (series[i] - pred) ** 2;
      S = a * series[i] + (1 - a) * S;
    }
    if (sse < bestSSE) { bestSSE = sse; bestAlpha = a; }
  }

  const fitted: number[] = [series[0]];
  let S = series[0];
  for (let i = 1; i < series.length; i++) {
    S = bestAlpha * series[i] + (1 - bestAlpha) * S;
    fitted.push(Math.max(0, S));
  }
  const forecastVal = Math.max(0, S);
  const res = series.map((v, i) => v - (fitted[i] ?? 0));
  const σ   = std(res);

  return {
    model:       'Simple Exponential Smoothing (SES)',
    forecastQty: Math.round(forecastVal),
    confidence:  Math.max(20, 70 - mape(series, fitted)),
    mape:        mape(series, fitted),
    rmse:        Math.round(rmse(series, fitted) * 100) / 100,
    mae:         Math.round(mae(series, fitted) * 100) / 100,
    trend:       detectTrend(series),
    seasonality: false,
    periodicity: 0,
    upperBound:  Math.round(forecastVal + 1.96 * σ),
    lowerBound:  Math.max(0, Math.round(forecastVal - 1.96 * σ)),
    fitted,
    residuals:   res,
    modelParams: { alpha: bestAlpha },
    explanation: `Single exponential smoothing with α=${bestAlpha.toFixed(2)}. Optimal for short history with no clear trend.`,
  };
}

// ── Model 3: ARIMA(1,1,1)-lite ────────────────────────────────────────────────
// First-order differencing (I=1), AR(1) and MA(1) components
// Fitted via OLS on differenced series

export function arimalite(series: number[], horizon: number = 1): ForecastOutput {
  const n = series.length;
  if (n < 5) return simpleExponentialSmoothing(series, horizon);

  // Step 1: First-order differencing
  const diff: number[] = [];
  for (let i = 1; i < n; i++) diff.push(series[i] - series[i - 1]);

  // Step 2: Fit AR(1) on differenced series via OLS
  // diff[t] = phi * diff[t-1] + theta * err[t-1] + err[t]
  // Simplified: estimate phi via autocorrelation at lag 1
  const ac1   = autocorrelation(diff, 1);
  const phi   = Math.max(-0.99, Math.min(0.99, ac1));

  // Step 3: Compute residuals (AR component)
  const arResiduals: number[] = [0];
  const arFitted: number[]    = [diff[0]];
  for (let i = 1; i < diff.length; i++) {
    const pred = phi * diff[i - 1];
    arFitted.push(pred);
    arResiduals.push(diff[i] - pred);
  }

  // Step 4: Estimate MA(1) via residual autocorrelation
  const theta = Math.max(-0.99, Math.min(0.99, autocorrelation(arResiduals, 1)));

  // Step 5: Generate h-step forecasts on differenced scale
  let lastDiff = diff[diff.length - 1];
  let lastErr  = arResiduals[arResiduals.length - 1];
  const diffForecasts: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const f  = phi * lastDiff + theta * lastErr;
    diffForecasts.push(f);
    lastDiff = f;
    lastErr  = 0; // future errors assumed 0
  }

  // Step 6: Invert differencing (cumulative sum from last observed)
  let level = series[n - 1];
  for (const d of diffForecasts) level += d;
  const forecastVal = Math.max(0, level);

  // Reconstruct in-sample fitted values on original scale
  const fitted: number[] = [series[0]];
  let prev = series[0];
  for (let i = 0; i < arFitted.length; i++) {
    const v = prev + arFitted[i];
    fitted.push(Math.max(0, v));
    prev = v;
  }

  const res  = series.map((v, i) => v - (fitted[i] ?? 0));
  const σ    = std(diff);
  const z95  = 1.96;

  return {
    model:       'ARIMA(1,1,1)-lite',
    forecastQty: Math.round(forecastVal),
    confidence:  Math.max(20, Math.min(92, 85 - mape(series, fitted))),
    mape:        mape(series, fitted),
    rmse:        Math.round(rmse(series, fitted) * 100) / 100,
    mae:         Math.round(mae(series, fitted) * 100) / 100,
    trend:       detectTrend(series),
    seasonality: false,
    periodicity: 0,
    upperBound:  Math.round(forecastVal + z95 * σ * Math.sqrt(horizon)),
    lowerBound:  Math.max(0, Math.round(forecastVal - z95 * σ * Math.sqrt(horizon))),
    fitted,
    residuals:   res,
    modelParams: { phi, theta, differencingOrder: 1 },
    explanation: `ARIMA(1,1,1): φ=${phi.toFixed(3)} θ=${theta.toFixed(3)}. ` +
                 `First-order differencing removes trend; AR captures momentum, MA corrects for shocks.`,
  };
}

// ── Model 4: Seasonal Decomposition + Linear Projection ──────────────────────
// STL-lite: decomposes into Trend + Seasonal + Residual,
// extrapolates trend linearly, re-applies seasonal factor

export function seasonalDecomposition(series: number[], seasonPeriod: number, horizon: number = 1): ForecastOutput {
  const n = series.length;
  if (n < seasonPeriod * 2 || seasonPeriod < 2) return holtwinters(series, 0, horizon);

  // Step 1: Compute centred moving average (trend)
  const halfWin = Math.floor(seasonPeriod / 2);
  const trend: number[] = new Array(n).fill(0);
  for (let i = halfWin; i < n - halfWin; i++) {
    trend[i] = mean(series.slice(i - halfWin, i + halfWin + 1));
  }
  // Fill edges with nearest computed value
  for (let i = 0; i < halfWin; i++) trend[i] = trend[halfWin];
  for (let i = n - halfWin; i < n; i++) trend[i] = trend[n - halfWin - 1];

  // Step 2: Detrend
  const detrended = series.map((v, i) => trend[i] !== 0 ? v / trend[i] : 1);

  // Step 3: Average seasonal indices per period position
  const seasonalIdx: number[] = new Array(seasonPeriod).fill(0);
  const seasonalCnt: number[] = new Array(seasonPeriod).fill(0);
  detrended.forEach((v, i) => {
    seasonalIdx[i % seasonPeriod] += v;
    seasonalCnt[i % seasonPeriod]++;
  });
  const seasonalFactors = seasonalIdx.map((s, i) => seasonalCnt[i] > 0 ? s / seasonalCnt[i] : 1);

  // Step 4: Linear regression on trend component
  const trendValid = trend.filter(v => v > 0);
  const trendMean  = mean(trendValid);
  const trendSlope = (() => {
    const xs = trendValid.map((_, i) => i);
    const xm = mean(xs);
    const ssxx = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
    if (ssxx === 0) return 0;
    return xs.reduce((s, x, i) => s + (x - xm) * (trendValid[i] - trendMean), 0) / ssxx;
  })();

  // Step 5: Forecast = projected trend × seasonal factor
  const lastTrendIdx = trendValid.length - 1;
  let forecastVal = 0;
  for (let h = 1; h <= horizon; h++) {
    const projTrend = trendMean + trendSlope * (lastTrendIdx + h);
    const sF        = seasonalFactors[(n + h - 1) % seasonPeriod];
    forecastVal     = projTrend * sF;
  }
  forecastVal = Math.max(0, forecastVal);

  // Reconstruct fitted
  const fitted = series.map((_, i) => {
    const sF = seasonalFactors[i % seasonPeriod];
    return Math.max(0, trend[i] * sF);
  });

  const res = series.map((v, i) => v - fitted[i]);
  const σ   = std(res);

  return {
    model:       `STL Decomposition (period=${seasonPeriod})`,
    forecastQty: Math.round(forecastVal),
    confidence:  Math.max(20, Math.min(93, 90 - mape(series, fitted))),
    mape:        mape(series, fitted),
    rmse:        Math.round(rmse(series, fitted) * 100) / 100,
    mae:         Math.round(mae(series, fitted) * 100) / 100,
    trend:       detectTrend(series),
    seasonality: true,
    periodicity: seasonPeriod,
    upperBound:  Math.round(forecastVal + 1.96 * σ),
    lowerBound:  Math.max(0, Math.round(forecastVal - 1.96 * σ)),
    fitted,
    residuals:   res,
    modelParams: { seasonPeriod, trendSlope: Math.round(trendSlope * 1000) / 1000, trendMean: Math.round(trendMean * 100) / 100 },
    explanation: `Seasonal decomposition (period=${seasonPeriod}): separates trend, seasonality, and residual. ` +
                 `Linear trend projected ${horizon} step(s) ahead and seasonal factor reapplied.`,
  };
}

// ── Model 5: Prophet-style (Piecewise Linear Trend + Fourier Seasonality) ────
// Inspired by Facebook Prophet — uses Fourier terms for seasonality

export function prophetLite(series: number[], horizon: number = 1): ForecastOutput {
  const n = series.length;
  if (n < 6) return simpleExponentialSmoothing(series, horizon);

  const seasonPeriod = detectSeasonality(series) || 4;
  const K = 2; // Fourier order

  // Build design matrix: [1, t, sin(2πkt/P), cos(2πkt/P) for k=1..K]
  const X: number[][] = series.map((_, t) => {
    const row: number[] = [1, t / n];
    for (let k = 1; k <= K; k++) {
      row.push(Math.sin(2 * Math.PI * k * t / seasonPeriod));
      row.push(Math.cos(2 * Math.PI * k * t / seasonPeriod));
    }
    return row;
  });

  const y = series;
  const p = X[0].length;

  // OLS: β = (X'X)^-1 X'y  — computed via normal equations
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[]   = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const beta = gaussianElimination(XtX, Xty);

  // In-sample fitted
  const fitted = X.map(row => Math.max(0, row.reduce((s, v, i) => s + v * beta[i], 0)));

  // Forecast h steps
  let forecastVal = 0;
  for (let h = 1; h <= horizon; h++) {
    const t   = n + h - 1;
    const row = [1, t / n];
    for (let k = 1; k <= K; k++) {
      row.push(Math.sin(2 * Math.PI * k * t / seasonPeriod));
      row.push(Math.cos(2 * Math.PI * k * t / seasonPeriod));
    }
    forecastVal = row.reduce((s, v, i) => s + v * beta[i], 0);
  }
  forecastVal = Math.max(0, forecastVal);

  const res = y.map((v, i) => v - fitted[i]);
  const σ   = std(res);

  return {
    model:       `Prophet-lite (Fourier K=${K}, period=${seasonPeriod})`,
    forecastQty: Math.round(forecastVal),
    confidence:  Math.max(20, Math.min(94, 88 - mape(y, fitted))),
    mape:        mape(y, fitted),
    rmse:        Math.round(rmse(y, fitted) * 100) / 100,
    mae:         Math.round(mae(y, fitted) * 100) / 100,
    trend:       detectTrend(series),
    seasonality: true,
    periodicity: seasonPeriod,
    upperBound:  Math.round(forecastVal + 1.96 * σ * Math.sqrt(horizon)),
    lowerBound:  Math.max(0, Math.round(forecastVal - 1.96 * σ * Math.sqrt(horizon))),
    fitted,
    residuals:   res,
    modelParams: { fourierOrder: K, seasonPeriod, trendCoef: Math.round((beta[1] ?? 0) * 1000) / 1000 },
    explanation: `Prophet-lite: piecewise linear trend with ${K * 2}-term Fourier seasonality (period=${seasonPeriod}). ` +
                 `Fitted via OLS on ${p} basis functions.`,
  };
}

/** Gaussian elimination for OLS */
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n   = b.length;
  const aug  = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let k = col; k <= n; k++) aug[row][k] -= factor * aug[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i] || 1;
  }
  return x;
}

// ── Model 6: Ensemble (auto-select + weighted average) ───────────────────────
// Runs all applicable models, weights by inverse MAPE, returns best + ensemble

export function ensemble(series: number[], horizon: number = 1): {
  best: ForecastOutput;
  ensemble: ForecastOutput;
  allModels: ForecastOutput[];
} {
  if (series.length < 3) {
    const out = simpleExponentialSmoothing(series, horizon);
    return { best: out, ensemble: out, allModels: [out] };
  }

  const seasonPeriod = detectSeasonality(series);
  const models: ForecastOutput[] = [];

  // Always run SES and HW
  models.push(holtwinters(series, seasonPeriod, horizon));
  models.push(arimalite(series, horizon));
  if (series.length >= 6) models.push(prophetLite(series, horizon));
  if (seasonPeriod >= 2 && series.length >= seasonPeriod * 2) {
    models.push(seasonalDecomposition(series, seasonPeriod, horizon));
  }

  // Rank by MAPE (lower = better)
  models.sort((a, b) => a.mape - b.mape);
  const best = models[0];

  // Weighted ensemble: weight = 1 / (MAPE + 1) to avoid division by zero
  const weights  = models.map(m => 1 / (m.mape + 1));
  const wTotal   = weights.reduce((s, w) => s + w, 0);
  const ensembleQty = Math.round(
    models.reduce((s, m, i) => s + m.forecastQty * weights[i], 0) / wTotal
  );
  const ensembleConf = Math.round(
    models.reduce((s, m, i) => s + m.confidence * weights[i], 0) / wTotal
  );
  const ensembleUpper = Math.round(
    models.reduce((s, m, i) => s + m.upperBound * weights[i], 0) / wTotal
  );
  const ensembleLower = Math.round(
    models.reduce((s, m, i) => s + m.lowerBound * weights[i], 0) / wTotal
  );

  const ensembleOut: ForecastOutput = {
    ...best,
    model:       `Ensemble (${models.length} models — best: ${best.model})`,
    forecastQty: ensembleQty,
    confidence:  ensembleConf,
    upperBound:  ensembleUpper,
    lowerBound:  ensembleLower,
    modelParams: { modelsUsed: models.length, bestMAPE: best.mape, seasonPeriod },
    explanation: `Weighted ensemble of ${models.length} models. Best individual model: ${best.model} (MAPE=${best.mape}%). ` +
                 `Weights inversely proportional to MAPE. ${seasonPeriod > 0 ? `Detected seasonality period: ${seasonPeriod}.` : 'No seasonality detected.'}`,
  };

  return { best, ensemble: ensembleOut, allModels: models };
}

function zeroForecast(): ForecastOutput {
  return {
    model: 'Insufficient Data', forecastQty: 0, confidence: 0, mape: 0,
    rmse: 0, mae: 0, trend: 'STABLE', seasonality: false, periodicity: 0,
    upperBound: 0, lowerBound: 0, fitted: [], residuals: [], modelParams: {},
    explanation: 'Not enough historical data to generate a forecast (minimum 3 data points required).',
  };
}

// ── Export helper: build time-series from stock movements ────────────────────

export function buildTimeSeries(
  movements: { quantity: number; type: string; createdAt: Date | string }[],
  periods: number = 12,
  periodDays: number = 30
): { values: number[]; labels: string[] } {
  const now         = Date.now();
  const msPerPeriod = periodDays * 24 * 60 * 60 * 1000;
  const buckets     = new Array(periods).fill(0);
  const labels: string[] = [];

  for (const m of movements) {
    if (m.type !== 'OUT') continue; // only outbound = demand
    const age    = now - new Date(m.createdAt).getTime();
    const bucket = Math.floor(age / msPerPeriod);
    if (bucket >= 0 && bucket < periods) buckets[periods - 1 - bucket] += Math.abs(m.quantity);
  }

  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(now - i * msPerPeriod);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }

  return { values: buckets, labels };
}
