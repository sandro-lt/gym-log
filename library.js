/* Built-in exercise library. Entries are only copied into the user's exercises when first used
 * (exercise.libraryId = entry id), so the own list stays short and edits stay possible.
 * One entry per equipment – weights on a barbell and on dumbbells aren't comparable.
 * Row: [name, equipment, primary muscle, 'secondary muscles', metric ('d' = duration)]
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
    ['Push-up', 'Bodyweight', 'chest', 'front_delts triceps abs'],
    ['Chest Dip', 'Bodyweight', 'chest', 'triceps front_delts'],
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
    ['Pull-up', 'Bodyweight', 'lats', 'upper_back biceps forearms'],
    ['Chin-up', 'Bodyweight', 'lats', 'biceps upper_back'],
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
    ['Hyperextension', 'Bodyweight', 'hams', 'glutes lower_back abductors adductors'],
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
    ['Crunch', 'Bodyweight', 'abs', ''],
    ['Crunch', 'Machine', 'abs', ''],
    ['Cable Crunch', 'Cable', 'abs', ''],
    ['Hanging Leg Raise', 'Bodyweight', 'abs', 'forearms'],
    ['Hanging Knee Raise', 'Bodyweight', 'abs', 'forearms'],
    ['Lying Leg Raise', 'Bodyweight', 'abs', ''],
    ["Captain's Chair Leg Raise", 'Bodyweight', 'abs', ''],
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
    metric: metric === 'd' ? 'duration' : 'weight_reps',
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

/** Search over name, equipment and muscle names; every word has to match. */
function librarySearch(list, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((l) => {
    const hay = `${l.name} ${MUSCLES[l.primaryMuscle]} ${l.secondaryMuscles.map((m) => MUSCLES[m]).join(' ')}`.toLowerCase();
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
