import { useEffect, useState } from "react";
import { useTheme } from "../../state/ThemeContext";
import { getCircleState, refreshCircleState } from "../../services/circleService";

export default function CirclePage() {
  const { isPrivateMode } = useTheme();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCircleState().then(setState);
  }, []);

  async function analyze() {
    setLoading(true);
    try {
      const next = await refreshCircleState();
      setState(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="circle-hero-icon">👥</div>
      <h2 className="circle-page-title">Building Your Circle</h2>
      <p className="circle-page-copy">
        {isPrivateMode
          ? "Private mode surfaces who is teasing you, recurring, or heating up."
          : "Your Circle automatically detects people you mention and reveals how those connections correlate with your emotional patterns."}
      </p>

      <div className="card gradient-card circle-discovery-card">
        <h3 className="discover-title">What You will Discover:</h3>
        <div className="discover-block">
          <strong>{isPrivateMode ? "Level Shift" : "Mood Correlations"}</strong>
          <div>
            {isPrivateMode
              ? "Yaar pathi eludhunaa level rise agudhu, yaar pathi sonnaa just spark dhaan nu clear ah theriyum."
              : "See how your mood differs when writing about each person."}
          </div>
        </div>
        <div className="discover-block">
          <strong>{isPrivateMode ? "Yaaru Un Trigger" : "Connection Patterns"}</strong>
          <div>
            {isPrivateMode
              ? "Yaaru unnai romba tease pannura, yaaru peak ku kondu pogura nu idhu dhaan expose pannum."
              : "Find who brings positive energy and who correlates with stress."}
          </div>
        </div>
        <div className="discover-block">
          <strong>{isPrivateMode ? "Recent Obsession" : "Recency Awareness"}</strong>
          <div>
            {isPrivateMode
              ? "Ippo recent ah yaaru thaan un head la odikittu irukaan nu instant ah capture pannum."
              : "Track the latest connections that may need attention."}
          </div>
        </div>
      </div>

      <div className="info-pill">A connection requires 2+ mentions</div>

      <div className="segment-switch">
        <button className="segment-btn active" type="button">Circle Summary</button>
        <button className="segment-btn" type="button">Extracted Names</button>
      </div>

      <button className="primary-btn centered-btn" onClick={analyze} type="button">
        {loading ? "Analyzing..." : "Analyze My Connections"}
      </button>

      <div className="card">
        <h3>Interaction Pattern Cards</h3>
        <p className="muted">
          {isPrivateMode
            ? "Private mode surfaces who is teasing you, recurring, or heating up."
            : "Your Circle detects people you mention and shows how they correlate with your emotional patterns."}
        </p>
        <div className="list-stack">
          {state?.people?.length ? null : <div className="muted">No repeated names yet.</div>}
          {state?.people?.map((person) => (
            <div className="entry-card" key={person.key}>
              <strong>{person.person}</strong>
              <div>Mentions: {person.mentionCount}</div>
              <div>{isPrivateMode ? "Average Level" : "Average Mood"}: {isPrivateMode ? person.avgLevel : person.avgMood}</div>
              <div>Last Mention: {person.lastMentionDate || "n/a"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
