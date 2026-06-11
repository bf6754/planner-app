import { dayIndex } from "./dates.js";

export const uid = () => crypto.randomUUID();

export function mkTask(text, overrides = {}) {
  return {
    id: uid(),
    text,
    done: false,
    carried: false,
    claimedDay: null,
    subtasks: [],
    tags: [],
    createdAt: Date.now(),
    priority: null,
    type: null,
    deadline: null,
    notes: "",
    originId: null,
    originKey: null,
    carriedAway: false,
    checkedAway: null,
    ...overrides,
  };
}

export const mkSub = (text, done = false) => ({
  id: uid(),
  text,
  done,
  claimedDay: null,
});

export const floatDone = (arr, isDone) => {
  const a = [], b = [];
  arr.forEach((x) => (isDone(x) ? b : a).push(x));
  return [...a, ...b];
};

// Insert task into list in day-order (Mon→Sun, unassigned last).
export function placeInGroup(list, task) {
  const gi = dayIndex(task.claimedDay);
  let insert = list.length;
  for (let i = 0; i < list.length; i++) {
    if (dayIndex(list[i].claimedDay) > gi) { insert = i; break; }
  }
  const out = [...list];
  out.splice(insert, 0, task);
  return out;
}
