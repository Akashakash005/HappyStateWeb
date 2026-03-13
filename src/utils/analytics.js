import { toDateKey } from "./date";

export function getStats(entries) {
  if (!entries.length) {
    return { total: 0, average: 0, streak: 0, trend: "stable" };
  }

  const average =
    entries.reduce((sum, item) => sum + Number(item.mood || 3), 0) /
    entries.length;
  const daySet = new Set(entries.map((entry) => toDateKey(entry.dateISO)));
  const cursor = new Date();
  let streak = 0;

  while (daySet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    total: entries.length,
    average: Number(average.toFixed(2)),
    streak,
    trend: "stable",
  };
}
