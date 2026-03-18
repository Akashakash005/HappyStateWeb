function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalKey(name) {
  return normalizeName(name).toLowerCase();
}

function toMoodScore(value) {
  const num = Number(value);
  if (!Number.isNaN(num)) {
    if (num >= -1 && num <= 1) return num;
    if (num >= 1 && num <= 5) return Number(((num - 3) / 2).toFixed(2));
  }
  return 0;
}

function toLevelScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 1;
  if (num >= 1 && num <= 5) return num;
  if (num >= -1 && num <= 1) return Number((num * 2 + 3).toFixed(2));
  return 1;
}

function toMentionDate(entry) {
  return (
    entry?.dateISO ||
    entry?.actualLoggedAt ||
    entry?.date ||
    new Date().toISOString()
  );
}

function getRelationshipType({ pressureCount, positiveCount }) {
  const signalCount = pressureCount + positiveCount;

  if (signalCount === 0) return "neutral";

  const pressureRatio = pressureCount / signalCount;
  const positiveRatio = positiveCount / signalCount;

  if (pressureRatio >= 0.6) return "pressure";
  if (positiveRatio >= 0.6) return "positive";

  return "mixed";
}

function buildSegments(people) {
  return {
    people,
    positiveEnergy: people
      .filter((person) => person.positiveRatio >= 0.5)
      .sort((a, b) => b.positiveRatio - a.positiveRatio),
    stressCorrelated: people
      .filter((person) => person.pressureRatio >= 0.5)
      .sort((a, b) => b.pressureRatio - a.pressureRatio),
    mostFrequent: [...people].sort((a, b) => b.mentionCount - a.mentionCount),
    risingRecently: [...people].sort(
      (a, b) => new Date(b.lastMentionDate) - new Date(a.lastMentionDate),
    ),
  };
}

export async function buildCircle(entries, options = {}) {
  const journalMode = options.journalMode === "private" ? "private" : "public";
  const map = new Map();
  const extractionMeta = {
    provider: "interactions",
    totalEntries: 0,
    entriesWithNoNames: 0,
    fallbackCount: 0,
    providerFailed: false,
    puterNotConnected: false,
    lastMessage: "",
  };

  for (const entry of entries || []) {
    extractionMeta.totalEntries += 1;
    const interactions = Array.isArray(entry?.interactions)
      ? entry.interactions
      : [];
    let hasAnyName = false;

    for (const interaction of interactions) {
      const person = normalizeName(interaction?.person);
      if (!person) continue;
      hasAnyName = true;

      const key = canonicalKey(person);
      if (!key) continue;

      const normalizedEmotion = String(interaction?.emotion || "")
        .trim()
        .toLowerCase();
      const emotion = ["positive", "neutral", "pressure"].includes(
        normalizedEmotion,
      )
        ? normalizedEmotion
        : "neutral";
      const mentionDate = toMentionDate(entry);

      const current = map.get(key) || {
        key,
        person,
        mentionCount: 0,
        pressureCount: 0,
        neutralCount: 0,
        positiveCount: 0,
        moodSamples: [],
        levelSamples: [],
        aliases: [],
        lastMentionDate: mentionDate,
      };

      current.mentionCount += 1;
      current.moodSamples.push(toMoodScore(entry?.mood ?? entry?.score));
      current.levelSamples.push(toLevelScore(entry?.mood ?? entry?.score));

      if (emotion === "pressure") current.pressureCount += 1;
      else if (emotion === "positive") current.positiveCount += 1;
      else current.neutralCount += 1;

      if (!current.aliases.includes(person)) current.aliases.push(person);
      if (new Date(mentionDate) > new Date(current.lastMentionDate)) {
        current.lastMentionDate = mentionDate;
      }

      map.set(key, current);
    }

    if (!hasAnyName) extractionMeta.entriesWithNoNames += 1;
  }

  const people = [...map.values()]
    .filter((item) => item.mentionCount >= 1)
    .map((item) => {
      const avgMood = item.moodSamples.length
        ? Number(
            (
              item.moodSamples.reduce((sum, value) => sum + value, 0) /
              item.moodSamples.length
            ).toFixed(2),
          )
        : 0;
      const avgLevel = item.levelSamples.length
        ? Number(
            (
              item.levelSamples.reduce((sum, value) => sum + value, 0) /
              item.levelSamples.length
            ).toFixed(2),
          )
        : 1;
      const peakLevel = item.levelSamples.length
        ? Number(Math.max(...item.levelSamples).toFixed(2))
        : 1;
      const highIntensityCount = item.levelSamples.filter(
        (value) => value >= 4,
      ).length;
      const recentLevels = item.levelSamples.slice(-3);
      const recentHeat = recentLevels.length
        ? Number(
            (
              recentLevels.reduce((sum, value) => sum + value, 0) /
              recentLevels.length
            ).toFixed(2),
          )
        : avgLevel;
      const signalCount = item.pressureCount + item.positiveCount;

      const interactionScore =
        item.positiveCount * 1 +
        item.neutralCount * 0 +
        item.pressureCount * -1;

      const maxPossible = item.mentionCount || 0;
      const interactionIntensity = maxPossible
        ? Number(((interactionScore / maxPossible) * 100).toFixed(1))
        : 0;

      const pressureRatio = signalCount
        ? Number((item.pressureCount / signalCount).toFixed(2))
        : 0;

      const positiveRatio = signalCount
        ? Number((item.positiveCount / signalCount).toFixed(2))
        : 0;
      return {
        key: item.key,
        person: item.person,
        mentionCount: item.mentionCount,

        // ✅ ADD THESE HERE (INSIDE MAP)
        pressureCount: item.pressureCount,
        positiveCount: item.positiveCount,
        neutralCount: item.neutralCount,

        avgMood,
        avgLevel,
        peakLevel,
        highIntensityCount,
        recentHeat,
        pressureRatio,
        positiveRatio,
        interactionScore,
        interactionIntensity,

        moodCorrelation: getRelationshipType({
          pressureCount: item.pressureCount,
          positiveCount: item.positiveCount,
        }),

        confidence: Math.min(1, Number((item.mentionCount / 5).toFixed(2))),
        aliases: item.aliases,
        lastMentionDate: item.lastMentionDate,
      };
    })
    .sort(
      (a, b) =>
        b.mentionCount - a.mentionCount || b.positiveRatio - a.positiveRatio,
    );

  if (journalMode === "private") {
    const byAvgLevel = [...people].sort(
      (a, b) => b.avgLevel - a.avgLevel || b.mentionCount - a.mentionCount,
    );
    const byPeakLevel = [...people].sort(
      (a, b) =>
        b.peakLevel - a.peakLevel ||
        b.highIntensityCount - a.highIntensityCount,
    );
    const byMentionCount = [...people].sort(
      (a, b) => b.mentionCount - a.mentionCount || b.avgLevel - a.avgLevel,
    );
    const byRecentHeat = [...people].sort(
      (a, b) => b.recentHeat - a.recentHeat || b.avgLevel - a.avgLevel,
    );

    return {
      ...buildSegments(people),
      topTeasing: byAvgLevel.slice(0, 3),
      peakTriggers: byPeakLevel.slice(0, 3),
      mostFrequent: byMentionCount.slice(0, 3),
      risingRecently: byRecentHeat.slice(0, 3),
      extractionMeta,
    };
  }

  return { ...buildSegments(people), extractionMeta };
}
