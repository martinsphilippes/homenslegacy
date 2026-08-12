// Smoke test against REAL Firebase: signup, seed, open map, then full cleanup.
import { chromium } from 'playwright';
const EMAIL = 'teste-claude-tmp3@example.com';
const PASS = 'senha-teste-123';
const API_KEY = 'AIzaSyCkDZ-xT2lpvP9GOeE3mTSdoxsXosnFeX0';
const FS = 'https://firestore.googleapis.com/v1/projects/homenslegacy/databases/(default)/documents';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 200)));

await page.goto('http://127.0.0.1:3000/login');
await page.click('text=Criar conta');
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASS);
await page.click('button[type=submit]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });
console.log('✅ cadastro no Firebase real');
await page.waitForSelector('text=Homem, Família e Legado', { timeout: 30000 });
console.log('✅ mapa inicial criado e populado no Firestore real');
await page.click('text=Abrir mapa');
await page.waitForSelector('text=HOMEM, FAMÍLIA E LEGADO', { timeout: 30000 });
console.log('✅ editor abre com dados do Firestore real');
await page.waitForSelector('text=Salvo', { timeout: 15000 }).catch(() => {});
await page.screenshot({ path: process.env.SHOT || '/tmp/prod-smoke.png' });
await browser.close();

// ---- cleanup: delete map(s), nodes, versions and the test user ----
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
}).then((r) => r.json());
const token = signIn.idToken, uid = signIn.localId;
const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const q = await fetch(`${FS.replace('/documents','')}/documents:runQuery`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'maps' }], where: { fieldFilter: { field: { fieldPath: 'owner_id' }, op: 'EQUAL', value: { stringValue: uid } } } } }),
}).then((r) => r.json());
const mapNames = q.filter((r) => r.document).map((r) => r.document.name);
for (const mapName of mapNames) {
  for (const sub of ['nodes', 'versions']) {
    let pageToken = '';
    do {
      const list = await fetch(`https://firestore.googleapis.com/v1/${mapName}/${sub}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`, { headers: H }).then((r) => r.json());
      const docs = list.documents || [];
      await Promise.all(docs.map((d) => fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: H })));
      pageToken = list.nextPageToken || '';
    } while (pageToken);
  }
  await fetch(`https://firestore.googleapis.com/v1/${mapName}`, { method: 'DELETE', headers: H });
}
await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }),
});
console.log(`✅ limpeza: ${mapNames.length} mapa(s) de teste e usuário removidos do projeto real`);
