/**
 * Store-check capacity: does a schedule (runs/day × SKUs/run) give watched
 * bottles their re-check target and still cycle every in-stock bottle well
 * before the 7-day "unknown" cutoff? Pure arithmetic, shared by the sizing
 * decision (store-inventory.yml) and report.ts mode "freshness".
 */
export interface CapacityInput {
  inStock: number;
  watched: number;
  runsPerDay: number;
  budget: number;
  /** Seconds per SKU attempt (2 DABS requests at 1.1 s pacing + response time). */
  secondsPerSku: number;
  /** Share of attempts that fail (retried later with backoff). */
  failureRate: number;
  /** A watched bottle is re-checked once its last success is this old. */
  watchRecheckHours: number;
  /** Most of each run the watched slice may take. */
  watchShare: number;
  /** Scrape time budget per run, minutes. */
  timeBudgetMinutes: number;
  /** Extra spacing between runs from GitHub's start delays (observed max 5.8h). */
  delayJitterHours: number;
}

export interface CapacityResult {
  minutesPerRun: number;
  attemptsPerRun: number;
  watchedChecksPerDay: number;
  rotationChecksPerDay: number;
  /** Days to re-check every in-stock bottle once. */
  rotationDays: number;
  /** Worst-case age of a watched bottle's store check at the moment it is re-checked. */
  watchedWorstHours: number;
}

export function storeCapacity(c: CapacityInput): CapacityResult {
  const attemptsPerRun = Math.min(c.budget, Math.floor((c.timeBudgetMinutes * 60) / c.secondsPerSku));
  const interval = 24 / c.runsPerDay;
  // Upper bound: every watched bottle is due at every run once its check is ≥ recheck hours old.
  const watchedPerRun = Math.min(c.watched * Math.min(1, interval / c.watchRecheckHours), Math.floor(attemptsPerRun * c.watchShare));
  const successPerRun = attemptsPerRun * (1 - c.failureRate);
  const rotationPerRun = Math.max(0, successPerRun - watchedPerRun);
  const rotationChecksPerDay = rotationPerRun * c.runsPerDay;
  return {
    minutesPerRun: +((attemptsPerRun * c.secondsPerSku) / 60).toFixed(1),
    attemptsPerRun,
    watchedChecksPerDay: Math.round(watchedPerRun * c.runsPerDay),
    rotationChecksPerDay: Math.round(rotationChecksPerDay),
    rotationDays: rotationChecksPerDay > 0 ? +(c.inStock / rotationChecksPerDay).toFixed(1) : Infinity,
    // Due at every run when the threshold is under the run spacing; otherwise
    // it can wait one extra interval.
    watchedWorstHours: Math.ceil(
      (c.watchRecheckHours < interval ? interval : c.watchRecheckHours + interval) + c.delayJitterHours
    ),
  };
}

/**
 * SKUs for one run, from the time since the last successful run started.
 * GitHub fires only some scheduled triggers (hourly/2-hourly crons: ~⅓–½
 * fired, Sep 24–26), so throughput is tied to elapsed time rather than to
 * how many runs happen: ~STORE_SKUS_PER_HOUR × hours, capped so one run
 * stays well inside the job timeout at the 1.1 s DABS pacing (~2.3 s/SKU).
 */
export const STORE_SKUS_PER_HOUR = 100;
export const STORE_RUN_MIN = 100;
export const STORE_RUN_MAX = 1500;

export function runBudget(hoursSinceLastSuccess: number | null): number {
  if (hoursSinceLastSuccess == null || !Number.isFinite(hoursSinceLastSuccess)) return STORE_RUN_MAX;
  const wanted = Math.round(STORE_SKUS_PER_HOUR * Math.max(0, hoursSinceLastSuccess));
  return Math.min(STORE_RUN_MAX, Math.max(STORE_RUN_MIN, wanted));
}
