import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../state/AuthContext";
import { useTheme } from "../../state/ThemeContext";
import { getProfile, saveProfile } from "../../services/profileService";
import { getJournalMemory, saveJournalMemory } from "../../services/journalMemoryService";

const TABS = [
  { key: "mode", label: "Mode" },
  { key: "general", label: "General" },
  { key: "emotional", label: "Emotional" },
  { key: "ai", label: "AI Preferences" },
  { key: "journal", label: "Journal Settings" },
  { key: "privacy", label: "Privacy" },
  { key: "account", label: "Account" },
];

const STRESS_OPTIONS = ["Low", "Medium", "High"];
const ENERGY_OPTIONS = ["Morning", "Night", "Mixed"];
const SENSITIVITY_OPTIONS = ["Low", "Moderate", "High"];
const AI_TONE_OPTIONS = ["Gentle", "Direct", "Motivational"];
const DEPTH_OPTIONS = ["Quick", "Detailed"];
const RANGE_OPTIONS = ["Day", "Week", "Month", "Year"];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"];

const SECTION_LABELS = {
  general: "General",
  emotional: "Emotional",
  ai: "AI Preferences",
  journal: "Journal Settings",
  privacy: "Privacy",
};

function defaultEditState() {
  return {
    general: false,
    emotional: false,
    ai: false,
    journal: false,
    privacy: false,
  };
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { isPrivateMode, setPrivateMode } = useTheme();
  const [form, setForm] = useState(null);
  const [memoryForm, setMemoryForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [sectionEdit, setSectionEdit] = useState(defaultEditState());
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [saveNotice, setSaveNotice] = useState("");

  async function loadPageData() {
    const [profile, memory] = await Promise.all([getProfile(), getJournalMemory()]);
    setForm(profile);
    setMemoryForm(memory);
  }

  useEffect(() => {
    loadPageData().catch(() => {});
  }, [isPrivateMode]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const timeout = window.setTimeout(() => setSaveNotice(""), 1500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  function setField(key, value) {
    setForm((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function setMemoryField(key, value) {
    setMemoryForm((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function toggleEdit(sectionKey) {
    setSectionEdit((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  }

  function renderSegment(options, value, setter, disabled = false) {
    return (
      <div className="segmented-row">
        {options.map((option) => (
          <button
            key={option}
            className={`segment-option${value === option ? " active" : ""}`}
            disabled={disabled}
            onClick={() => setter(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  async function saveSection(sectionKey) {
    if (saving) return;
    setSaving(true);
    try {
      if (sectionKey === "journal") {
        const nextMemory = await saveJournalMemory(memoryForm || {});
        setMemoryForm(nextMemory);
      } else {
        const nextProfile = await saveProfile(form || {});
        setForm(nextProfile);
        if (sectionKey === "privacy" || sectionKey === "mode") {
          setPrivateMode(Boolean(nextProfile.privateJournalMode));
          await loadPageData();
        }
      }
      setSectionEdit((prev) => ({ ...prev, [sectionKey]: false }));
      setSaveNotice(`${SECTION_LABELS[sectionKey] || "Profile"} saved`);
    } finally {
      setSaving(false);
    }
  }

  function addManualTag() {
    const label = String(newTagLabel || "").trim();
    const name = String(newTagName || "").trim();
    if (!label || !name) return;
    setMemoryForm((prev) => ({
      ...(prev || {}),
      manualTags: [...(prev?.manualTags || []), { label, name }],
    }));
    setNewTagLabel("");
    setNewTagName("");
  }

  const sectionContent = useMemo(() => {
    if (!form || !memoryForm) return null;

    if (activeTab === "mode") {
      return (
        <div className="profile-panel profile-gradient-panel">
          <div className="profile-panel-header">
            <div>
              <h3>Character Mode</h3>
              <p>Switch the entire app between public and private character data instantly.</p>
            </div>
          </div>

          <button
            className={`mode-card-btn${!form.privateJournalMode ? " active" : ""}`}
            onClick={async () => {
              setPrivateMode(false);
              setField("privateJournalMode", false);
              await loadPageData();
            }}
            type="button"
          >
            <span className="mode-card-title">Public Character</span>
            <span className="mode-card-copy">Uses the public collection for profile, moods, journal, and memory.</span>
          </button>
          <button
            className={`mode-card-btn${form.privateJournalMode ? " active" : ""}`}
            onClick={async () => {
              setPrivateMode(true);
              setField("privateJournalMode", true);
              await loadPageData();
            }}
            type="button"
          >
            <span className="mode-card-title">Private Character</span>
            <span className="mode-card-copy">Uses the private collection for the full app, including memory and mood logs.</span>
          </button>
        </div>
      );
    }

    if (activeTab === "general") {
      const editable = sectionEdit.general;
      return (
        <div className="profile-panel profile-gradient-panel">
          <SectionHeader
            editable={editable}
            onToggle={() => toggleEdit("general")}
            subtitle="Used for profile context in personalized AI summaries."
            title="General"
          />

          <FieldBlock label="Name">
            <input disabled={!editable} value={form.name || ""} onChange={(e) => setField("name", e.target.value)} />
          </FieldBlock>

          <FieldBlock hint="Primary account email (read-only)" label="Email">
            <input disabled value={user?.email || ""} />
          </FieldBlock>

          <div className="form-grid two-up profile-two-up">
            <FieldBlock label="Age">
              <input disabled={!editable} value={form.age || ""} onChange={(e) => setField("age", e.target.value)} />
            </FieldBlock>
            <FieldBlock label="Gender">
              <select disabled={!editable} value={form.gender || GENDER_OPTIONS[3]} onChange={(e) => setField("gender", e.target.value)}>
                {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </FieldBlock>
          </div>

          <FieldBlock label="Profession">
            <input disabled={!editable} value={form.profession || ""} onChange={(e) => setField("profession", e.target.value)} />
          </FieldBlock>

          <div className="form-grid two-up profile-two-up">
            <FieldBlock label="Weight (kg)">
              <input disabled={!editable} value={form.weight || ""} onChange={(e) => setField("weight", e.target.value)} />
            </FieldBlock>
            <FieldBlock label="Height (cm)">
              <input disabled={!editable} value={form.height || ""} onChange={(e) => setField("height", e.target.value)} />
            </FieldBlock>
          </div>

          <FieldBlock label="About">
            <textarea disabled={!editable} value={form.about || ""} onChange={(e) => setField("about", e.target.value)} />
          </FieldBlock>

          <SaveButton disabled={!editable || saving} label={saving ? "Saving..." : "Save Changes"} onClick={() => saveSection("general")} />
        </div>
      );
    }

    if (activeTab === "emotional") {
      const editable = sectionEdit.emotional;
      return (
        <div className="profile-panel profile-gradient-panel">
          <SectionHeader
            editable={editable}
            onToggle={() => toggleEdit("emotional")}
            subtitle="Used for trend analysis and stability insights."
            title="Emotional Baseline"
          />

          <FieldBlock label="Stress Level">
            {renderSegment(STRESS_OPTIONS, form.stressLevel, (next) => setField("stressLevel", next), !editable)}
          </FieldBlock>

          <FieldBlock label="Sleep Average (hours)">
            <input disabled={!editable} value={form.sleepAverage || ""} onChange={(e) => setField("sleepAverage", e.target.value)} />
          </FieldBlock>

          <FieldBlock label="Energy Pattern">
            {renderSegment(ENERGY_OPTIONS, form.energyPattern, (next) => setField("energyPattern", next), !editable)}
          </FieldBlock>

          <FieldBlock label="Emotional Sensitivity">
            {renderSegment(SENSITIVITY_OPTIONS, form.emotionalSensitivity, (next) => setField("emotionalSensitivity", next), !editable)}
          </FieldBlock>

          <SaveButton disabled={!editable || saving} label={saving ? "Saving..." : "Save Changes"} onClick={() => saveSection("emotional")} />
        </div>
      );
    }

    if (activeTab === "ai") {
      const editable = sectionEdit.ai;
      return (
        <div className="profile-panel profile-gradient-panel">
          <SectionHeader
            editable={editable}
            onToggle={() => toggleEdit("ai")}
            subtitle="Controls tone, depth and default range for AI outputs."
            title="AI Preferences"
          />

          <FieldBlock label="AI Tone">
            {renderSegment(AI_TONE_OPTIONS, form.aiTone, (next) => setField("aiTone", next), !editable)}
          </FieldBlock>

          <FieldBlock label="Suggestion Depth">
            {renderSegment(DEPTH_OPTIONS, form.suggestionDepth, (next) => setField("suggestionDepth", next), !editable)}
          </FieldBlock>

          <FieldBlock label="Default Insight Range">
            {renderSegment(RANGE_OPTIONS, form.defaultInsightRange, (next) => setField("defaultInsightRange", next), !editable)}
          </FieldBlock>

          <SaveButton disabled={!editable || saving} label={saving ? "Saving..." : "Save Changes"} onClick={() => saveSection("ai")} />
        </div>
      );
    }

    if (activeTab === "journal") {
      const editable = sectionEdit.journal;
      return (
        <div className="profile-panel profile-gradient-panel">
          <SectionHeader
            editable={editable}
            onToggle={() => toggleEdit("journal")}
            subtitle="Edit the same AI long-term context used in journal conversations."
            title="Journal Settings"
          />

          <FieldBlock hint="Add mappings like boss: Rakesh" label="Manual Tags">
            <div className="form-grid two-up profile-two-up">
              <input disabled={!editable} placeholder="Label (e.g. boss)" value={newTagLabel} onChange={(e) => setNewTagLabel(e.target.value)} />
              <input disabled={!editable} placeholder="Name (e.g. Rakesh)" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
            </div>
            <button className="inline-add-btn" disabled={!editable} onClick={addManualTag} type="button">Add Tag</button>
            <div className="manual-tag-grid">
              {(memoryForm.manualTags || []).map((tag, index) => (
                <div className="manual-tag-grid-row" key={`${tag.label}_${index}`}>
                  <input
                    className="manual-tag-cell"
                    disabled={!editable}
                    value={String(tag.label || "")}
                    onChange={(e) =>
                      setMemoryForm((prev) => {
                        const next = [...(prev?.manualTags || [])];
                        next[index] = { ...next[index], label: e.target.value };
                        return { ...(prev || {}), manualTags: next };
                      })
                    }
                  />
                  <input
                    className="manual-tag-cell"
                    disabled={!editable}
                    value={String(tag.name || "")}
                    onChange={(e) =>
                      setMemoryForm((prev) => {
                        const next = [...(prev?.manualTags || [])];
                        next[index] = { ...next[index], name: e.target.value };
                        return { ...(prev || {}), manualTags: next };
                      })
                    }
                  />
                  <button
                    aria-label={`Delete tag ${tag.label}`}
                    className="manual-tag-delete-btn"
                    disabled={!editable}
                    onClick={() =>
                      setMemoryForm((prev) => ({
                        ...(prev || {}),
                        manualTags: (prev?.manualTags || []).filter((_, idx) => idx !== index),
                      }))
                    }
                    type="button"
                  >
                    <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </FieldBlock>

          <FieldBlock hint="This text is used as AI memory context." label="Profile Summary">
            <textarea disabled={!editable} value={memoryForm.profileSummary || ""} onChange={(e) => setMemoryField("profileSummary", e.target.value)} />
          </FieldBlock>

          <FieldBlock label="Emotional Baseline Summary">
            <textarea disabled={!editable} value={memoryForm.emotionalBaselineSummary || ""} onChange={(e) => setMemoryField("emotionalBaselineSummary", e.target.value)} />
          </FieldBlock>

          <FieldBlock label="Personality Pattern">
            <textarea disabled={!editable} value={memoryForm.personalityPattern || ""} onChange={(e) => setMemoryField("personalityPattern", e.target.value)} />
          </FieldBlock>

          <FieldBlock label="Stress Baseline">
            <input disabled={!editable} value={memoryForm.stressBaseline || ""} onChange={(e) => setMemoryField("stressBaseline", e.target.value)} />
          </FieldBlock>

          <FieldBlock hint="Comma separated" label="Emotional Triggers">
            <input disabled={!editable} value={memoryForm.emotionalTriggersText || ""} onChange={(e) => setMemoryField("emotionalTriggersText", e.target.value)} />
          </FieldBlock>

          <FieldBlock hint="Comma separated" label="Support Patterns">
            <input disabled={!editable} value={memoryForm.supportPatternsText || ""} onChange={(e) => setMemoryField("supportPatternsText", e.target.value)} />
          </FieldBlock>

          <FieldBlock hint="Comma separated" label="Recurring Themes">
            <input disabled={!editable} value={memoryForm.recurringThemesText || ""} onChange={(e) => setMemoryField("recurringThemesText", e.target.value)} />
          </FieldBlock>

          <FieldBlock hint="Comma separated" label="Relationship Patterns">
            <input disabled={!editable} value={memoryForm.relationshipPatternsText || ""} onChange={(e) => setMemoryField("relationshipPatternsText", e.target.value)} />
          </FieldBlock>

          <SaveButton disabled={!editable || saving} label={saving ? "Saving..." : "Save Changes"} onClick={() => saveSection("journal")} />
        </div>
      );
    }

    if (activeTab === "privacy") {
      const editable = sectionEdit.privacy;
      return (
        <div className="profile-panel profile-gradient-panel">
          <SectionHeader
            editable={editable}
            onToggle={() => toggleEdit("privacy")}
            subtitle="Choose how much long-term context AI can use."
            title="Privacy"
          />

          <label className="profile-switch-row">
            <span>Allow long-term emotional analysis</span>
            <input checked={Boolean(form.allowLongTermAnalysis)} disabled={!editable} onChange={(e) => setField("allowLongTermAnalysis", e.target.checked)} type="checkbox" />
          </label>

          <label className="profile-switch-row">
            <span>Show professional support suggestions</span>
            <input checked={Boolean(form.showProfessionalSupportSuggestions)} disabled={!editable} onChange={(e) => setField("showProfessionalSupportSuggestions", e.target.checked)} type="checkbox" />
          </label>

          <SaveButton disabled={!editable || saving} label={saving ? "Saving..." : "Save Changes"} onClick={() => saveSection("privacy")} />
        </div>
      );
    }

    return (
      <div className="profile-panel profile-gradient-panel">
        <div className="profile-panel-header">
          <div>
            <h3>Account</h3>
            <p>Security and account-level controls.</p>
          </div>
        </div>
        <button className="secondary-btn profile-account-btn" onClick={logout} type="button">
          Logout
        </button>
        <button className="secondary-btn profile-danger-btn" disabled type="button">
          Delete Account
        </button>
      </div>
    );
  }, [activeTab, form, memoryForm, newTagLabel, newTagName, saving, sectionEdit, setPrivateMode, user?.email, logout]);

  if (!form || !memoryForm) return <div className="screen-center">Loading profile...</div>;

  return (
    <div className="page-stack profile-page-stack">
      <div className="profile-hero-card">
        <div className="profile-hero-avatar-wrap">
          <div className="profile-hero-avatar">
            {form.avatarDataUri ? <img alt="Avatar" src={form.avatarDataUri} /> : <span>{(form.name || "U").charAt(0).toUpperCase()}</span>}
          </div>
        <div className="profile-hero-avatar-badge">
          <i aria-hidden="true" className="bi bi-camera" />
        </div>
        </div>
        <div className="profile-hero-hint">Avatar limit: 120 KB (Firestore-safe). Tap avatar to upload.</div>
        <div className="profile-hero-name">{form.name || "You"}</div>
        <div className="profile-hero-email">{user?.email || "No email linked"}</div>
      </div>

      <div className="profile-tab-strip">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`profile-tab-btn${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saveNotice ? <div className="profile-save-banner">{saveNotice}</div> : null}

      {sectionContent}
    </div>
  );
}

function SectionHeader({ title, subtitle, editable, onToggle }) {
  return (
    <div className="profile-panel-header">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button
        aria-label={editable ? "Finish editing section" : "Edit section"}
        className={`profile-edit-btn${editable ? " active" : ""}`}
        onClick={onToggle}
        type="button"
      >
        <i aria-hidden="true" className={`bi ${editable ? "bi-check2" : "bi-pencil-square"}`} />
      </button>
    </div>
  );
}

function FieldBlock({ label, hint, children }) {
  return (
    <div className="field-block">
      <label>{label}</label>
      {hint ? <div className="field-hint">{hint}</div> : null}
      {children}
    </div>
  );
}

function SaveButton({ label, onClick, disabled }) {
  return (
    <button className="primary-btn profile-save-btn" disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  );
}
