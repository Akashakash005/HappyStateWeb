const MODE_KEY = "happy_state_character_mode";

export function getActiveCharacterMode() {
  return window.localStorage.getItem(MODE_KEY) === "private" ? "private" : "public";
}

export function setActiveCharacterMode(mode) {
  const next = mode === "private" ? "private" : "public";
  window.localStorage.setItem(MODE_KEY, next);
  return next;
}
