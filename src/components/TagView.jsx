import { useState } from "react";
import C from "../theme.js";
import TagChip from "./TagChip.jsx";
import Circle from "./Circle.jsx";

const PALETTE = [
  "#5b6af0", "#e85b7a", "#f0905b", "#5bc4f0",
  "#4ecb8d", "#b45bf0", "#e8c45b", "#5b8af0",
];

export default function TagView({ tags, weeks, onClose, onUpdateTag, onDeleteTag }) {
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState("");
  const [editColor, setEditColor] = useState("");

  // Collect all tasks that have tags across all weeks
  const allTasks = [];
  for (const [weekKey, tasks] of Object.entries(weeks)) {
    for (const task of (tasks || [])) {
      if ((task.tags || []).length > 0) allTasks.push({ task, weekKey });
    }
  }

  function startEdit(tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function saveEdit(tag) {
    const name = editName.trim();
    if (name) onUpdateTag({ ...tag, name, color: editColor });
    setEditingId(null);
  }

  const ghost = {
    border: `1px solid ${C.line2}`, background: "transparent",
    borderRadius: 8, padding: "6px 13px", fontSize: 12.5,
    fontWeight: 600, cursor: "pointer", color: C.sub, fontFamily: "inherit",
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif", color: C.ink, padding: "20px 24px 40px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Tags</span>
        <button onClick={onClose} style={ghost}>← Back to planner</button>
      </div>

      {tags.length === 0 && (
        <div style={{ color: C.sub, fontSize: 14 }}>No tags yet. Create one from any task.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {tags.map((tag) => {
          const tagTasks = allTasks.filter(({ task }) => (task.tags || []).includes(tag.id));
          const isEditing = editingId === tag.id;

          return (
            <div key={tag.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                {isEditing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {PALETTE.map((c) => (
                        <button key={c} onClick={() => setEditColor(c)} style={{
                          width: 14, height: 14, borderRadius: "50%", background: c, border: "none", cursor: "pointer", padding: 0,
                          outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: 1,
                        }} />
                      ))}
                    </div>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(tag); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                      style={{ border: "none", borderBottom: `1.5px solid ${editColor}`, outline: "none", background: "transparent", fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: "inherit", width: 140 }}
                    />
                    <button onClick={() => saveEdit(tag)} style={{ ...ghost, padding: "3px 10px", fontSize: 12 }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ ...ghost, padding: "3px 10px", fontSize: 12 }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <TagChip tag={tag} />
                    <span style={{ fontSize: 12, color: C.sub }}>{tagTasks.length} task{tagTasks.length !== 1 ? "s" : ""}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => startEdit(tag)} style={{ ...ghost, padding: "3px 10px", fontSize: 11.5 }}>Edit</button>
                    <button onClick={() => { if (window.confirm(`Delete tag "${tag.name}"? It will be removed from all tasks.`)) onDeleteTag(tag.id); }}
                      style={{ ...ghost, padding: "3px 10px", fontSize: 11.5, color: "#c0392b", borderColor: "#e8b4b0" }}>Delete</button>
                  </>
                )}
              </div>

              {tagTasks.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.sub, fontStyle: "italic" }}>No tasks with this tag</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tagTasks.map(({ task, weekKey }) => (
                    <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, background: C.bg }}>
                      <Circle done={task.done} size={15} />
                      <span style={{ fontSize: 13, color: task.done ? C.sub : C.ink, textDecoration: task.done ? "line-through" : "none", flex: 1 }}>{task.text}</span>
                      <span style={{ fontSize: 11, color: C.sub }}>{task.claimedDay || weekKey}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
