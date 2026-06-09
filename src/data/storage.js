import { supabase } from "./supabase.js";

// ── Meta: device-level state (carry-over prompt, last-opened week) ────────────
// Stays in localStorage — intentionally per-device so the carry-over prompt
// appears the first time each device opens a new week.

const META_KEY = "wt_meta";

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : { lastOpenedKey: null, carriedKeys: [] };
  } catch {
    return { lastOpenedKey: null, carriedKeys: [] };
  }
}

export function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
}

// ── Weeks: stored in Supabase, one row per week per user ──────────────────────

export async function fetchAllWeeks() {
  const { data, error } = await supabase
    .from("weeks")
    .select("week_key, tasks");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.week_key, r.tasks]));
}

export async function upsertWeek(userId, weekKey, tasks) {
  const { error } = await supabase.from("weeks").upsert(
    { user_id: userId, week_key: weekKey, tasks, updated_at: new Date().toISOString() },
    { onConflict: "user_id,week_key" }
  );
  if (error) console.error("Supabase save error:", error.message);
}
