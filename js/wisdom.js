(() => {
  'use strict';

  const element = (name) => document.getElementById(`wisdom-${name}`);
  const composer = element('composer');
  const form = element('form');
  const input = element('message');
  const submit = element('submit');
  const error = element('error');
  const status = element('status');
  const examples = element('examples');
  const responsePanel = element('response');
  const film = element('film');
  const art = element('art');
  const reply = element('reply');
  const replyTitle = element('reply-title');
  const traditions = element('traditions');
  const card = element('card');
  const cardTitle = element('card-title');
  const source = element('source');
  const previous = element('previous');
  const next = element('next');
  const resetButton = element('reset');
  const narration = element('narration');
  const audioStatus = element('audio-status');
  const choiceButtons = [...traditions.querySelectorAll('[data-tradition]')];
  const sampleButtons = [...examples.querySelectorAll('[data-example]')];
  const synth = window.speechSynthesis;

  const replyTitles = {
    clarify: 'Tell me a little more',
    listen: 'A moment to talk it through',
    check_safety: 'Let’s check on your safety',
    support_now: 'Get support now',
    choose_tradition: 'What feels right for you?',
  };
  const chapterNames = ['Pause', 'Story', 'Perspective', 'Reflection', 'Next step'];

  let history = [];
  let choiceContext = null;
  let cards = [];
  let chapter = 0;
  let request = null;
  let currentScene;
  let utterance = null;

  function drawScene(sceneId, replay = false) {
    if (sceneId === currentScene && !replay) return;
    currentScene = sceneId;
    window.renderWisdomScene?.(art, sceneId);
  }

  function showPreview() {
    film.hidden = false;
    film.classList.remove('wisdom-film-playing');
    drawScene('shore');
    element('film-label').textContent = 'An illustrated reflection';
    element('film-title').textContent = 'A moment to pause.';
    element('film-footer').textContent = 'Still frame · shoreline at dusk';
  }

  function localVoice() {
    return synth?.getVoices().find((voice) => voice.localService === true && /^en(?:[-_]|$)/i.test(voice.lang));
  }

  function updateAudio() {
    const available = Boolean(localVoice() && window.SpeechSynthesisUtterance);
    narration.disabled = !available;
    narration.textContent = utterance ? 'Stop reading' : 'Read aloud';
    audioStatus.textContent = available
      ? (utterance ? 'Reading this card.' : 'Uses an on-device voice.')
      : 'An on-device English voice is unavailable in this browser.';
  }

  function stopNarration() {
    if (utterance) {
      utterance = null;
      synth.cancel();
    }
    updateAudio();
  }

  function toggleNarration() {
    if (utterance) {
      stopNarration();
      return;
    }
    const voice = localVoice();
    const current = cards[chapter];
    if (!voice || !current || document.hidden) return;

    const reading = new window.SpeechSynthesisUtterance(`${current.title}. ${current.text}`);
    reading.voice = voice;
    reading.lang = voice.lang;
    reading.rate = 0.9;
    reading.onend = () => {
      if (utterance === reading) {
        utterance = null;
        updateAudio();
      }
    };
    reading.onerror = () => {
      if (utterance === reading) {
        utterance = null;
        updateAudio();
        audioStatus.textContent = 'This voice couldn’t read the card. You can try again.';
      }
    };
    utterance = reading;
    updateAudio();
    synth.speak(reading);
  }

  function showSource(passage, translation) {
    source.hidden = !passage;
    element('card-text').hidden = Boolean(passage);
    if (!passage) return;

    element('quote').textContent = translation;
    const original = element('original');
    original.textContent = passage.original || '';
    original.hidden = !passage.original;
    const link = element('source-link');
    link.textContent = passage.reference;
    link.removeAttribute('href');
    if (typeof passage.url === 'string' && /^https:\/\//i.test(passage.url)) link.href = passage.url;
    element('edition').textContent = passage.edition;
    const growth = element('growth-link');
    const tradition = passage.reference === 'Bhagavad Gita 2.47' ? 'gita' : passage.reference === 'Ephesians 4:32' ? 'bible' : '';
    growth.hidden = !tradition;
    if (tradition) growth.href = `growth.html?passage=${tradition}#growth-recall`;
  }

  function showCard() {
    stopNarration();
    const current = cards[chapter];
    const name = current.source ? 'Passage' : chapterNames[chapter];
    const count = `Card ${chapter + 1} of ${cards.length}`;

    drawScene(current.scene || cards.find((item) => item.scene)?.scene || 'shore', Boolean(current.scene));
    film.classList.add('wisdom-film-playing');
    film.hidden = false;
    element('film-label').textContent = `Chapter ${String(chapter + 1).padStart(2, '0')}`;
    element('film-title').textContent = name;
    let footer = 'Cinematic reflection';
    if (current.scene) footer = current.scene === 'shore' ? 'Illustrated scene' : 'Illustrated dramatization';
    element('film-footer').textContent = footer;
    element('card-label').textContent = name;
    element('card-count').textContent = count;
    cardTitle.textContent = current.title;
    element('card-text').textContent = current.source ? '' : current.text;
    showSource(current.source, current.text);
    previous.disabled = chapter === 0;
    next.disabled = chapter === cards.length - 1;
    responsePanel.dataset.chapterMotion = chapter % 2 ? 'odd' : 'even';
    card.hidden = false;
    cardTitle.focus();
  }

  function clearReading() {
    stopNarration();
    cards = [];
    chapter = 0;
    delete responsePanel.dataset.chapterMotion;
    card.hidden = true;
    film.hidden = true;
    cardTitle.textContent = '';
    element('card-text').textContent = '';
    element('quote').textContent = '';
    element('original').textContent = '';
    element('source-link').textContent = '';
    element('source-link').removeAttribute('href');
    element('edition').textContent = '';
  }

  function clearReply() {
    reply.hidden = true;
    reply.classList.remove('wisdom-reply-safety');
    traditions.hidden = true;
    replyTitle.textContent = '';
    element('reply-text').textContent = '';
  }

  function showReply(result) {
    const isSafety = result.kind === 'check_safety' || result.kind === 'support_now';
    if (isSafety) {
      examples.hidden = true;
      composer.before(responsePanel);
    }
    if (result.kind === 'support_now') {
      composer.hidden = true;
      history = [];
    }
    traditions.hidden = result.kind !== 'choose_tradition';
    reply.classList.toggle('wisdom-reply-safety', isSafety);
    replyTitle.textContent = replyTitles[result.kind];
    element('reply-text').textContent = result.message;
    reply.hidden = false;
    replyTitle.focus();
  }

  function clearError() {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  }

  function showError(message, invalid = false) {
    error.textContent = message;
    error.hidden = false;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    } else {
      error.focus();
    }
  }

  function setPending(pending) {
    submit.disabled = pending;
    input.readOnly = pending;
    for (const button of [...choiceButtons, ...sampleButtons]) button.disabled = pending;
    status.textContent = pending ? 'Preparing a response…' : '';
  }

  function validResult(result) {
    if (result?.kind === 'experience') {
      return Array.isArray(result.cards) && result.cards.length === chapterNames.length &&
        result.cards.every((item) => typeof item?.title === 'string' && typeof item.text === 'string');
    }
    return result && Object.hasOwn(replyTitles, result.kind) && typeof result.message === 'string';
  }

  async function send(context, tradition) {
    if (request) return;
    const controller = new AbortController();
    request = controller;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    clearError();
    clearReading();
    if (!tradition) {
      choiceContext = null;
      if (!reply.classList.contains('wisdom-reply-safety')) clearReply();
    }
    setPending(true);

    try {
      const payload = tradition ? { ...context, tradition } : context;
      const response = await fetch('/api/wisdom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Wisdom request failed');
      const result = await response.json();
      if (!validResult(result)) throw new Error('Unexpected Wisdom response');
      if (request !== controller) return;

      if (!tradition) {
        history = [...history, context.message].slice(-6);
        input.value = '';
      }
      choiceContext = result.kind === 'choose_tradition' ? context : null;
      clearReply();
      composer.after(responsePanel);
      if (result.kind === 'experience') {
        cards = result.cards;
        showCard();
      } else {
        showReply(result);
      }
    } catch {
      if (request !== controller) return;
      showError(tradition
        ? 'The local demo couldn’t load that reflection. Choose a source again to retry.'
        : 'The local demo couldn’t respond. Your draft is still here. Check that Studygram is running, then select Continue to retry.');
    } finally {
      window.clearTimeout(timer);
      if (request === controller) {
        request = null;
        setPending(false);
      }
    }
  }

  function reset(focusInput) {
    const pending = request;
    request = null;
    pending?.abort();
    history = [];
    choiceContext = null;
    input.value = '';
    clearError();
    clearReading();
    clearReply();
    composer.after(responsePanel);
    element('urgent-help').open = false;
    composer.hidden = false;
    examples.hidden = false;
    setPending(false);
    showPreview();
    if (focusInput) input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) {
      showError('Write a few words or try one of the samples.', true);
      return;
    }
    send({ message, history });
  });
  input.addEventListener('input', clearError);
  for (const button of sampleButtons) {
    button.addEventListener('click', () => {
      input.value = button.dataset.example;
      clearError();
      input.focus();
    });
  }
  for (const button of choiceButtons) {
    button.addEventListener('click', () => {
      if (choiceContext) send(choiceContext, button.dataset.tradition);
    });
  }
  previous.addEventListener('click', () => {
    chapter -= 1;
    showCard();
  });
  next.addEventListener('click', () => {
    chapter += 1;
    showCard();
  });
  narration.addEventListener('click', toggleNarration);
  synth?.addEventListener('voiceschanged', updateAudio);
  resetButton.addEventListener('click', () => reset(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopNarration();
  });
  window.addEventListener('pagehide', () => reset(false));
  input.disabled = false;
  resetButton.disabled = false;
  reset(false);
})();
