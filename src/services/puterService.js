const DEFAULT_MODEL = "grok-4-fast";
const TOKEN_KEY = "happy_state_puter_auth_token";
const USER_KEY = "happy_state_puter_user";
const BACKEND_URL = String(
  import.meta.env.VITE_AI_BACKEND_URL || "https://happystate.vercel.app",
).trim();

function getBackendChatUrl() {
  return `${BACKEND_URL.replace(/\/$/, "")}/api/grok-chat`;
}

function getStoredToken() {
  return String(window.sessionStorage.getItem(TOKEN_KEY) || "").trim();
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

export async function chatWithPuter(prompt, options = {}) {
  const response = await fetch(getBackendChatUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ content: prompt }],
      model: options.model || DEFAULT_MODEL,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json();
  return String(payload?.text || "").trim();
}
