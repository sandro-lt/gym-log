/* Sync engine – offline first.
 *
 * The app always reads and writes the local IndexedDB copy, so it works without a network.
 * A remote backend (Supabase, later) is plugged in with Sync.connect(adapter):
 *   adapter.push({ store: [records] })      upsert changed records (server keeps the newer updatedAt)
 *   adapter.pull(cursor) -> { records: { store: [records] }, cursor }   records changed on the server since cursor
 * Without a remote nothing leaves the device.
 *
 * What to push needs no outbox: every save() sets updatedAt on this device, so all records with
 * updatedAt newer than the last push (same clock) are the pending changes. Merging is per record:
 * the newer updatedAt wins; deletions are soft deletes (deletedAt), so they merge the same way. */
const Sync = (() => {
  const KEY = 'gymlog.sync';
  const state = { lastPushAt: null, cursor: null, lastSyncAt: null, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  const keep = () => localStorage.setItem(KEY, JSON.stringify(state));
  let loaded = false, remote = null, running = null, timer = null, status = 'local', error = null, persisted = null, renderLater = false;

  /** Records changed on this device since the last successful push, by store. */
  function pending() {
    const out = {};
    for (const s of DB.STORES) {
      const list = [...data[s].values()].filter((o) => !state.lastPushAt || (o.updatedAt || '') > state.lastPushAt);
      if (list.length) out[s] = list;
    }
    return out;
  }
  const pendingCount = () => Object.values(pending()).reduce((n, l) => n + l.length, 0);

  /** Merge records from elsewhere (server or backup file): per record the newer updatedAt wins.
   *  Returns the number of records written. */
  async function merge(payload) {
    let n = 0;
    for (const s of DB.STORES) {
      const list = (payload?.[s] || []).filter((o) => {
        if (!o || !o.id) return false;
        const cur = data[s].get(o.id);
        return !cur || (o.updatedAt || '') > (cur.updatedAt || '');
      });
      if (!list.length) continue;
      await DB.putMany(s, list);
      for (const o of list) data[s].set(o.id, o);
      n += list.length;
    }
    return n;
  }

  /** Re-render after a merge, but never while the user is typing in a field. */
  function refresh() {
    if (document.activeElement?.matches('input, textarea')) renderLater = true;
    else render();
  }
  document.addEventListener('focusout', () => { if (renderLater) { renderLater = false; setTimeout(() => { if (!document.activeElement?.matches('input, textarea')) render(); else renderLater = true; }, 0); } });

  function notify() {
    const el = document.getElementById('sync-status');
    if (el) el.innerHTML = statusHtml();
  }

  /** Push local changes, then pull newer records from the server. */
  function run() {
    if (!loaded || !remote || !navigator.onLine) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      status = 'syncing'; error = null; notify();
      try {
        const started = new Date().toISOString();
        const out = pending();
        if (Object.keys(out).length) await remote.push(out);
        state.lastPushAt = started; // changes saved during the push are newer and go next time
        const { records, cursor } = await remote.pull(state.cursor);
        const n = await merge(records);
        Object.assign(state, { cursor, lastSyncAt: new Date().toISOString() });
        keep();
        status = 'ok';
        if (n) refresh();
      } catch (e) {
        status = 'error'; error = e.message || String(e);
      } finally {
        running = null; notify();
      }
    })();
    return running;
  }

  /** Called by save(): sync a few seconds after the last change. */
  function changed() {
    if (!remote) return;
    clearTimeout(timer);
    timer = setTimeout(run, 4000);
  }

  function statusHtml() {
    const store = persisted ? 'Storage is protected – iOS won’t clear it.' : 'iOS may clear storage when the iPhone runs low on space.';
    if (!remote) return `<b>Saved on this device only</b> · works offline. ${store}`;
    const when = state.lastSyncAt ? `last synced ${fmtTime(state.lastSyncAt)}` : 'not synced yet';
    const n = pendingCount();
    const line = status === 'syncing' ? 'Syncing…'
      : status === 'error' ? `Sync failed: ${esc(error)}`
      : !navigator.onLine ? `Offline – ${n ? plural(n, 'change', 'changes') + ' waiting' : 'all changes synced'}`
      : n ? `${plural(n, 'change', 'changes')} waiting · ${when}` : `All synced · ${when}`;
    return `<b>${line}</b><br>${store}`;
  }

  // Ask the browser to keep our storage (no prompt in Safari; granted for home-screen apps).
  (async () => {
    try { persisted = await navigator.storage?.persisted?.() || await navigator.storage?.persist?.() || false; } catch { persisted = false; }
    notify();
  })();
  window.addEventListener('online', () => { notify(); run(); });
  window.addEventListener('offline', notify);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });

  return {
    merge, run, changed, pendingCount, statusHtml,
    /** Local data is in memory: syncing may start. */
    loaded() { loaded = true; },
    /** Signed in as userId: a new account starts with a full upload and a full download. */
    account(userId) {
      if (state.userId !== userId) Object.assign(state, { userId, lastPushAt: null, cursor: null, lastSyncAt: null });
      keep();
    },
    /** Plug in a remote backend and sync right away. */
    connect(adapter) { remote = adapter; status = 'idle'; notify(); return run(); },
    disconnect() { remote = null; status = 'local'; notify(); },
    /** After a backup import, push everything again (imported records keep their old timestamps). */
    resetPush() { state.lastPushAt = null; keep(); changed(); },
    get state() { return { ...state, status, error, persisted, connected: !!remote }; },
  };
})();
