import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabase = createClient(
  "https://uohzahtlldhzlunxpvtu.supabase.co",
  "sb_publishable_JO1CKpEx09fLmxW8DokIIQ_25IGFUFg"
);

const { data: rows, error } = await supabase
  .from("weeks")
  .select("id, user_id, week_key, tasks")
  .neq("week_key", "__meta__");

if (error) { console.error(error); process.exit(1); }

let totalTasks = 0, totalSubs = 0, duplicates = 0;
const seenIds = new Set();

for (const row of rows) {
  let changed = false;
  const tasks = (row.tasks || []).map((t) => {
    let task = { ...t };
    if (!task.id || seenIds.has(task.id)) {
      console.log(`  Re-ID task "${task.text}" (old: ${task.id})`);
      task = { ...task, id: randomUUID() };
      duplicates++;
      changed = true;
    }
    seenIds.add(task.id);
    totalTasks++;

    const subSeen = new Set();
    task.subtasks = (task.subtasks || []).map((s) => {
      let sub = { ...s };
      if (!sub.id || seenIds.has(sub.id) || subSeen.has(sub.id)) {
        console.log(`    Re-ID subtask "${sub.text}" (old: ${sub.id})`);
        sub = { ...sub, id: randomUUID() };
        duplicates++;
        changed = true;
      }
      seenIds.add(sub.id);
      subSeen.add(sub.id);
      totalSubs++;
      return sub;
    });
    return task;
  });

  if (changed) {
    const { error: saveErr } = await supabase.from("weeks").upsert(
      { user_id: row.user_id, week_key: row.week_key, tasks, updated_at: new Date().toISOString() },
      { onConflict: "user_id,week_key" }
    );
    if (saveErr) console.error(`Failed to save ${row.week_key}:`, saveErr.message);
    else console.log(`Saved ${row.week_key}`);
  }
}

console.log(`\nDone. ${totalTasks} tasks, ${totalSubs} subtasks, ${duplicates} IDs replaced.`);
