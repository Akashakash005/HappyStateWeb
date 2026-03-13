import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getActiveCharacterMode } from "./characterModeService";
import {
  DB_SCHEMA,
  getCharacterCollection,
  getUserDocId,
  normalizeCharacterMode,
} from "../constants/dataSchema";
import { readJson, writeJson } from "./storage";

const LONG_TERM_KEY = "happy_state_memory_long_term_v1";
const ROLLING_KEY = "happy_state_memory_rolling_v1";
const LONG_TERM_EDITABLE_FIELDS = [
  "profileSummary",
  "emotionalBaselineSummary",
  "personalityPattern",
  "stressBaseline",
  "emotionalTriggers",
  "supportPatterns",
  "recurringThemes",
  "relationshipPatterns",
  "manualTags",
];

const DEFAULT_LONG_TERM_SUMMARY = {
  profileSummary: "",
  emotionalBaselineSummary: "",
  personalityPattern: "",
  stressBaseline: "",
  emotionalTriggers: [],
  supportPatterns: [],
  recurringThemes: [],
  relationshipPatterns: [],
  manualTags: [],
  userOverrides: {},
  lastCompressedAt: null,
  lastProcessedJournalEntryCount: 0,
  lastProcessedMoodEntryCount: 0,
  updatedAt: null,
};

const DEFAULT_ROLLING_CONTEXT = {
  recentMoodTrend7d: "",
  recentEntriesSummary: "",
  sessionSummary: "",
  activeFocus: "",
  updatedAt: null,
};

function getLongTermStorageKey(mode = "public") {
  return `${LONG_TERM_KEY}_${normalizeCharacterMode(mode)}`;
}

function getRollingStorageKey(mode = "public") {
  return `${ROLLING_KEY}_${normalizeCharacterMode(mode)}`;
}

function memoryRef(userDocId, mode = "public") {
  return doc(
    db,
    DB_SCHEMA.users,
    userDocId,
    getCharacterCollection(mode),
    DB_SCHEMA.memory,
  );
}

function normalizeStringList(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit);
}

function normalizeManualTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      label: String(item?.label || "").trim(),
      name: String(item?.name || "").trim(),
    }))
    .filter((item) => item.label && item.name)
    .slice(0, 30);
}

function normalizeLongTermSummary(data = {}) {
  const journalCount = Number(data?.lastProcessedJournalEntryCount);
  const moodCount = Number(data?.lastProcessedMoodEntryCount);
  return {
    ...DEFAULT_LONG_TERM_SUMMARY,
    ...(data || {}),
    profileSummary: String(data?.profileSummary || "").trim(),
    emotionalBaselineSummary: String(data?.emotionalBaselineSummary || "").trim(),
    personalityPattern: String(data?.personalityPattern || "").trim(),
    stressBaseline: String(data?.stressBaseline || "").trim(),
    emotionalTriggers: normalizeStringList(data?.emotionalTriggers),
    supportPatterns: normalizeStringList(data?.supportPatterns),
    recurringThemes: normalizeStringList(data?.recurringThemes),
    relationshipPatterns: normalizeStringList(data?.relationshipPatterns),
    manualTags: normalizeManualTags(data?.manualTags),
    userOverrides:
      data?.userOverrides && typeof data.userOverrides === "object" && !Array.isArray(data.userOverrides)
        ? data.userOverrides
        : {},
    lastCompressedAt: data?.lastCompressedAt || null,
    lastProcessedJournalEntryCount: Number.isNaN(journalCount) ? 0 : Math.max(0, journalCount),
    lastProcessedMoodEntryCount: Number.isNaN(moodCount) ? 0 : Math.max(0, moodCount),
    updatedAt: data?.updatedAt || null,
  };
}

function normalizeRollingContext(data = {}) {
  return {
    ...DEFAULT_ROLLING_CONTEXT,
    ...(data || {}),
    recentMoodTrend7d: String(data?.recentMoodTrend7d || "").trim(),
    recentEntriesSummary: String(data?.recentEntriesSummary || "").trim(),
    sessionSummary: String(data?.sessionSummary || "").trim(),
    activeFocus: String(data?.activeFocus || "").trim(),
    updatedAt: data?.updatedAt || null,
  };
}

function toEditorShape(longTermSummary = {}) {
  const normalized = normalizeLongTermSummary(longTermSummary);
  return {
    profileSummary: normalized.profileSummary,
    emotionalBaselineSummary: normalized.emotionalBaselineSummary,
    personalityPattern: normalized.personalityPattern,
    stressBaseline: normalized.stressBaseline,
    emotionalTriggersText: normalized.emotionalTriggers.join(", "),
    supportPatternsText: normalized.supportPatterns.join(", "),
    recurringThemesText: normalized.recurringThemes.join(", "),
    relationshipPatternsText: normalized.relationshipPatterns.join(", "),
    manualTags: normalized.manualTags,
    updatedAt: normalized.updatedAt,
  };
}

function fromEditorShape(editor = {}) {
  return normalizeLongTermSummary({
    profileSummary: editor.profileSummary,
    emotionalBaselineSummary: editor.emotionalBaselineSummary,
    personalityPattern: editor.personalityPattern,
    stressBaseline: editor.stressBaseline,
    emotionalTriggers: String(editor.emotionalTriggersText || "").split(",").map((item) => item.trim()).filter(Boolean),
    supportPatterns: String(editor.supportPatternsText || "").split(",").map((item) => item.trim()).filter(Boolean),
    recurringThemes: String(editor.recurringThemesText || "").split(",").map((item) => item.trim()).filter(Boolean),
    relationshipPatterns: String(editor.relationshipPatternsText || "").split(",").map((item) => item.trim()).filter(Boolean),
    manualTags: editor.manualTags,
    updatedAt: new Date().toISOString(),
  });
}

export async function getMemoryContext(modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const localLongTerm = normalizeLongTermSummary(readJson(getLongTermStorageKey(mode), DEFAULT_LONG_TERM_SUMMARY));
  const localRolling = normalizeRollingContext(readJson(getRollingStorageKey(mode), DEFAULT_ROLLING_CONTEXT));
  const userDocId = getUserDocId(auth.currentUser || {});

  if (!userDocId) {
    return { longTermSummary: localLongTerm, rollingContext: localRolling };
  }

  try {
    const snap = await getDoc(memoryRef(userDocId, mode));
    const longTermSummary = snap.exists()
      ? normalizeLongTermSummary(snap.data()?.longTermSummary || {})
      : localLongTerm;
    const rollingContext = snap.exists()
      ? normalizeRollingContext(snap.data()?.rollingContext || {})
      : localRolling;

    writeJson(getLongTermStorageKey(mode), longTermSummary);
    writeJson(getRollingStorageKey(mode), rollingContext);
    return { longTermSummary, rollingContext };
  } catch {
    return { longTermSummary: localLongTerm, rollingContext: localRolling };
  }
}

export async function getJournalMemory(modeOverride = null) {
  const memory = await getMemoryContext(modeOverride);
  return toEditorShape(memory.longTermSummary);
}

export async function saveLongTermSummary(partialData = {}, modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const source = String(partialData?.__source || "manual");
  const cleanPartial = { ...(partialData || {}) };
  delete cleanPartial.__source;

  const current = (await getMemoryContext(mode)).longTermSummary;
  const normalizedCurrent = normalizeLongTermSummary(current || {});
  const nextOverrides = { ...(normalizedCurrent.userOverrides || {}) };

  if (source === "manual") {
    LONG_TERM_EDITABLE_FIELDS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(cleanPartial, key)) {
        nextOverrides[key] = true;
      }
    });
  }

  if (source === "ai") {
    LONG_TERM_EDITABLE_FIELDS.forEach((key) => {
      if (nextOverrides[key]) {
        cleanPartial[key] = normalizedCurrent[key];
      }
    });
  }

  const next = normalizeLongTermSummary({
    ...normalizedCurrent,
    ...cleanPartial,
    userOverrides: nextOverrides,
    updatedAt: new Date().toISOString(),
  });

  writeJson(getLongTermStorageKey(mode), next);

  const userDocId = getUserDocId(auth.currentUser || {});
  if (userDocId) {
    try {
      await setDoc(memoryRef(userDocId, mode), { longTermSummary: next }, { merge: true });
    } catch {}
  }

  return next;
}

export async function saveJournalMemory(editorState = {}, modeOverride = null) {
  const next = await saveLongTermSummary(fromEditorShape(editorState), modeOverride);
  return toEditorShape(next);
}
