import { supabase } from "./supabase.js";

const META_KEY = "__meta__"; // reserved week_key row for per-user meta

// ── Weeks ─────────────────────────────────────────────────────────────────────

export async function fetchAllWeeks() {
  const { data, error } = await supabase
    .from("weeks")
    .select("week_key, tasks")
    .neq("week_key", META_KEY); // exclude the meta row
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.week_key, r.tasks]));
}

export async function upsertWeek(userId, weekKey, tasks, updatedAt) {
  const { error } = await supabase.from("weeks").upsert(
    { user_id: userId, week_key: weekKey, tasks, updated_at: updatedAt || new Date().toISOString() },
    { onConflict: "user_id,week_key" }
  );
  if (error) console.error("Supabase save error:", error.message);
}

// ── Meta: per-user, stored in Supabase as a reserved row ─────────────────────

const defaultMeta = () => ({ lastOpenedKey: null, carriedKeys: [] });

export async function fetchMeta() {
  const { data } = await supabase
    .from("weeks")
    .select("tasks")
    .eq("week_key", META_KEY)
    .maybeSingle();
  return data?.tasks ?? defaultMeta();
}

export async function upsertMeta(userId, meta) {
  await supabase.from("weeks").upsert(
    { user_id: userId, week_key: META_KEY, tasks: meta, updated_at: new Date().toISOString() },
    { onConflict: "user_id,week_key" }
  );
}

// localStorage kept as fast initial fallback while Supabase loads
const LS_META = "wt_meta";
export function loadMetaLocal() {
  try { return JSON.parse(localStorage.getItem(LS_META)) ?? defaultMeta(); }
  catch { return defaultMeta(); }
}
export function saveMetaLocal(meta) {
  try { localStorage.setItem(LS_META, JSON.stringify(meta)); } catch {}
}
