// End-to-end smoke test against the Firebase Emulator Suite.
// Prereq: `npx firebase emulators:start --project demo-hfl --only auth,firestore`
// and the app built with NEXT_PUBLIC_FIREBASE_EMULATOR=1 running on :3000.
// Run: node scripts/e2e.mjs
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const SHOTS = process.env.SHOTS_DIR || '/tmp/e2e-shots';
let failures = 0;

function ok(name, cond) {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) failures++;
}

const nodeByTitle = (pg, t) =>
  pg.locator('.react-flow__node').filter({ has: pg.getByText(t, { exact: true }) }).first();

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

// 1. Route protection: unauthenticated access must land on /login
await page.goto(BASE + '/');
await page.waitForURL(/\/login/, { timeout: 15000 });
ok('rota protegida redireciona para /login', page.url().includes('/login'));
await page.screenshot({ path: `${SHOTS}/01-login.png` });

// 2. Login (first run on a fresh emulator: sign up instead)
await page.fill('input[type=email]', 'teste@exemplo.com');
await page.fill('input[type=password]', 'senha-teste-123');
await page.click('button[type=submit]');
const loggedIn = await page
  .waitForURL((u) => !u.pathname.includes('login'), { timeout: 8000 })
  .then(() => true)
  .catch(() => false);
if (!loggedIn) {
  await page.click('text=Criar conta');
  await page.fill('input[type=email]', 'teste@exemplo.com');
  await page.fill('input[type=password]', 'senha-teste-123');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 20000 });
}
ok('login/cadastro redireciona para Meus Mapas', true);

// 3. Seeded map appears
await page.waitForSelector('text=Homem, Família e Legado', { timeout: 20000 });
ok('mapa inicial criado automaticamente', true);
await page.screenshot({ path: `${SHOTS}/02-meus-mapas.png` });

// 4. Open the map
await page.click('text=Abrir mapa');
await page.waitForSelector('text=HOMEM, FAMÍLIA E LEGADO', { timeout: 20000 });
ok('editor abre com node raiz', true);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOTS}/03-mapa.png` });

// 5. Level-1 branches visible
for (const t of ['HOMEM', 'MULHER', 'CASAMENTO', 'LEGADO']) {
  ok(`ramo ${t} visível`, (await page.locator(`.react-flow__node >> text="${t}"`).count()) > 0);
}

// 6. Select HOMEM -> side panel opens
await nodeByTitle(page, 'HOMEM').click();
await page.waitForSelector('text=Detalhes do assunto', { timeout: 8000 });
ok('painel lateral abre ao selecionar', true);
await page.screenshot({ path: `${SHOTS}/04-painel.png` });

// 7. Create child via panel and edit inline
await page.click('text=+ Criar filho');
await page.waitForSelector('input[placeholder="Novo assunto…"]', { timeout: 8000 });
await page.fill('input[placeholder="Novo assunto…"]', 'Disciplina');
await page.keyboard.press('Enter');
await page.waitForSelector('.react-flow__node >> text="Disciplina"', { timeout: 8000 });
ok('criar filho + edição inline (Enter salva)', true);

// 8. Create a grandchild from the new node (indefinite depth)
await nodeByTitle(page, 'Disciplina').click();
await page.click('text=+ Criar filho');
await page.waitForSelector('input[placeholder="Novo assunto…"]');
await page.fill('input[placeholder="Novo assunto…"]', 'Rotina');
await page.keyboard.press('Enter');
await page.waitForSelector('.react-flow__node >> text="Rotina"', { timeout: 8000 });
ok('derivação de derivação (Disciplina → Rotina)', true);

// 9. Autosave indicator settles to "Salvo"
await page.waitForSelector('text=Salvo', { timeout: 10000 });
ok('autosave: indicador "Salvo"', true);

// 10. Notes + bible reference through panel
await nodeByTitle(page, 'Disciplina').click();
await page.waitForSelector('text=Detalhes do assunto');
await page.fill('textarea[placeholder="Estudos, observações, argumentos…"]', 'Anotação de teste.');
await page.click('text=+ Adicionar referência');
await page.fill('input[placeholder="Livro"]', 'Efésios');
await page.fill('input[placeholder="Cap."]', '5');
await page.fill('input[placeholder="Vers."]', '25');
ok('anotações e referência bíblica preenchidas', true);
await page.waitForSelector('text=Salvo', { timeout: 10000 });

// 11. Persistence: reload and confirm everything is still there
await page.reload();
await page.waitForSelector('text=HOMEM, FAMÍLIA E LEGADO', { timeout: 20000 });
await page.waitForSelector('.react-flow__node >> text="Disciplina"', { timeout: 8000 });
ok('persistência após recarregar (Disciplina)', true);
await nodeByTitle(page, 'Disciplina').click();
const notesVal = await page.inputValue('textarea[placeholder="Estudos, observações, argumentos…"]');
ok('anotações persistidas', notesVal === 'Anotação de teste.');
const bookVal = await page.inputValue('input[placeholder="Livro"]');
ok('referência bíblica persistida', bookVal === 'Efésios');
await page.keyboard.press('Escape');

// 12. Collapse / expand branch
const homemNode = nodeByTitle(page, 'HOMEM');
await homemNode.locator('button[title="Recolher"]').click();
await page.waitForTimeout(600);
ok('recolher ramo esconde filhos', (await page.locator('.react-flow__node >> text="Provedor"').count()) === 0);
await homemNode.locator('button[title="Expandir"]').click();
await page.waitForTimeout(600);
ok('expandir ramo mostra filhos', (await page.locator('.react-flow__node >> text="Provedor"').count()) > 0);

// 13. Search
await page.keyboard.press('/');
await page.waitForSelector('input[placeholder*="Buscar"]', { timeout: 5000 });
await page.fill('input[placeholder*="Buscar"]', 'traição');
await page.locator('button', { hasText: 'O que consideramos traição?' }).first().click({ timeout: 5000 });
await page.waitForTimeout(900);
ok('busca encontra e navega até o node', (await page.locator('.react-flow__node >> text="O que consideramos traição?"').count()) > 0);
await page.screenshot({ path: `${SHOTS}/05-busca.png` });

// 14. Breadcrumbs visible for selected node
ok('breadcrumbs mostram caminho', (await page.locator('nav >> text=Infidelidade').count()) > 0);

// 15. Delete node with confirmation (navigate via search to center it first)
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar"]', 'Rotina');
await page.locator('button', { hasText: /^Rotina/ }).first().click();
await page.waitForSelector('text=Detalhes do assunto', { timeout: 8000 });
page.once('dialog', (d) => d.accept());
await page.locator('aside >> text=Excluir').click();
await page.waitForTimeout(600);
ok('excluir com confirmação', (await page.locator('.react-flow__node >> text="Rotina"').count()) === 0);

// 15b. Move a node to another parent via picker
await page.keyboard.press('/');
await page.fill('input[placeholder*="Buscar em títulos"]', 'Disciplina');
await page.locator('button', { hasText: /^Disciplina/ }).first().click();
await page.waitForSelector('text=Detalhes do assunto', { timeout: 8000 });
await page.click('text=Mover para outra caixa…');
await page.waitForSelector('input[placeholder="Buscar a caixa de destino…"]', { timeout: 5000 });
await page.fill('input[placeholder="Buscar a caixa de destino…"]', 'MULHER');
await page.locator('.fixed button', { hasText: 'MULHER' }).first().click();
await page.waitForTimeout(900);
ok('mover caixa para outro pai', (await page.locator('nav >> text=MULHER').count()) > 0);
await page.keyboard.press('Escape');

// 16. Presentation mode
await page.click('button[title="Modo apresentação"]');
await page.waitForTimeout(900);
ok('modo apresentação esconde controles', (await page.locator('button[title="Buscar (Ctrl+F ou /)"]').count()) === 0);
await page.screenshot({ path: `${SHOTS}/06-apresentacao.png` });
// open a branch by clicking it
await nodeByTitle(page, 'HOMEM').click();
await page.waitForTimeout(700);
ok('apresentação: clique abre ramo', (await page.locator('.react-flow__node >> text="Provedor"').count()) > 0);
await page.click('button[title="Sair da apresentação (Esc)"]');
await page.waitForTimeout(400);

// 17. Export JSON backup
const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
await page.click('button[title="Backup / exportar"]');
await page.click('text=Exportar backup (JSON)');
const download = await downloadPromise;
const path = await download.path();
ok('exportar backup JSON', !!path);
const fs = await import('node:fs');
const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
ok('backup válido e com nodes', backup.format === 'homens-legado-backup' && backup.nodes.length > 50);

// 18. Undo (created child earlier, delete it via undo path): create + undo
await nodeByTitle(page, 'Disciplina').click();
await page.keyboard.press('Tab');
await page.waitForSelector('input[placeholder="Novo assunto…"]');
await page.fill('input[placeholder="Novo assunto…"]', 'Temporário');
await page.keyboard.press('Enter');
await page.waitForSelector('.react-flow__node >> text="Temporário"');
await page.keyboard.press('Control+z'); // undo title set
await page.keyboard.press('Control+z'); // undo creation
await page.waitForTimeout(600);
ok('desfazer (Ctrl+Z) remove criação', (await page.locator('.react-flow__node >> text="Temporário"').count()) === 0);

// 19. Mobile viewport smoke test
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
await mobile.goto(BASE + '/');
await mobile.waitForURL(/login/, { timeout: 15000 }).catch(() => {});
if (mobile.url().includes('login')) {
  await mobile.fill('input[type=email]', 'teste@exemplo.com');
  await mobile.fill('input[type=password]', 'senha-teste-123');
  await mobile.click('button[type=submit]');
}
await mobile.waitForSelector('text=Abrir mapa', { timeout: 20000 });
await mobile.click('text=Abrir mapa');
await mobile.waitForSelector('text=HOMEM, FAMÍLIA E LEGADO', { timeout: 20000 });
ok('mobile: mapa abre', true);
await mobile.screenshot({ path: `${SHOTS}/07-mobile.png` });

// 20. PWA basics
const manifestResp = await page.request.get(BASE + '/manifest.webmanifest');
ok('manifest acessível', manifestResp.ok());
const swResp = await page.request.get(BASE + '/sw.js');
ok('service worker acessível', swResp.ok());

// 21. Logout
await page.goto(BASE + '/');
await page.click('text=Sair');
await page.waitForURL(/login/, { timeout: 15000 });
ok('logout retorna ao login', true);

await browser.close();
console.log(failures === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
