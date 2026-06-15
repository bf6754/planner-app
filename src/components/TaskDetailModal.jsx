import C from "../theme.js";

const PRIORITIES = [
  { value: null,     label: "None",   color: C.sub },
  { value: "low",    label: "Low",    color: "#92CBBA" },
  { value: "medium", label: "Medium", color: "#F0C274" },
  { value: "high",   label: "High",   color: "#E8887F" },
];

export default function TaskDetailModal({ task, onClose, onUpdate }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(30,40,60,0.22)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, borderRadius: 14, padding: "26px 28px 24px", width: 460, maxWidth: "100%", boxShadow: "0 8px 36px rgba(30,58,95,0.16)", maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Title */}
        <input
          key={task.id}
          defaultValue={task.text}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== task.text) onUpdate("text", v); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") onClose(); }}
          style={{ fontSize: 17, fontWeight: 600, color: task.done ? C.sub : C.ink, border: "none", borderBottom: `1.5px solid ${C.line}`, outline: "none", background: "transparent", fontFamily: "inherit", padding: "0 0 8px", width: "100%", textDecoration: task.done ? "line-through" : "none" }}
        />

        {/* Priority */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Priority</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRIORITIES.map(({ value, label, color }) => {
              const active = (task.priority ?? null) === value;
              return (
                <button key={label} onClick={() => onUpdate("priority", value)}
                  style={{ border: `1.5px solid ${active ? color : C.line2}`, background: active ? color + "28" : "transparent", borderRadius: 20, padding: "4px 13px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: active ? color : C.sub, fontFamily: "inherit" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Deadline</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="date"
              value={task.deadline ?? ""}
              onChange={(e) => onUpdate("deadline", e.target.value || null)}
              style={{ border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none" }}
            />
            {task.deadline && (
              <button onClick={() => onUpdate("deadline", null)}
                style={{ fontSize: 12, color: C.sub, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 4px" }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Notes</div>
          <textarea
            key={task.id + "-notes"}
            defaultValue={task.notes ?? ""}
            onBlur={(e) => { const v = e.target.value; if (v !== (task.notes ?? "")) onUpdate("notes", v); }}
            placeholder="Add a note…"
            rows={4}
            style={{ width: "100%", border: `1px solid ${C.line2}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
          />
        </div>

      </div>
    </div>
  );
}
