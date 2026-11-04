(() => {
  const wakePhrase = /\bhey[\s,.!?]+(?:lily|lilly)\b/i;
  const wakePreferenceKey = "studygram.lily.wake";
  const pauseMs = 850;
  const idleMs = 6000;
  const maxCommandMs = 45000;
  const quickEndMs = 1200;
  const reconnectDelays = [400, 1000, 2200, 4500];
  const speechLanguages = ["en-IN", "en-US"];
  const permissionError = "Microphone permission denied. Allow it in your browser’s site settings and try again.";
  const serviceError = "The speech recognition service is unavailable. Select Enable Hey Lily to retry, or type to Lily.";
  const errors = {
    "not-allowed": permissionError,
    "audio-capture": "No microphone is available. Check your Windows input device and try again.",
  };

  window.createLilyVoice = function ({ input, submit }) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const status = document.getElementById("lily-mic-status");
    const talkButton = document.getElementById("lily-start");
    const wakeButton = document.getElementById("lily-wake");
    const stopButton = document.getElementById("lily-stop");
    const offlineButton = document.getElementById("lily-offline");
    const replayButton = document.getElementById("lily-replay");
    const audioStatus = document.getElementById("lily-audio-status");
    const inputUnavailable = !Recognition
      ? "Voice input is unavailable in this browser. You can still type to Lily."
      : window.isSecureContext === false
        ? "Voice input needs HTTPS or localhost. You can still type to Lily."
        : "";

    let enabled = false;
    let userChose = false;
    let processing = false;
    let error;
    let session;
    let command;
    let playback;
    let retryTimer;
    let reconnectAttempt = 0;
    let reconnecting = false;
    let onlineLanguage = speechLanguages[0];
    let localLanguage;
    let downloadableLanguage;
    let installing = false;
    let lastReply;

    function rememberWake(value) {
      try {
        if (value) window.sessionStorage.setItem(wakePreferenceKey, "on");
        else window.sessionStorage.removeItem(wakePreferenceKey);
      } catch { /* Wake listening still works for the current page. */ }
    }

    function wakeWasEnabled() {
      try { return window.sessionStorage.getItem(wakePreferenceKey) === "on"; }
      catch { return false; }
    }

    function update() {
      let label = "Microphone off";
      if (document.hidden) label = "Microphone paused";
      else if (playback) label = playback.started ? "Speaking…" : "Starting audio…";
      else if (processing) label = "Processing…";
      else if (inputUnavailable) label = inputUnavailable;
      else if (installing) label = "Downloading the offline English speech pack…";
      else if (error) label = error;
      else if (enabled && session?.started && command) label = "Listening…";
      else if (enabled && input.value) label = "Edit or send your draft.";
      else if (enabled && session?.started) label = "Waiting for “Hey Lily”";
      else if (enabled && reconnecting) label = "Reconnecting microphone…";
      else if (enabled) label = "Starting microphone…";

      if (status.textContent !== label) status.textContent = label;
      talkButton.hidden = Boolean(inputUnavailable);
      talkButton.disabled = Boolean(processing || playback || command || installing);
      wakeButton.hidden = enabled || Boolean(inputUnavailable);
      wakeButton.disabled = Boolean(processing || playback || installing);
      stopButton.hidden = !enabled && !playback;
      if (offlineButton) {
        offlineButton.hidden = !downloadableLanguage || Boolean(localLanguage);
        offlineButton.disabled = Boolean(enabled || processing || playback || installing);
      }
      if (replayButton) {
        replayButton.hidden = !lastReply || !window.speechSynthesis || !window.SpeechSynthesisUtterance;
        replayButton.disabled = Boolean(processing || playback || command);
      }
    }

    function stopCapture() {
      clearTimeout(retryTimer);
      if (!session) return;
      const run = session;
      session = undefined;
      clearTimeout(run.startTimer);
      clearTimeout(run.healthyTimer);
      try { run.recognition.abort(); } catch { /* The browser may have already closed the session. */ }
    }

    function clearCommand() {
      if (!command) return;
      clearTimeout(command.pauseTimer);
      clearTimeout(command.idleTimer);
      clearTimeout(command.limitTimer);
      command = undefined;
    }

    function off(message) {
      enabled = false;
      reconnecting = false;
      error = message;
      clearCommand();
      stopCapture();
      update();
    }

    function restart(delay = 250) {
      clearTimeout(retryTimer);
      update();
      if (enabled && !document.hidden && !processing && !playback && (command || !input.value)) {
        retryTimer = setTimeout(start, delay);
      }
    }

    function recover(run) {
      if (session !== run) return;
      if (command?.ready && input.value === command.draft) {
        finishCommand(true);
        return;
      }
      // An interim transcript stays in the input for review.
      if (command?.draft) clearCommand();
      if (reconnectAttempt >= reconnectDelays.length) {
        off(serviceError);
        return;
      }
      reconnecting = true;
      stopCapture();
      restart(reconnectDelays[reconnectAttempt++]);
    }

    function finishCommand(sendDraft) {
      const ready = sendDraft && command?.ready && input.value === command.draft;
      clearCommand();
      stopCapture();
      if (ready && submit(input.value, true)) input.value = "";
      restart();
    }

    function refreshIdle() {
      clearTimeout(command.idleTimer);
      command.idleTimer = setTimeout(() => finishCommand(false), idleMs);
    }

    function beginCommand() {
      command = { draft: "", ready: false };
      command.limitTimer = setTimeout(() => finishCommand(false), maxCommandMs);
      if (session?.started) refreshIdle();
      update();
    }

    function handleResults(run, results) {
      let text = "";
      let final = true;
      for (let i = run.from; i < results.length; i++) {
        text += " " + results[i][0].transcript;
        final &&= results[i].isFinal;
      }
      const wake = wakePhrase.exec(text);
      if (!command || run.stripWake) {
        if (!wake) {
          if (command) {
            if (input.value === command.draft) input.value = "";
            clearCommand();
            run.stripWake = false;
            update();
          }
          // Retain the last finalized result if a wake phrase may span two results.
          run.from = Math.min(run.finalCount, results.length);
          if (run.from && /\bhey[\s,.!?]*$/i.test(results[run.from - 1][0].transcript)) run.from--;
          return;
        }
        if (!command) {
          run.stripWake = true;
          beginCommand();
        }
        text = text.slice(wake.index + wake[0].length);
      } else if (wake && !text.slice(0, wake.index).trim()) {
        text = text.slice(wake.index + wake[0].length);
      }
      const draft = text.replace(/^[\s,.!?]+/, "").trim().slice(0, input.maxLength);
      const ready = Boolean(draft && final);
      if (command.draft === draft && command.ready === ready) return;

      clearTimeout(command.pauseTimer);
      command.ready = ready;
      if (draft) {
        command.draft = draft;
        input.value = draft;
        refreshIdle();
      }
      if (ready) command.pauseTimer = setTimeout(() => finishCommand(true), pauseMs);
    }

    function start() {
      clearTimeout(retryTimer);
      if (inputUnavailable || session || !enabled || processing || playback || document.hidden || (!command && input.value)) return;
      let run;
      try {
        const recognition = new Recognition();
        run = { recognition, from: 0, finalCount: 0, local: Boolean(localLanguage) };
        session = run;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = localLanguage || onlineLanguage;
        if (run.local) recognition.processLocally = true;
        recognition.onstart = () => {
          if (session !== run) return;
          clearTimeout(run.startTimer);
          run.started = true;
          run.startedAt = Date.now();
          reconnecting = false;
          run.healthyTimer = setTimeout(() => { reconnectAttempt = 0; }, 20000);
          if (command && command.idleTimer === undefined) refreshIdle();
          update();
        };
        recognition.onspeechstart = () => {
          if (session !== run || !command) return;
          clearTimeout(command.pauseTimer);
          command.ready = false;
          refreshIdle();
        };
        recognition.onresult = ({ results }) => {
          if (session !== run) return;
          if (results.length) {
            run.receivedResult = true;
            reconnectAttempt = 0;
          }
          while (run.finalCount < results.length && results[run.finalCount].isFinal) run.finalCount++;
          handleResults(run, results);
        };
        recognition.onend = () => {
          if (session !== run) return;
          if (!run.receivedResult && (!run.started || Date.now() - run.startedAt < quickEndMs)) {
            recover(run);
            return;
          }
          clearTimeout(run.startTimer);
          clearTimeout(run.healthyTimer);
          session = undefined;
          if (command?.draft) finishCommand(true);
          else restart();
        };
        recognition.onerror = ({ error: code }) => {
          if (session !== run) return;
          if (code === "no-speech") {
            reconnectAttempt = 0;
            if (command?.draft) finishCommand(true);
            else {
              stopCapture();
              restart();
            }
            return;
          }
          if (run.local && code === "language-not-supported") {
            localLanguage = undefined;
            off("Offline speech is no longer available. Select Enable Hey Lily to use the browser’s speech service.");
            return;
          }
          if (!run.local && code === "language-not-supported" && onlineLanguage !== speechLanguages[1]) {
            onlineLanguage = speechLanguages[1];
            recover(run);
            return;
          }
          if (code === "network" || code === "aborted") {
            recover(run);
            return;
          }
          off(errors[code] || serviceError);
        };
        run.startTimer = setTimeout(() => recover(run), 12000);
        update();
        recognition.start();
      } catch (cause) {
        if (cause.name === "NotAllowedError" || cause.name === "SecurityError") off(permissionError);
        else if (run) recover(run);
        else off(serviceError);
      }
    }

    function enable(direct) {
      userChose = true;
      if (processing || playback || command || installing) return;
      if (direct && input.value) {
        input.focus();
        return;
      }
      enabled = true;
      error = undefined;
      reconnectAttempt = 0;
      reconnecting = false;
      if (direct) {
        // Keep speech captured before the button was pressed out of the direct command.
        stopCapture();
        beginCommand();
      } else rememberWake(true);
      start();
      update();
    }

    function listenForFollowUp() {
      if (enabled && !document.hidden && !command && !input.value) beginCommand();
    }

    function audioMessage(message) {
      if (!audioStatus) return;
      audioStatus.textContent = message;
      audioStatus.hidden = !message;
    }

    function endPlayback(cancel = false, failed = false) {
      if (!playback) return;
      const { followUp } = playback;
      clearTimeout(playback.timer);
      playback = undefined;
      if (cancel) window.speechSynthesis.cancel();
      if (failed) audioMessage("Lily’s reply couldn’t play. Select Replay reply to try again.");
      else if (!cancel && followUp) listenForFollowUp();
      restart();
    }

    function playReply(message, followUp) {
      clearCommand();
      stopCapture();
      audioMessage("");
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        audioMessage("Spoken replies are unavailable in this browser. You can read Lily’s reply above.");
        if (followUp) listenForFollowUp();
        restart();
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(message);
      const localVoices = (window.speechSynthesis.getVoices?.() || [])
        .filter(voice => voice.localService && /^en(?:[-_]|$)/i.test(voice.lang));
      const voice = speechLanguages.map(language => localVoices.find(candidate => candidate.lang.toLowerCase() === language.toLowerCase()))
        .find(Boolean) || localVoices[0];
      utterance.lang = voice?.lang || localLanguage || speechLanguages[0];
      if (voice) utterance.voice = voice;
      playback = { utterance, followUp };
      utterance.onstart = () => {
        if (playback?.utterance !== utterance) return;
        clearTimeout(playback.timer);
        playback.timer = setTimeout(() => endPlayback(true, true), Math.max(12000, message.length * 95));
        playback.started = true;
        update();
      };
      utterance.onend = () => {
        if (playback?.utterance === utterance) endPlayback();
      };
      utterance.onerror = () => {
        if (playback?.utterance === utterance) endPlayback(false, true);
      };
      playback.timer = setTimeout(() => endPlayback(true, true), 5000);
      update();
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        endPlayback(false, true);
      }
    }

    function localOptions(language) {
      return { langs: [language], processLocally: true, quality: "dictation" };
    }

    async function findOfflineLanguage() {
      if (inputUnavailable || typeof Recognition.available !== "function") return;
      for (const language of speechLanguages) {
        let availability;
        try { availability = await Recognition.available(localOptions(language)); }
        catch { continue; }
        if (availability === "available") {
          localLanguage = language;
          break;
        }
        if (!downloadableLanguage && typeof Recognition.install === "function" &&
            (availability === "downloadable" || availability === "downloading")) {
          downloadableLanguage = language;
        }
      }
      update();
    }

    talkButton.addEventListener("click", () => enable(true));
    wakeButton.addEventListener("click", () => enable(false));
    offlineButton?.addEventListener("click", async () => {
      if (!downloadableLanguage || enabled || processing || playback || installing) return;
      userChose = true;
      installing = true;
      const language = downloadableLanguage;
      update();
      try {
        if (!await Recognition.install(localOptions(language))) throw new Error("Speech pack unavailable");
        localLanguage = language;
        downloadableLanguage = undefined;
        error = "Offline mic is ready. Select Enable Hey Lily.";
      } catch {
        error = "The offline speech pack couldn’t download. You can retry or use the regular microphone.";
      } finally {
        installing = false;
        update();
      }
    });
    replayButton?.addEventListener("click", () => {
      if (lastReply && !document.hidden && !processing && !playback && !command) playReply(lastReply, false);
    });
    stopButton.addEventListener("click", () => {
      userChose = true;
      rememberWake(false);
      off();
      endPlayback(true);
    });
    input.addEventListener("input", () => {
      // Once the student edits, their text belongs to the form.
      clearCommand();
      stopCapture();
      restart();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearCommand();
        stopCapture();
        endPlayback(true);
      }
      restart();
    });

    update();
    const offlineReady = findOfflineLanguage().catch(() => update());
    if (!inputUnavailable) navigator.permissions?.query?.({ name: "microphone" }).then(async ({ state }) => {
      if (userChose) return;
      if (state === "granted" && wakeWasEnabled()) {
        if (typeof Recognition.available === "function") {
          let deadline;
          await Promise.race([offlineReady, new Promise(resolve => { deadline = setTimeout(resolve, 650); })]);
          clearTimeout(deadline);
          if (userChose) return;
        }
        enabled = true;
        start();
      } else if (state === "denied") {
        off(permissionError);
      }
    }).catch(() => {});

    return {
      isSpeaking: () => Boolean(playback),
      disable() {
        userChose = true;
        off();
      },
      setProcessing(value) {
        processing = value;
        if (value) {
          clearCommand();
          stopCapture();
        }
        restart();
      },
      reply(message, voice, followUp = false) {
        lastReply = message;
        audioMessage("");
        if (voice && enabled && !document.hidden) playReply(message, followUp);
        else update();
      },
    };
  };
})();
