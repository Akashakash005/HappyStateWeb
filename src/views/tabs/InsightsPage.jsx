import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../state/ThemeContext";
import { generateInsight } from "../../services/aiService";
import { getEntries } from "../../services/entriesService";
import { getStats } from "../../utils/analytics";
import { getMoodDataByRange } from "../../utils/moodRangeFilter";

const ranges = ["day", "week", "month", "year"];

export default function InsightsPage() {
  const { isPrivateMode } = useTheme();
  const [entries, setEntries] = useState([]);
  const [selectedRange, setSelectedRange] = useState("week");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fixApplied, setFixApplied] = useState(false);

  useEffect(() => {
    getEntries().then(setEntries);
  }, []);

  // Reset fix state when range changes
  useEffect(() => {
    setFixApplied(false);
  }, [selectedRange]);

  const stats = useMemo(() => getStats(entries), [entries]);

  const localSuggestion = useMemo(() => {
    if (!entries.length) return null;
    const data = getMoodDataByRange(entries, selectedRange);

    // High instability (mood swings)
    if (data.instabilityIndex > 0.4) {
      return "Try a 5-minute breathing exercise when you feel a sudden mood shift.";
    }

    // Consistently low mood
    if (data.overallAverage < 0) {
      if (data.commonNegativeTime === 'morning') return "Start your day with a glass of water and 5 mins of sunlight to boost morning energy.";
      if (data.commonNegativeTime === 'afternoon') return "Take a 15-minute screen-free break at 2 PM to reset.";
      if (data.commonNegativeTime === 'evening') return "Take a 10-min walk + avoid phone after 7PM to decompress.";
      if (data.commonNegativeTime === 'night') return "Set a strict offline wind-down routine 1 hour before bed.";
      return "Write down one small win today to break the negative cycle.";
    }

    // Mixed or slightly positive but with notable negative days
    if (data.negativeDays > data.positiveDays) {
      return "You had some tough days. Prioritize an early bedtime tonight to recover.";
    }

    // Stable and positive
    if (data.stabilityScore > 80 && data.overallAverage > 0) {
      return "You're on a great streak! Keep up your current routines, they are working.";
    }

    // Default / neutral
    return "Reflect on what made your day stable today and do more of it tomorrow.";
  }, [entries, selectedRange]);

  async function runInsight() {
    setLoading(true);
    setError("");
    try {
      const next = await generateInsight({
        allEntries: entries,
        selectedRange,
        insightMode: isPrivateMode ? "private" : "public",
      });
      setResult(next);
    } catch (err) {
      setError(err.message || "Failed to generate suggestion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="card">
        <h2>{isPrivateMode ? "Private Insights" : "Personal Insights"}</h2>
        <p className="muted">
          {isPrivateMode
            ? "Based on your private tracking, here are hidden patterns, trigger signals, and control insights."
            : "Based on your tracked mood history, here are actionable observations."}
        </p>
        <div className="chip-row">
          {ranges.map((range) => (
            <button
              className={`chip${selectedRange === range ? " active" : ""}`}
              key={range}
              onClick={() => setSelectedRange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>

        {localSuggestion && (
          <div className="entry-card alert-card" style={{ marginBottom: '1rem', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "0.5rem" }}>
              <strong style={{ color: 'var(--primary)' }}>Action Suggestion</strong>
              <button
                className={`chip ${fixApplied ? 'active' : ''}`}
                onClick={() => setFixApplied(true)}
                disabled={fixApplied}
                style={{ margin: 0, padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
              >
                {fixApplied ? "Fix Applied ✓" : "Apply Fix"}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: fixApplied ? 'var(--text-muted)' : 'inherit', textDecoration: fixApplied ? 'line-through' : 'none' }}>
              {localSuggestion}
            </p>
          </div>
        )}

        <button className="primary-btn" onClick={runInsight} type="button">
          {loading ? "Generating..." : "Get AI Suggestion"}
        </button>
        {error ? <div className="error-text">{error}</div> : null}
        {result ? (
          <div className="list-stack spaced">
            <div className="entry-card">
              <strong>Snapshot</strong>
              <div>Average: {result.emotionalSummary?.overallAverage ?? stats.average}</div>
              <div>Stability: {result.emotionalSummary?.stabilityScore ?? 0}%</div>
              <div>Data points: {result.emotionalSummary?.entryCount ?? entries.length}</div>
            </div>
            <div className="entry-card prose">{result.insight}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
