const StudygramPrivateSession = (() => {
  const statePath = "/api/community/private-state";
  const data = new Map();
  const pending = new Map();
  let saving = new Map();
  let worker;
  let saveTimer;
  let user = null;
  let unavailable = false;
  let leaving = false;
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("studygram-community") : null;
  const sessionSignal = "sg_session_changed";
  const page = window.location.pathname;
  const needsAccount = /^\/pages\/(?:study|lesson|quiz|diary|growth|pursuit|focus)\.html$/.test(page);

  async function request(path, method = "GET", body) {
    const response = await fetch(path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || "Studygram is temporarily unavailable."), { status: response.status });
    return result;
  }

  function hidePage() {
    document.documentElement.style.visibility = "hidden";
  }

  function signInURL() {
    const target = window.location.pathname + window.location.search + window.location.hash;
    return `/pages/login.html?return=${encodeURIComponent(target)}`;
  }

  function reload() {
    if (leaving) return;
    leaving = true;
    pending.clear();
    clearTimeout(saveTimer);
    data.clear();
    saving.clear();
    user = null;
    hidePage();
    window.location.reload();
  }

  function setData(result) {
    data.clear();
    for (const [key, record] of Object.entries(result.data)) data.set(key, record);
  }

  const ready = request(statePath).then(result => {
    if (leaving) return;
    user = result.user;
    setData(result);
  }).catch(() => { unavailable = true; }).then(() => {
    if (needsAccount && !user && !leaving) {
      leaving = true;
      window.location.replace(signInURL());
    } else if (needsAccount && !leaving) {
      document.body?.removeAttribute("inert");
      if (!document.body) document.addEventListener("DOMContentLoaded", () => document.body.removeAttribute("inert"), { once: true });
    }
  });

  function requireAccount() {
    if (leaving) return false;
    if (user) return true;
    window.location.assign(signInURL());
    return false;
  }

  function get(key) {
    if (!user) return null;
    if (pending.has(key)) return pending.get(key);
    if (saving.has(key)) return saving.get(key);
    return data.get(key)?.value ?? null;
  }

  async function write(changes) {
    const accountId = user?.id;
    if (!accountId || leaving) throw new Error("Sign in to save your work.");
    const input = Object.fromEntries(Array.from(changes, ([key, value]) => [key, { value, version: data.get(key)?.version ?? 0 }]));
    const { versions } = await request(statePath, "PATCH", { accountId, changes: input });
    if (user?.id !== accountId || leaving) throw new Error("Your Studygram account changed. Sign in again and retry.");
    for (const [key, value] of changes) data.set(key, { version: versions[key], value });
  }

  function flush() {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    if (!worker && pending.size) {
      worker = (async () => {
        while (pending.size) {
          saving = new Map(pending);
          pending.clear();
          await write(saving);
          saving.clear();
        }
      })().catch(error => {
        pending.clear();
        saving.clear();
        if (error.status === 401) reload();
        else if (!leaving) window.dispatchEvent(new CustomEvent("studygram:save-error", { detail: error.message }));
        throw error;
      }).finally(() => {
        worker = null;
        if (pending.size) queueMicrotask(() => { void flush().catch(() => {}); });
      });
    }
    return worker ?? Promise.resolve();
  }

  function set(key, value) {
    if (!user || leaving) throw new Error("Sign in to save your work.");
    if (get(key) === value) return;
    pending.set(key, value);
    saveTimer ??= setTimeout(() => { void flush().catch(() => {}); }, 650);
  }

  function legacyEntries() {
    try {
      const fixed = ["sg_student", "sg_topics", "sg_scores", "sg_diary", "sg_lessons_done", "sg_lesson_activity",
        ...["studySet", "lesson", "quiz", "reflection", "streak"].map(id => `sg_achievement:${id}`)];
      let passport;
      try { passport = JSON.parse(localStorage.getItem("sg_student")); } catch { /* Other keys may still be valid. */ }
      const owner = localStorage.getItem("sg_community_achievement_owner");
      if (!user || owner !== String(user.id)) return [];
      const id = typeof passport?.studentId === "string" ? passport.studentId : "guest";
      const fields = [
        ...fixed.map(key => [key, [key]]),
        ["sg_explore_v1", [`sg_explore_v1:${id}`, "sg_explore_v1:guest"]],
        ["sg_growth_v1", [`sg_growth_v1:student:${id}`, "sg_growth_v1:guest"]],
        ["sg_pursuit_v1", [`sg_pursuit_v1:student:${id}`, "sg_pursuit_v1:guest"]],
        ["sg_diary_pet_v1", [`sg_diary_pet_v1:${id}`, "sg_diary_pet_v1:guest"]],
        ["sg_lily_checkin", [`studygram.lily.checkin.${id}`, "studygram.lily.checkin.guest"]],
      ];
      return fields.flatMap(([key, candidates]) => {
        if (data.has(key)) return [];
        const oldKey = candidates.find(candidate => localStorage.getItem(candidate) !== null);
        if (!oldKey) return [];
        const value = localStorage.getItem(oldKey);
        const aliases = [...new Set(candidates.filter(candidate => localStorage.getItem(candidate) === value))];
        if (key === "sg_lily_checkin" && !value.startsWith("{")) return [[key, aliases, JSON.stringify({ day: value, step: "general" }), value]];
        return [[key, aliases, value, value]];
      });
    } catch {
      return [];
    }
  }

  async function importLegacy() {
    await flush();
    const entries = legacyEntries();
    if (!entries.length) return false;
    await write(new Map(entries.map(([key, , value]) => [key, value])));
    for (const [, aliases, , previous] of entries) {
      for (const key of aliases) {
        try { if (localStorage.getItem(key) === previous) localStorage.removeItem(key); } catch { /* The account copy is already saved. */ }
      }
    }
    return true;
  }

  function sessionChanged(destination) {
    leaving = true;
    hidePage();
    channel?.postMessage("session-changed");
    if (!channel) {
      try { localStorage.setItem(sessionSignal, String(Date.now())); } catch { /* Visibility checks also detect the change. */ }
    }
    window.location.replace(destination);
  }

  let checking = false;
  async function checkSession() {
    if (checking || leaving || document.hidden) return;
    await ready;
    if (leaving || checking) return;
    checking = true;
    try {
      const result = await request("/api/community/session");
      if (result.user?.id !== user?.id) reload();
    } catch { /* State changes still require an active server session. */ }
    finally { checking = false; }
  }

  channel?.addEventListener("message", event => { if (event.data === "session-changed") reload(); });
  window.addEventListener("storage", event => { if (event.key === sessionSignal) reload(); });
  document.addEventListener("visibilitychange", checkSession);
  window.addEventListener("beforeunload", event => {
    if (!leaving && (pending.size || worker)) event.preventDefault();
  });
  window.addEventListener("pagehide", () => { if (user) hidePage(); });
  window.addEventListener("pageshow", event => { if (event.persisted) reload(); });

  return {
    ready, get, set, flush, request, requireAccount, signInURL, sessionChanged, importLegacy,
    user: () => user,
    unavailable: () => unavailable,
    hasLegacy: () => Boolean(user && legacyEntries().length),
    start: callback => ready.then(() => { if (!leaving) callback(); }),
  };
})();
