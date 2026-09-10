/* Bench sync — keeps one dataset in step across devices via a small
   Cloudflare Worker backed by KV. Loaded after app.js.

   Shape of the conversation with the server:
     GET  <url>  -> { rev, updatedAt, state }
     PUT  <url>  <- { baseRev, state }   -> { rev }  |  409 { rev, state }

   The revision number is the whole concurrency story. A push carries the
   revision it was based on; if the server has moved on, it answers 409 with
   the current document instead of accepting a write that would erase whatever
   the other device just did. We merge the two and push again. */
'use strict';

(function () {
  const CFG_KEY = 'bench.sync.config.v1';
  const META_KEY = 'bench.sync.meta.v1';
  const PUSH_DEBOUNCE_MS = 1500;
  const POLL_MS = 45000;
  const RETRY_MS = 15000;
  const MAX_CONFLICT_RETRIES = 3;

  const readJSON = (key, dflt) => {
    try { return JSON.parse(localStorage.getItem(key)) || dflt; } catch { return dflt; }
  };
  const writeJSON = (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
  };

  let cfg = readJSON(CFG_KEY, { url: '', passphrase: '' });
  let meta = readJSON(META_KEY, { rev: 0, lastSyncAt: 0 });
  let dirty = false;
  let inFlight = false;
  let pushTimer = null;
  let retryTimer = null;

  const S = {
    status: 'off',   // off | syncing | synced | offline | auth | error
    message: '',
    lastSyncAt: meta.lastSyncAt,
  };

  function setStatus(status, message = '') {
    S.status = status;
    S.message = message;
    S.lastSyncAt = meta.lastSyncAt;
    if (typeof window.renderSyncStatus === 'function') window.renderSyncStatus();
  }

  const configured = () => !!(cfg.url && cfg.passphrase);

  async function call(method, body) {
    const res = await fetch(cfg.url, {
      method,
      headers: {
        'Authorization': `Bearer ${cfg.passphrase}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    let payload = null;
    try { payload = await res.json(); } catch { /* empty body */ }
    return { ok: res.ok, code: res.status, payload };
  }

  /* Fold the server's document into ours. Returns true when the result still
     holds something the server has not seen, i.e. we owe it a push. */
  function absorb(remoteState, remoteRev) {
    const merged = window.Bench.merge(remoteState);
    meta.rev = remoteRev;
    writeJSON(META_KEY, meta);
    return JSON.stringify(merged) !== JSON.stringify(window.Bench.normalize(remoteState));
  }

  async function pull({ quiet = false } = {}) {
    if (!configured() || inFlight) return;
    inFlight = true;
    if (!quiet) setStatus('syncing');
    try {
      const { ok, code, payload } = await call('GET');
      if (code === 401) { setStatus('auth', 'Passphrase rejected.'); return; }
      if (!ok) { setStatus('error', `Server said ${code}.`); return; }
      if (payload && payload.state) {
        if (payload.rev !== meta.rev && absorb(payload.state, payload.rev)) dirty = true;
        else meta.rev = payload.rev;
      }
      meta.lastSyncAt = Date.now();
      writeJSON(META_KEY, meta);
      setStatus('synced');
    } catch (err) {
      setStatus(navigator.onLine ? 'error' : 'offline', err.message);
      scheduleRetry();
    } finally {
      inFlight = false;
      if (dirty) schedulePush(0);
    }
  }

  async function push(attempt = 0) {
    if (!configured() || inFlight) return;
    if (!navigator.onLine) { setStatus('offline'); scheduleRetry(); return; }
    inFlight = true;
    setStatus('syncing');
    try {
      const { ok, code, payload } = await call('PUT', {
        baseRev: meta.rev,
        state: window.Bench.getState(),
      });

      if (code === 401) { setStatus('auth', 'Passphrase rejected.'); return; }

      if (code === 409 && payload && payload.state) {
        // Someone else moved first. Merge their copy in, then try again.
        absorb(payload.state, payload.rev);
        inFlight = false;
        if (attempt < MAX_CONFLICT_RETRIES) return push(attempt + 1);
        setStatus('error', 'Could not settle a conflict — will retry.');
        scheduleRetry();
        return;
      }

      if (!ok) { setStatus('error', `Server said ${code}.`); scheduleRetry(); return; }

      meta.rev = payload.rev;
      meta.lastSyncAt = Date.now();
      writeJSON(META_KEY, meta);
      dirty = false;
      setStatus('synced');
    } catch (err) {
      setStatus(navigator.onLine ? 'error' : 'offline', err.message);
      scheduleRetry();
    } finally {
      inFlight = false;
    }
  }

  function schedulePush(delay = PUSH_DEBOUNCE_MS) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(), delay);
  }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (dirty) push(); else pull({ quiet: true }); }, RETRY_MS);
  }

  const API = {
    state: S,
    isConfigured: configured,
    isDirty: () => dirty || inFlight,
    config: () => ({ ...cfg }),
    lastSyncAt: () => meta.lastSyncAt,

    notifyLocalChange() {
      if (!configured()) return;
      dirty = true;
      schedulePush();
    },

    async connect(url, passphrase, mode) {
      cfg = { url: String(url || '').trim().replace(/\/$/, ''), passphrase: String(passphrase || '') };
      if (!configured()) { setStatus('off'); return { ok: false, error: 'Need both a URL and a passphrase.' }; }
      writeJSON(CFG_KEY, cfg);
      meta = { rev: 0, lastSyncAt: 0 };
      writeJSON(META_KEY, meta);
      setStatus('syncing');

      let probe;
      try {
        probe = await call('GET');
      } catch (err) {
        setStatus('error', err.message);
        return { ok: false, error: `Could not reach that URL: ${err.message}` };
      }
      if (probe.code === 401) {
        setStatus('auth');
        return { ok: false, error: 'That passphrase was rejected by the server.' };
      }
      if (!probe.ok) {
        setStatus('error');
        return { ok: false, error: `That URL answered ${probe.code}. Check the Worker is deployed at this path.` };
      }

      const remote = probe.payload && probe.payload.state;
      const remoteHasData = !!(remote && (remote.products || []).length);
      const localHasData = window.Bench.hasData();

      if (remoteHasData && localHasData && !mode) {
        return { ok: false, needsChoice: true, remote: probe.payload };
      }
      if (remoteHasData && mode === 'replace') {
        window.Bench.setState(remote);
        meta.rev = probe.payload.rev;
        meta.lastSyncAt = Date.now();
        writeJSON(META_KEY, meta);
        dirty = false;
        setStatus('synced');
        return { ok: true };
      }
      if (remoteHasData) {
        if (absorb(remote, probe.payload.rev)) dirty = true;
      } else {
        meta.rev = probe.payload ? probe.payload.rev || 0 : 0;
        dirty = true;
      }
      await push();
      return { ok: S.status === 'synced', error: S.message };
    },

    disconnect() {
      cfg = { url: '', passphrase: '' };
      meta = { rev: 0, lastSyncAt: 0 };
      writeJSON(CFG_KEY, cfg);
      writeJSON(META_KEY, meta);
      dirty = false;
      clearTimeout(pushTimer);
      clearTimeout(retryTimer);
      setStatus('off');
    },

    syncNow() { return dirty ? push() : pull(); },
  };

  window.BenchSync = API;

  if (configured()) {
    setStatus('syncing');
    pull();
    setInterval(() => { if (!document.hidden && !dirty) pull({ quiet: true }); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) API.syncNow(); });
    window.addEventListener('online', () => API.syncNow());
    window.addEventListener('offline', () => setStatus('offline'));
    // A pending edit should not be lost to a closed tab.
    window.addEventListener('beforeunload', () => {
      if (!dirty || !navigator.sendBeacon) return;
      const blob = new Blob(
        [JSON.stringify({ baseRev: meta.rev, state: window.Bench.getState(), token: cfg.passphrase })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(`${cfg.url}?beacon=1`, blob);
    });
  }
})();
