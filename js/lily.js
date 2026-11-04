(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  const status = document.getElementById("lily-status");
  const form = document.getElementById("lily-form");
  const input = document.getElementById("lily-input");
  const transcript = document.getElementById("lily-transcript");
  const send = form.querySelector("button");
  const destinations = {
    learn: "pages/lesson.html",
    quiz: "pages/quiz.html",
    diary: "pages/diary.html",
    "new study set": "pages/study.html",
  };
  const checkInQuestions = {
    trusted_adult: "Did you get a chance to talk to someone you trust?",
    study_break: "Did you get a chance to take that break?",
    study_plan: "How’d that study plan go?",
    general: "How did things go after we talked?",
  };
  const memoryKey = "sg_lily_checkin";

  let thinking = false;
  let pendingCheckIn;
  let queuedRequest;
  let proposedSet;
  let questionCount = 0;
  let history = [];
  const microphone = window.createLilyVoice?.({ input, submit });

  function today() {
    return new Date().toDateString();
  }

  function addTranscriptMessage(role, message) {
    if (!transcript) return;
    const entry = document.createElement("li");
    const speaker = document.createElement("strong");
    speaker.textContent = role === "student" ? "You" : "Lily";
    entry.dataset.role = role;
    entry.append(speaker, message);
    transcript.append(entry);
    if (transcript.children.length > 8) transcript.firstElementChild.remove();
    transcript.hidden = false;
    transcript.scrollTop = transcript.scrollHeight;
  }

  function reply(message, voice, followUp = message.includes("?")) {
    status.textContent = message;
    if (transcript) {
      addTranscriptMessage("lily", message);
      status.classList.add("indie-visually-hidden");
    }
    microphone?.reply(message, voice, followUp);
  }

  function getReminder() {
    let saved;
    try { saved = Storage.getPrivateValue(memoryKey); } catch { return null; }
    if (!saved) return null;
    try {
      const reminder = JSON.parse(saved);
      if (reminder && typeof reminder.day === "string") return reminder;
    } catch {
      // Older versions stored the date as plain text.
    }
    return { day: saved, step: "general" };
  }

  function clearReminder() {
    try { Storage.setPrivateValue(memoryKey, null); } catch { /* Chat can continue without a stored reminder. */ }
  }

  function navigate(url) {
    microphone?.disable();
    window.location.assign(url);
  }

  async function talk(phrase, voice) {
    const command = phrase.toLowerCase().replace(/[^a-z\s]/g, " ").trim()
      .replace(/\s+/g, " ").replace(/^(?:open|go to|start)\s+/, "").replace(/^the\s+/, "");
    const forget = /^(?:lily )?forget (?:it|that|my check in)$/.test(command);
    if (forget) {
      clearReminder();
      pendingCheckIn = undefined;
      proposedSet = undefined;
      history = [];
      questionCount = 0;
      if (transcript) transcript.replaceChildren();
      const original = queuedRequest;
      queuedRequest = undefined;
      if (original) return talk(original, voice);
      reply("Got you. I cleared that check-in.", voice);
      return;
    }

    if (queuedRequest) {
      const original = queuedRequest;
      queuedRequest = undefined;
      if (command === "skip") return talk(original, voice);
      history.push({ role: "student", text: `Update after our check-in: ${phrase}`.slice(0, input.maxLength) });
      return talk(original, voice);
    }

    const yes = /^(?:yes|yeah|yep|sure|please do|do it)$/.test(command);
    if (pendingCheckIn && (yes || command === "check in tomorrow")) {
      const reminder = { day: today(), step: pendingCheckIn };
      pendingCheckIn = undefined;
      if (typeof StudygramPrivateSession !== "undefined" && !StudygramPrivateSession.user()) {
        reply("Sign in to Studygram to save check-ins for next time.", voice);
        return;
      }
      try {
        Storage.setPrivateValue(memoryKey, JSON.stringify(reminder));
        await Storage.flush();
      }
      catch {
        reply("I couldn’t save the check-in to your account. Try again in a moment.", voice);
        return;
      }
      reply("Yeah, I’ll check in next time you drop by after today.", voice);
      return;
    }
    pendingCheckIn = undefined;

    const reminder = getReminder();
    if (reminder && reminder.day !== today()) {
      clearReminder();
      queuedRequest = phrase;
      const question = Object.hasOwn(checkInQuestions, reminder.step)
        ? checkInQuestions[reminder.step] : checkInQuestions.general;
      reply(`Hey, quick check-in. ${question} You can say or type “skip” to get straight to your request.`, voice);
      return;
    }

    if (proposedSet && (yes || command === "make it" || command === "create reel")) {
      const { name, focus } = proposedSet;
      const matchingSet = Storage.getTopics().find(set => set.name.toLowerCase() === name.toLowerCase());
      const params = new URLSearchParams({ topic: name, focus });
      if (matchingSet) params.set("from", matchingSet.id);
      navigate(`pages/study.html?${params}`);
      return;
    }
    proposedSet = undefined;

    if (Object.hasOwn(destinations, command)) {
      navigate(destinations[command]);
      return;
    }
    if (/^(?:skip|no|no thanks)$/.test(command)) {
      questionCount = 0;
      reply("All good. What do you feel like working on?", voice);
      return;
    }

    status.textContent = "Lily is thinking…";
    let message;
    let remember = true;
    try {
      const result = await getLilyReply({ message: phrase, history: history.slice(-8), questionCount });
      message = result.reply;
      if (result.studySet) {
        proposedSet = result.studySet;
        questionCount = 0;
        message += " Say or type “make it” to open that study set.";
      } else if (result.studyQuestion) {
        if (questionCount === 4) {
          const params = new URLSearchParams({ focus: phrase.slice(0, 500) });
          status.textContent = "Let’s turn that into a quick reel. ";
          const link = document.createElement("a");
          link.href = `pages/study.html?${params}`;
          link.textContent = "Open New Study Set";
          status.append(link);
          microphone?.reply("Let’s turn that into a quick reel. Select Open New Study Set to continue.", voice, false);
          questionCount = 0;
          return;
        }
        questionCount++;
      } else {
        questionCount = 0;
      }
      pendingCheckIn = result.checkIn;
    } catch (error) {
      remember = false;
      pendingCheckIn = /\bbull(?:y|ied|ying)\b/i.test(phrase) ? "trusted_adult" : undefined;
      message = pendingCheckIn
        ? "Ugh, that wasn’t okay. You didn’t deserve it. Is there someone at school or home you’d feel okay telling?"
        : error.message || "I’m having trouble connecting. Wanna try again in a bit?";
    }
    if (pendingCheckIn && !proposedSet) {
      message += " Want me to check in tomorrow?";
    } else {
      pendingCheckIn = undefined;
    }
    if (remember) {
      history.push({ role: "student", text: phrase }, { role: "lily", text: message });
      history = history.slice(-8);
    }
    reply(message, voice, Boolean(proposedSet || pendingCheckIn || message.includes("?")));
  }

  function submit(phrase, voice) {
    const cleaned = phrase.trim().replace(/^[\s,.!?]+/, "");
    if (!cleaned || thinking || microphone?.isSpeaking()) return false;
    if (cleaned.length > input.maxLength) {
      status.textContent = "That’s a long one. Send a shorter bit so I can follow.";
      return false;
    }
    thinking = true;
    send.disabled = true;
    if (transcript) {
      status.classList.remove("indie-visually-hidden");
      addTranscriptMessage("student", cleaned);
    }
    microphone?.setProcessing(true);
    talk(cleaned, voice).catch(() => {
      reply("Something glitched on my end. Wanna try that again?", voice);
    }).finally(() => {
      thinking = false;
      send.disabled = false;
      microphone?.setProcessing(false);
    });
    return true;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const message = input.value.replace(/^\s*hey[\s,.!?]+(?:lily|lilly)\b/i, "");
    if (submit(message, false)) input.value = "";
  });
});
