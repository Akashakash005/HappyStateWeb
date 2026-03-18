import { useEffect, useMemo, useState } from "react";
import {
  IoCreateOutline,
  IoPeopleOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { useTheme } from "../../state/ThemeContext";
import {
  deleteCirclePerson,
  getCircleState,
  refreshCircleState,
  saveCirclePersonEdit,
} from "../../services/circleService";
import { formatLongDate } from "../../utils/date";

function formatIntensity(percent) {
  if (percent <= -60) return "⚡ High Pressure";
  if (percent < -20) return "⚡ Pressure";
  if (percent >= 60) return "🟢 Strong Positive";
  if (percent > 20) return "🟢 Positive";
  return "Neutral";
}

export default function CirclePage() {
  const { isPrivateMode } = useTheme();
  const mode = isPrivateMode ? "private" : "public";
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("extracted");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [editAliases, setEditAliases] = useState("");

  useEffect(() => {
    setHasAnalyzed(false);
    setViewMode("extracted");
    getCircleState(mode).then(setState);
  }, [mode]);

  const people = useMemo(() => state?.people || [], [state]);

  function openEditModal(person) {
    setEditKey(person.key);
    setEditPerson(person.person);
    setEditAliases((person.aliases || []).join(", "));
    setEditModalOpen(true);
  }

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const next = await refreshCircleState(mode);
      setState(next);
      setHasAnalyzed(true);
      setViewMode("summary");
    } catch (nextError) {
      setError(nextError?.message || "Failed to analyze connections.");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveEdit() {
    const updated = await saveCirclePersonEdit({
      key: editKey,
      person: editPerson,
      aliases: String(editAliases || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    }, mode);
    setState(updated);
    setEditModalOpen(false);
  }

  async function onDeletePerson() {
    const updated = await deleteCirclePerson(editKey, mode);
    setState(updated);
    setEditModalOpen(false);
  }

  return (
    <div className="page-stack">
      <div className="circle-hero-icon">
        <IoPeopleOutline size={34} />
      </div>
      <h2 className="circle-page-title">Building Your Circle</h2>
      <p className="circle-page-copy">
        {isPrivateMode
          ? "Private mode surfaces who you mention in brackets like [name]."
          : "Your Circle automatically detects people you mention in brackets like [name] and reveals how those connections correlate with your emotional patterns."}
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
              ? "Yaaru unnai romba tease pannura, yaaru peak ku kondu pogura, yaaru repeat ah mind la vara nu idhu dhaan expose pannum."
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
        <button
          className={`segment-btn${viewMode === "summary" ? " active" : ""}`}
          onClick={() => setViewMode("summary")}
          type="button"
          disabled={!hasAnalyzed}
          title={hasAnalyzed ? "View circle summary" : "Run Analyze My Connections to unlock the summary"}
        >
          Circle Summary
        </button>
        <button
          className={`segment-btn${viewMode === "extracted" ? " active" : ""}`}
          onClick={() => setViewMode("extracted")}
          type="button"
        >
          Extracted Names
        </button>
      </div>

      <button
        className="primary-btn centered-btn"
        onClick={analyze}
        type="button"
        disabled={loading}
      >
        {loading ? "Analyzing..." : "Analyze My Connections"}
      </button>

      {error ? <div className="error-copy">{error}</div> : null}

      

      <div className="card">
        <h3>{viewMode === "summary" ? "Interaction Pattern Cards" : "Name | Other Names"}</h3>
        <p className="muted">
          {isPrivateMode
            ? "Private mode surfaces who is teasing you, recurring, or heating up."
            : "Your Circle detects people you mention and shows how they correlate with your emotional patterns."}
        </p>

        {!people.length ? (
          <div className="muted">
            {isPrivateMode
              ? "No names found yet. Enter interaction name at least twice to surface the pattern."
              : "No names found yet. Enter interaction name at least twice to surface the pattern."}
          </div>
        ) : viewMode === "summary" ? (
          <div className="list-stack">
            {people.map((person) => (
              <div className="entry-card circle-entry-card" key={person.key}>
                <div className="circle-person-top">
                  <strong>{person.person}</strong>
                  <button
                    className="icon-chip-btn"
                    onClick={() => openEditModal(person)}
                    type="button"
                    aria-label={`Edit ${person.person}`}
                  >
                    <IoCreateOutline size={15} />
                  </button>
                </div>
                <div className="circle-correlation">
                  {formatIntensity(person.interactionIntensity)}
                </div>
                <div>Other Names: {(person.aliases || []).join(", ") || "None"}</div>
                <div>Mentions: {person.mentionCount}</div>
                <div>
                  Interaction Intensity: {Number(person.interactionIntensity || 0).toFixed(1)}%
                </div>
                {isPrivateMode ? (
                  <>
                    <div>Peak Level: {person.peakLevel.toFixed(2)}</div>
                    <div>High Intensity Mentions: {person.highIntensityCount}</div>
                    <div>Recent Heat: {person.recentHeat.toFixed(2)}</div>
                  </>
                ) : null}
                <div>Last Mention: {formatLongDate(person.lastMentionDate)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="list-stack">
            {people.map((person) => (
              <div className="entry-card circle-card" key={person.key}>
                <div style={{ fontWeight: 'bold' }}>{person.person}</div>
                <div>Mentions: {person.mentionCount}</div>
                <div>Avg Mood: {person.avgMood.toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "summary" && hasAnalyzed ? (
          <div className="list-stack circle-summary-stack">
            <div className="card circle-summary-card">
              <h4>{isPrivateMode ? "Who is teasing you more?" : "Who brings positive energy?"}</h4>
              <p>
                {isPrivateMode
                  ? state?.topTeasing?.length
                    ? state.topTeasing.join(", ")
                    : "No strong teasing pattern yet."
                  : state?.positiveEnergy?.length
                    ? state.positiveEnergy.join(", ")
                    : "No strong positive patterns yet."}
              </p>
            </div>

            <div className="card circle-summary-card">
              <h4>{isPrivateMode ? "Who pushes you to peak level?" : "Who correlates with stress?"}</h4>
              <p>
                {isPrivateMode
                  ? state?.peakTriggers?.length
                    ? state.peakTriggers.join(", ")
                    : "No peak trigger pattern yet."
                  : state?.stressCorrelated?.length
                    ? state.stressCorrelated.join(", ")
                    : "No strong stress-linked patterns yet."}
              </p>
            </div>

            {isPrivateMode ? (
              <>
                <div className="card circle-summary-card">
                  <h4>Who stays in your head most?</h4>
                  <p>
                    {state?.mostFrequent?.length
                      ? state.mostFrequent.join(", ")
                      : "No repeat obsession pattern yet."}
                  </p>
                </div>
                <div className="card circle-summary-card">
                  <h4>Who is heating up recently?</h4>
                  <p>
                    {state?.risingRecently?.length
                      ? state.risingRecently.join(", ")
                      : "No recent rise detected yet."}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {editModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card circle-edit-modal">
            <h3>Edit Extracted Person</h3>
            <div className="field-block">
              <label htmlFor="circle-person">Primary name</label>
              <input
                id="circle-person"
                value={editPerson}
                onChange={(event) => setEditPerson(event.target.value)}
                placeholder="Primary name"
              />
            </div>
            <div className="field-block">
              <label htmlFor="circle-aliases">Other names, comma separated</label>
              <textarea
                id="circle-aliases"
                value={editAliases}
                onChange={(event) => setEditAliases(event.target.value)}
                placeholder="Other names, comma separated"
              />
            </div>
            <div className="circle-edit-actions">
              <button className="secondary-btn" onClick={() => setEditModalOpen(false)} type="button">
                Cancel
              </button>
              <button className="delete-entry-btn" onClick={onDeletePerson} type="button" aria-label="Delete person">
                <IoTrashOutline size={15} />
              </button>
              <button className="primary-btn" onClick={onSaveEdit} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
