const express = require('express');
const path = require('path');
const AVLTree = require('./ds/avl');
const MinHeap = require('./ds/heap');
const Graph = require('./ds/graph');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- constants ----------
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SHELF_LIFE = { WHOLE_BLOOD: 35, RBC: 42, PLATELETS: 5, PLASMA: 365 }; // days
const DONOR_GAP_DAYS = 90;
const NEAR_EXPIRY_DAYS = 7;
const SPEED_KMPH = 40;
const DAY = 86400000;
const today = () => new Date(new Date().toISOString().slice(0, 10)).getTime();
const iso = t => new Date(t).toISOString().slice(0, 10);
const daysLeft = u => Math.round((new Date(u.expiry).getTime() - today()) / DAY);

// ---------- network (graph) ----------
const graph = new Graph([
  { id: 'BB1', name: 'Central Blood Bank', type: 'bank', x: 300, y: 200 },
  { id: 'BB2', name: 'North Blood Bank', type: 'bank', x: 440, y: 70 },
  { id: 'BB3', name: 'East Blood Bank', type: 'bank', x: 170, y: 90 },
  { id: 'DC1', name: 'Sector-62 Donation Camp', type: 'centre', x: 90, y: 230 },
  { id: 'H1', name: 'City Hospital', type: 'hospital', x: 330, y: 330 },
  { id: 'H2', name: 'Metro Hospital', type: 'hospital', x: 560, y: 190 },
  { id: 'H3', name: 'Greater Noida Medical', type: 'hospital', x: 90, y: 20 },
]);
[['BB1', 'BB2', 12], ['BB1', 'BB3', 9], ['BB2', 'BB3', 15], ['DC1', 'BB1', 6], ['DC1', 'BB3', 10],
 ['H1', 'BB1', 4], ['H1', 'BB3', 18], ['H2', 'BB2', 5], ['H2', 'BB1', 11], ['H3', 'BB3', 7], ['H3', 'H1', 25]]
  .forEach(e => graph.addEdge(...e));
const banks = graph.nodes.filter(n => n.type === 'bank');
const isBank = id => banks.some(b => b.id === id);

// ---------- core stores ----------
const donors = new AVLTree();   // key: donor id
const units = new AVLTree();    // key: unit id
const fefo = new Map();         // "bankId|type|component" -> MinHeap ordered by expiry
const log = [];                 // activity log
let donorSeq = 0, unitSeq = 0;
const addLog = msg => { log.unshift({ time: new Date().toISOString(), msg }); if (log.length > 50) log.pop(); };

const heapKey = (bank, type, comp) => `${bank}|${type}|${comp}`;
function addUnit({ donorId, type, component, bankId, collected }) {
  const id = 'U-' + String(++unitSeq).padStart(4, '0');
  const expiry = iso(new Date(collected).getTime() + SHELF_LIFE[component] * DAY);
  const unit = { id, donorId, type, component, bankId, collected: iso(new Date(collected).getTime()), expiry, status: 'AVAILABLE' };
  units.insert(id, unit);
  const k = heapKey(bankId, type, component);
  if (!fefo.has(k)) fefo.set(k, new MinHeap(u => u.expiry));
  fefo.get(k).push(unit);
  return unit;
}
function addDonor({ name, age, type, phone, city, lastDonation }) {
  const id = 'D-' + String(++donorSeq).padStart(3, '0');
  const d = { id, name, age, type, phone: phone || '', city: city || '', lastDonation: lastDonation || null, donations: 0 };
  donors.insert(id, d);
  return d;
}
function sweepExpired() {
  units.inorder().forEach(u => {
    if (u.status === 'AVAILABLE' && daysLeft(u) < 0) u.status = 'EXPIRED';
  });
}

// ---------- seed data (deterministic) ----------
(function seed() {
  let s = 42; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const names = ['Aarav Sharma', 'Priya Singh', 'Rohan Verma', 'Neha Gupta', 'Karan Mehta', 'Sneha Joshi', 'Amit Yadav',
    'Pooja Mishra', 'Vikas Tiwari', 'Ritu Agarwal', 'Sahil Khan', 'Anjali Rao', 'Deepak Pandey', 'Meera Nair', 'Arjun Das'];
  const cities = ['Greater Noida', 'Noida', 'Ghaziabad', 'Delhi'];
  names.forEach((n, i) => addDonor({
    name: n, age: 20 + Math.floor(rnd() * 35), type: BLOOD_TYPES[i % 8], city: pick(cities),
    phone: '98' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'),
    lastDonation: iso(today() - (30 + Math.floor(rnd() * 200)) * DAY),
  }));
  const comps = Object.keys(SHELF_LIFE);
  for (let i = 0; i < 70; i++) {
    const component = pick(comps);
    const age = component === 'PLATELETS' ? Math.floor(rnd() * 5) : Math.floor(rnd() * SHELF_LIFE[component] * 0.85);
    addUnit({
      donorId: 'D-' + String(1 + Math.floor(rnd() * names.length)).padStart(3, '0'),
      type: BLOOD_TYPES[Math.floor(rnd() * 8)], component, bankId: pick(banks).id,
      collected: today() - age * DAY,
    });
  }
  addLog('System started with seed data');
})();

// ---------- helpers ----------
const err = (res, code, msg) => res.status(code).json({ error: msg });

// ---------- API: dashboard ----------
app.get('/api/meta', (req, res) => res.json({ bloodTypes: BLOOD_TYPES, components: Object.keys(SHELF_LIFE), shelfLife: SHELF_LIFE, banks, hospitals: graph.nodes.filter(n => n.type === 'hospital') }));

app.get('/api/summary', (req, res) => {
  sweepExpired();
  const all = units.inorder();
  const avail = all.filter(u => u.status === 'AVAILABLE');
  const stock = {};
  BLOOD_TYPES.forEach(t => { stock[t] = {}; Object.keys(SHELF_LIFE).forEach(c => (stock[t][c] = 0)); });
  avail.forEach(u => stock[u.type][u.component]++);
  const near = MinHeap.heapSort(avail.filter(u => daysLeft(u) <= NEAR_EXPIRY_DAYS), u => u.expiry)
    .map(u => ({ ...u, daysLeft: daysLeft(u) }));
  res.json({
    totals: { donors: donors.size, units: units.size, available: avail.length, nearExpiry: near.length,
      expired: all.filter(u => u.status === 'EXPIRED').length, issued: all.filter(u => u.status === 'ISSUED').length },
    stock, nearExpiry: near, avlHeight: { donors: donors.height, units: units.height }, log: log.slice(0, 15),
  });
});

// ---------- API: donors ----------
app.get('/api/donors', (req, res) => res.json(donors.inorder()));

app.get('/api/donors/:id', (req, res) => {
  const { value, steps } = donors.search(req.params.id.toUpperCase());
  if (!value) return err(res, 404, 'Donor not found (searched ' + steps + ' nodes)');
  res.json({ donor: value, steps, treeHeight: donors.height });
});

app.post('/api/donors', (req, res) => {
  const { name, age, type, phone, city } = req.body || {};
  if (!name || !String(name).trim()) return err(res, 400, 'Name is required');
  const a = Number(age);
  if (!Number.isInteger(a) || a < 18 || a > 65) return err(res, 400, 'Donor age must be 18-65');
  if (!BLOOD_TYPES.includes(type)) return err(res, 400, 'Invalid blood type');
  const d = addDonor({ name: String(name).trim(), age: a, type, phone, city });
  addLog(`Donor registered: ${d.name} (${d.id}, ${d.type})`);
  res.status(201).json(d);
});

app.post('/api/donors/:id/donate', (req, res) => {
  const { value: d } = donors.search(req.params.id.toUpperCase());
  if (!d) return err(res, 404, 'Donor not found');
  const { component, bankId } = req.body || {};
  if (!SHELF_LIFE[component]) return err(res, 400, 'Invalid component');
  if (!isBank(bankId)) return err(res, 400, 'Invalid blood bank');
  if (d.lastDonation) {
    const gap = Math.floor((today() - new Date(d.lastDonation).getTime()) / DAY);
    if (gap < DONOR_GAP_DAYS) return err(res, 400, `Donor not eligible yet: last donated ${gap} days ago (min ${DONOR_GAP_DAYS})`);
  }
  const unit = addUnit({ donorId: d.id, type: d.type, component, bankId, collected: today() });
  d.lastDonation = iso(today()); d.donations++;
  addLog(`Donation: ${d.name} -> ${unit.id} (${unit.type} ${component}) at ${bankId}`);
  res.status(201).json(unit);
});

// ---------- API: units ----------
app.get('/api/units', (req, res) => {
  sweepExpired();
  res.json(units.inorder().map(u => ({ ...u, daysLeft: daysLeft(u) })));
});

app.get('/api/units/:id', (req, res) => {
  const { value, steps } = units.search(req.params.id.toUpperCase());
  if (!value) return err(res, 404, 'Unit not found (searched ' + steps + ' nodes)');
  res.json({ unit: { ...value, daysLeft: daysLeft(value) }, steps, treeHeight: units.height, totalUnits: units.size });
});

app.delete('/api/units/:id', (req, res) => {
  const ok = units.delete(req.params.id.toUpperCase()); // heap entry is skipped lazily later
  if (!ok) return err(res, 404, 'Unit not found');
  addLog(`Unit ${req.params.id.toUpperCase()} discarded`);
  res.json({ deleted: true });
});

// ---------- API: network ----------
app.get('/api/network', (req, res) => res.json({
  nodes: graph.nodes, edges: graph.edges, matrix: graph.matrix, list: graph.list.map((l, i) => ({
    node: graph.nodes[i].id, neighbours: l.map(e => ({ id: graph.nodes[e.to].id, km: e.w })) })),
  stats: graph.stats(),
}));

app.get('/api/route', (req, res) => {
  const { from, to } = req.query;
  if (!(from in graph.idx) || !(to in graph.idx)) return err(res, 400, 'Unknown node id');
  const r = graph.route(from, to);
  if (!r) return err(res, 404, 'No route');
  res.json({ ...r, etaMin: Math.round((r.km / SPEED_KMPH) * 60) });
});

// ---------- API: emergency request (Dijkstra + FEFO heap) ----------
app.post('/api/request', (req, res) => {
  sweepExpired();
  const { hospitalId, type, component, quantity } = req.body || {};
  const hosp = graph.nodes.find(n => n.id === hospitalId && n.type === 'hospital');
  const qty = Number(quantity);
  if (!hosp) return err(res, 400, 'Invalid hospital');
  if (!BLOOD_TYPES.includes(type) || !SHELF_LIFE[component]) return err(res, 400, 'Invalid blood type or component');
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) return err(res, 400, 'Quantity must be 1-20');

  const { dist } = graph.dijkstra(hospitalId);
  const order = banks.map(b => ({ b, km: dist[graph.idx[b.id]] })).filter(x => x.km < Infinity).sort((a, b) => a.km - b.km);
  const issued = [];
  let need = qty;
  for (const { b, km } of order) {
    const heap = fefo.get(heapKey(b.id, type, component));
    while (need > 0 && heap && heap.size) {
      const top = heap.pop();                                   // earliest expiry first
      const cur = units.search(top.id).value;
      if (!cur || cur.status !== 'AVAILABLE' || daysLeft(cur) < 0) { if (cur && cur.status === 'AVAILABLE') cur.status = 'EXPIRED'; continue; }
      cur.status = 'ISSUED'; cur.issuedTo = hospitalId;
      issued.push({ unitId: cur.id, bankId: b.id, expiry: cur.expiry, daysLeft: daysLeft(cur), km });
      need--;
    }
    if (!need) break;
  }
  const bankIds = [...new Set(issued.map(i => i.bankId))];
  const routes = bankIds.map(id => { const r = graph.route(id, hospitalId); return { bankId: id, ...r, etaMin: Math.round((r.km / SPEED_KMPH) * 60) }; });
  addLog(`Request ${hosp.id}: ${qty} x ${type} ${component} -> issued ${issued.length}${need ? ` (short by ${need})` : ''}`);
  res.json({ hospital: hosp, requested: qty, issuedCount: issued.length, shortfall: need, issued, routes });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Blood Bank MVP running at http://localhost:${PORT}`));
