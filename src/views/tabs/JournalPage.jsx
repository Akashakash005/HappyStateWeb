import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoAddOutline,
  IoArrowUp,
  IoAttachOutline,
  IoClose,
  IoImageOutline,
  IoMenu,
  IoMicOutline,
  IoTrashOutline,
} from "react-icons/io5";
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
import {
  chatWithPuterAttachment,
  uploadFileToPuter,
} from "../../services/puterService";
import { formatLongDate } from "../../utils/date";

const SUPPORTED_PRIVATE_ATTACH_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const MAX_PRIVATE_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function canSendMessage(draft, loading, pendingAttachment) {
  return (!loading && Boolean(String(draft || "").trim())) || (!loading && Boolean(pendingAttachment));
}

function buildUserMessageText(text, attachment) {
  const normalizedText = String(text || "").trim();
  if (normalizedText) return normalizedText;
  if (attachment?.name) return `Sent attachment: ${attachment.name}`;
  return "Sent attachment";
}

function isImageAttachment(type = "") {
  return String(type || "").startsWith("image/");
}

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
  const [composerError, setComposerError] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const chatWindowRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getJournalSessions(mode).then(async (stored) => {
      if (stored.length) {
        setSessions(stored);
        setActiveSessionId(stored[0].id);
      } else {
        const first = await createJournalSession(
          isPrivateMode ? "Private after dark" : "Today reflection",
          mode,
        );
        setSessions([first]);
        setActiveSessionId(first.id);
      }
    });
  }, [isPrivateMode, mode]);

  useEffect(() => {
    const node = chatWindowRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [activeSessionId, loading, sessions]);

  useEffect(() => {
    if (isPrivateMode) return;
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  }, [isPrivateMode, pendingAttachment]);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ||
      sessions[0] ||
      null,
    [activeSessionId, sessions],
  );

  async function onConnectPuter() {
    setConnecting(true);
    try {
      await ensurePuterConnected();
      setPuterSigned(true);
      setComposerError("");
    } finally {
      setConnecting(false);
    }
  }

  function openAttachmentPicker() {
    if (!isPrivateMode || !puterSigned || loading) return;
    fileInputRef.current?.click();
  }

  function onAttachmentSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!SUPPORTED_PRIVATE_ATTACH_TYPES.has(file.type)) {
      setComposerError("Private mode currently supports image attachments only.");
      return;
    }

    if (file.size > MAX_PRIVATE_ATTACHMENT_SIZE) {
      setComposerError("Attachment must be 10MB or smaller.");
      return;
    }

    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    setComposerError("");
    setPendingAttachment({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: isImageAttachment(file.type) ? URL.createObjectURL(file) : "",
    });
  }

  function clearPendingAttachment() {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  }

  async function onSubmit() {
    const text = draft.trim();
    if ((!text && !pendingAttachment) || !activeSession || loading) return;

    const userMessageId = `msg_${Date.now()}_u_optimistic`;
    const optimisticUserMessage = {
      id: userMessageId,
      role: "user",
      text: buildUserMessageText(text, pendingAttachment),
      createdAt: new Date().toISOString(),
      attachment: pendingAttachment
        ? {
            name: pendingAttachment.name,
            type: pendingAttachment.type,
            size: pendingAttachment.size,
            previewUrl: pendingAttachment.previewUrl || "",
          }
        : null,
    };

    const nextSessions = sessions.map((session) => {
      if (session.id !== activeSession.id) return session;
      return {
        ...session,
        title:
          session.title === "New reflection" ||
          session.title === "Today reflection"
            ? buildUserMessageText(text, pendingAttachment).split(" ").slice(0, 6).join(" ")
            : session.title,
        updatedAt: new Date().toISOString(),
        messages: [...(session.messages || []), optimisticUserMessage],
      };
    });

    const attachmentToSend = pendingAttachment;
    setSessions(nextSessions);
    setDraft("");
    setPendingAttachment(null);
    setComposerError("");
    setLoading(true);

    try {
      if (attachmentToSend && isPrivateMode) {
        const uploaded = await uploadFileToPuter(attachmentToSend.file);
        const responseText = await chatWithPuterAttachment({
          prompt: text || "What do you see in this image?",
          puterPath: uploaded.path,
          model: "grok-4-fast",
        });

        const persistedSessions = nextSessions.map((session) => {
          if (session.id !== activeSession.id) return session;

          const assistantMessage = {
            id: `msg_${Date.now()}_a`,
            role: "assistant",
            text: responseText,
            createdAt: new Date().toISOString(),
          };
          const entry = {
            id: `entry_${Date.now()}`,
            text: buildUserMessageText(text, attachmentToSend),
            date: new Date().toISOString(),
            sentimentScore: 0,
            moodTag: "neutral",
          };

          return {
            ...session,
            updatedAt: new Date().toISOString(),
            messages: [
              ...(session.messages || []).map((message) =>
                message.id === userMessageId
                  ? {
                      ...message,
                      attachment: {
                        ...(message.attachment || {}),
                        puterPath: uploaded.path,
                      },
                    }
                  : message,
              ),
              assistantMessage,
            ],
            entries: [...(session.entries || []), entry],
          };
        });

        const saved = await saveJournalSessions(persistedSessions, mode);
        setSessions(saved);
        return;
      }

      const analysis = await analyzeJournalEntryWithContext(text, {
        history: activeSession.messages || [],
        journalMode: mode,
      });

      const persistedSessions = nextSessions.map((session) => {
        if (session.id !== activeSession.id) return session;

        const assistantMessage = {
          id: `msg_${Date.now()}_a`,
          role: "assistant",
          text: `${analysis.reflection}\n\n${analysis.followUpQuestion}`,
          createdAt: new Date().toISOString(),
        };
        const entry = {
          id: `entry_${Date.now()}`,
          text,
          date: new Date().toISOString(),
          sentimentScore: Number(analysis.sentiment || 0),
          moodTag: analysis.moodTag || "neutral",
        };

        return {
          ...session,
          updatedAt: new Date().toISOString(),
          messages: [...(session.messages || []), assistantMessage],
          entries: [...(session.entries || []), entry],
        };
      });

      const saved = await saveJournalSessions(persistedSessions, mode);
      setSessions(saved);
    } catch (error) {
      const assistantError = {
        id: `msg_${Date.now()}_a_error`,
        role: "assistant",
        text:
          error?.message ||
          "Journal reply failed. Check the provider connection and try again.",
        createdAt: new Date().toISOString(),
      };

      const errorSessions = nextSessions.map((session) => {
        if (session.id !== activeSession.id) return session;
        return {
          ...session,
          updatedAt: new Date().toISOString(),
          messages: [...(session.messages || []), assistantError],
        };
      });

      const saved = await saveJournalSessions(errorSessions, mode);
      setSessions(saved);
    } finally {
      setLoading(false);
    }
  }

  async function startNewChat() {
    const next = await createJournalSession(
      isPrivateMode ? "Private after dark" : "New reflection",
      mode,
    );
    const all = await getJournalSessions(mode);
    setSessions(all);
    setActiveSessionId(next.id);
    setHistoryOpen(false);
    setComposerError("");
    clearPendingAttachment();
  }

  async function removeSession(id) {
    const next = await deleteJournalSession(id, mode);
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
              disabled={connecting}
            >
              {connecting ? "Connecting..." : "Connect with Puter"}
            </button>
          </div>
        ) : null}

        <div className="chat-window journal-chat-window" ref={chatWindowRef}>
          {(activeSession?.messages || []).map((message) => (
            <div className={`bubble ${message.role}`} key={message.id}>
              {message.attachment ? (
                <div className="chat-attachment">
                  {isImageAttachment(message.attachment.type) && message.attachment.previewUrl ? (
                    <img
                      className="chat-attachment-image"
                      src={message.attachment.previewUrl}
                      alt={message.attachment.name || "Attachment"}
                    />
                  ) : (
                    <div className="chat-attachment-file">
                      <IoAttachOutline size={15} />
                      <span>{message.attachment.name || "Attachment"}</span>
                    </div>
                  )}
                  <div className="chat-attachment-name">
                    {message.attachment.name || "Attachment"}
                  </div>
                </div>
              ) : null}
              <div>{message.text}</div>
              <small>[{formatLongDate(message.createdAt)}]</small>
            </div>
          ))}
          {loading ? (
            <div className="bubble assistant">Assistant is typing...</div>
          ) : null}
        </div>

        {pendingAttachment ? (
          <div className="pending-attachment-bar">
            <div className="pending-attachment-meta">
              <IoImageOutline size={16} />
              <span>{pendingAttachment.name}</span>
            </div>
            <button
              className="icon-plain-btn pending-attachment-close"
              onClick={clearPendingAttachment}
              type="button"
              aria-label="Remove attachment"
            >
              <IoClose size={16} />
            </button>
          </div>
        ) : null}

        {composerError ? <div className="error-copy">{composerError}</div> : null}

        <div className="composer app-composer">
          <div className="composer-shell">
            <button
              className="composer-icon-btn composer-leading-btn"
              type="button"
              aria-label="Add attachment"
              onClick={openAttachmentPicker}
              disabled={!isPrivateMode || !puterSigned || loading}
              title={
                isPrivateMode
                  ? puterSigned
                    ? "Attach image"
                    : "Connect Puter to attach images"
                  : "Attachments are available only in private mode"
              }
            >
              <IoAddOutline size={18} />
            </button>
            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={onAttachmentSelected}
              tabIndex={-1}
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isPrivateMode ? "Drop the unfiltered truth" : "Ask anything"}
              disabled={loading}
            />
            <div className="composer-actions">
              <button
                className="composer-icon-btn"
                type="button"
                aria-label="Voice input"
                disabled
                title="Voice input is not wired yet"
              >
                <IoMicOutline size={16} />
              </button>
              <button
                className={`composer-send${canSendMessage(draft, loading, pendingAttachment) ? " ready" : ""}`}
                onClick={onSubmit}
                type="button"
                aria-label="Send message"
                disabled={!canSendMessage(draft, loading, pendingAttachment)}
              >
                <IoArrowUp size={18} />
              </button>
            </div>
          </div>
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
