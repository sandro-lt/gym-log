/* Gym Log */
const APP_VERSION = '1.15';

// ---------- In-memory data (tiny data set, so everything is loaded) ----------
const data = Object.fromEntries(DB.STORES.map((s) => [s, new Map()]));

async function loadAll() {
  for (const s of DB.STORES) {
    data[s].clear();
    for (const o of await DB.all(s)) data[s].set(o.id, o);
  }
}

function save(store, obj) {
  const now = new Date().toISOString();
  if (!obj.createdAt) obj.createdAt = now;
  obj.updatedAt = now;
  data[store].set(obj.id, obj);
  DB.put(store, obj).catch((e) => toast('Saving failed: ' + e.message));
  return obj;
}

function softDelete(store, obj) {
  obj.deletedAt = new Date().toISOString();
  save(store, obj);
}

const live = (store) => [...data[store].values()].filter((o) => !o.deletedAt);

// ---------- Muscles ----------
// Stable IDs (used for stats and later sync); labels are display only.
const MUSCLE_GROUPS = [
  ['Shoulders & neck', [['traps', 'Traps'], ['front_delts', 'Front delts'], ['side_delts', 'Side delts'], ['rear_delts', 'Rear delts']]],
  ['Torso', [['chest', 'Chest'], ['upper_back', 'Upper back'], ['lats', 'Lats'], ['lower_back', 'Lower back'], ['abs', 'Abs']]],
  ['Arms', [['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Forearms']]],
  ['Legs', [['glutes', 'Glutes'], ['quads', 'Quads'], ['hams', 'Hamstrings'], ['adductors', 'Adductors'], ['abductors', 'Abductors'], ['calves', 'Calves']]],
];
const MUSCLES = Object.fromEntries(MUSCLE_GROUPS.flatMap(([, list]) => list));

// ---------- Metrics ----------
// What a set records. New metrics can be added here (e.g. distance, reps only).
const METRICS = {
  weight_reps: { label: 'Weight × Reps', hint: 'kg · reps', cols: ['kg', 'Reps'] },
  duration: { label: 'Duration', hint: 'min : sec', cols: ['Time'] },
};
const metricOf = (ex) => (ex && METRICS[ex.metric] ? ex.metric : 'weight_reps');

// ---------- Queries ----------
const exercisesSorted = () => live('exercises').sort((a, b) => a.name.localeCompare(b.name, 'en'));
const activeWorkout = () => live('workouts').find((w) => !w.endedAt);
/** Workouts that count for stats and charts (a deload stays in the calendar, but not in the numbers). */
const countedWorkouts = () => finishedWorkouts().filter((w) => !w.deload);
const finishedWorkouts = () => live('workouts').filter((w) => w.endedAt && !w.skipped).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
const entriesOf = (workoutId) => live('workoutExercises').filter((we) => we.workoutId === workoutId).sort((a, b) => a.position - b.position);
const setsOf = (weId) => live('sets').filter((s) => s.workoutExerciseId === weId).sort((a, b) => a.position - b.position);
const exerciseName = (id) => data.exercises.get(id)?.name ?? 'Deleted exercise';
const hasValue = (s) => s && (s.weight != null || s.durationSec != null);

// --- e10RM / e1RM column in the workout (tap the header to switch) ---
const RM_LABEL = { e10: 'e10RM', e1: 'e1RM' };
/** Estimated RM of the values in a set row (grey while only the suggestion is shown). */
function rmCell(metric, s, fallback) {
  if (metric === 'duration') return '<span class="rm"></span>';
  const own = s.weight != null && s.reps != null;
  const w = own ? s.weight : fallback?.weight, r = own ? s.reps : fallback?.reps;
  const v = ui.rmMode === 'e1' ? Strength.oneRepMax(w, r) : Strength.tenRepMax(w, r);
  return `<span class="rm ${own ? '' : 'ph'}">${v != null ? fmtKg(Math.round(v * 10) / 10) : '–'}</span>`;
}
const ZZZ = '<span class="zzz" title="Deload – not counted">zZZ</span>';

/** Most recent finished performance of an exercise (for "Last time").
 *  beforeIso: only workouts that started before this time (used when viewing/editing an old workout). */
function lastPerformance(exerciseId, excludeWorkoutId, beforeIso) {
  let best = null;
  for (const we of live('workoutExercises')) {
    if (we.exerciseId !== exerciseId || we.workoutId === excludeWorkoutId) continue;
    const w = data.workouts.get(we.workoutId);
    if (!w || w.deletedAt || !w.endedAt || w.deload) continue; // a deload is never the basis for the next workout
    if (beforeIso && w.startedAt >= beforeIso) continue;
    const sets = setsOf(we.id).filter((s) => s.done);
    if (!sets.length) continue;
    if (!best || w.startedAt > best.workout.startedAt) best = { workout: w, sets };
  }
  return best;
}

// ---------- Formatting ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKg = (n) => (n == null ? '' : String(Math.round(n * 100) / 100));
const parseNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const pad2 = (n) => String(n).padStart(2, '0');
const fmtSecs = (t) => `${Math.floor(t / 60)}:${pad2(t % 60)}`;
const fmtSet = (s) => (s.durationSec != null ? fmtSecs(s.durationSec) : `${fmtKg(s.weight)}×${s.reps ?? '–'}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtDay = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
function fmtClock(ms) {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s);
}

// ---------- UI state ----------
const ui = {
  rmMode: localStorage.getItem('gymlog.rmMode') === 'e1' ? 'e1' : 'e10', // e-RM column in the workout
  tab: 'training', // training | history (via week strip) | charts | settings
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  calDay: dayKey(new Date()),
  sheetSets: 3,
  sheetQuery: '',
  sheetMode: 'pick', // 'pick' | 'menu' | 'note' | 'swap' | plan-* | chart-*
  sheetWorkout: null, // workout that "Add exercise" adds to
  sheetWe: null, // workout exercise the menu / note belongs to
  noteText: '',
  notePin: false,
  noteWasPinned: false,
  editor: null,
  detail: null,
  detailEdit: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const scrollToTop = () => $('#main').scrollTo(0, 0); // <main> is the scroll container (app shell)

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

const ICON = {
  swap: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M13.5 4.5L17 8l-3.5 3.5M20 16H7M10.5 12.5L7 16l3.5 3.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5.5 12.5L12 19l6.5-6.5"/></svg>',
  minus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};

// ---------- Rendering ----------
function render() {
  const navTab = ui.tab === 'history' ? 'training' : ui.tab; // History is opened from the week strip
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === navTab));
  const el = $('#main');
  if (ui.tab === 'training') el.innerHTML = activeWorkout() ? viewActiveWorkout() : viewStart();
  else if (ui.tab === 'history') el.innerHTML = viewHistory();
  else if (ui.tab === 'charts') el.innerHTML = viewCharts(); // charts.js
  else el.innerHTML = viewSettings(); // settings.js
  if (ui.detail) renderDetail(); // keep the open detail view in sync
  if (ui.plan) renderPlanEditor(); // plans.js
  if (ui.exHist) renderExerciseHistory(); // settings.js
  renderRest(); // rest.js
  tickClock();
}

// --- Week strip (start page) – tap opens History on that day ---
function weekStrip() {
  const t = new Date();
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
  const trained = new Set(finishedWorkouts().map((w) => dayKey(new Date(w.startedAt))));
  const today = dayKey(t);
  return `<div class="week" role="group" aria-label="This week">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((name, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i), k = dayKey(d);
    return `<button class="wday ${k === today ? 'today' : ''}" data-action="go-history" data-day="${k}" aria-label="${fmtDay(d)}${trained.has(k) ? ', trained' : ''}">
      <small>${name}</small><b>${d.getDate()}</b><i class="${trained.has(k) ? 'on' : ''}"></i></button>`;
  }).join('')}</div>`;
}

// Small exercise image, or first letter as placeholder
function thumb(ex, cls = '') {
  if (ex?.image) return `<img class="thumb ${cls}" src="${ex.image}" alt="">`;
  if (ex?.primaryMuscle && MUSCLES[ex.primaryMuscle]) return `<span class="thumb mus ${cls}">${BODY.thumb(ex.primaryMuscle)}</span>`;
  return `<span class="thumb ph ${cls}">${esc((ex?.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
}
const musclesText = (ex) => !ex?.primaryMuscle ? '' :
  MUSCLES[ex.primaryMuscle] + (ex.secondaryMuscles?.length ? ` + ${ex.secondaryMuscles.map((m) => MUSCLES[m]).join(', ')}` : '');

// --- Training: start ---
function viewStart() {
  const done = countedWorkouts();
  const last = finishedWorkouts()[0];
  const weekCount = done.filter((w) => Date.now() - new Date(w.startedAt) < 7 * 864e5).length;
  const hasPlan = !!activePlan();
  return `
    ${weekStrip()}
    <header class="top"><h1>Training</h1></header>
    ${planSection()}
    <section class="hero">
      <button class="btn ${hasPlan ? 'ghost' : 'primary big'}" data-action="start">${hasPlan ? '+ Start empty workout' : 'Start workout'}</button>
      <div class="stats">
        <div><span class="num">${weekCount}</span><span class="lbl">last 7 days</span></div>
        <div><span class="num">${done.length}</span><span class="lbl">total</span></div>
      </div>
    </section>
    ${last ? `
      <h2 class="section">Last workout</h2>
      ${workoutCard(last)}` : `
      <p class="empty">No workouts logged yet. Start your first one – you can create exercises along the way.</p>`}
  `;
}

// --- Training: active workout ---
function viewActiveWorkout() {
  const w = activeWorkout();
  return `
    <header class="top sticky">
      <div class="grow">
        <input class="title-input" data-input="workout-name" value="${esc(w.name ?? '')}" placeholder="Name workout" aria-label="Workout name" enterkeyhint="done" autocomplete="off">
        <span class="sub">${w.deload ? `${ZZZ} Deload · ` : ''}since ${fmtTime(w.startedAt)} · <span id="clock" data-start="${w.startedAt}"></span></span>
      </div>
      <button class="btn primary" data-action="finish">Finish</button>
    </header>
    ${entriesOf(w.id).map((we) => entryCard(w, we)).join('')}
    <button class="btn ghost wide" data-action="open-sheet" data-wid="${w.id}">+ Add exercise</button>
    <button class="btn text danger wide" data-action="discard">Discard workout</button>
  `;
}

// Notes under the exercise name: the pinned one (stored on the exercise, shown every time)
// and this workout's own note (stored on the workout exercise).
function notesHtml(ex, we) {
  const pinned = ex?.pinnedNote?.trim(), own = we.note?.trim();
  const line = (text, isPinned) => `
    <div class="note ${isPinned ? 'pinned' : ''}">
      <p>${esc(text)}</p>
      <button class="pin" data-action="${isPinned ? 'unpin-note' : 'pin-note'}" aria-pressed="${isPinned}" aria-label="${isPinned ? 'Unpin note' : 'Pin note – show every time'}">${ICON.pin}</button>
    </div>`;
  return (pinned ? line(pinned, true) : '') + (own && own !== pinned ? line(own, false) : '');
}

function setInputs(metric, s, fallback, i) {
  if (metric === 'duration') {
    // One field across both columns; tap opens the time wheel
    const v = s.durationSec, f = fallback?.durationSec;
    return `
      <button class="f1 val dur ${v == null ? 'ph' : ''}" data-action="pick" data-field="duration" data-value="${v ?? ''}" data-ph="${f ?? ''}" aria-label="Duration, set ${i + 1}">${v != null ? fmtSecs(v) : f != null ? fmtSecs(f) : 'time'}</button>`;
  }
  // Weight × reps: tap opens the value picker (no system keyboard)
  const w = s.weight, r = s.reps, fw = fallback?.weight, fr = fallback?.reps;
  return `
    <button class="f1 val ${w == null ? 'ph' : ''}" data-action="pick" data-field="weight" data-value="${w ?? ''}" data-ph="${fw ?? ''}" aria-label="Weight, set ${i + 1}">${w != null ? fmtKg(w) : fw != null ? fmtKg(fw) : 'kg'}</button>
    <button class="f2 val ${r == null ? 'ph' : ''}" data-action="pick" data-field="reps" data-value="${r ?? ''}" data-ph="${fr ?? ''}" aria-label="Reps, set ${i + 1}">${r ?? fr ?? 'reps'}</button>`;
}

function entryCard(w, we) {
  const ex = data.exercises.get(we.exerciseId);
  const metric = metricOf(ex);
  const sets = setsOf(we.id);
  // for an old workout being edited, "last time" means before that workout
  const last = lastPerformance(we.exerciseId, w.id, w.endedAt ? w.startedAt : null);
  const best = bestSetBefore(we.exerciseId, w); // records.js
  const records = setRecordFlags(w, we); // records.js
  const rows = sets.map((s, i) => {
    const prev = last?.sets[i];
    // Suggestion (grey): same set last time, else last set last time, else the set above
    const fallback = prev ?? last?.sets[last.sets.length - 1] ?? (hasValue(sets[i - 1]) ? sets[i - 1] : null);
    return `
      <div class="setrow ${s.done ? 'done' : ''} ${records.has(s.id) ? 'pr' : ''}" data-set="${s.id}" data-metric="${metric}">
        <span class="n" ${records.has(s.id) ? 'title="New record"' : ''}>${records.has(s.id) ? ICON_TROPHY : i + 1}</span>
        ${rmCell(metric, s, fallback)}
        ${setInputs(metric, s, fallback, i)}
        <button class="tick" data-action="toggle-set" aria-label="Complete set">${ICON.check}</button>
      </div>`;
  }).join('');
  return `
    <article class="card entry" data-we="${we.id}">
      <div class="entry-head">
        <div class="ex-title" data-action="entry-history" data-ex="${we.exerciseId}" role="button" aria-label="Show history of this exercise">
          ${thumb(ex)}
          <div><h3>${esc(exerciseName(we.exerciseId))}</h3>
          ${ex?.primaryMuscle ? `<span class="sub">${MUSCLES[ex.primaryMuscle]}</span>` : ''}</div>
        </div>
        <button class="icon" data-action="entry-menu" aria-label="Options">${ICON.more}</button>
      </div>
      ${notesHtml(ex, we)}
      <p class="lasttime"><span>${last ? `Last time (${fmtDate(last.workout.startedAt)}) <b>${last.sets.map(fmtSet).join(' · ')}</b>` : 'No previous data'}</span>${best ? `<span class="best">Best <b>${fmtSet(best)}</b></span>` : ''}</p>
      <div class="setrow head"><span>Set</span>${metric === 'duration' ? '<span></span>' : `<button class="rm-toggle" data-action="rm-toggle" aria-label="Switch between e10RM and e1RM">${RM_LABEL[ui.rmMode]}</button>`}${METRICS[metric].cols.map((c) => `<span class="${METRICS[metric].cols.length === 1 ? 'span2' : ''}">${c}</span>`).join('')}<span></span></div>
      ${rows}
      <div class="entry-foot">
        <button class="btn small" data-action="add-set">+ Set</button>
        ${sets.length ? '<button class="btn small" data-action="remove-set">− Set</button>' : ''}
      </div>
    </article>`;
}

// --- Workout overview card (history / start) – tap opens the details ---
const workoutTitle = (w) => w.name?.trim() || 'Workout';
const fmtWhen = (w) => `${new Date(w.startedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(w.startedAt)}`;
const doneSetsOf = (w) => entriesOf(w.id).flatMap((we) => setsOf(we.id).filter((s) => s.done));

function workoutCard(w) {
  const entries = entriesOf(w.id);
  const exs = entries.map((we) => data.exercises.get(we.exerciseId));
  const muscles = [...new Set(exs.map((e) => e?.primaryMuscle).filter(Boolean))].map((m) => MUSCLES[m]);
  return `
    <button class="card wcard" data-action="open-workout" data-id="${w.id}">
      <div class="grow">
        <b>${esc(workoutTitle(w))}${w.deload ? ` ${ZZZ}` : ''}</b>
        <span class="sub">${fmtWhen(w)} · ${fmtDuration(new Date(w.endedAt) - new Date(w.startedAt))}</span>
        <span class="sub">${plural(entries.length, 'exercise', 'exercises')} · ${plural(doneSetsOf(w).length, 'set', 'sets')}${muscles.length ? ' · ' + esc(muscles.slice(0, 3).join(', ')) : ''}</span>
      </div>
      <div class="wc-thumbs">${exs.slice(0, 3).map((e) => thumb(e, 'sm')).join('')}${exs.length > 3 ? `<span class="thumb sm ph">+${exs.length - 3}</span>` : ''}</div>
      <span class="chev">${ICON.right}</span>
    </button>`;
}

// --- Workout details (full screen) ---
/** Workout detail and exercise history can open each other – the one opened last lies on top. */
function raiseOverlay(sel) {
  for (const s of ['#detail', '#exhist']) $(s).style.zIndex = s === sel ? 22 : 21;
}

function openDetail(id) {
  ui.detail = id;
  ui.detailEdit = false;
  raiseOverlay('#detail');
  $('#detail').classList.add('open');
  renderDetail();
  $('#detail .body').scrollTop = 0;
}
function closeDetail() {
  if (ui.detailEdit && !finishDetailEdit()) return;
  $('#detail').classList.remove('open');
  ui.detail = null;
  render();
}

/** Leaving edit mode: like finishing a workout, sets that aren't ticked are dropped. */
function finishDetailEdit() {
  const w = data.workouts.get(ui.detail);
  const entries = entriesOf(w.id);
  if (!entries.some((we) => setsOf(we.id).some((s) => s.done))) {
    if (!confirm('No completed sets left. Delete this workout?')) return false;
    deleteWorkoutTree(w);
    ui.detailEdit = false;
    $('#detail').classList.remove('open');
    ui.detail = null;
    render();
    toast('Workout deleted');
    return false;
  }
  for (const we of entries) {
    const sets = setsOf(we.id);
    sets.filter((s) => !s.done).forEach((s) => softDelete('sets', s));
    if (!sets.some((s) => s.done)) softDelete('workoutExercises', we);
  }
  ui.detailEdit = false;
  return true;
}

/** Strength trend vs. the previous workout with this exercise:
 *  weight × reps -> estimated 10RM of the top set (Strength.best), duration -> longest set.
 *  e10RM is used instead of e1RM: typical training sets are 5–15 reps, so the estimate
 *  stays close to what was actually lifted and compares better between workouts. */
function trendOf(w, we) {
  if (w.deload) return null; // a deload is not compared
  const ex = data.exercises.get(we.exerciseId);
  const isDur = metricOf(ex) === 'duration';
  const score = (sets) => {
    if (isDur) {
      const top = sets.reduce((a, s) => ((s.durationSec || 0) > (a?.durationSec || 0) ? s : a), null);
      return top ? { v: top.durationSec, set: top } : null;
    }
    const b = Strength.best(sets);
    return b ? { v: b.tenRM, set: b.set } : null;
  };
  const now = score(setsOf(we.id).filter((s) => s.done));
  if (!now) return null;
  const prev = lastPerformance(we.exerciseId, w.id, w.startedAt);
  const before = prev ? score(prev.sets) : null;
  const fmt = (v) => (isDur ? fmtSecs(Math.round(v)) : `${fmtKg(Math.round(v * 10) / 10)} kg`);
  const base = { set: now.set, label: isDur ? 'Best' : 'e10RM', value: fmt(now.v) };
  if (!before) return { ...base, dir: 'same', delta: 'first time', title: 'No earlier workout to compare' };
  const diff = now.v - before.v;
  const dir = Math.abs(diff) < (isDur ? 1 : 0.05) ? 'same' : diff > 0 ? 'up' : 'down';
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
  return {
    ...base,
    dir,
    delta: `${sign}${fmt(Math.abs(diff))} vs ${fmtDate(prev.workout.startedAt)}`,
    title: dir === 'up' ? 'Stronger than last time' : dir === 'down' ? 'Weaker than last time' : 'Same as last time',
  };
}
const TREND_ICON = { up: 'up', down: 'down', same: 'minus' };

function renderDetail() {
  const w = data.workouts.get(ui.detail);
  if (!w || w.deletedAt) return;
  const sets = doneSetsOf(w);
  const volume = sets.reduce((n, s) => n + (s.weight != null && s.reps != null ? s.weight * s.reps : 0), 0);
  const body = $('#detail .body');
  const head = `
    <header class="ed-head">
      <button class="btn text back" data-action="detail-close">${ICON.left}Back</button>
      <b></b>
      <button class="btn text strong" data-action="${ui.detailEdit ? 'detail-done' : 'detail-edit'}">${ui.detailEdit ? 'Done' : 'Edit'}</button>
    </header>
    <input class="title-input" data-input="detail-name" value="${esc(w.name ?? '')}" placeholder="Name workout" aria-label="Workout name" enterkeyhint="done" autocomplete="off">
    <p class="sub detail-when">${w.deload ? `${ZZZ} Deload · ` : ''}${fmtWhen(w)} – ${fmtTime(w.endedAt)}</p>`;

  if (ui.detailEdit) {
    body.innerHTML = `${head}
      <p class="hint edit-hint">Editing – tap values to change them. Sets that aren’t ticked are removed when you tap Done.</p>
      ${entriesOf(w.id).map((we) => entryCard(w, we)).join('')}
      <button class="btn ghost wide" data-action="open-sheet" data-wid="${w.id}">+ Add exercise</button>
      <button class="btn text danger wide" data-action="detail-delete">Delete workout</button>`;
    return;
  }

  body.innerHTML = `${head}
    <div class="stats three">
      <div><span class="num">${fmtDuration(new Date(w.endedAt) - new Date(w.startedAt))}</span><span class="lbl">duration</span></div>
      <div><span class="num">${sets.length}</span><span class="lbl">sets</span></div>
      <div><span class="num">${Math.round(volume).toLocaleString('en-GB')}</span><span class="lbl">kg volume</span></div>
    </div>
    ${entriesOf(w.id).map((we) => {
      const ex = data.exercises.get(we.exerciseId);
      const t = trendOf(w, we);
      return `
      <article class="card">
        <div class="entry-head">
          <div class="ex-title" data-action="entry-history" data-ex="${we.exerciseId}" role="button">${thumb(ex)}<div><h3>${esc(exerciseName(we.exerciseId))}</h3>
            ${ex?.primaryMuscle ? `<span class="sub">${esc(musclesText(ex))}</span>` : ''}</div><span class="chev">${ICON.right}</span></div>
          ${t ? `<span class="trend ${t.dir}" title="${t.title}" aria-label="${t.title}">${ICON[TREND_ICON[t.dir]]}</span>` : ''}
        </div>
        ${we.note?.trim() ? `<div class="note"><p>${esc(we.note.trim())}</p></div>` : ''}
        <ol class="setlist">${setsOf(we.id).filter((s) => s.done).map((s, i) => `
          <li class="${t?.set === s ? 'top' : ''}"><span class="n">${i + 1}</span><span>${s.durationSec != null ? fmtSecs(s.durationSec) : `${fmtKg(s.weight)} kg × ${s.reps}`}</span>
            ${t?.set === s ? `<span class="top-e ${t.dir}" title="${t.title}"><b>${t.label} ${t.value}</b><small>${t.delta}</small></span>` : ''}</li>`).join('')}
        </ol>
      </article>`;
    }).join('')}
    <button class="btn text danger wide" data-action="detail-delete">Delete workout</button>
  `;
}

// --- History (calendar) ---
function viewHistory() {
  const m = ui.calMonth;
  const byDay = new Map();
  for (const w of finishedWorkouts()) {
    const k = dayKey(new Date(w.startedAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(w);
  }
  const offset = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7; // Monday first
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const today = dayKey(new Date());
  let monthCount = 0;
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(m.getFullYear(), m.getMonth(), d));
    const has = byDay.has(k);
    if (has) monthCount += byDay.get(k).length;
    cells += `<button class="day ${has ? 'has' : ''} ${k === today ? 'today' : ''} ${k === ui.calDay ? 'sel' : ''}" data-action="pick-day" data-day="${k}">${d}</button>`;
  }
  const sel = byDay.get(ui.calDay) || [];
  const [y, mo, d] = ui.calDay.split('-').map(Number);
  return `
    <header class="top nav"><button class="btn text back" data-action="go-training">${ICON.left}Training</button></header>
    <header class="top"><h1>History</h1></header>
    <section class="card cal">
      <div class="cal-head">
        <button class="icon" data-action="month" data-dir="-1" aria-label="Previous month">${ICON.left}</button>
        <div><b>${m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><span class="sub">${plural(monthCount, 'workout', 'workouts')}</span></div>
        <button class="icon" data-action="month" data-dir="1" aria-label="Next month">${ICON.right}</button>
      </div>
      <div class="grid wd">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="grid days">${cells}</div>
    </section>
    <h2 class="section">${fmtDay(new Date(y, mo - 1, d))}</h2>
    ${sel.length ? sel.map(workoutCard).join('') : '<p class="empty">No workout on this day.</p>'}
  `;
}

// ---------- Bottom sheet: add exercise / exercise menu / note ----------
function openSheet(workoutId) {
  ui.sheetMode = 'pick';
  ui.sheetWorkout = workoutId || activeWorkout()?.id;
  ui.sheetPlanWorkout = null; // set by the plan editor when adding to a plan workout
  ui.sheetQuery = '';
  $('#sheet').classList.add('open');
  renderSheet();
}
function closeSheet() { $('#sheet').classList.remove('open'); }

function openEntryMenu(weId) {
  ui.sheetMode = 'menu';
  ui.sheetWe = weId;
  $('#sheet').classList.add('open');
  renderSheet();
}

function openNote(weId) {
  const we = data.workoutExercises.get(weId), ex = data.exercises.get(we.exerciseId);
  const pinned = ex?.pinnedNote?.trim() || null, own = we.note?.trim() || null;
  ui.sheetMode = 'note';
  ui.sheetWe = weId;
  // edit this workout's own note if there is one, otherwise the pinned one
  ui.noteWasPinned = !!pinned && (!own || own === pinned);
  ui.noteText = own ?? pinned ?? '';
  ui.notePin = ui.noteWasPinned;
  $('#sheet').classList.add('open');
  renderSheet();
  requestAnimationFrame(() => $('#sheet .note-input')?.focus());
}

function saveNote(remove) {
  const we = data.workoutExercises.get(ui.sheetWe), ex = data.exercises.get(we.exerciseId);
  const text = remove ? '' : ui.noteText.trim();
  we.note = text || null;
  save('workoutExercises', we);
  if (ex && (ui.notePin || ui.noteWasPinned)) {
    ex.pinnedNote = ui.notePin && text ? text : null;
    save('exercises', ex);
  }
  closeSheet();
  render();
  toast(remove ? 'Note deleted' : text ? (ui.notePin ? 'Note pinned' : 'Note saved') : 'Note removed');
}

function renderSheet() {
  if (ui.sheetMode.startsWith('plan')) return renderPlanSheet(); // plans.js
  if (ui.sheetMode.startsWith('chart')) return renderChartSheet(); // charts.js
  if (ui.sheetMode === 'swap') return renderSwapSheet(); // swap.js
  if (ui.sheetMode === 'menu') return renderEntryMenu();
  if (ui.sheetMode === 'note') return renderNoteEditor();
  const q = ui.sheetQuery.trim().toLowerCase();
  const own = exercisesSorted().map((e) => ({ ...e, secondaryMuscles: e.secondaryMuscles || [] }));
  const list = librarySearch(own, q); // library.js – matches name, equipment and muscles
  const lib = librarySearch(libraryAvailable(), q).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const exact = [...own, ...LIBRARY].some((e) => e.name.toLowerCase() === q);
  const libItem = (l) => `<li><button data-action="pick-library" data-lib="${l.id}">${thumb(l, 'sm')}
        <span><b>${esc(l.name)}</b><span class="sub">${MUSCLES[l.primaryMuscle]}${l.metric === 'duration' ? ' · Duration' : ''}</span></span></button></li>`;
  $('#sheet .body').innerHTML = `
    <div class="sheet-head">
      <h2>${ui.sheetPlanWorkout ? `Add to ${esc(data.planWorkouts.get(ui.sheetPlanWorkout)?.name || 'workout')}` : 'Add exercise'}</h2>
      <button class="btn text" data-action="close-sheet">Done</button>
    </div>
    <div class="stepper">
      <span>Sets</span>
      <button class="icon round" data-action="sets-dec" aria-label="Fewer sets">−</button>
      <b>${ui.sheetSets}</b>
      <button class="icon round" data-action="sets-inc" aria-label="More sets">+</button>
    </div>
    <input class="search" placeholder="Search or create new" value="${esc(ui.sheetQuery)}" data-input="sheet-query" autocomplete="off">
    <ul class="pick">
      ${q && !exact ? `<li><button data-action="create-add">+ Create “${esc(ui.sheetQuery.trim())}”</button></li>` : ''}
      ${list.map((e) => `<li><button data-action="pick-exercise" data-id="${e.id}">${thumb(e, 'sm')}
        <span><b>${esc(e.name)}</b>${e.primaryMuscle ? `<span class="sub">${MUSCLES[e.primaryMuscle]}</span>` : ''}</span></button></li>`).join('')}
    </ul>
    ${lib.length ? `<h3 class="mg">Library · ${lib.length}</h3><ul class="pick">${lib.map(libItem).join('')}</ul>` : ''}
    ${!list.length && !lib.length ? '<p class="empty">Nothing found – create it with the button above.</p>' : ''}`;
}

function renderEntryMenu() {
  const we = data.workoutExercises.get(ui.sheetWe), ex = data.exercises.get(we.exerciseId);
  const hasNote = !!(we.note?.trim() || ex?.pinnedNote?.trim());
  $('#sheet .body').innerHTML = `
    <div class="sheet-head">
      <h2>${esc(exerciseName(we.exerciseId))}</h2>
      <button class="btn text" data-action="close-sheet">Done</button>
    </div>
    <div class="menu">
      <button data-action="entry-swap">${ICON.swap}<span>Swap exercise</span></button>
      <button data-action="note-open">${ICON.note}<span>${hasNote ? 'Edit note' : 'Add note'}</span></button>
      <button class="danger" data-action="entry-remove">${ICON.trash}<span>Remove from workout</span></button>
    </div>`;
}

function renderNoteEditor() {
  const we = data.workoutExercises.get(ui.sheetWe);
  $('#sheet .body').innerHTML = `
    <div class="sheet-head">
      <button class="btn text" data-action="close-sheet">Cancel</button>
      <h2>Note</h2>
      <button class="btn text strong" data-action="note-save">Save</button>
    </div>
    <p class="sub note-for">${esc(exerciseName(we.exerciseId))}</p>
    <textarea class="note-input" data-input="note-text" rows="4" placeholder="e.g. Seat height 4, grip shoulder-wide">${esc(ui.noteText)}</textarea>
    <label class="toggle">
      <input type="checkbox" data-input="note-pin" ${ui.notePin ? 'checked' : ''}>
      <span class="sw" aria-hidden="true"></span>
      <span>${ICON.pin} <b>Pin note</b><small>Show it under this exercise in every workout until you unpin it.</small></span>
    </label>
    ${ui.noteText.trim() ? '<button class="btn text danger wide" data-action="note-delete">Delete note</button>' : ''}`;
}

// ---------- Exercise editor (full screen) ----------
function openEditor(ex, { name = '', onSave } = {}) {
  ui.editor = {
    id: ex?.id ?? null,
    libraryId: ex?.libraryId ?? null,
    name: ex?.name ?? name.trim(),
    image: ex?.image ?? null,
    metric: metricOf(ex),
    primary: ex?.primaryMuscle ?? null,
    secondary: new Set(ex?.secondaryMuscles ?? []),
    mode: 'primary',
    onSave,
  };
  $('#editor').classList.add('open');
  renderEditor();
  $('#editor .body').scrollTop = 0;
}
function closeEditor() { $('#editor').classList.remove('open'); ui.editor = null; }

function renderEditor() {
  const e = ui.editor;
  const tile = (id, label) => {
    const st = e.primary === id ? 'primary' : e.secondary.has(id) ? 'secondary' : '';
    return `<button class="muscle ${st}" data-action="muscle" data-id="${id}" aria-pressed="${!!st}">
      ${BODY.thumb(id)}
      <span>${label}</span>
      ${st ? `<small>${st}</small>` : ''}</button>`;
  };
  $('#editor .body').innerHTML = `
    <header class="ed-head">
      <button class="btn text" data-action="editor-cancel">Cancel</button>
      <b>${e.id ? 'Edit exercise' : 'New exercise'}</b>
      <button class="btn text strong" data-action="editor-save">Save</button>
    </header>
    <div class="ed-top">
      <label class="photo">
        ${e.image ? `<img src="${e.image}" alt="Exercise image">` : `${ICON.camera}<span>Image</span>`}
        <input type="file" accept="image/*" data-action="editor-image" hidden>
      </label>
      <div class="ed-name">
        <label class="lbl" for="ed-name">Name</label>
        <input id="ed-name" data-input="editor-name" value="${esc(e.name)}" placeholder="e.g. Bench press" autocomplete="off" enterkeyhint="done">
        ${e.image ? '<button class="link" data-action="editor-image-remove">Remove image</button>' : '<span class="lbl">Image optional – camera or photo library</span>'}
      </div>
    </div>

    <h3 class="mg">Muscles</h3>
    <div class="map">${BODY.map(e.primary, [...e.secondary])}</div>
    <div class="seg two">
      <button class="${e.mode === 'primary' ? 'on' : ''}" data-action="editor-mode" data-mode="primary">
        Primary<small>${e.primary ? MUSCLES[e.primary] : 'required'}</small></button>
      <button class="${e.mode === 'secondary' ? 'on' : ''}" data-action="editor-mode" data-mode="secondary">
        Secondary<small>${e.secondary.size ? [...e.secondary].map((m) => MUSCLES[m]).join(', ') : 'optional'}</small></button>
    </div>
    <p class="hint">${e.mode === 'primary' ? 'Which muscle does most of the work?' : 'Which muscles assist? Pick as many as you like.'}</p>
    ${MUSCLE_GROUPS.map(([g, list]) => `
      <h3 class="mg">${g}</h3>
      <div class="muscles">${list.map(([id, label]) => tile(id, label)).join('')}</div>`).join('')}

    <h3 class="mg metric-title">Metric</h3>
    <div class="seg two">
      ${Object.entries(METRICS).map(([k, m]) => `
        <button class="${e.metric === k ? 'on' : ''}" data-action="editor-metric" data-metric="${k}">${m.label}
          <small>${m.hint}</small></button>`).join('')}
    </div>
    ${e.id || e.libraryId ? '<button class="btn text danger wide" data-action="editor-delete">Delete exercise</button>' : ''}
  `;
}

function rerenderEditorKeepScroll() {
  const body = $('#editor .body'), y = body.scrollTop;
  renderEditor();
  body.scrollTop = y;
}

function tapMuscle(id) {
  const e = ui.editor;
  if (e.mode === 'primary') {
    e.primary = id;
    e.secondary.delete(id);
    e.mode = 'secondary'; // continue straight to secondary muscles
  } else if (id === e.primary) {
    return toast('That’s already the primary muscle');
  } else if (e.secondary.has(id)) e.secondary.delete(id);
  else e.secondary.add(id);
  rerenderEditorKeepScroll();
}

function saveEditor() {
  const e = ui.editor;
  const name = e.name.trim();
  if (!name) { $('#ed-name').focus(); return toast('Name is missing'); }
  if (!e.primary) { e.mode = 'primary'; rerenderEditorKeepScroll(); return toast('Pick a primary muscle'); }
  const dup = live('exercises').find((x) => x.id !== e.id && x.name.toLowerCase() === name.toLowerCase());
  if (dup) return toast(`“${dup.name}” already exists`);
  const ex = e.id ? data.exercises.get(e.id) : { id: uuid() };
  if (e.libraryId) ex.libraryId = e.libraryId;
  Object.assign(ex, { name, image: e.image, metric: e.metric, primaryMuscle: e.primary, secondaryMuscles: [...e.secondary] });
  save('exercises', ex);
  const cb = e.onSave;
  closeEditor();
  if (cb) cb(ex); else { render(); toast(`${name} saved`); }
}

/** Crop to a square and shrink (360 px JPEG, roughly 20–40 KB). */
async function processImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const S = 360, s = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Value picker (weight / reps) ----------
const WEIGHT_STEPS = [0.25, 0.5, 1, 1.25, 2, 2.5, 5, 10];
const DEFAULT_WEIGHT_STEP = 2.5;

function openPicker(setId, field) {
  const s = data.sets.get(setId);
  const we = data.workoutExercises.get(s.workoutExerciseId);
  const btn = $(`.setrow[data-set="${setId}"] [data-field="${field}"]`);
  const key = field === 'duration' ? 'durationSec' : field;
  // start at the current value, else last time's value, else 0 (weight: 20 kg)
  const start = s[key] ?? parseNum(btn?.dataset.ph) ?? { weight: 20, reps: 0, duration: 0 }[field];
  ui.picker = { setId, field, exId: we.exerciseId, value: start, text: '', options: false, touched: false };
  const el = $('#picker');
  el.classList.add('open');
  renderPicker(true);
  // Safari can ignore scroll positions set while the panel is still sliding in -> set them again
  requestAnimationFrame(() => positionPicker());
  el.addEventListener('transitionend', () => positionPicker(), { once: true });
}

/** Scroll the list / wheels so the current value sits in the middle (skipped once the user scrolled). */
function positionPicker() {
  const p = ui.picker;
  if (!p || p.touched) return;
  if (p.field === 'duration') {
    const parts = wheelParts(p.value);
    document.querySelectorAll('#picker .wheel').forEach((w) => { w.scrollTop = parts[w.dataset.wheel] * WHEEL_H; });
    return;
  }
  const list = $('#picker .pk-list'), sel = $('#picker .pk-item.sel');
  if (list && sel) list.scrollTop = sel.offsetTop - (list.clientHeight - sel.offsetHeight) / 2;
}
function closePicker() { $('#picker').classList.remove('open'); ui.picker = null; }

const pickerStep = () => (ui.picker.field === 'reps' ? 1 : data.exercises.get(ui.picker.exId)?.weightStep || DEFAULT_WEIGHT_STEP);
const pickerLabel = (v) => (ui.picker.field === 'reps' ? `${v} ${v === 1 ? 'rep' : 'reps'}` : `${fmtKg(v)} kg`);

function pickerValues() {
  const p = ui.picker, step = pickerStep();
  const max = p.field === 'reps' ? Math.max(100, p.value) : Math.max(300, Math.ceil(p.value * 1.5));
  const out = [];
  for (let k = 0; k * step <= max + 1e-9; k++) out.push(Math.round(k * step * 100) / 100);
  return out;
}

// --- Duration: two scroll wheels (minutes / seconds), like the iOS alarm clock ---
const WHEEL_H = 44;
const wheelParts = (v) => ({ min: Math.floor(v / 60), sec: v % 60 });

function renderWheel() {
  const p = ui.picker, ex = data.exercises.get(p.exId), parts = wheelParts(p.value);
  const col = (name, max, unit) => `
    <div class="wheel-col">
      <div class="wheel" data-wheel="${name}">
        ${Array.from({ length: max + 1 }, (_, i) => `<div class="wheel-item ${i === parts[name] ? 'sel' : ''}" data-action="picker-wheel-item" data-wheel="${name}" data-v="${i}">${name === 'sec' ? pad2(i) : i}</div>`).join('')}
      </div>
      <span class="wheel-unit">${unit}</span>
    </div>`;
  const body = $('#picker .body');
  body.innerHTML = `
    <header class="pk-head">
      <button class="btn text" data-action="picker-cancel">Cancel</button>
      <div class="pk-title"><b>Duration</b><span class="sub">${esc(ex?.name ?? '')}</span></div>
      <span></span>
    </header>
    <div class="wheels-wrap">
      <div class="wheels"><div class="wheel-band"></div>${col('min', 99, 'min')}${col('sec', 59, 'sec')}</div>
    </div>
    <div class="pk-pad"><button class="btn primary big" data-action="picker-ok">Set ${fmtSecs(p.value)}</button></div>`;
  body.querySelectorAll('.wheel').forEach((w) => {
    w.scrollTop = parts[w.dataset.wheel] * WHEEL_H;
    w.addEventListener('scroll', () => wheelScrolled(w), { passive: true });
    w.addEventListener('pointerdown', () => { if (ui.picker) ui.picker.touched = true; }, { passive: true });
  });
}

function wheelScrolled(w) {
  const p = ui.picker;
  if (!p) return;
  const items = w.children;
  const i = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / WHEEL_H)));
  const parts = wheelParts(p.value);
  if (parts[w.dataset.wheel] === i) return;
  parts[w.dataset.wheel] = i;
  p.value = parts.min * 60 + parts.sec;
  for (const el of items) el.classList.toggle('sel', Number(el.dataset.v) === i);
  $('#picker .pk-pad .btn').textContent = `Set ${fmtSecs(p.value)}`;
}

function renderPicker(scrollToSel) {
  if (ui.picker.field === 'duration') return renderWheel();
  const p = ui.picker, ex = data.exercises.get(p.exId);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', p.field === 'weight' ? '.' : '', '0', 'del'];
  const step = pickerStep();
  $('#picker .body').innerHTML = `
    <header class="pk-head">
      <button class="btn text" data-action="picker-cancel">Cancel</button>
      <div class="pk-title"><b>${p.field === 'weight' ? 'Weight' : 'Reps'}</b><span class="sub">${esc(ex?.name ?? '')}</span></div>
      ${p.field === 'weight' ? '<button class="btn text" data-action="picker-options">Options</button>' : '<span></span>'}
    </header>
    <div class="pk-list">
      ${pickerValues().map((v) => `<button class="pk-item ${v === p.value ? 'sel' : ''}" data-action="picker-item" data-v="${v}">${pickerLabel(v)}</button>`).join('')}
    </div>
    <div class="pk-pad">
      <div class="pk-display">
        <span class="pk-value ${p.text ? '' : 'dim'}">${p.text || fmtKg(p.value)}</span>
        <button class="pk-ok" data-action="picker-ok" aria-label="Confirm">${ICON.check}</button>
      </div>
      <div class="keys">${keys.map((k) => !k ? '<span></span>' :
        `<button class="key" data-action="picker-key" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k}">${k === 'del' ? ICON.backspace : k}</button>`).join('')}</div>
    </div>
    ${p.options ? `
      <div class="pk-options">
        <div class="sheet-head"><h2>Weight increment</h2><button class="btn text" data-action="picker-options">Done</button></div>
        <p class="sub">Step size of the list for “${esc(ex?.name ?? '')}”. Saved per exercise.</p>
        <div class="chips">${WEIGHT_STEPS.map((s) => `<button class="chip ${s === step ? 'on' : ''}" data-action="picker-step" data-step="${s}">${fmtKg(s)} kg</button>`).join('')}</div>
      </div>` : ''}
  `;
  $('#picker .pk-list').addEventListener('pointerdown', () => { if (ui.picker) ui.picker.touched = true; }, { passive: true });
  if (scrollToSel) positionPicker();
}

/** Light update (no full re-render) so the list keeps its scroll position. */
function updatePicker(scroll) {
  const p = ui.picker;
  const disp = $('#picker .pk-value');
  disp.textContent = p.text || fmtKg(p.value);
  disp.classList.toggle('dim', !p.text);
  let sel = null;
  document.querySelectorAll('#picker .pk-item').forEach((b) => {
    const on = Number(b.dataset.v) === p.value;
    b.classList.toggle('sel', on);
    if (on) sel = b;
  });
  if (scroll && sel) {
    const list = $('#picker .pk-list');
    list.scrollTo({ top: sel.offsetTop - (list.clientHeight - sel.offsetHeight) / 2, behavior: 'smooth' });
  }
}

function pickerKey(k) {
  const p = ui.picker;
  if (k === 'del') p.text = p.text.slice(0, -1);
  else if (k === '.') { if (!p.text.includes('.')) p.text = (p.text || '0') + '.'; }
  else if (p.text.replace('.', '').length < 5) p.text = p.text === '0' ? k : p.text + k;
  const v = parseNum(p.text);
  if (v != null) p.value = v;
  updatePicker(true);
}

function commitPicker() {
  const p = ui.picker;
  const v = p.text ? parseNum(p.text) : p.value;
  if (v == null) return toast('Enter a value');
  const s = data.sets.get(p.setId);
  const wasDone = s.done;
  if (p.field === 'duration') {
    if (!v) return toast('Pick a duration');
    s.durationSec = v;
    s.done = true; // all values entered -> set is complete
  } else {
    s[p.field] = p.field === 'reps' ? Math.round(v) : Math.round(v * 100) / 100;
    if (s.weight != null && s.reps != null) s.done = true; // kg and reps entered -> set is complete
  }
  save('sets', s);
  const next = p.field === 'weight' && s.reps == null; // weight entered -> go straight on to reps
  closePicker();
  render();
  if (next) openPicker(s.id, 'reps');
  if (!wasDone && s.done) onSetDone(s);
}

// ---------- Actions ----------
function startWorkout() {
  const w = save('workouts', { id: uuid(), name: null, startedAt: new Date().toISOString(), endedAt: null });
  render();
  openSheet(w.id);
}

function addExerciseToWorkout(exerciseId) {
  if (ui.sheetPlanWorkout) return addExerciseToPlanWorkout(exerciseId); // plans.js
  const w = data.workouts.get(ui.sheetWorkout) || activeWorkout();
  const we = save('workoutExercises', { id: uuid(), workoutId: w.id, exerciseId, position: entriesOf(w.id).length });
  for (let i = 0; i < ui.sheetSets; i++) {
    save('sets', { id: uuid(), workoutExerciseId: we.id, position: i, weight: null, reps: null, durationSec: null, done: false });
  }
  closeSheet();
  render();
  toast(`${exerciseName(exerciseId)} added`);
  requestAnimationFrame(() => $(`[data-we="${we.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function toggleSet(row) {
  const s = data.sets.get(row.dataset.set);
  if (s.done) { s.done = false; save('sets', s); render(); return; }
  // empty fields take the grey suggestion
  const read = (el) => (el ? parseNum(el.dataset.value) ?? parseNum(el.dataset.ph) : null);
  const v1 = read($('.f1', row)), v2 = read($('.f2', row));
  if (row.dataset.metric === 'duration') {
    if (!v1) return openPicker(s.id, 'duration');
    Object.assign(s, { durationSec: Math.round(v1), weight: null, reps: null, done: true });
  } else {
    if (v1 == null) return openPicker(s.id, 'weight');
    if (v2 == null) return openPicker(s.id, 'reps');
    Object.assign(s, { weight: v1, reps: Math.round(v2), durationSec: null, done: true });
  }
  save('sets', s);
  render();
  onSetDone(s);
}

/** A set was just completed: rest timer + record check, only in the running workout. */
function onSetDone(s) {
  const we = data.workoutExercises.get(s.workoutExerciseId);
  const w = we && data.workouts.get(we.workoutId);
  if (!w || w.endedAt) return; // editing a past workout
  startRest(s); // rest.js
  if (!w.deload) celebrateRecord(s); // records.js – a deload never sets records
}

function finishWorkout() {
  const w = activeWorkout();
  const entries = entriesOf(w.id);
  const doneCount = entries.reduce((n, we) => n + setsOf(we.id).filter((s) => s.done).length, 0);
  if (!doneCount) {
    if (confirm('No sets completed yet. Discard this workout?')) discardWorkout(true);
    return;
  }
  const open = entries.reduce((n, we) => n + setsOf(we.id).filter((s) => !s.done).length, 0);
  if (open && !confirm(`${plural(open, 'set is', 'sets are')} not completed and won’t be saved. Finish anyway?`)) return;
  for (const we of entries) {
    const sets = setsOf(we.id);
    sets.filter((s) => !s.done).forEach((s) => softDelete('sets', s));
    if (!sets.some((s) => s.done)) softDelete('workoutExercises', we);
  }
  w.endedAt = new Date().toISOString();
  save('workouts', w);
  ui.calDay = dayKey(new Date(w.startedAt));
  toast('Workout saved 💪');
  render();
}

function deleteWorkoutTree(w) {
  for (const we of entriesOf(w.id)) {
    setsOf(we.id).forEach((s) => softDelete('sets', s));
    softDelete('workoutExercises', we);
  }
  softDelete('workouts', w);
}

function discardWorkout(skipConfirm) {
  if (!skipConfirm && !confirm('Discard workout? Everything logged in it will be lost.')) return;
  deleteWorkoutTree(activeWorkout());
  render();
}

// --- Backup ---
async function exportData() {
  const payload = { app: 'gymlog', version: 1, exportedAt: new Date().toISOString() };
  for (const s of DB.STORES) payload[s] = [...data[s].values()];
  const json = JSON.stringify(payload, null, 1);
  const name = `gymlog-backup-${dayKey(new Date())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Gym Log backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importData(file) {
  let payload;
  try { payload = JSON.parse(await file.text()); } catch { return toast('Not a valid backup file'); }
  if (payload?.app !== 'gymlog') return toast('Not a Gym Log backup');
  // Merge: per record, the newer version (updatedAt) wins
  let changed = 0;
  for (const s of DB.STORES) {
    const toWrite = (payload[s] || []).filter((o) => {
      if (!o || !o.id) return false;
      const cur = data[s].get(o.id);
      return !cur || (o.updatedAt || '') > (cur.updatedAt || '');
    });
    if (toWrite.length) await DB.putMany(s, toWrite);
    changed += toWrite.length;
  }
  await loadAll();
  render();
  toast(changed ? `${plural(changed, 'entry', 'entries')} imported` : 'Nothing new in this backup');
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar button');
  if (tabBtn) { ui.tab = tabBtn.dataset.tab; render(); scrollToTop(); return; }

  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.id === 'sheet') closeSheet();
    return;
  }
  const weEl = el.closest('[data-we]');
  const we = weEl && data.workoutExercises.get(weEl.dataset.we);

  if (el.dataset.action.startsWith('picker') && !ui.picker) return; // stray tap after closing
  switch (el.dataset.action) {
    case 'start': startWorkout(); break;
    case 'finish': finishWorkout(); break;
    case 'discard': discardWorkout(); break;
    case 'open-sheet': openSheet(el.dataset.wid); break;
    case 'note-open': openNote(ui.sheetWe); break;
    case 'note-save': saveNote(false); break;
    case 'note-delete': saveNote(true); break;
    case 'entry-remove': {
      const w2 = data.workoutExercises.get(ui.sheetWe);
      if (confirm(`Remove “${exerciseName(w2.exerciseId)}” from this workout?`)) {
        setsOf(w2.id).forEach((s) => softDelete('sets', s));
        softDelete('workoutExercises', w2);
        closeSheet();
        render();
      }
      break;
    }
    case 'pin-note': {
      const ex = data.exercises.get(we.exerciseId);
      ex.pinnedNote = we.note.trim();
      save('exercises', ex);
      render(); toast('Note pinned – shows every time'); break;
    }
    case 'unpin-note': {
      const ex = data.exercises.get(we.exerciseId);
      if (!we.note?.trim()) { we.note = ex.pinnedNote; save('workoutExercises', we); } // keep it in this workout
      ex.pinnedNote = null;
      save('exercises', ex);
      render(); toast('Note unpinned'); break;
    }
    case 'go-history': {
      ui.calDay = el.dataset.day;
      const [y, m] = el.dataset.day.split('-').map(Number);
      ui.calMonth = new Date(y, m - 1, 1);
      ui.tab = 'history';
      render(); scrollToTop(); break;
    }
    case 'entry-history': if (ui.detailEdit) break; openExerciseHistory('own', el.dataset.ex); break; // settings.js
    case 'rm-toggle':
      ui.rmMode = ui.rmMode === 'e10' ? 'e1' : 'e10';
      localStorage.setItem('gymlog.rmMode', ui.rmMode);
      render(); break;
    case 'go-training': ui.tab = 'training'; render(); scrollToTop(); break;
    case 'detail-edit': ui.detailEdit = true; renderDetail(); break;
    case 'detail-done': if (finishDetailEdit()) { render(); toast('Changes saved'); } break;
    case 'close-sheet': closeSheet(); break;
    case 'sets-dec': ui.sheetSets = Math.max(1, ui.sheetSets - 1); renderSheet(); break;
    case 'sets-inc': ui.sheetSets = Math.min(10, ui.sheetSets + 1); renderSheet(); break;
    case 'pick-exercise': addExerciseToWorkout(el.dataset.id); break;
    case 'pick-library': addExerciseToWorkout(exerciseFromLibrary(el.dataset.lib).id); break;
    case 'create-add': openEditor(null, { name: ui.sheetQuery, onSave: (ex) => addExerciseToWorkout(ex.id) }); break;
    case 'editor-cancel': closeEditor(); break;
    case 'editor-save': saveEditor(); break;
    case 'editor-mode': ui.editor.mode = el.dataset.mode; rerenderEditorKeepScroll(); break;
    case 'editor-metric': ui.editor.metric = el.dataset.metric; rerenderEditorKeepScroll(); break;
    case 'muscle': tapMuscle(el.dataset.id); break;
    case 'editor-image-remove': ui.editor.image = null; rerenderEditorKeepScroll(); break;
    case 'editor-delete':
      // settings.js: works for own exercises and unused library entries, closes the history too
      deleteCatalogueItem(ui.editor.id ? 'own' : 'lib', ui.editor.id || ui.editor.libraryId);
      break;
    case 'edit-exercise': openEditor(data.exercises.get(el.dataset.ex)); break;
    case 'toggle-set': toggleSet(el.closest('.setrow')); break;
    case 'pick': openPicker(el.closest('.setrow').dataset.set, el.dataset.field); break;
    case 'picker-cancel': closePicker(); break;
    case 'picker-ok': commitPicker(); break;
    case 'picker-key': pickerKey(el.dataset.k); break;
    case 'picker-item': {
      const v = Number(el.dataset.v);
      if (v === ui.picker.value && !ui.picker.text) { commitPicker(); break; } // tap selected again = confirm
      ui.picker.value = v; ui.picker.text = '';
      updatePicker(false); break;
    }
    case 'picker-wheel-item': {
      const w = el.closest('.wheel');
      w.scrollTo({ top: Number(el.dataset.v) * WHEEL_H, behavior: 'smooth' });
      break;
    }
    case 'picker-options': ui.picker.options = !ui.picker.options; renderPicker(false); break;
    case 'picker-step': {
      const ex = data.exercises.get(ui.picker.exId);
      ex.weightStep = Number(el.dataset.step);
      save('exercises', ex);
      ui.picker.options = false;
      renderPicker(true);
      toast(`Increment: ${fmtKg(ex.weightStep)} kg`);
      break;
    }
    case 'add-set': {
      const sets = setsOf(we.id);
      save('sets', { id: uuid(), workoutExerciseId: we.id, position: sets.length ? sets[sets.length - 1].position + 1 : 0, weight: null, reps: null, durationSec: null, done: false });
      render(); break;
    }
    case 'remove-set': {
      const sets = setsOf(we.id);
      const target = [...sets].reverse().find((s) => !s.done) || sets[sets.length - 1];
      if (target.done && !confirm('Delete the last (completed) set?')) break;
      softDelete('sets', target); render(); break;
    }
    case 'entry-menu': openEntryMenu(we.id); break;
    case 'open-workout': openDetail(el.dataset.id); break;
    case 'detail-close': closeDetail(); break;
    case 'detail-delete': {
      const w = data.workouts.get(ui.detail);
      if (confirm(`Delete “${workoutTitle(w)}” from ${fmtDate(w.startedAt)}?`)) { deleteWorkoutTree(w); ui.detailEdit = false; closeDetail(); toast('Workout deleted'); }
      break;
    }
    case 'month': {
      const m = ui.calMonth;
      ui.calMonth = new Date(m.getFullYear(), m.getMonth() + Number(el.dataset.dir), 1);
      render(); break;
    }
    case 'pick-day': ui.calDay = el.dataset.day; render(); break;
    case 'export': exportData(); break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'editor-name') { ui.editor.name = e.target.value; return; }
  if (e.target.dataset.input === 'note-text') {
    const hadText = !!ui.noteText.trim();
    ui.noteText = e.target.value;
    if (hadText !== !!ui.noteText.trim()) { // show/hide "Delete note" without losing focus
      const pos = e.target.selectionStart;
      renderNoteEditor();
      const t = $('#sheet .note-input'); t.focus(); t.setSelectionRange(pos, pos);
    }
    return;
  }
  if (e.target.dataset.input === 'note-pin') { ui.notePin = e.target.checked; return; }
  if (e.target.dataset.input === 'sheet-query') {
    ui.sheetQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderSheet();
    const inp = $('#sheet .search');
    inp.focus();
    inp.setSelectionRange(pos, pos);
    return;
  }
  if (e.target.dataset.input === 'workout-name') {
    const w = activeWorkout();
    w.name = e.target.value;
    save('workouts', w);
  }
  if (e.target.dataset.input === 'detail-name') {
    const w = data.workouts.get(ui.detail);
    w.name = e.target.value;
    save('workouts', w);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const t = e.target;
  if (t.dataset.input === 'editor-name' || t.classList.contains('title-input')) { e.preventDefault(); t.blur(); }
  else if (t.tagName === 'INPUT' && t.classList.contains('f1')) { e.preventDefault(); $('.f2', t.closest('.setrow')).focus(); }
  else if (t.tagName === 'INPUT' && t.classList.contains('f2')) { e.preventDefault(); t.blur(); }
  else if (t.dataset.input === 'sheet-query') {
    e.preventDefault();
    $('#sheet .pick button')?.click();
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.dataset.form === 'add-exercise') {
    e.preventDefault();
    openEditor(null, { name: e.target.elements.name.value });
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.dataset.action === 'import' && e.target.files[0]) importData(e.target.files[0]);
  if (e.target.dataset.action === 'editor-image' && e.target.files[0]) {
    try { ui.editor.image = await processImage(e.target.files[0]); rerenderEditorKeepScroll(); }
    catch { toast('Couldn’t load that image'); }
  }
});

// Running workout clock
function tickClock() {
  const c = $('#clock');
  if (c) c.textContent = fmtClock(Date.now() - new Date(c.dataset.start));
}
setInterval(tickClock, 1000);

// ---------- Window height & bottom safe area (iOS 26 home-screen bug) ----------
// iOS 26 can give a home-screen app a window that ends above the screen bottom (by the
// status-bar height). Content there is not drawn, so the app fills exactly its window,
// and the home-indicator padding is dropped when the window doesn't reach the bottom.
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function safeInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe), r = { top: parseInt(cs.paddingTop) || 0, bottom: parseInt(cs.paddingBottom) || 0 };
  probe.remove();
  return r;
}
function fitAppHeight() {
  const root = document.documentElement.style;
  root.setProperty('--app-h', `${innerHeight}px`);
  if (!document.body) return;
  const { top } = safeInsets();
  // window starts at the top of the screen but is shorter than it by the status bar -> it can't reach the bottom
  // (with an opaque status bar the window starts below it – top inset 0 – and does reach the bottom)
  const short = isStandalone() && top > 0 && innerHeight + top <= screen.height + 1;
  fitAppHeight.short = short;
  if (short) root.setProperty('--sab', '0px'); else root.removeProperty('--sab');
}
fitAppHeight();
addEventListener('DOMContentLoaded', fitAppHeight);
addEventListener('resize', fitAppHeight);
addEventListener('orientationchange', () => setTimeout(fitAppHeight, 300));

/** Small diagnosis line in Settings (helps with iOS layout bugs). */
function screenInfo() {
  const { top, bottom } = safeInsets();
  return `${isStandalone() ? 'app' : 'browser'} · view ${innerHeight} · screen ${screen.height} · safe ${top}/${bottom}${fitAppHeight.short ? ' · fix' : ''}`;
}

// ---------- Start ----------
// Wait until every script has run (plans.js, charts.js, … load after this file and may
// still be downloading on a slow connection when the database is ready).
const domReady = new Promise((r) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r, { once: true }) : r()));
(async () => {
  await Promise.all([loadAll(), domReady]);
  render();
  if (navigator.storage?.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) watchForUpdates();
})();

// --- Update banner: a new version is installed in the background, the user decides when to switch ---
async function watchForUpdates() {
  const reg = await navigator.serviceWorker.register('./sw.js');
  const offer = (worker) => {
    if (!worker || !navigator.serviceWorker.controller) return; // first install: nothing to update
    const el = $('#update');
    el.innerHTML = `<span>New version available</span><button class="btn small primary" data-action="update-now">Update</button>`;
    el.classList.add('show');
    el.onclick = (e) => { if (e.target.closest('[data-action=update-now]')) worker.postMessage('skipWaiting'); };
  };
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  // a home-screen app is often only resumed, never reloaded -> look for updates when it comes back
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 60e3) { lastCheck = Date.now(); reg.update().catch(() => {}); }
  });
}
