function round2(value) {
  return Number((value || 0).toFixed(2));
}

function toScore(mood) {
  return ((Number(mood) || 3) - 3) / 2;
}

export function calculateDailyAverage(entries) {
  const byDate = {};
  (entries || []).forEach((entry) => {
    const day = entry.date;
    if (!day) return;
    byDate[day] = byDate[day] || [];
    byDate[day].push(typeof entry.score === "number" ? entry.score : toScore(entry.mood));
  });

  return Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      average: round2(values.reduce((acc, v) => acc + v, 0) / values.length),
      count: values.length,
    }));
}

export function calculateStabilityFromSeries(values) {
  const points = (values || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!points.length) return 0;
  if (points.length === 1) return 100;

  let diffSum = 0;
  for (let i = 1; i < points.length; i += 1) {
    diffSum += Math.abs(points[i] - points[i - 1]);
  }
  const avgDiff = diffSum / (points.length - 1);
  const normalizedInstability = Math.max(0, Math.min(1, avgDiff / 2));
  return Math.max(0, Math.min(100, Math.round((1 - normalizedInstability) * 100)));
}

export function calculateSlotAverage(entries) {
  const slots = ["morning", "afternoon", "evening", "night"];
  const aggregates = { morning: [], afternoon: [], evening: [], night: [] };

  (entries || []).forEach((entry) => {
    const slot = slots.includes(entry.slot) ? entry.slot : "evening";
    const score = typeof entry.score === "number" ? entry.score : toScore(entry.mood);
    aggregates[slot].push(score);
  });

  return slots.map((slot) => {
    const values = aggregates[slot];
    return {
      slot,
      average: values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      count: values.length,
    };
  });
}
