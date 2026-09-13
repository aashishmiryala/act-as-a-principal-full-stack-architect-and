/**
 * Streaming statistics primitives for the anomaly-detection pipeline.
 * All estimators are O(1) per update so they run comfortably at sensor rate
 * inside the browser.
 */

/** Welford's online algorithm for running mean + variance. */
export class RunningStats {
  private n = 0;
  private mean_ = 0;
  private m2 = 0;

  push(x: number): void {
    this.n++;
    const delta = x - this.mean_;
    this.mean_ += delta / this.n;
    this.m2 += delta * (x - this.mean_);
  }

  get count(): number {
    return this.n;
  }
  get mean(): number {
    return this.mean_;
  }
  get variance(): number {
    return this.n > 1 ? this.m2 / (this.n - 1) : 0;
  }
  get std(): number {
    return Math.sqrt(this.variance);
  }

  zScore(x: number): number {
    const s = this.std;
    if (s < 1e-9) return 0;
    return (x - this.mean_) / s;
  }
}

/** Exponentially weighted moving average + variance (EWMA / EWMV). */
export class Ewma {
  private mean_: number | null = null;
  private var_ = 0;
  constructor(private readonly alpha: number = 0.15) {}

  update(x: number): void {
    if (this.mean_ === null) {
      this.mean_ = x;
      this.var_ = 0;
      return;
    }
    const diff = x - this.mean_;
    const incr = this.alpha * diff;
    this.mean_ += incr;
    this.var_ = (1 - this.alpha) * (this.var_ + diff * incr);
  }

  get mean(): number {
    return this.mean_ ?? 0;
  }
  get std(): number {
    return Math.sqrt(this.var_);
  }
  get ready(): boolean {
    return this.mean_ !== null;
  }

  zScore(x: number): number {
    const s = this.std;
    if (s < 1e-9) return 0;
    return (x - this.mean) / s;
  }
}

/** Fixed-size ring buffer for windowed operations (e.g. motion variance). */
export class RingBuffer {
  private buf: number[] = [];
  constructor(private readonly capacity: number) {}

  push(x: number): void {
    this.buf.push(x);
    if (this.buf.length > this.capacity) this.buf.shift();
  }
  get values(): number[] {
    return this.buf;
  }
  get length(): number {
    return this.buf.length;
  }
  get full(): boolean {
    return this.buf.length >= this.capacity;
  }
  mean(): number {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  std(): number {
    if (this.buf.length < 2) return 0;
    const m = this.mean();
    const v = this.buf.reduce((a, b) => a + (b - m) ** 2, 0) / (this.buf.length - 1);
    return Math.sqrt(v);
  }
  min(): number {
    return Math.min(...this.buf);
  }
  max(): number {
    return Math.max(...this.buf);
  }
}

/** Logistic squashing to map an unbounded z-score into a 0..1 anomaly score. */
export function logistic(z: number, k = 1.1, midpoint = 3): number {
  return 1 / (1 + Math.exp(-k * (Math.abs(z) - midpoint)));
}

/** Median absolute deviation for robust outlier scoring on a small window. */
export function medianAbsoluteDeviation(values: number[]): { median: number; mad: number } {
  if (!values.length) return { median: 0, mad: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const devs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = devs[Math.floor(devs.length / 2)] * 1.4826; // scale to ~std for normal dist
  return { median, mad };
}
