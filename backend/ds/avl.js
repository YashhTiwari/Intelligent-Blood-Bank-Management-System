// AVL Tree: balanced BST used to index donors / blood units. O(log n) search, insert, delete.
class Node {
  constructor(key, val) { this.key = key; this.val = val; this.h = 1; this.l = null; this.r = null; }
}
const h = n => (n ? n.h : 0);
const upd = n => { n.h = 1 + Math.max(h(n.l), h(n.r)); };
const bal = n => (n ? h(n.l) - h(n.r) : 0);

function rotR(y) { const x = y.l; y.l = x.r; x.r = y; upd(y); upd(x); return x; }
function rotL(x) { const y = x.r; x.r = y.l; y.l = x; upd(x); upd(y); return y; }
function rebalance(n) {
  upd(n);
  const b = bal(n);
  if (b > 1) { if (bal(n.l) < 0) n.l = rotL(n.l); return rotR(n); }   // LL / LR
  if (b < -1) { if (bal(n.r) > 0) n.r = rotR(n.r); return rotL(n); }  // RR / RL
  return n;
}

class AVLTree {
  constructor() { this.root = null; this.size = 0; }
  get height() { return h(this.root); }

  insert(key, val) {
    const ins = (n) => {
      if (!n) { this.size++; return new Node(key, val); }
      if (key < n.key) n.l = ins(n.l);
      else if (key > n.key) n.r = ins(n.r);
      else n.val = val; // same key -> overwrite
      return rebalance(n);
    };
    this.root = ins(this.root);
  }

  // returns { value, steps } so the UI can show how many nodes were visited
  search(key) {
    let n = this.root, steps = 0;
    while (n) {
      steps++;
      if (key === n.key) return { value: n.val, steps };
      n = key < n.key ? n.l : n.r;
    }
    return { value: null, steps };
  }

  delete(key) {
    let removed = false;
    const del = (n, k) => {
      if (!n) return null;
      if (k < n.key) n.l = del(n.l, k);
      else if (k > n.key) n.r = del(n.r, k);
      else {
        removed = true;
        if (!n.l || !n.r) return n.l || n.r;
        let s = n.r; while (s.l) s = s.l;          // in-order successor
        n.key = s.key; n.val = s.val;
        n.r = del(n.r, s.key);
      }
      return rebalance(n);
    };
    this.root = del(this.root, key);
    if (removed) this.size--;
    return removed;
  }

  inorder() { // sorted by key
    const out = [];
    const go = n => { if (n) { go(n.l); out.push(n.val); go(n.r); } };
    go(this.root);
    return out;
  }
}
module.exports = AVLTree;
