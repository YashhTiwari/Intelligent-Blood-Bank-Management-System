// Binary Min-Heap: powers the FEFO (First-Expire-First-Out) priority queue.
class MinHeap {
  constructor(keyFn = x => x) { this.a = []; this.key = keyFn; }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }
  push(x) { this.a.push(x); this._up(this.a.length - 1); }
  pop() {
    if (!this.a.length) return undefined;
    const top = this.a[0], last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this._down(0); }
    return top;
  }
  _swap(i, j) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.key(this.a[i]) < this.key(this.a[p])) { this._swap(i, p); i = p; } else break;
    }
  }
  _down(i) {
    const n = this.a.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < n && this.key(this.a[l]) < this.key(this.a[m])) m = l;
      if (r < n && this.key(this.a[r]) < this.key(this.a[m])) m = r;
      if (m === i) break;
      this._swap(i, m); i = m;
    }
  }
  // Heap sort: ascending order, input untouched
  static heapSort(items, keyFn) {
    const hp = new MinHeap(keyFn);
    items.forEach(x => hp.push(x));
    const out = [];
    while (hp.size) out.push(hp.pop());
    return out;
  }
}
module.exports = MinHeap;
