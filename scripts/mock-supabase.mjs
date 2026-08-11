// Minimal in-memory Supabase mock (GoTrue + PostgREST subset) for local e2e testing.
// Run: node scripts/mock-supabase.mjs  (listens on 127.0.0.1:54321)
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = 54321;
const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'teste@exemplo.com',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: 'email' },
  user_metadata: {},
};
const PASSWORD = 'senha-teste-123';

const db = { maps: [], nodes: [], map_versions: [], map_members: [] };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeJwt() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: USER.id, email: USER.email, exp, role: 'authenticated', aud: 'authenticated', session_id: crypto.randomUUID() }), 'sig'].join('.');
}

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'apikey, authorization, content-type, prefer, x-client-info, x-supabase-api-version, accept-profile, content-profile, range',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
    ...headers,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : null); } catch { resolve(null); }
    });
  });
}

// Parses PostgREST-style filters: id=eq.X, id=in.(a,b), map_id=eq.X
function matchFilters(row, params) {
  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    if (value.startsWith('eq.')) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith('in.(')) {
      const list = value.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
      if (!list.includes(String(row[key]))) return false;
    }
  }
  return true;
}

function applyOrder(rows, params) {
  const order = params.get('order');
  if (!order) return rows;
  const [col, dir] = order.split('.');
  return [...rows].sort((a, b) => {
    const va = a[col] ?? '';
    const vb = b[col] ?? '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === 'desc' ? -cmp : cmp;
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204);

  // ---- Auth (GoTrue) ----
  if (path === '/auth/v1/token' && req.method === 'POST') {
    const body = await readBody(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      if (body?.email !== USER.email || body?.password !== PASSWORD) {
        return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' });
      }
    }
    // password + refresh_token both return a fresh session
    return send(res, 200, {
      access_token: makeJwt(),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: crypto.randomUUID(),
      user: USER,
    });
  }
  if (path === '/auth/v1/user' && req.method === 'GET') {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || auth.split('.').length < 3) return send(res, 401, { msg: 'no token' });
    return send(res, 200, USER);
  }
  if (path === '/auth/v1/logout') return send(res, 204);

  // ---- REST (PostgREST) ----
  const m = path.match(/^\/rest\/v1\/(\w+)$/);
  if (m) {
    const table = m[1];
    if (!db[table]) return send(res, 404, { message: `table ${table} not found` });
    const params = url.searchParams;
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');

    if (req.method === 'GET') {
      let rows = db[table].filter((r) => matchFilters(r, params));
      rows = applyOrder(rows, params);
      const limit = params.get('limit');
      if (limit) rows = rows.slice(0, Number(limit));
      if (wantsObject) {
        if (rows.length === 1) return send(res, 200, rows[0]);
        if (rows.length === 0) return send(res, 200, null);
        return send(res, 406, { message: 'multiple rows' });
      }
      return send(res, 200, rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body) ? body : [body];
      const prefer = req.headers.prefer || '';
      const isUpsert = prefer.includes('resolution=merge-duplicates');
      const inserted = [];
      for (const row of rows) {
        const withDefaults = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== null || true)),
          updated_at: new Date().toISOString(),
        };
        // strip explicit nulls for created_at/updated_at
        if (row.created_at == null) withDefaults.created_at = withDefaults.created_at || new Date().toISOString();
        const existingIdx = db[table].findIndex((r) => r.id === withDefaults.id);
        if (existingIdx >= 0) {
          if (isUpsert) {
            db[table][existingIdx] = { ...db[table][existingIdx], ...withDefaults, created_at: db[table][existingIdx].created_at, updated_at: new Date().toISOString() };
            inserted.push(db[table][existingIdx]);
            continue;
          }
          return send(res, 409, { message: 'duplicate key' });
        }
        db[table].push(withDefaults);
        inserted.push(withDefaults);
      }
      if (prefer.includes('return=representation')) {
        return send(res, 201, wantsObject ? inserted[0] : inserted);
      }
      return send(res, 201);
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const updated = [];
      db[table] = db[table].map((r) => {
        if (matchFilters(r, params)) {
          const next = { ...r, ...body, updated_at: new Date().toISOString() };
          updated.push(next);
          return next;
        }
        return r;
      });
      if ((req.headers.prefer || '').includes('return=representation')) {
        return send(res, 200, wantsObject ? updated[0] : updated);
      }
      return send(res, 204);
    }

    if (req.method === 'DELETE') {
      const before = db[table].length;
      const removed = db[table].filter((r) => matchFilters(r, params));
      db[table] = db[table].filter((r) => !matchFilters(r, params));
      // cascade: deleting maps removes nodes/versions
      if (table === 'maps') {
        for (const map of removed) {
          db.nodes = db.nodes.filter((n) => n.map_id !== map.id);
          db.map_versions = db.map_versions.filter((v) => v.map_id !== map.id);
        }
      }
      return send(res, 204, undefined, { 'content-range': `*/${before - db[table].length}` });
    }
  }

  send(res, 404, { message: 'not found: ' + path });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock supabase on http://127.0.0.1:${PORT}  (user: ${USER.email} / ${PASSWORD})`);
});
