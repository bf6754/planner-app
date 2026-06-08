import C from "../theme.js";
import { Check } from "./Icons.jsx";

export default function Circle({ done, onClick, size = 18, accent = C.line2 }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: size, height: size, minWidth: size,
        borderRadius: "50%",
        border: `2px solid ${done ? C.done : accent}`,
        background: done ? C.done : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0, transition: "all .14s ease",
      }}
    >
      {done && <Check s={size * 0.58} c={C.doneInk} />}
    </button>
  );
}
