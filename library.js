/* Built-in exercise library. Entries are only copied into the user's exercises when first used
 * (exercise.libraryId = entry id), so the own list stays short and edits stay possible.
 * One entry per equipment – weights on a barbell and on dumbbells aren't comparable.
 * Row: [name, equipment, primary muscle, 'secondary muscles', metric ('d' = duration, 'r' = reps with optional added weight)]
 * Muscle IDs: see MUSCLE_GROUPS in app.js. */
const LIBRARY = (() => {
  const rows = [
    // --- Chest ---
    ['Bench Press', 'Barbell', 'chest', 'front_delts triceps'],
    ['Bench Press', 'Dumbbell', 'chest', 'front_delts triceps'],
    ['Bench Press', 'Smith Machine', 'chest', 'front_delts triceps'],
    ['Incline Bench Press', 'Barbell', 'chest', 'front_delts triceps'],
    ['Incline Bench Press', 'Dumbbell', 'chest', 'front_delts triceps'],
    ['Incline Bench Press', 'Smith Machine', 'chest', 'front_delts triceps'],
    ['Decline Bench Press', 'Barbell', 'chest', 'triceps'],
    ['Chest Press', 'Machine', 'chest', 'front_delts triceps'],
    ['Incline Chest Press', 'Machine', 'chest', 'front_delts triceps'],
    ['Chest Fly', 'Dumbbell', 'chest', 'front_delts'],
    ['Incline Chest Fly', 'Dumbbell', 'chest', 'front_delts'],
    ['Chest Fly', 'Machine', 'chest', 'front_delts'],
    ['Cable Fly', 'Cable', 'chest', 'front_delts'],
    ['Low-to-High Cable Fly', 'Cable', 'chest', 'front_delts'],
    ['Push-up', 'Bodyweight', 'chest', 'front_delts triceps abs', 'r'],
    ['Chest Dip', 'Bodyweight', 'chest', 'triceps front_delts', 'r'],
    // --- Back ---
    ['Deadlift', 'Barbell', 'lower_back', 'glutes hams quads traps forearms'],
    ['One-Arm Row', 'Dumbbell', 'upper_back', 'lats rear_delts biceps'],
    ['Chest-Supported Row', 'Dumbbell', 'upper_back', 'lats rear_delts biceps'],
    ['Chest-Supported Row', 'Machine', 'upper_back', 'rear_delts lats traps biceps'],
    ['Helms Row', 'Dumbbell', 'upper_back', 'lats rear_delts biceps'],
    ['T-Bar Row', 'Machine', 'upper_back', 'lats rear_delts biceps'],
    ['Seated Row', 'Cable', 'upper_back', 'lats rear_delts biceps'],
    ['Seated Row', 'Machine', 'upper_back', 'lats rear_delts biceps'],
    ['Lat Pulldown', 'Cable', 'lats', 'upper_back biceps'],
    ['Neutral-wide Lat Pulldown', 'Cable', 'lats', 'upper_back biceps'],
    ['One-Arm Lat Pulldown', 'Cable', 'lats', 'upper_back biceps'],
    ['Lat Pulldown', 'Machine', 'lats', 'upper_back biceps'],
    ['Straight-Arm Pulldown', 'Cable', 'lats', 'triceps'],
    ['Pull-up', 'Bodyweight', 'lats', 'upper_back biceps forearms', 'r'],
    ['Chin-up', 'Bodyweight', 'lats', 'biceps upper_back', 'r'],
    ['Assisted Pull-up', 'Machine', 'lats', 'upper_back biceps'],
    ['Pullover', 'Dumbbell', 'lats', 'chest triceps'],
    ['Pullover', 'Cable', 'lats', 'chest triceps'],
    ['Shrug', 'Dumbbell', 'traps', 'forearms'],
    // --- Shoulders ---
    ['Overhead Press', 'Barbell', 'front_delts', 'side_delts triceps traps'],
    ['Shoulder Press', 'Dumbbell', 'front_delts', 'side_delts triceps'],
    ['Shoulder Press', 'Machine', 'front_delts', 'side_delts triceps'],
    ['Shoulder Press', 'Smith Machine', 'front_delts', 'side_delts triceps'],
    ['Arnold Press', 'Dumbbell', 'front_delts', 'side_delts triceps'],
    ['Lateral Raise', 'Dumbbell', 'side_delts', 'traps'],
    ['Lateral Raise', 'Cable', 'side_delts', 'traps'],
    ['Lateral Raise', 'Machine', 'side_delts', 'traps'],
    ['Reverse Fly', 'Dumbbell', 'rear_delts', 'upper_back'],
    ['Reverse Fly', 'Machine', 'rear_delts', 'upper_back'],
    ['Reverse Cable Fly', 'Cable', 'rear_delts', 'upper_back'],
    ['Face Pull', 'Cable', 'rear_delts', 'upper_back traps'],
    // --- Biceps ---
    ['Biceps Curl', 'Barbell', 'biceps', 'forearms'],
    ['Biceps Curl', 'EZ Bar', 'biceps', 'forearms'],
    ['Biceps Curl', 'Dumbbell', 'biceps', 'forearms'],
    ['Biceps Curl', 'Cable', 'biceps', 'forearms'],
    ['Biceps Curl', 'Machine', 'biceps', 'forearms'],
    ['Hammer Curl', 'Dumbbell', 'biceps', 'forearms'],
    ['Hammer Curl', 'Cable', 'biceps', 'forearms'],
    ['Incline Curl', 'Dumbbell', 'biceps', 'forearms'],
    ['Preacher Curl', 'EZ Bar', 'biceps', 'forearms'],
    ['Preacher Curl', 'Dumbbell', 'biceps', 'forearms'],
    ['Preacher Curl', 'Machine', 'biceps', 'forearms'],
    ['Concentration Curl', 'Dumbbell', 'biceps', ''],
    ['Bayesian Curl', 'Cable', 'biceps', ''],
    // --- Triceps ---
    ['Triceps Pushdown', 'Cable', 'triceps', ''],
    ['Rope Pushdown', 'Cable', 'triceps', ''],
    ['Overhead Triceps Extension', 'Cable', 'triceps', ''],
    ['Overhead Triceps Extension', 'Dumbbell', 'triceps', ''],
    ['Skull Crusher', 'EZ Bar', 'triceps', ''],
    ['Skull Crusher', 'Dumbbell', 'triceps', ''],
    ['Close-Grip Bench Press', 'Barbell', 'triceps', 'chest front_delts'],
    ['Triceps Kickback', 'Cable', 'triceps', ''],
    ['Triceps Extension', 'Machine', 'triceps', ''],
    // --- Forearms ---
    ['Dead Hang', 'Bodyweight', 'forearms', 'lats', 'd'],
    // --- Legs ---
    ['Squat', 'Barbell', 'quads', 'glutes adductors lower_back'],
    ['Squat', 'Smith Machine', 'quads', 'glutes'],
    ['Hack Squat', 'Machine', 'quads', 'glutes'],
    ['Pendulum Squat', 'Machine', 'quads', 'glutes'],
    ['Goblet Squat', 'Dumbbell', 'quads', 'glutes adductors'],
    ['Leg Press', 'Machine', 'quads', 'glutes adductors'],
    ['Bulgarian Split Squat', 'Dumbbell', 'quads', 'glutes adductors'],
    ['Bulgarian Split Squat', 'Smith Machine', 'quads', 'glutes adductors'],
    ['Lunge', 'Dumbbell', 'quads', 'glutes'],
    ['Walking Lunge', 'Dumbbell', 'quads', 'glutes'],
    ['Step-up', 'Dumbbell', 'quads', 'glutes'],
    ['Leg Extension', 'Machine', 'quads', ''],
    ['Lying Leg Curl', 'Machine', 'hams', 'calves'],
    ['Seated Leg Curl', 'Machine', 'hams', 'calves'],
    ['Romanian Deadlift', 'Barbell', 'hams', 'glutes lower_back'],
    ['Romanian Deadlift', 'Dumbbell', 'hams', 'glutes lower_back'],
    ['Hyperextension', 'Bodyweight', 'hams', 'glutes lower_back abductors adductors', 'r'],
    ['Hip Thrust', 'Barbell', 'glutes', 'hams'],
    ['Hip Thrust', 'Machine', 'glutes', 'hams'],
    ['Glute Kickback', 'Cable', 'glutes', 'hams'],
    ['Glute Kickback', 'Machine', 'glutes', 'hams'],
    ['Cable Pull-Through', 'Cable', 'glutes', 'hams'],
    ['Hip Adduction', 'Machine', 'adductors', ''],
    ['Hip Abduction', 'Machine', 'abductors', 'glutes'],
    ['Standing Calf Raise', 'Machine', 'calves', ''],
    ['Seated Calf Raise', 'Machine', 'calves', ''],
    ['Calf Press', 'Machine', 'calves', ''],
    // --- Core ---
    ['Crunch', 'Bodyweight', 'abs', '', 'r'],
    ['Crunch', 'Machine', 'abs', ''],
    ['Cable Crunch', 'Cable', 'abs', ''],
    ['Hanging Leg Raise', 'Bodyweight', 'abs', 'forearms', 'r'],
    ['Hanging Knee Raise', 'Bodyweight', 'abs', 'forearms', 'r'],
    ['Lying Leg Raise', 'Bodyweight', 'abs', '', 'r'],
    ["Captain's Chair Leg Raise", 'Bodyweight', 'abs', '', 'r'],
    ['Plank', 'Bodyweight', 'abs', 'front_delts', 'd'],
    ['Side Plank', 'Bodyweight', 'abs', 'abductors', 'd'],
    ['Hollow Hold', 'Bodyweight', 'abs', '', 'd'],
  ];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return rows.map(([name, equipment, primary, secondary, metric]) => ({
    id: slug(`${name} ${equipment}`),
    name: `${name} · ${equipment}`,
    equipment,
    primaryMuscle: primary,
    secondaryMuscles: secondary ? secondary.split(' ') : [],
    metric: metric === 'd' ? 'duration' : metric === 'r' ? 'reps' : 'weight_reps',
  }));
})();

/** Library entries not yet in the user's exercises (by libraryId or same name). */
function libraryAvailable() {
  const own = live('exercises');
  // deleted copies count too: deleting a library exercise hides it for good
  const ids = new Set([...data.exercises.values()].map((e) => e.libraryId).filter(Boolean));
  const names = new Set(own.map((e) => e.name.toLowerCase()));
  return LIBRARY.filter((l) => !ids.has(l.id) && !names.has(l.name.toLowerCase()));
}

/** Other names people search for (English and German gym slang). Key: part of the English name;
 *  every exercise whose name contains it is also found by these words. */
const SEARCH_ALIASES = {
  'chest fly': 'butterfly pec deck flys flies fliegende',
  'cable fly': 'cable butterfly cable crossover crossover flys flies fliegende kabelzug',
  'reverse fly': 'reverse butterfly rear delt fly reverse pec deck reverse flys',
  'reverse cable fly': 'rear delt fly reverse crossover',
  'face pull': 'rear delt',
  'lat pulldown': 'latzug lat pull pulldown',
  'straight-arm pulldown': 'lat prayer straight arm',
  'pullover': 'überzüge überzug',
  'pull-up': 'pullup pull up klimmzug klimmzüge',
  'chin-up': 'chinup chin up klimmzug klimmzüge untergriff',
  'push-up': 'pushup push up liegestütz liegestütze',
  'dip': 'dips barren',
  'bench press': 'bankdrücken flachbank bench',
  'incline': 'schrägbank',
  'decline': 'negativ',
  'chest press': 'brustpresse',
  'overhead press': 'ohp military press schulterdrücken',
  'shoulder press': 'schulterdrücken schulterpresse',
  'arnold press': 'arnold',
  'lateral raise': 'side raise side lateral seitheben seitenheben',
  'shrug': 'schulterheben shrugs',
  'row': 'rudern rows',
  't-bar row': 'tbar t bar',
  'deadlift': 'kreuzheben dl',
  'romanian deadlift': 'rdl rumänisches stiff leg',
  'squat': 'kniebeuge kniebeugen',
  'hack squat': 'hackenschmidt hack',
  'bulgarian split squat': 'bss split squat',
  'leg press': 'beinpresse',
  'leg extension': 'beinstrecker beinstrecken quad extension',
  'leg curl': 'beinbeuger beinbeugen hamstring curl',
  'hip thrust': 'glute bridge hüftstoß',
  'hip abduction': 'abduktoren abductor',
  'hip adduction': 'adduktoren adductor',
  'glute kickback': 'kickback',
  'calf': 'waden wadenheben',
  'lunge': 'ausfallschritt ausfallschritte',
  'hyperextension': 'back extension rückenstrecker roman chair',
  'skull crusher': 'french press stirndrücken stirnpresse lying triceps extension',
  'triceps pushdown': 'pushdown trizepsdrücken',
  'rope pushdown': 'pushdown trizepsdrücken seil',
  'overhead triceps extension': 'french press überkopf',
  'biceps curl': 'bizeps curl curls',
  'bayesian curl': 'behind the back curl',
  'preacher curl': 'scott curl scottcurl larry scott',
  'hammer curl': 'hammer curls',
  'leg raise': 'beinheben',
  'knee raise': 'knieheben',
  'crunch': 'bauch crunches',
  'plank': 'unterarmstütz',
  'dead hang': 'hängen',
};
const aliasesOf = (name) => {
  const n = name.toLowerCase();
  return Object.entries(SEARCH_ALIASES).filter(([k]) => n.includes(k)).map(([, v]) => v);
};

/** Search over name, equipment, muscle names and other common names; every word has to match. */
function librarySearch(list, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((l) => {
    const muscles = [l.primaryMuscle, ...l.secondaryMuscles].map((m) => MUSCLES[m]).filter(Boolean);
    // English and (in German) the translated name and muscles, so both languages find it
    const hay = [l.name, ...aliasesOf(l.name), ...muscles, ...(I18n.lang === 'en' ? [] : [I18n.t(l.name), ...muscles.map(I18n.t)])].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Copy a library entry into the user's exercises (or return the existing copy). */
function exerciseFromLibrary(libId) {
  const existing = live('exercises').find((e) => e.libraryId === libId);
  if (existing) return existing;
  const l = LIBRARY.find((x) => x.id === libId);
  return save('exercises', {
    id: uuid(), libraryId: l.id, name: l.name, image: null, metric: l.metric, pinnedNote: null,
    primaryMuscle: l.primaryMuscle, secondaryMuscles: [...l.secondaryMuscles],
  });
}

/** v1.22 added the "reps" metric: copies of those library entries made earlier still say weight × reps.
 *  Each exercise is switched once (metricV marks it), so a later choice in the editor stays. */
function migrateMetrics() {
  for (const ex of live('exercises')) {
    if (ex.metricV) continue;
    const l = ex.libraryId && LIBRARY.find((x) => x.id === ex.libraryId);
    if (l?.metric !== 'reps') continue;
    ex.metricV = 2;
    if (ex.metric === 'weight_reps') ex.metric = 'reps';
    save('exercises', ex);
  }
}
