import {
  GROK_JOURNAL_ANALYSIS_SYSTEM_PROMPT,
  JOURNAL_ANALYSIS_SYSTEM_PROMPT,
  buildJournalUserPrompt,
} from "../constants/aiPrompts";
import { buildJournalContext } from "./journalContextService";
import { chatWithPuter, signInToPuter } from "./puterService";
import { getAiQuotaErrorDetails } from "../utils/aiErrorUtils";

const GEMINI_API_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash").trim();
let geminiQuotaCooldownUntil = 0;
let geminiQuotaMessage = "";
const ALLOWED_MOOD_TAGS = new Set([
  "happy",
  "stressed",
  "calm",
  "neutral",
  "sad",
  "anxious",
  "angry",
  "grateful",
  "tired",
  "overwhelmed",
]);

function normalizeSentiment(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(-1, Math.min(1, parsed));
}

function safeJsonParse(text) {
  if (!text) return null;
  const cleaned = String(text).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeMoodTag(tag) {
  const normalized = String(tag || "").trim().toLowerCase();
  if (!normalized) return "neutral";
  if (ALLOWED_MOOD_TAGS.has(normalized)) return normalized;
  if (normalized.includes("stress") || normalized.includes("anxious")) return "stressed";
  if (normalized.includes("calm") || normalized.includes("peace")) return "calm";
  if (normalized.includes("happy") || normalized.includes("joy")) return "happy";
  return "neutral";
}

function validateJournalAnalysisPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const reflection = typeof parsed.reflection === "string" ? parsed.reflection.trim() : "";
  if (!reflection) return null;
  return {
    reflection,
    moodTag: normalizeMoodTag(parsed.moodTag),
    sentiment: normalizeSentiment(parsed.sentiment),
    followUpQuestion: String(parsed.followUpQuestion || "").trim() || "What feels most important to explore next?",
  };
}

async function geminiChat({ systemPrompt, userPrompt, temperature = 0.3 }) {
  const now = Date.now();
  if (geminiQuotaCooldownUntil > now) {
    const error = new Error(
      geminiQuotaMessage || "The AI is temporarily busy and the request limit has been hit. Try again after some time.",
    );
    error.code = 429;
    error.status = "RESOURCE_EXHAUSTED";
    error.isQuotaError = true;
    throw error;
  }

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn strict JSON only.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature, responseMimeType: "application/json" },
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    const quotaDetails = getAiQuotaErrorDetails({ message: errorText, code: response.status });
    if (quotaDetails.isQuotaError) {
      geminiQuotaCooldownUntil = Date.now() + Math.max(15, quotaDetails.retrySeconds || 30) * 1000;
      geminiQuotaMessage = quotaDetails.message;
      const error = new Error(quotaDetails.message);
      error.code = 429;
      error.status = "RESOURCE_EXHAUSTED";
      error.isQuotaError = true;
      throw error;
    }
    throw new Error(errorText || "Gemini request failed.");
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n").trim() || "";
}

export function getGeminiQuotaState() {
  const now = Date.now();
  const active = geminiQuotaCooldownUntil > now;
  return {
    active,
    retrySeconds: active ? Math.max(1, Math.ceil((geminiQuotaCooldownUntil - now) / 1000)) : 0,
    message: active ? geminiQuotaMessage : "",
  };
}

function fallbackAnalysis(entryText) {
  const lower = String(entryText || "").toLowerCase();
  const negative = ["stressed", "anxious", "sad", "angry", "tired", "overwhelmed"];
  const positive = ["happy", "calm", "grateful", "relaxed", "good", "excited"];
  let score = 0;
  positive.forEach((w) => {
    if (lower.includes(w)) score += 0.2;
  });
  negative.forEach((w) => {
    if (lower.includes(w)) score -= 0.2;
  });
  const sentiment = Math.max(-1, Math.min(1, Number(score.toFixed(2))));
  let moodTag = "neutral";
  if (sentiment >= 0.35) moodTag = "happy";
  else if (sentiment <= -0.35) moodTag = "stressed";
  else if (sentiment > 0.1) moodTag = "calm";
  return {
    reflection: "Thanks for sharing. I can see meaningful emotional signals in what you wrote.",
    moodTag,
    sentiment,
    followUpQuestion: "What part of this moment feels most important to you right now?",
  };
}

export async function ensurePuterConnected() {
  return signInToPuter();
}

export async function analyzeJournalEntryWithContext(entryText, options = {}) {
  const history = Array.isArray(options.history) ? options.history : [];
  const journalMode = options.journalMode === "private" ? "private" : "public";
  try {
    const context = await buildJournalContext({ history });
    const systemPrompt = journalMode === "private" ? GROK_JOURNAL_ANALYSIS_SYSTEM_PROMPT : JOURNAL_ANALYSIS_SYSTEM_PROMPT;
    const userPrompt = buildJournalUserPrompt({ entryText, history, context });
    const content =
      journalMode === "private"
        ? await chatWithPuter(`${systemPrompt}\n\n${userPrompt}\n\nReturn strict JSON only.`, { model: "grok-4-fast" })
        : await geminiChat({ systemPrompt, userPrompt, temperature: 0.25 });
    const parsed = validateJournalAnalysisPayload(safeJsonParse(content));
    if (parsed) return parsed;
    if (journalMode === "private") throw new Error("Private journal returned an invalid Grok response.");
    return fallbackAnalysis(entryText);
  } catch (error) {
    if (journalMode === "private") throw error;
    return fallbackAnalysis(entryText);
  }
}
