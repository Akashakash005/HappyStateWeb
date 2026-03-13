import { getProfile } from "./profileService";
import { getEntries } from "./entriesService";
import { getMemoryContext } from "./journalMemoryService";

function truncate(text, max = 220) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + Number(n || 0), 0) / values.length;
}

function isWithinLastDays(isoDate, days = 7) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  const diff = now - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function buildProfileSummary(profile = {}) {
  const details = [
    profile?.name ? `Name: ${profile.name}` : "",
    profile?.age ? `Age: ${profile.age}` : "",
    profile?.gender ? `Gender: ${profile.gender}` : "",
    profile?.profession ? `Profession: ${profile.profession}` : "",
    profile?.stressLevel ? `Stress baseline: ${profile.stressLevel}` : "",
    profile?.energyPattern ? `Energy pattern: ${profile.energyPattern}` : "",
    profile?.emotionalSensitivity ? `Sensitivity: ${profile.emotionalSensitivity}` : "",
    profile?.aiTone ? `Preferred tone: ${profile.aiTone}` : "",
    profile?.suggestionDepth ? `Depth: ${profile.suggestionDepth}` : "",
    profile?.about ? `About: ${truncate(profile.about, 180)}` : "",
  ].filter(Boolean);
  return truncate(details.join(" | "), 420);
}

function buildMoodSummary(entries = []) {
  const recent = entries
    .filter((entry) => isWithinLastDays(entry?.dateISO || entry?.actualLoggedAt || entry?.updatedAt, 7))
    .slice(0, 20);
  if (!recent.length) return { recentMoodTrend: "No recent mood entries in the last 7 days.", recentEntriesSummary: "" };

  const sortedAsc = [...recent].sort(
    (a, b) => new Date(a.dateISO || a.actualLoggedAt || a.updatedAt || 0) - new Date(b.dateISO || b.actualLoggedAt || b.updatedAt || 0),
  );
  const scores = sortedAsc.map((entry) => Number(entry?.score ?? 0)).filter((n) => !Number.isNaN(n));
  const pivot = Math.max(1, Math.floor(scores.length / 2));
  const firstHalf = scores.slice(0, pivot);
  const secondHalf = scores.slice(pivot);
  const delta = average(secondHalf) - average(firstHalf);
  const overall = average(scores);

  let trendText = `7d average mood score: ${overall.toFixed(2)}.`;
  if (delta >= 0.12) trendText += " Trend: improving.";
  else if (delta <= -0.12) trendText += " Trend: declining.";
  else trendText += " Trend: stable.";

  const entryHighlights = sortedAsc
    .slice(-5)
    .map((entry) => {
      const note = truncate(entry?.note || "", 64);
      return `${entry.date} ${entry.slot} mood:${entry.mood} ${note ? `"${note}"` : "no note"}`.trim();
    })
    .filter(Boolean)
    .join(" | ");

  return {
    recentMoodTrend: truncate(trendText, 180),
    recentEntriesSummary: truncate(entryHighlights, 420),
  };
}

function buildRecentHistorySummary(history = []) {
  const compact = (history || [])
    .slice(-6)
    .map((msg) => {
      const role = msg?.role === "assistant" ? "assistant" : "user";
      const text = truncate(msg?.text || "", 90);
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join(" | ");
  return truncate(compact, 520);
}

export async function buildJournalContext({ history = [] } = {}) {
  const [profile, entries, memory] = await Promise.all([getProfile(), getEntries(), getMemoryContext()]);
  const mood = buildMoodSummary(entries || []);
  const longTerm = memory?.longTermSummary || {};
  const rolling = memory?.rollingContext || {};
  const manualTagsSummary = Array.isArray(longTerm.manualTags) && longTerm.manualTags.length
    ? longTerm.manualTags.map((item) => `${item.label}: ${item.name}`).join(", ")
    : "Not available";
  return {
    profileSummary: buildProfileSummary(profile || {}),
    recentMoodTrend: mood.recentMoodTrend,
    recentEntriesSummary: mood.recentEntriesSummary,
    longTermSummary: truncate(
      [
        longTerm.profileSummary,
        longTerm.emotionalBaselineSummary,
        longTerm.personalityPattern,
        longTerm.stressBaseline,
      ].filter(Boolean).join(" | "),
      520,
    ) || "Not available",
    rollingSummary: truncate(
      [
        rolling.recentMoodTrend7d,
        rolling.recentEntriesSummary,
        rolling.sessionSummary,
        rolling.activeFocus,
      ].filter(Boolean).join(" | "),
      520,
    ) || "Not available",
    recentChatHistorySummary: buildRecentHistorySummary(history),
    manualTagsSummary,
  };
}
