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
import { toDateKey } from "../utils/date";

const STORAGE_KEY = "happy_state_entries_v2";
const SLOT_HOURS = { morning: 9, afternoon: 14, evening: 19, night: 23 };
const SLOT_ORDER = { morning: 1, afternoon: 2, evening: 3, night: 4 };

function keyFor(mode) {
  return `${STORAGE_KEY}_${normalizeCharacterMode(mode)}`;
}

function getSlotByHour(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function entriesRef(userDocId, mode) {
  return doc(
    db,
    DB_SCHEMA.users,
    userDocId,
    getCharacterCollection(mode),
    DB_SCHEMA.appData,
  );
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (SLOT_ORDER[b.slot] || 0) - (SLOT_ORDER[a.slot] || 0);
  });
}

function toISOFromDateSlot(date, slot) {
  const [y, m, d] = String(date).split("-").map(Number);
  const hour = SLOT_HOURS[slot] ?? 12;
  return new Date(y, (m || 1) - 1, d || 1, hour, 0, 0).toISOString();
}

function normalizeEntry(entry) {
  if (!entry) return null;
  const fallbackISO = entry.dateISO || entry.actualLoggedAt || new Date().toISOString();
  const fallbackDate = toDateKey(fallbackISO);
  const fallbackSlot = getSlotByHour(new Date(fallbackISO).getHours());
  const mood = Math.max(1, Math.min(5, Number(entry.mood || 3)));
  const date = entry.date || fallbackDate;
  const slot = entry.slot || fallbackSlot;
  const interactions = Array.isArray(entry.interactions)
    ? entry.interactions
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const person = String(item.person || "").trim();
          if (!person) return null;
          const normalizedEmotion = String(item.emotion || "").trim().toLowerCase();
          const emotion = ["positive", "neutral", "pressure"].includes(normalizedEmotion)
            ? normalizedEmotion
            : "neutral";
          const context = String(item.context || "").trim();
          return { person, context, emotion };
        })
        .filter(Boolean)
    : [];
  return {
    id: entry.id || `${date}_${slot}`,
    date,
    slot,
    mood,
    score: typeof entry.score === "number" ? entry.score : Number((((mood - 3) / 2)).toFixed(2)),
    note: String(entry.note || ""),
    interactions,
    dateISO: entry.dateISO || toISOFromDateSlot(date, slot),
    actualLoggedAt: entry.actualLoggedAt || entry.updatedAt || new Date().toISOString(),
    isBackfilled: typeof entry.isBackfilled === "boolean" ? entry.isBackfilled : date !== toDateKey(new Date()),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

export async function getEntries(modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const local = sortEntries((readJson(keyFor(mode), []) || []).map(normalizeEntry).filter(Boolean));
  const userDocId = getUserDocId(auth.currentUser || {});
  if (!userDocId) return local;
  try {
    const ref = entriesRef(userDocId, mode);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      if (local.length) {
        await setDoc(ref, { moodEntries: { entries: local, updatedAt: new Date().toISOString() } }, { merge: true });
      }
      return local;
    }

    const remote = Array.isArray(snap.data()?.moodEntries?.entries)
      ? sortEntries(snap.data().moodEntries.entries.map(normalizeEntry).filter(Boolean))
      : [];

    if (remote.length === 0 && local.length > 0) {
      await setDoc(
        ref,
        { moodEntries: { entries: local, updatedAt: new Date().toISOString() } },
        { merge: true },
      );
      return local;
    }

    if (local.length > remote.length) {
      await setDoc(
        ref,
        { moodEntries: { entries: local, updatedAt: new Date().toISOString() } },
        { merge: true },
      );
      return local;
    }

    writeJson(keyFor(mode), remote);
    return remote;
  } catch {
    return local;
  }
}

export async function saveEntries(entries, modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const next = sortEntries(entries.map(normalizeEntry).filter(Boolean));
  writeJson(keyFor(mode), next);
  const userDocId = getUserDocId(auth.currentUser || {});
  if (userDocId) {
    try {
      await setDoc(
        entriesRef(userDocId, mode),
        { moodEntries: { entries: next, updatedAt: new Date().toISOString() } },
        { merge: true },
      );
    } catch {}
  }
  return next;
}

export async function upsertEntry(payload, modeOverride = null) {
  const current = await getEntries(modeOverride);
  const next = normalizeEntry(payload);
  const index = current.findIndex((entry) => entry.id === next.id);
  if (index >= 0) current[index] = { ...current[index], ...next, updatedAt: new Date().toISOString() };
  else current.push(next);
  return saveEntries(current, modeOverride);
}

export async function deleteEntry(id, modeOverride = null) {
  const current = await getEntries(modeOverride);
  return saveEntries(current.filter((entry) => entry.id !== id), modeOverride);
}
