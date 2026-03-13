import { getJournalSessions } from "./journalService";
import { getActiveCharacterMode } from "./characterModeService";
import { readJson, writeJson } from "./storage";

const STORAGE_KEY = "happy_state_circle_v2";

function keyFor(mode) {
  return `${STORAGE_KEY}_${mode}`;
}

function extractNames(text) {
  const matches = String(text || "").match(/\b[A-Z][a-z]+\b/g) || [];
  const stop = new Set(["I", "Today", "Yesterday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  return [...new Set(matches.filter((word) => !stop.has(word)))];
}

export async function getCircleState(modeOverride = null) {
  const mode = modeOverride || getActiveCharacterMode();
  return readJson(keyFor(mode), {
    people: [],
    positiveEnergy: [],
    stressCorrelated: [],
    topTeasing: [],
    peakTriggers: [],
    mostFrequent: [],
    risingRecently: [],
    extractionMeta: null,
  });
}

export async function refreshCircleState(modeOverride = null) {
  const mode = modeOverride || getActiveCharacterMode();
  const sessions = await getJournalSessions(mode);
  const entries = sessions.flatMap((session) => session.entries || []);
  const map = {};

  entries.forEach((entry) => {
    extractNames(entry.text).forEach((name) => {
      if (!map[name]) {
        map[name] = {
          key: name.toLowerCase(),
          person: name,
          mentionCount: 0,
          avgMood: 0,
          avgLevel: 0,
          lastMentionDate: entry.date,
        };
      }
      const score = Number(entry.sentimentScore || 0);
      map[name].mentionCount += 1;
      map[name].avgMood += score;
      map[name].avgLevel += (score + 1) * 2.5;
      map[name].lastMentionDate = entry.date;
    });
  });

  const people = Object.values(map)
    .map((person) => ({
      ...person,
      avgMood: Number((person.avgMood / person.mentionCount).toFixed(2)),
      avgLevel: Number((person.avgLevel / person.mentionCount).toFixed(2)),
    }))
    .filter((person) => person.mentionCount >= 2)
    .sort((a, b) => b.mentionCount - a.mentionCount);

  const next = {
    people,
    positiveEnergy: mode === "private" ? [] : people.filter((item) => item.avgMood >= 0.2).map((item) => item.person),
    stressCorrelated: mode === "private" ? [] : people.filter((item) => item.avgMood <= -0.2).map((item) => item.person),
    topTeasing: mode === "private" ? people.slice(0, 3).map((item) => item.person) : [],
    peakTriggers: mode === "private" ? people.slice(0, 3).map((item) => item.person) : [],
    mostFrequent: mode === "private" ? people.slice(0, 3).map((item) => item.person) : [],
    risingRecently: mode === "private" ? people.slice(0, 3).map((item) => item.person) : [],
    extractionMeta: { totalEntries: entries.length },
  };
  writeJson(keyFor(mode), next);
  return next;
}
