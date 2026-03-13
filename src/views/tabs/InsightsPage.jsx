import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../state/ThemeContext";
import { generateInsight } from "../../services/aiService";
import { getEntries } from "../../services/entriesService";
import { getStats } from "../../utils/analytics";

const ranges = ["day", "week", "month", "year"];

export default function InsightsPage() {
  const { isPrivateMode } = useTheme();
  const [entries, setEntries] = useState([]);
  const [selectedRange, setSelectedRange] = useState("week");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEntries().then(setEntries);
  }, []);

  const stats = useMemo(() => getStats(entries), [entries]);

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
