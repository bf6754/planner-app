import { useState, useRef, useEffect } from "react";
import C from "../theme.js";

const PRIORITIES = [
  { value: null,     label: "None",   color: C.sub },
  { value: "low",    label: "Low",    color: "#92CBBA" },
  { value: "medium", label: "Medium", color: "#F0C274" },
  { value: "high",   label: "High",   color: "#E8887F" },
];

export default function TaskDetailModal({ task, onClose, onUpdate, tagLib = [], tagPalette = [], onCreateTag, onDeleteTag, catLib = [], onSetCategory }) {
  const [tagInput, setTagInput] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef                 = useRef(null);

  const activeTags = (task.tag_ids || []).map((id) => tagLib.find((t) => t.id === id)).filter(Boolean);
  const filtered   = tagInput.trim()
    ? tagLib.filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()))
    : tagLib;
  const hasExactMatch = tagLib.some((t) => t.name.toLowerCase() === tagInput.trim().toLowerCase());

  function toggleTag(tagId) {
    const ids = task.tag_ids || [];
    onUpdate("tag_ids", ids.includes(tagId) ? ids.filter((i) => i !== tagId) : [...ids, tagId]);
  }

  function addTagById(tagId) {
    const ids = task.tag_ids || [];
    if (!ids.includes(tagId)) onUpdate("tag_ids", [...ids, tagId]);
    setTagInput(""); setShowDrop(false);
  }

  function handleCreate() {
    const name = tagInput.trim(); if (!name) return;
    const color = tagPalette[tagLib.length % tagPalette.length] || "#A0A4B8";
    const newTag = onCreateTag(name, color);
    const ids = task.tag_ids || [];
    onUpdate("tag_ids", [...ids, newTag.id]);
    setTagInput(""); setShowDrop(false);
  }

  useEffect(() => {
    if (!showDrop) return;
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDrop]);

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

        {/* Category */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Category</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => onSetCategory(null)}
              style={{ border: `1.5px solid ${(task.category_id == null) ? C.ink : C.line2}`, background: (task.category_id == null) ? C.bg : "transparent", borderRadius: 20, padding: "4px 13px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: (task.category_id == null) ? C.ink : C.sub, fontFamily: "inherit" }}>
              None
            </button>
            {catLib.map((cat) => {
              const active = task.category_id === cat.id;
              return (
                <button key={cat.id} onClick={() => onSetCategory(active ? null : cat.id)}
                  style={{ border: `1.5px solid ${active ? cat.color : C.line2}`, background: active ? cat.color + "28" : "transparent", borderRadius: 20, padding: "4px 13px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: active ? cat.color : C.sub, fontFamily: "inherit" }}>
                  {cat.name}
                </button>
              );
            })}
            {catLib.length === 0 && <span style={{ fontSize: 12.5, color: C.sub }}>No categories yet — create them from "Manage categories".</span>}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.sub, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Tags</div>

          {activeTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {activeTags.map((tag) => (
                <span key={tag.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 500, color: tag.color, background: tag.color + "1a", border: `1.5px solid ${tag.color}50`, borderRadius: 20, padding: "3px 10px" }}>
                  {tag.name}
                  <button onClick={() => toggleTag(tag.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: tag.color, padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.7, fontFamily: "inherit" }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={{ position: "relative" }} ref={wrapRef}>
            <input
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); hasExactMatch && filtered[0] ? addTagById(filtered[0].id) : handleCreate(); }
                if (e.key === "Escape") { setShowDrop(false); setTagInput(""); }
              }}
              placeholder="Add tag…"
              style={{ border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 10px", fontSize: 13, color: C.ink, background: C.bg, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }}
            />

            {showDrop && (filtered.length > 0 || (tagInput.trim() && !hasExactMatch)) && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(30,58,95,0.12)", zIndex: 10, overflow: "hidden" }}>
                {filtered.map((tag) => {
                  const active = (task.tag_ids || []).includes(tag.id);
                  return (
                    <div key={tag.id}
                      onMouseDown={(e) => { e.preventDefault(); addTagById(tag.id); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                        <span style={{ color: active ? tag.color : C.ink, fontWeight: active ? 600 : 400 }}>{tag.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {active && <span style={{ fontSize: 11, color: tag.color }}>✓</span>}
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); onDeleteTag(tag.id); setShowDrop(false); }}
                          title="Remove from library"
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, padding: "0 2px", fontSize: 13, opacity: 0.5, fontFamily: "inherit" }}>×</button>
                      </div>
                    </div>
                  );
                })}
                {tagInput.trim() && !hasExactMatch && (
                  <div
                    onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderTop: filtered.length ? `1px solid ${C.line}` : "none", fontSize: 13, color: C.ink }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: tagPalette[tagLib.length % tagPalette.length] || "#A0A4B8", flexShrink: 0 }} />
                    Create <strong style={{ marginLeft: 4 }}>"{tagInput.trim()}"</strong>
                  </div>
                )}
              </div>
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
