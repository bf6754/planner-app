export default function TagChip({ tag, onRemove, small }) {
  const size = small ? 10 : 11;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: tag.color + "22",
      color: tag.color,
      border: `1px solid ${tag.color}55`,
      borderRadius: 5,
      padding: small ? "1px 5px" : "2px 7px",
      fontSize: size,
      fontWeight: 600,
      letterSpacing: 0.2,
      lineHeight: 1.6,
      whiteSpace: "nowrap",
    }}>
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: tag.color, opacity: 0.7, fontSize: 11, lineHeight: 1, fontFamily: "inherit" }}>
          ×
        </button>
      )}
    </span>
  );
}
