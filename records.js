/* Personal records: computed from logged sets (nothing extra is stored).
 * - exerciseRecords(): all-time bests shown in the exercise history
 * - setRecordFlags(): which sets in a workout beat everything before them (trophy on the set)
 * - celebrateRecord(): small celebration when a new record is ticked off during a workout
 * Loaded after app.js. */

const kgText = (v) => `${fmtKg(Math.round(v * 10) / 10)} kg`;

/** Finished sets of an exercise, optionally only before a point in time / without one workout. */
function doneSetsOfExercise(exId, { beforeIso = null, excludeWorkoutId = null } = {}) {
  const out = [];
  for (const we of live('workoutExercises')) {
    if (we.exerciseId !== exId || we.workoutId === excludeWorkoutId) continue;
    const w = data.workouts.get(we.workoutId);
    if (!w || w.deletedAt || !w.endedAt || w.skipped || w.deload) continue; // a deload never counts
    if (beforeIso && w.startedAt >= beforeIso) continue;
    for (const s of setsOf(we.id)) if (s.done) out.push({ s, w, we });
  }
  return out;
}

/** Best earlier set of an exercise (by e10RM / duration / reps), as known when workout `w` was done. */
function bestSetBefore(exId, w) {
  const rows = doneSetsOfExercise(exId, { excludeWorkoutId: w.id, beforeIso: w.endedAt ? w.startedAt : null });
  const metric = metricOf(data.exercises.get(exId));
  let best = null, score = -Infinity;
  for (const { s } of rows) { const v = setScore(s, metric); if (v != null && v > score) { score = v; best = s; } }
  return best;
}

/** Score used for "is this set a record": e10RM for weight × reps, seconds for duration,
 *  reps metric: added weight first, then reps (10 kg × 6 beats 0 kg × 15, 0 kg × 15 beats 0 kg × 12). */
function setScore(s, metric) {
  if (s.durationSec != null) return s.durationSec;
  if (metric === 'reps') return Number.isInteger(s.reps) && s.reps > 0 ? (s.weight || 0) * 1000 + s.reps : null;
  return Strength.tenRepMax(s.weight, s.reps);
}

/** All-time records of an exercise: list of { label, value, detail, date, setId } */
function exerciseRecords(ex) {
  const rows = doneSetsOfExercise(ex.id);
  if (!rows.length) return [];
  const metric = metricOf(ex), isDur = metric === 'duration';
  const maxBy = (list, f) => list.reduce((a, x) => (f(x) > f(a) ? x : a), list[0]);
  // per workout totals
  const byW = new Map();
  for (const r of rows) {
    const t = byW.get(r.w.id) || { w: r.w, vol: 0, time: 0, reps: 0 };
    t.reps += r.s.reps ?? 0;
    t.vol += (r.s.weight ?? 0) * (r.s.reps ?? 0);
    t.time += r.s.durationSec ?? 0;
    byW.set(r.w.id, t);
  }
  const sessions = [...byW.values()];
  const when = (w) => fmtDate(w.startedAt);
  if (isDur) {
    const longest = maxBy(rows, (r) => r.s.durationSec ?? 0);
    const total = maxBy(sessions, (t) => t.time);
    return [
      { label: 'Longest set', value: fmtSecs(longest.s.durationSec), detail: when(longest.w), setId: longest.s.id },
      { label: 'Most time in a session', value: fmtSecs(total.time), detail: when(total.w) },
    ];
  }
  if (metric === 'reps') {
    const scored = rows.filter((r) => setScore(r.s, metric) != null);
    if (!scored.length) return [];
    const best = maxBy(scored, (r) => setScore(r.s, metric));
    const most = maxBy(scored, (r) => r.s.reps * 1000 + (r.s.weight || 0));
    const total = maxBy(sessions, (t) => t.reps);
    const out = [{ label: 'Best set', value: fmtRepSet(best.s), detail: when(best.w), setId: best.s.id, main: true }];
    if (most !== best) out.push({ label: 'Most reps in a set', value: plural(most.s.reps, 'rep', 'reps'), detail: most.s.weight ? `${fmtRepSet(most.s)} · ${when(most.w)}` : when(most.w) });
    out.push({ label: 'Most reps in a session', value: plural(total.reps, 'rep', 'reps'), detail: when(total.w) });
    return out;
  }
  const scored = rows.filter((r) => Strength.oneRepMax(r.s.weight, r.s.reps) != null);
  const out = [];
  if (scored.length) {
    const best = maxBy(scored, (r) => Strength.oneRepMax(r.s.weight, r.s.reps));
    const orm = Strength.oneRepMax(best.s.weight, best.s.reps);
    out.push({ label: 'Best e10RM', value: kgText(Strength.weightForReps(orm, 10)), detail: `${fmtSet(best.s)} · ${when(best.w)}`, setId: best.s.id, main: true });
    out.push({ label: 'Best e1RM', value: kgText(orm), detail: `${fmtSet(best.s)} · ${when(best.w)}` });
  }
  // heaviest weight; on a tie the set with more reps wins
  const heavy = maxBy(rows, (r) => (r.s.weight ?? 0) * 1000 + (r.s.reps ?? 0));
  if (heavy.s.weight != null) out.push({ label: 'Heaviest weight', value: kgText(heavy.s.weight), detail: `× ${heavy.s.reps} · ${when(heavy.w)}` });
  const vol = maxBy(sessions, (t) => t.vol);
  if (vol.vol > 0) out.push({ label: 'Best session volume', value: `${Math.round(vol.vol).toLocaleString(I18n.locale)} kg`, detail: when(vol.w) });
  return out;
}

/** Set ids in workout entry `we` that beat every earlier set of the exercise (needs earlier history). */
function setRecordFlags(w, we) {
  const prior = doneSetsOfExercise(we.exerciseId, { beforeIso: w.startedAt, excludeWorkoutId: w.id });
  if (!prior.length) return new Set(); // first time is not a record
  const metric = metricOf(data.exercises.get(we.exerciseId));
  let best = Math.max(...prior.map((r) => setScore(r.s, metric) ?? -Infinity));
  // earlier entries of the same exercise in this workout count as well
  const entries = entriesOf(w.id).filter((x) => x.exerciseId === we.exerciseId);
  const flags = new Set();
  for (const e of entries) {
    for (const s of setsOf(e.id)) {
      if (!s.done) continue;
      const v = setScore(s, metric);
      if (v != null && v > best + 1e-6) { if (e.id === we.id) flags.add(s.id); best = v; }
    }
  }
  return flags;
}

/** Called when a set was just ticked off in the running workout. */
function celebrateRecord(s) {
  const we = data.workoutExercises.get(s.workoutExerciseId);
  const w = data.workouts.get(we.workoutId);
  const prior = doneSetsOfExercise(we.exerciseId, { beforeIso: w.startedAt, excludeWorkoutId: w.id }).map((r) => r.s);
  if (!prior.length) return; // first time is not a record
  const today = entriesOf(w.id).filter((e) => e.exerciseId === we.exerciseId)
    .flatMap((e) => setsOf(e.id)).filter((x) => x.done && x.id !== s.id);
  const metric = metricOf(data.exercises.get(we.exerciseId));
  const all = [...prior, ...today];
  const before = Math.max(...all.map((x) => setScore(x, metric) ?? -Infinity));
  const now = setScore(s, metric);
  if (now == null || now <= before + 1e-6) return;
  if (metric === 'reps') {
    const top = all.reduce((a, x) => ((setScore(x, metric) ?? -1) > (a ? setScore(a, metric) : -1) ? x : a), null);
    const dw = (s.weight || 0) - (top.weight || 0);
    return showCelebration(exerciseName(we.exerciseId), `Best set: ${fmtRepSet(s)} (+${dw ? `${fmtKg(dw)} kg` : plural(s.reps - top.reps, 'rep', 'reps')})`);
  }
  const isDur = s.durationSec != null;
  const text = isDur ? `Longest set: ${fmtSecs(now)} (+${fmtSecs(now - before)})` : `e10RM ${kgText(now)} (+${fmtKg(Math.round((now - before) * 10) / 10)} kg)`;
  showCelebration(exerciseName(we.exerciseId), text);
}

function showCelebration(title, text) {
  let el = $('#celebrate');
  if (!el) { el = document.createElement('div'); el.id = 'celebrate'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const colors = ['#c6f432', '#46d278', '#f5b14c', '#5fb4ff', '#ff7aa8', '#f2f4f7'];
  const bits = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 + Math.random() * 0.3, d = 90 + Math.random() * 90;
    return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 40}px;--r:${Math.random() * 540 - 270}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 80}ms"></i>`;
  }).join('');
  el.innerHTML = `<div class="burst">${bits}</div>
    <div class="cele-card"><span class="trophy">${ICON_TROPHY}</span><div><small>New record</small><b>${esc(title)}</b><span>${esc(text)}</span></div></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(showCelebration._t);
  showCelebration._t = setTimeout(() => el.classList.remove('show'), 3200);
}

const ICON_TROPHY = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/></svg>';
