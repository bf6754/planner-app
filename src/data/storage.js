// All localStorage access lives here so swapping to a backend only touches this file.

const WEEKS_KEY   = "wt_weeks";
const META_KEY    = "wt_meta";

export function loadWeeks() {
  try {
    const raw = localStorage.getItem(WEEKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWeeks(weeks) {
  try {
    localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
  } catch {
    // storage full — fail silently; data is still in React state
  }
}

// Meta holds: { lastOpenedKey, carriedKeys: string[] }
export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : { lastOpenedKey: null, carriedKeys: [] };
  } catch {
    return { lastOpenedKey: null, carriedKeys: [] };
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}
