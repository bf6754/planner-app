export const Check = ({ s = 11, c = "#fff" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const Arrow = ({ dir }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: dir === "right" ? "rotate(180deg)" : "none" }}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const Plus = ({ s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Chev = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
