import { useState, useEffect, useRef } from "react";
import C from "../theme.js";

export default function TagManagerModal({ tagLib, tagPalette, onUpdateTag, onDeleteTag, onClose }) {
  const [openColorId,   setOpenColorId]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!openColorId) return;
    const close = (e) => { if (!wrapRef.current?.contains(e.target)) setOpenColorId(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openColorId]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(30,40,60,0.22)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        ref={wrapRef}
        style={{ background: C.card, borderRadius: 14, padding: "26px 28px 24px", width: 420, maxWidth: "100%", boxShadow: "0 8px 36px rgba(30,58,95,0.16)", maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Manage tags</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 20, fontFamily: "inherit", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {tagLib.length === 0 ? (
          <div style={{ fontSize: 13, color: C.sub }}>No tags yet — add one from any task's # button.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tagLib.map((tag) => (
              <div key={tag.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setOpenColorId((id) => id === tag.id ? null : tag.id)}
                      title="Change color"
                      style={{ width: 22, height: 22, borderRadius: "50%", background: tag.color, border: `1.5px solid ${C.line2}`, cursor: "pointer", padding: 0, flexShrink: 0 }}
                    />
                    {openColorId === tag.id && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(30,58,95,0.12)", padding: 8, display: "flex", gap: 6, flexWrap: "wrap", width: 132 }}>
                        {tagPalette.map((color) => (
                          <button key={color}
                            onClick={() => { onUpdateTag(tag.id, { color }); setOpenColorId(null); }}
                            title={color}
                            style={{ width: 18, height: 18, borderRadius: "50%", background: color, border: color === tag.color ? `2px solid ${C.ink}` : `1.5px solid ${C.line2}`, cursor: "pointer", padding: 0 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    key={tag.id + tag.name}
                    defaultValue={tag.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== tag.name) onUpdateTag(tag.id, { name: v });
                      else e.target.value = tag.name;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.target.blur();
                      if (e.key === "Escape") { e.target.value = tag.name; e.target.blur(); }
                    }}
                    style={{ flex: 1, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none" }}
                  />
                  <button
                    onClick={() => setConfirmDeleteId(tag.id)}
                    title="Delete tag"
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 16, opacity: 0.45, padding: "0 2px", fontFamily: "inherit", lineHeight: 1, flexShrink: 0 }}>
                    ×
                  </button>
                </div>
                {confirmDeleteId === tag.id && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginLeft: 32, fontSize: 12.5, color: C.sub }}>
                    <span>Remove tag from all tasks?</span>
                    <button
                      onClick={() => { onDeleteTag(tag.id); setConfirmDeleteId(null); }}
                      style={{ border: "none", background: "#E8887F22", color: "#E8887F", borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{ border: "none", background: "transparent", color: C.sub, borderRadius: 6, padding: "2px 8px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
