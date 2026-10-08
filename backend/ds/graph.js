// Graph of donation centres / blood banks / hospitals.
// Stored BOTH as adjacency matrix and adjacency list so they can be compared.
const MinHeap = require('./heap');

class Graph {
  constructor(nodes) {
    this.nodes = nodes; // [{id,name,type,x,y}]
    this.n = nodes.length;
    this.idx = Object.fromEntries(nodes.map((nd, i) => [nd.id, i]));
    this.matrix = Array.from({ length: this.n }, () => Array(this.n).fill(0));
    this.list = Array.from({ length: this.n }, () => []);
    this.edges = [];
  }
  addEdge(a, b, km) {
    const u = this.idx[a], v = this.idx[b];
    this.matrix[u][v] = this.matrix[v][u] = km;
    this.list[u].push({ to: v, w: km });
    this.list[v].push({ to: u, w: km });
    this.edges.push({ from: a, to: b, km });
  }
  // Dijkstra using the adjacency list + min-heap
  dijkstra(srcId) {
    const s = this.idx[srcId];
    const dist = Array(this.n).fill(Infinity), prev = Array(this.n).fill(-1);
    dist[s] = 0;
    const pq = new MinHeap(x => x[0]);
    pq.push([0, s]);
    while (pq.size) {
      const [d, u] = pq.pop();
      if (d > dist[u]) continue;
      for (const { to, w } of this.list[u]) {
        if (d + w < dist[to]) { dist[to] = d + w; prev[to] = u; pq.push([dist[to], to]); }
      }
    }
    return { dist, prev };
  }
  // shortest path fromId -> toId (runs Dijkstra from the destination, walks prev back to it)
  route(fromId, toId) {
    const { dist, prev } = this.dijkstra(toId);
    let u = this.idx[fromId];
    if (dist[u] === Infinity) return null;
    const km = dist[u], path = [];
    while (u !== -1) { path.push(this.nodes[u].id); u = prev[u]; }
    return { path, km };
  }
  stats() {
    const V = this.n, E = this.edges.length;
    return {
      vertices: V, edges: E,
      matrixCells: V * V, listEntries: 2 * E,
      density: +(E / ((V * (V - 1)) / 2)).toFixed(2),
      note: 'Matrix: O(V^2) space, O(1) edge lookup. List: O(V+E) space, O(deg) lookup, faster neighbour scans (better for Dijkstra on sparse networks).'
    };
  }
}
module.exports = Graph;
