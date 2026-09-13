/**
 * Isolation Forest — unsupervised multivariate anomaly detector.
 * ------------------------------------------------------------------
 * (Liu, Ting & Zhou, 2008). An ensemble of random binary trees isolates points
 * with axis-aligned splits chosen uniformly at random. Anomalies are isolated
 * with fewer splits, so they have a shorter expected path length and an anomaly
 * score closer to 1. It runs on the standardised (z-scored) vital vector so it
 * catches *multivariate* patterns — several vitals drifting together — that the
 * per-metric detectors, looking at one channel at a time, can miss.
 *
 * The implementation is fully streaming-friendly: it subsamples a small window,
 * builds shallow trees and re-fits cheaply, so it comfortably runs at sensor
 * rate for the whole fleet inside the browser.
 */

export type Vector = number[];

interface INode {
  external: boolean;
  size: number;
  splitAttr: number;
  splitValue: number;
  left: INode | null;
  right: INode | null;
}

/** Average unsuccessful-search path length in a BST — the path-length normaliser. */
function cFactor(n: number): number {
  if (n <= 1) return 0;
  const euler = 0.5772156649;
  return 2 * (Math.log(n - 1) + euler) - (2 * (n - 1)) / n;
}

function buildTree(data: Vector[], depth: number, maxDepth: number): INode {
  const n = data.length;
  if (depth >= maxDepth || n <= 1) {
    return { external: true, size: n, splitAttr: -1, splitValue: 0, left: null, right: null };
  }

  const dims = data[0].length;
  const attr = Math.floor(Math.random() * dims);

  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    const x = v[attr];
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (min === max) {
    return { external: true, size: n, splitAttr: -1, splitValue: 0, left: null, right: null };
  }

  const splitValue = min + Math.random() * (max - min);
  const left: Vector[] = [];
  const right: Vector[] = [];
  for (const v of data) {
    if (v[attr] < splitValue) left.push(v);
    else right.push(v);
  }

  return {
    external: false,
    size: n,
    splitAttr: attr,
    splitValue,
    left: buildTree(left, depth + 1, maxDepth),
    right: buildTree(right, depth + 1, maxDepth),
  };
}

function pathLength(v: Vector, node: INode, depth: number): number {
  if (node.external) return depth + cFactor(node.size);
  if (v[node.splitAttr] < node.splitValue) return pathLength(v, node.left!, depth + 1);
  return pathLength(v, node.right!, depth + 1);
}

export class IsolationForest {
  private trees: INode[] = [];
  private norm = 1;

  constructor(
    private readonly nTrees = 80,
    private readonly sampleSize = 48,
  ) {}

  get fitted(): boolean {
    return this.trees.length > 0;
  }

  fit(data: Vector[]): this {
    this.trees = [];
    const n = data.length;
    if (n === 0) return this;
    const sampleSize = Math.min(this.sampleSize, n);
    this.norm = cFactor(sampleSize) || 1;
    const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));

    for (let t = 0; t < this.nTrees; t++) {
      const sample: Vector[] = new Array(sampleSize);
      for (let i = 0; i < sampleSize; i++) {
        sample[i] = data[Math.floor(Math.random() * n)];
      }
      this.trees.push(buildTree(sample, 0, maxDepth));
    }
    return this;
  }

  /** Anomaly score in (0, 1): near 1 = strong anomaly, well below 0.5 = normal. */
  score(v: Vector): number {
    if (this.trees.length === 0) return 0;
    let sum = 0;
    for (const tree of this.trees) sum += pathLength(v, tree, 0);
    const avg = sum / this.trees.length;
    return Math.pow(2, -avg / this.norm);
  }
}
