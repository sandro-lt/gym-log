/* Cloud account + Supabase adapter for the sync engine (sync.js).
 * Sign-in with a one-time code sent by email (no link: on iOS a link would open Safari,
 * not the home-screen app). Plain fetch against Supabase's REST endpoints, no library.
 * Schema and access rules: supabase.sql. */
const Cloud = (() => {
  const URL_ = 'https://vdgeuxkgsonfukhmhphi.supabase.co';
  const KEY = 'sb_publishable_5uAClQdAMLVEYt6Xw3M8fw_0gBj1_dL'; // public by design; access is limited by RLS
  const AUTH = 'gymlog.auth';
  let session = JSON.parse(localStorage.getItem(AUTH) || 'null'); // { access_token, refresh_token, expires_at, user: { id, email } }

  const keepSession = (s) => {
    session = s && { access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } };
    if (session) localStorage.setItem(AUTH, JSON.stringify(session)); else localStorage.removeItem(AUTH);
  };

  async function call(path, { method = 'POST', body, token, headers = {} } = {}) {
    const res = await fetch(URL_ + path, {
      method,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(json?.msg || json?.message || json?.error_description || json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  /** Valid access token, refreshed shortly before it expires. */
  async function token() {
    if (!session) throw new Error('Not signed in');
    if (session.expires_at - 60 < Date.now() / 1000) {
      try {
        keepSession(await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } }));
      } catch (e) {
        if (e.status === 400 || e.status === 401) { signedOut(); throw new Error('Signed out – please sign in again'); }
        throw e;
      }
    }
    return session.access_token;
  }

  const adapter = {
    async push(out) {
      const items = Object.entries(out).flatMap(([store, list]) =>
        list.map((o) => ({ store, id: o.id, data: o, updated_at: o.updatedAt || '' })));
      for (let i = 0; i < items.length; i += 200) { // batches (exercise photos make records big)
        await call('/rest/v1/rpc/push_records', { body: { items: items.slice(i, i + 200) }, token: await token() });
      }
    },
    async pull(cursor) {
      const records = {};
      let seq = cursor || 0;
      for (;;) {
        const rows = await call(`/rest/v1/records?select=store,data,seq&seq=gt.${seq}&order=seq.asc&limit=500`, { method: 'GET', token: await token() });
        for (const r of rows) (records[r.store] ??= []).push(r.data);
        if (rows.length) seq = rows[rows.length - 1].seq;
        if (rows.length < 500) break;
      }
      return { records, cursor: seq };
    },
  };

  function signedOut() {
    keepSession(null);
    Sync.disconnect();
    render();
  }

  return {
    get user() { return session?.user || null; },
    /** Connect the sync engine if signed in (called once the local data is loaded). */
    start() { if (session) Sync.connect(adapter); },
    /** Step 1: email a one-time code (creates the account on first use). */
    sendCode: (email) => call('/auth/v1/otp', { body: { email, create_user: true } }),
    /** Step 2: check the code; on success sync starts (first time: uploads everything on this device). */
    async verify(email, code) {
      const s = await call('/auth/v1/verify', { body: { type: 'email', email, token: code } });
      Sync.account(s.user.id);
      keepSession(s);
      return Sync.connect(adapter);
    },
    async signOut() {
      try { await call('/auth/v1/logout', { token: session?.access_token }); } catch { /* signed out locally anyway */ }
      signedOut();
    },
  };
})();
