/* Rest timer: starts when a set is ticked off in the running workout.
 * Rest length is remembered per exercise (exercise.restSec) – −15 / +15 adjust it.
 * The end time is stored, so the timer survives reloads and the app being in the background.
 * Limitation: a web app can't ring while the iPhone is locked or the app is closed
 * (that would need push notifications from a server). Loaded after app.js. */

const REST_DEFAULT = { weight_reps: 120, duration: 60 };
const REST_MIN = 15, REST_MAX = 600, REST_STEP = 15;
const restOf = (ex) => ex?.restSec || REST_DEFAULT[metricOf(ex)];

let rest = JSON.parse(localStorage.getItem('gymlog.rest') || 'null'); // { endAt, total, exId, over? }
const saveRest = () => (rest ? localStorage.setItem('gymlog.rest', JSON.stringify(rest)) : localStorage.removeItem('gymlog.rest'));

// --- sound (Web Audio has to be unlocked by a tap, which ticking a set is) ---
let audio = null;
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'transient'; // Safari: short sound, music ducks
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
function beep() {
  if (!audio) return;
  const t0 = audio.currentTime + 0.02;
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
    o.connect(g).connect(audio.destination);
    o.start(t0 + d); o.stop(t0 + d + 0.2);
  });
}

function startRest(s) {
  const we = data.workoutExercises.get(s.workoutExerciseId);
  const ex = data.exercises.get(we.exerciseId);
  unlockAudio();
  const total = restOf(ex);
  rest = { endAt: Date.now() + total * 1000, total, exId: ex?.id || null };
  saveRest();
  renderRest();
}

function stopRest() { rest = null; saveRest(); renderRest(); }

function adjustRest(delta) {
  if (!rest) return;
  const left = Math.max(0, rest.endAt - Date.now());
  const total = Math.min(REST_MAX, Math.max(REST_MIN, rest.total + delta));
  rest.endAt = Date.now() + Math.max(0, left + (total - rest.total) * 1000);
  rest.total = total;
  rest.over = false;
  saveRest();
  // remember as this exercise's rest time
  const ex = rest.exId && data.exercises.get(rest.exId);
  if (ex) { ex.restSec = total; save('exercises', ex); }
  renderRest();
}

function renderRest() {
  const el = $('#rest');
  const active = rest && activeWorkout();
  document.body.classList.toggle('resting', !!active);
  if (!active) { el.classList.remove('show', 'over'); return; }
  const left = Math.ceil((rest.endAt - Date.now()) / 1000);
  if (left <= 0 && !rest.over) {
    rest.over = true; saveRest();
    if (Date.now() - rest.endAt < 5000) { beep(); if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 100, 200]); } // not when returning much later
  }
  if (rest.over && Date.now() - rest.endAt > 6000) return stopRest(); // hide a few seconds after the end
  const pct = Math.max(0, Math.min(1, left / rest.total));
  const name = rest.exId ? exerciseName(rest.exId) : '';
  el.classList.add('show');
  el.classList.toggle('over', !!rest.over);
  // build once, then only update text and bar (rebuilding would swallow taps on the buttons)
  if (!el.firstElementChild) el.innerHTML = `
    <div class="rest-bar"></div>
    <div class="rest-main">
      <div class="rest-time"><b></b><small></small></div>
      <button class="rest-btn" data-action="rest-adj" data-d="-${REST_STEP}" aria-label="15 seconds less">−15</button>
      <button class="rest-btn" data-action="rest-adj" data-d="${REST_STEP}" aria-label="15 seconds more">+15</button>
      <button class="rest-btn skip" data-action="rest-skip" aria-label="Skip rest"></button>
    </div>`;
  el.querySelector('.rest-bar').style.setProperty('--p', pct);
  el.querySelector('.rest-time b').textContent = rest.over ? 'Go!' : fmtSecs(Math.max(0, left));
  el.querySelector('.rest-time small').textContent = rest.over ? 'Rest is over' : `Rest · ${name}`;
  el.querySelector('.skip').textContent = rest.over ? 'OK' : 'Skip';
}

setInterval(() => { if (rest) renderRest(); }, 250);
document.addEventListener('visibilitychange', () => { if (!document.hidden && rest) renderRest(); });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'rest-adj') adjustRest(Number(el.dataset.d));
  if (el.dataset.action === 'rest-skip') stopRest();
  // the workout ends -> no more rest
  if (el.dataset.action === 'finish' || el.dataset.action === 'discard') setTimeout(() => { if (!activeWorkout()) stopRest(); });
});
