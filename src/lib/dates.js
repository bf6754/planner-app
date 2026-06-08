export const DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const WEEKDAYS = DAYS.slice(0, 5);
export const WEEKEND  = DAYS.slice(5);

const pad = (n) => String(n).padStart(2, "0");

export const ymd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

export const fmtKey = (k) => {
  const [, m, d] = k.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

export function getMonday(d) {
  const x = new Date(d);
  const k = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - k);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function fmtRange(m) {
  const s = addDays(m, 6);
  const a = `${MONTHS[m.getMonth()]} ${m.getDate()}`;
  const b =
    m.getMonth() === s.getMonth()
      ? `${s.getDate()}`
      : `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  return `${a} – ${b}, ${s.getFullYear()}`;
}

export const dayIndex = (d) => (d == null ? 99 : DAYS.indexOf(d));

// A week starts Monday 05:00 local time.
export function weekStartTime(monday) {
  const d = new Date(monday);
  d.setHours(5, 0, 0, 0);
  return d.getTime();
}

// Key of the Monday that owns `now` (≥05:00 Mon → that week, else prior week).
export function currentWeekKey(now = new Date()) {
  const mon = getMonday(now);
  if (now.getTime() < weekStartTime(mon)) {
    // before 05:00 Monday → still last week
    return ymd(addDays(mon, -7));
  }
  return ymd(mon);
}
