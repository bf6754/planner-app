import { useState, useEffect, useRef } from "react";
import C from "../theme.js";

export default function CategoryManagerModal({ catLib, catPalette, onUpdateCategory, onCreateCategory, onClose }) {
  const [openColorId, setOpenColorId] = useState(null);
  const [newName, setNewName] = useState("");
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
          <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Manage categories</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 20, fontFamily: "inherit", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {catLib.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catLib.map((cat) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setOpenColorId((id) => id === cat.id ? null : cat.id)}
                    title="Change color"
                    style={{ width: 22, height: 22, borderRadius: "50%", background: cat.color, border: `1.5px solid ${C.line2}`, cursor: "pointer", padding: 0, flexShrink: 0 }}
                  />
                  {openColorId === cat.id && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(30,58,95,0.12)", padding: 8, display: "flex", gap: 6, flexWrap: "wrap", width: 132 }}>
                      {catPalette.map((color) => (
                        <button key={color}
                          onClick={() => { onUpdateCategory(cat.id, { color }); setOpenColorId(null); }}
                          title={color}
                          style={{ width: 18, height: 18, borderRadius: "50%", background: color, border: color === cat.color ? `2px solid ${C.ink}` : `1.5px solid ${C.line2}`, cursor: "pointer", padding: 0 }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  key={cat.id + cat.name}
                  defaultValue={cat.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== cat.name) onUpdateCategory(cat.id, { name: v });
                    else e.target.value = cat.name;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") { e.target.value = cat.name; e.target.blur(); }
                  }}
                  style={{ flex: 1, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* New category input */}
        <div style={{ borderTop: catLib.length ? `1px solid ${C.line}` : "none", paddingTop: catLib.length ? 14 : 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>New category</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus={catLib.length === 0}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = newName.trim(); if (!name) return;
                  const color = catPalette[catLib.length % catPalette.length];
                  onCreateCategory(name, color);
                  setNewName("");
                }
                if (e.key === "Escape") setNewName("");
              }}
              placeholder="Category name…"
              style={{ flex: 1, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none" }}
            />
            <button
              onClick={() => {
                const name = newName.trim(); if (!name) return;
                const color = catPalette[catLib.length % catPalette.length];
                onCreateCategory(name, color);
                setNewName("");
              }}
              style={{ border: "none", background: C.accent, color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
