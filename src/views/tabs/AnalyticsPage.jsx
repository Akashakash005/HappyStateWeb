import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../../state/ThemeContext";
import { getEntries } from "../../services/entriesService";
import {
  deleteActivityCalendarEntry,
  getActivityCalendarEntries,
  upsertActivityCalendarEntry,
} from "../../services/activityCalendarService";
import {
  calculateDailyAverage,
  calculateSlotAverage,
  calculateStabilityFromSeries,
} from "../../utils/analyticsCalculations";
import {
  filterEntriesByRange,
  formatRangeLabel,
  getDateRange,
  getHalfYearRange,
  shiftReferenceDate,
} from "../../utils/analyticsRange";
import { formatLongDate, toDateKey } from "../../utils/date";

const VIEW_OPTIONS = [
  { key: "analytics", label: "Analytics" },
  { key: "calendar", label: "Streak Calendar" },
];

const BASE_FILTERS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "halfyear", label: "Half Year" },
  { key: "custom", label: "Custom" },
];

const PRODUCTIVITY_LEVELS = [
  {
    value: 0,
    label: "0 / No Start",
    subtitle: "Take the first step",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
  {
    value: 1,
    label: "1 / Getting Started",
    subtitle: "You broke the inertia",
    color: "#FDE68A",        // soft yellow
    textColor: "#78350F"
  },
  {
    value: 2,
    label: "2 / Building Momentum",
    subtitle: "Consistency forming",
    color: "#86EFAC",        // light green
    textColor: "#14532D"
  },
  {
    value: 3,
    label: "3 / Strong Progress",
    subtitle: "You're in the zone",
    color: "#4ADE80",        // medium green
    textColor: "#064E3B"
  },
  {
    value: 4,
    label: "4 / High Performance",
    subtitle: "Serious focus achieved",
    color: "#22C55E",        // deeper green
    textColor: "#052E16"
  },
  {
    value: 5,
    label: "5 / Elite Execution",
    subtitle: "Peak productivity unlocked",
    color: "#166534",        // dark rich green
    textColor: "#FFFFFF"
  }
];
const PRODUCTIVITY_CATEGORY = [
  {
    value: 0,
    label: "Competetive exams",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
  {
    value: 0,
    label: "coding",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
  {
    value: 0,
    label: "other",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
];
const PRIVATE_CATEGORY = [
  {
    value: 0,
    label: "image",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
  {
    value: 0,
    label: "video",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
  {
    value: 0,
    label: "other",
    color: "#E5E7EB",        // soft gray
    textColor: "#374151"
  },
];
const PRIVATE_LEVELS = [
  { value: 0, label: "0 / Silver", subtitle: "Calm day", color: "#C0C0C0", textColor: "#111111" },
  { value: 1, label: "1 / Pink", subtitle: "Teasing", color: "#FF8FB1", textColor: "#4A1022" },
  { value: 2, label: "2 / Dark Pink", subtitle: "Naughty", color: "#C2185B", textColor: "#FFFFFF" },
  { value: 3, label: "3 / Dark Red", subtitle: "Off the rails", color: "#7A0019", textColor: "#FFFFFF" },
];

const FAQ_PUBLIC = [
  ["Stability Score", "How steady your mood has been across the selected period. Higher is steadier."],
  ["Variability", "How much your mood swings up and down. Higher means larger fluctuations."],
  ["Trend Direction", "Change from early period to latest period. Positive means improving, negative means declining."],
  ["Recovery Score", "How quickly mood returns to neutral/positive after low states."],
  ["Peak Intensity", "Strongest emotional intensity reached, regardless of positive or negative direction."],
  ["Emotional Balance", "Share of positive entries in the selected period."],
  ["Momentum", "Recent direction based on your last three points."],
  ["Resilience", "Combined indicator of recovery speed, trend, and stability."],
];

const FAQ_PRIVATE = [
  ["Arousal Stability", "How consistent your horny level has been during the period."],
  ["Arousal Swing", "How wildly your horniness fluctuates."],
  ["Desire Trend", "Direction of change from start to end of period."],
  ["Refractory Recovery", "How fast you bounce back after a low or flat period."],
  ["Peak Charge", "Highest arousal intensity reached in the period."],
  ["Charged Ratio", "Percentage of entries where you felt properly horny."],
  ["Recent Heat (Last 3)", "Direction based on your last three logs."],
  ["Libido Resilience", "Combined signal of how well you maintain / recover arousal momentum."],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function stdDev(values) {
  if (!values.length) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, n) => sum + (n - mean) * (n - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function round2(value) {
  return Number((value || 0).toFixed(2));
}

function scoreToPercent(score) {
  return Math.round(clamp(((score || 0) + 1) * 50, 0, 100));
}

function toEntryScore(entry) {
  if (typeof entry?.score === "number") return entry.score;
  const mood = Number(entry?.mood || 3);
  return (mood - 3) / 2;
}

function toEntryTime(entry) {
  const value = entry?.dateISO || entry?.actualLoggedAt || entry?.updatedAt || entry?.date;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function toSlotLabel(slot) {
  if (slot === "morning") return "M";
  if (slot === "afternoon") return "A";
  if (slot === "evening") return "E";
  if (slot === "night") return "N";
  return "*";
}

function formatSlotName(slot) {
  if (!slot) return "";
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

function slotColor(score, isPrivateMode = false) {
  if (isPrivateMode) {
    if (score > 0.2) return "#C2185B";
    if (score < -0.2) return "#C0C0C0";
    return "#FF8FB1";
  }
  if (score > 0.2) return "#22C55E";
  if (score < -0.2) return "#EF4444";
  return "#F59E0B";
}

function scoreLabel(score, isPrivateMode = false) {
  if (isPrivateMode) {
    if (score > 0.2) return "Charged";
    if (score < -0.2) return "Flat";
    return "Teasing";
  }
  if (score > 0.2) return "Positive";
  if (score < -0.2) return "Low";
  return "Neutral";
}

function getMoodPalette(averageMoodPercent, isPrivateMode = false) {
  if (isPrivateMode) {
    if (averageMoodPercent >= 80) return ["#8A0F4D", "#C2185B", "#F8BBD0"];
    if (averageMoodPercent >= 50) return ["#FFB6C1", "#FFC1D6", "#FFF0F5"];
    return ["#676565", "#3c2d2d", "#454141"];
  }
  if (averageMoodPercent >= 80) return ["#29e518", "#6ccb7e", "#e3ffea"];
  if (averageMoodPercent >= 50) return ["#f8e61d", "#ffee6e", "#E3E8FF"];
  return ["#fa6d58", "#ff7c6e", "#E3E8FF"];
}

function toIsoMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const shift = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - shift);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getAggregationUnit(filter, range) {
  if (filter === "week") return "day";
  if (filter === "month") return "week";
  if (filter === "halfyear") return "month";
  if (filter !== "custom") return "day";
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1);
  if (days <= 14) return "day";
  if (days <= 120) return "week";
  return "month";
}

function getBucketStart(dateInput, unit) {
  if (unit === "month") return startOfMonth(dateInput);
  if (unit === "week") return startOfWeekMonday(dateInput);
  return startOfDay(dateInput);
}

function advanceBucket(dateInput, unit) {
  const d = new Date(dateInput);
  if (unit === "month") d.setMonth(d.getMonth() + 1);
  else if (unit === "week") d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 1);
  return d;
}

function getBucketKey(dateInput, unit) {
  if (unit === "month") return toIsoMonth(dateInput);
  return toDateKey(dateInput);
}

function getBucketLabel(dateInput, unit) {
  if (unit === "month") return dateInput.toLocaleDateString("en-US", { month: "short" });
  return dateInput.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function findFallbackValueBeforeDate(allEntries, dateStartTs, isPrivateMode = false) {
  const before = (allEntries || [])
    .filter((entry) => {
      const ts = new Date(entry.dateISO || entry.actualLoggedAt || entry.updatedAt || entry.date).getTime();
      return !Number.isNaN(ts) && ts < dateStartTs;
    })
    .sort((a, b) => toEntryTime(b) - toEntryTime(a));
  if (!before.length) return isPrivateMode ? -1 : 0;
  return toEntryScore(before[0]);
}

function shiftMonth(date, amount) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getCalendarCells(monthDate) {
  const start = startOfMonth(monthDate);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start.getDay(); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getCurrentStreak(logMap) {
  let streak = 0;
  const cursor = startOfDay(new Date());
  while (true) {
    const score = Number(logMap[toDateKey(cursor)]?.score || 0);
    if (score <= 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function createMetrics(filteredEntries, slotAverage, isPrivateMode = false) {
  const ordered = [...filteredEntries].sort((a, b) => toEntryTime(a) - toEntryTime(b));
  const scores = ordered.map((entry) => toEntryScore(entry));
  const levels = ordered.map((entry) => Number(entry?.mood || 3));
  const total = scores.length;
  const meanPercent = scoreToPercent(average(scores));
  const averageLevel = round2(average(levels));
  const variability = Math.round(clamp(stdDev(scores) * 100, 0, 100));
  const trend = total >= 2 ? round2(scores[total - 1] - scores[0]) : 0;
  const peakIntensity = round2(
    isPrivateMode ? (levels.length ? Math.max(...levels) : 0) : (scores.length ? Math.max(...scores.map((s) => Math.abs(s))) : 0),
  );
  const balance = Math.round(
    ((isPrivateMode ? levels.filter((level) => level >= 4).length : scores.filter((s) => s > 0).length) / (total || 1)) *
    100,
  );
  const last3 = scores.slice(-3);
  const momentum = last3.length >= 2 ? round2(last3[last3.length - 1] - last3[0]) : 0;
  const bestSlot = slotAverage.reduce((best, slot) => (slot.average > best.average ? slot : best), slotAverage[0] || { slot: "morning", average: 0 });
  const worstSlot = slotAverage.reduce((worst, slot) => (slot.average < worst.average ? slot : worst), slotAverage[0] || { slot: "morning", average: 0 });
  return {
    averageMoodPercent: meanPercent,
    averageLevel,
    variability,
    trend,
    peakIntensity,
    balance,
    momentum,
    bestSlot,
    worstSlot,
  };
}

export default function AnalyticsPage() {
  const { isPrivateMode } = useTheme();
  const [viewMode, setViewMode] = useState("analytics");
  const [entries, setEntries] = useState([]);
  const [activityEntries, setActivityEntries] = useState([]);
  const [filter, setFilter] = useState("week");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [trackerMonthDate, setTrackerMonthDate] = useState(startOfMonth(new Date()));
  const [trackerDate, setTrackerDate] = useState(new Date());
  const [trackerScore, setTrackerScore] = useState(0);
  const [trackerCategory, setTrackerCategory] = useState("");
  const [trackerTopics, setTrackerTopics] = useState([]);
  const initialCustomRange = useMemo(() => getDateRange("month", new Date()), []);
  const [customStartDate, setCustomStartDate] = useState(initialCustomRange.start);
  const [customEndDate, setCustomEndDate] = useState(initialCustomRange.end);
  const [faqOpen, setFaqOpen] = useState(false);

  useEffect(() => {
    Promise.all([getEntries(), getActivityCalendarEntries()]).then(([allEntries, allActivityEntries]) => {
      setEntries(allEntries);
      setActivityEntries(allActivityEntries);
    });
  }, []);

  const activityLevels = useMemo(() => (isPrivateMode ? PRIVATE_LEVELS : PRODUCTIVITY_LEVELS), [isPrivateMode]);
  const activityCategory = useMemo(() => (isPrivateMode ? PRIVATE_CATEGORY : PRODUCTIVITY_CATEGORY), [isPrivateMode]);
  const filters = useMemo(() => {
    const halfYearLabel = getHalfYearRange(referenceDate).label.split(" ")[0];
    return BASE_FILTERS.map((item) => (item.key === "halfyear" ? { ...item, label: halfYearLabel } : item));
  }, [referenceDate]);
  const dateRange = useMemo(
    () => getDateRange(filter, referenceDate, { startDate: customStartDate, endDate: customEndDate }),
    [customEndDate, customStartDate, filter, referenceDate],
  );
  const rangeLabel = useMemo(() => formatRangeLabel(filter, dateRange, referenceDate), [dateRange, filter, referenceDate]);
  const filteredEntries = useMemo(() => filterEntriesByRange(entries, dateRange), [dateRange, entries]);
  const aggregationUnit = useMemo(() => getAggregationUnit(filter, dateRange), [dateRange, filter]);

  const trendSeries = useMemo(() => {
    if (filter === "day") {
      return [...filteredEntries]
        .sort((a, b) => toEntryTime(a) - toEntryTime(b))
        .map((entry, index) => ({
          label: toSlotLabel(entry.slot),
          value: round2(toEntryScore(entry)),
          key: `${entry?.id || "entry"}-${index}`,
        }));
    }

    const daily = calculateDailyAverage(filteredEntries);
    const buckets = {};
    daily.forEach((item) => {
      const date = new Date(item.date);
      const bucketDate = getBucketStart(date, aggregationUnit);
      const key = getBucketKey(bucketDate, aggregationUnit);
      buckets[key] = buckets[key] || [];
      buckets[key].push(item.average);
    });
    const rangeStart = dateRange.start.getTime();
    const rangeEnd = dateRange.end.getTime();
    let carry = findFallbackValueBeforeDate(entries, rangeStart, isPrivateMode);
    const filled = [];
    let cursor = getBucketStart(dateRange.start, aggregationUnit);
    while (cursor.getTime() <= rangeEnd) {
      const key = getBucketKey(cursor, aggregationUnit);
      const values = buckets[key];
      if (values?.length) carry = round2(values.reduce((sum, n) => sum + n, 0) / values.length);
      filled.push({ label: getBucketLabel(cursor, aggregationUnit), value: carry, key });
      cursor = advanceBucket(cursor, aggregationUnit);
    }
    return filled;
  }, [aggregationUnit, dateRange.end, dateRange.start, entries, filteredEntries, filter, isPrivateMode]);

  const slotAverage = useMemo(() => calculateSlotAverage(filteredEntries), [filteredEntries]);
  const stability = useMemo(() => calculateStabilityFromSeries(trendSeries.map((item) => item.value)), [trendSeries]);
  const metrics = useMemo(() => createMetrics(filteredEntries, slotAverage, isPrivateMode), [filteredEntries, isPrivateMode, slotAverage]);
  const moodColors = useMemo(() => getMoodPalette(metrics.averageMoodPercent, isPrivateMode), [isPrivateMode, metrics.averageMoodPercent]);

  const chartData = useMemo(
    () =>
      trendSeries.map((item) => ({
        label: item.label,
        value: isPrivateMode ? round2(item.value * 2 + 3) : item.value,
      })),
    [isPrivateMode, trendSeries],
  );

  const activityMap = useMemo(
    () => activityEntries.reduce((acc, entry) => ({ ...acc, [entry.date]: entry }), {}),
    [activityEntries],
  );
  const selectedTrackerDateKey = useMemo(() => toDateKey(trackerDate), [trackerDate]);
  const selectedTrackerEntry = activityMap[selectedTrackerDateKey] || null;
  const [currentTopic, setCurrentTopic] = useState("");
  // Initialize trackerTopics side-effect when clicking calendar
  useEffect(() => {
    setTrackerCategory(selectedTrackerEntry?.category || "");
    setTrackerTopics(selectedTrackerEntry?.topics || []);
  }, [selectedTrackerDateKey, selectedTrackerEntry]);
  const trackerLevel =
    activityLevels.find((item) => item.value === trackerScore) || activityLevels[0];
  const calendarCells = useMemo(() => getCalendarCells(trackerMonthDate), [trackerMonthDate]);
  const trackerMonthLabel = trackerMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const monthEntries = useMemo(
    () =>
      activityEntries.filter((entry) => entry.date.startsWith(`${trackerMonthDate.getFullYear()}-${String(trackerMonthDate.getMonth() + 1).padStart(2, "0")}`)),
    [activityEntries, trackerMonthDate],
  );
  const nonZeroMonthEntries = useMemo(
    () => monthEntries.filter((entry) => Number(entry.score || 0) > 0),
    [monthEntries],
  );
  const trackerAverage = nonZeroMonthEntries.length ? average(nonZeroMonthEntries.map((entry) => Number(entry.score || 0))) : 0;
  const trackerStreak = useMemo(() => getCurrentStreak(activityMap), [activityMap]);

  async function saveTrackerScore() {
    const cleanedTopics = trackerTopics.map(t => typeof t === "string" ? t.trim() : "").filter(Boolean);
    const updated = await upsertActivityCalendarEntry({ date: trackerDate, score: trackerScore, category: trackerCategory, topics: cleanedTopics });
    setActivityEntries(updated);
    setTrackerTopics(cleanedTopics);
  }

  async function clearTrackerScore() {
    const updated = await deleteActivityCalendarEntry(trackerDate);
    setActivityEntries(updated);
    setTrackerScore(0);
    setTrackerCategory("");
    setTrackerTopics([]);
  }

  return (
    <div >
      <div className={`chip-row analytics-switch-row${viewMode === 'calendar' ? ' calendar-active' : ''}`}>
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.key}
            className={`chip${viewMode === option.key ? " active" : ""}`}
            onClick={() => setViewMode(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {viewMode === "analytics" ? (
        <>
          <div className="analytics-nav-label">Time Filter</div>
          <div className="chip-row analytics-filter-row analytics-chip-row">
            {filters.map((item) => (
              <button
                key={item.key}
                className={`chip${filter === item.key ? " active" : ""}`}
                onClick={() => setFilter(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="analytics-nav-block">

            {/* <div className="analytics-nav-label">Date Range</div> */}

            <div className="analytics-date-nav">
              <button
                className="nav-arrow"
                onClick={() =>
                  setReferenceDate(
                    shiftReferenceDate(referenceDate, filter, -1)
                  )
                }
                type="button"
              >
                ‹
              </button>

              <div className="date-range">{rangeLabel}</div>

              <button
                className="nav-arrow"
                onClick={() =>
                  setReferenceDate(
                    shiftReferenceDate(referenceDate, filter, 1)
                  )
                }
                type="button"
              >
                ›
              </button>

              {/* <button
      className="today-btn"
      onClick={() => setReferenceDate(new Date())}
      type="button"
    >
      Today
    </button> */}
            </div>

          </div>

          {filter === "custom" ? (
            <div className="form-grid two-up">
              <input type="date" value={toDateKey(customStartDate)} onChange={(e) => setCustomStartDate(new Date(e.target.value))} />
              <input type="date" value={toDateKey(customEndDate)} onChange={(e) => setCustomEndDate(new Date(e.target.value))} />
            </div>
          ) : null}

          <div className="analytics-mobile-stack">
            <div className="card gradient-card analytics-hero-card">
              <div className="entry-row analytics-card-header">
                <div>
                  <h3 className="analytics-card-title">
                    {isPrivateMode ? "Naughty Trend Graph" : "Emotional Trend Graph"}
                  </h3>
                  <div className="analytics-card-subtitle">
                    X-axis: {filter === "day" ? "Slot" : "Day"} | Y-axis: {isPrivateMode ? "Level" : "Mood score"}
                  </div>
                </div>

              </div>

              <div className="analytics-chart-shell">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 6, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                    <XAxis dataKey="label" tickMargin={8} />
                    <YAxis
                      domain={isPrivateMode ? [1, 5] : [-1, 1]}
                      width={40}
                      tickMargin={6}
                      label={{
                        value: isPrivateMode ? "Intensity" : "Mood",
                        angle: -90,
                        position: "insideLeft",
                        style: { textAnchor: "middle" }
                      }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="metrics-grid analytics-summary-grid">
              <div
                className="metric-box analytics-highlight-card analytics-score-card"
                style={{ background: `linear-gradient(135deg, ${moodColors[0]}, ${moodColors[1]}, ${moodColors[2]})` }}
              >
                <span>{isPrivateMode ? "Avg Level" : "Mood Score"}</span>
                <strong>{isPrivateMode ? `${metrics.averageLevel.toFixed(1)}/5` : `${metrics.averageMoodPercent}%`}</strong>
              </div>
              <div className="metric-box analytics-highlight-card">
                <span>Entries</span>
                <strong>{filteredEntries.length}</strong>
              </div>
            </div>

            <div className="card gradient-card analytics-slot-card">
              <h3 className="analytics-card-title">{isPrivateMode ? "Hot Time Slots" : "Time Slot Pattern"}</h3>
              <div className="analytics-best-worst">
                {isPrivateMode ? "Hottest" : "Best"}: {formatSlotName(metrics.bestSlot.slot)} ({scoreToPercent(metrics.bestSlot.average)}%) | {isPrivateMode ? "Coolest" : "Worst"}: {formatSlotName(metrics.worstSlot.slot)} ({scoreToPercent(metrics.worstSlot.average)}%)
              </div>
              <div className="slot-average-grid analytics-slot-grid">
                {slotAverage.map((slot) => (
                  <div className="metric-box analytics-slot-box" key={slot.slot}>
                    <span className="slot-dot" style={{ backgroundColor: slotColor(slot.average, isPrivateMode) }} />
                    <span>{formatSlotName(slot.slot)}</span>
                    {isPrivateMode ? null : <strong>{slot.average.toFixed(2)}</strong>}
                    <small>{scoreLabel(slot.average, isPrivateMode)}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="card gradient-card analytics-advanced-card">
              <div className="entry-row analytics-card-header">
                <h3 className="analytics-card-title">
                  {isPrivateMode ? "Advanced Naughty Analytics" : "Advanced Mood Analytics"}
                </h3>
                <button className="analytics-info-dot" onClick={() => setFaqOpen(true)} type="button">
                  i
                </button>
              </div>
              <div className="analytics-stats-grid">
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Arousal Stability" : "Stability"}</strong><div className="stat-value">{stability}%</div></div>
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Arousal Swing" : "Variability"}</strong><div className="stat-value">{metrics.variability}%</div></div>
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Desire Trend" : "Trend"}</strong><div className="stat-value">{metrics.trend > 0 ? "+" : ""}{metrics.trend.toFixed(2)}</div></div>
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Peak Level" : "Peak"}</strong><div className="stat-value">{isPrivateMode ? `${metrics.peakIntensity.toFixed(1)}/5` : metrics.peakIntensity.toFixed(2)}</div></div>
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Charged Ratio" : "Balance"}</strong><div className="stat-value">{metrics.balance}%</div></div>
                <div className="entry-card analytics-stat-box"><strong>{isPrivateMode ? "Recent Heat" : "Momentum"}</strong><div className="stat-value">{metrics.momentum > 0 ? "+" : ""}{metrics.momentum.toFixed(2)}</div></div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h3 className="analytics-card-title">{isPrivateMode ? "Naughty Calendar" : "Productivity Calendar"}</h3>
            <p className="streak-shell-copy">
              {isPrivateMode
                ? "One private score per day for how naughty the character felt."
                : "One public score per day for how productive the character felt."}
            </p>

            <div className="streak-metrics-grid">
              <div className="streak-metric-card">
                <span>Current Streak</span>
                <strong>{trackerStreak}</strong>
              </div>
              <div className="streak-metric-card">
                <span>Month Logs</span>
                <strong>{nonZeroMonthEntries.length}</strong>
              </div>
              <div className="streak-metric-card">
                <span>Month Avg</span>
                <strong>{trackerAverage.toFixed(1)}</strong>
              </div>
            </div>



            <div className="analytics-nav-row streak-month-nav">
              <button className="chip streak-month-chip" onClick={() => setTrackerMonthDate(shiftMonth(trackerMonthDate, -1))} type="button">
                Prev
              </button>
              <div className="analytics-nav-label streak-month-label">{trackerMonthLabel}</div>
              <button className="chip streak-month-chip" onClick={() => setTrackerMonthDate(shiftMonth(trackerMonthDate, 1))} type="button">
                Next
              </button>
            </div>

            <div className="entry-card streak-log-card">
              <strong className="streak-log-title">{isPrivateMode ? "Naughty Log" : "Productive Log"}</strong>
              <div className="streak-log-date">{formatLongDate(selectedTrackerDateKey)}</div>
              <div className="entry-row streak-log-actions">
                <input className="streak-date-input" type="date" value={selectedTrackerDateKey} onChange={(e) => setTrackerDate(new Date(e.target.value))} />
                <select className="streak-score-select" value={trackerScore} onChange={(e) => setTrackerScore(Number(e.target.value))}>
                  {activityLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="entry-row streak-log-controls">
                <label className="streak-date-input streak-label">Category</label>
                <select
                  className="streak-score-select"
                  value={trackerCategory}
                  onChange={(e) => setTrackerCategory(e.target.value)}
                >
                  <option value="" disabled>Select a category...</option>
                  {activityCategory.map((cat) => (
                    <option key={cat.label} value={cat.label}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>



              {trackerCategory && (
                <div className="topics-container">

                  {/* Input Row */}
                  <div className="topic-input-row">
                    <input
                      className="topic-input"
                      placeholder="Type topic..."
                      value={currentTopic}
                      onChange={(e) => setCurrentTopic(e.target.value)}
                    />

                    <button
                      type="button"
                      className="topic-add-btn"
                      onClick={() => {
                        if (!currentTopic.trim()) return;

                        setTrackerTopics([...trackerTopics, currentTopic.trim()]);
                        setCurrentTopic(""); // clear input
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Topics List */}
                  {trackerTopics.length > 0 && (
                    <div className="topics-list">
                      {trackerTopics.map((topic, index) => (
                        <div className="manual-tag-grid-row" key={`topic_${index}`}>
                          <input
                            className="cell"
                            value={topic}
                            onChange={(e) => {
                              const next = [...trackerTopics];
                              next[index] = e.target.value;
                              setTrackerTopics(next);
                            }}
                          />
                          <button
                            className="manual-tag-delete-btn"
                            onClick={() => {
                              const next = [...trackerTopics];
                              next.splice(index, 1);
                              setTrackerTopics(next);
                            }}
                            type="button"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="streak-log-subtitle">{trackerLevel.subtitle}</div>
              <div className="entry-row streak-log-actions">
                <button className="secondary-btn streak-clear-btn" onClick={clearTrackerScore} type="button">Clear</button>
                <button className="primary-btn streak-save-btn" onClick={saveTrackerScore} type="button">
                  {selectedTrackerEntry ? "Update Log" : "Save Log"}
                </button>
              </div>
            </div>


          </div>
          <div className="card streak-calendar-card">
            <div className="legend-levels streak-legend-levels">
              {activityLevels.map((level) => (
                <div className="legend-level streak-legend-level" key={level.value} style={{ backgroundColor: level.color, color: level.textColor }}>
                  {level.value}
                </div>
              ))}
            </div>
            <div className="calendar-grid streak-calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div className="calendar-weekday" key={day}>{day}</div>
              ))}
              {calendarCells.map((cell, index) => {
                if (!cell) return <div className="calendar-empty" key={`blank-${index}`} />;
                const dateKey = toDateKey(cell);
                const savedScore = Number(activityMap[dateKey]?.score || 0);
                const level = activityLevels.find((item) => item.value === savedScore) || activityLevels[0];
                const selected = dateKey === selectedTrackerDateKey;
                return (
                  <button
                    key={dateKey}
                    className={`calendar-cell streak-calendar-cell${selected ? " selected" : ""}`}
                    style={{ backgroundColor: level.color, color: level.textColor }}
                    onClick={() => {
                      setTrackerDate(cell);
                      setTrackerMonthDate(startOfMonth(cell));
                      setTrackerScore(savedScore);
                    }}
                    type="button"
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>

      )}
      <div className="page-stack">
        {faqOpen ? (
          <div className="modal-backdrop" onClick={() => setFaqOpen(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="entry-row">
                <h3>{isPrivateMode ? "Private Analytics FAQ" : "Public Analytics FAQ"}</h3>
                <button className="chip" onClick={() => setFaqOpen(false)} type="button">Close</button>
              </div>
              <div className="list-stack">
                {(isPrivateMode ? FAQ_PRIVATE : FAQ_PUBLIC).map(([title, description]) => (
                  <div className="entry-card" key={title}>
                    <strong>{title}</strong>
                    <div className="muted">{description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
