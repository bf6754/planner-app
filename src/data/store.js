// Higher-level data operations built on top of storage.js.
// Components import from here (not from storage.js directly).

import { loadWeeks, saveWeeks, loadMeta, saveMeta } from "./storage.js";
import { currentWeekKey } from "../lib/dates.js";

export { loadWeeks, saveWeeks, loadMeta, saveMeta };

// Determine whether carry-over should be shown on app open.
// Returns { shouldCarry: bool, sourceKey: string|null }
export function checkCarryOver(weeks, meta) {
  const nowKey = currentWeekKey();

  // Already carried into this week → no prompt
  if (meta.carriedKeys && meta.carriedKeys.includes(nowKey)) {
    return { shouldCarry: false, sourceKey: null };
  }

  // Find the last week the user actually opened (not counting the current week)
  const sourceKey = meta.lastOpenedKey && meta.lastOpenedKey !== nowKey
    ? meta.lastOpenedKey
    : null;

  if (!sourceKey) return { shouldCarry: false, sourceKey: null };

  const leftovers = (weeks[sourceKey] || []).filter(
    (t) => !t.done && !t.carriedAway
  );

  return { shouldCarry: leftovers.length > 0, sourceKey };
}

// Remaining leftovers from sourceKey that haven't been carried yet.
export function getLeftovers(weeks, sourceKey) {
  if (!sourceKey) return [];
  return (weeks[sourceKey] || []).filter((t) => !t.done && !t.carriedAway);
}
