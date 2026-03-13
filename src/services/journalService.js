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

const STORAGE_KEY = "happy_state_journal_v2";

function keyFor(mode) {
  return `${STORAGE_KEY}_${normalizeCharacterMode(mode)}`;
}

function journalRef(userDocId, mode) {
  return doc(
    db,
    DB_SCHEMA.users,
    userDocId,
    getCharacterCollection(mode),
    DB_SCHEMA.appData,
  );
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSession(session) {
  return {
    id: session.id || createId("session"),
    title: session.title || "New reflection",
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || new Date().toISOString(),
    messages: Array.isArray(session.messages) ? session.messages : [],
    entries: Array.isArray(session.entries) ? session.entries : [],
  };
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getJournalSessions(modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const local = sortSessions((readJson(keyFor(mode), []) || []).map(normalizeSession));
  const userDocId = getUserDocId(auth.currentUser || {});
  if (!userDocId) return local;
  try {
    const snap = await getDoc(journalRef(userDocId, mode));
    const remote = Array.isArray(snap.data()?.journalSessions?.sessions)
      ? sortSessions(snap.data().journalSessions.sessions.map(normalizeSession))
      : local;
    writeJson(keyFor(mode), remote);
    return remote;
  } catch {
    return local;
  }
}

export async function saveJournalSessions(sessions, modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const next = sortSessions(sessions.map(normalizeSession));
  writeJson(keyFor(mode), next);
  const userDocId = getUserDocId(auth.currentUser || {});
  if (userDocId) {
    try {
      await setDoc(
        journalRef(userDocId, mode),
        { journalSessions: { sessions: next, updatedAt: new Date().toISOString() } },
        { merge: true },
      );
    } catch {}
  }
  return next;
}

export async function createJournalSession(title = "New reflection", modeOverride = null) {
  const sessions = await getJournalSessions(modeOverride);
  const next = {
    id: createId("session"),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    entries: [],
  };
  return saveJournalSessions([next, ...sessions], modeOverride).then((all) => all[0]);
}

export async function deleteJournalSession(id, modeOverride = null) {
  const sessions = await getJournalSessions(modeOverride);
  return saveJournalSessions(sessions.filter((item) => item.id !== id), modeOverride);
}
