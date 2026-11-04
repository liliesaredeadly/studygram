const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

function openLily({ permission = "prompt", savedWake = permission === "granted", playback = false, delayPlayback = false, delayStart = false, recognized = true, reply, voices, offline, respond } = {}) {
  const requests = [];
  const sessions = [];
  const utterances = [];
  const packChecks = [];
  const packInstalls = [];
  const timers = new Map();
  let time = 0;
  let timerId = 0;
  let destination;
  const send = {};
  const node = (properties = {}) => ({
    textContent: "",
    listeners: {},
    addEventListener(event, callback) { this.listeners[event] = callback; },
    fire(event) { this.listeners[event]?.({ preventDefault() {} }); },
    ...properties,
  });
  const input = node({ value: "", maxLength: 3000 });
  const status = node();
  const micStatus = node();
  const start = node();
  const stop = node();
  const wake = node();
  const offlineButton = node({ hidden: true });
  const replay = node({ hidden: true });
  const audioStatus = node();
  const form = node({ querySelector: () => send });
  const nodes = {
    "lily-status": status, "lily-mic-status": micStatus, "lily-start": start,
    "lily-stop": stop, "lily-wake": wake, "lily-input": input, "lily-form": form,
    "lily-offline": offlineButton, "lily-replay": replay, "lily-audio-status": audioStatus,
  };
  const document = node({ hidden: false, getElementById: id => nodes[id] });
  class Recognition {
    start() {
      sessions.push(this);
      if (!delayStart) this.onstart?.();
    }
    abort() {
      this.aborted = true;
      this.onerror?.({ error: "aborted" });
      this.onend?.();
    }
    result(...results) {
      this.onresult?.({
        resultIndex: 0,
        results: results.map(([transcript, isFinal]) =>
          Object.assign([{ transcript, confidence: 0.9 }], { isFinal })),
      });
    }
    error(error) {
      this.onerror?.({ error });
      this.onend?.();
    }
    end() { this.onend?.(); }
  }
  if (offline) {
    Recognition.prototype.processLocally = false;
    Recognition.available = async ({ langs, processLocally, quality }) => {
      const lang = langs[0];
      packChecks.push({ lang, processLocally, quality });
      return offline[lang] || "unavailable";
    };
    Recognition.install = async ({ langs, processLocally, quality }) => {
      const lang = langs[0];
      packInstalls.push({ lang, processLocally, quality });
      offline[lang] = "available";
      return true;
    };
  }
  const window = {
    location: { assign: url => { destination = url; } },
    isSecureContext: true,
    sessionStorage: {
      getItem: () => savedWake ? "on" : null,
      setItem: () => { savedWake = true; },
      removeItem: () => { savedWake = false; },
    },
  };
  if (recognized) window.webkitSpeechRecognition = Recognition;
  if (playback) {
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.speechSynthesis = {
      speak: utterance => { utterances.push(utterance); if (!delayPlayback) utterance.onstart?.(); },
      cancel: () => {},
      getVoices: () => voices || [],
    };
  }
  const context = vm.createContext({
    window, document,
    navigator: { permissions: { query: async () => ({ state: permission }) } },
    Storage: { getStudentProfile: () => null, getTopics: () => [] },
    localStorage: { getItem: () => null, removeItem() {} },
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, at: time + delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
    Date: class extends Date { static now() { return time; } },
    getLilyReply: async request => {
      requests.push(request.message);
      return respond ? respond(request) : reply ?? { reply: "Let’s work through it." };
    },
    URLSearchParams,
  });
  vm.runInContext(readFileSync("js/lily-voice.js", "utf8"), context);
  vm.runInContext(readFileSync("js/lily.js", "utf8"), context);
  return {
    requests, sessions, utterances, input, start, stop, wake, form, status, micStatus, document,
    offlineButton, replay, audioStatus, packChecks, packInstalls,
    get destination() { return destination; },
    get savedWake() { return savedWake; },
    get mic() { return sessions.at(-1); },
    async tick(ms = 0) {
      await new Promise(setImmediate);
      const end = time + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end)
          .sort(([, a], [, b]) => a.at - b.at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        time = timer.at;
        timer.callback();
        await new Promise(setImmediate);
      }
      time = end;
    },
  };
}

test("resumes wake listening only when permission and the tab's wake preference are set", async () => {
  const lily = openLily();
  await lily.tick();
  assert.equal(lily.sessions.length, 0);
  const newTab = openLily({ permission: "granted", savedWake: false });
  await newTab.tick();
  assert.equal(newTab.sessions.length, 0);
  newTab.wake.fire("click");
  assert.equal(newTab.savedWake, true);
  newTab.stop.fire("click");
  assert.equal(newTab.savedWake, false);
  const granted = openLily({ permission: "granted" });
  await granted.tick();
  assert.match(granted.micStatus.textContent, /waiting.*hey lily/i);
});

test("a spoken reply that never starts gives control back to the microphone", async () => {
  const lily = openLily({ playback: true, delayPlayback: true, reply: { reply: "A long reply. ".repeat(90) } });
  lily.start.fire("click");
  lily.mic.result(["Explain K-maps", true]);
  await lily.tick(1000);
  assert.match(lily.micStatus.textContent, /starting audio/i);
  await lily.tick(5250);
  assert.match(lily.audioStatus.textContent, /couldn’t play/i);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("wake listening prefers an installed on-device English pack", async () => {
  const lily = openLily({ permission: "granted", offline: { "en-US": "available" } });
  await lily.tick();
  assert.deepEqual(lily.packChecks, [
    { lang: "en-IN", processLocally: true, quality: "dictation" },
    { lang: "en-US", processLocally: true, quality: "dictation" },
  ]);
  assert.equal(lily.sessions.length, 1);
  assert.equal(lily.mic.lang, "en-US");
  assert.equal(lily.mic.processLocally, true);
  assert.deepEqual(lily.packInstalls, []);
});

test("an on-device pack is installed only from the offline button with the microphone off", async () => {
  const lily = openLily({ offline: { "en-IN": "downloadable" } });
  await lily.tick();
  assert.equal(lily.offlineButton.hidden, false);
  assert.ok(!lily.offlineButton.disabled);
  assert.deepEqual(lily.packInstalls, []);

  lily.wake.fire("click");
  assert.ok(lily.offlineButton.hidden || lily.offlineButton.disabled);
  assert.equal(lily.mic.processLocally, false);
  lily.stop.fire("click");
  lily.offlineButton.fire("click");
  await lily.tick();
  assert.equal(lily.packInstalls.length, 1);
  assert.equal(lily.packInstalls[0].lang, "en-IN");
  assert.equal(lily.sessions.length, 1);

  lily.wake.fire("click");
  assert.equal(lily.sessions.length, 2);
  assert.equal(lily.mic.lang, "en-IN");
  assert.equal(lily.mic.processLocally, true);
});

test("typing works in browsers without speech recognition", async () => {
  const lily = openLily({ recognized: false });
  assert.match(lily.micStatus.textContent, /voice input is unavailable/i);
  lily.input.value = "hello";
  lily.form.fire("submit");
  assert.deepEqual(lily.requests, ["hello"]);
  await lily.tick();
});

test("Talk to Lily previews a direct request and submits it once after a pause", async () => {
  const lily = openLily();
  lily.start.fire("click");
  lily.mic.result(["explain", false]);
  assert.equal(lily.input.value, "explain");
  lily.mic.result(["explain K-maps", true]);
  assert.deepEqual(lily.requests, []);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
  assert.equal(lily.input.value, "");
});

test("direct capture waits for recognition to start before counting idle time", async () => {
  const lily = openLily({ delayStart: true });
  lily.start.fire("click");
  const mic = lily.mic;
  await lily.tick(7000);
  assert.equal(mic.aborted, undefined);
  mic.onstart();
  mic.result(["explain K-maps", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
});

test("a direct request can also begin with the wake phrase", async () => {
  const lily = openLily();
  lily.start.fire("click");
  lily.mic.result(["Hey Lily, explain K-maps", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
});

test("a final fragment is held while a following fragment is still interim", async () => {
  const lily = openLily();
  lily.start.fire("click");
  lily.mic.result(["explain Gray code", true]);
  await lily.tick(400);
  lily.mic.result(["explain Gray code", true], ["and how", false]);
  await lily.tick(2000);
  assert.equal(lily.input.value, "explain Gray code and how");
  assert.deepEqual(lily.requests, []);
  lily.mic.result(["explain Gray code", true], ["and how to group the corners", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain Gray code and how to group the corners"]);
});

test("a wake phrase in the same utterance strips the prefix and ignores duplicate callbacks", async () => {
  const lily = openLily({ permission: "granted" });
  await lily.tick();
  const mic = lily.mic;
  mic.result(["Hey Lily, explain", false]);
  assert.equal(lily.input.value, "explain");
  mic.result(["Hey Lily, explain K-maps.", true]);
  await lily.tick(1000);
  mic.result(["Hey Lily, explain K-maps.", true]);
  mic.end();
  assert.deepEqual(lily.requests, ["explain K-maps."]);
});

test("a standalone wake phrase survives a browser restart while slow speech extends the command window", async () => {
  const lily = openLily({ permission: "granted" });
  await lily.tick();
  const first = lily.mic;
  first.result(["Hey Lilly", true]);
  first.end();
  await lily.tick(1000);
  assert.notEqual(lily.mic, first);
  lily.mic.result(["I am", false]);
  await lily.tick(4000);
  lily.mic.result(["I am trying", false]);
  await lily.tick(4000);
  lily.mic.result(["I am trying to understand", false]);
  await lily.tick(4000);
  lily.mic.result(["I am trying to understand K-map wraparound", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["I am trying to understand K-map wraparound"]);
});

test("a retracted interim wake phrase leaves no draft or accidental command", async () => {
  const lily = openLily();
  lily.wake.fire("click");
  lily.mic.result(["Hey Lily, explain", false]);
  assert.equal(lily.input.value, "explain");
  lily.mic.result(["Hey Liam, explain", true]);
  await lily.tick(1000);
  assert.equal(lily.input.value, "");
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
  assert.deepEqual(lily.requests, []);
  lily.mic.result(["Hey Liam, explain", true], ["Hey. Lily, explain K-maps", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
});

test("an interim-only transcript remains editable after recognition ends", async () => {
  const lily = openLily();
  lily.start.fire("click");
  lily.mic.result(["explain gray", false]);
  lily.mic.end();
  await lily.tick(2000);
  assert.equal(lily.input.value, "explain gray");
  assert.deepEqual(lily.requests, []);
  lily.input.value = "explain Gray code";
  lily.input.fire("input");
  lily.form.fire("submit");
  assert.deepEqual(lily.requests, ["explain Gray code"]);
});

test("Stop ends listening and keeps the draft available to send", async () => {
  const lily = openLily();
  lily.start.fire("click");
  const mic = lily.mic;
  mic.result(["show a wraparound group", false]);
  lily.stop.fire("click");
  await lily.tick(2000);
  assert.equal(lily.input.value, "show a wraparound group");
  assert.equal(mic.aborted, true);
  assert.equal(lily.sessions.length, 1);
  assert.deepEqual(lily.requests, []);
});

for (const [error, message] of [
  ["not-allowed", /permission/i],
  ["audio-capture", /no microphone/i],
]) {
  test(`voice error ${error} stays visible until an explicit retry`, async () => {
    const lily = openLily();
    lily.start.fire("click");
    lily.mic.error(error);
    await lily.tick(2000);
    assert.match(lily.micStatus.textContent, message);
    assert.equal(lily.sessions.length, 1);
    lily.input.value = "hello";
    lily.form.fire("submit");
    assert.deepEqual(lily.requests, ["hello"]);
    await lily.tick();
    lily.start.fire("click");
    assert.equal(lily.sessions.length, 2);
  });
}

test("Hey Lily reconnects after a network drop and can speak the next reply", async () => {
  const lily = openLily({ playback: true });
  lily.wake.fire("click");
  const disconnected = lily.mic;
  disconnected.error("network");
  assert.match(lily.micStatus.textContent, /reconnecting microphone/i);
  await lily.tick(399);
  assert.equal(lily.sessions.length, 1);
  await lily.tick(1);
  assert.equal(lily.sessions.length, 2);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);

  disconnected.result(["Hey Lily, don't send this", true]);
  lily.mic.result(["Hey Lily, explain K-maps", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
  assert.equal(lily.utterances[0].text, "Let’s work through it.");
});

test("repeated network drops back off and eventually require a manual retry", async () => {
  const lily = openLily();
  lily.wake.fire("click");
  const delays = [400, 1000, 2200, 4500];
  for (const [i, delay] of delays.entries()) {
    lily.mic.error("network");
    await lily.tick(delay - 1);
    assert.equal(lily.sessions.length, i + 1);
    await lily.tick(1);
    assert.equal(lily.sessions.length, i + 2);
  }
  lily.mic.error("network");
  await lily.tick(30000);
  assert.equal(lily.sessions.length, 5);
  assert.match(lily.micStatus.textContent, /speech recognition service/i);
  lily.wake.fire("click");
  assert.equal(lily.sessions.length, 6);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("speech sessions that close immediately without results back off like network failures", async () => {
  const lily = openLily();
  lily.wake.fire("click");
  for (const [index, delay] of [400, 1000, 2200, 4500].entries()) {
    lily.mic.end();
    await lily.tick(delay - 1);
    assert.equal(lily.sessions.length, index + 1);
    await lily.tick(1);
    assert.equal(lily.sessions.length, index + 2);
  }
  lily.mic.end();
  await lily.tick(10000);
  assert.equal(lily.sessions.length, 5);
  assert.match(lily.micStatus.textContent, /speech recognition service/i);
});

test("a rejected online speech locale falls back without losing the direct command", async () => {
  const lily = openLily();
  lily.start.fire("click");
  assert.equal(lily.mic.lang, "en-IN");
  lily.mic.error("language-not-supported");
  await lily.tick(1000);
  assert.equal(lily.mic.lang, "en-US");
  assert.match(lily.micStatus.textContent, /listening/i);
  lily.mic.result(["explain K-maps", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
});

test("a stalled microphone start retries even when the browser never reports an error", async () => {
  const lily = openLily({ delayStart: true });
  lily.wake.fire("click");
  const disconnected = lily.mic;
  await lily.tick(12400);
  assert.equal(disconnected.aborted, true);
  assert.equal(lily.sessions.length, 2);
  lily.mic.onstart();
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("Stop and hiding Home cancel a pending microphone reconnect", async () => {
  const stopped = openLily();
  stopped.wake.fire("click");
  stopped.mic.error("network");
  assert.match(stopped.micStatus.textContent, /reconnecting microphone/i);
  stopped.stop.fire("click");
  await stopped.tick(10000);
  assert.equal(stopped.sessions.length, 1);
  assert.match(stopped.micStatus.textContent, /microphone off/i);

  const hidden = openLily();
  hidden.wake.fire("click");
  hidden.mic.error("network");
  assert.match(hidden.micStatus.textContent, /reconnecting microphone/i);
  hidden.document.hidden = true;
  hidden.document.fire("visibilitychange");
  await hidden.tick(10000);
  assert.equal(hidden.sessions.length, 1);
  assert.match(hidden.micStatus.textContent, /microphone paused/i);
});

test("a working recognizer resets the microphone retry delay", async () => {
  const lily = openLily();
  lily.wake.fire("click");
  lily.mic.error("network");
  await lily.tick(400);
  assert.equal(lily.sessions.length, 2);
  lily.mic.result(["ordinary background speech", true]);
  lily.mic.error("network");
  await lily.tick(400);
  assert.equal(lily.sessions.length, 3);
  assert.deepEqual(lily.requests, []);

  await lily.tick(20000);
  lily.mic.error("network");
  await lily.tick(400);
  assert.equal(lily.sessions.length, 4);
});

test("disconnect leaves interim speech editable and sends a finalized command only once", async () => {
  const interim = openLily();
  interim.wake.fire("click");
  interim.mic.result(["Hey Lily, explain", false]);
  interim.mic.error("network");
  await interim.tick(10000);
  assert.equal(interim.input.value, "explain");
  assert.deepEqual(interim.requests, []);

  const finalized = openLily({ playback: true });
  finalized.wake.fire("click");
  const disconnected = finalized.mic;
  disconnected.result(["Hey Lily, explain K-maps", true]);
  disconnected.error("network");
  await finalized.tick(1000);
  disconnected.end();
  await finalized.tick(1000);
  assert.deepEqual(finalized.requests, ["explain K-maps"]);
  assert.equal(finalized.input.value, "");
  assert.equal(finalized.utterances.length, 1);
});

test("silence retries wake listening even if the browser omits the end event", async () => {
  const lily = openLily({ permission: "granted" });
  await lily.tick();
  const silent = lily.mic;
  silent.onerror({ error: "no-speech" });
  await lily.tick(1000);
  silent.end();
  await lily.tick(1000);
  assert.equal(lily.sessions.length, 2);
  assert.deepEqual(lily.requests, []);
});

test("spoken replies pause recognition and resume wake listening when playback ends", async () => {
  const lily = openLily({ permission: "granted", playback: true });
  await lily.tick();
  const mic = lily.mic;
  mic.result(["Hey Lily, explain K-maps", true]);
  await lily.tick(1000);
  assert.equal(mic.aborted, true);
  assert.match(lily.micStatus.textContent, /speaking/i);
  assert.equal(lily.sessions.length, 1);
  lily.utterances[0].onend();
  await lily.tick(1000);
  assert.equal(lily.sessions.length, 2);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("a stalled spoken reply times out and resumes the microphone", async () => {
  const lily = openLily({ playback: true });
  lily.start.fire("click");
  lily.mic.result(["explain K-maps", true]);
  await lily.tick(1000);
  assert.match(lily.micStatus.textContent, /speaking/i);
  await lily.tick(16000);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("a spoken reply prefers a local English voice and can replay with the microphone off", async () => {
  const preferredVoice = { name: "Windows English India", lang: "en-IN", localService: true };
  const lily = openLily({ playback: true, voices: [
    { name: "Remote English India", lang: "en-IN", localService: false },
    { name: "Windows English US", lang: "en-US", localService: true },
    preferredVoice,
  ] });
  lily.wake.fire("click");
  lily.mic.result(["Hey Lily, explain K-maps", true]);
  await lily.tick(1000);
  assert.equal(lily.utterances[0].voice, preferredVoice);
  lily.utterances[0].onerror({ error: "synthesis-failed" });
  assert.match(lily.audioStatus.textContent, /audio|play|voice|speaker/i);
  assert.equal(lily.replay.hidden, false);

  lily.stop.fire("click");
  lily.replay.fire("click");
  assert.equal(lily.utterances.length, 2);
  assert.equal(lily.utterances[1].text, "Let’s work through it.");
  lily.utterances[1].onend();
  await lily.tick(1000);
  assert.equal(lily.sessions.length, 1);
  assert.deepEqual(lily.requests, ["explain K-maps"]);
});

test("a spoken study question opens a follow-up without another wake phrase", async () => {
  const lily = openLily({ playback: true, reply: { reply: "Which step felt tricky?", studyQuestion: true } });
  lily.start.fire("click");
  lily.mic.result(["Explain K-maps", true]);
  await lily.tick(1000);
  lily.utterances[0].onend();
  await lily.tick(1000);
  assert.match(lily.micStatus.textContent, /listening/i);
  lily.mic.result(["The edge groups", true]);
  await lily.tick(1000);
  assert.deepEqual(lily.requests, ["Explain K-maps", "The edge groups"]);
  lily.utterances[1].onend();
  await lily.tick(8000);
  assert.match(lily.micStatus.textContent, /waiting.*hey lily/i);
});

test("Stop during a spoken question prevents follow-up capture", async () => {
  const lily = openLily({ playback: true, reply: { reply: "Which step felt tricky?", studyQuestion: true } });
  lily.start.fire("click");
  lily.mic.result(["Explain K-maps", true]);
  await lily.tick(1000);
  lily.stop.fire("click");
  lily.utterances[0].onend();
  await lily.tick(1000);
  assert.equal(lily.sessions.length, 1);
  assert.match(lily.micStatus.textContent, /microphone off/i);
});

test("continuous interim speech reaches a hard limit and remains as a draft", async () => {
  const lily = openLily();
  lily.start.fire("click");
  const mic = lily.mic;
  for (let i = 0; i < 9; i++) {
    mic.result([`still speaking ${i}`, false]);
    await lily.tick(5000);
  }
  assert.equal(mic.aborted, true);
  assert.equal(lily.input.value, "still speaking 8");
  assert.deepEqual(lily.requests, []);
});

test("hiding Home cancels capture and leaves an unfinished request untouched", async () => {
  const lily = openLily({ permission: "granted" });
  await lily.tick();
  const mic = lily.mic;
  mic.result(["Hey Lily, how do I", false]);
  lily.document.hidden = true;
  lily.document.fire("visibilitychange");
  await lily.tick(1000);
  assert.equal(mic.aborted, true);
  assert.equal(lily.sessions.length, 1);
  assert.equal(lily.input.value, "how do I");
  assert.deepEqual(lily.requests, []);
});

test("the follow-up mic can accept Lily's focused study offer", async () => {
  const lily = openLily({
    reply: { reply: "Let’s build a reel.", studySet: { name: "K-maps", focus: "Wraparound groups" } },
  });
  lily.start.fire("click");
  lily.mic.result(["I need help with K-maps", true]);
  await lily.tick(1200);
  lily.mic.result(["make it", true]);
  await lily.tick(1000);
  assert.equal(lily.destination, "pages/study.html?topic=K-maps&focus=Wraparound+groups");
});

test("a failed Lily request does not become conversation history on retry", async () => {
  const requests = [];
  const lily = openLily({ respond(request) {
    requests.push(request);
    if (requests.length === 1) throw new Error("Service unavailable.");
    return { reply: "Let’s work through it." };
  } });
  for (const message of ["Help with circuits", "Help with circuits again"]) {
    lily.input.value = message;
    lily.form.fire("submit");
    await lily.tick();
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[1].history.length, 0);
  assert.equal(lily.status.textContent, "Let’s work through it.");
});

test("forgetting clears Lily's pending study-set offer", async () => {
  const lily = openLily({ reply: { reply: "Let’s build a reel.", studySet: { name: "K-maps", focus: "Wraparound" } } });
  for (const message of ["Help with K-maps", "forget that", "make it"]) {
    lily.input.value = message;
    lily.form.fire("submit");
    await lily.tick();
  }
  assert.equal(lily.destination, undefined);
  assert.deepEqual(lily.requests, ["Help with K-maps", "make it"]);
});
