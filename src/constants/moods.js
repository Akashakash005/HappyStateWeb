export const MOOD_OPTIONS = [
  { value: 1, label: "Very Low" },
  { value: 2, label: "Low" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

export const PRIVATE_MOOD_OPTIONS = [
  { value: 1, label: "Level 1" },
  { value: 2, label: "Level 2" },
  { value: 3, label: "Level 3" },
  { value: 4, label: "Level 4" },
  { value: 5, label: "Level 5" },
];

export function getMoodOptions(isPrivateMode = false) {
  return isPrivateMode ? PRIVATE_MOOD_OPTIONS : MOOD_OPTIONS;
}
