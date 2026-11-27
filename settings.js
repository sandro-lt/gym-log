/* Settings tab: menu, exercise catalogue (own exercises + unused library entries, grouped by
 * primary muscle), backup. Loaded after app.js, library.js, plans.js, charts.js. */

ui.settingsPage = null; // null | 'exercises'
ui.exHist = null; // { kind: 'own'|'lib', id } – exercise whose history is open
ui.exQuery = '';
ui.auth = { step: 'email', email: '', busy: false, error: '' }; // sign-in form (cloud.js)

const ICON_DUMBBELL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';

/** One list for own exercises and library entries that aren't used yet. */
function exerciseCatalogue() {
  const own = live('exercises').map((e) => ({ kind: 'own', id: e.id, name: e.name, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles || [], metric: metricOf(e), ex: e }));
  const lib = libraryAvailable().map((l) => ({ kind: 'lib', ...l, ex: l }));
  return [...own, ...lib];
}

function viewSettings() {
  if (ui.settingsPage === 'exercises') return viewExerciseCatalogue();
  return `
    <header class="top"><h1>Settings</h1></header>
    <div class="menu settings-menu">
      <button data-action="settings-page" data-page="exercises">${ICON_DUMBBELL}<span>Exercises</span>
        <small>${exerciseCatalogue().length}</small><span class="chev">${ICON.right}</span></button>
    </div>
    <h2 class="section">Rest timer sound</h2>
    <div class="seg three">${SOUND_MODES.map(([id, label]) => `<button class="${soundMode === id ? 'on' : ''}" data-action="sound-mode" data-mode="${id}">${label}</button>`).join('')}</div>
    <p class="hint">${soundMode === 'loud' ? 'Plays with the silent switch on – but pauses your music.' : soundMode === 'normal' ? 'Plays over your music, but not when the iPhone is on silent.' : 'No sound – the timer only lights up.'} Tap to test.</p>
    <h2 class="section">Account &amp; sync</h2>
    <div class="card data">
      ${accountHtml()}
      <p class="sub" id="sync-status">${Sync.statusHtml()}</p>
    </div>
    <h2 class="section">Backup file</h2>
    <div class="card data">
      <p class="sub">A copy of all data as a file, e.g. for iCloud Drive. Importing merges: newer entries win.</p>
      <div class="row">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn">Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </div>
    <h2 class="section">Danger zone</h2>
    <div class="card data">
      <p class="sub">Deletes all workouts, exercises, plans and charts${Cloud.user ? ' – on this device, in your cloud account and on your other signed-in devices' : ' on this device'}. Settings like the timer sound stay.</p>
      <div class="row"><button class="btn danger" data-action="wipe-all">Wipe all data</button></div>
    </div>
    <p class="version">Gym Log v${APP_VERSION}</p>
    <p class="version diag">${screenInfo()}</p>`;
}

/** Signed in: account + sync buttons. Otherwise: sign-in with an emailed one-time code. */
function accountHtml() {
  const a = ui.auth, err = a.error ? `<p class="auth-err">${esc(a.error)}</p>` : '';
  if (Cloud.user) return `
    <p class="acct">Signed in as <b>${esc(Cloud.user.email)}</b></p>
    <div class="row acct-row">
      <button class="btn" data-action="sync-now">Sync now</button>
      <button class="btn" data-action="sign-out">Sign out</button>
    </div>`;
  if (a.step === 'code') return `
    <p class="acct">Enter the code we sent to <b>${esc(a.email)}</b>.</p>
    <form class="auth-row" data-form="auth-code">
      <input id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Code" enterkeyhint="go" required>
      <button class="btn primary" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Checking…' : 'Sign in'}</button>
    </form>${err}
    <button class="btn text small" data-action="auth-back">Use another email</button>`;
  return `
    <p class="acct">Sign in to back up your training and sync it automatically.</p>
    <form class="auth-row" data-form="auth-email">
      <input id="auth-email" type="email" autocomplete="email" placeholder="Email" value="${esc(a.email)}" enterkeyhint="send" required>
      <button class="btn primary" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Sending…' : 'Send code'}</button>
    </form>${err}`;
}

async function wipeAllData() {
  const where = Cloud.user ? 'on this device AND in your cloud account (all your devices)' : 'on this device';
  const answer = prompt(`This deletes all your training data ${where}. It can't be undone – export a backup first if you're unsure.\n\nType DELETE to confirm.`);
  if (answer?.trim().toUpperCase() !== 'DELETE') { if (answer != null) toast('Nothing deleted'); return; }
  stopRest(); // rest.js
  await Sync.wipeAll();
  closeSheet();
  ui.tab = 'training'; ui.settingsPage = null;
  render();
  const st = Sync.state;
  toast(!st.connected ? 'All data deleted' : st.status === 'ok' ? 'All data deleted – also in the cloud' : 'Deleted here – the cloud follows on the next sync');
}

async function authStep(fn) {
  ui.auth.busy = true; ui.auth.error = ''; render();
  try { await fn(); } catch (e) {
    const m = e.message || String(e);
    ui.auth.error = /expired or is invalid/i.test(m) ? 'Wrong or expired code.' : /rate limit/i.test(m) ? 'Too many emails – try again in a while.' : m;
  }
  ui.auth.busy = false; render();
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form^="auth-"]');
  if (!form) return;
  e.preventDefault();
  const a = ui.auth;
  if (form.dataset.form === 'auth-email') {
    const email = $('#auth-email').value.trim().toLowerCase();
    authStep(async () => { await Cloud.sendCode(email); Object.assign(a, { email, step: 'code' }); });
  } else {
    const code = $('#auth-code').value.replace(/\s/g, '');
    authStep(async () => {
      await Cloud.verify(a.email, code);
      Object.assign(a, { step: 'email', email: '' });
      toast('Signed in – syncing');
    });
  }
});

function viewExerciseCatalogue() {
  return `
    <header class="top nav"><button class="btn text back" data-action="settings-page" data-page="">${ICON.left}Settings</button></header>
    <header class="top"><h1>Exercises</h1></header>
    <div class="addrow ex-search">
      <input class="search" type="search" placeholder="Search name, equipment, muscle" value="${esc(ui.exQuery)}" data-input="ex-query" autocomplete="off" enterkeyhint="search">
      <button class="btn primary add-ex" data-action="ex-new" aria-label="New exercise">+</button>
    </div>
    <div id="ex-list">${exerciseListHtml()}</div>`;
}

/** The 10 most trained exercises (sessions without deloads), most first: [{ id, n }] */
function favoriteExercises(limit = 10) {
  const count = new Map(), recent = new Map();
  for (const we of live('workoutExercises')) {
    const w = data.workouts.get(we.workoutId);
    if (!w || w.deletedAt || !w.endedAt || w.skipped || w.deload) continue;
    if (!setsOf(we.id).some((s) => s.done)) continue;
    const ex = data.exercises.get(we.exerciseId);
    if (!ex || ex.deletedAt) continue;
    count.set(ex.id, (count.get(ex.id) || 0) + 1);
    if ((recent.get(ex.id) || '') < w.startedAt) recent.set(ex.id, w.startedAt);
  }
  return [...count].map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n || recent.get(b.id).localeCompare(recent.get(a.id))).slice(0, limit);
}

function exerciseListHtml() {
  const q = ui.exQuery.trim();
  const all = exerciseCatalogue();
  const items = librarySearch(all, q);
  if (!items.length) return `<p class="empty">Nothing found.${q ? ' Tap + to create it.' : ''}</p>`;
  const groups = [...Object.keys(MUSCLES), null].map((m) => [m, items.filter((i) => (i.primaryMuscle || null) === m)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))]).filter(([, list]) => list.length);
  // favourites on top (only without a search – while searching the hits are what counts)
  if (!q) {
    const byId = new Map(all.filter((i) => i.kind === 'own').map((i) => [i.id, i]));
    const fav = favoriteExercises().map((f) => byId.get(f.id) && { ...byId.get(f.id), times: f.n }).filter(Boolean);
    if (fav.length) groups.unshift(['fav', fav]);
  }
  return groups.map(([m, list]) => `
    <h2 class="section">${m === 'fav' ? 'Favorites' : m ? MUSCLES[m] : 'No primary muscle'} <small>${m === 'fav' ? 'most trained' : list.length}</small></h2>
    <ul class="card list ex-list ${m === 'fav' ? 'fav' : ''}">${list.map((i, k) => {
      const last = i.kind === 'own' ? lastPerformance(i.id) : null;
      const sec = i.secondaryMuscles.map((x) => MUSCLES[x]).join(', ');
      const sub = [sec && `+ ${sec}`, i.metric === 'duration' && 'Duration'].filter(Boolean).join(' · ');
      return `<li data-exrow data-kind="${i.kind}" data-id="${i.id}">
        ${m === 'fav' ? `<span class="fav-rank">${k + 1}</span>` : ''}${thumb(i.ex)}
        <div class="grow"><b>${esc(i.name)}</b>
          ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
          ${last ? `<span class="sub">Last (${fmtDate(last.workout.startedAt)}) ${last.sets.map(fmtSet).join(' · ')}</span>` : ''}</div>
        ${i.times ? `<span class="fav-n">${i.times}×</span>` : ''}<span class="chev">${ICON.right}</span>
      </li>`;
    }).join('')}</ul>`).join('');
}
const rerenderExerciseList = () => { const el = $('#ex-list'); if (el) el.innerHTML = exerciseListHtml(); };

function catalogueItem(kind, id) {
  if (kind === 'own') { const e = data.exercises.get(id); return e && { kind, id, name: e.name, ex: e }; }
  const l = LIBRARY.find((x) => x.id === id);
  return l && { kind, id, name: l.name, ex: l };
}

function editCatalogueItem(kind, id) {
  if (kind === 'own') return openEditor(data.exercises.get(id));
  // library entry: prefill the editor; it only becomes an own exercise when saved
  const l = LIBRARY.find((x) => x.id === id);
  openEditor({ ...l, id: null, libraryId: l.id, image: null });
}

function deleteCatalogueItem(kind, id) {
  const item = catalogueItem(kind, id);
  const used = kind === 'own' && live('workoutExercises').some((we) => we.exerciseId === id);
  if (!confirm(`Delete “${item.name}”?${used ? ' Past workouts stay in your history.' : ''}`)) return;
  // a library entry is hidden by a deleted copy, so it stays gone (and syncs later)
  softDelete('exercises', kind === 'own' ? item.ex : exerciseFromLibrary(id));
  closeEditor();
  closeExerciseHistory();
  render();
  toast(`${item.name} deleted`);
}

// ---------- Exercise history: every logged session of one exercise ----------
function openExerciseHistory(kind, id) {
  ui.exHist = { kind, id };
  raiseOverlay('#exhist'); // app.js
  $('#exhist').classList.add('open');
  renderExerciseHistory();
  $('#exhist .body').scrollTop = 0;
}
function closeExerciseHistory() { $('#exhist').classList.remove('open'); ui.exHist = null; }

/** Logged sessions of an exercise, newest first: [{ w, we, sets }] */
function exerciseSessions(exId) {
  return live('workoutExercises').filter((we) => we.exerciseId === exId).map((we) => ({ we, w: data.workouts.get(we.workoutId) }))
    .filter(({ w }) => w && !w.deletedAt && w.endedAt && !w.skipped)
    .map((x) => ({ ...x, sets: setsOf(x.we.id).filter((s) => s.done) })).filter((x) => x.sets.length)
    .sort((a, b) => b.w.startedAt.localeCompare(a.w.startedAt));
}

function renderExerciseHistory() {
  if (ui.exHist?.kind === 'lib') { // saved from the editor -> it is an own exercise now
    const own = live('exercises').find((e) => e.libraryId === ui.exHist.id);
    if (own) ui.exHist = { kind: 'own', id: own.id };
  }
  const item = ui.exHist && catalogueItem(ui.exHist.kind, ui.exHist.id);
  if (!item) return closeExerciseHistory();
  const ex = item.ex;
  const sessions = item.kind === 'own' ? exerciseSessions(item.id) : [];
  const counted = sessions.filter((x) => !x.w.deload); // deloads are listed, but not counted
  const all = counted.flatMap((x) => x.sets);
  const records = item.kind === 'own' && sessions.length ? exerciseRecords(ex) : []; // records.js
  const recordSet = records.find((r) => r.setId)?.setId;
  // overview only – the bests are in "Personal records" below
  const first = counted.length ? counted[counted.length - 1].w.startedAt : null;
  const stats = counted.length ? `<div class="stats three">
      <div><span class="num">${counted.length}</span><span class="lbl">${counted.length === 1 ? 'session' : 'sessions'}</span></div>
      <div><span class="num">${all.length}</span><span class="lbl">sets</span></div>
      <div><span class="num">${fmtDate(first)}</span><span class="lbl">since</span></div>
    </div>` : '';
  $('#exhist .body').innerHTML = `
    <header class="ed-head">
      <button class="btn text back" data-action="exh-close">${ICON.left}Exercises</button><b></b>
      <button class="btn text strong" data-action="exh-edit">Edit</button>
    </header>
    <div class="exh-title">${thumb(ex)}<div><h1>${esc(item.name)}</h1>
      ${ex.primaryMuscle ? `<span class="sub">${esc(musclesText(ex))}</span>` : ''}</div></div>
    ${stats}
    ${records.length ? `<h2 class="section">Personal records</h2>
      <div class="records">${records.map((r) => `
        <div class="rec ${r.main ? 'main' : ''}">${r.main ? `<span class="trophy">${ICON_TROPHY}</span>` : ''}<small>${r.label}</small><b>${r.value}</b><span class="sub">${esc(r.detail)}</span></div>`).join('')}
      </div><h2 class="section">Sessions</h2>` : ''}
    ${sessions.length ? sessions.map(({ w, we, sets }) => {
      const t = trendOf(w, we);
      return `
      <article class="card exh-card" data-action="exh-open-workout" data-wid="${w.id}">
        <div class="entry-head">
          <div><h3>${fmtWhen(w)}</h3><span class="sub">${esc(workoutTitle(w))}</span></div>
          ${w.deload ? '<span class="trend deload" title="Deload – not compared">zZZ</span>' : t ? `<span class="trend ${t.dir}" title="${t.title}" aria-label="${t.title}">${ICON[TREND_ICON[t.dir]]}</span>` : ''}
        </div>
        ${we.note?.trim() ? `<div class="note"><p>${esc(we.note.trim())}</p></div>` : ''}
        <ol class="setlist">${sets.map((s, i) => `
          <li class="${t?.set === s ? 'top' : ''} ${s.id === recordSet ? 'pr' : ''}"><span class="n" ${s.id === recordSet ? 'title="All-time best"' : ''}>${s.id === recordSet ? ICON_TROPHY : i + 1}</span><span>${s.durationSec != null ? fmtSecs(s.durationSec) : `${fmtKg(s.weight)} kg × ${s.reps}`}</span>
            ${t?.set === s ? `<span class="top-e ${t.dir}"><b>${t.label} ${t.value}</b><small>${t.delta}</small></span>` : ''}</li>`).join('')}
        </ol>
      </article>`;
    }).join('') : '<p class="empty">Not trained yet. Sessions show up here once you log this exercise in a workout.</p>'}`;
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tabbar button');
  if (tab?.dataset.tab === 'settings' && ui.tab === 'settings') ui.settingsPage = null; // tap again -> back to the menu
  const row = e.target.closest('[data-exrow]');
  if (row) { openExerciseHistory(row.dataset.kind, row.dataset.id); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'settings-page': ui.settingsPage = el.dataset.page || null; ui.exQuery = ''; render(); scrollToTop(); break;
    case 'ex-new': openEditor(null, { name: ui.exQuery }); break;
    case 'auth-back': Object.assign(ui.auth, { step: 'email', error: '' }); render(); break;
    case 'sync-now': Sync.run(); break;
    case 'wipe-all': wipeAllData(); break;
    case 'sign-out':
      if (confirm('Sign out? Your data stays on this device, but stops syncing.')) Cloud.signOut();
      break;
    case 'exh-edit': editCatalogueItem(ui.exHist.kind, ui.exHist.id); break;
    case 'exh-close': closeExerciseHistory(); break;
    case 'exh-open-workout': openDetail(el.dataset.wid); break;
  }
}, true);

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'ex-query') { ui.exQuery = e.target.value; rerenderExerciseList(); }
});
