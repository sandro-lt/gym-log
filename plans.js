/* Plans: workouts that run in rotation (A → B → C → A …).
 * Loaded after app.js and uses its helpers (data, save, live, render, sheet, …).
 *
 * Rotation: the next workout is the one after the last done-or-skipped workout of the plan.
 * A "round" is one pass through the plan; the status list shows the current round.
 */

const byPos = (a, b) => a.position - b.position;
const plansSorted = () => live('plans').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
const activePlan = () => live('plans').find((p) => p.active) || null;
const planWorkoutsOf = (planId) => live('planWorkouts').filter((x) => x.planId === planId).sort(byPos);
const planExercisesOf = (pwId) => live('planExercises')
  .filter((x) => x.planWorkoutId === pwId && data.exercises.get(x.exerciseId) && !data.exercises.get(x.exerciseId).deletedAt)
  .sort(byPos);

const ICON_SKIP = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6l7 6-7 6zM12 6l7 6-7 6z"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// ---------- Rotation ----------
function planState(plan) {
  const pws = planWorkoutsOf(plan.id);
  const index = new Map(pws.map((pw, i) => [pw.id, i]));
  const events = live('workouts')
    .filter((w) => w.endedAt && index.has(w.planWorkoutId))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((w) => ({ w, idx: index.get(w.planWorkoutId) }));
  // split the history into rounds: a new round starts when the order goes back
  let round = [], prev = -1;
  for (const e of events) {
    if (e.idx <= prev) round = [];
    round.push(e);
    prev = e.idx;
  }
  const last = events[events.length - 1];
  if (last && last.idx === pws.length - 1) round = []; // round complete -> start fresh
  const status = new Map(round.map((e) => [pws[e.idx].id, e.w.skipped ? 'skipped' : 'done']));
  const skipRecord = new Map(round.filter((e) => e.w.skipped).map((e) => [pws[e.idx].id, e.w]));
  const next = pws.length ? pws[last ? (last.idx + 1) % pws.length : 0] : null;
  return { pws, status, skipRecord, next };
}

// ---------- Start page section ----------
function planThumbs(pwId) {
  const pes = planExercisesOf(pwId);
  const exs = pes.map((pe) => data.exercises.get(pe.exerciseId));
  return `<div class="wc-thumbs">${exs.slice(0, 3).map((e) => thumb(e, 'sm')).join('')}${exs.length > 3 ? `<span class="thumb sm ph">+${exs.length - 3}</span>` : ''}</div>`;
}

function planSection() {
  const plan = activePlan();
  if (!plan) {
    return plansSorted().length
      ? '<button class="btn ghost wide plan-cta" data-action="plan-menu">Choose a plan</button>'
      : '<button class="btn ghost wide plan-cta" data-action="plan-new">+ Create a plan</button>';
  }
  const st = planState(plan);
  const rows = st.pws.map((pw, i) => {
    const status = st.status.get(pw.id), isNext = st.next?.id === pw.id;
    const icon = status === 'done' ? `<span class="ps done">${ICON.check}</span>`
      : status === 'skipped' ? `<span class="ps skipped">${ICON_SKIP}</span>`
      : `<span class="ps ${isNext ? 'next' : ''}">${i + 1}</span>`;
    return `
      <div class="plan-row ${status || ''} ${isNext ? 'next' : ''}" data-action="plan-row" data-pw="${pw.id}" role="button" tabindex="0">
        ${icon}
        <span class="pr-name">${esc(pw.name || `Workout ${i + 1}`)}${status === 'skipped' ? '<small> · Skipped</small>' : ''}</span>
        ${isNext ? `<button class="btn primary small" data-action="plan-start" data-pw="${pw.id}">Start</button>` : planThumbs(pw.id)}
      </div>`;
  }).join('');
  return `
    <div class="plan-head">
      <h2>${esc(plan.name || 'My plan')}</h2>
      <button class="icon" data-action="plan-menu" aria-label="Plan options">${ICON.more}</button>
    </div>
    <div class="card plan-list">${rows || '<p class="empty">This plan has no workouts yet.</p>'}</div>`;
}

// ---------- Plan actions ----------
function startPlanWorkout(pwId) {
  if (activeWorkout()) { ui.tab = 'training'; render(); return toast('Finish your current workout first'); }
  const pw = data.planWorkouts.get(pwId);
  const w = save('workouts', { id: uuid(), name: pw.name || null, planWorkoutId: pw.id, startedAt: new Date().toISOString(), endedAt: null });
  planExercisesOf(pw.id).forEach((pe, i) => {
    const we = save('workoutExercises', { id: uuid(), workoutId: w.id, exerciseId: pe.exerciseId, position: i, note: null });
    for (let k = 0; k < (pe.sets || 1); k++) {
      save('sets', { id: uuid(), workoutExerciseId: we.id, position: k, weight: null, reps: null, durationSec: null, done: false });
    }
  });
  closeSheet();
  ui.tab = 'training';
  render();
  window.scrollTo(0, 0);
}

function skipPlanWorkout(pwId) {
  const pw = data.planWorkouts.get(pwId);
  const t = new Date().toISOString();
  save('workouts', { id: uuid(), name: pw.name || null, planWorkoutId: pw.id, skipped: true, startedAt: t, endedAt: t });
  closeSheet();
  render();
  toast(`${pw.name || 'Workout'} skipped`);
}

function setActivePlan(planId) {
  for (const p of live('plans')) {
    const on = p.id === planId;
    if (!!p.active !== on) { p.active = on; save('plans', p); }
  }
}

function newPlan() {
  const p = save('plans', { id: uuid(), name: '', active: false });
  setActivePlan(p.id);
  save('planWorkouts', { id: uuid(), planId: p.id, name: 'Workout A', position: 0 });
  closeSheet();
  openPlanEditor(p.id);
}

function deletePlan(planId) {
  const plan = data.plans.get(planId);
  for (const pw of planWorkoutsOf(planId)) {
    live('planExercises').filter((pe) => pe.planWorkoutId === pw.id).forEach((pe) => softDelete('planExercises', pe));
    softDelete('planWorkouts', pw);
  }
  softDelete('plans', plan);
  if (plan.active) { const other = plansSorted()[0]; if (other) setActivePlan(other.id); }
}

/** Swap position with the neighbour (dir -1 = up, +1 = down). */
function movePos(store, list, id, dir) {
  const i = list.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  list.forEach((x, k) => { if (x.position !== k) { x.position = k; save(store, x); } }); // normalise
  [list[i].position, list[j].position] = [j, i];
  save(store, list[i]); save(store, list[j]);
}

function addExerciseToPlanWorkout(exerciseId) {
  const pwId = ui.sheetPlanWorkout;
  const pes = live('planExercises').filter((x) => x.planWorkoutId === pwId);
  const pos = pes.reduce((m, x) => Math.max(m, x.position + 1), 0);
  save('planExercises', { id: uuid(), planWorkoutId: pwId, exerciseId, position: pos, sets: ui.sheetSets });
  closeSheet();
  renderPlanEditorKeepScroll();
  toast(`${exerciseName(exerciseId)} added`);
}

// ---------- Plan editor (full screen) ----------
function openPlanEditor(planId) {
  ui.plan = planId;
  $('#plan').classList.add('open');
  renderPlanEditor();
  $('#plan .body').scrollTop = 0;
}
function closePlanEditor() {
  const plan = data.plans.get(ui.plan);
  if (plan && !plan.deletedAt && !plan.name?.trim()) { plan.name = 'My plan'; save('plans', plan); }
  $('#plan').classList.remove('open');
  ui.plan = null;
  render();
}
function renderPlanEditorKeepScroll() {
  const b = $('#plan .body'), y = b.scrollTop;
  renderPlanEditor();
  b.scrollTop = y;
}

function renderPlanEditor() {
  const plan = data.plans.get(ui.plan);
  if (!plan || plan.deletedAt) return;
  const pws = planWorkoutsOf(plan.id);
  $('#plan .body').innerHTML = `
    <header class="ed-head">
      <span></span>
      <b>Edit plan</b>
      <button class="btn text strong" data-action="plan-close">Done</button>
    </header>
    <input class="title-input" data-input="plan-name" value="${esc(plan.name ?? '')}" placeholder="Plan name" aria-label="Plan name" enterkeyhint="done" autocomplete="off">
    <p class="sub plan-sub">${plan.active ? 'Active plan · workouts run in this order, then start over' : '<button class="link" data-action="plan-activate">Make this the active plan</button>'}</p>
    ${pws.map((pw, i) => `
      <article class="card pw-card" data-pw="${pw.id}">
        <div class="pw-head">
          <span class="ps">${i + 1}</span>
          <input class="pw-name" data-input="pw-name" value="${esc(pw.name ?? '')}" placeholder="Workout ${i + 1}" aria-label="Workout name" autocomplete="off" enterkeyhint="done">
          <button class="icon" data-action="pw-up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ICON_UP}</button>
          <button class="icon" data-action="pw-down" aria-label="Move down" ${i === pws.length - 1 ? 'disabled' : ''}>${ICON_DOWN}</button>
          <button class="icon" data-action="pw-delete" aria-label="Delete workout">${ICON.trash}</button>
        </div>
        <ul class="pe-list">
          ${planExercisesOf(pw.id).map((pe, k, arr) => {
            const ex = data.exercises.get(pe.exerciseId);
            return `
            <li data-pe="${pe.id}">
              ${thumb(ex, 'sm')}
              <span class="pe-name"><b>${esc(ex.name)}</b>${ex.primaryMuscle ? `<span class="sub">${MUSCLES[ex.primaryMuscle]}</span>` : ''}</span>
              <span class="pe-sets">
                <button class="icon round sm" data-action="pe-dec" aria-label="Fewer sets">−</button>
                <b>${pe.sets}</b>
                <button class="icon round sm" data-action="pe-inc" aria-label="More sets">+</button>
              </span>
              <button class="icon sm" data-action="pe-up" aria-label="Move up" ${k === 0 ? 'disabled' : ''}>${ICON_UP}</button>
              <button class="icon sm" data-action="pe-remove" aria-label="Remove">${ICON_X}</button>
            </li>`;
          }).join('') || '<li class="empty">No exercises yet.</li>'}
        </ul>
        <button class="btn small ghost-sm" data-action="pe-add">+ Add exercise</button>
      </article>`).join('')}
    <button class="btn ghost wide" data-action="pw-add">+ Add workout</button>
    <button class="btn text danger wide" data-action="plan-delete">Delete plan</button>
  `;
}

// ---------- Sheets: plan menu, plan row menu ----------
function renderPlanSheet() {
  const body = $('#sheet .body');
  if (ui.sheetMode === 'plan-menu') {
    const plan = activePlan();
    body.innerHTML = `
      <div class="sheet-head"><h2>Plans</h2><button class="btn text" data-action="close-sheet">Done</button></div>
      <div class="menu">
        ${plan ? `<button data-action="plan-edit" data-plan="${plan.id}">${ICON.note}<span>Edit “${esc(plan.name || 'My plan')}”</span></button>` : ''}
        <button data-action="plan-new">${ICON_PLUS}<span>New plan</span></button>
      </div>
      ${plansSorted().length > 1 || !plan ? `
        <h3 class="mg">Active plan</h3>
        <div class="menu">${plansSorted().map((p) => `
          <button class="radio ${p.active ? 'on' : ''}" data-action="plan-switch" data-plan="${p.id}">
            <span class="dot"></span><span>${esc(p.name || 'My plan')}</span>
            <small>${plural(planWorkoutsOf(p.id).length, 'workout', 'workouts')}</small></button>`).join('')}
        </div>` : ''}`;
    return;
  }
  // plan-row: one workout of the plan
  const pw = data.planWorkouts.get(ui.sheetPw);
  const st = planState(data.plans.get(pw.planId));
  const status = st.status.get(pw.id);
  body.innerHTML = `
    <div class="sheet-head"><h2>${esc(pw.name || 'Workout')}</h2><button class="btn text" data-action="close-sheet">Done</button></div>
    <ul class="pw-preview">${planExercisesOf(pw.id).map((pe) => {
      const ex = data.exercises.get(pe.exerciseId);
      return `<li>${thumb(ex, 'sm')}<span>${esc(ex.name)}</span><small>${plural(pe.sets, 'set', 'sets')}</small></li>`;
    }).join('') || '<li class="empty">No exercises in this workout yet.</li>'}</ul>
    <div class="menu">
      <button class="primary-row" data-action="plan-start" data-pw="${pw.id}">${ICON.right}<span>Start workout</span></button>
      ${status === 'skipped' ? `<button data-action="plan-unskip" data-pw="${pw.id}">${ICON_SKIP}<span>Undo skip</span></button>`
        : !status ? `<button data-action="plan-skip" data-pw="${pw.id}">${ICON_SKIP}<span>Skip${st.next?.id === pw.id ? '' : ' (and continue after it)'}</span></button>` : ''}
      <button data-action="plan-edit" data-plan="${pw.planId}">${ICON.note}<span>Edit plan</span></button>
    </div>`;
}

function openPlanSheet(mode, pwId) {
  ui.sheetMode = mode;
  ui.sheetPw = pwId || null;
  $('#sheet').classList.add('open');
  renderSheet();
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const pwEl = el.closest('[data-pw]'), peEl = el.closest('[data-pe]');
  const pw = pwEl && data.planWorkouts.get(pwEl.dataset.pw);
  const pe = peEl && data.planExercises.get(peEl.dataset.pe);

  switch (el.dataset.action) {
    case 'plan-new': newPlan(); break;
    case 'plan-menu': openPlanSheet('plan-menu'); break;
    case 'plan-row': openPlanSheet('plan-row', el.dataset.pw); break;
    case 'plan-start': startPlanWorkout(el.dataset.pw); break;
    case 'plan-skip': skipPlanWorkout(el.dataset.pw); break;
    case 'plan-unskip': {
      const rec = planState(data.plans.get(data.planWorkouts.get(el.dataset.pw).planId)).skipRecord.get(el.dataset.pw);
      if (rec) softDelete('workouts', rec);
      closeSheet(); render(); toast('Skip undone'); break;
    }
    case 'plan-switch': setActivePlan(el.dataset.plan); closeSheet(); render(); break;
    case 'plan-edit': closeSheet(); openPlanEditor(el.dataset.plan); break;
    case 'plan-close': closePlanEditor(); break;
    case 'plan-activate': setActivePlan(ui.plan); renderPlanEditorKeepScroll(); break;
    case 'plan-delete': {
      const plan = data.plans.get(ui.plan);
      if (confirm(`Delete the plan “${plan.name || 'My plan'}”? Your logged workouts stay in History.`)) {
        deletePlan(plan.id);
        $('#plan').classList.remove('open'); ui.plan = null; render(); toast('Plan deleted');
      }
      break;
    }
    case 'pw-add': {
      const pws = planWorkoutsOf(ui.plan);
      save('planWorkouts', { id: uuid(), planId: ui.plan, name: `Workout ${String.fromCharCode(65 + pws.length)}`, position: pws.length });
      renderPlanEditorKeepScroll();
      requestAnimationFrame(() => $('#plan .body').scrollTo({ top: 1e6, behavior: 'smooth' }));
      break;
    }
    case 'pw-up': case 'pw-down':
      movePos('planWorkouts', planWorkoutsOf(ui.plan), pw.id, el.dataset.action === 'pw-up' ? -1 : 1);
      renderPlanEditorKeepScroll(); break;
    case 'pw-delete':
      if (confirm(`Delete “${pw.name || 'this workout'}” from the plan?`)) {
        live('planExercises').filter((x) => x.planWorkoutId === pw.id).forEach((x) => softDelete('planExercises', x));
        softDelete('planWorkouts', pw);
        renderPlanEditorKeepScroll();
      }
      break;
    case 'pe-add': openSheet(null); ui.sheetPlanWorkout = pw.id; renderSheet(); break;
    case 'pe-inc': pe.sets = Math.min(10, pe.sets + 1); save('planExercises', pe); renderPlanEditorKeepScroll(); break;
    case 'pe-dec': pe.sets = Math.max(1, pe.sets - 1); save('planExercises', pe); renderPlanEditorKeepScroll(); break;
    case 'pe-up': movePos('planExercises', planExercisesOf(pe.planWorkoutId), pe.id, -1); renderPlanEditorKeepScroll(); break;
    case 'pe-remove': softDelete('planExercises', pe); renderPlanEditorKeepScroll(); break;
  }
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'plan-name') {
    const plan = data.plans.get(ui.plan);
    plan.name = e.target.value;
    save('plans', plan);
  }
  if (e.target.dataset.input === 'pw-name') {
    const pw = data.planWorkouts.get(e.target.closest('[data-pw]').dataset.pw);
    pw.name = e.target.value;
    save('planWorkouts', pw);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList?.contains('pw-name')) { e.preventDefault(); e.target.blur(); }
  // keyboard access for the plan rows (they are divs because they contain a button)
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('plan-row')) { e.preventDefault(); e.target.click(); }
});
