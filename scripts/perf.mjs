// Performance smoke test: seeds a large map (~1330 nodes) straight into the
// Firestore emulator and measures editor load + interaction latency.
// Prereq: emulators + app (:3000) running, e2e user already created
// (run scripts/e2e.mjs first). Run: node scripts/perf.mjs
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const FIRESTORE = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const PROJECT = 'demo-hfl';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;

// Firestore REST value encoding
function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: fields(v) } };
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)]));

async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const res = await fetch(`${FIRESTORE}/v1/${DOCS}:commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
    });
    if (!res.ok) throw new Error(`commit failed: ${res.status} ${await res.text()}`);
  }
}

// uid of the e2e test user
const signIn = await fetch(
  `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'teste@exemplo.com',
      password: 'senha-teste-123',
      returnSecureToken: true,
    }),
  }
).then((r) => r.json());
if (!signIn.localId) throw new Error('usuário de teste não existe — rode scripts/e2e.mjs antes');
const UID = signIn.localId;

const mapId = crypto.randomUUID();
const now = new Date().toISOString();
const writes = [
  {
    update: {
      name: `${DOCS}/maps/${mapId}`,
      fields: fields({
        id: mapId,
        owner_id: UID,
        title: 'Mapa Grande (perf)',
        concept: 'teste de performance',
        created_at: now,
        updated_at: now,
      }),
    },
  },
];

let total = 0;
const mk = (parent_id, title, order) => {
  const id = crypto.randomUUID();
  total++;
  writes.push({
    update: {
      name: `${DOCS}/maps/${mapId}/nodes/${id}`,
      fields: fields({
        id, map_id: mapId, parent_id, title,
        description: '', notes: '', node_type: 'observacao', importance: 'normal',
        status: 'ideia', tags: [], refs: [], order_index: order,
        position_x: null, position_y: null, collapsed: false,
        created_at: now, updated_at: now, created_by: UID,
      }),
    },
  });
  return id;
};

const root = mk(null, 'RAIZ PERFORMANCE', 0);
for (let b = 0; b < 8; b++) {
  const branch = mk(root, `Ramo ${b + 1}`, b);
  for (let c = 0; c < 15; c++) {
    const child = mk(branch, `Assunto ${b + 1}.${c + 1}`, c);
    for (let g = 0; g < 10; g++) mk(child, `Detalhe ${b + 1}.${c + 1}.${g + 1}`, g);
  }
}
await commit(writes);
console.log(`seeded ${total} nodes into map ${mapId}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE + '/login');
await page.fill('input[type=email]', 'teste@exemplo.com');
await page.fill('input[type=password]', 'senha-teste-123');
await page.click('button[type=submit]');
await page.waitForSelector('text=Abrir mapa', { timeout: 20000 });

const t0 = Date.now();
await page.goto(`${BASE}/map/${mapId}`);
await page.waitForSelector('.react-flow__node', { timeout: 30000 });
const tLoad = Date.now() - t0;

await page.waitForTimeout(500);
const rendered = await page.locator('.react-flow__node').count();

// Interaction latency: navigate to a node via search (reveals + centers + selects)
const t1 = Date.now();
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar"]', 'Ramo 3');
await page.locator('button', { hasText: /^Ramo 3/ }).first().click();
await page.waitForSelector('text=Detalhes do assunto', { timeout: 10000 });
const tSelect = Date.now() - t1;
await page.waitForTimeout(800);

// Collapse a large branch (now centered in viewport)
const t2 = Date.now();
await page.locator('.react-flow__node').filter({ has: page.getByText('Ramo 3', { exact: true }) }).first()
  .locator('button[title="Recolher"]').click();
await page.waitForTimeout(100);
const tCollapse = Date.now() - t2;
await page.keyboard.press('Escape');

// Collapse all
const t3 = Date.now();
await page.click('button[title="Recolher tudo"]');
await page.waitForTimeout(200);
const collapsedCount = await page.locator('.react-flow__node').count();
const tCollapseAll = Date.now() - t3;

// Search across 1200+ nodes
const t4 = Date.now();
await page.keyboard.press('Escape');
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar"]', 'Detalhe 7.14');
await page.waitForSelector('text=Detalhe 7.14.1', { timeout: 10000 });
const tSearch = Date.now() - t4;

console.log(JSON.stringify({
  totalNodes: total,
  renderedNodes: rendered,
  loadMs: tLoad,
  selectMs: tSelect,
  collapseBranchMs: tCollapse,
  collapseAllMs: tCollapseAll,
  searchMs: tSearch,
  collapsedVisible: collapsedCount,
}, null, 2));

await browser.close();
