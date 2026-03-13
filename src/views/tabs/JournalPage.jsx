import { useEffect, useMemo, useState } from "react";
import { IoAddOutline, IoClose, IoMenu, IoTrashOutline } from "react-icons/io5";
import { useTheme } from "../../state/ThemeContext";
import {
  createJournalSession,
  deleteJournalSession,
  getJournalSessions,
  saveJournalSessions,
} from "../../services/journalService";
import {
  analyzeJournalEntryWithContext,
  ensurePuterConnected,
} from "../../services/journalAiService";
import { formatLongDate } from "../../utils/date";

export default function JournalPage() {
  const { isPrivateMode } = useTheme();
  const mode = isPrivateMode ? "private" : "public";
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [puterSigned, setPuterSigned] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    getJournalSessions().then(async (stored) => {
      if (stored.length) {
        setSessions(stored);
        setActiveSessionId(stored[0].id);
      } else {
        const first = await createJournalSession(
          isPrivateMode ? "Private after dark" : "Today reflection",
        );
        setSessions([first]);
        setActiveSessionId(first.id);
      }
    });
  }, [isPrivateMode]);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ||
      sessions[0],
    [activeSessionId, sessions],
  );

  async function onConnectPuter() {
    setConnecting(true);
    try {
      await ensurePuterConnected();
      setPuterSigned(true);
    } finally {
      setConnecting(false);
    }
  }

  async function onSubmit() {
    if (!draft.trim() || !activeSession) return;
    setLoading(true);
    try {
      const analysis = await analyzeJournalEntryWithContext(draft, {
        history: activeSession.messages || [],
        journalMode: mode,
      });
      const nextSessions = sessions.map((session) => {
        if (session.id !== activeSession.id) return session;
        const userMessage = {
          id: `msg_${Date.now()}_u`,
          role: "user",
          text: draft.trim(),
          createdAt: new Date().toISOString(),
        };
        const assistantMessage = {
          id: `msg_${Date.now()}_a`,
          role: "assistant",
          text: `${analysis.reflection}\n\n${analysis.followUpQuestion}`,
          createdAt: new Date().toISOString(),
        };
        const entry = {
          id: `entry_${Date.now()}`,
          text: draft.trim(),
          date: new Date().toISOString(),
          sentimentScore: Number(analysis.sentiment || 0),
          moodTag: analysis.moodTag || "neutral",
        };
        return {
          ...session,
          title:
            session.title === "New reflection" ||
            session.title === "Today reflection"
              ? draft.trim().split(" ").slice(0, 6).join(" ")
              : session.title,
          updatedAt: new Date().toISOString(),
          messages: [
            ...(session.messages || []),
            userMessage,
            assistantMessage,
          ],
          entries: [...(session.entries || []), entry],
        };
      });
      const saved = await saveJournalSessions(nextSessions);
      setSessions(saved);
      setDraft("");
    } finally {
      setLoading(false);
    }
  }

  async function startNewChat() {
    const next = await createJournalSession(
      isPrivateMode ? "Private after dark" : "New reflection",
    );
    const all = await getJournalSessions();
    setSessions(all);
    setActiveSessionId(next.id);
    setHistoryOpen(false);
  }

  async function removeSession(id) {
    const next = await deleteJournalSession(id);
    setSessions(next);
    setActiveSessionId(next[0]?.id || "");
    setHistoryOpen(false);
  }

  return (
    <div className="journal-layout">
      <section className="journal-page-card">
        <div className="journal-inner-header">
          <button
            className="menu-icon-btn"
            onClick={() => setHistoryOpen(true)}
            type="button"
            aria-label="Open history"
          >
            <IoMenu size={20} />
          </button>
          <div>
            <h2 className="journal-screen-title">
              {isPrivateMode ? "Private Journal" : "Journal"}
            </h2>
            <div className="journal-subtitle">
              {isPrivateMode ? "Grok via Puter" : "Gemini reflection"}
            </div>
          </div>
          <button className="new-chat-pill" onClick={startNewChat} type="button">
            New chat
          </button>
        </div>

        {isPrivateMode && !puterSigned ? (
          <div className="gate-card">
            <h3>Private Journal Locked</h3>
            <p>
              Sign in with Puter first. After that, this browser session can use
              Grok in private mode.
            </p>
            <button
              className="primary-btn"
              onClick={onConnectPuter}
              type="button"
            >
              {connecting ? "Connecting..." : "Connect with Puter"}
            </button>
          </div>
        ) : null}

        <div className="chat-window journal-chat-window">
          {(activeSession?.messages || []).map((message) => (
            <div className={`bubble ${message.role}`} key={message.id}>
              <div>{message.text}</div>
              <small>{formatLongDate(message.createdAt)}</small>
            </div>
          ))}
          {loading ? (
            <div className="bubble assistant">Assistant is typing...</div>
          ) : null}
        </div>

        <div className="composer app-composer">
          <button className="composer-plus" onClick={startNewChat} type="button">
            +
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isPrivateMode ? "Drop the unfiltered truth" : "Ask anything"}
          />
          <button className="composer-send" onClick={onSubmit} type="button">
            ↑
          </button>
        </div>
      </section>

      {historyOpen ? (
        <div className="drawer-shell">
          <div className="drawer-panel">
            <div className="entry-row">
              <h2 className="drawer-title">Your chats</h2>
              <button
                className="icon-plain-btn"
                onClick={() => setHistoryOpen(false)}
                type="button"
                aria-label="Close history"
              >
                <IoClose size={20} />
              </button>
            </div>
            <button className="drawer-action-btn" onClick={startNewChat} type="button">
              <IoAddOutline size={16} />
              <span>New chat</span>
            </button>
            <div className="session-list">
              {sessions.map((session) => (
                <div
                  className={`session-item${session.id === activeSessionId ? " active" : ""}`}
                  key={session.id}
                >
                  <button
                    className="session-select-btn"
                    onClick={() => {
                      setActiveSessionId(session.id);
                      setHistoryOpen(false);
                    }}
                    type="button"
                  >
                    <div className="session-btn-title">{session.title}</div>
                    <small>{formatLongDate(session.updatedAt)}</small>
                  </button>
                  <button
                    className="session-delete-btn"
                    onClick={() => removeSession(session.id)}
                    type="button"
                    aria-label="Delete chat"
                  >
                    <IoTrashOutline size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            className="drawer-backdrop"
            onClick={() => setHistoryOpen(false)}
            type="button"
            aria-label="Close drawer"
          />
        </div>
      ) : null}
    </div>
  );
}
