(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = Recognition ? new Recognition() : null;
  const status = document.getElementById("lily-status");
  const enable = document.getElementById("lily-start");
  const form = document.getElementById("lily-form");
  const input = document.getElementById("lily-input");
  const send = form.querySelector("button");
  const wakePhrase = /\bhey\s+(?:lily|lilly)\b/i;
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
  const memoryKey = "studygram.lily.checkin." +
    (Storage.getStudentProfile()?.studentId || "guest");

  let listening = false;
  let enabled = true;
  let speaking = false;
  let thinking = false;
  let commandTimer;
  let pendingCheckIn;
  let queuedRequest;
  let proposedSet;
  let questionCount = 0;
  let history = [];

  function today() {
    return new Date().toDateString();
  }

  function openVoiceWindow() {
    clearTimeout(commandTimer);
    commandTimer = setTimeout(() => { commandTimer = undefined; }, 12000);
  }

  function reply(message, voice) {
    status.textContent = message;
    if (!voice || document.hidden) return;
    if (!window.speechSynthesis) {
      openVoiceWindow();
      return;
    }
    speaking = true;
    if (listening) recognition.abort();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-IN";
    utterance.onend = utterance.onerror = () => {
      speaking = false;
      if (!document.hidden) openVoiceWindow();
      start();
    };
    window.speechSynthesis.speak(utterance);
  }

  function getReminder() {
    const saved = localStorage.getItem(memoryKey);
    if (!saved) return null;
    try {
      const reminder = JSON.parse(saved);
      if (reminder && typeof reminder.day === "string") return reminder;
    } catch {
      // Older versions stored the date as plain text.
    }
    return { day: saved, step: "general" };
  }

  function navigate(url) {
    enabled = false;
    if (listening) recognition.abort();
    window.location.assign(url);
  }

  async function talk(phrase, voice) {
    clearTimeout(commandTimer);
    commandTimer = undefined;
    const command = phrase.toLowerCase().replace(/[^a-z\s]/g, " ").trim()
      .replace(/\s+/g, " ").replace(/^(?:open|go to|start)\s+/, "").replace(/^the\s+/, "");
    const forget = /^(?:lily )?forget (?:it|that|my check in)$/.test(command);
    if (forget) {
      localStorage.removeItem(memoryKey);
      pendingCheckIn = undefined;
      history = [];
      questionCount = 0;
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
      history.push({ role: "student", text: `Update after our check-in: ${phrase}` });
      return talk(original, voice);
    }

    const yes = /^(?:yes|yeah|yep|sure|please do|do it)$/.test(command);
    if (pendingCheckIn && (yes || command === "check in tomorrow")) {
      localStorage.setItem(memoryKey, JSON.stringify({ day: today(), step: pendingCheckIn }));
      pendingCheckIn = undefined;
      reply("Yeah, I’ll check in next time you drop by after today.", voice);
      return;
    }
    pendingCheckIn = undefined;

    const reminder = getReminder();
    if (reminder && reminder.day !== today()) {
      localStorage.removeItem(memoryKey);
      queuedRequest = phrase;
      const question = Object.hasOwn(checkInQuestions, reminder.step)
        ? checkInQuestions[reminder.step] : checkInQuestions.general;
      reply(`Hey, quick check-in. ${question} You can say skip and we’ll get straight to your request.`, voice);
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
    try {
      const result = await getLilyReply({ message: phrase, history: history.slice(-8), questionCount });
      message = result.reply;
      if (result.studySet) {
        proposedSet = result.studySet;
        questionCount = 0;
        message += " Say “make it” and I’ll open that study set.";
      } else if (result.studyQuestion) {
        if (questionCount === 4) {
          const params = new URLSearchParams({ focus: phrase.slice(0, 500) });
          status.textContent = "Let’s turn that into a quick reel. ";
          const link = document.createElement("a");
          link.href = `pages/study.html?${params}`;
          link.textContent = "Open New Study Set";
          status.append(link);
          questionCount = 0;
          return;
        }
        questionCount++;
      } else {
        questionCount = 0;
      }
      pendingCheckIn = result.checkIn;
    } catch (error) {
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
    history.push({ role: "student", text: phrase }, { role: "lily", text: message });
    history = history.slice(-8);
    reply(message, voice);
  }

  function submit(phrase, voice) {
    const cleaned = phrase.trim().replace(/^[\s,.!?]+/, "");
    if (!cleaned || thinking || speaking) return false;
    if (cleaned.length > input.maxLength) {
      status.textContent = "That’s a long one. Send a shorter bit so I can follow.";
      return false;
    }
    thinking = true;
    send.disabled = true;
    talk(cleaned, voice).catch(() => {
      reply("Something glitched on my end. Wanna try that again?", voice);
    }).finally(() => {
      thinking = false;
      send.disabled = false;
      start();
    });
    return true;
  }

  function offerRetry() {
    enabled = false;
    clearTimeout(commandTimer);
    commandTimer = undefined;
    enable.hidden = false;
    if (!thinking && !speaking) status.textContent = "Type to Lily, or enable the microphone to use Hey Lily.";
  }

  function start() {
    if (!recognition || !enabled || listening || speaking || thinking || document.hidden) return;
    try {
      recognition.start();
      listening = true;
      enable.hidden = true;
    } catch {
      offerRetry();
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const message = input.value.replace(/^\s*hey\s+(?:lily|lilly)\b/i, "");
    if (submit(message, false)) input.value = "";
  });

  if (!recognition) {
    status.textContent = "Type to Lily. Voice input is unavailable in this browser.";
    return;
  }
  recognition.continuous = true;
  recognition.lang = "en-IN";
  recognition.onresult = event => {
    if (!enabled || speaking || thinking || document.hidden) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      let phrase = event.results[i][0].transcript;
      const wake = wakePhrase.exec(phrase);
      if (wake) {
        phrase = phrase.slice(wake.index + wake[0].length);
        openVoiceWindow();
        status.textContent = "Lily is listening…";
      }
      if (commandTimer !== undefined && submit(phrase, true)) return;
    }
  };

  recognition.onerror = ({ error }) => {
    if (error !== "no-speech" && error !== "aborted") offerRetry();
  };
  recognition.onend = () => {
    listening = false;
    start();
  };
  enable.addEventListener("click", () => {
    enabled = true;
    start();
    if (listening) status.textContent = "Say “Hey Lily” to start.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(commandTimer);
      commandTimer = undefined;
      if (speaking) {
        window.speechSynthesis.cancel();
        speaking = false;
      }
      if (listening) recognition.abort();
    } else {
      start();
    }
  });
  start();
})();
