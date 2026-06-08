import { useState } from "react";
import C from "../theme.js";
import Circle from "./Circle.jsx";

export default function CarryOverModal({ leftovers, onConfirm, onDone }) {
  const [selected, setSelected] = useState(new Set());

  const flip = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const ghost = {
    border: `1px solid ${C.line2}`, background: "transparent",
    borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
    cursor: "pointer", color: C.sub, fontFamily: "inherit",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(40,42,52,0.34)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, zIndex: 50,
    }}>
      <div style={{
        background: C.card, borderRadius: 14, width: "100%", maxWidth: 440,
        padding: 22, boxShadow: "0 16px 44px rgba(40,42,52,0.22)",
      }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Carry tasks into this week</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 5, lineHeight: 1.45 }}>
          Leftovers from your last open week. Check the ones to bring forward — the rest stay put, ready whenever you want them.
        </div>
        <div style={{
          marginTop: 14, display: "flex", flexDirection: "column",
          maxHeight: 300, overflowY: "auto",
          border: `1px solid ${C.line}`, borderRadius: 10,
        }}>
          {leftovers.map((it) => (
            <div
              key={it.id}
              onClick={() => flip(it.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", padding: "11px 13px",
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <Circle done={selected.has(it.id)} size={17} onClick={() => flip(it.id)} />
              <span style={{ fontSize: 13.5 }}>{it.text}</span>
            </div>
          ))}
          {leftovers.length === 0 && (
            <div style={{ padding: "16px 13px", fontSize: 13, color: C.sub }}>Nothing left over.</div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
          <button onClick={onDone} style={ghost}>Done</button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.size === 0}
            style={{
              background: selected.size ? C.done : C.line2,
              color: C.doneInk, border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: selected.size ? "pointer" : "default", fontFamily: "inherit",
            }}
          >
            Carry {selected.size || ""} over
          </button>
        </div>
      </div>
    </div>
  );
}
