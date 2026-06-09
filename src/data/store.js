export { loadMeta, saveMeta, fetchAllWeeks, upsertWeek } from "./storage.js";

import { currentWeekKey } from "../lib/dates.js";

export function checkCarryOver(weeks, meta) {
  const nowKey    = currentWeekKey();
  if (meta.carriedKeys && meta.carriedKeys.includes(nowKey))
    return { shouldCarry: false, sourceKey: null };
  const sourceKey = meta.lastOpenedKey && meta.lastOpenedKey !== nowKey
    ? meta.lastOpenedKey : null;
  if (!sourceKey) return { shouldCarry: false, sourceKey: null };
  const leftovers = (weeks[sourceKey] || []).filter((t) => !t.done && !t.carriedAway);
  return { shouldCarry: leftovers.length > 0, sourceKey };
}

export function getLeftovers(weeks, sourceKey) {
  if (!sourceKey) return [];
  return (weeks[sourceKey] || []).filter((t) => !t.done && !t.carriedAway);
}
