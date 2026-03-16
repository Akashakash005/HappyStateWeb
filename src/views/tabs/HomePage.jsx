import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../state/AuthContext";
import { useTheme } from "../../state/ThemeContext";
import { deleteEntry, getEntries, upsertEntry } from "../../services/entriesService";
import { getProfile } from "../../services/profileService";
import { getMoodOptions } from "../../constants/moods";
import { filterEntriesByRange, formatRangeLabel, getDateRange } from "../../utils/analyticsRange";
import { formatLongDate, toDateKey } from "../../utils/date";

const SLOT_OPTIONS = ["morning", "afternoon", "evening", "night"];
const SLOT_ORDER = { morning: 1, afternoon: 2, evening: 3, night: 4 };
const HISTORY_FILTERS = [
  { key: "week", label: "Current Week" },
  { key: "month", label: "Current Month" },
  { key: "custom", label: "Custom" },
  { key: "all", label: "All" },
];

function capitalize(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";
}

function getWelcomeName(profileName, email) {
  const cleanProfileName = String(profileName || "").trim();
  if (cleanProfileName && !cleanProfileName.includes("@")) return cleanProfileName;
  const localPart = String(email || "").split("@")[0]?.trim();
  return localPart || "there";
}

function getSlotByHour(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function createDraft(isPrivateMode) {
  const now = new Date();
  return {
    id: "",
    date: toDateKey(now),
    slot: getSlotByHour(now.getHours()),
    mood: isPrivateMode ? 1 : 3,
    note: "",
  };
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { isPrivateMode } = useTheme();
  const moodOptions = getMoodOptions(isPrivateMode);
  const [entries, setEntries] = useState([]);
  const [profileName, setProfileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(createDraft(isPrivateMode));
  const [historyFilter, setHistoryFilter] = useState("week");
  const initialCustomRange = useMemo(() => getDateRange("week", new Date()), []);
  const [customStartDate, setCustomStartDate] = useState(initialCustomRange.start);
  const [customEndDate, setCustomEndDate] = useState(initialCustomRange.end);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadEntries().catch(() => {});
  }, [isPrivateMode]);

  useEffect(() => {
    if (!editingEntry) {
      setDraft((prev) => ({ ...prev, mood: isPrivateMode ? 1 : 3 }));
    }
  }, [editingEntry, isPrivateMode]);

  async function loadEntries() {
    const [all, storedProfile] = await Promise.all([getEntries(), getProfile()]);
    setEntries(all);
    setProfileName(String(storedProfile?.name || "").trim());
  }

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function resetDraft() {
    setDraft(createDraft(isPrivateMode));
  }

  const selectedDateKey = draft.date;
  const existingEntryForSelection = useMemo(
    () =>
      entries.find((item) => item.date === selectedDateKey && item.slot === draft.slot) || null,
    [draft.slot, entries, selectedDateKey],
  );

  const saveDisabled = saving || (!!existingEntryForSelection && existingEntryForSelection.id !== editingEntry?.id);

  async function saveEntry() {
    if (saveDisabled) return;
    setSaving(true);
    try {
      const payload = {
        id: editingEntry?.id || `${draft.date}_${draft.slot}`,
        date: draft.date,
        slot: draft.slot,
        mood: draft.mood,
        note: draft.note.trim(),
        actualLoggedAt: new Date().toISOString(),
        isBackfilled: draft.date !== toDateKey(new Date()),
      };

      let updated = await upsertEntry(payload);
      if (editingEntry && editingEntry.id !== payload.id) {
        updated = await deleteEntry(editingEntry.id);
      }
      setEntries(updated);
      setEditingEntry(null);
      resetDraft();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry) {
    setEditingEntry(entry);
    setDraft({
      id: entry.id,
      date: entry.date,
      slot: entry.slot,
      mood: entry.mood,
      note: entry.note || "",
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const updated = await deleteEntry(deleteTarget.id);
    setEntries(updated);
    if (editingEntry?.id === deleteTarget.id) {
      setEditingEntry(null);
      resetDraft();
    }
    setDeleteTarget(null);
  }

  const historyDateRange = useMemo(() => {
    if (historyFilter === "all") return null;
    if (historyFilter === "custom") {
      return getDateRange("custom", new Date(), {
        startDate: customStartDate,
        endDate: customEndDate,
      });
    }
    return getDateRange(historyFilter, new Date());
  }, [customEndDate, customStartDate, historyFilter]);

  const historyEntries = useMemo(() => {
    if (!historyDateRange) return entries;
    return filterEntriesByRange(entries, historyDateRange);
  }, [entries, historyDateRange]);

  const historyRangeLabel = useMemo(() => {
    if (!historyDateRange) return "All time";
    return formatRangeLabel(historyFilter, historyDateRange, new Date());
  }, [historyDateRange, historyFilter]);

  const groupedEntries = useMemo(() => {
    const groups = historyEntries.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        items: [...groups[date]].sort((a, b) => (SLOT_ORDER[b.slot] || 0) - (SLOT_ORDER[a.slot] || 0)),
      }));
  }, [historyEntries]);

  const welcomeName = useMemo(
    () => getWelcomeName(profileName || profile?.displayName, user?.email),
    [profile?.displayName, profileName, user?.email],
  );

  return (
    <div className="page-stack">
    <div className="home-welcome">
  Welcome back,{" "}
  <strong
    style={
      isPrivateMode
        ? {
            background: "linear-gradient(135deg, #e31f01 0%, #a9a6a5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: "1.25rem",
          }
        : {background: "linear-gradient(135deg, #160092 0%, #d9d8df 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: "1.25rem",}
    }
  >
    {welcomeName}
  </strong>{" "}
  !
</div>

      <div className="card gradient-card primary-form-card">
        <h2 className="form-title">What you are feeling now?</h2>
        <div className="meta-line compact" style={{ color: isPrivateMode ? 'white' : 'black' }}>
          Date: {formatLongDate(draft.date)} | Slot: {capitalize(draft.slot)}
        </div>
        {existingEntryForSelection && existingEntryForSelection.id !== editingEntry?.id ? (
          <div className="hint-text">
            Entry already saved for this date and slot. Use Edit below to change it.
          </div>
        ) : null}

        <div className="inline-date-row">
          <input
            className="date-picker-like"
            type="date"
            value={draft.date}
            onChange={(e) => {
              updateDraft("date", e.target.value);
              if (!editingEntry) updateDraft("mood", isPrivateMode ? 1 : 3);
            }}
          />
        </div>

        <div className="slot-grid">
          {SLOT_OPTIONS.map((slot) => (
            <button
              key={slot}
              className={`slot-pill${draft.slot === slot ? " active" : ""}`}
              onClick={() => {
                updateDraft("slot", slot);
                if (!editingEntry) updateDraft("mood", isPrivateMode ? 1 : 3);
              }}
              type="button"
            >
              {capitalize(slot)}
            </button>
          ))}
        </div>

        <div className="mood-grid">
          {moodOptions.map((option) => (
            <button
              key={option.value}
              className={`mood-tile${draft.mood === option.value ? " active" : ""}`}
              onClick={() => updateDraft("mood", option.value)}
              type="button"
            >
              <span className="mood-number">{option.value}</span>
              <span className="mood-label">{option.label}</span>
            </button>
          ))}
        </div>

        <textarea
          className="entry-textarea"
          value={draft.note}
          onChange={(e) => updateDraft("note", e.target.value)}
          placeholder="Start with a thought, a feeling, or a moment..."
        />

        <div className="entry-actions-row">
          {editingEntry ? (
            <button className="secondary-btn" onClick={() => {
              setEditingEntry(null);
              resetDraft();
            }} type="button">
              Cancel
            </button>
          ) : null}
          <button className="primary-btn" disabled={saveDisabled} onClick={saveEntry} type="button">
            {saving ? "Saving..." : editingEntry ? "Save Entry" : existingEntryForSelection ? "Already Saved" : "Save Entry"}
          </button>
        </div>
      </div>

      <div className="entries-section">
        <h3 className="section-heading">Entries By Date</h3>
        <div className="chip-row history-chip-row">
          {HISTORY_FILTERS.map((item) => (
            <button
              key={item.key}
              className={`chip${historyFilter === item.key ? " active" : ""}`}
              onClick={() => setHistoryFilter(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {historyFilter === "custom" ? (
          <div className="form-grid two-up home-custom-range">
            <input type="date" value={toDateKey(customStartDate)} onChange={(e) => setCustomStartDate(new Date(e.target.value))} />
            <input type="date" value={toDateKey(customEndDate)} onChange={(e) => setCustomEndDate(new Date(e.target.value))} />
          </div>
        ) : null}

        <div className="history-range-copy">{historyRangeLabel}</div>
        <div className="list-stack">
          {!groupedEntries.length ? <div className="muted">No entries found for this filter.</div> : null}
          {groupedEntries.map((group) => (
            <div key={group.date}>
              <div className="entry-date-header" style={{ color: isPrivateMode ? 'white' : 'black' }}>{formatLongDate(group.date)}</div>
              {group.items.map((entry) => (
                <div className="entry-card entry-gradient-card" key={entry.id}>
                  <div className="entry-row entry-top-actions">
                    <strong>{capitalize(entry.slot)}</strong>
                    <div className="entry-icon-actions">
                      <button className="icon-chip-btn" onClick={() => startEdit(entry)} type="button" aria-label="Edit entry">
                        <i aria-hidden="true" className="bi bi-pencil-square" />
                      </button>
                      <button className="icon-chip-btn danger" onClick={() => setDeleteTarget(entry)} type="button" aria-label="Delete entry">
                        <i aria-hidden="true" className="bi bi-trash3" />
                      </button>
                    </div>
                  </div>
                  {entry.note ? <div className="entry-note">{entry.note}</div> : null}
                  <div className="entry-badge-row">
                    <span
                      className="mood-badge"
                      style={{
                        background: (() => {
                          const mood = moodOptions.find((item) => item.value === entry.mood);
                          if (mood?.gradient) {
                            return `linear-gradient(135deg, ${mood.gradient[0]}, ${mood.gradient[1]})`;
                          }
                          return mood?.color || '#ff831e';
                        })()
                      }}
                    >
                      {moodOptions.find((item) => item.value === entry.mood)?.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {deleteTarget ? (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card delete-entry-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete entry</h3>
            <p className="muted">This entry will be removed permanently.</p>
            <div className="entry-actions-row">
              <button className="secondary-btn" onClick={() => setDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className="primary-btn delete-confirm-btn" onClick={confirmDelete} type="button">
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
