import { useState, useEffect, useRef } from "react";
import C from "./theme.js";
import { DAYS, MONTHS, WEEKDAYS, WEEKEND, ymd, fmtDate, fmtRange, getMonday, addDays, dayIndex, currentWeekKey } from "./lib/dates.js";
import { uid, mkTask, mkSub, floatDone, placeInGroup } from "./lib/tasks.js";
import { loadMetaLocal, saveMetaLocal, fetchAllWeeks, upsertWeek, fetchMeta, upsertMeta, checkCarryOver, getLeftovers } from "./data/store.js";
import { supabase } from "./data/supabase.js";
import CarryOverModal from "./components/CarryOverModal.jsx";
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
const delBtn = {
  background: "none", border: "none", cursor: "pointer", padding: "0 3px",
  color: C.sub, fontSize: 15, lineHeight: 1, opacity: 0.5, flexShrink: 0,
  fontFamily: "inherit",
};

export default function App({ user, onSignOut }) {
  const [weeks,        setWeeks]        = useState({});
  const [dataLoading,  setDataLoading]  = useState(true);
  const [meta,         setMeta]         = useState(loadMetaLocal); // local fallback until Supabase loads
  const [monday,       setMonday]       = useState(() => { const k = currentWeekKey(); const [y,m,d] = k.split("-").map(Number); return new Date(y, m-1, d); });
  const [hideDone,     setHideDone]     = useState(false);
  const [drafts,       setDrafts]       = useState({});
  const [carry,        setCarry]        = useState(null);
  const [overId,       setOverId]       = useState(null);  // reorder drop target (top edge) — shared for tasks and subtasks
  const [subDropId,    setSubDropId]    = useState(null);  // task-body nest target
  const [hoveredId,    setHoveredId]    = useState(null);
  const [addSubFor,    setAddSubFor]    = useState(null);  // task id with inline add-subtask input
  const [subMode,      setSubMode]      = useState(new Set()); // add-slot targets in subtask mode
  const [editingId,    setEditingId]    = useState(null);  // task id being edited
  const [editingSubKey,setEditingSubKey]= useState(null);  // "pid:sid" subtask being edited
  const [editDraft,    setEditDraft]    = useState("");
  const [wkOpen,       setWkOpen]       = useState(false);
  const [ov,           setOv]           = useState({});
  const [vw,           setVw]           = useState(() => window.innerWidth);

  const drag         = useRef(null);
  const dropMode     = useRef(null);
  const prevWeeksRef = useRef(null); // tracks last-saved weeks to diff on change

  // ── load weeks + meta from Supabase on mount ──────────────────────────────
  useEffect(() => {
    Promise.all([fetchAllWeeks(), fetchMeta()]).then(([data, remoteMeta]) => {
      const nowKey = currentWeekKey();
      if (!data[nowKey]) data[nowKey] = [];
      setWeeks(data);
      prevWeeksRef.current = data;

      // carry-over check with authoritative remote meta
      const { shouldCarry, sourceKey } = checkCarryOver(data, remoteMeta);
      if (shouldCarry) setCarry(sourceKey);

      // record this open
      const newMeta = { ...remoteMeta, lastOpenedKey: nowKey };
      setMeta(newMeta);
      saveMetaLocal(newMeta);
      upsertMeta(user.id, newMeta);

      setDataLoading(false);
    }).catch((err) => {
      console.error("Failed to load data:", err);
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── save only the weeks that changed ──────────────────────────────────────
  useEffect(() => {
    if (dataLoading || prevWeeksRef.current === null) return;
    const prev = prevWeeksRef.current;
    Object.keys(weeks).forEach((k) => {
      if (weeks[k] !== prev[k]) upsertWeek(user.id, k, weeks[k]);
    });
    prevWeeksRef.current = weeks;
  }, [weeks]);

  // ── real-time sync: apply changes made on other devices ───────────────────
  useEffect(() => {
    if (dataLoading) return;
    const channel = supabase
      .channel("weeks-sync")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "weeks" },
        (payload) => {
          const row = payload.new;
          if (!row || row.week_key === "__meta__") return;
          // Update local state and prevWeeksRef (so save effect skips it)
          setWeeks((prev) => {
            const next = { ...prev, [row.week_key]: row.tasks };
            prevWeeksRef.current = next;
            return next;
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [dataLoading]);

  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const key      = ymd(monday);
  const tasks    = weeks[key] || [];
  const nowKey   = currentWeekKey();
  const isThis   = key === nowKey;
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayYmd = ymd(today);
  const isToday  = (day) => ymd(addDays(monday, DAYS.indexOf(day))) === todayYmd;
  const mode     = vw >= 1340 ? "six" : vw >= 900 ? "five" : "one";

  // ── state helpers ──────────────────────────────────────────────────────────
  const setList  = (k, fn) => setWeeks((w) => ({ ...w, [k]: fn(w[k] || []) }));
  const update   = (id, fn) => setList(key, (l) => l.map((t) => t.id === id ? fn(t) : t));
  const setDraft = (t, v)   => setDrafts((d) => ({ ...d, [t]: v }));
  const focusAdd = (t)      => { const el = document.getElementById("add-" + t); if (el) el.focus(); };

  const exitSubMode = (target) =>
    setSubMode((s) => { const n = new Set(s); n.delete(target); return n; });
  const enterSubMode = (target) =>
    setSubMode((s) => new Set(s).add(target));

  // ── task actions ───────────────────────────────────────────────────────────
  function toggle(id) {
    const t = tasks.find((x) => x.id === id); if (!t) return;
    const nd = !t.done;
    update(id, (x) => ({ ...x, done: nd, subtasks: x.subtasks.length ? x.subtasks.map((s) => ({ ...s, done: nd })) : x.subtasks }));
    if (t.originId && t.originKey)
      setList(t.originKey, (l) => l.map((o) => o.id === t.originId ? { ...o, checkedAway: nd ? fmtDate(today) : null } : o));
  }

  function toggleSub(id, sid) {
    update(id, (t) => {
      const subs = t.subtasks.map((s) => s.id === sid ? { ...s, done: !s.done } : s);
      return { ...t, subtasks: subs, done: subs.length > 0 && subs.every((s) => s.done) };
    });
  }

  function deleteTask(id) {
    setList(key, (l) => l.filter((t) => t.id !== id));
  }

  function deleteSub(pid, sid) {
    update(pid, (t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== sid) }));
  }

  function saveTaskEdit(id, andInsertAfter = false) {
    const text = editDraft.trim();
    if (text) update(id, (t) => ({ ...t, text }));
    setEditingId(null); setEditDraft("");
    if (andInsertAfter) {
      const parent = tasks.find((t) => t.id === id);
      const newTask = mkTask("", { claimedDay: parent?.claimedDay ?? null });
      setList(key, (l) => {
        const idx = l.findIndex((t) => t.id === id);
        const copy = [...l];
        copy.splice(idx + 1, 0, newTask);
        return copy;
      });
      setEditingId(newTask.id); setEditDraft("");
      setTimeout(() => document.getElementById(`edit-${newTask.id}`)?.focus(), 0);
    }
  }

  function saveSubEdit(andInsertAfter = false) {
    if (!editingSubKey) return;
    const [pid, sid] = editingSubKey.split(":");
    const text = editDraft.trim();
    if (text) update(pid, (t) => ({ ...t, subtasks: t.subtasks.map((s) => s.id === sid ? { ...s, text } : s) }));
    setEditingSubKey(null); setEditDraft("");
    if (andInsertAfter) {
      const newSub = mkSub("");
      update(pid, (t) => {
        const idx = t.subtasks.findIndex((s) => s.id === sid);
        const copy = [...t.subtasks];
        copy.splice(idx + 1, 0, newSub);
        return { ...t, subtasks: copy };
      });
      const newKey = `${pid}:${newSub.id}`;
      setEditingSubKey(newKey); setEditDraft("");
      setTimeout(() => document.getElementById(`edit-sub-${newKey}`)?.focus(), 0);
    }
  }

  function startEdit(task) {
    setEditingId(task.id); setEditDraft(task.text);
    setTimeout(() => { const el = document.getElementById(`edit-${task.id}`); el?.focus(); el?.select(); }, 0);
  }

  function startSubEdit(pid, sub) {
    const k = `${pid}:${sub.id}`;
    setEditingSubKey(k); setEditDraft(sub.text);
    setTimeout(() => { const el = document.getElementById(`edit-sub-${k}`); el?.focus(); el?.select(); }, 0);
  }

  function addTask(target, providedText) {
    const text = (providedText ?? drafts[target] ?? "").trim(); if (!text) return;
    setList(key, (l) => placeInGroup(l, mkTask(text, { claimedDay: target === "week" ? null : target })));
    setDraft(target, "");
  }

  function addTaskAsSubtask(target, providedText) {
    const text = (providedText ?? drafts[target] ?? "").trim(); if (!text) return;
    const lastTask = target === "week"
      ? tasks.at(-1)
      : tasks.filter((t) => t.claimedDay === target).at(-1) ?? tasks.at(-1);
    if (!lastTask) { addTask(target, text); return; }
    update(lastTask.id, (t) => ({ ...t, subtasks: [...t.subtasks, mkSub(text)] }));
    setDraft(target, "");
    setTimeout(() => document.getElementById("add-" + target)?.focus(), 0);
  }

  function addSubtask(parentId) {
    const k    = `sub-${parentId}`;
    const text = (drafts[k] || "").trim(); if (!text) return;
    update(parentId, (t) => ({ ...t, subtasks: [...t.subtasks, mkSub(text)] }));
    setDraft(k, ""); setAddSubFor(null);
  }

  function claim(id, day) {
    setList(key, (l) => {
      const i = l.findIndex((t) => t.id === id); if (i < 0) return l;
      const t = { ...l[i], claimedDay: day };
      const rest = [...l.slice(0, i), ...l.slice(i + 1)];
      return placeInGroup(rest, t);
    });
  }

  const claimSub = (pid, sid, day) =>
    update(pid, (t) => ({ ...t, subtasks: t.subtasks.map((s) => s.id === sid ? { ...s, claimedDay: day } : s) }));

  function reorder(id, targetId) {
    if (id === targetId) return;
    setList(key, (l) => {
      const from = l.findIndex((t) => t.id === id); if (from < 0) return l;
      const t    = l[from];
      const rest = [...l.slice(0, from), ...l.slice(from + 1)];
      const to   = rest.findIndex((x) => x.id === targetId);
      const out  = [...rest]; out.splice(to, 0, t); return out;
    });
  }

  function reorderSub(pid, fromSid, targetSid) {
    if (fromSid === targetSid) return;
    update(pid, (t) => {
      const from = t.subtasks.findIndex((s) => s.id === fromSid); if (from < 0) return t;
      const sub  = t.subtasks[from];
      const rest = [...t.subtasks.slice(0, from), ...t.subtasks.slice(from + 1)];
      const to   = rest.findIndex((s) => s.id === targetSid);
      const out  = [...rest]; out.splice(to, 0, sub);
      return { ...t, subtasks: out };
    });
  }

  function promoteSubtask(pid, sid) {
    setList(key, (l) => {
      const parent = l.find((t) => t.id === pid);
      const sub    = parent?.subtasks.find((s) => s.id === sid);
      if (!sub) return l;
      return [
        ...l.map((t) => t.id === pid ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== sid) } : t),
        mkTask(sub.text, { claimedDay: sub.claimedDay }),
      ];
    });
  }

  // ── drag helpers ───────────────────────────────────────────────────────────
  const cleanupDrag = () => {
    drag.current = null; dropMode.current = null;
    setOverId(null); setSubDropId(null);
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
      setList(key, (l) => {
        const parent = l.find((t) => t.id === d.pid);
        const sub    = parent?.subtasks.find((s) => s.id === d.sid);
        if (!sub) return l;
        return [
          ...l.map((t) => t.id === d.pid ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== d.sid) } : t),
          mkTask(sub.text, { claimedDay: sub.claimedDay }),
        ];
      });
    }
    cleanupDrag();
  }

  function dropAsSubtask(parentId) {
    const d = drag.current; if (!d || d.t !== "task" || d.id === parentId) { cleanupDrag(); return; }
    setList(key, (l) => {
      const child = l.find((t) => t.id === d.id); if (!child) return l;
      const newSubs = [mkSub(child.text, child.done), ...child.subtasks.map((s) => mkSub(s.text, s.done))];
      return l
        .filter((t) => t.id !== d.id)
        .map((t) => t.id === parentId ? { ...t, subtasks: [...t.subtasks, ...newSubs] } : t);
    });
    cleanupDrag();
  }

  // ── carry-over ─────────────────────────────────────────────────────────────
  const openCarryOver = () => {
    const { sourceKey } = checkCarryOver(weeks, { ...meta, carriedKeys: [] });
    const sk = sourceKey || meta.lastOpenedKey;
    if (sk && sk !== key) setCarry(sk);
  };

  function confirmCarry(selected) {
    const sourceKey = carry;
    setWeeks((w) => {
      const cur = [...(w[nowKey] || [])];
      const src = (w[sourceKey] || []).map((t) => {
        if (selected.has(t.id)) {
          cur.push(mkTask(t.text, { carried: true, originId: t.id, originKey: sourceKey, subtasks: t.subtasks.map((s) => mkSub(s.text, false)) }));
          return { ...t, carriedAway: true };
        }
        return t;
      });
      return { ...w, [nowKey]: cur, [sourceKey]: src };
    });
    setMeta((m) => {
      const next = { ...m, carriedKeys: [...(m.carriedKeys || []), nowKey] };
      saveMetaLocal(next); upsertMeta(user.id, next); return next;
    });
    setCarry(null);
  }

  function dismissCarry() {
    setMeta((m) => {
      const next = { ...m, carriedKeys: [...(m.carriedKeys || []), nowKey] };
      saveMetaLocal(next); upsertMeta(user.id, next); return next;
    });
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

  // ── inlined renderers (plain functions → no nested component → no focus loss) ──

  function taskRow(task, view, day) {
    const subs      = floatDone(
      view === "day" ? task.subtasks.filter((s) => s.claimedDay == null || s.claimedDay === day) : task.subtasks,
      (s) => s.done
    );
    const txt        = task.done ? C.sub : C.ink;
    const hovered    = hoveredId === task.id;
    const isSubDrop  = subDropId === task.id;
    const isEditing  = editingId === task.id;
    const fs         = view === "day" ? 13 : 14;

    let meta = null;
    if (view === "week") {
      if (task.checkedAway)  meta = <span style={{ fontStyle: "italic", color: C.done }}>Checked {task.checkedAway}</span>;
      else if (task.carriedAway) meta = <span style={{ color: C.sub }}>Carried over</span>;
    }

    // Inline edit style — matches the text visually, no border box
    const editInputStyle = {
      flex: 1, minWidth: 0, fontSize: fs, lineHeight: 1.35, color: txt,
      border: "none", outline: "none", background: "transparent",
      fontFamily: "inherit", padding: 0,
      textDecoration: task.done ? "line-through" : "none",
    };

    return (
      <div key={task.id}
        draggable={!isEditing}
        onMouseEnter={() => setHoveredId(task.id)}
        onMouseLeave={() => setHoveredId((h) => h === task.id ? null : h)}
        onDragStart={(e) => { if (isEditing) { e.preventDefault(); return; } drag.current = { t: "task", id: task.id }; e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => {
          e.preventDefault();
          if (drag.current?.t !== "task" || drag.current?.id === task.id) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const isTop = (e.clientY - rect.top) / rect.height < 0.38;
          if (isTop && view === "week") {
            dropMode.current = { type: "reorder", id: task.id };
            setOverId(task.id); setSubDropId(null);
          } else if (!isTop) {
            dropMode.current = { type: "subtask", id: task.id };
            setSubDropId(task.id); setOverId(null);
          }
        }}
        onDragLeave={() => {
          setOverId((o) => o === task.id ? null : o);
          setSubDropId((o) => o === task.id ? null : o);
        }}
        onDrop={(e) => {
          if (drag.current?.t !== "task") return;
          if (dropMode.current?.type === "subtask" && dropMode.current?.id === task.id) {
            e.stopPropagation();
            dropAsSubtask(task.id);
          } else if (view === "week") {
            e.stopPropagation();
            reorder(drag.current.id, task.id); cleanupDrag();
          }
        }}
        style={{
          borderTop:    overId === task.id ? `2px solid ${C.done}` : "2px solid transparent",
          borderBottom: `1px solid ${C.line}`,
          background:   isSubDrop ? "rgba(170,181,232,0.10)" : "transparent",
          padding:      view === "day" ? "7px 2px" : "9px 4px",
          opacity:      task.done ? 0.55 : 1,
          cursor:       isEditing ? "default" : "grab",
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <div style={{ paddingTop: 1 }}>
            <Circle done={task.done} size={view === "day" ? 16 : 18} onClick={() => toggle(task.id)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              {isEditing ? (
                <input
                  id={`edit-${task.id}`}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { e.preventDefault(); saveTaskEdit(task.id, true); }
                    if (e.key === "Escape") { setEditingId(null); setEditDraft(""); }
                  }}
                  onBlur={() => saveTaskEdit(task.id)}
                  style={editInputStyle}
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(task); }}
                  style={{ flex: 1, fontSize: fs, lineHeight: 1.35, color: txt, textDecoration: task.done ? "line-through" : "none", wordBreak: "break-word", cursor: "text" }}>
                  {task.text}
                  {hovered && !addSubFor && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddSubFor(task.id); setTimeout(() => document.getElementById(`add-sub-${task.id}`)?.focus(), 0); }}
                      title="Add subtask"
                      style={{ ...delBtn, fontSize: 10.5, opacity: 0.4, marginLeft: 6, verticalAlign: "baseline" }}>
                      + sub
                    </button>
                  )}
                </span>
              )}
              {!isEditing && view === "week" && task.claimedDay && <span style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>{task.claimedDay}</span>}
              {!isEditing && hovered && <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} title="Delete" style={delBtn}>×</button>}
            </div>
            {meta && <div style={{ fontSize: 11, marginTop: 2 }}>{meta}</div>}

            {/* subtasks list */}
            {subs.length > 0 && (
              <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 8 }}>
                {subs.map((s) => {
                  const subKey     = `${task.id}:${s.id}`;
                  const subHovered = hoveredId === s.id;
                  const subEditing = editingSubKey === subKey;
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
                      onMouseEnter={() => setHoveredId(s.id)}
                      onMouseLeave={() => setHoveredId((h) => h === s.id ? null : h)}
                      onDragStart={(e) => { if (subEditing) { e.preventDefault(); return; } e.stopPropagation(); drag.current = { t: "sub", pid: task.id, sid: s.id }; e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => {
                        e.preventDefault(); e.stopPropagation(); // don't bubble to parent task
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
                          id={`edit-sub-${subKey}`}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  { e.preventDefault(); saveSubEdit(true); }
                            if (e.key === "Escape") { setEditingSubKey(null); setEditDraft(""); }
                          }}
                          onBlur={() => saveSubEdit()}
                          style={subEditStyle}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => { e.stopPropagation(); startSubEdit(task.id, s); }}
                          style={{ flex: 1, fontSize: fs, color: s.done ? C.sub : "#52545d", textDecoration: s.done ? "line-through" : "none", cursor: "text" }}>
                          {s.text}
                        </span>
                      )}
                      {!subEditing && view === "week" && s.claimedDay && <span style={{ fontSize: 11, color: C.sub }}>{s.claimedDay}</span>}
                      {!subEditing && subHovered && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); promoteSubtask(task.id, s.id); }} title="Lift to task" style={{ ...delBtn, fontSize: 12 }}>↑</button>
                          <button onClick={(e) => { e.stopPropagation(); deleteSub(task.id, s.id); }} title="Delete subtask" style={delBtn}>×</button>
                        </>
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
                  onBlur={() => { if (!(drafts[`sub-${task.id}`] || "").trim()) setAddSubFor(null); }}
                  placeholder="New subtask"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: fs, color: C.ink, fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function subOnDay(task, sub) {
    const subHovered = hoveredId === sub.id;
    const subKey     = `${task.id}:${sub.id}`;
    const subEditing = editingSubKey === subKey;
    return (
      <div key={sub.id}
        draggable={!subEditing}
        onMouseEnter={() => setHoveredId(sub.id)}
        onMouseLeave={() => setHoveredId((h) => h === sub.id ? null : h)}
        onDragStart={(e) => { if (subEditing) { e.preventDefault(); return; } drag.current = { t: "sub", pid: task.id, sid: sub.id }; e.dataTransfer.effectAllowed = "move"; }}
        style={{ borderBottom: `1px solid ${C.line}`, padding: "7px 2px", opacity: sub.done ? 0.55 : 1, cursor: subEditing ? "default" : "grab" }}>
        <div style={{ fontSize: 10.5, fontStyle: "italic", color: C.sub, marginBottom: 3, marginLeft: 25 }}>{task.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Circle done={sub.done} size={16} onClick={() => toggleSub(task.id, sub.id)} />
          {subEditing ? (
            <input
              id={`edit-sub-${subKey}`}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); saveSubEdit(); }
                if (e.key === "Escape") { setEditingSubKey(null); setEditDraft(""); }
              }}
              onBlur={saveSubEdit}
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: sub.done ? C.sub : "#565860", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", padding: 0, textDecoration: sub.done ? "line-through" : "none" }}
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); startSubEdit(task.id, sub); }}
              style={{ flex: 1, fontSize: 13, color: sub.done ? C.sub : "#565860", textDecoration: sub.done ? "line-through" : "none", cursor: "text" }}>
              {sub.text}
            </span>
          )}
          {!subEditing && subHovered && (
            <>
              <button onClick={(e) => { e.stopPropagation(); promoteSubtask(task.id, sub.id); }} title="Lift to task" style={{ ...delBtn, fontSize: 12 }}>↑</button>
              <button onClick={(e) => { e.stopPropagation(); deleteSub(task.id, sub.id); }} title="Delete subtask" style={delBtn}>×</button>
            </>
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
            const raw = e.target.value; // read DOM value directly — closure drafts can be stale
            if (e.key === "Enter") {
              if (inSubMode) {
                if (raw.trim()) addTaskAsSubtask(target, raw);
                else exitSubMode(target); // empty Enter → back to parent mode
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
              {items.map((it) => it.kind === "task" ? taskRow(it.task, "day", day) : subOnDay(it.task, it.sub))}
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
  const weekendOpen = weekendHasContent || wkOpen;
  const weekendCols = mode === "one" ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))";
  const carryLeftovers = carry ? getLeftovers(weeks, carry) : [];

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
          <button
            onClick={() => setHideDone((h) => !h)}
            style={{ ...ghost, background: hideDone ? C.done : "transparent", color: hideDone ? C.doneInk : C.sub, borderColor: hideDone ? C.done : C.line2 }}>
            {hideDone ? "Show done" : "Hide done"}
          </button>
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
            <button onClick={() => focusAdd("week")} title="Add task"
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 1px 2px rgba(30,58,95,0.18)" }}>
              <Plus s={14} /> Add task
            </button>
          </div>
        </div>
        {floatDone(vis(tasks), (t) => t.done).map((t) => taskRow(t, "week"))}
        {addSlot("week", false)}
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
    </div>
  );
}
