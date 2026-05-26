'use strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RATE_LIMIT_RE = /(429|too many requests|rate.?limit|temporarily unavailable|503|502|504)/i;

const isRateLimitError = (err) => {
  if (!err) return false;
  if (typeof err === 'number') return err === 429 || err === 503 || err === 502 || err === 504;
  const msg = typeof err === 'string' ? err : (err.message || String(err));
  if (RATE_LIMIT_RE.test(msg)) return true;
  const status = err?.response?.status || err?.status;
  if (status && (status === 429 || status === 503 || status === 502 || status === 504)) return true;
  return false;
};

const FAST_RAMP_UNTIL = 12; // Below this target, ramp up aggressively.

// Adaptive concurrency controller using AIMD.
// - Successes below FAST_RAMP_UNTIL: bump target after only a few successes (fast).
// - Successes at/above FAST_RAMP_UNTIL: bump target after `target` successes (slow).
// - Rate-limited / hard failures: cut target in half (multiplicative decrease).
// - Bounded by [min, max]. When `adaptive` is false, behaves as fixed semaphore.
class AdaptiveConcurrency {
  constructor({ initial, min = 1, max = 20, adaptive = false } = {}) {
    this.min = Math.max(1, min);
    this.max = Math.max(this.min, max);
    this.adaptive = Boolean(adaptive);
    // Adaptive mode starts mid-pack (8) so first successes feel fast; fixed mode
    // honours the caller's initial value (or falls back to min when unset).
    const fallback = adaptive ? 8 : this.min;
    const start = initial != null ? initial : fallback;
    this.target = Math.max(this.min, Math.min(this.max, start));
    this.active = 0;
    this.consecutiveOk = 0;
    this.lastDecreaseAt = 0;
    this.onChange = null;
  }

  setOnChange(fn) { this.onChange = fn; }
  current() { return this.target; }
  activeCount() { return this.active; }

  async acquire() {
    while (this.active >= this.target) await sleep(40);
    this.active += 1;
  }

  // result: { ok: boolean, rateLimited?: boolean, error?: any }
  release(result = {}) {
    this.active = Math.max(0, this.active - 1);
    if (!this.adaptive) return;

    const rateLimited = Boolean(result.rateLimited) || isRateLimitError(result.error);
    const ok = Boolean(result.ok) && !rateLimited;

    if (rateLimited) {
      const prev = this.target;
      this.target = Math.max(this.min, Math.floor(this.target / 2));
      this.consecutiveOk = 0;
      this.lastDecreaseAt = Date.now();
      if (prev !== this.target && this.onChange) this.onChange({ target: this.target, reason: 'rate_limit' });
      return;
    }

    if (ok) {
      this.consecutiveOk += 1;
      // Cooldown after a recent decrease, so we don't oscillate.
      const cooled = Date.now() - this.lastDecreaseAt > 4000;
      // Fast ramp until 12, then slow (one bump per `target` successes).
      const threshold = this.target < FAST_RAMP_UNTIL ? 3 : Math.max(3, this.target);
      if (cooled && this.consecutiveOk >= threshold && this.target < this.max) {
        const prev = this.target;
        this.target = Math.min(this.max, this.target + 1);
        this.consecutiveOk = 0;
        if (prev !== this.target && this.onChange) this.onChange({ target: this.target, reason: 'success' });
      }
    }
  }
}

module.exports = { AdaptiveConcurrency, isRateLimitError };
