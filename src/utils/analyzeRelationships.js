/**
 * Analyzes journal entries to determine relationship structures.
 * ONLY respects explicit structured interactions.
 *
 * @param {Array} entries - List of journal entry objects
 * @returns {Object} Relationship statistics by person
 */
export function analyzeRelationships(entries) {
  const stats = {};

  // 1. Tally Mentions and Emotions
  entries.forEach((entry) => {
    if (!entry.interactions || !Array.isArray(entry.interactions)) return;

    entry.interactions.forEach((interaction) => {
      const { person, emotion } = interaction;
      if (!person) return;

      if (!stats[person]) {
        stats[person] = {
          mentions: 0,
          positiveCount: 0,
          neutralCount: 0,
          pressureCount: 0,
        };
      }

      stats[person].mentions += 1;

      if (emotion === "positive") stats[person].positiveCount += 1;
      else if (emotion === "neutral") stats[person].neutralCount += 1;
      else if (emotion === "pressure") stats[person].pressureCount += 1;
    });
  });

  // 2. Compute Ratios and Classify Relationship Type
  const people = Object.keys(stats).map((name) => {
    const data = stats[name];
    const { mentions, positiveCount, neutralCount, pressureCount } = data;

    // Signals ignore neutral interactions
    const signalCount = positiveCount + pressureCount;
    const pressureRatio = signalCount ? pressureCount / signalCount : 0;
    const positiveRatio = signalCount ? positiveCount / signalCount : 0;

    const relationshipType = getRelationshipType({ pressureCount, positiveCount });

    return {
      name,
      mentions,
      pressureCount,
      neutralCount,
      positiveCount,
      pressureRatio: parseFloat(pressureRatio.toFixed(2)),
      positiveRatio: parseFloat(positiveRatio.toFixed(2)),
      relationshipType,
    };
  });

  return { people };
}

function getRelationshipType(p) {
  const signalCount = p.pressureCount + p.positiveCount;

  // if only neutral interactions → no conclusion
  if (signalCount === 0) return "neutral";

  const pressureRatio = p.pressureCount / signalCount;
  const positiveRatio = p.positiveCount / signalCount;

  if (pressureRatio >= 0.6) return "pressure";
  if (positiveRatio >= 0.6) return "positive";

  return "mixed";
}
