export {
  fetchAllTasks, upsertTask, deleteTaskById,
  fetchAllAssignments, upsertAssignment, upsertAssignments, deleteAssignment,
  fetchMeta, upsertMeta, loadMetaLocal, saveMetaLocal,
  migrateFromWeeksTable,
  fetchAllTags, upsertTag, deleteTag,
} from "./storage.js";

import { currentWeekKey } from "../lib/dates.js";

export function checkCarryOver(weekAssign, taskReg, meta) {
  const nowKey = currentWeekKey();
  if (meta.carryDoneKey === nowKey) return { shouldCarry: false, sourceKey: null };
  const sourceKey = meta.lastOpenedKey && meta.lastOpenedKey !== nowKey ? meta.lastOpenedKey : null;
  if (!sourceKey) return { shouldCarry: false, sourceKey: null };
  const leftovers = getLeftovers(weekAssign, taskReg, sourceKey, nowKey);
  return { shouldCarry: leftovers.length > 0, sourceKey };
}

export function getLeftovers(weekAssign, taskReg, sourceKey, nowKey) {
  if (!sourceKey) return [];
  const inNow = new Set((weekAssign[nowKey] || []).map((a) => a.taskId));
  return (weekAssign[sourceKey] || [])
    .filter((a) => {
      const t = taskReg[a.taskId];
      return t && !t.done && !inNow.has(a.taskId);
    })
    .map((a) => taskReg[a.taskId]);
}
