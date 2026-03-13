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

const PROFILE_KEY = "happy_state_profile_v2";

export const DEFAULT_PROFILE = {
  name: "You",
  email: "",
  age: "",
  profession: "",
  weight: "",
  height: "",
  gender: "Prefer not to say",
  about: "",
  stressLevel: "Medium",
  sleepAverage: "7",
  energyPattern: "Mixed",
  emotionalSensitivity: "Moderate",
  aiTone: "Gentle",
  suggestionDepth: "Detailed",
  defaultInsightRange: "Week",
  allowLongTermAnalysis: true,
  showProfessionalSupportSuggestions: true,
  privateJournalMode: false,
};

function keyFor(mode) {
  return `${PROFILE_KEY}_${normalizeCharacterMode(mode)}`;
}

function profileRef(userDocId, mode) {
  return doc(
    db,
    DB_SCHEMA.users,
    userDocId,
    getCharacterCollection(mode),
    DB_SCHEMA.appData,
  );
}

export async function getProfile(modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const local = { ...DEFAULT_PROFILE, ...(readJson(keyFor(mode), {}) || {}) };
  const userDocId = getUserDocId(auth.currentUser || {});
  if (!userDocId) return local;

  try {
    const snap = await getDoc(profileRef(userDocId, mode));
    const remote = snap.data()?.profile ? { ...DEFAULT_PROFILE, ...snap.data().profile } : local;
    writeJson(keyFor(mode), remote);
    return remote;
  } catch {
    return local;
  }
}

export async function saveProfile(profileData, modeOverride = null) {
  const mode = normalizeCharacterMode(modeOverride || getActiveCharacterMode());
  const next = {
    ...DEFAULT_PROFILE,
    ...profileData,
    updatedAt: new Date().toISOString(),
  };
  writeJson(keyFor(mode), next);
  const currentUser = auth.currentUser;
  const userDocId = getUserDocId(currentUser || {});
  if (userDocId) {
    try {
      await setDoc(profileRef(userDocId, mode), { profile: next }, { merge: true });
      await setDoc(
        doc(db, DB_SCHEMA.users, userDocId),
        {
          uid: currentUser.uid,
          email: currentUser.email || "",
          displayName: next.name || "",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch {}
  }
  return next;
}
