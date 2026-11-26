/* Settings tab: menu, exercise catalogue (own exercises + unused library entries, grouped by
 * primary muscle), backup. Loaded after app.js, library.js, plans.js, charts.js. */

ui.settingsPage = null; // null | 'exercises'
ui.exQuery = '';

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
    <h2 class="section">Data</h2>
    <div class="card data">
      <p class="sub">All data stays on this device only. Make a backup now and then – e.g. save it to iCloud Drive.</p>
      <div class="row">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn">Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </div>
    <p class="version">Gym Log v${APP_VERSION}</p>`;
}

function viewExerciseCatalogue() {
  return `
    <header class="top nav"><button class="btn text back" data-action="settings-page" data-page="">${ICON.left}Settings</button></header>
    <header class="top"><h1>Exercises</h1></header>
    <div class="addrow ex-search">
      <input class="search" type="search" placeholder="Search name, equipment, muscle" value="${esc(ui.exQuery)}" data-input="ex-query" autocomplete="off" enterkeyhint="search">
      <button class="btn primary add-ex" data-action="ex-new" aria-label="New exercise">+</button>
    </div>
    <p class="hint ex-hint">Tap for history · hold to edit or delete</p>
    <div id="ex-list">${exerciseListHtml()}</div>`;
}

function exerciseListHtml() {
  const items = librarySearch(exerciseCatalogue(), ui.exQuery.trim());
  if (!items.length) return `<p class="empty">Nothing found.${ui.exQuery.trim() ? ' Tap + to create it.' : ''}</p>`;
  const groups = [...Object.keys(MUSCLES), null].map((m) => [m, items.filter((i) => (i.primaryMuscle || null) === m)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))]).filter(([, list]) => list.length);
  return groups.map(([m, list]) => `
    <h2 class="section">${m ? MUSCLES[m] : 'No primary muscle'} <small>${list.length}</small></h2>
    <ul class="card list ex-list">${list.map((i) => {
      const last = i.kind === 'own' ? lastPerformance(i.id) : null;
      const sec = i.secondaryMuscles.map((x) => MUSCLES[x]).join(', ');
      const sub = [sec && `+ ${sec}`, i.metric === 'duration' && 'Duration'].filter(Boolean).join(' · ');
      return `<li data-exrow data-kind="${i.kind}" data-id="${i.id}">
        ${thumb(i.ex)}
        <div class="grow"><b>${esc(i.name)}</b>
          ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
          ${last ? `<span class="sub">Last (${fmtDate(last.workout.startedAt)}) ${last.sets.map(fmtSet).join(' · ')}</span>` : ''}</div>
        <span class="chev">${ICON.right}</span>
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
  closeSheet();
  render();
  toast(`${item.name} deleted`);
}

function openExerciseMenu(kind, id) {
  ui.sheetMode = 'ex-menu';
  ui.sheetEx = { kind, id };
  $('#sheet').classList.add('open');
  renderSheet();
}

function renderExerciseMenu() {
  const item = catalogueItem(ui.sheetEx.kind, ui.sheetEx.id);
  if (!item) return closeSheet();
  $('#sheet .body').innerHTML = `
    <div class="sheet-head"><h2 class="ex-menu-title">${thumb(item.ex, 'sm')}<span>${esc(item.name)}</span></h2>
      <button class="btn text" data-action="close-sheet">Done</button></div>
    <div class="menu">
      <button data-action="ex-edit">${ICON.note}<span>Edit</span></button>
      <button class="danger" data-action="ex-delete">${ICON.trash}<span>Delete</span></button>
    </div>`;
}

// ---------- Exercise history: every logged session of one exercise ----------
function openExerciseHistory(kind, id) {
  ui.exHist = { kind, id };
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
  const item = ui.exHist && catalogueItem(ui.exHist.kind, ui.exHist.id);
  if (!item) return closeExerciseHistory();
  const ex = item.ex, isDur = metricOf(ex) === 'duration';
  const sessions = item.kind === 'own' ? exerciseSessions(item.id) : [];
  const all = sessions.flatMap((x) => x.sets);
  let stats = '';
  if (sessions.length) {
    const best = isDur ? null : Strength.best(all);
    const heaviest = isDur ? null : Math.max(...all.map((s) => s.weight ?? 0));
    const longest = isDur ? Math.max(...all.map((s) => s.durationSec ?? 0)) : null;
    stats = `<div class="stats three">
      <div><span class="num">${sessions.length}</span><span class="lbl">${sessions.length === 1 ? 'session' : 'sessions'}</span></div>
      ${isDur
        ? `<div><span class="num">${fmtSecs(longest)}</span><span class="lbl">longest set</span></div>
           <div><span class="num">${all.length}</span><span class="lbl">sets</span></div>`
        : `<div><span class="num">${best ? fmtKg(Math.round(best.tenRM * 10) / 10) : '–'}</span><span class="lbl">best e10RM kg</span></div>
           <div><span class="num">${fmtKg(heaviest)}</span><span class="lbl">heaviest kg</span></div>`}
    </div>`;
  }
  $('#exhist .body').innerHTML = `
    <header class="ed-head">
      <button class="btn text back" data-action="exh-close">${ICON.left}Exercises</button><b></b><span></span>
    </header>
    <div class="exh-title">${thumb(ex)}<div><h1>${esc(item.name)}</h1>
      ${ex.primaryMuscle ? `<span class="sub">${esc(musclesText(ex))}</span>` : ''}</div></div>
    ${stats}
    ${sessions.length ? sessions.map(({ w, we, sets }) => {
      const t = trendOf(w, we);
      return `
      <article class="card exh-card" data-action="exh-open-workout" data-wid="${w.id}">
        <div class="entry-head">
          <div><h3>${fmtWhen(w)}</h3><span class="sub">${esc(workoutTitle(w))}</span></div>
          ${t ? `<span class="trend ${t.dir}" title="${t.title}" aria-label="${t.title}">${ICON[TREND_ICON[t.dir]]}</span>` : ''}
        </div>
        ${we.note?.trim() ? `<div class="note"><p>${esc(we.note.trim())}</p></div>` : ''}
        <ol class="setlist">${sets.map((s, i) => `
          <li class="${t?.set === s ? 'top' : ''}"><span class="n">${i + 1}</span><span>${s.durationSec != null ? fmtSecs(s.durationSec) : `${fmtKg(s.weight)} kg × ${s.reps}`}</span>
            ${t?.set === s ? `<span class="top-e ${t.dir}"><b>${t.label} ${t.value}</b><small>${t.delta}</small></span>` : ''}</li>`).join('')}
        </ol>
      </article>`;
    }).join('') : '<p class="empty">Not trained yet. Sessions show up here once you log this exercise in a workout.</p>'}`;
}

// ---------- Long press on a list row ----------
let press = null;
const LONG_PRESS_MS = 450;
function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press.row.classList.remove('pressing');
  if (!press.fired) press = null;
}
document.addEventListener('pointerdown', (e) => {
  const row = e.target.closest('[data-exrow]');
  if (!row || e.button > 0) return;
  press = { row, x: e.clientX, y: e.clientY, fired: false };
  row.classList.add('pressing');
  press.timer = setTimeout(() => {
    press.fired = true;
    row.classList.remove('pressing');
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10); // Android only; iOS has no vibration API
    openExerciseMenu(row.dataset.kind, row.dataset.id);
  }, LONG_PRESS_MS);
});
document.addEventListener('pointermove', (e) => {
  if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress();
});
document.addEventListener('pointerup', cancelPress);
document.addEventListener('pointercancel', cancelPress);
document.addEventListener('contextmenu', (e) => {
  const row = e.target.closest('[data-exrow]');
  if (!row) return;
  e.preventDefault();
  if (!press?.fired) openExerciseMenu(row.dataset.kind, row.dataset.id); // right click / other platforms
});

// ---------- Events ----------
document.addEventListener('click', (e) => {
  // the click that ends a long press must not also open the editor
  if (press?.fired) { press = null; e.preventDefault(); e.stopImmediatePropagation(); return; }
  press = null;
  const tab = e.target.closest('.tabbar button');
  if (tab?.dataset.tab === 'settings' && ui.tab === 'settings') ui.settingsPage = null; // tap again -> back to the menu
  const row = e.target.closest('[data-exrow]');
  if (row) { openExerciseHistory(row.dataset.kind, row.dataset.id); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'settings-page': ui.settingsPage = el.dataset.page || null; ui.exQuery = ''; render(); window.scrollTo(0, 0); break;
    case 'ex-new': openEditor(null, { name: ui.exQuery }); break;
    case 'ex-edit': closeSheet(); editCatalogueItem(ui.sheetEx.kind, ui.sheetEx.id); break;
    case 'ex-delete': deleteCatalogueItem(ui.sheetEx.kind, ui.sheetEx.id); break;
    case 'exh-close': closeExerciseHistory(); break;
    case 'exh-open-workout': openDetail(el.dataset.wid); break;
  }
}, true);

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'ex-query') { ui.exQuery = e.target.value; rerenderExerciseList(); }
});
