/**
 * Adaptive Polling Utility
 * Implements a non-linear (Decreasing -> Increasing -> Decreasing) polling curve:
 * 1. Initial Start: Higher initial delay (e.g. 10s) while server/worker queues & initializes the job.
 * 2. Active Phase: Decreases (e.g. 10s -> 6s -> 4s -> 3s) for rapid real-time progress visualization.
 * 3. Mid-Run Backoff: Increases (e.g. 3s -> 6s -> 12s -> 20s -> 30s) if the task is long-running to minimize backend load.
 * 4. Final Completion Phase: Decreases (e.g. down to 3s-4s when progress >= 80% or approaching final steps)
 *    so the UI detects completion immediately.
 * 5. Idle / No-Op Phase: Relaxed interval (30s-45s) when no active background tasks are running.
 */

export interface AdaptivePollOptions {
  initialDelayMs?: number;      // Initial warm-up delay (default: 8000ms)
  minDelayMs?: number;          // Fastest active delay (default: 3000ms)
  maxDelayMs?: number;          // Maximum backoff delay (default: 30000ms)
  idleDelayMs?: number;         // Idle delay when no active tasks (default: 35000ms)
  activeDecayStepMs?: number;   // How much to decrease during active ramp-up (default: 2000ms)
  backoffMultiplier?: number;   // Multiplier during mid-run backoff (default: 1.4)
}

export interface AdaptivePollerController {
  start: () => void;
  stop: () => void;
  resetCurve: () => void;
  triggerImmediate: () => Promise<void>;
  getCurrentInterval: () => number;
}

export function createAdaptivePoller(
  taskFn: () => Promise<{ hasActiveTask: boolean; progressPercent?: number; isCompleted?: boolean }>,
  options: AdaptivePollOptions = {}
): AdaptivePollerController {
  const {
    initialDelayMs = 8000,
    minDelayMs = 3000,
    maxDelayMs = 30000,
    idleDelayMs = 35000,
    activeDecayStepMs = 2000,
    backoffMultiplier = 1.4,
  } = options;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let isPollActive = false;
  let pollIteration = 0;
  let currentDelay = initialDelayMs;

  const calculateNextInterval = (hasActiveTask: boolean, progressPercent: number = 0, isCompleted: boolean = false): number => {
    if (!hasActiveTask || isCompleted) {
      pollIteration = 0;
      currentDelay = idleDelayMs;
      return idleDelayMs;
    }

    pollIteration += 1;

    // Phase 4: Near Completion (progress >= 80%) -> Decrease interval for fast completion detection
    if (progressPercent >= 80) {
      currentDelay = Math.max(minDelayMs, Math.min(currentDelay, 3500));
      return currentDelay;
    }

    // Phase 2: Active Initial Ramp-Up (iterations 1..4) -> Decreasing interval
    if (pollIteration <= 4) {
      currentDelay = Math.max(minDelayMs, currentDelay - activeDecayStepMs);
      return currentDelay;
    }

    // Phase 3: Mid-Run Backoff (iterations > 4) -> Increasing interval to reduce server load
    currentDelay = Math.min(maxDelayMs, Math.round(currentDelay * backoffMultiplier));
    return currentDelay;
  };

  const executePoll = async () => {
    if (!isRunning || isPollActive) return;
    isPollActive = true;

    try {
      const result = await taskFn();
      const nextDelay = calculateNextInterval(
        result?.hasActiveTask ?? false,
        result?.progressPercent ?? 0,
        result?.isCompleted ?? false
      );

      if (isRunning) {
        timerId = setTimeout(executePoll, nextDelay);
      }
    } catch (err) {
      console.warn('[AdaptivePoller] Error during poll execution:', err);
      // On error, apply backoff
      currentDelay = Math.min(maxDelayMs, Math.round(currentDelay * 1.5));
      if (isRunning) {
        timerId = setTimeout(executePoll, currentDelay);
      }
    } finally {
      isPollActive = false;
    }
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;
    pollIteration = 0;
    currentDelay = initialDelayMs;
    timerId = setTimeout(executePoll, currentDelay);
  };

  const stop = () => {
    isRunning = false;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const resetCurve = () => {
    pollIteration = 0;
    currentDelay = initialDelayMs;
    if (isRunning && timerId) {
      clearTimeout(timerId);
      timerId = setTimeout(executePoll, currentDelay);
    }
  };

  const triggerImmediate = async () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    await executePoll();
  };

  return {
    start,
    stop,
    resetCurve,
    triggerImmediate,
    getCurrentInterval: () => currentDelay,
  };
}
