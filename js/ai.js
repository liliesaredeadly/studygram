// A personal connection belongs to one account in one browser tab. It never
// enters the account's synced learning data or a model prompt.
const StudygramMetaConnection = (() => {
  const storageKey = "sg_meta_connection_v1";
  let revision = 0;
  let disconnected = false;
  const account = () => typeof StudygramPrivateSession === "undefined" ? null : StudygramPrivateSession.user()?.id ?? null;
  const validKey = value => typeof value === "string" && /^[\x21-\x7e]{1,2048}$/.test(value);
  const problem = (message, code = "META_CONNECTION_REQUIRED") => Object.assign(new Error(message), { code });

  async function ready() {
    if (typeof StudygramPrivateSession !== "undefined") await StudygramPrivateSession.ready;
  }

  function disconnect() {
    revision += 1;
    disconnected = true;
    try { window.sessionStorage.removeItem(storageKey); } catch { /* Reads also fail closed. */ }
  }

  function read() {
    if (disconnected) return null;
    try {
      const record = JSON.parse(window.sessionStorage.getItem(storageKey));
      if (!record) return null;
      if (!account() || record.accountId !== account() || !validKey(record.apiKey) || record.adult !== true) {
        disconnect();
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  function current() {
    const record = read();
    return record ? { connected: true, model: record.model } : { connected: false };
  }

  async function exchange(method, headers = {}, body) {
    let response;
    try {
      response = await fetch("/api/meta-connection", {
        method, headers: { "Content-Type": "application/json", ...headers },
        credentials: "same-origin", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(15000),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw problem(error.name === "TimeoutError" || error.name === "AbortError"
        ? "The connection check took too long. Try again."
        : "Couldn’t check your Meta connection. Check your internet connection and try again.", "META_CONNECTION_NETWORK");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw problem(result?.error || "Couldn’t check your Meta connection. Try again.", result?.code || "META_CONNECTION_FAILED");
    }
    return result;
  }

  async function connect(value, adult) {
    await ready();
    const accountId = account();
    if (!accountId) throw problem("Sign in to Studygram before connecting your Meta API key.", "META_SIGN_IN_REQUIRED");
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (!validKey(apiKey)) throw problem("Paste a valid Meta API key with no spaces (up to 2048 characters).", "META_KEY_INVALID");
    if (!adult) throw problem("Confirm you are 18 or older to connect Meta AI.", "META_ADULT_REQUIRED");
    const attempt = ++revision;
    const result = await exchange("POST", { "X-Studygram-Meta-Key": apiKey, "X-Studygram-Meta-Adult": "1" }, { accountId });
    if (attempt !== revision || accountId !== account()) {
      throw problem("Your connection or account changed. Connect your key again.", "META_CONNECTION_CHANGED");
    }
    if (result.connected !== true || typeof result.model !== "string" || !result.model) {
      throw problem("The connection check returned an incomplete reply. Try again.", "META_CONNECTION_FAILED");
    }
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ accountId, apiKey, adult: true, model: result.model }));
      disconnected = false;
    } catch {
      throw problem("Your browser blocked session storage. Allow site storage to connect your key in this tab.", "META_STORAGE_BLOCKED");
    }
    return { connected: true, model: result.model };
  }

  async function headers() {
    await ready();
    const record = read();
    if (!record) throw problem("Connect your own Meta API key in Settings to use live AI.");
    return { "X-Studygram-Meta-Key": record.apiKey, "X-Studygram-Meta-Adult": "1" };
  }

  function invalidate(apiKey) {
    if (read()?.apiKey === apiKey) disconnect();
  }

  return Object.freeze({ current, connect, disconnect, headers, invalidate, configuration: () => exchange("GET") });
})();

async function requestStudygramAI(endpoint, input) {
  if (window.location.protocol === "file:") {
    throw new Error("Open Studygram through its local server to use live AI.");
  }
  const usesMeta = ["study-set", "lily", "diary", "diary-draft", "explore", "growth", "pursuit"].includes(endpoint);
  const credentials = usesMeta ? await StudygramMetaConnection.headers() : {};
  const account = usesMeta && typeof StudygramPrivateSession !== "undefined"
    ? { accountId: StudygramPrivateSession.user()?.id ?? null } : {};
  let response;
  let result;
  try {
    response = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...credentials },
      body: JSON.stringify({ ...input, ...account }),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(55000),
    });
    result = await response.json().catch(error => {
      if (error.name === "TimeoutError" || error.name === "AbortError") throw error;
      return null;
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("The AI took too long. Try sending your request again.");
    }
    throw new Error("Studygram couldn’t reach the AI. Try again.");
  }
  if (!response.ok || !result) {
    if (result?.code === "META_KEY_REJECTED") StudygramMetaConnection.invalidate(credentials["X-Studygram-Meta-Key"]);
    throw Object.assign(new Error(result?.error || "Studygram couldn’t reach the AI. Try again."), { code: result?.code });
  }
  return result;
}

function generateStudySet({ name, sourceText = "", focus = "" }) {
  const account = typeof StudygramPrivateSession === "undefined" ? {} : {
    accountId: StudygramPrivateSession.user()?.id ?? null,
  };
  return requestStudygramAI("study-set", { name, sourceText, focus, ...account });
}

function getLilyReply(input) {
  return requestStudygramAI("lily", input);
}

function analyzeDiary(entry) {
  return requestStudygramAI("diary", { entry });
}

function draftDiary(entry) {
  return requestStudygramAI("diary-draft", { entry });
}

async function loadStudyContent(topic) {
  if (topic.content) return topic.content;
  const content = await generateStudySet(topic);
  topic.content = content;
  try {
    if (topic.id) {
      Storage.saveStudyContent(topic.id, content);
    } else {
      topic.id = Storage.saveStudySet(topic).id;
    }
  } catch {
    showToast("This study set is ready, but your browser couldn’t save it.", "warning");
  }
  return content;
}
