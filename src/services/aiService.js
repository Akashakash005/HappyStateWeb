import {
  compressYearToQuarterly,
  estimatePayloadTokens,
  getMoodDataByRange,
} from "../utils/moodRangeFilter";
import { getProfile } from "./profileService";
import { chatWithPuter } from "./puterService";

const GEMINI_API_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const PRIMARY_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash").trim();
const DAILY_LIMIT = 50;
const YEAR_TOKEN_THRESHOLD = 1200;
const USAGE_KEY = "happy_state_ai_usage";

function getDailyCounterKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `${USAGE_KEY}_${today}`;
}

function getUsageCount() {
  return Number(window.localStorage.getItem(getDailyCounterKey()) || 0);
}

function incrementUsageCount() {
  const next = getUsageCount() + 1;
  window.localStorage.setItem(getDailyCounterKey(), String(next));
  return next;
}

function compactUserProfile(profile = {}) {
  return {
    uid: profile.uid || "",
    displayName: (profile.displayName || "").slice(0, 50),
    ageGroup: profile.ageGroup || "",
    timezone: profile.timezone || "",
    personalDetails: profile.personalDetails || {},
    preferences: profile.preferences || {},
  };
}

function getToneInstruction(aiTone) {
  if (aiTone === "Direct") return "Be clear and concise, avoid emotional language.";
  if (aiTone === "Motivational") return "Be uplifting and action-oriented with encouraging language.";
  return "Respond softly and empathetically.";
}

function getDepthInstruction(suggestionDepth) {
  if (suggestionDepth === "Quick") {
    return { instruction: "Keep it brief and practical.", wordLimit: 120 };
  }
  return {
    instruction: "Provide slightly more context and explanation while staying concise.",
    wordLimit: 180,
  };
}

function buildRangeInstruction(selectedRange) {
  if (selectedRange === "day") return "Focus on short-term support for today.";
  if (selectedRange === "week") return "Analyze trend and pattern shifts across the week.";
  if (selectedRange === "month") return "Analyze behavioral patterns and emotional stability across the month.";
  return "Provide deep reflection and long-term advice based on yearly patterns.";
}

function buildPrompt({ selectedRange, emotionalSummary, userProfile, insightMode = "public" }) {
  const prefs = userProfile?.preferences || {};
  const toneInstruction = getToneInstruction(prefs.aiTone || "Gentle");
  const depth = getDepthInstruction(prefs.suggestionDepth || "Detailed");
  const privacyInstruction = prefs.allowLongTermAnalysis
    ? "Long-term analysis is allowed if helpful."
    : "Do not provide long-term analysis, keep recommendations within the selected range only.";
  const supportSuggestionInstruction = prefs.showProfessionalSupportSuggestions
    ? "If risk appears elevated, you may suggest seeking professional support in a gentle way."
    : "Do not include professional support suggestions.";
  const isPrivate = insightMode === "private";

  if (isPrivate) {
    return `
Nee oru private pattern-reading assistant da, user oda hidden side ku machi.
Direct aa, cool aa, non-judgmental aa iru da.
Moral pesadha. Shock aagadha. Clinical aa sound aagadha.
Focus on urges, intensity loops, rebound patterns, hidden triggers, self-control patterns full on.

${depth.instruction}
${privacyInstruction}
${buildRangeInstruction(selectedRange)}
Analyze the following private-character summary:
${JSON.stringify({ selectedRange, emotionalSummary, userProfile })}
Provide:
1. Current heat or intensity pattern
2. Trigger or loop to watch
3. One boundary or control adjustment
4. One confronting reflection
Keep under ${depth.wordLimit} words.
Write in short sections with these exact headings:

WHAT IM NOTICING:
WATCH FOR:
TRY THIS TOMORROW:
REFLECTION:
Under TRY THIS TOMORROW provide 2-3 concrete bullet points.
Pure tanglish bad boy vibe la hot aa pesu da. No technical shit.
    `.trim();
  }

  return `
You are a personal emotional wellness assistant.
${toneInstruction}
${depth.instruction}
Avoid clinical phrasing.
Write as a supportive personal companion.
${privacyInstruction}
${supportSuggestionInstruction}

${buildRangeInstruction(selectedRange)}

Analyze the following emotional summary:
${JSON.stringify({ selectedRange, emotionalSummary, userProfile })}

Provide:
1. Emotional trend insight
2. Risk signals
3. Habit improvement suggestion
4. One reflective question

Keep under 180 words.
Do not diagnose medical conditions.
Write in short sections with these exact headings:
WHAT IM NOTICING:
WATCH FOR:
TRY THIS TOMORROW:
REFLECTION:
Under TRY THIS TOMORROW provide 2-3 concrete bullet points.
Do not mention token, payload, or technical metrics.
Limit response to ${depth.wordLimit} words.
  `.trim();
}

async function callGeminiDirectly(prompt) {
  if (!GEMINI_API_KEY) throw new Error("Missing VITE_GEMINI_API_KEY for direct Gemini mode.");
  const modelCandidates = [PRIMARY_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"].filter(Boolean);
  let lastError = "Gemini request failed";

  for (let i = 0; i < modelCandidates.length; i += 1) {
    const model = modelCandidates[i];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      lastError = text || `Gemini request failed for ${model}`;
      const shouldTryNext = response.status === 404 || response.status === 429 || response.status >= 500;
      if (shouldTryNext && i < modelCandidates.length - 1) continue;
      throw new Error(lastError);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("\n").trim() || "";
  }

  throw new Error(lastError);
}

export async function generateInsight({ allEntries, selectedRange, userProfile = {}, insightMode = "public" }) {
  const usage = getUsageCount();
  if (usage >= DAILY_LIMIT) {
    const error = new Error("Daily AI insight limit reached (50/day).");
    error.code = "DAILY_LIMIT_REACHED";
    throw error;
  }

  const savedProfile = await getProfile();
  const preferredRange = String(savedProfile.defaultInsightRange || "Week").toLowerCase();
  const effectiveRange = selectedRange || preferredRange;
  let emotionalSummary = getMoodDataByRange(allEntries, effectiveRange);

  if (effectiveRange === "year") {
    const yearlyPayload = {
      userProfile: compactUserProfile(userProfile),
      emotionalSummary,
      selectedRange: effectiveRange,
    };
    const tokenEstimate = estimatePayloadTokens(yearlyPayload);
    if (tokenEstimate > YEAR_TOKEN_THRESHOLD) {
      emotionalSummary = compressYearToQuarterly(emotionalSummary);
    }
  }

  const compactProfile = compactUserProfile({
    ...userProfile,
    displayName: savedProfile.name || userProfile?.displayName || "",
    personalDetails: {
      name: savedProfile.name || "",
      age: savedProfile.age || "",
      profession: savedProfile.profession || "",
      weight: savedProfile.weight || "",
      height: savedProfile.height || "",
      gender: savedProfile.gender || "",
      about: savedProfile.about || "",
    },
    preferences: {
      stressLevel: savedProfile.stressLevel,
      sleepAverage: savedProfile.sleepAverage,
      energyPattern: savedProfile.energyPattern,
      emotionalSensitivity: savedProfile.emotionalSensitivity,
      aiTone: savedProfile.aiTone,
      suggestionDepth: savedProfile.suggestionDepth,
      defaultInsightRange: savedProfile.defaultInsightRange,
      allowLongTermAnalysis: savedProfile.allowLongTermAnalysis,
      showProfessionalSupportSuggestions: savedProfile.showProfessionalSupportSuggestions,
    },
  });

  const prompt = buildPrompt({
    selectedRange: effectiveRange,
    emotionalSummary,
    userProfile: compactProfile,
    insightMode,
  });

  const insight =
    insightMode === "private" ? await chatWithPuter(prompt, { model: "grok-4-fast" }) : await callGeminiDirectly(prompt);
  const newUsage = incrementUsageCount();

  return {
    insight,
    selectedRangeUsed: effectiveRange,
    emotionalSummary,
    limitRemaining: Math.max(0, DAILY_LIMIT - newUsage),
  };
}
