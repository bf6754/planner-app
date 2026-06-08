import { useState, useEffect, useRef } from "react";

/*
  Weekly Task Manager — mockup v4
  Week = unit of work. Weekly list = source of truth; day columns are views.

  ── COLOR PALETTE ───────────────────────────────────────────────
  Everything visual lives in the C object below. Edit these hex
  values directly to retheme the whole app — nothing else to touch.
*/
const C = {
  bg:       "#F4F6FB",  // page background (cards sit on top of this)
  card:     "#FFFFFF",  // all large cards: This week + day columns
  line:     "#E7EAF2",  // hairline borders
  line2:    "#D5D9E6",  // stronger borders / empty checkbox
  ink:      "#34363F",  // primary text
  inkSoft:  "#9296A3",  // non-today day labels (slightly greyed)
  sub:      "#8C90A1",  // muted text, meta labels, day tags
  done:     "#92CBBA",  // checked + progress (soft mint)
  doneInk:  "#2C5A49",  // check mark + TODAY label
  carryDot: "#AAB5E8",  // carried-over checkbox (soft periwinkle)
  carryInk: "#595D72",  // carried text (slightly off ink)
  accent:   "#8FB4E8",  // primary action (Add) — soft blue
  accentInk:"#1E3A5F",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = DAYS.slice(0, 5);
const WEEKEND = DAYS.slice(5);

let _id = 100;
const uid = () => "t" + _id++;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const fmtKey = (k) => { const [, m, d] = k.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };
function getMonday(d) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); x.setHours(0, 0, 0, 0); return x; }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function fmtRange(m) { const s = addDays(m, 6);
  const a = `${MONTHS[m.getMonth()]} ${m.getDate()}`;
  const b = m.getMonth() === s.getMonth() ? `${s.getDate()}` : `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  return `${a} – ${b}, ${s.getFullYear()}`; }
const dayIndex = (d) => (d == null ? 99 : DAYS.indexOf(d));
const floatDone = (arr, isDone) => { const a = [], b = []; arr.forEach((x) => (isDone(x) ? b : a).push(x)); return [...a, ...b]; };

function mkTask(text, o = {}) {
  return { id: uid(), text, done: false, carried: false, claimedDay: null, subtasks: [],
    createdAt: Date.now(), priority: null, type: null, deadline: null, notes: "",
    originId: null, originKey: null, carriedAway: false, checkedAway: null, ...o };
}
const mkSub = (text, done = false) => ({ id: uid(), text, done, claimedDay: null });

const THIS_MON = getMonday(new Date());
const LAST_MON = addDays(THIS_MON, -7);
const KEY_THIS = ymd(THIS_MON);
const KEY_LAST = ymd(LAST_MON);

function seed() {
  const last = [
    mkTask("Submit Q2 budget draft", { done: true }),
    mkTask("Email the dentist", { done: true }),
    mkTask("Renew passport"),
    mkTask("Draft blog post on pottery"),
    mkTask("Buy running shoes"),
    mkTask("Call the accountant"),
  ];
  const cur = [
    mkTask("Send stand-up notes", { claimedDay: "Mon" }),
    mkTask("Finish slide deck", { claimedDay: "Tue",
      subtasks: [mkSub("Outline", true), mkSub("Draft slides"), mkSub("Rehearse once")] }),
    mkTask("Grocery run", { claimedDay: "Wed" }),
    mkTask("Fix the bike tire", { carried: true, originKey: KEY_LAST }),
    mkTask("Water the plants"),
    mkTask("Reply to Sam's email", { done: true }),
  ];
  cur[1].subtasks[1].claimedDay = "Thu"; // a subtask living on its own day
  return { [KEY_LAST]: last, [KEY_THIS]: cur };
}

const Check = ({ s = 11, c = "#fff" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);
const Arrow = ({ dir }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === "right" ? "rotate(180deg)" : "none" }}><path d="M15 18l-6-6 6-6" /></svg>
);
const Plus = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const Chev = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}><path d="M9 6l6 6-6 6" /></svg>
);
function Circle({ done, onClick, size = 18, accent = C.line2 }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ width: size, height: size, minWidth: size, borderRadius: "50%",
        border: `2px solid ${done ? C.done : accent}`, background: done ? C.done : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, transition: "all .14s ease" }}>
      {done && <Check s={size * 0.58} c={C.doneInk} />}
    </button>
  );
}

export default function WeeklyTasks() {
  const [weeks, setWeeks] = useState(seed);
  const [monday, setMonday] = useState(THIS_MON);
  const [hideDone, setHideDone] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [carriedWeeks, setCarriedWeeks] = useState(new Set());
  const [carry, setCarry] = useState(null);
  const [overId, setOverId] = useState(null);
  const [wkOpen, setWkOpen] = useState(false);
  const [ov, setOv] = useState({}); // per-day collapse overrides ("weekKey:Day" -> bool)
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const drag = useRef(null);

  useEffect(() => { const on = () => setVw(window.innerWidth); window.addEventListener("resize", on); on();
    return () => window.removeEventListener("resize", on); }, []);

  const key = ymd(monday);
  const tasks = weeks[key] || [];
  const isThis = key === KEY_THIS;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayKey = ymd(today);
  const isToday = (day) => ymd(addDays(monday, DAYS.indexOf(day))) === todayKey;
  const mode = vw >= 1340 ? "six" : vw >= 900 ? "five" : "one";

  const leftovers = () => (weeks[KEY_LAST] || []).filter((t) => !t.done && !t.carriedAway);
  useEffect(() => { if (isThis && !carriedWeeks.has(KEY_THIS) && leftovers().length) setCarry({ selected: new Set() });
    // eslint-disable-next-line
  }, []);

  const setList = (k, fn) => setWeeks((w) => ({ ...w, [k]: fn(w[k] || []) }));
  const update = (id, fn) => setList(key, (l) => l.map((t) => (t.id === id ? fn(t) : t)));
  const setDraftFor = (t, v) => setDrafts((d) => ({ ...d, [t]: v }));
  const focusAdd = (t) => { const el = document.getElementById("add-" + t); if (el) el.focus(); };

  function toggle(id) {
    const t = tasks.find((x) => x.id === id); if (!t) return; const nd = !t.done;
    update(id, (x) => ({ ...x, done: nd, subtasks: x.subtasks.length ? x.subtasks.map((s) => ({ ...s, done: nd })) : x.subtasks }));
    if (t.originId) setList(t.originKey, (l) => l.map((o) => (o.id === t.originId ? { ...o, checkedAway: nd ? fmtDate(today) : null } : o)));
  }
  function toggleSub(id, sid) {
    update(id, (t) => { const subs = t.subtasks.map((s) => (s.id === sid ? { ...s, done: !s.done } : s));
      return { ...t, subtasks: subs, done: subs.length > 0 && subs.every((s) => s.done) }; });
  }
  function placeInGroup(list, task) {
    const gi = dayIndex(task.claimedDay); let insert = list.length;
    for (let i = 0; i < list.length; i++) if (dayIndex(list[i].claimedDay) > gi) { insert = i; break; }
    const out = [...list]; out.splice(insert, 0, task); return out;
  }
  function addTask(target) {
    const text = (drafts[target] || "").trim(); if (!text) return;
    setList(key, (l) => placeInGroup(l, mkTask(text, { claimedDay: target === "week" ? null : target })));
    setDraftFor(target, "");
  }
  function claim(id, day) {
    setList(key, (l) => { const i = l.findIndex((t) => t.id === id); if (i < 0) return l;
      const t = { ...l[i], claimedDay: day }; const rest = [...l.slice(0, i), ...l.slice(i + 1)]; return placeInGroup(rest, t); });
  }
  const claimSub = (pid, sid, day) => update(pid, (t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === sid ? { ...s, claimedDay: day } : s)) }));
  function reorder(id, targetId) {
    if (id === targetId) return;
    setList(key, (l) => { const from = l.findIndex((t) => t.id === id); if (from < 0) return l;
      const t = l[from]; const rest = [...l.slice(0, from), ...l.slice(from + 1)]; const to = rest.findIndex((x) => x.id === targetId);
      const out = [...rest]; out.splice(to, 0, t); return out; });
  }
  const cleanupDrag = () => { drag.current = null; setOverId(null); };
  function dropToDay(day) { const d = drag.current; if (!d) return; d.t === "task" ? claim(d.id, day) : claimSub(d.pid, d.sid, day); cleanupDrag(); }
  function dropToWeekly() { const d = drag.current; if (!d) return; d.t === "task" ? claim(d.id, null) : claimSub(d.pid, d.sid, null); cleanupDrag(); }
  const navigate = (n) => setMonday((m) => addDays(m, n * 7));

  function confirmCarry() {
    const sel = carry.selected;
    setWeeks((w) => { const cur = [...(w[KEY_THIS] || [])];
      const last = (w[KEY_LAST] || []).map((t) => {
        if (sel.has(t.id)) { cur.push(mkTask(t.text, { carried: true, originId: t.id, originKey: KEY_LAST,
          subtasks: t.subtasks.map((s) => mkSub(s.text, false)) })); return { ...t, carriedAway: true }; }
        return t; });
      return { ...w, [KEY_THIS]: cur, [KEY_LAST]: last }; });
    setCarriedWeeks((s) => new Set(s).add(KEY_THIS)); setCarry(null);
  }

  const vis = (l) => (hideDone ? l.filter((t) => !t.done) : l);
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? (doneCount / tasks.length) * 100 : 0;

  function dayItems(day) {
    const whole = tasks.filter((t) => t.claimedDay === day).map((t) => ({ kind: "task", task: t }));
    const subs = [];
    tasks.forEach((t) => t.subtasks.forEach((s) => { if (s.claimedDay === day && t.claimedDay !== day) subs.push({ kind: "sub", task: t, sub: s }); }));
    let items = [...whole, ...subs];
    if (hideDone) items = items.filter((it) => (it.kind === "sub" ? !it.sub.done : !it.task.done));
    return floatDone(items, (it) => (it.kind === "sub" ? it.sub.done : it.task.done));
  }

  // day progress counts each subtask as its own unit
  function dayStats(day) {
    let total = 0, done = 0;
    tasks.filter((x) => x.claimedDay === day).forEach((x) => {
      const here = x.subtasks.filter((s) => s.claimedDay == null || s.claimedDay === day);
      if (x.subtasks.length > 0 && here.length > 0) here.forEach((s) => { total++; if (s.done) done++; });
      else { total++; if (x.done) done++; }
    });
    tasks.forEach((x) => x.subtasks.forEach((s) => { if (s.claimedDay === day && x.claimedDay !== day) { total++; if (s.done) done++; } }));
    return { total, done };
  }

  // ── inlined renderers (plain functions → keep input focus while typing) ──
  function taskRow(task, view, day) {
    const subs = floatDone(view === "day" ? task.subtasks.filter((s) => s.claimedDay == null || s.claimedDay === day) : task.subtasks, (s) => s.done);
    const txt = task.done ? C.sub : C.ink;
    let meta = null; // only the origin-week markers; carried-IN tasks look like normal tasks
    if (view === "week") {
      if (task.checkedAway) meta = <span style={{ fontStyle: "italic", color: C.done }}>Checked {task.checkedAway}</span>;
      else if (task.carriedAway) meta = <span style={{ color: C.sub }}>Carried over</span>;
    }
    const fs = view === "day" ? 13 : 14;
    return (
      <div key={task.id} draggable
        onDragStart={(e) => { drag.current = { t: "task", id: task.id }; e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { e.preventDefault(); if (view === "week") setOverId(task.id); }}
        onDragLeave={() => setOverId((o) => (o === task.id ? null : o))}
        onDrop={(e) => { if (view === "week" && drag.current?.t === "task") { e.stopPropagation(); reorder(drag.current.id, task.id); cleanupDrag(); } }}
        style={{ borderTop: overId === task.id ? `2px solid ${C.done}` : "2px solid transparent",
          borderBottom: `1px solid ${C.line}`, padding: view === "day" ? "7px 2px" : "9px 4px", opacity: task.done ? 0.55 : 1, cursor: "grab" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <div style={{ paddingTop: 1 }}>
            <Circle done={task.done} size={view === "day" ? 16 : 18} onClick={() => toggle(task.id)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flex: 1, fontSize: fs, lineHeight: 1.35, color: txt, textDecoration: task.done ? "line-through" : "none", wordBreak: "break-word" }}>{task.text}</span>
              {view === "week" && task.claimedDay && <span style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>{task.claimedDay}</span>}
            </div>
            {meta && <div style={{ fontSize: 11, marginTop: 2 }}>{meta}</div>}
            {subs.length > 0 && (
              <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 5, paddingLeft: 8 }}>
                {subs.map((s) => (
                  <div key={s.id} draggable
                    onDragStart={(e) => { e.stopPropagation(); drag.current = { t: "sub", pid: task.id, sid: s.id }; e.dataTransfer.effectAllowed = "move"; }}
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}>
                    <Circle done={s.done} size={view === "day" ? 14 : 15} onClick={() => toggleSub(task.id, s.id)} />
                    <span style={{ flex: 1, fontSize: fs, color: s.done ? C.sub : "#52545d", textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
                    {view === "week" && s.claimedDay && <span style={{ fontSize: 11, color: C.sub }}>{s.claimedDay}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function subOnDay(task, sub) {
    return (
      <div key={sub.id} draggable
        onDragStart={(e) => { drag.current = { t: "sub", pid: task.id, sid: sub.id }; e.dataTransfer.effectAllowed = "move"; }}
        style={{ borderBottom: `1px solid ${C.line}`, padding: "7px 2px", opacity: sub.done ? 0.55 : 1, cursor: "grab" }}>
        <div style={{ fontSize: 10.5, fontStyle: "italic", color: C.sub, marginBottom: 3, marginLeft: 25 }}>{task.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Circle done={sub.done} size={16} onClick={() => toggleSub(task.id, sub.id)} />
          <span style={{ fontSize: 13, color: sub.done ? C.sub : "#565860", textDecoration: sub.done ? "line-through" : "none" }}>{sub.text}</span>
        </div>
      </div>
    );
  }

  function addSlot(target, compact) {
    return (
      <div key="add" style={{ display: "flex", alignItems: "center", gap: 9, padding: compact ? "7px 2px" : "9px 4px" }}>
        <span style={{ width: compact ? 16 : 18, height: compact ? 16 : 18, minWidth: compact ? 16 : 18, borderRadius: "50%", border: `2px dashed ${C.line2}` }} />
        <input id={"add-" + target} value={drafts[target] || ""} onChange={(e) => setDraftFor(target, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTask(target); }} placeholder="New task"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: compact ? 13 : 14, color: C.ink, fontFamily: "inherit" }} />
      </div>
    );
  }

  function dayCol(day) {
    const date = addDays(monday, DAYS.indexOf(day));
    const t = isToday(day);
    const past = date < today;
    const items = dayItems(day);
    const { total, done } = dayStats(day);
    const ovKey = key + ":" + day;
    const auto = mode === "one" && past && total > 0 && done === total; // past + complete, single-column only
    const open = ov[ovKey] !== undefined ? ov[ovKey] : !auto;
    const toggleOpen = () => setOv((o) => ({ ...o, [ovKey]: !open }));
    return (
      <div key={day} onDragOver={(e) => e.preventDefault()} onDrop={() => dropToDay(day)}
        style={{ background: past ? "#EFF1F7" : C.card, border: `1px solid ${t ? C.line2 : C.line}`,
          borderTop: t ? `2px solid ${C.done}` : `1px solid ${C.line}`, borderRadius: 10, padding: "9px 10px 4px",
          display: "flex", flexDirection: "column", alignSelf: open ? "stretch" : "start",
          height: open ? "100%" : "auto", minHeight: open ? 200 : undefined, opacity: past ? 0.9 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={toggleOpen} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
            <span style={{ color: C.sub, display: "flex" }}><Chev open={open} /></span>
            {t
              ? <span><span style={{ color: C.doneInk, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5, marginRight: 6 }}>TODAY</span><span style={{ fontWeight: 700, color: C.ink, fontSize: 12.5 }}>{day} {date.getDate()}</span></span>
              : <span style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft }}>{day} <span style={{ color: C.sub, fontWeight: 400 }}>{date.getDate()}</span></span>}
          </button>
          {open && <button onClick={() => focusAdd(day)} title="Add task" style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 2, display: "flex" }}><Plus s={14} /></button>}
        </div>
        <div style={{ height: 4, background: C.line, borderRadius: 4, margin: "7px 0 8px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: C.done, transition: "width .3s" }} />
        </div>
        {open && (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((it) => (it.kind === "task" ? taskRow(it.task, "day", day) : subOnDay(it.task, it.sub)))}
              {addSlot(day, true)}
            </div>
            <div style={{ flex: 1, minHeight: 10, cursor: "text" }} onClick={() => focusAdd(day)} />
          </>
        )}
      </div>
    );
  }

  const colStr = mode === "one" ? "minmax(0,1fr)"
    : (() => { const wd = WEEKDAYS.map((d) => (isToday(d) ? "minmax(0,1.5fr)" : "minmax(0,1fr)")); if (mode === "six") wd.push(WEEKEND.some(isToday) ? "minmax(0,1.3fr)" : "minmax(0,1fr)"); return wd.join(" "); })();
  const weekendHasContent = WEEKEND.some((d) => tasks.some((t) => t.claimedDay === d) || tasks.some((t) => t.subtasks.some((s) => s.claimedDay === d)));
  const weekendOpen = weekendHasContent || wkOpen;
  const weekendCols = mode === "one" ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))";

  return (
    <div style={{ background: C.bg, minHeight: 640, fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", color: C.ink, padding: "20px 24px 40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .days-grid{ display:grid; grid-template-columns:${colStr}; gap:10px; align-items:stretch; }
        .we-grid{ display:grid; grid-template-columns:${weekendCols}; gap:10px; align-items:stretch; }
        button:hover{ filter:brightness(0.98); }
        ::selection{ background: rgba(143,180,232,0.35); }
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Weekly</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => navigate(-1)} style={navBtn}><Arrow dir="left" /></button>
            <div style={{ fontSize: 14.5, fontWeight: 500, minWidth: 150, textAlign: "center", color: "#3d3f48" }}>{fmtRange(monday)}</div>
            <button onClick={() => navigate(1)} style={navBtn}><Arrow dir="right" /></button>
          </div>
          {!isThis && <button onClick={() => setMonday(THIS_MON)} style={ghost}>This week</button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setCarry({ selected: new Set() })} style={ghost}>Carry-over</button>
          <button onClick={() => setHideDone((h) => !h)} style={{ ...ghost, background: hideDone ? C.done : "transparent", color: hideDone ? C.doneInk : C.sub, borderColor: hideDone ? C.done : C.line2 }}>{hideDone ? "Show done" : "Hide done"}</button>
        </div>
      </div>

      {/* weekly panel */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={() => dropToWeekly()}
        style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px 6px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>This week</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 500 }}>{doneCount}/{tasks.length}</span>
            <div style={{ width: 130, height: 5, background: C.line, borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: C.done, transition: "width .3s" }} />
            </div>
            <button onClick={() => focusAdd("week")} title="Add task"
              style={{ display: "flex", alignItems: "center", gap: 5, background: C.accent, color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                boxShadow: "0 1px 2px rgba(30,58,95,0.18)" }}><Plus s={14} /> Add task</button>
          </div>
        </div>
        {floatDone(vis(tasks), (t) => t.done).map((t) => taskRow(t, "week"))}
        {addSlot("week", false)}
      </div>

      {/* weekday grid */}
      <div className="days-grid">
        {WEEKDAYS.map((d) => dayCol(d))}
        {mode === "six" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{WEEKEND.map((d) => dayCol(d))}</div>}
      </div>

      {/* weekend accordion */}
      {mode !== "six" && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => !weekendHasContent && setWkOpen((o) => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.line}`,
              borderRadius: 10, padding: "9px 12px", cursor: weekendHasContent ? "default" : "pointer", color: C.sub, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            <Chev open={weekendOpen} /> Weekend {weekendHasContent && <span style={{ fontSize: 11, fontWeight: 400 }}>· in use</span>}
          </button>
          {weekendOpen && <div className="we-grid" style={{ marginTop: 10 }}>{WEEKEND.map((d) => dayCol(d))}</div>}
        </div>
      )}

      {/* carry-over modal */}
      {carry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(40,42,52,0.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div style={{ background: C.card, borderRadius: 14, width: "100%", maxWidth: 440, padding: 22, boxShadow: "0 16px 44px rgba(40,42,52,0.22)" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Carry tasks into this week</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 5, lineHeight: 1.45 }}>Leftovers from your last open week. Check the ones to bring forward — the rest stay put, ready whenever you want them.</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", maxHeight: 300, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
              {leftovers().map((it) => { const on = carry.selected.has(it.id);
                const flip = () => setCarry((c) => { const s = new Set(c.selected); s.has(it.id) ? s.delete(it.id) : s.add(it.id); return { selected: s }; });
                return (
                  <div key={it.id} onClick={flip} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "11px 13px", borderBottom: `1px solid ${C.line}` }}>
                    <Circle done={on} size={17} onClick={flip} /><span style={{ fontSize: 13.5 }}>{it.text}</span>
                  </div>); })}
              {leftovers().length === 0 && <div style={{ padding: "16px 13px", fontSize: 13, color: C.sub }}>Nothing left over.</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
              <button onClick={() => { setCarriedWeeks((s) => new Set(s).add(KEY_THIS)); setCarry(null); }} style={ghost}>Done</button>
              <button onClick={confirmCarry} disabled={carry.selected.size === 0}
                style={{ background: carry.selected.size ? C.done : C.line2, color: C.doneInk, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: carry.selected.size ? "pointer" : "default", fontFamily: "inherit" }}>Carry {carry.selected.size || ""} over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = { width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.line2}`, background: C.card, color: "#5a5c66", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const ghost = { border: `1px solid ${C.line2}`, background: "transparent", borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: C.sub, fontFamily: "inherit" };
