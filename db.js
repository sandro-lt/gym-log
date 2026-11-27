/* Lokaler Speicher (IndexedDB).
 *
 * Datenmodell – bewusst "relational" gehalten, damit es später 1:1 in
 * Supabase-Tabellen passt (Sync ohne Umbau):
 *
 *   exercises        { id, libraryId|null (LIBRARY entry it was copied from), name, image|null (JPEG data URL, 360px), metric ('weight_reps'|'reps'|'duration'),
 *                      weightStep (kg, default 2.5), pinnedNote|null (shown in every workout),
 *                      primaryMuscle|null, secondaryMuscles: [] }   (muscle IDs: MUSCLE_GROUPS in app.js)
 *   workouts         { id, name|null, startedAt, endedAt|null, planWorkoutId|null, skipped? }
 *                      (a skipped plan workout is stored as a workout with skipped: true and no exercises)
 *   workoutExercises { id, workoutId, exerciseId, position, note|null }
 *   sets             { id, workoutExerciseId, position, weight|null, reps|null, durationSec|null, done }
 *   plans            { id, name, active }                      (one plan is active)
 *   planWorkouts     { id, planId, name, position }            (run in rotation, in this order)
 *   planExercises    { id, planWorkoutId, exerciseId, position, sets }
 *   charts           { id, position, type ('workouts'|'exercise'), exerciseId|null, value, trend (days, 0 = off) }
 *
 * Jeder Datensatz hat zusätzlich createdAt, updatedAt und deletedAt
 * (Soft-Delete), damit ein späterer Sync Änderungen und Löschungen
 * zusammenführen kann. IDs sind UUIDs.
 */
const DB = (() => {
  const NAME = 'gymlog';
  const VERSION = 3; // v2: plans, v3: charts
  const STORES = ['exercises', 'workouts', 'workoutExercises', 'sets', 'plans', 'planWorkouts', 'planExercises', 'charts'];
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const result = fn(t.objectStore(store));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    STORES,
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
    put: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
    putMany: (store, list) => tx(store, 'readwrite', (s) => { for (const o of list) s.put(o); }),
  };
})();

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}
