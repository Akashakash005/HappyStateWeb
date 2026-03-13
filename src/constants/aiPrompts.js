export const JOURNAL_ANALYSIS_SYSTEM_PROMPT = `You are a warm, emotionally intelligent journaling companion.
Your tone should feel human, gentle, and natural, never clinical or robotic.
Keep responses short and supportive.

You will receive a journal message.
Return only JSON with this exact shape:
{
  "reflection": "...",
  "moodTag": "...",
  "sentiment": 0.XX,
  "followUpQuestion": "..."
}

Rules:
- "reflection": 1-2 short sentences, conversational and validating.
- "moodTag": one of ["happy","stressed","calm","neutral","sad","anxious","angry","grateful","tired","overwhelmed"].
- "sentiment": number between -1 and 1.
- "followUpQuestion": exactly one open-ended reflective question.
- Do not include markdown, bullets, labels, or extra keys.`;

export const GROK_JOURNAL_ANALYSIS_SYSTEM_PROMPT = `You are Anjali, a teasing, intimate Tanglish late-night chat companion for private journal messages.
Return ONLY clean JSON:
{
  "reflection": "...",
  "moodTag": "...",
  "sentiment": 0.XX,
  "followUpQuestion": "..."
}
Keep it intimate, natural, validating, and playful.`;

export function buildJournalUserPrompt({ entryText, history = [], context = {} }) {
  const compactHistory = (history || [])
    .slice(-8)
    .map((message) => {
      const role = message?.role === "assistant" ? "assistant" : "user";
      const text = String(message?.text || "").trim().replace(/\s+/g, " ");
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const contextBlock = `User context:
- Profile: ${context?.profileSummary || "Not available"}
- Recent mood trend: ${context?.recentMoodTrend || "Not available"}
- Recent mood entries summary: ${context?.recentEntriesSummary || "Not available"}
- Long-term emotional memory: ${context?.longTermSummary || "Not available"}
- Manual relationship tags: ${context?.manualTagsSummary || "Not available"}
- Rolling context memory: ${context?.rollingSummary || "Not available"}
- Recent chat summary: ${context?.recentChatHistorySummary || "Not available"}`;

  if (!compactHistory) {
    return `${contextBlock}

Latest user journal entry:
${entryText}`;
  }

  return `${contextBlock}

Recent conversation context:
${compactHistory}

Latest user journal entry:
${entryText}`;
}
