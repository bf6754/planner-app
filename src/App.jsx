import { useState, useEffect, useRef } from "react";
import C from "./theme.js";
import { DAYS, MONTHS, WEEKDAYS, WEEKEND, ymd, fmtDate, fmtRange, getMonday, addDays, dayIndex, currentWeekKey } from "./lib/dates.js";
import { uid, mkTask, mkSub, floatDone, placeInGroup } from "./lib/tasks.js";
import { loadMetaLocal, saveMetaLocal, fetchAllTasks, upsertTask, deleteTaskById, fetchAllAssignments, upsertAssignment, upsertAssignments, deleteAssignment, fetchMeta, upsertMeta, migrateFromWeeksTable, checkCarryOver, getLeftovers, fetchAllTags, upsertTag, deleteTag, fetchAllCategories, upsertCategory, deleteCategory } from "./data/store.js";
import { supabase } from "./data/supabase.js";
import CarryOverModal from "./components/CarryOverModal.jsx";
import TaskDetailModal from "./components/TaskDetailModal.jsx";
import TagManagerModal from "./components/TagManagerModal.jsx";
import CategoryManagerModal from "./components/CategoryManagerModal.jsx";
import Circle from "./components/Circle.jsx";
import { Arrow, Plus, Chev } from "./components/Icons.jsx";

// ── shared button styles ──────────────────────────────────────────────────────
const navBtn = {
  width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.line2}`,
  background: C.card, color: "#5a5c66", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const ghost = {
  border: `1px solid ${C.line2}`, background: "transparent",
  borderRadius: 8, padding: "6px 13px", fontSize: 12.5,
  fontWeight: 600, cursor: "pointer", color: C.sub, fontFamily: "inherit",
};
// Always-visible pill action buttons (pale grey, more contrast on hover)
const pill    = { fontSize: 10.5, fontFamily: "inherit", background: "transparent", border: "1.5px solid", borderRadius: 20, padding: "2px 7px", cursor: "pointer", lineHeight: 1.4, whiteSpace: "nowrap" };
const pillDim = { color: "rgba(140,144,161,0.35)", borderColor: "rgba(140,144,161,0.2)" };
const pillLit = { color: C.sub,                   borderColor: "rgba(140,144,161,0.5)" };

const PRIORITY_COLOR = { low: "#92CBBA", medium: "#F0C274", high: "#E8887F" };

export default function App({ user, onSignOut }) {
  const [taskReg,      setTaskReg]      = useState({});       // { id → task }
  const [weekAssign,   setWeekAssign]   = useState({});       // { weekKey → [assignment] }
  const [dataLoading,  setDataLoading]  = useState(true);
  const [meta,         setMeta]         = useState(loadMetaLocal);
  const [monday,       setMonday]       = useState(() => { const k = currentWeekKey(); const [y,m,d] = k.split("-").map(Number); return new Date(y, m-1, d); });
  const [hideDone,     setHideDone]     = useState(false);
  const [drafts,       setDrafts]       = useState({});
  const [carry,        setCarry]        = useState(null);
  const [overId,       setOverId]       = useState(null);
  const [overBotId,    setOverBotId]    = useState(null);
  const [subDropId,    setSubDropId]    = useState(null);
  const [draggingId,   setDraggingId]   = useState(null);
  const [hoveredId,    setHoveredId]    = useState(null);
  const [addSubFor,    setAddSubFor]    = useState(null);
  const [subMode,      setSubMode]      = useState(new Set());
  const [editingId,    setEditingId]    = useState(null);
  const [editingSubKey,setEditingSubKey]= useState(null);
  const [wkOpen,       setWkOpen]       = useState(false);
  const [ov,           setOv]           = useState({});
  const [vw,           setVw]           = useState(() => window.innerWidth);
  const [openTaskId,   setOpenTaskId]   = useState(null);
  const [tagLib,       setTagLib]       = useState([]);   // [{ id, name, color }]
  const [tagDropId,    setTagDropId]    = useState(null); // task id whose tag dropdown is open
  const [tagMgrOpen,   setTagMgrOpen]   = useState(false);
  const [catLib,       setCatLib]       = useState([]);
  const [catMgrOpen,   setCatMgrOpen]   = useState(false);
  const [groupByCat,   setGroupByCat]   = useState(false);
  const [catHeaderDropId, setCatHeaderDropId] = useState(undefined); // cat.id | 'none' | undefined

  const drag            = useRef(null);
  const dropMode        = useRef(null);
  const dragAllowed     = useRef(false);
  const clickTimerRef   = useRef(null);
  const subDropTimerRef = useRef(null);

  // Echo-suppression: store the updated_at we sent so realtime can skip our own saves
  const taskSavesRef   = useRef({});  // { taskId → updatedAt }
  const assignSavesRef = useRef({});  // { assignId → updatedAt }

  const undoStack = useRef([]);   // undo history — array of { taskReg, weekAssign } snapshots
  const redoStack = useRef([]);   // redo history
  const undoRef   = useRef(null); // stable ref to latest undo fn (avoids stale closure in listener)
  const redoRef   = useRef(null);

  // ── load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const nowKey = currentWeekKey();

    Promise.all([fetchAllTasks(user.id), fetchAllAssignments(user.id), fetchMeta(user.id), fetchAllTags(user.id), fetchAllCategories(user.id)])
      .then(async ([taskData, assignData, remoteMeta, tagsData, catsData]) => {
        setTagLib(tagsData);
        setCatLib(catsData);
        // One-time migration from old weeks table if tasks table is empty
        if (Object.keys(taskData).length === 0) {
          const migrated = await migrateFromWeeksTable(user.id);
          if (migrated) {
            [taskData, assignData] = await Promise.all([fetchAllTasks(user.id), fetchAllAssignments(user.id)]);
          }
        }

        if (!assignData[nowKey]) assignData[nowKey] = [];

        setTaskReg(taskData);
        setWeekAssign(assignData);

        const { shouldCarry, sourceKey } = checkCarryOver(assignData, taskData, remoteMeta);
        if (shouldCarry) setCarry(sourceKey);

        const newMeta = { ...remoteMeta, lastOpenedKey: nowKey };
        setMeta(newMeta);
        saveMetaLocal(newMeta);
        upsertMeta(user.id, newMeta);

        setDataLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setDataLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── real-time sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (dataLoading) return;
    const channel = supabase
      .channel("app-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = payload.old?.id; if (!id) return;
          setTaskReg((prev) => { const n = { ...prev }; delete n[id]; return n; });
        } else {
          const r = payload.new; if (!r) return;
          if (taskSavesRef.current[r.id] && r.updated_at <= taskSavesRef.current[r.id]) return;
          setTaskReg((prev) => ({ ...prev, [r.id]: {
            id: r.id, text: r.text, done: r.done, subtasks: r.subtasks ?? [],
            priority: r.priority ?? null, type: r.type ?? null,
            deadline: r.deadline ?? null, notes: r.notes ?? "",
            tag_ids: r.tag_ids ?? [],
            category_id: r.category_id ?? null,
            createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            updatedAt: r.updated_at,
          }}));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "week_tasks" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const r = payload.old; if (!r) return;
          if (assignSavesRef.current[r.id]) return;
          setWeekAssign((prev) => ({
            ...prev,
            [r.week_key]: (prev[r.week_key] || []).filter((a) => a.id !== r.id),
          }));
        } else {
          const r = payload.new; if (!r) return;
          if (assignSavesRef.current[r.id] && r.updated_at <= assignSavesRef.current[r.id]) return;
          const a = { id: r.id, taskId: r.task_id, weekKey: r.week_key, claimedDay: r.claimed_day ?? null, carried: r.carried, position: r.position };
          setWeekAssign((prev) => {
            const list = prev[r.week_key] || [];
            const idx  = list.findIndex((x) => x.id === r.id);
            const next = idx >= 0 ? list.map((x) => x.id === r.id ? a : x) : [...list, a].sort((x, y) => x.position - y.position);
            return { ...prev, [r.week_key]: next };
          });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [dataLoading]);

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoRef.current?.(); }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redoRef.current?.(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!tagDropId) return;
    const close = () => setTagDropId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [tagDropId]);

  // ── derived ───────────────────────────────────────────────────────────────
  const key      = ymd(monday);
  const nowKey   = currentWeekKey();
  const isThis   = key === nowKey;
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayYmd = ymd(today);
  const isToday  = (day) => ymd(addDays(monday, DAYS.indexOf(day))) === todayYmd;
  const mode     = vw >= 1340 ? "six" : vw >= 900 ? "five" : "one";

  // Current week's task list: assignments ordered by position, merged with task data
  const tasks = (weekAssign[key] || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((wt) => ({ ...taskReg[wt.taskId], claimedDay: wt.claimedDay, carried: wt.carried, _wtId: wt.id }))
    .filter((t) => t.id);

  // ── undo / redo ───────────────────────────────────────────────────────────
  const MAX_UNDO = 20;

  const saveSnapshot = () => {
    undoStack.current = [{ taskReg, weekAssign }, ...undoStack.current.slice(0, MAX_UNDO - 1)];
    redoStack.current = []; // new action clears redo history
  };

  function syncSnapshotToDb(snap) {
    for (const task of Object.values(snap.taskReg)) {
      if (JSON.stringify(task) !== JSON.stringify(taskReg[task.id]))
        upsertTask(user.id, task);
    }
    for (const id of Object.keys(taskReg)) {
      if (!snap.taskReg[id]) deleteTaskById(id);
    }
    const allWeeks = new Set([...Object.keys(snap.weekAssign), ...Object.keys(weekAssign)]);
    for (const wk of allWeeks) {
      const snapList = snap.weekAssign[wk] || [];
      const curList  = weekAssign[wk] || [];
      if (JSON.stringify(snapList) !== JSON.stringify(curList)) {
        const snapIds = new Set(snapList.map((a) => a.id));
        for (const a of curList) { if (!snapIds.has(a.id)) deleteAssignment(a.id); }
        if (snapList.length) upsertAssignments(user.id, snapList);
      }
    }
  }

  function undo() {
    if (!undoStack.current.length) return;
    const snap = undoStack.current.shift();
    redoStack.current = [{ taskReg, weekAssign }, ...redoStack.current.slice(0, MAX_UNDO - 1)];
    syncSnapshotToDb(snap);
    setTaskReg(snap.taskReg);
    setWeekAssign(snap.weekAssign);
  }
  undoRef.current = undo;

  function redo() {
    if (!redoStack.current.length) return;
    const snap = redoStack.current.shift();
    undoStack.current = [{ taskReg, weekAssign }, ...undoStack.current.slice(0, MAX_UNDO - 1)];
    syncSnapshotToDb(snap);
    setTaskReg(snap.taskReg);
    setWeekAssign(snap.weekAssign);
  }
  redoRef.current = redo;

  // ── helpers ───────────────────────────────────────────────────────────────
  const setDraft = (t, v) => setDrafts((d) => ({ ...d, [t]: v }));
  const focusAdd = (t)    => { const el = document.getElementById("add-" + t); if (el) el.focus(); };

  const exitSubMode  = (target) => setSubMode((s) => { const n = new Set(s); n.delete(target); return n; });
  const enterSubMode = (target) => setSubMode((s) => new Set(s).add(target));

  // Save a task and track updated_at for echo suppression
  function saveTask(task) {
    upsertTask(user.id, task).then((ts) => { if (ts) taskSavesRef.current[task.id] = ts; });
  }

  function updateTaskField(id, field, value) {
    const t = taskReg[id]; if (!t) return;
    saveSnapshot();
    const updated = { ...t, [field]: value };
    setTaskReg((prev) => ({ ...prev, [id]: updated }));
    saveTask(updated);
  }

  // ── tag library management ────────────────────────────────────────────────
  const TAG_PALETTE = ["#8FA0C8", "#92CBBA", "#F4A26B", "#E8887F", "#B09FD4", "#7DC5C5", "#F0C274", "#A8C96E"];
  const CAT_PALETTE = ["#E8887F", "#F0C274", "#92CBBA", "#8FA0C8", "#B09FD4", "#7DC5C5", "#F4A26B", "#A8C96E"];

  function createTag(name, color) {
    const tag = { id: uid(), name: name.trim(), color };
    setTagLib((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    upsertTag(user.id, tag);
    return tag;
  }

  function deleteTagFromLib(tagId) {
    setTagLib((prev) => prev.filter((t) => t.id !== tagId));
    deleteTag(tagId);
    const updates = {};
    for (const [id, task] of Object.entries(taskReg)) {
      if (task.tag_ids?.includes(tagId))
        updates[id] = { ...task, tag_ids: task.tag_ids.filter((t) => t !== tagId) };
    }
    if (Object.keys(updates).length) {
      setTaskReg((prev) => ({ ...prev, ...updates }));
      for (const task of Object.values(updates)) saveTask(task);
    }
  }

  function updateTag(tagId, patch) {
    const existing = tagLib.find((t) => t.id === tagId); if (!existing) return;
    const updated = { ...existing, ...patch };
    setTagLib((prev) => prev.map((t) => t.id === tagId ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
    upsertTag(user.id, updated);
  }

  // ── category library management ───────────────────────────────────────────────
  function createCategory(name, color) {
    const cat = { id: uid(), name: name.trim(), color, position: catLib.length };
    setCatLib((prev) => [...prev, cat]);
    upsertCategory(user.id, cat);
    return cat;
  }

  function deleteCategoryFromLib(catId) {
    setCatLib((prev) => prev.filter((c) => c.id !== catId));
    deleteCategory(catId);
    const updates = {};
    for (const [id, task] of Object.entries(taskReg)) {
      if (task.category_id === catId)
        updates[id] = { ...task, category_id: null };
    }
    if (Object.keys(updates).length) {
      setTaskReg((prev) => ({ ...prev, ...updates }));
      for (const task of Object.values(updates)) saveTask(task);
    }
  }

  function updateCategory(catId, patch) {
    const existing = catLib.find((c) => c.id === catId); if (!existing) return;
    const updated = { ...existing, ...patch };
    setCatLib((prev) => prev.map((c) => c.id === catId ? updated : c));
    upsertCategory(user.id, updated);
  }

  function reorderCategories(newOrder) {
    const withPos = newOrder.map((cat, i) => ({ ...cat, position: i }));
    setCatLib(withPos);
    for (const cat of withPos) upsertCategory(user.id, cat);
  }

  // Renumber positions and batch-save all assignments for a week
  function saveAssignList(weekKey, list) {
    const numbered = list.map((a, i) => ({ ...a, position: i }));
    upsertAssignments(user.id, numbered).then((ts) => {
      if (ts) numbered.forEach((a) => { assignSavesRef.current[a.id] = ts; });
    });
    return numbered;
  }

  // Reorder/insert in tasks array (operates on merged task objects with claimedDay),
  // then map back to the underlying assignments.
  function applyTaskListAndSave(weekKey, newMergedList) {
    const currentList = weekAssign[weekKey] || [];
    const newAssignments = newMergedList.map((t, i) => {
      const existing = currentList.find((a) => a.taskId === t.id) || { id: t._wtId };
      return { ...existing, taskId: t.id, weekKey, claimedDay: t.claimedDay, carried: t.carried ?? false, position: i };
    });
    const numbered = saveAssignList(weekKey, newAssignments);
    setWeekAssign((prev) => ({ ...prev, [weekKey]: numbered }));
  }

  // ── task actions ──────────────────────────────────────────────────────────
  function toggle(id) {
    const t = taskReg[id]; if (!t) return;
    saveSnapshot();
    const done    = !t.done;
    const updated = { ...t, done, subtasks: t.subtasks.map((s) => ({ ...s, done })) };
    setTaskReg((prev) => ({ ...prev, [id]: updated }));
    saveTask(updated);
  }

  function toggleSub(pid, sid) {
    const t = taskReg[pid]; if (!t) return;
    saveSnapshot();
    const subs    = t.subtasks.map((s) => s.id === sid ? { ...s, done: !s.done } : s);
    const done    = subs.length > 0 && subs.every((s) => s.done);
    const updated = { ...t, subtasks: subs, done };
    setTaskReg((prev) => ({ ...prev, [pid]: updated }));
    saveTask(updated);
  }

  function deleteTask(id) {
    const wt = (weekAssign[key] || []).find((a) => a.taskId === id); if (!wt) return;
    saveSnapshot();
    const newList = (weekAssign[key] || []).filter((a) => a.taskId !== id);
    const numbered = saveAssignList(key, newList);
    setWeekAssign((prev) => ({ ...prev, [key]: numbered }));
    assignSavesRef.current[wt.id] = "deleted";
    deleteAssignment(wt.id);

    // Delete task record if it has no other week assignments
    const inOtherWeek = Object.entries(weekAssign).some(
      ([wk, list]) => wk !== key && list.some((a) => a.taskId === id)
    );
    if (!inOtherWeek) {
      setTaskReg((prev) => { const n = { ...prev }; delete n[id]; return n; });
      deleteTaskById(id);
    }
    if (addSubFor === id) setAddSubFor(null);
  }

  function deleteSub(pid, sid) {
    const t = taskReg[pid]; if (!t) return;
    saveSnapshot();
    const updated = { ...t, subtasks: t.subtasks.filter((s) => s.id !== sid) };
    setTaskReg((prev) => ({ ...prev, [pid]: updated }));
    saveTask(updated);
  }

  function saveTaskEdit(id, text) {
    text = (text || "").trim();
    if (text) {
      saveSnapshot();
      const updated = { ...taskReg[id], text };
      setTaskReg((prev) => ({ ...prev, [id]: updated }));
      saveTask(updated);
    }
    setEditingId(null);
  }

  function saveSubEdit(pid, sid, text) {
    text = (text || "").trim();
    if (text) {
      saveSnapshot();
      const t = taskReg[pid]; if (!t) return;
      const updated = { ...t, subtasks: t.subtasks.map((s) => s.id === sid ? { ...s, text } : s) };
      setTaskReg((prev) => ({ ...prev, [pid]: updated }));
      saveTask(updated);
    }
    setEditingSubKey(null);
  }

  function startEdit(id) {
    setEditingId(id);
    setTimeout(() => { const el = document.getElementById(`edit-${id}`); if (el) { el.focus(); el.select(); } }, 0);
  }

  function startSubEdit(view, pid, subId) {
    const k = `${view}:${pid}:${subId}`;
    setEditingSubKey(k);
    setTimeout(() => { const el = document.getElementById(`edit-sub-${k}`); if (el) { el.focus(); el.select(); } }, 0);
  }

  async function addTask(target, providedText) {
    const text = (providedText ?? drafts[target] ?? "").trim(); if (!text) return;
    saveSnapshot();
    const claimedDay = target === "week" ? null : target;
    const task = mkTask(text);

    // Find insertion index using placeInGroup on merged task list
    const mockTask   = { ...task, claimedDay };
    const newMerged  = placeInGroup(tasks, mockTask);
    const insertIdx  = newMerged.findIndex((t) => t.id === task.id);

    const assignment = { id: uid(), taskId: task.id, weekKey: key, claimedDay, carried: false, position: insertIdx };
    const currentList = weekAssign[key] || [];
    const spliced = [...currentList.slice(0, insertIdx), assignment, ...currentList.slice(insertIdx)];
    const numbered = spliced.map((a, i) => ({ ...a, position: i }));

    // Optimistic UI update immediately
    setTaskReg((prev) => ({ ...prev, [task.id]: task }));
    setWeekAssign((prev) => ({ ...prev, [key]: numbered }));
    setDraft(target, "");

    // Save task first — assignment has a FK on task_id so task must exist in DB first
    const ts = await upsertTask(user.id, task);
    if (ts) taskSavesRef.current[task.id] = ts;
    upsertAssignments(user.id, numbered).then((ats) => {
      if (ats) numbered.forEach((a) => { assignSavesRef.current[a.id] = ats; });
    });
  }

  function addTaskAsSubtask(target, providedText) {
    const text = (providedText ?? drafts[target] ?? "").trim(); if (!text) return;
    saveSnapshot();
    const claimedDay = target === "week" ? null : target;
    const lastTask   = claimedDay === null
      ? tasks.at(-1)
      : tasks.filter((t) => t.claimedDay === claimedDay).at(-1) ?? tasks.at(-1);
    if (!lastTask) { addTask(target, text); return; }
    const t = taskReg[lastTask.id]; if (!t) return;
    const updated = { ...t, subtasks: [...t.subtasks, mkSub(text)] };
    setTaskReg((prev) => ({ ...prev, [t.id]: updated }));
    saveTask(updated);
    setDraft(target, "");
    setTimeout(() => document.getElementById("add-" + target)?.focus(), 0);
  }

  async function addTaskInCategory(catId, text) {
    text = (text || "").trim(); if (!text) return;
    saveSnapshot();
    const task = { ...mkTask(text), category_id: catId ?? null };
    // Insert after the last task with this category in the current week list
    const currentList = weekAssign[key] || [];
    let insertIdx = tasks.length;
    if (catId) {
      const lastIdx = [...tasks].map((t, i) => ({ t, i })).filter(({ t }) => t.category_id === catId).at(-1)?.i;
      if (lastIdx !== undefined) insertIdx = lastIdx + 1;
    }
    const assignment = { id: uid(), taskId: task.id, weekKey: key, claimedDay: null, carried: false, position: insertIdx };
    const spliced  = [...currentList.slice(0, insertIdx), assignment, ...currentList.slice(insertIdx)];
    const numbered = spliced.map((a, i) => ({ ...a, position: i }));
    setTaskReg((prev) => ({ ...prev, [task.id]: task }));
    setWeekAssign((prev) => ({ ...prev, [key]: numbered }));
    setDraft(`cat-${catId ?? "none"}`, "");
    const ts = await upsertTask(user.id, task);
    if (ts) taskSavesRef.current[task.id] = ts;
    upsertAssignments(user.id, numbered).then((ats) => {
      if (ats) numbered.forEach((a) => { assignSavesRef.current[a.id] = ats; });
    });
  }

  function addSubtask(parentId) {
    const k    = `sub-${parentId}`;
    const text = (drafts[k] || "").trim(); if (!text) return;
    saveSnapshot();
    const t    = taskReg[parentId]; if (!t) return;
    const updated = { ...t, subtasks: [...t.subtasks, mkSub(text)] };
    setTaskReg((prev) => ({ ...prev, [parentId]: updated }));
    saveTask(updated);
    setDraft(k, ""); setAddSubFor(null);
  }

  function claim(id, day) {
    const idx = tasks.findIndex((t) => t.id === id); if (idx < 0) return;
    saveSnapshot();
    const moved     = { ...tasks[idx], claimedDay: day };
    const rest      = tasks.filter((_, i) => i !== idx);
    const newMerged = placeInGroup(rest, moved);
    applyTaskListAndSave(key, newMerged);
  }

  const claimSub = (pid, sid, day) => {
    const t = taskReg[pid]; if (!t) return;
    saveSnapshot();
    const updated = { ...t, subtasks: t.subtasks.map((s) => s.id === sid ? { ...s, claimedDay: day } : s) };
    setTaskReg((prev) => ({ ...prev, [pid]: updated }));
    saveTask(updated);
  };

  function reorder(id, targetId) {
    if (id === targetId) return;
    saveSnapshot();
    const list = [...tasks];
    const from = list.findIndex((t) => t.id === id); if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const to = list.findIndex((t) => t.id === targetId);
    list.splice(to, 0, moved);
    applyTaskListAndSave(key, list);
  }

  function reorderAfter(id, afterId) {
    if (id === afterId) return;
    saveSnapshot();
    const list = [...tasks];
    const from = list.findIndex((t) => t.id === id); if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const to = list.findIndex((t) => t.id === afterId);
    list.splice(to + 1, 0, moved);
    applyTaskListAndSave(key, list);
  }

  // Like reorder/reorderAfter but also assigns the target's category_id to the dragged task when groupByCat
  function reorderWithCatAssign(dragId, targetId, after) {
    if (dragId === targetId) return;
    saveSnapshot();
    const list = [...tasks];
    const from = list.findIndex((t) => t.id === dragId); if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const to = list.findIndex((t) => t.id === targetId);
    list.splice(after ? to + 1 : to, 0, moved);
    applyTaskListAndSave(key, list);
    if (groupByCat) {
      const newCatId = taskReg[targetId]?.category_id ?? null;
      const srcTask  = taskReg[dragId];
      if (srcTask && srcTask.category_id !== newCatId) {
        const updated = { ...srcTask, category_id: newCatId };
        setTaskReg((prev) => ({ ...prev, [dragId]: updated }));
        saveTask(updated);
      }
    }
  }

  // Assign category and optionally move to top of that section
  function assignCategoryAndPlace(dragId, catId) {
    const srcTask = taskReg[dragId]; if (!srcTask) return;
    saveSnapshot();
    const updated = { ...srcTask, category_id: catId };
    setTaskReg((prev) => ({ ...prev, [dragId]: updated }));
    saveTask(updated);
    // Move to just before the first task in this category (or stay put if none)
    const firstInCat = tasks.find((t) => t.id !== dragId && (catId ? t.category_id === catId : !t.category_id));
    if (firstInCat) {
      const list = [...tasks];
      const from = list.findIndex((t) => t.id === dragId); if (from < 0) return;
      const [movedTask] = list.splice(from, 1);
      const to = list.findIndex((t) => t.id === firstInCat.id);
      list.splice(to, 0, movedTask);
      applyTaskListAndSave(key, list);
    }
  }

  function reorderSub(pid, fromSid, targetSid) {
    if (fromSid === targetSid) return;
    saveSnapshot();
    const t = taskReg[pid]; if (!t) return;
    const subs = [...t.subtasks];
    const from = subs.findIndex((s) => s.id === fromSid); if (from < 0) return;
    const [moved] = subs.splice(from, 1);
    const to = subs.findIndex((s) => s.id === targetSid);
    subs.splice(to, 0, moved);
    const updated = { ...t, subtasks: subs };
    setTaskReg((prev) => ({ ...prev, [pid]: updated }));
    saveTask(updated);
  }

  function promoteSubtask(pid, sid) {
    const t   = taskReg[pid]; if (!t) return;
    saveSnapshot();
    const sub = t.subtasks.find((s) => s.id === sid); if (!sub) return;

    const updatedParent = { ...t, subtasks: t.subtasks.filter((s) => s.id !== sid) };
    const newTask       = mkTask(sub.text);
    const parentIdx     = tasks.findIndex((x) => x.id === pid);

    // Insert new task immediately after parent
    const newList = [...tasks];
    newList.splice(parentIdx + 1, 0, { ...newTask, claimedDay: sub.claimedDay, carried: false, _wtId: null });
    applyTaskListAndSave(key, newList);

    setTaskReg((prev) => ({ ...prev, [pid]: updatedParent, [newTask.id]: newTask }));
    saveTask(updatedParent);
    upsertTask(user.id, newTask).then((ts) => { if (ts) taskSavesRef.current[newTask.id] = ts; });
  }

  // ── drag helpers ──────────────────────────────────────────────────────────
  const cleanupDrag = () => {
    if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
    drag.current = null; dropMode.current = null;
    dragAllowed.current = false;
    setOverId(null); setOverBotId(null); setSubDropId(null); setDraggingId(null);
  };

  function dropToDay(day) {
    const d = drag.current; if (!d) return;
    d.t === "task" ? claim(d.id, day) : claimSub(d.pid, d.sid, day);
    cleanupDrag();
  }

  function dropToWeekly() {
    const d = drag.current; if (!d) return;
    if (d.t === "task") {
      claim(d.id, null);
    } else {
      const parent = taskReg[d.pid]; if (!parent) { cleanupDrag(); return; }
      const sub    = parent.subtasks.find((s) => s.id === d.sid); if (!sub) { cleanupDrag(); return; }
      const updatedParent = { ...parent, subtasks: parent.subtasks.filter((s) => s.id !== d.sid) };
      const newTask       = mkTask(sub.text);
      const newList       = [...tasks, { ...newTask, claimedDay: sub.claimedDay, carried: false, _wtId: null }];
      applyTaskListAndSave(key, newList);
      setTaskReg((prev) => ({ ...prev, [d.pid]: updatedParent, [newTask.id]: newTask }));
      saveTask(updatedParent);
      upsertTask(user.id, newTask).then((ts) => { if (ts) taskSavesRef.current[newTask.id] = ts; });
    }
    cleanupDrag();
  }

  function dropAsSubtask(parentId) {
    const d = drag.current; if (!d || d.t !== "task" || d.id === parentId) { cleanupDrag(); return; }
    saveSnapshot();
    const child  = taskReg[d.id]; if (!child) { cleanupDrag(); return; }
    const parent = taskReg[parentId]; if (!parent) { cleanupDrag(); return; }
    const newSubs        = [mkSub(child.text, child.done), ...child.subtasks.map((s) => mkSub(s.text, s.done))];
    const updatedParent  = { ...parent, subtasks: [...parent.subtasks, ...newSubs] };

    const wt = (weekAssign[key] || []).find((a) => a.taskId === d.id);
    const newList = tasks.filter((t) => t.id !== d.id);
    applyTaskListAndSave(key, newList);

    const inOtherWeek = Object.entries(weekAssign).some(
      ([wk, list]) => wk !== key && list.some((a) => a.taskId === d.id)
    );
    setTaskReg((prev) => {
      const n = { ...prev, [parentId]: updatedParent };
      if (!inOtherWeek) delete n[d.id];
      return n;
    });
    saveTask(updatedParent);
    if (wt) { assignSavesRef.current[wt.id] = "deleted"; deleteAssignment(wt.id); }
    if (!inOtherWeek) deleteTaskById(d.id);
    cleanupDrag();
  }

  // ── carry-over ─────────────────────────────────────────────────────────────
  const openCarryOver = () => {
    const sk = meta.lastOpenedKey && meta.lastOpenedKey !== key ? meta.lastOpenedKey : null;
    if (sk) setCarry(sk);
  };

  function confirmCarry(selected) {
    saveSnapshot();
    const currentList = weekAssign[nowKey] || [];
    const maxPos      = currentList.reduce((m, a) => Math.max(m, a.position), -1);
    const newAssignments = [];
    let pos = maxPos + 1;
    for (const taskId of selected) {
      newAssignments.push({ id: uid(), taskId, weekKey: nowKey, claimedDay: null, carried: true, position: pos++ });
    }
    const merged  = [...currentList, ...newAssignments];
    const numbered = merged.map((a, i) => ({ ...a, position: i }));
    const ts = new Date().toISOString();
    upsertAssignments(user.id, numbered).then((savedTs) => {
      if (savedTs) numbered.forEach((a) => { assignSavesRef.current[a.id] = savedTs; });
    });
    setWeekAssign((prev) => ({ ...prev, [nowKey]: numbered }));
    const newMeta = { ...meta, carryDoneKey: nowKey };
    setMeta(newMeta); saveMetaLocal(newMeta); upsertMeta(user.id, newMeta);
    setCarry(null);
  }

  function dismissCarry() {
    const newMeta = { ...meta, carryDoneKey: nowKey };
    setMeta(newMeta); saveMetaLocal(newMeta); upsertMeta(user.id, newMeta);
    setCarry(null);
  }

  // ── computed ───────────────────────────────────────────────────────────────
  const vis       = (l) => hideDone ? l.filter((t) => !t.done) : l;
  const doneCount = tasks.filter((t) => t.done).length;
  const pct       = tasks.length ? (doneCount / tasks.length) * 100 : 0;

  function dayItems(day) {
    const whole = tasks.filter((t) => t.claimedDay === day).map((t) => ({ kind: "task", task: t }));
    const subs  = [];
    tasks.forEach((t) => t.subtasks.forEach((s) => {
      if (s.claimedDay === day && t.claimedDay !== day) subs.push({ kind: "sub", task: t, sub: s });
    }));
    let items = [...whole, ...subs];
    if (hideDone) items = items.filter((it) => it.kind === "sub" ? !it.sub.done : !it.task.done);
    return floatDone(items, (it) => it.kind === "sub" ? it.sub.done : it.task.done);
  }

  function dayStats(day) {
    let total = 0, done = 0;
    tasks.filter((x) => x.claimedDay === day).forEach((x) => {
      const here = x.subtasks.filter((s) => s.claimedDay == null || s.claimedDay === day);
      if (x.subtasks.length > 0 && here.length > 0) here.forEach((s) => { total++; if (s.done) done++; });
      else { total++; if (x.done) done++; }
    });
    tasks.forEach((x) => x.subtasks.forEach((s) => {
      if (s.claimedDay === day && x.claimedDay !== day) { total++; if (s.done) done++; }
    }));
    return { total, done };
  }

  // ── inlined renderers ─────────────────────────────────────────────────────

  function taskRow(task, view, day) {
    const subs      = floatDone(
      view === "day" ? task.subtasks.filter((s) => s.claimedDay == null || s.claimedDay === day) : task.subtasks,
      (s) => s.done
    );
    const txt        = task.done ? C.sub : C.ink;
    const hovered    = hoveredId === `${view}:${task.id}`;
    const isSubDrop  = subDropId === task.id;
    const isEditing  = editingId === task.id;
    const fs         = view === "day" ? 13 : 14;

    const editInputStyle = {
      flex: 1, minWidth: 0, fontSize: fs, lineHeight: 1.35, color: txt,
      border: "none", outline: "none", background: "transparent",
      fontFamily: "inherit", padding: 0,
      textDecoration: task.done ? "line-through" : "none",
    };

    return (
      <div key={task.id}
        draggable={!isEditing}
        onMouseDown={() => { dragAllowed.current = false; }}
        onMouseEnter={() => setHoveredId(`${view}:${task.id}`)}
        onMouseLeave={() => setHoveredId((h) => h === `${view}:${task.id}` ? null : h)}
        onDragStart={(e) => {
          if (isEditing || !dragAllowed.current) { e.preventDefault(); return; }
          drag.current = { t: "task", id: task.id };
          setDraggingId(task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => cleanupDrag()}
        onDragOver={(e) => {
          e.preventDefault();
          if (drag.current?.t !== "task" || drag.current?.id === task.id) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct  = (e.clientY - rect.top) / rect.height;
          if (pct < 0.30) {
            if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
            dropMode.current = { type: "reorder-before", id: task.id };
            setOverId(task.id); setOverBotId(null); setSubDropId(null);
          } else if (pct > 0.70) {
            if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
            dropMode.current = { type: "reorder-after", id: task.id };
            setOverBotId(task.id); setOverId(null); setSubDropId(null);
          } else {
            // Middle zone: only activate subtask after 1.2s hover
            if (dropMode.current?.type === "subtask" && dropMode.current?.id === task.id) return;
            if (dropMode.current?.type === "subtask-pending" && dropMode.current?.id === task.id) return;
            if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
            dropMode.current = { type: "subtask-pending", id: task.id };
            setOverId(null); setOverBotId(null); setSubDropId(null);
            subDropTimerRef.current = setTimeout(() => {
              dropMode.current = { type: "subtask", id: task.id };
              setSubDropId(task.id);
              subDropTimerRef.current = null;
            }, 1200);
          }
        }}
        onDragLeave={() => {
          if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
          if (dropMode.current?.id === task.id) dropMode.current = null;
          setOverId((o) => o === task.id ? null : o);
          setOverBotId((o) => o === task.id ? null : o);
          setSubDropId((o) => o === task.id ? null : o);
        }}
        onDrop={(e) => {
          if (subDropTimerRef.current) { clearTimeout(subDropTimerRef.current); subDropTimerRef.current = null; }
          if (drag.current?.t !== "task") return;
          const dm = dropMode.current;
          if (dm?.type === "subtask" && dm?.id === task.id) {
            e.stopPropagation(); dropAsSubtask(task.id);
          } else if (dm?.type === "reorder-before") {
            e.stopPropagation();
            if (groupByCat) { reorderWithCatAssign(drag.current.id, task.id, false); } else { reorder(drag.current.id, task.id); }
            cleanupDrag();
          } else if (dm?.type === "reorder-after") {
            e.stopPropagation();
            if (groupByCat) { reorderWithCatAssign(drag.current.id, task.id, true); } else { reorderAfter(drag.current.id, task.id); }
            cleanupDrag();
          } else if (dm?.type === "subtask-pending" && dm?.id === task.id) {
            // Dropped before timer fired — treat as reorder-before
            e.stopPropagation();
            if (groupByCat) { reorderWithCatAssign(drag.current.id, task.id, false); } else { reorder(drag.current.id, task.id); }
            cleanupDrag();
          }
        }}
        style={{
          position:     "relative",
          borderTop:    overId === task.id ? `2px solid ${C.done}` : "2px solid transparent",
          borderBottom: overBotId === task.id ? `2px solid ${C.done}` : `1px solid ${C.line}`,
          background:   isSubDrop ? "rgba(170,181,232,0.10)" : "transparent",
          padding:      view === "day" ? "7px 2px" : "9px 4px",
          opacity:      task.done ? 0.55 : 1,
          cursor:       "default",
          boxShadow:    draggingId === task.id ? "0 4px 18px rgba(30,58,95,0.18)" : "none",
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <div
            onMouseDown={(e) => { e.stopPropagation(); dragAllowed.current = true; }}
            onClick={(e) => e.stopPropagation()}
            style={{
              paddingTop: view === "day" ? 3 : 4, cursor: "grab", color: C.sub,
              opacity: hovered ? 0.35 : 0, transition: "opacity 0.12s",
              userSelect: "none", flexShrink: 0, fontSize: 13, lineHeight: 1,
            }}>⠿</div>
          <div style={{ paddingTop: 1 }} onClick={(e) => e.stopPropagation()}>
            <Circle done={task.done} size={view === "day" ? 16 : 18} onClick={() => toggle(task.id)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {task.priority && PRIORITY_COLOR[task.priority] && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
              )}
              {isEditing ? (
                <input
                  id={`edit-${task.id}`}
                  defaultValue={task.text}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { e.preventDefault(); saveTaskEdit(task.id, e.target.value); }
                    if (e.key === "Escape") { setEditingId(null); }
                  }}
                  onBlur={(e) => saveTaskEdit(task.id, e.target.value)}
                  style={{ ...editInputStyle, flex: 1, borderBottom: `1.5px solid ${C.accent}` }}
                />
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = setTimeout(() => { setOpenTaskId(task.id); clickTimerRef.current = null; }, 200);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                    startEdit(task.id);
                  }}
                  style={{ ...(mode === "one" && { flex: 1, minWidth: 0 }), fontSize: fs, lineHeight: 1.35, color: txt, textDecoration: task.done ? "line-through" : "none", wordBreak: "break-word", cursor: "pointer" }}>
                  {task.text}
                </span>
              )}
              {!isEditing && (
                <div style={{ display: "flex", gap: 3, flexShrink: 0, ...(mode === "one" && { marginLeft: "auto" }) }}>
                  {!addSubFor && (
                    <button className="pill" onClick={(e) => { e.stopPropagation(); setAddSubFor(task.id); setTimeout(() => document.getElementById(`add-sub-${task.id}`)?.focus(), 0); }} title="Add subtask"
                      style={{ ...pill, ...(hovered ? pillLit : pillDim) }}>+ sub</button>
                  )}
                  <button className="pill" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} title="Delete"
                    style={{ ...pill, ...(hovered ? pillLit : pillDim) }}>×</button>
                  <button className="pill" onClick={(e) => { e.stopPropagation(); setTagDropId((id) => id === task.id ? null : task.id); }} title="Tags"
                    style={{ ...pill, ...(hovered || tagDropId === task.id ? pillLit : pillDim) }}>#</button>
                </div>
              )}
              {!isEditing && view === "week" && task.claimedDay && <span style={{ fontSize: 11, color: C.sub, fontWeight: 500, flexShrink: 0 }}>{task.claimedDay}</span>}
            </div>

            {/* category label (inline, only when not in grouped view) + tag pills */}
            {(!groupByCat && task.category_id || task.tag_ids?.length > 0) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                {!groupByCat && task.category_id && (() => {
                  const cat = catLib.find((c) => c.id === task.category_id);
                  return cat ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: cat.color, letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {cat.name}
                    </span>
                  ) : null;
                })()}
                {task.tag_ids?.map((tid) => {
                  const tag = tagLib.find((t) => t.id === tid);
                  return tag ? (
                    <span key={tid} style={{ fontSize: 10, fontWeight: 600, color: tag.color, background: tag.color + "1a", border: `1px solid ${tag.color}40`, borderRadius: 10, padding: "1px 6px" }}>
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* subtasks list */}
            {subs.length > 0 && (
              <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 8 }}>
                {subs.map((s) => {
                  const subKey     = `${task.id}:${s.id}`;
                  const subHovered = hoveredId === `week:sub:${s.id}`;
                  const subEditing = editingSubKey === `week:${subKey}`;
                  const subEditStyle = {
                    flex: 1, minWidth: 0, fontSize: fs,
                    color: s.done ? C.sub : "#52545d",
                    border: "none", outline: "none", background: "transparent",
                    fontFamily: "inherit", padding: 0,
                    textDecoration: s.done ? "line-through" : "none",
                  };
                  return (
                    <div key={s.id}
                      draggable={!subEditing}
                      onMouseEnter={() => setHoveredId(`week:sub:${s.id}`)}
                      onMouseLeave={() => setHoveredId((h) => h === `week:sub:${s.id}` ? null : h)}
                      onDragStart={(e) => { if (subEditing) { e.preventDefault(); return; } e.stopPropagation(); drag.current = { t: "sub", pid: task.id, sid: s.id }; e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (drag.current?.t === "sub" && drag.current?.pid === task.id && drag.current?.sid !== s.id)
                          setOverId(s.id);
                      }}
                      onDragLeave={() => setOverId((o) => o === s.id ? null : o)}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (drag.current?.t === "sub" && drag.current?.pid === task.id && drag.current?.sid !== s.id) {
                          reorderSub(task.id, drag.current.sid, s.id); cleanupDrag();
                        }
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        cursor: subEditing ? "default" : "grab",
                        borderTop: overId === s.id ? `2px solid ${C.done}` : "2px solid transparent",
                      }}>
                      <Circle done={s.done} size={view === "day" ? 14 : 15} onClick={() => toggleSub(task.id, s.id)} />
                      {subEditing ? (
                        <input
                          id={`edit-sub-week:${task.id}:${s.id}`}
                          defaultValue={s.text}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  { e.preventDefault(); saveSubEdit(task.id, s.id, e.target.value); }
                            if (e.key === "Escape") { setEditingSubKey(null); }
                          }}
                          onBlur={(e) => saveSubEdit(task.id, s.id, e.target.value)}
                          style={{ ...subEditStyle, borderBottom: `1.5px solid ${C.accent}` }}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); startSubEdit("week", task.id, s.id); }}
                          style={{ ...(mode === "one" && { flex: 1 }), fontSize: fs, color: s.done ? C.sub : "#52545d", textDecoration: s.done ? "line-through" : "none", cursor: "text" }}>
                          {s.text}
                        </span>
                      )}
                      {!subEditing && view === "week" && s.claimedDay && <span style={{ fontSize: 11, color: C.sub }}>{s.claimedDay}</span>}
                      {!subEditing && (
                        <div style={{ display: "flex", gap: 3, flexShrink: 0, ...(mode === "one" && { marginLeft: "auto" }) }}>
                          <button className="pill" onClick={(e) => { e.stopPropagation(); promoteSubtask(task.id, s.id); }} title="Lift to task"
                            style={{ ...pill, ...(subHovered ? pillLit : pillDim) }}>↑</button>
                          <button className="pill" onClick={(e) => { e.stopPropagation(); deleteSub(task.id, s.id); }} title="Delete subtask"
                            style={{ ...pill, ...(subHovered ? pillLit : pillDim) }}>×</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* inline add-subtask input */}
            {addSubFor === task.id && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, marginTop: 5 }}>
                <span style={{ width: view === "day" ? 14 : 15, height: view === "day" ? 14 : 15, minWidth: view === "day" ? 14 : 15, borderRadius: "50%", border: `2px dashed ${C.line2}`, flexShrink: 0 }} />
                <input
                  id={`add-sub-${task.id}`}
                  value={drafts[`sub-${task.id}`] || ""}
                  onChange={(e) => setDraft(`sub-${task.id}`, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  addSubtask(task.id);
                    if (e.key === "Escape") { setAddSubFor(null); setDraft(`sub-${task.id}`, ""); }
                  }}
                  onBlur={() => { if ((drafts[`sub-${task.id}`] || "").trim()) addSubtask(task.id); else setAddSubFor(null); }}
                  placeholder="New subtask"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: fs, color: C.ink, fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* inline tag dropdown */}
        {tagDropId === task.id && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: "100%", left: 0, minWidth: 200, zIndex: 30, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(30,58,95,0.12)", overflow: "hidden" }}>
            {tagLib.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12, color: C.sub }}>No tags yet</div>}
            {tagLib.map((tag) => {
              const active = (task.tag_ids || []).includes(tag.id);
              return (
                <div key={tag.id}
                  onClick={() => {
                    const ids = task.tag_ids || [];
                    updateTaskField(task.id, "tag_ids", active ? ids.filter((i) => i !== tag.id) : [...ids, tag.id]);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12.5 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: active ? tag.color : C.ink, fontWeight: active ? 600 : 400 }}>{tag.name}</span>
                  {active && <span style={{ fontSize: 11, color: tag.color }}>✓</span>}
                </div>
              );
            })}
            <div style={{ borderTop: tagLib.length ? `1px solid ${C.line}` : "none", padding: "6px 10px" }}>
              <input
                autoFocus
                placeholder="New tag…"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: C.ink, fontFamily: "inherit", width: "100%" }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    const name = e.target.value.trim(); if (!name) return;
                    const color = TAG_PALETTE[tagLib.length % TAG_PALETTE.length];
                    const newTag = createTag(name, color);
                    const ids = task.tag_ids || [];
                    updateTaskField(task.id, "tag_ids", [...ids, newTag.id]);
                    e.target.value = "";
                  }
                  if (e.key === "Escape") setTagDropId(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  function subOnDay(task, sub) {
    const subHovered = hoveredId === `day:sub:${sub.id}`;
    const subKey     = `${task.id}:${sub.id}`;
    const subEditing = editingSubKey === `day:${subKey}`;
    return (
      <div key={sub.id}
        draggable={!subEditing}
        onMouseEnter={() => setHoveredId(`day:sub:${sub.id}`)}
        onMouseLeave={() => setHoveredId((h) => h === `day:sub:${sub.id}` ? null : h)}
        onDragStart={(e) => { if (subEditing) { e.preventDefault(); return; } drag.current = { t: "sub", pid: task.id, sid: sub.id }; e.dataTransfer.effectAllowed = "move"; }}
        style={{ borderBottom: `1px solid ${C.line}`, padding: "7px 2px", opacity: sub.done ? 0.55 : 1, cursor: subEditing ? "default" : "grab" }}>
        <div style={{ fontSize: 10.5, fontStyle: "italic", color: C.sub, marginBottom: 3, marginLeft: 25 }}>{task.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Circle done={sub.done} size={16} onClick={() => toggleSub(task.id, sub.id)} />
          {subEditing ? (
            <input
              id={`edit-sub-day:${task.id}:${sub.id}`}
              defaultValue={sub.text}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); saveSubEdit(task.id, sub.id, e.target.value); }
                if (e.key === "Escape") { setEditingSubKey(null); }
              }}
              onBlur={(e) => saveSubEdit(task.id, sub.id, e.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: sub.done ? C.sub : "#565860", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", padding: 0, textDecoration: sub.done ? "line-through" : "none", borderBottom: `1.5px solid ${C.accent}` }}
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); startSubEdit("day", task.id, sub.id); }}
              style={{ ...(mode === "one" && { flex: 1 }), fontSize: 13, color: sub.done ? C.sub : "#565860", textDecoration: sub.done ? "line-through" : "none", cursor: "text" }}>
              {sub.text}
            </span>
          )}
          {!subEditing && (
            <div style={{ display: "flex", gap: 3, flexShrink: 0, ...(mode === "one" && { marginLeft: "auto" }) }}>
              <button className="pill" onClick={(e) => { e.stopPropagation(); promoteSubtask(task.id, sub.id); }} title="Lift to task"
                style={{ ...pill, ...(subHovered ? pillLit : pillDim) }}>↑</button>
              <button className="pill" onClick={(e) => { e.stopPropagation(); deleteSub(task.id, sub.id); }} title="Delete subtask"
                style={{ ...pill, ...(subHovered ? pillLit : pillDim) }}>×</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function addSlot(target, compact) {
    const inSubMode = subMode.has(target);
    const sz = compact ? 16 : 18;
    return (
      <div key="add" style={{ display: "flex", alignItems: "center", gap: 9, padding: compact ? "7px 2px" : "9px 4px", paddingLeft: inSubMode ? (compact ? 26 : 30) : undefined }}>
        <span style={{ width: sz, height: sz, minWidth: sz, borderRadius: "50%", border: `2px dashed ${inSubMode ? C.carryDot : C.line2}`, flexShrink: 0 }} />
        <input
          id={"add-" + target}
          value={drafts[target] || ""}
          onChange={(e) => setDraft(target, e.target.value)}
          onKeyDown={(e) => {
            const raw = e.target.value;
            if (e.key === "Enter") {
              if (inSubMode) {
                if (raw.trim()) addTaskAsSubtask(target, raw);
                else exitSubMode(target);
              } else {
                addTask(target, raw);
              }
            }
            if (e.key === "Tab") { e.preventDefault(); enterSubMode(target); }
            if ((e.key === "Backspace" || e.key === "Delete") && raw.length === 0 && inSubMode) {
              e.preventDefault(); exitSubMode(target);
            }
          }}
          placeholder={inSubMode ? "New subtask · Enter to add, Backspace to exit" : "New task · Tab to add as subtask"}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: compact ? 13 : 14, color: inSubMode ? C.carryInk : C.ink, fontFamily: "inherit" }}
        />
      </div>
    );
  }

  function addSlotCat(catId) {
    const k = `cat-${catId ?? "none"}`;
    return (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 4px" }}>
        <span style={{ width: 13, flexShrink: 0 }} />
        <span style={{ width: 18, height: 18, minWidth: 18, borderRadius: "50%", border: `2px dashed ${C.line2}`, flexShrink: 0 }} />
        <input
          id={`add-${k}`}
          value={drafts[k] || ""}
          onChange={(e) => setDraft(k, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTaskInCategory(catId, drafts[k] || "");
            if (e.key === "Escape") setDraft(k, "");
          }}
          placeholder="New task…"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: C.ink, fontFamily: "inherit" }}
        />
      </div>
    );
  }

  function dayCol(day) {
    const date  = addDays(monday, DAYS.indexOf(day));
    const t     = isToday(day);
    const past  = date < today;
    const items = dayItems(day);
    const { total, done } = dayStats(day);
    const ovKey = key + ":" + day;
    const auto  = mode === "one" && past && total > 0 && done === total;
    const open  = ov[ovKey] !== undefined ? ov[ovKey] : !auto;
    const toggleOpen = () => setOv((o) => ({ ...o, [ovKey]: !open }));

    return (
      <div key={day}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropToDay(day)}
        style={{
          background:  past ? "#EFF1F7" : C.card,
          border:      `1px solid ${t ? C.line2 : C.line}`,
          borderTop:   t ? `2px solid ${C.done}` : `1px solid ${C.line}`,
          borderRadius: 10, padding: "9px 10px 4px",
          display: "flex", flexDirection: "column",
          alignSelf:  open ? "stretch" : "start",
          height:     open ? "100%" : "auto",
          minHeight:  open ? 200 : undefined,
          opacity:    past ? 0.9 : 1,
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={toggleOpen} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
            <span style={{ color: C.sub, display: "flex" }}><Chev open={open} /></span>
            {t
              ? <span><span style={{ color: C.doneInk, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5, marginRight: 6 }}>TODAY</span><span style={{ fontWeight: 700, color: C.ink, fontSize: 12.5 }}>{day} {date.getDate()}</span></span>
              : <span style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>{day} <span style={{ color: C.sub, fontWeight: 400 }}>{date.getDate()}</span></span>
            }
          </button>
          {open && <button onClick={() => focusAdd(day)} title="Add task" style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 2, display: "flex" }}><Plus s={14} /></button>}
        </div>
        <div style={{ height: 4, background: C.line, borderRadius: 4, margin: "7px 0 8px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: C.done, transition: "width .3s" }} />
        </div>
        {open && (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {groupByCat ? (() => {
                const dayCatGroups = catLib
                  .map((cat) => ({ cat, items: items.filter((it) => (it.kind === "task" ? it.task : it.task).category_id === cat.id) }))
                  .filter((g) => g.items.length > 0);
                const otherItems = items.filter((it) => {
                  const catId = (it.kind === "task" ? it.task : it.task).category_id;
                  return !catId || !catLib.find((c) => c.id === catId);
                });
                const allGroups = [...dayCatGroups, ...(otherItems.length > 0 ? [{ cat: null, items: otherItems }] : [])];
                return allGroups.map(({ cat, items: gItems }, gIdx) => (
                  <div key={cat?.id ?? "other"}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: gIdx === 0 ? "1px 0 1px" : "5px 0 1px" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: cat ? cat.color : C.sub, textTransform: "uppercase" }}>
                        {cat ? cat.name : "Other"}
                      </span>
                      <div style={{ flex: 1, height: 1, background: cat ? cat.color + "30" : C.line }} />
                    </div>
                    {gItems.map((it) => it.kind === "task" ? taskRow(it.task, "day", day) : subOnDay(it.task, it.sub))}
                  </div>
                ));
              })() : items.map((it) => it.kind === "task" ? taskRow(it.task, "day", day) : subOnDay(it.task, it.sub))}
              {addSlot(day, true)}
            </div>
            <div style={{ flex: 1, minHeight: 10, cursor: "text" }} onClick={() => focusAdd(day)} />
          </>
        )}
      </div>
    );
  }

  // ── grid layout ────────────────────────────────────────────────────────────
  const colStr = mode === "one"
    ? "minmax(0,1fr)"
    : (() => {
        const wd = WEEKDAYS.map((d) => isToday(d) ? "minmax(0,1.5fr)" : "minmax(0,1fr)");
        if (mode === "six") wd.push(WEEKEND.some(isToday) ? "minmax(0,1.3fr)" : "minmax(0,1fr)");
        return wd.join(" ");
      })();

  const weekendHasContent = WEEKEND.some((d) =>
    tasks.some((t) => t.claimedDay === d) ||
    tasks.some((t) => t.subtasks.some((s) => s.claimedDay === d))
  );
  const weekendOpen   = weekendHasContent || wkOpen;
  const weekendCols   = mode === "one" ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))";
  const carryLeftovers = carry ? getLeftovers(weekAssign, taskReg, carry, nowKey) : [];

  // ── render ─────────────────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <span style={{ color: C.sub, fontSize: 14 }}>Loading your tasks…</span>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", color: C.ink, padding: "20px 24px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .days-grid { display: grid; grid-template-columns: ${colStr}; gap: 10px; align-items: stretch; }
        .we-grid   { display: grid; grid-template-columns: ${weekendCols}; gap: 10px; align-items: stretch; }
        button:hover { filter: brightness(0.98); }
        .pill:hover { background: rgba(0,0,0,0.05) !important; }
        ::selection { background: rgba(143,180,232,0.35); }
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Weekly</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setMonday((m) => addDays(m, -7))} style={navBtn}><Arrow dir="left" /></button>
            <div style={{ fontSize: 14.5, fontWeight: 500, minWidth: 150, textAlign: "center", color: "#3d3f48" }}>{fmtRange(monday)}</div>
            <button onClick={() => setMonday((m) => addDays(m, 7))} style={navBtn}><Arrow dir="right" /></button>
          </div>
          {!isThis && (
            <button onClick={() => { const k = currentWeekKey(); const [y,m,d] = k.split("-").map(Number); setMonday(new Date(y,m-1,d)); }} style={ghost}>
              This week
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={openCarryOver} style={ghost}>Carry-over</button>
          <button onClick={() => setCatMgrOpen(true)} style={ghost}>Manage categories</button>
          <button onClick={() => setTagMgrOpen(true)} style={ghost}>Manage tags</button>
          <button
            onClick={() => setGroupByCat((g) => !g)}
            style={{ ...ghost, background: groupByCat ? C.done : "transparent", color: groupByCat ? C.doneInk : C.sub, borderColor: groupByCat ? C.done : C.line2 }}>
            Group by categories
          </button>
          <button
            onClick={() => setHideDone((h) => !h)}
            style={{ ...ghost, background: hideDone ? C.done : "transparent", color: hideDone ? C.doneInk : C.sub, borderColor: hideDone ? C.done : C.line2 }}>
            {hideDone ? "Show done" : "Hide done"}
          </button>
          <button onClick={async () => {
            if (!window.confirm("Delete ALL tasks for ALL weeks? This cannot be undone.")) return;
            await supabase.from("tasks").delete().eq("user_id", user.id);
            setTaskReg({}); setWeekAssign({ [key]: [] });
          }} style={{ ...ghost, fontSize: 11.5, color: "#c0392b", borderColor: "#e8b4b0" }}>Clear all</button>
          <button onClick={onSignOut} title={`Signed in as ${user.email}`} style={{ ...ghost, fontSize: 11.5 }}>Sign out</button>
        </div>
      </div>

      {/* weekly panel */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropToWeekly()}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px 6px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>This week</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 500 }}>{doneCount}/{tasks.length}</span>
            <div style={{ width: 130, height: 5, background: C.line, borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: C.done, transition: "width .3s" }} />
            </div>
            <button onClick={() => focusAdd(groupByCat ? "cat-none" : "week")} title="Add task"
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 1px 2px rgba(30,58,95,0.18)" }}>
              <Plus s={14} /> Add task
            </button>
          </div>
        </div>
        {groupByCat ? (() => {
          const groups = catLib.map((cat) => ({
            cat,
            items: vis(tasks).filter((t) => t.category_id === cat.id),
          }));
          const otherItems = vis(tasks).filter((t) => !t.category_id || !catLib.find((c) => c.id === t.category_id));
          groups.push({ cat: null, items: otherItems });
          return groups.map(({ cat, items }) => {
            const dropKey = cat ? cat.id : "none";
            const isHeaderDrop = catHeaderDropId === dropKey;
            return (
              <div key={dropKey}>
                <div
                  onDragOver={(e) => { e.preventDefault(); if (drag.current?.t === "task") setCatHeaderDropId(dropKey); }}
                  onDragLeave={() => setCatHeaderDropId((v) => v === dropKey ? undefined : v)}
                  onDrop={(e) => {
                    if (drag.current?.t !== "task") return;
                    e.stopPropagation();
                    assignCategoryAndPlace(drag.current.id, cat?.id ?? null);
                    setCatHeaderDropId(undefined);
                    cleanupDrag();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px 4px", borderRadius: 6, background: isHeaderDrop ? (cat ? cat.color + "14" : "rgba(140,144,161,0.08)") : "transparent", transition: "background 0.12s", cursor: "default" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: cat ? cat.color : C.sub, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {cat ? cat.name : "Other"}
                  </span>
                  <div style={{ flex: 1, height: 1, background: cat ? cat.color + "40" : C.line }} />
                </div>
                {floatDone(items, (t) => t.done).map((t) => taskRow(t, "week"))}
                {addSlotCat(cat?.id ?? null)}
              </div>
            );
          });
        })() : (
          <>
            {floatDone(vis(tasks), (t) => t.done).map((t) => taskRow(t, "week"))}
            {addSlot("week", false)}
          </>
        )}
      </div>

      {/* weekday grid */}
      <div className="days-grid">
        {WEEKDAYS.map((d) => dayCol(d))}
        {mode === "six" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WEEKEND.map((d) => dayCol(d))}
          </div>
        )}
      </div>

      {/* weekend accordion */}
      {mode !== "six" && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => !weekendHasContent && setWkOpen((o) => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", cursor: weekendHasContent ? "default" : "pointer", color: C.sub, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            <Chev open={weekendOpen} /> Weekend {weekendHasContent && <span style={{ fontSize: 11, fontWeight: 400 }}>· in use</span>}
          </button>
          {weekendOpen && <div className="we-grid" style={{ marginTop: 10 }}>{WEEKEND.map((d) => dayCol(d))}</div>}
        </div>
      )}

      {/* carry-over modal */}
      {carry && <CarryOverModal leftovers={carryLeftovers} onConfirm={confirmCarry} onDone={dismissCarry} />}

      {/* task detail modal */}
      {openTaskId && taskReg[openTaskId] && (
        <TaskDetailModal
          task={taskReg[openTaskId]}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(field, value) => updateTaskField(openTaskId, field, value)}
          tagLib={tagLib}
          tagPalette={TAG_PALETTE}
          onCreateTag={createTag}
          onDeleteTag={deleteTagFromLib}
          catLib={catLib}
          onSetCategory={(catId) => updateTaskField(openTaskId, "category_id", catId)}
        />
      )}

      {/* tag manager modal */}
      {tagMgrOpen && (
        <TagManagerModal
          tagLib={tagLib}
          tagPalette={TAG_PALETTE}
          onUpdateTag={updateTag}
          onClose={() => setTagMgrOpen(false)}
        />
      )}

      {/* category manager modal */}
      {catMgrOpen && (
        <CategoryManagerModal
          catLib={catLib}
          catPalette={CAT_PALETTE}
          onUpdateCategory={updateCategory}
          onCreateCategory={createCategory}
          onReorderCategories={reorderCategories}
          onClose={() => setCatMgrOpen(false)}
        />
      )}
    </div>
  );
}
