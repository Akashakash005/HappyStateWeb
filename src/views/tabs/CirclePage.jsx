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

function moodCorrelationLabel(avgMood, isPrivateMode = false) {
  if (isPrivateMode) {
    if (avgMood >= 0.2) return "High tease";
    if (avgMood <= -0.2) return "Low tease";
    return "Mixed signal";
  }
  if (avgMood >= 0.2) return "Positive";
  if (avgMood <= -0.2) return "Stress-linked";
  return "Mixed";
}

export default function CirclePage() {
  const { isPrivateMode } = useTheme();
  const mode = isPrivateMode ? "private" : "public";
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("summary");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [editAliases, setEditAliases] = useState("");

  useEffect(() => {
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

      {state?.extractionMeta?.puterNotConnected ? (
        <div className="card status-card">Puter not connected</div>
      ) : null}
      {state?.extractionMeta?.providerFailed ? (
        <div className="card status-card">AI provider failed, used fallback extraction</div>
      ) : null}
      {state?.extractionMeta?.entriesWithNoNames > 0 ? (
        <div className="card status-card">
          No names found in {state.extractionMeta.entriesWithNoNames} entr{state.extractionMeta.entriesWithNoNames === 1 ? "y" : "ies"}.
        </div>
      ) : null}

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
              ? "No repeated names yet. Mention someone at least twice in private logs to surface the pattern."
              : "No repeated names yet. Mention people at least twice in journal chats."}
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
                  {moodCorrelationLabel(person.avgMood, isPrivateMode)}
                </div>
                <div>Other Names: {(person.aliases || []).join(", ") || "None"}</div>
                <div>Mentions: {person.mentionCount}</div>
                <div>
                  {isPrivateMode ? "Average Level" : "Average Mood Score"}:{" "}
                  {isPrivateMode ? person.avgLevel.toFixed(2) : person.avgMood.toFixed(2)}
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
                <div>Other Names: {(person.aliases || []).join(", ") || "None"}</div>
                <div>Mentions: {person.mentionCount}</div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "summary" ? (
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
