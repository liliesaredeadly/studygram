(() => {
  const byId = id => document.getElementById(id);
  const form = byId("meta-form");
  const key = byId("meta-key");
  const adult = byId("meta-adult");
  const connect = byId("meta-connect");
  const status = byId("meta-status");
  const summary = byId("meta-connected");
  const badge = byId("meta-badge");
  const availability = byId("meta-availability");
  let enabled = false;
  let busy = false;
  let editing = false;

  function feedback(message, error = false) {
    status.textContent = message;
    status.dataset.error = String(error);
  }

  function concealKey() {
    key.type = "password";
    byId("meta-key-toggle").textContent = "Show";
    byId("meta-key-toggle").setAttribute("aria-label", "Show API key");
    byId("meta-key-toggle").setAttribute("aria-pressed", "false");
  }

  function render() {
    const signedIn = Boolean(StudygramPrivateSession.user());
    const connection = StudygramMetaConnection.current();
    summary.hidden = !connection.connected;
    form.hidden = !enabled || !signedIn || (connection.connected && !editing);
    byId("meta-sign-in").hidden = signedIn;
    badge.textContent = connection.connected ? "Connected" : "Not connected";
    badge.dataset.connected = String(connection.connected);
    byId("meta-connected-model").textContent = connection.connected ? `Model: ${connection.model}` : "";
    byId("meta-cancel").hidden = !connection.connected;
    connect.textContent = busy ? "Checking key…" : connection.connected ? "Connect new key" : "Connect key";
    for (const control of form.querySelectorAll("input, button")) control.disabled = busy;
    byId("meta-replace").disabled = busy || !enabled;
    // Disconnect stays available while a replacement is being checked.
    form.setAttribute("aria-busy", String(busy));
  }

  function invalid(field, errorId, message) {
    field.setAttribute("aria-invalid", "true");
    byId(errorId).textContent = message;
  }

  form.addEventListener("input", event => {
    event.target.removeAttribute("aria-invalid");
    if (event.target === key) byId("meta-key-error").textContent = "";
    if (event.target === adult) byId("meta-adult-error").textContent = "";
    feedback("");
  });

  document.getElementById("meta-key-toggle").addEventListener("click", () => {
    const showing = key.type === "password";
    key.type = showing ? "text" : "password";
    byId("meta-key-toggle").textContent = showing ? "Hide" : "Show";
    byId("meta-key-toggle").setAttribute("aria-label", showing ? "Hide API key" : "Show API key");
    byId("meta-key-toggle").setAttribute("aria-pressed", String(showing));
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !enabled) return;
    byId("meta-key-error").textContent = "";
    byId("meta-adult-error").textContent = "";
    key.removeAttribute("aria-invalid");
    adult.removeAttribute("aria-invalid");
    let firstInvalid;
    if (!/^[\x21-\x7e]{1,2048}$/.test(key.value.trim())) {
      invalid(key, "meta-key-error", "Paste your Meta API key without spaces.");
      firstInvalid = key;
    }
    if (!adult.checked) {
      invalid(adult, "meta-adult-error", "Confirm you are 18 or older to use Meta AI.");
      firstInvalid ||= adult;
    }
    if (firstInvalid) return firstInvalid.focus();
    busy = true;
    feedback("Checking your key and model access…");
    render();
    try {
      await StudygramMetaConnection.connect(key.value, adult.checked);
      key.value = "";
      concealKey();
      editing = false;
      feedback("Key connected. AI usage will use your Meta project.");
    } catch (error) {
      feedback(error.message, true);
      if (["META_KEY_REJECTED", "META_KEY_INVALID"].includes(error.code)) {
        invalid(key, "meta-key-error", "Check the key in your Meta dashboard, then try again.");
      }
    } finally {
      busy = false;
      render();
      if (!form.hidden) key.focus();
      else byId("meta-replace").focus();
    }
  });

  document.getElementById("meta-replace").addEventListener("click", () => {
    editing = true;
    adult.checked = true;
    feedback("");
    render();
    key.focus();
  });

  document.getElementById("meta-cancel").addEventListener("click", () => {
    editing = false;
    key.value = "";
    concealKey();
    feedback("");
    render();
    byId("meta-replace").focus();
  });

  document.getElementById("meta-disconnect").addEventListener("click", () => {
    StudygramMetaConnection.disconnect();
    editing = false;
    key.value = "";
    adult.checked = false;
    concealKey();
    feedback("Disconnected. Your key has been removed from this tab.");
    render();
    if (!form.hidden) key.focus();
  });

  async function load() {
    try {
      await StudygramPrivateSession.ready;
      const configuration = await StudygramMetaConnection.configuration();
      enabled = configuration.enabled === true;
      availability.hidden = enabled;
      availability.textContent = enabled ? "" : "Live Meta AI is turned off by this Studygram host. You can still use the offline activities.";
    } catch {
      availability.hidden = false;
      availability.replaceChildren(document.createTextNode("Couldn’t load AI settings. "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn btn-ghost btn-sm";
      retry.textContent = "Try again";
      retry.addEventListener("click", load);
      availability.append(retry);
    }
    render();
  }

  load();
})();
