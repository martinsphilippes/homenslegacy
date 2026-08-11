// Performance smoke test: seeds a large map (~1200 nodes) into the mock and measures
// editor load + interaction latency. Run with mock (:54321) and app (:3000) up.
import { chromium } from 'playwright';

const MOCK = 'http://127.0.0.1:54321';
const BASE = 'http://127.0.0.1:3000';
const USER_ID = '11111111-1111-4111-8111-111111111111';

async function rest(path, method, body) {
  const res = await fetch(`${MOCK}/rest/v1/${path}`, {
    method,
    headers: { 'content-type': 'application/json', prefer: 'return=representation', accept: 'application/vnd.pgrst.object+json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Build a wide+deep tree: root -> 8 branches -> each 15 children -> each 10 children (1+8+120+1200 nodes)
const map = await rest('maps', 'POST', { owner_id: USER_ID, title: 'Mapa Grande (perf)', concept: 'teste' });
const nodes = [];
const mk = (parent_id, title, order) => {
  const n = {
    id: crypto.randomUUID(), map_id: map.id, parent_id, title,
    description: '', notes: '', node_type: 'observacao', importance: 'normal', status: 'ideia',
    tags: [], refs: [], order_index: order, position_x: null, position_y: null, collapsed: false,
  };
  nodes.push(n);
  return n;
};
const root = mk(null, 'RAIZ PERFORMANCE', 0);
for (let b = 0; b < 8; b++) {
  const branch = mk(root.id, `Ramo ${b + 1}`, b);
  for (let c = 0; c < 15; c++) {
    const child = mk(branch.id, `Assunto ${b + 1}.${c + 1}`, c);
    for (let g = 0; g < 10; g++) mk(child.id, `Detalhe ${b + 1}.${c + 1}.${g + 1}`, g);
  }
}
await fetch(`${MOCK}/rest/v1/nodes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(nodes),
});
console.log(`seeded ${nodes.length + 1} nodes into map ${map.id}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE + '/login');
await page.fill('input[type=email]', 'teste@exemplo.com');
await page.fill('input[type=password]', 'senha-teste-123');
await page.click('button[type=submit]');
await page.waitForSelector('text=Mapa Grande (perf)', { timeout: 20000 });

const t0 = Date.now();
await page.goto(`${BASE}/map/${map.id}`);
await page.waitForSelector('.react-flow__node', { timeout: 30000 });
const tLoad = Date.now() - t0;

// All expanded: how many DOM nodes / how long to settle
await page.waitForTimeout(500);
const rendered = await page.locator('.react-flow__node').count();

// Interaction latency: navigate to a node via search (reveals + centers + selects)
const t1 = Date.now();
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar"]', 'Ramo 3');
await page.locator('button', { hasText: /^Ramo 3/ }).first().click();
await page.waitForSelector('text=Detalhes do assunto', { timeout: 10000 });
const tSelect = Date.now() - t1;
await page.waitForTimeout(800); // wait for centering animation

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

// Search across 1200 nodes
const t4 = Date.now();
await page.keyboard.press('Escape');
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar"]', 'Detalhe 7.14');
await page.waitForSelector('text=Detalhe 7.14.1', { timeout: 10000 });
const tSearch = Date.now() - t4;

console.log(JSON.stringify({
  totalNodes: nodes.length + 1,
  renderedNodes: rendered,
  loadMs: tLoad,
  selectMs: tSelect,
  collapseBranchMs: tCollapse,
  collapseAllMs: tCollapseAll,
  searchMs: tSearch,
  collapsedVisible: collapsedCount,
}, null, 2));

// cleanup perf map
await fetch(`${MOCK}/rest/v1/maps?id=eq.${map.id}`, { method: 'DELETE' });
await browser.close();
