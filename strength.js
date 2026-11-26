/* Strength estimates (1RM / nRM). Not used in the UI yet – ready for stats later.
 *
 * Method (a common, well-established combination):
 *   - 1 rep          -> the weight itself is the 1RM
 *   - 2–10 reps      -> Brzycki (1993):  1RM = w × 36 / (37 − r)
 *                      most accurate in the low-rep range; basis of the NSCA %1RM tables
 *   - 11–30 reps     -> Epley (1985):    1RM = w × (1 + r / 30)
 *                      Brzycki gets unstable at higher reps, Epley degrades more gently
 *   - more than 30   -> no estimate (all formulas become unreliable)
 *
 * The same pair of formulas, inverted, turns a 1RM into the weight for any rep target (e.g. 10RM).
 * Only use sets that were taken close to failure – estimates from easy sets are too low.
 */
const Strength = (() => {
  const MAX_REPS = 30;
  const valid = (w, r) => w > 0 && Number.isFinite(w) && Number.isInteger(r) && r >= 1 && r <= MAX_REPS;

  /** Estimated one-rep max from a set of `reps` with `weight`. Returns null if not estimable. */
  function oneRepMax(weight, reps) {
    if (!valid(weight, reps)) return null;
    if (reps === 1) return weight;
    if (reps <= 10) return (weight * 36) / (37 - reps); // Brzycki
    return weight * (1 + reps / 30); // Epley
  }

  /** Weight that can be lifted for `reps` repetitions, given a 1RM. */
  function weightForReps(oneRM, reps) {
    if (!valid(oneRM, reps)) return null;
    if (reps === 1) return oneRM;
    if (reps <= 10) return (oneRM * (37 - reps)) / 36; // Brzycki, inverted
    return oneRM / (1 + reps / 30); // Epley, inverted
  }

  /** Estimated n-rep max from any set (e.g. 3 × 100 kg -> estimated 10RM). */
  function repMax(weight, reps, targetReps) {
    const orm = oneRepMax(weight, reps);
    return orm == null ? null : weightForReps(orm, targetReps);
  }

  /** Best estimate over many sets: { oneRM, tenRM, set } or null. Sets need { weight, reps }. */
  function best(sets) {
    let top = null;
    for (const s of sets) {
      const orm = oneRepMax(s.weight, s.reps);
      if (orm != null && (!top || orm > top.oneRM)) top = { oneRM: orm, set: s };
    }
    if (top) top.tenRM = weightForReps(top.oneRM, 10);
    return top;
  }

  return {
    oneRepMax,
    weightForReps,
    repMax,
    tenRepMax: (weight, reps) => repMax(weight, reps, 10),
    best,
  };
})();
