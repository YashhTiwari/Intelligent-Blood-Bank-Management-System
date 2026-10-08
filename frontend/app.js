const $ = id => document.getElementById(id);
let META = null, NET = null;

async function api(url, method = 'GET', body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(msg, ok = true) {
  const t = $('toast'); t.textContent = msg; t.className = ok ? 'ok' : 'bad'; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 3200);
}
const act = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, false); } };
const opts = (el, arr, fn = x => [x, x]) => { el.innerHTML += arr.map(x => { const [v, t] = fn(x); return `<option value="${v}">${t}</option>`; }).join(''); };
const pretty = s => s.replace('_', ' ');
const tag = s => `<span class="tag ${s}">${s}</span>`;
const nm = id => (NET.nodes.find(n => n.id === id) || {}).name || id;

// ---------- tabs ----------
$('tabs').onclick = e => {
  const t = e.target.dataset.tab; if (!t) return;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === t));
  $('pageTitle').textContent = e.target.textContent;
  ({ dash: loadDash, donors: loadDonors, inv: loadUnits, net: loadNet }[t] || (() => {}))();
};

// ---------- dashboard ----------
const loadDash = act(async () => {
  const d = await api('/api/summary'), t = d.totals;
  const items = [['Donors', t.donors], ['Total units', t.units], ['Available', t.available], ['Near expiry', t.nearExpiry], ['Issued', t.issued], ['Expired', t.expired]];
  $('cards').innerHTML = items.map(([k, v]) => `<div class="card"><b>${v}</b><span>${k}</span></div>`).join('');
  const comps = META.components;
  $('stockTbl').innerHTML = `<tr><th>Type</th>${comps.map(c => `<th>${pretty(c)}</th>`).join('')}</tr>` +
    META.bloodTypes.map(bt => `<tr><td><b>${bt}</b></td>${comps.map(c => { const n = d.stock[bt][c]; return `<td class="${n === 0 ? 'z' : n <= 1 ? 'low' : ''}">${n}</td>`; }).join('')}</tr>`).join('');
  $('nearTbl').innerHTML = d.nearExpiry.length
    ? `<tr><th>Unit</th><th>Type</th><th>Component</th><th>Bank</th><th>Days left</th></tr>` +
      d.nearExpiry.map(u => `<tr><td>${u.id}</td><td>${u.type}</td><td>${pretty(u.component)}</td><td>${u.bankId}</td><td class="${u.daysLeft <= 2 ? 'warn' : ''}">${u.daysLeft}</td></tr>`).join('')
    : '<tr><td>No units expire within 7 days.</td></tr>';
  $('log').innerHTML = d.log.map(l => `<li>${new Date(l.time).toLocaleTimeString()} — ${l.msg}</li>`).join('');
});

// ---------- donors ----------
const loadDonors = act(async () => {
  const list = await api('/api/donors');
  $('donorTbl').innerHTML = `<tr><th>ID</th><th>Name</th><th>Age</th><th>Type</th><th>City</th><th>Phone</th><th>Last donation</th><th></th></tr>` +
    list.map(d => `<tr><td>${d.id}</td><td>${d.name}</td><td>${d.age}</td><td>${d.type}</td><td>${d.city}</td><td>${d.phone}</td><td>${d.lastDonation || '—'}</td>
    <td><button class="sm" onclick="$('dnId').value='${d.id}';window.scrollTo(0,0)">Donate</button></td></tr>`).join('');
});
const addDonor = act(async () => {
  const d = await api('/api/donors', 'POST', { name: $('dName').value, age: $('dAge').value, type: $('dType').value, phone: $('dPhone').value, city: $('dCity').value });
  toast(`Registered ${d.name} as ${d.id}`);
  ['dName', 'dAge', 'dPhone', 'dCity'].forEach(i => ($(i).value = ''));
  loadDonors();
});
const donate = act(async () => {
  const id = $('dnId').value.trim(); if (!id) throw new Error('Enter a donor ID');
  const u = await api(`/api/donors/${encodeURIComponent(id)}/donate`, 'POST', { component: $('dnComp').value, bankId: $('dnBank').value });
  toast(`Unit ${u.id} added (expires ${u.expiry})`);
  loadDonors();
});
const lookupDonor = act(async () => {
  $('dqOut').textContent = '';
  const r = await api('/api/donors/' + encodeURIComponent($('dqId').value.trim()));
  const d = r.donor;
  $('dqOut').innerHTML = `<b>${d.name}</b> — ${d.type}, age ${d.age}, ${d.city || 'n/a'}. Last donation: ${d.lastDonation || 'never'}.<br>Found in ${r.steps} comparisons (tree height ${r.treeHeight}).`;
});

// ---------- inventory ----------
let UNITS = [];
const loadUnits = act(async () => { UNITS = await api('/api/units'); renderUnits(); });
function renderUnits() {
  const [t, c, s] = [$('fType').value, $('fComp').value, $('fStatus').value];
  const rows = UNITS.filter(u => (!t || u.type === t) && (!c || u.component === c) && (!s || u.status === s));
  $('unitTbl').innerHTML = `<tr><th>ID</th><th>Type</th><th>Component</th><th>Bank</th><th>Collected</th><th>Expiry</th><th>Days left</th><th>Status</th><th></th></tr>` +
    rows.map(u => `<tr><td>${u.id}</td><td>${u.type}</td><td>${pretty(u.component)}</td><td>${u.bankId}</td><td>${u.collected}</td><td>${u.expiry}</td>
    <td class="${u.daysLeft <= 2 && u.status === 'AVAILABLE' ? 'warn' : ''}">${u.daysLeft}</td><td>${tag(u.status)}</td>
    <td><button class="sm" onclick="discard('${u.id}')">Discard</button></td></tr>`).join('') || '<tr><td>No units match these filters.</td></tr>';
}
['fType', 'fComp', 'fStatus'].forEach(i => ($(i).onchange = renderUnits));
const lookupUnit = act(async () => {
  $('uqOut').textContent = '';
  const r = await api('/api/units/' + encodeURIComponent($('uqId').value.trim()));
  const u = r.unit;
  $('uqOut').innerHTML = `<b>${u.id}</b>: ${u.type} ${pretty(u.component)} at ${u.bankId}, expires ${u.expiry} (${u.daysLeft} days), ${u.status}.<br>Found in ${r.steps} comparisons among ${r.totalUnits} units (tree height ${r.treeHeight}) — a linear scan could need up to ${r.totalUnits}.`;
});
const discard = act(async id => { if (!confirm('Discard unit ' + id + '?')) return; await api('/api/units/' + id, 'DELETE'); toast(id + ' discarded'); loadUnits(); });

// ---------- request ----------
const sendRequest = act(async () => {
  const r = await api('/api/request', 'POST', { hospitalId: $('rHosp').value, type: $('rType').value, component: $('rComp').value, quantity: $('rQty').value });
  const box = $('reqOut'); box.style.display = 'block';
  box.innerHTML = `<h2>${r.hospital.name}: ${r.issuedCount} of ${r.requested} units issued ${r.shortfall ? `<span class="warn">(short by ${r.shortfall})</span>` : '✅'}</h2>` +
    (r.issued.length ? `<table><tr><th>Unit</th><th>From</th><th>Expiry</th><th>Days left</th><th>Distance</th></tr>${r.issued.map(i => `<tr><td>${i.unitId}</td><td>${i.bankId}</td><td>${i.expiry}</td><td>${i.daysLeft}</td><td>${i.km} km</td></tr>`).join('')}</table>` : '<p>No matching stock in any reachable bank.</p>') +
    (r.routes.length ? `<h2 style="margin-top:14px">Delivery routes</h2><ul>${r.routes.map(x => `<li>${x.path.map(nm).join(' → ')} — <b>${x.km} km, ~${x.etaMin} min</b></li>`).join('')}</ul>` : '') +
    `<p class="note">Banks are tried nearest-first; inside each bank the unit closest to expiry goes out first (FEFO).</p>`;
});

// ---------- network ----------
function drawNet(hl = []) {
  const pos = Object.fromEntries(NET.nodes.map(n => [n.id, n]));
  const onEdge = (a, b) => hl.some((p, i) => i < hl.length - 1 && ((p === a && hl[i + 1] === b) || (p === b && hl[i + 1] === a)));
  $('svg').innerHTML = NET.edges.map(e => { const a = pos[e.from], b = pos[e.to];
      return `<line class="edge ${onEdge(e.from, e.to) ? 'on' : ''}" x1="${a.x + 40}" y1="${a.y + 20}" x2="${b.x + 40}" y2="${b.y + 20}"/>
      <text x="${(a.x + b.x) / 2 + 40}" y="${(a.y + b.y) / 2 + 16}" font-size="13" fill="#667584" text-anchor="middle">${e.km}</text>`; }).join('') +
    NET.nodes.map(n => `<circle class="n-${n.type}" cx="${n.x + 40}" cy="${n.y + 20}" r="14"/><text x="${n.x + 40}" y="${n.y + 46}" font-size="14" text-anchor="middle" font-weight="600" fill="#16202a">${n.id}</text>`).join('');
}
const loadNet = act(async () => {
  NET = await api('/api/network'); drawNet();
  const ids = NET.nodes.map(n => n.id);
  $('matTbl').innerHTML = `<tr><th></th>${ids.map(i => `<th>${i}</th>`).join('')}</tr>` + NET.matrix.map((r, i) => `<tr><th>${ids[i]}</th>${r.map(v => `<td>${v || '·'}</td>`).join('')}</tr>`).join('');
  $('listTbl').innerHTML = `<tr><th>Node</th><th>Neighbours (km)</th></tr>` + NET.list.map(l => `<tr><td><b>${l.node}</b></td><td>${l.neighbours.map(n => `${n.id}(${n.km})`).join(', ')}</td></tr>`).join('');
  const s = NET.stats;
  $('netStats').innerHTML = `${s.vertices} vertices, ${s.edges} edges (density ${s.density}).<br>Matrix stores <b>${s.matrixCells}</b> cells; list stores <b>${s.listEntries}</b> entries.<br>${s.note}`;
});
const findRoute = act(async () => {
  const r = await api(`/api/route?from=${$('rtFrom').value}&to=${$('rtTo').value}`);
  drawNet(r.path); $('rtOut').innerHTML = `${r.path.map(nm).join(' → ')}<br><b>${r.km} km, ~${r.etaMin} min</b>`;
});

// ---------- init ----------
(async () => {
  try {
    META = await api('/api/meta'); NET = await api('/api/network');
    opts($('dType'), META.bloodTypes); opts($('rType'), META.bloodTypes); opts($('fType'), META.bloodTypes);
    opts($('dnComp'), META.components, c => [c, pretty(c)]); opts($('rComp'), META.components, c => [c, pretty(c)]); opts($('fComp'), META.components, c => [c, pretty(c)]);
    opts($('dnBank'), META.banks, b => [b.id, b.name]); opts($('rHosp'), META.hospitals, h => [h.id, h.name]);
    opts($('rtFrom'), NET.nodes, n => [n.id, n.name]); opts($('rtTo'), NET.nodes, n => [n.id, n.name]);
    $('rtTo').value = 'H1';
    loadDash();
  } catch (e) { toast('Backend not reachable: ' + e.message, false); }
})();
