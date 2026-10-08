# Intelligent Blood Bank Management System - MVP

Frontend + backend only. **No database**: all data lives in memory (resets on restart) and is seeded on startup.

## Run
```bash
cd backend
npm install
npm start
# open http://localhost:3000 (landing page). Dashboard: /app.html
```

## Where each DSA concept is used
| Concept | File | Used for |
|---|---|---|
| AVL Tree | `backend/ds/avl.js` | Indexing donors (by ID) and blood units (by ID): O(log n) search/insert/delete, in-order listing |
| Binary Min-Heap (FEFO) | `backend/ds/heap.js` | One heap per bank + blood type + component, keyed by expiry date; oldest expiry issued first |
| Heap Sort | `backend/ds/heap.js` | Near-expiry report on the dashboard |
| Graph (matrix + list) | `backend/ds/graph.js` | Donation camps / banks / hospitals network, both representations shown in the Network tab |
| Dijkstra (min-heap) | `backend/ds/graph.js` | Nearest bank + delivery route/ETA for hospital requests |

## API
`GET /api/summary` `GET/POST /api/donors` `GET /api/donors/:id` `POST /api/donors/:id/donate`
`GET /api/units` `GET/DELETE /api/units/:id` `GET /api/network` `GET /api/route?from=&to=` `POST /api/request`

## Rules built in
Donor age 18-65, 90-day gap between donations, shelf life (Whole blood 35d, RBC 42d, Platelets 5d, Plasma 365d), expired units auto-flagged.

## Next steps (later reviews)
Add a database, login/roles, blood-group compatibility in requests, real map distances.
