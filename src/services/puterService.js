const DEFAULT_MODEL = "grok-4-fast";
const TOKEN_KEY = "happy_state_puter_auth_token";
const USER_KEY = "happy_state_puter_user";
const BACKEND_URL = String(
  import.meta.env.VITE_AI_BACKEND_URL || "https://happystate.vercel.app",
).trim();
const PUTER_SDK_URL = "https://js.puter.com/v2/";

let puterSdkPromise = null;

function getBackendChatUrl() {
  return `${BACKEND_URL.replace(/\/$/, "")}/api/grok-chat`;
}

function getPuterGlobal() {
  return window.puter || null;
}

function ensurePuterSdk() {
  const existing = getPuterGlobal();
  if (existing) return Promise.resolve(existing);
  if (puterSdkPromise) return puterSdkPromise;

  puterSdkPromise = new Promise((resolve, reject) => {
    const current = document.querySelector(`script[src="${PUTER_SDK_URL}"]`);
    if (current) {
      current.addEventListener("load", () => resolve(getPuterGlobal()));
      current.addEventListener("error", () => reject(new Error("Failed to load Puter SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.src = PUTER_SDK_URL;
    script.async = true;
    script.onload = () => resolve(getPuterGlobal());
    script.onerror = () => reject(new Error("Failed to load Puter SDK."));
    document.head.appendChild(script);
  }).then((puter) => {
    if (!puter?.ai?.chat) throw new Error("Puter SDK loaded, but AI chat is unavailable.");
    return puter;
  });

  return puterSdkPromise;
}

function getStoredToken() {
  return String(window.sessionStorage.getItem(TOKEN_KEY) || "").trim();
}

function clearStoredAuth() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

function setStoredAuth(token, user) {
  window.sessionStorage.setItem(TOKEN_KEY, String(token || "").trim());
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export async function signInToPuter() {
  if (getStoredToken()) return getStoredToken();
  const origin = window.location.origin;
  const popup = window.open("", "HappyStatePuterAuth", "width=520,height=760");
  if (!popup) throw new Error("Popup blocked. Allow popups and try again.");

  popup.document.write(`<!doctype html><html><body style="display:grid;place-items:center;background:#0b0b0d;color:#fff;font-family:Arial,sans-serif;">
  <div style="width:min(92vw,360px);background:#151519;border:1px solid #3a0f17;border-radius:18px;padding:24px;text-align:center">
  <h1 style="color:#ff2a52">Connect Puter</h1><p>Sign in and return to HappyState.</p>
  <button id="sign-in" style="border:0;border-radius:999px;background:#ff2a52;color:#fff;font-weight:700;padding:12px 18px;cursor:pointer">Sign in</button>
  <div id="status" style="margin-top:12px;color:#c98692"></div></div>
  <script src="https://js.puter.com/v2/"></script><script>
  const status = document.getElementById('status');
  document.getElementById('sign-in').addEventListener('click', async () => {
    try {
      status.textContent = 'Opening Puter sign-in...';
      const user = await puter.auth.signIn();
      const token = String(puter.authToken || '').trim();
      window.opener.postMessage({ type: 'happy-state-puter-auth', token, user }, ${JSON.stringify(origin)});
      window.close();
    } catch (error) {
      window.opener.postMessage({ type: 'happy-state-puter-auth-error', message: error?.message || 'Puter sign-in failed.' }, ${JSON.stringify(origin)});
    }
  });</script></body></html>`);
  popup.document.close();

  return new Promise((resolve, reject) => {
    function handleMessage(event) {
      if (event.origin !== origin) return;
      const data = event.data || {};
      if (data.type === "happy-state-puter-auth") {
        window.removeEventListener("message", handleMessage);
        setStoredAuth(data.token, data.user);
        resolve(data.token);
      }
      if (data.type === "happy-state-puter-auth-error") {
        window.removeEventListener("message", handleMessage);
        reject(new Error(data.message || "Puter sign-in failed."));
      }
    }
    window.addEventListener("message", handleMessage);
  });
}

async function chatWithPuterSdk(prompt, options = {}) {
  const puter = await ensurePuterSdk();
  const response = await puter.ai.chat(prompt, {
    model: options.model || DEFAULT_MODEL,
  });

  const text =
    typeof response === "string"
      ? response
      : response?.message?.content ||
        response?.text ||
        (Array.isArray(response?.message?.content)
          ? response.message.content.map((part) => part?.text || "").join("")
          : "");

  return String(text || "").trim();
}

export async function chatWithPuter(prompt, options = {}) {
  try {
    return await chatWithPuterSdk(prompt, options);
  } catch (sdkError) {
    const sdkMessage = String(sdkError?.message || "");
    const userAuthToken = getStoredToken();
    const response = await fetch(getBackendChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ content: prompt }],
        model: options.model || DEFAULT_MODEL,
        authToken: userAuthToken || undefined,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(errorText);
      } catch {
        payload = null;
      }

      if (response.status === 401 || response.status === 403) {
        clearStoredAuth();
      }

      if (payload?.hint || payload?.error) {
        throw new Error(`${payload?.hint || payload?.error}${sdkMessage ? ` SDK fallback: ${sdkMessage}` : ""}`);
      }
      throw new Error(errorText || sdkMessage || "Puter request failed.");
    }

    const payload = await response.json();
    const text = String(payload?.text || "").trim();
    if (!text) {
      throw new Error(sdkMessage || "Puter request returned an empty response.");
    }
    return text;
  }
}
