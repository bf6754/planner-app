import { supabase } from "./supabase.js";

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function fetchAllTasks(userId) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.id, rowToTask(r)]));
}

export async function upsertTask(userId, task) {
  const ts = new Date().toISOString();
  const { data, error } = await supabase.from("tasks").upsert({
    id:         task.id,
    user_id:    userId,
    text:       task.text,
    done:       task.done,
    subtasks:   task.subtasks ?? [],
    priority:   task.priority ?? null,
    type:       task.type ?? null,
    deadline:   task.deadline ?? null,
    notes:      task.notes ?? "",
    tag_ids:     task.tag_ids ?? [],
    category_id: task.category_id ?? null,
    updated_at:  ts,
  }, { onConflict: "id" }).select("updated_at");
  if (error) { console.error("upsertTask:", error.message); return null; }
  return data?.[0]?.updated_at ?? null;
}

export async function deleteTaskById(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) console.error("deleteTaskById:", error.message);
}

function rowToTask(r) {
  return {
    id:          r.id,
    text:        r.text,
    done:        r.done,
    subtasks:    r.subtasks ?? [],
    priority:    r.priority ?? null,
    type:        r.type ?? null,
    deadline:    r.deadline ?? null,
    notes:       r.notes ?? "",
    tag_ids:     r.tag_ids ?? [],
    category_id: r.category_id ?? null,
    createdAt:   r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt:   r.updated_at,
  };
}

// ── Week Assignments ───────────────────────────────────────────────────────────

export async function fetchAllAssignments(userId) {
  const { data, error } = await supabase
    .from("week_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw error;
  const result = {};
  for (const r of data) {
    if (!result[r.week_key]) result[r.week_key] = [];
    result[r.week_key].push(rowToAssignment(r));
  }
  return result;
}

export async function upsertAssignment(userId, a) {
  const ts = new Date().toISOString();
  const { data, error } = await supabase.from("week_tasks").upsert(
    assignmentToRow(userId, a, ts),
    { onConflict: "id" }
  ).select("id, updated_at");
  if (error) { console.error("upsertAssignment:", error.message); return null; }
  return data?.[0] ?? null;
}

export async function upsertAssignments(userId, assignments) {
  if (!assignments.length) return;
  const ts = new Date().toISOString();
  const rows = assignments.map((a) => assignmentToRow(userId, a, ts));
  const { error } = await supabase.from("week_tasks").upsert(rows, { onConflict: "id" });
  if (error) console.error("upsertAssignments:", error.message);
  return ts;
}

export async function deleteAssignment(assignmentId) {
  const { error } = await supabase.from("week_tasks").delete().eq("id", assignmentId);
  if (error) console.error("deleteAssignment:", error.message);
}

function rowToAssignment(r) {
  return {
    id:         r.id,
    taskId:     r.task_id,
    weekKey:    r.week_key,
    claimedDay: r.claimed_day ?? null,
    carried:    r.carried ?? false,
    position:   r.position ?? 0,
    updatedAt:  r.updated_at,
  };
}

function assignmentToRow(userId, a, ts) {
  return {
    id:          a.id,
    task_id:     a.taskId,
    user_id:     userId,
    week_key:    a.weekKey,
    claimed_day: a.claimedDay ?? null,
    carried:     a.carried ?? false,
    position:    a.position ?? 0,
    updated_at:  ts,
  };
}

// ── Tags ───────────────────────────────────────────────────────────────────────

export async function fetchAllTags(userId) {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function upsertTag(userId, tag) {
  const { error } = await supabase.from("tags").upsert(
    { id: tag.id, user_id: userId, name: tag.name, color: tag.color },
    { onConflict: "id" }
  );
  if (error) console.error("upsertTag:", error.message);
}

export async function deleteTag(tagId) {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) console.error("deleteTag:", error.message);
}

// ── Categories ─────────────────────────────────────────────────────────────────

export async function fetchAllCategories(userId) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name");
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function upsertCategory(userId, cat) {
  const { error } = await supabase.from("categories").upsert(
    { id: cat.id, user_id: userId, name: cat.name, color: cat.color },
    { onConflict: "id" }
  );
  if (error) console.error("upsertCategory:", error.message);
}

export async function deleteCategory(catId) {
  const { error } = await supabase.from("categories").delete().eq("id", catId);
  if (error) console.error("deleteCategory:", error.message);
}

// ── Meta ───────────────────────────────────────────────────────────────────────

const defaultMeta = () => ({ lastOpenedKey: null, carryDoneKey: null });

export async function fetchMeta(userId) {
  const { data } = await supabase
    .from("user_meta")
    .select("last_opened_key, carry_done_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return defaultMeta();
  return { lastOpenedKey: data.last_opened_key ?? null, carryDoneKey: data.carry_done_key ?? null };
}

export async function upsertMeta(userId, meta) {
  await supabase.from("user_meta").upsert({
    user_id:         userId,
    last_opened_key: meta.lastOpenedKey ?? null,
    carry_done_key:  meta.carryDoneKey ?? null,
    updated_at:      new Date().toISOString(),
  }, { onConflict: "user_id" });
}

const LS_META = "wt_meta_v2";
export function loadMetaLocal() {
  try { return JSON.parse(localStorage.getItem(LS_META)) ?? defaultMeta(); }
  catch { return defaultMeta(); }
}
export function saveMetaLocal(meta) {
  try { localStorage.setItem(LS_META, JSON.stringify(meta)); } catch {}
}

// ── One-time migration from old weeks table ────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUUID  = (id) => UUID_RE.test(id ?? "") ? id : crypto.randomUUID();

export async function migrateFromWeeksTable(userId) {
  const { data: weeksData, error } = await supabase
    .from("weeks")
    .select("week_key, tasks")
    .eq("user_id", userId)
    .neq("week_key", "__meta__");
  if (error || !weeksData?.length) return false;

  // Pass 1: build old-id → canonical UUID map for every task
  const idMap = {};
  for (const { tasks } of weeksData) {
    for (const t of (tasks || [])) {
      if (!idMap[t.id]) idMap[t.id] = toUUID(t.id);
    }
  }

  // Pass 2: build task rows (deduplicated) and assignment rows
  // Carry-over copies (originId set) share the original's canonical ID — no separate task row.
  const taskMap = {};        // canonicalId → task row
  const assignmentRows = [];

  for (const { week_key, tasks } of weeksData) {
    (tasks || []).forEach((t, idx) => {
      // If this is a carry-over copy, point to the original's canonical ID
      const canonicalId = (t.originId && idMap[t.originId])
        ? idMap[t.originId]
        : idMap[t.id];

      if (!taskMap[canonicalId]) {
        taskMap[canonicalId] = {
          id:         canonicalId,
          user_id:    userId,
          text:       t.text ?? "",
          done:       t.done ?? false,
          subtasks:   (t.subtasks || []).map((s) => ({
            id: toUUID(s.id), text: s.text, done: s.done ?? false, claimedDay: s.claimedDay ?? null,
          })),
          priority:   t.priority ?? null,
          type:       t.type ?? null,
          deadline:   t.deadline ?? null,
          notes:      t.notes ?? "",
          created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else if (t.done) {
        // If any version (original or copy) is done, mark the canonical task as done
        taskMap[canonicalId].done = true;
      }

      assignmentRows.push({
        id:          crypto.randomUUID(),
        task_id:     canonicalId,
        user_id:     userId,
        week_key,
        claimed_day: t.claimedDay ?? null,
        carried:     t.carried ?? false,
        position:    idx,
        updated_at:  new Date().toISOString(),
      });
    });
  }

  const taskRows = Object.values(taskMap);
  if (!taskRows.length) return false;

  const { error: te } = await supabase.from("tasks").insert(taskRows);
  if (te) { console.error("[migration] tasks insert failed:", te.message); return false; }

  const { error: ae } = await supabase.from("week_tasks").insert(assignmentRows);
  if (ae) { console.error("[migration] week_tasks insert failed:", ae.message); return false; }

  console.log(`[migration] ${taskRows.length} tasks, ${assignmentRows.length} assignments migrated`);
  return true;
}
