/* Bench sync Worker — one shared document in Cloudflare KV, guarded by a
   passphrase and a revision number.
 *
 *   GET  ->  { rev, updatedAt, state }
 *   PUT  <-  { baseRev, state }  ->  { rev }   |   409 { rev, updatedAt, state }
 *   POST <-  same, but the passphrase rides in the body (navigator.sendBeacon
 *            cannot set headers, and we use it to flush a pending edit on unload)
 *
 * The revision check is what stops one device silently erasing the other's
 * work: a push states which revision it was based on, and the server refuses
 * it if the document has moved on since. The client merges and retries.
 */

const DOC_KEY = 'doc';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (!env.SYNC_PASSPHRASE) {
      return json({ error: 'Worker has no SYNC_PASSPHRASE set. Run: wrangler secret put SYNC_PASSPHRASE' }, 500, cors);
    }
    if (!env.BENCH) {
      return json({ error: 'Worker has no KV namespace bound as BENCH.' }, 500, cors);
    }

    let body = null;
    if (request.method === 'PUT' || request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Body must be JSON.' }, 400, cors);
      }
    }

    const presented = bearer(request) || (body && body.token) || '';
    if (!(await timingSafeEqual(presented, env.SYNC_PASSPHRASE))) {
      return json({ error: 'Bad passphrase.' }, 401, cors);
    }

    const current = (await env.BENCH.get(DOC_KEY, 'json')) || { rev: 0, updatedAt: 0, state: null };

    if (request.method === 'GET') return json(current, 200, cors);

    if (request.method === 'PUT' || request.method === 'POST') {
      if (!body || typeof body.state !== 'object' || body.state === null) {
        return json({ error: 'Expected { baseRev, state }.' }, 400, cors);
      }
      // Stale base means the other device wrote first — hand back the current
      // document so the client can merge rather than clobber.
      if (Number(body.baseRev) !== Number(current.rev)) {
        return json(current, 409, cors);
      }
      const next = { rev: Number(current.rev) + 1, updatedAt: Date.now(), state: body.state };
      await env.BENCH.put(DOC_KEY, JSON.stringify(next));
      return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, cors);
    }

    return json({ error: 'Use GET or PUT.' }, 405, cors);
  },
};

function bearer(request) {
  const raw = request.headers.get('Authorization') || '';
  return raw.startsWith('Bearer ') ? raw.slice(7) : '';
}

function corsHeaders(origin, env) {
  const headers = {
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  // Same-origin deployments (a Worker route on your own domain) send no Origin
  // and need none of this. Cross-origin ones must name the allowed site.
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/* Compare via SHA-256 digests so neither the passphrase's length nor its
   leading characters leak through response timing. */
async function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
