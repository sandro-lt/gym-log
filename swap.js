/* Swap an exercise inside a workout (e.g. the machine is taken).
 * Suggests exercises with the same primary muscle first; only this workout changes, never the plan.
 * Loaded after app.js and library.js. */

function openSwap(weId) {
  ui.sheetMode = 'swap';
  ui.sheetWe = weId;
  ui.sheetQuery = '';
  $('#sheet').classList.add('open');
  renderSheet();
}

/** Own exercises and unused library entries as one list: { id, lib, name, primaryMuscle, secondaryMuscles, ex } */
function swapCandidates(excludeId) {
  const own = live('exercises').filter((e) => e.id !== excludeId)
    .map((e) => ({ id: e.id, lib: false, name: e.name, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles || [], ex: e, last: lastPerformance(e.id) }));
  const lib = libraryAvailable().map((l) => ({ id: l.id, lib: true, name: l.name, primaryMuscle: l.primaryMuscle, secondaryMuscles: l.secondaryMuscles, ex: l, last: null }));
  // exercises you have trained come first (most recent on top), then the rest by name
  const order = (a, b) => (b.last?.workout.startedAt || '').localeCompare(a.last?.workout.startedAt || '') || a.name.localeCompare(b.name, 'en');
  return [...own, ...lib].sort(order);
}

function swapItem(c) {
  const sub = c.last ? `Last ${fmtDate(c.last.workout.startedAt)} · ${c.last.sets.map(fmtSet).join(' · ')}` : MUSCLES[c.primaryMuscle] || '';
  return `<li><button data-action="swap-pick" ${c.lib ? `data-lib="${c.id}"` : `data-id="${c.id}"`}>${thumb(c.ex, 'sm')}
    <span><b>${esc(c.name)}</b>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span></button></li>`;
}

function renderSwapSheet() {
  const we = data.workoutExercises.get(ui.sheetWe), cur = data.exercises.get(we.exerciseId);
  const w = data.workouts.get(we.workoutId);
  const q = ui.sheetQuery.trim();
  const all = swapCandidates(we.exerciseId);
  const m = cur?.primaryMuscle;
  let lists;
  if (q) {
    // same muscle first, then exercises that also work it, then the rest
    const rank = (c) => (c.primaryMuscle === m ? 0 : c.secondaryMuscles.includes(m) ? 1 : 2);
    const hits = librarySearch(all, q).map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([c]) => c);
    lists = hits.length ? `<ul class="pick">${hits.map(swapItem).join('')}</ul>` : '<p class="empty">Nothing found.</p>';
  } else if (m) {
    const same = all.filter((c) => c.primaryMuscle === m);
    const also = all.filter((c) => c.primaryMuscle !== m && c.secondaryMuscles.includes(m));
    lists = `
      <h3 class="mg">Same muscle · ${MUSCLES[m]}</h3>
      ${same.length ? `<ul class="pick">${same.map(swapItem).join('')}</ul>` : '<p class="empty">No other exercise for this muscle yet – search below.</p>'}
      ${also.length ? `<h3 class="mg">Also works ${MUSCLES[m]}</h3><ul class="pick">${also.map(swapItem).join('')}</ul>` : ''}`;
  } else {
    lists = '<p class="empty">This exercise has no primary muscle – search for a replacement.</p>';
  }
  const done = setsOf(we.id).filter((s) => s.done).length;
  $('#sheet .body').innerHTML = `
    <div class="sheet-head">
      <button class="btn text back" data-action="swap-back">${ICON.left}Back</button>
      <h2>Swap exercise</h2>
      <button class="btn text" data-action="close-sheet">Done</button>
    </div>
    <div class="swap-from">${thumb(cur, 'sm')}<span><b>${esc(exerciseName(we.exerciseId))}</b>
      <span class="sub">${done ? `${plural(done, 'completed set stays', 'completed sets stay')}, the rest moves over` : 'Sets move over to the new exercise'}${w?.planWorkoutId ? ' · plan stays unchanged' : ''}</span></span></div>
    <input class="search" placeholder="Search any exercise" value="${esc(ui.sheetQuery)}" data-input="sheet-query" autocomplete="off">
    ${lists}`;
}

/** Replace the exercise of a workout entry. Completed sets stay with the old exercise. */
function swapExercise(weId, newExId) {
  const we = data.workoutExercises.get(weId);
  const oldName = exerciseName(we.exerciseId), newName = exerciseName(newExId);
  const sets = setsOf(we.id), done = sets.filter((s) => s.done), open = sets.filter((s) => !s.done);
  const clear = (s, i, target) => Object.assign(s, { workoutExerciseId: target, position: i, weight: null, reps: null, durationSec: null, done: false });

  if (!done.length) {
    we.exerciseId = newExId;
    we.note = null;
    save('workoutExercises', we);
    open.forEach((s, i) => save('sets', clear(s, i, we.id)));
    toast(`Swapped to ${newName}`);
  } else {
    // keep the finished part, continue with the new exercise right below it
    entriesOf(we.workoutId).filter((x) => x.position > we.position).forEach((x) => { x.position += 1; save('workoutExercises', x); });
    const next = save('workoutExercises', { id: uuid(), workoutId: we.workoutId, exerciseId: newExId, position: we.position + 1, note: null });
    if (open.length) open.forEach((s, i) => save('sets', clear(s, i, next.id)));
    else for (let i = 0; i < sets.length; i++) save('sets', { id: uuid(), workoutExerciseId: next.id, position: i, weight: null, reps: null, durationSec: null, done: false });
    toast(`${oldName}: ${plural(done.length, 'set', 'sets')} kept · rest on ${newName}`);
  }
  closeSheet();
  render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'entry-swap': openSwap(ui.sheetWe); break;
    case 'swap-back': ui.sheetMode = 'menu'; ui.sheetQuery = ''; renderSheet(); break;
    case 'swap-pick': swapExercise(ui.sheetWe, el.dataset.id || exerciseFromLibrary(el.dataset.lib).id); break;
  }
});
