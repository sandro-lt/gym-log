/* Charts tab: a list of customisable charts (type, exercise, value, trend) over a shared time range.
 * Loaded after app.js and plans.js – uses their globals. */

const CHART_RANGES = [['1m', '1 month', 30], ['3m', '3 months', 91], ['6m', '6 months', 182], ['1y', '1 year', 365], ['all', 'All time', 0]];
const CHART_TRENDS = [[0, 'Off'], [7, '7 days'], [30, '30 days'], [90, '90 days']];

const kg1 = (v) => `${fmtKg(Math.round(v * 10) / 10)} kg`;
const int = (v) => Math.round(v).toLocaleString('en-GB');

/** Values per chart kind: id -> { label (chip), name, calc(sets) or per-workout calc, fmt, axis } */
const CHART_VALUES = {
  weight_reps: {
    weight: { label: 'kg', name: 'Heaviest set', calc: (ss) => Math.max(...ss.map((s) => s.weight ?? -Infinity)), fmt: kg1 },
    e1rm: { label: '1RM', name: 'Estimated 1RM (best set)', calc: (ss) => Strength.best(ss)?.oneRM, fmt: kg1 },
    e10rm: { label: '10RM', name: 'Estimated 10RM (best set)', calc: (ss) => Strength.best(ss)?.tenRM, fmt: kg1 },
    volume: { label: 'Volume', name: 'Volume (kg × reps)', calc: (ss) => ss.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0), fmt: (v) => `${int(v)} kg` },
    reps: { label: 'Reps', name: 'Most reps in a set', calc: (ss) => Math.max(...ss.map((s) => s.reps ?? -Infinity)), fmt: (v) => `${int(v)} reps` },
  },
  duration: {
    time: { label: 'Time', name: 'Longest set', calc: (ss) => Math.max(...ss.map((s) => s.durationSec ?? -Infinity)), fmt: (v) => fmtSecs(Math.round(v)) },
    total: { label: 'Total', name: 'Total time', calc: (ss) => ss.reduce((n, s) => n + (s.durationSec ?? 0), 0), fmt: (v) => fmtSecs(Math.round(v)) },
  },
  workouts: {
    count: { label: 'Workouts', name: 'Workouts per week', fmt: (v) => plural(Math.round(v * 10) / 10, 'workout', 'workouts'), bars: true },
    duration: { label: 'Duration', name: 'Workout duration', calc: (w) => (new Date(w.endedAt) - new Date(w.startedAt)) / 60000, fmt: (v) => `${int(v)} min` },
    volume: { label: 'Volume', name: 'Volume per workout', calc: (w) => doneSetsOf(w).reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0), fmt: (v) => `${int(v)} kg` },
    sets: { label: 'Sets', name: 'Sets per workout', calc: (w) => doneSetsOf(w).length, fmt: (v) => plural(Math.round(v), 'set', 'sets') },
  },
};

const chartKind = (c) => (c.type === 'workouts' ? 'workouts' : metricOf(data.exercises.get(c.exerciseId)));
const chartValue = (c) => CHART_VALUES[chartKind(c)][c.value] || Object.values(CHART_VALUES[chartKind(c)])[0];
const chartsSorted = () => live('charts').filter((c) => c.type === 'workouts' || data.exercises.get(c.exerciseId) && !data.exercises.get(c.exerciseId).deletedAt)
  .sort((a, b) => a.position - b.position);

ui.chartRange = localStorage.getItem('gymlog.chartRange') || '1m';
ui.chartSel = {}; // chartId -> index of the tapped point
ui.sheetChart = null;

function rangeStart() {
  const days = CHART_RANGES.find((r) => r[0] === ui.chartRange)?.[2] || 0;
  if (!days) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.getTime() - (days - 1) * 864e5;
}
const mondayOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() - ((d.getDay() + 6) % 7) * 864e5; };

/** Points { t (ms), v } sorted by time, limited to the selected range. */
function chartSeries(c) {
  const from = rangeStart();
  const val = chartValue(c);
  let pts = [];
  if (c.type === 'workouts') {
    const ws = countedWorkouts().slice().reverse(); // without deloads
    if (val.bars) {
      // one bar per week (Monday), including empty weeks
      const first = from ?? (ws[0] ? new Date(ws[0].startedAt).getTime() : Date.now());
      const counts = new Map();
      for (const w of ws) { const k = mondayOf(new Date(w.startedAt)); counts.set(k, (counts.get(k) || 0) + 1); }
      for (let k = mondayOf(first); k <= Date.now(); k = mondayOf(k + 8 * 864e5)) pts.push({ t: k, v: counts.get(k) || 0, week: true });
      return pts;
    }
    pts = ws.map((w) => ({ t: new Date(w.startedAt).getTime(), v: val.calc(w) }));
  } else {
    const byWorkout = new Map();
    for (const we of live('workoutExercises')) {
      if (we.exerciseId !== c.exerciseId) continue;
      const w = data.workouts.get(we.workoutId);
      if (!w || w.deletedAt || !w.endedAt || w.skipped || w.deload) continue;
      const sets = setsOf(we.id).filter((s) => s.done);
      if (!sets.length) continue;
      if (!byWorkout.has(w.id)) byWorkout.set(w.id, { t: new Date(w.startedAt).getTime(), sets: [] });
      byWorkout.get(w.id).sets.push(...sets);
    }
    pts = [...byWorkout.values()].map((x) => ({ t: x.t, v: val.calc(x.sets) })).sort((a, b) => a.t - b.t);
  }
  return pts.filter((p) => p.v != null && Number.isFinite(p.v) && (from == null || p.t >= from));
}

/** Least-squares line over the points of the last `days` days: { a, b, t0, t1, change } (v = a + b·t). */
function chartTrend(pts, days) {
  if (!days) return null;
  const from = Date.now() - days * 864e5;
  const p = pts.filter((x) => x.t >= from);
  if (p.length < 2) return { none: true };
  const n = p.length, mx = p.reduce((s, x) => s + x.t, 0) / n, my = p.reduce((s, x) => s + x.v, 0) / n;
  const sxx = p.reduce((s, x) => s + (x.t - mx) ** 2, 0);
  const b = sxx ? p.reduce((s, x) => s + (x.t - mx) * (x.v - my), 0) / sxx : 0;
  const a = my - b * mx;
  // change along the fitted line between the first and last point – never extrapolated
  // beyond the logged data (two workouts minutes apart would otherwise explode)
  return { a, b, t0: p[0].t, t1: p[n - 1].t, change: b * (p[n - 1].t - p[0].t) };
}

function chartSvg(c, pts, trend) {
  const W = 320, H = 150, L = 40, R = 8, T = 10, B = 22;
  const val = chartValue(c);
  const from = val.bars ? pts[0].t : rangeStart() ?? pts[0].t;
  const to = val.bars ? pts[pts.length - 1].t + 7 * 864e5 : Math.max(Date.now(), from + 864e5);
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (val.bars) { lo = 0; hi = Math.max(2, Math.ceil(hi / 2) * 2); } // whole numbers: 0, hi/2, hi
  else if (hi === lo) { const pad = Math.abs(hi) * 0.1 || 1; hi += pad; lo = Math.max(0, lo - pad); }
  else { const pad = (hi - lo) * 0.12; hi += pad; lo = Math.max(0, lo - pad); }
  const x = (t) => L + ((t - from) / (to - from)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const axis = (v) => (c.value === 'time' || c.value === 'total' ? fmtSecs(Math.round(v)) : Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));
  const grid = [hi, (hi + lo) / 2, lo].map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
    <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${axis(v)}</text>`).join('');
  const dates = `<text x="${L}" y="${H - 5}">${fmtDate(new Date(from).toISOString())}</text>
    <text x="${W - R}" y="${H - 5}" text-anchor="end">${val.bars ? 'this week' : 'today'}</text>`;
  const sel = Math.min(ui.chartSel[c.id] ?? Infinity, pts.length - 1);
  let marks;
  if (val.bars) {
    const bw = Math.max(3, Math.min(22, ((W - L - R) / pts.length) * 0.6));
    marks = pts.map((p, i) => `<rect x="${x(p.t + 3.5 * 864e5) - bw / 2}" y="${y(p.v)}" width="${bw}" height="${Math.max(0, y(0) - y(p.v))}" rx="3" class="${i === sel ? 'bar on' : 'bar'}"/>`).join('');
  } else {
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = pts.length > 1 ? `<path d="${line} L${x(pts[pts.length - 1].t).toFixed(1)} ${y(lo)} L${x(pts[0].t).toFixed(1)} ${y(lo)} Z" class="area"/>` : '';
    marks = `${area}<path d="${line}" class="line"/>${pts.map((p, i) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="${i === sel ? 5 : 3}" class="${i === sel ? 'pt on' : 'pt'}"/>`).join('')}`;
  }
  const tl = trend && !trend.none
    ? `<line x1="${x(trend.t0)}" y1="${y(trend.a + trend.b * trend.t0)}" x2="${x(trend.t1)}" y2="${y(trend.a + trend.b * trend.t1)}" class="trendline"/>` : '';
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" data-action="chart-tap" data-chart="${c.id}" data-from="${from}" data-to="${to}" data-l="${L}" data-r="${R}" data-w="${W}" role="img" aria-label="${esc(val.name)} chart">
    ${grid}${dates}${marks}${tl}</svg>`;
}

function chartCard(c) {
  const ex = c.type === 'exercise' ? data.exercises.get(c.exerciseId) : null;
  const val = chartValue(c);
  const pts = chartSeries(c);
  const trend = chartTrend(pts, c.trend);
  const sel = pts[Math.min(ui.chartSel[c.id] ?? Infinity, pts.length - 1)];
  let trendHtml = '';
  if (trend?.none) trendHtml = `<span class="ch-trend">Trend: not enough data</span>`;
  else if (trend) {
    const dir = Math.abs(trend.change) < 1e-9 ? 'same' : trend.change > 0 ? 'up' : 'down';
    const sign = dir === 'up' ? '+' : dir === 'down' ? '−' : '±';
    trendHtml = `<span class="ch-trend ${dir}">${ICON[TREND_ICON[dir]]}${sign}${val.fmt(Math.abs(trend.change))} in ${c.trend} days</span>`;
  }
  return `
    <article class="card chart" data-chart="${c.id}">
      <div class="ch-head">
        <div class="ch-title">${ex ? thumb(ex, 'sm') : ''}<div><b>${esc(ex ? ex.name : 'Training')}</b><span class="sub">${esc(val.name)}</span></div></div>
        <button class="ch-opt" data-action="chart-options" data-chart="${c.id}" aria-label="Chart options">${esc(val.label)}${ICON_WRENCH}</button>
      </div>
      ${pts.length && sel ? `
        <div class="ch-value"><b>${val.fmt(sel.v)}</b><span class="sub">${sel.week ? `week of ${fmtDate(new Date(sel.t).toISOString())}` : fmtDate(new Date(sel.t).toISOString())}</span>${trendHtml}</div>
        ${chartSvg(c, pts, trend)}`
      : `<p class="empty">${ex ? `No ${esc(ex.name)} logged in this time range.` : 'No workouts in this time range.'}</p>`}
    </article>`;
}

const ICON_WRENCH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0 5 5L13 18l-2.5.5L11 16l6.5-6.5"/><path d="M14.5 6.5L5 16l-1 4 4-1 9.5-9.5"/></svg>';

// ---------- Sets per muscle per week (body heat map) ----------
ui.musWeek = 0; // 0 = this week, 1 = last week, …
const MUS_LEVELS = [[17.5, 'h4', '18+'], [8, 'h3', '8–17'], [3, 'h2', '3–7'], [0.5, 'h1', '1–2']];
const musLevel = (n) => MUS_LEVELS.find(([min]) => n >= min)?.[1];
const fmtSets = (n) => String(Math.round(n * 10) / 10);

/** Done sets per muscle group in the week starting at monday (primary = 1, secondary = ½; no deloads). */
function muscleSets(monday) {
  const to = monday + 7 * 864e5, sets = {};
  for (const w of countedWorkouts()) {
    const t = new Date(w.startedAt).getTime();
    if (t < monday || t >= to) continue;
    for (const we of entriesOf(w.id)) {
      const ex = data.exercises.get(we.exerciseId);
      if (!ex?.primaryMuscle) continue;
      const n = setsOf(we.id).filter((s) => s.done).length;
      if (!n) continue;
      sets[ex.primaryMuscle] = (sets[ex.primaryMuscle] || 0) + n;
      for (const m of ex.secondaryMuscles || []) if (m !== ex.primaryMuscle) sets[m] = (sets[m] || 0) + n / 2;
    }
  }
  return sets;
}

function muscleMapCard() {
  const monday = mondayOf(Date.now() - ui.musWeek * 7 * 864e5);
  const sets = muscleSets(monday);
  const levels = Object.fromEntries(Object.entries(sets).map(([m, n]) => [m, musLevel(n)]).filter(([, l]) => l));
  const rows = Object.entries(sets).filter(([m]) => MUSCLES[m]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(17, ...rows.map(([, n]) => n));
  const untrained = Object.keys(MUSCLES).filter((m) => !sets[m]);
  const label = ui.musWeek === 0 ? 'This week' : ui.musWeek === 1 ? 'Last week' : `Week of ${fmtDate(new Date(monday).toISOString())}`;
  const total = rows.reduce((n, [m, v]) => n + v, 0);
  return `
    <article class="card chart mus-card">
      <div class="ch-head">
        <div class="ch-title"><div><b>Sets per muscle</b><span class="sub">${total ? plural(Number(fmtSets(total)), 'set', 'sets') : 'No sets'}</span></div></div>
        <div class="mus-nav">
          <button data-action="mus-week" data-d="1" aria-label="Previous week">${ICON.left}</button>
          <span>${label}</span>
          <button data-action="mus-week" data-d="-1" aria-label="Next week" ${ui.musWeek ? '' : 'disabled'}>${ICON.right}</button>
        </div>
      </div>
      <div class="mus-figs">${['front', 'back'].map((v) => `<img src="${BODY.heatUrl(v, levels)}" alt="${v === 'front' ? 'Front' : 'Back'}">`).join('')}</div>
      <div class="mus-legend"><span><i class="h0"></i>0</span>${[...MUS_LEVELS].reverse().map(([, l, t]) => `<span><i class="${l}"></i>${t}</span>`).join('')}</div>
      ${rows.length ? `
        <ul class="mus-list">${rows.map(([m, n]) => `
          <li><span>${MUSCLES[m]}</span><span class="mus-bar"><i class="${musLevel(n) || 'h1'}" style="width:${Math.max(3, (n / max) * 100)}%"></i></span><b>${fmtSets(n)}</b></li>`).join('')}
        </ul>
        ${untrained.length ? `<p class="mus-none">Not trained: ${untrained.map((m) => MUSCLES[m]).join(', ')}</p>` : ''}
        <p class="mus-none">Primary muscle counts 1 set, secondary muscles ½. Deloads are not counted.</p>`
      : `<p class="empty">No sets logged ${ui.musWeek ? 'in this week' : 'this week yet'}.</p>`}
    </article>`;
}

function viewCharts() {
  const range = CHART_RANGES.find((r) => r[0] === ui.chartRange) || CHART_RANGES[0];
  const list = chartsSorted();
  return `
    <header class="top nav ch-bar">
      <button class="btn text strong" data-action="chart-range">${range[1]} <span class="caret">▾</span></button>
      <button class="btn text strong" data-action="chart-add">Add</button>
    </header>
    <header class="top"><h1>Charts</h1></header>
    ${muscleMapCard()}
    ${list.length ? list.map(chartCard).join('') : `
      <p class="empty">No charts yet. Add one to see how your lifts and training develop.</p>
      <button class="btn primary big wide" data-action="chart-add">Add chart</button>`}`;
}

function addChart() {
  const recent = finishedWorkouts().flatMap((w) => entriesOf(w.id))[0];
  const exId = recent?.exerciseId || exercisesSorted()[0]?.id;
  const c = exId
    ? { id: uuid(), position: live('charts').length, type: 'exercise', exerciseId: exId, value: null, trend: 30 }
    : { id: uuid(), position: live('charts').length, type: 'workouts', exerciseId: null, value: 'count', trend: 30 };
  c.value = Object.keys(CHART_VALUES[chartKind(c)])[c.type === 'exercise' && chartKind(c) === 'weight_reps' ? 2 : 0];
  save('charts', c);
  render();
  openChartSheet('chart', c.id);
}

function openChartSheet(mode, chartId) {
  ui.sheetMode = mode;
  ui.sheetChart = chartId || null;
  $('#sheet').classList.add('open');
  renderSheet();
}

function renderChartSheet() {
  const body = $('#sheet .body');
  if (ui.sheetMode === 'chart-range') {
    body.innerHTML = `
      <div class="sheet-head"><h2>Time range</h2><button class="btn text" data-action="close-sheet">Done</button></div>
      <div class="menu">${CHART_RANGES.map(([id, label]) => `
        <button class="radio ${id === ui.chartRange ? 'on' : ''}" data-action="chart-set-range" data-range="${id}"><span class="dot"></span><span>${label}</span></button>`).join('')}
      </div>`;
    return;
  }
  const c = data.charts.get(ui.sheetChart);
  if (ui.sheetMode === 'chart-ex') {
    body.innerHTML = `
      <div class="sheet-head"><button class="btn text back" data-action="chart-back">${ICON.left}Back</button><h2>Exercise</h2><span></span></div>
      <ul class="pick">${exercisesSorted().map((e) => `<li><button class="${e.id === c.exerciseId ? 'on' : ''}" data-action="chart-set-ex" data-id="${e.id}">${thumb(e, 'sm')}
        <span><b>${esc(e.name)}</b>${e.primaryMuscle ? `<span class="sub">${MUSCLES[e.primaryMuscle]}</span>` : ''}</span></button></li>`).join('')
        || '<li class="empty">No exercises yet.</li>'}</ul>`;
    return;
  }
  const kind = chartKind(c);
  const ex = data.exercises.get(c.exerciseId);
  body.innerHTML = `
    <div class="sheet-head"><h2>Chart options</h2><button class="btn text" data-action="close-sheet">Done</button></div>
    <h3 class="mg">Type</h3>
    <div class="seg">
      <button class="${c.type === 'workouts' ? 'on' : ''}" data-action="chart-type" data-type="workouts">Workouts</button>
      <button class="${c.type === 'exercise' ? 'on' : ''}" data-action="chart-type" data-type="exercise">Exercise</button>
    </div>
    ${c.type === 'exercise' ? `
      <h3 class="mg">Exercise</h3>
      <div class="menu"><button data-action="chart-pick-ex">${ex ? thumb(ex, 'sm') : ''}<span>${esc(ex?.name || 'Choose exercise')}</span><span class="chev">${ICON.right}</span></button></div>` : ''}
    <h3 class="mg">Value</h3>
    <div class="chips ch-chips">${Object.entries(CHART_VALUES[kind]).map(([id, v]) => `
      <button class="chip ${id === c.value ? 'on' : ''}" data-action="chart-value" data-value="${id}">${v.label}</button>`).join('')}</div>
    <p class="hint">${esc(chartValue(c).name)}${c.value === 'e1rm' || c.value === 'e10rm' ? ' – from the set with the highest estimate in each workout' : ''}</p>
    <h3 class="mg">Trend</h3>
    <div class="chips">${CHART_TRENDS.map(([d, label]) => `
      <button class="chip ${d === (c.trend || 0) ? 'on' : ''}" data-action="chart-trend" data-days="${d}">${label}</button>`).join('')}</div>
    <p class="hint">Shows a trend line over the chosen period and how much the value changed.</p>
    <div class="menu ch-actions">
      ${c.position > 0 ? `<button data-action="chart-up">${ICON.up}<span>Move up</span></button>` : ''}
      <button class="danger" data-action="chart-remove">${ICON.trash}<span>Remove chart</span></button>
    </div>`;
}

function updateChart(fn) {
  const c = data.charts.get(ui.sheetChart);
  fn(c);
  const kind = chartKind(c);
  if (!CHART_VALUES[kind][c.value]) c.value = Object.keys(CHART_VALUES[kind])[kind === 'weight_reps' ? 2 : 0];
  delete ui.chartSel[c.id];
  save('charts', c);
  render();
  renderSheet();
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'chart-add': addChart(); break;
    case 'mus-week': ui.musWeek = Math.max(0, ui.musWeek + Number(el.dataset.d)); render(); break;
    case 'chart-range': openChartSheet('chart-range'); break;
    case 'chart-set-range':
      ui.chartRange = el.dataset.range; ui.chartSel = {};
      localStorage.setItem('gymlog.chartRange', ui.chartRange);
      closeSheet(); render(); break;
    case 'chart-options': openChartSheet('chart', el.dataset.chart); break;
    case 'chart-back': ui.sheetMode = 'chart'; renderSheet(); break;
    case 'chart-pick-ex': ui.sheetMode = 'chart-ex'; renderSheet(); break;
    case 'chart-set-ex': ui.sheetMode = 'chart'; updateChart((c) => { c.exerciseId = el.dataset.id; }); break;
    case 'chart-type': updateChart((c) => {
      c.type = el.dataset.type;
      if (c.type === 'exercise' && !data.exercises.get(c.exerciseId)) c.exerciseId = exercisesSorted()[0]?.id || null;
      if (c.type === 'exercise' && !c.exerciseId) { c.type = 'workouts'; toast('Create an exercise first'); }
    }); break;
    case 'chart-value': updateChart((c) => { c.value = el.dataset.value; }); break;
    case 'chart-trend': updateChart((c) => { c.trend = Number(el.dataset.days); }); break;
    case 'chart-up': {
      const list = chartsSorted();
      list.forEach((c, i) => { if (c.position !== i) { c.position = i; save('charts', c); } });
      movePos('charts', list, ui.sheetChart, -1);
      render(); renderSheet(); break;
    }
    case 'chart-remove':
      softDelete('charts', data.charts.get(ui.sheetChart));
      closeSheet(); render(); toast('Chart removed'); break;
    case 'chart-tap': {
      // select the point nearest to the tap
      const c = data.charts.get(el.dataset.chart), pts = chartSeries(c);
      const r = el.getBoundingClientRect(), d = el.dataset;
      const vx = ((e.clientX - r.left) / r.width) * Number(d.w);
      const t = Number(d.from) + ((vx - Number(d.l)) / (Number(d.w) - Number(d.l) - Number(d.r))) * (Number(d.to) - Number(d.from));
      let best = 0;
      const mid = (p) => p.t + (p.week ? 3.5 * 864e5 : 0);
      pts.forEach((p, i) => { if (Math.abs(mid(p) - t) < Math.abs(mid(pts[best]) - t)) best = i; });
      ui.chartSel[c.id] = best;
      render(); break;
    }
  }
});
