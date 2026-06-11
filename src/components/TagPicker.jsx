import { useState, useEffect, useRef } from "react";

const PALETTE = [
  "#5b6af0", "#e85b7a", "#f0905b", "#5bc4f0",
  "#4ecb8d", "#b45bf0", "#e8c45b", "#5b8af0",
];

export default function TagPicker({ allTags, taskTags = [], onToggle, onCreateTag, onClose }) {
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const ref = useRef(null);

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreateTag({ name, color: newColor });
    setNewName("");
  }

  return (
    <div ref={ref} style={{
      position: "absolute", zIndex: 200, top: "100%", left: 0, marginTop: 4,
      background: "#fff", border: "1px solid #e0e3ef", borderRadius: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)", padding: "8px 0",
      minWidth: 180, maxWidth: 240,
    }}>
      {allTags.length === 0 && (
        <div style={{ padding: "4px 14px 8px", fontSize: 12, color: "#9296a3" }}>No tags yet</div>
      )}
      {allTags.map((tag) => {
        const active = taskTags.includes(tag.id);
        return (
          <button key={tag.id}
            onClick={() => onToggle(tag.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", background: active ? tag.color + "18" : "none",
              border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: "#34363f", fontWeight: active ? 600 : 400 }}>{tag.name}</span>
            {active && <span style={{ fontSize: 11, color: tag.color }}>✓</span>}
          </button>
        );
      })}
      <div style={{ borderTop: "1px solid #e7eaf2", margin: "6px 0 4px" }} />
      <form onSubmit={handleCreate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {PALETTE.map((c) => (
            <button key={c} type="button" onClick={() => setNewColor(c)} style={{
              width: 12, height: 12, borderRadius: "50%", background: c, border: "none", cursor: "pointer", padding: 0,
              outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 1,
            }} />
          ))}
        </div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", fontFamily: "inherit", color: "#34363f" }}
        />
        {newName.trim() && (
          <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: newColor, padding: 0, lineHeight: 1 }}>+</button>
        )}
      </form>
    </div>
  );
}
