export const DB_SCHEMA = {
  users: "users",
  characters: {
    public: "publicCharacter",
    private: "privateCharacter",
  },
  appData: "appData",
  memory: "memory",
};

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeCharacterMode(mode) {
  return mode === "private" ? "private" : "public";
}

export function getUserDocId(user = {}) {
  return normalizeEmail(user.email) || String(user.uid || "").trim();
}

export function getCharacterCollection(mode = "public") {
  return DB_SCHEMA.characters[normalizeCharacterMode(mode)];
}
