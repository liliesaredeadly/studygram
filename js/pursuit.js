(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(function pursuit() {
  "use strict";

  const root = document.getElementById("pursuit-content");
  const dialog = document.getElementById("pursuit-dialog");
  const catalogue = typeof PURSUIT_CATALOG === "undefined" ? [] : PURSUIT_CATALOG;
  const store = typeof PursuitStore === "undefined" ? null : PursuitStore;
  const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const logKinds = { practice: "Practice", learning: "Learning", reflection: "Reflection" };
  const privacy = "Your pursuits, answers, and activity are saved in your Studygram account. Sign out when you’re done on a shared device. Public source lookup sends the interest label to Wikipedia. Optional adult AI sends the interest and interview answers to Meta through Studygram. Use broad topic names and leave out names, schools, addresses, and other personal details.";
  const featureLabels = [
    ["Sports", "Football, athletics, and more"],
    ["Fashion", "Design, styling, and making"],
    ["Performance", "Stage, music, and movement"],
    ["Business", "Ideas, teams, and enterprises"],
    ["Creative arts", "Drawing, writing, and visual craft"],
    ["STEM", "Science, engineering, and technology"],
    ["Public service", "Civic life and community work"]
  ];
  let view = "home";
  let step = 0;
  let returnView = "discover";
  let editDraft = null;
  let notice = "";
  let publicSources = null;
  let sourceError = "";
  let companion = null;
  let pendingRequest = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function active(state = store.load()) {
    return state.journeys.find(item => item.id === state.activeId) || null;
  }

  function entry(journey) {
    return catalogue.find(item => item.id === journey.catalogId);
  }

  function updateJourney(id, change) {
    return store.update(state => {
      const journey = state.journeys.find(item => item.id === id);
      if (journey) change(journey);
    });
  }

  function httpURL(value) {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function sources(items) {
    const links = (items || []).map(item => {
      const url = httpURL(item.url);
      if (!url) return "";
      return `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || url)}</a>${item.description ? `<p>${esc(item.description)}</p>` : ""}</li>`;
    }).filter(Boolean);
    return links.length ? `<ul>${links.join("")}</ul>` : "";
  }

  function asList(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
  }

  function list(items) {
    const rows = asList(items);
    return rows.length ? `<ul>${rows.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
  }

  function tags(items) {
    const rows = asList(items);
    return rows.length ? `<div class="p-tags">${rows.map(item => `<span class="p-tag">${esc(item)}</span>`).join("")}</div>` : "";
  }

  function topbar(journey) {
    const main = view === "dashboard" && journey ? ["← Field notes", "discover"] : ["← All interests", "home"];
    return `<div class="p-subnav"><button type="button" class="p-text-button" data-action="${main[1]}">${main[0]}</button>
      ${view !== "dashboard" ? '<button type="button" class="p-text-button" data-action="dashboard">My Pursuit ↗</button>' : ""}</div>`;
  }

  function heading(kicker, title, description = "") {
    return `<header class="p-view-header"><p class="p-kicker">${esc(kicker)}</p><h1 class="p-title" tabindex="-1">${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</header>`;
  }

  function heroArt() {
    return `<svg class="p-hero-art" viewBox="0 0 620 500" aria-hidden="true" focusable="false">
      <defs><radialGradient id="p-glow"><stop stop-color="#d4a4f0" stop-opacity=".4"/><stop offset="1" stop-color="#d4a4f0" stop-opacity="0"/></radialGradient>
        <pattern id="p-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#d8b8e8" opacity=".24"/></pattern></defs>
      <path fill="url(#p-dots)" d="M0 0h620v500H0z"/><circle cx="337" cy="254" r="185" fill="url(#p-glow)"/>
      <g fill="none" stroke="currentColor"><circle cx="337" cy="254" r="164" opacity=".32"/><circle cx="337" cy="254" r="123" opacity=".42"/>
        <circle cx="337" cy="254" r="79" opacity=".5"/><circle cx="337" cy="254" r="201" stroke-dasharray="2 8" opacity=".5"/>
        <ellipse cx="337" cy="254" rx="234" ry="83" transform="rotate(-29 337 254)" opacity=".81"/>
        <ellipse cx="337" cy="254" rx="219" ry="75" transform="rotate(34 337 254)" opacity=".5"/>
        <path d="M337 22v454M91 254h492" stroke-dasharray="2 8" opacity=".65"/></g>
      <g fill="currentColor"><path d="M337 209c4 30 15 41 45 45-30 4-41 15-45 45-4-30-15-41-45-45 30-4 41-15 45-45Z"/>
        <path d="M483 97c2 15 8 21 23 23-15 2-21 8-23 23-2-15-8-21-23-23 15-2 21-8 23-23Z" opacity=".9"/>
        <path d="M186 328c1 9 5 13 14 14-9 1-13 5-14 14-1-9-5-13-14-14 9-1 13-5 14-14Z" opacity=".7"/>
        <circle cx="195" cy="183" r="4"/><circle cx="472" cy="350" r="5"/><circle cx="269" cy="401" r="3"/></g>
    </svg>`;
  }

  function fieldIcon(id) {
    const paths = {
      sports: '<path d="M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0Zm0 2H4v2a4 4 0 0 0 3 4m10-6h3v2a4 4 0 0 1-3 4"/>',
      fashion: '<path d="m9 4-5 2-2 4 4 2 1-2v10h10V10l1 2 4-2-2-4-5-2a3 3 0 0 1-6 0Z"/>',
      performance: '<path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="17" rx="3" ry="2.5"/><ellipse cx="17" cy="15" rx="3" ry="2.5"/>',
      business: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12a24 24 0 0 0 18 0m-9 1v3"/>',
      arts: '<path d="M21 12a9 9 0 1 0-9 9c2 0 3-1 2-2.5-.8-1.4.1-2.5 1.5-2.5H17a4 4 0 0 0 4-4Z"/><path d="M7 12h.01M9 8h.01m5-1h.01m3 4h.01" stroke-width="2.8"/>',
      stem: '<path d="M9 3h6m-5 0v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8"/>',
      "public-service": '<path d="M12 22V12m0 7-6-4m6 1 5-4M8 17H6a3 3 0 0 1-2-5.2A4 4 0 0 1 8.8 6a4 4 0 0 1 7.9 1 4 4 0 0 1 2.2 7.7"/>',
      custom: '<path d="M12 5v14M5 12h14"/>'
    };
    return `<span class="p-feature-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[id] || paths.custom}</svg></span>`;
  }

  function home(journey) {
    const featured = catalogue.slice(0, 7).map((item, index) => {
      const label = featureLabels[index];
      return `<button type="button" class="p-feature" data-action="featured" data-topic="${esc(item.title)}">
        <span class="p-feature-meta">${fieldIcon(item.id)}<span class="p-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></span>
        <span class="p-feature-title">${esc(label?.[0] || item.title)}</span><span class="p-feature-description">${esc(label?.[1] || item.title)}</span></button>`;
    }).join("");
    return `<section class="p-hero">
      ${heroArt()}
      <div class="p-shell p-hero-inner"><div class="p-hero-copy">
        <p class="p-kicker">Studygram field guide / 01</p>
        <h1 tabindex="-1">The <em>Pursuit</em></h1>
        <p class="p-hero-description">Follow what fascinates you. Meet the people shaping it, find your starting point, and make a plan you can live with.</p>
        <form class="p-hero-form" data-form="interest" method="post"><label class="p-visually-hidden" for="p-interest">What would you like to get better at?</label>
          <input id="p-interest" name="interest" placeholder="What would you like to get better at?" maxlength="100" required>
          <button type="submit" class="p-button p-button-light">Explore <span aria-hidden="true">↗</span></button></form>
        <p class="p-hero-note">Start with any interest. ${journey ? '<a href="#my-pursuit" data-action="dashboard">Open My Pursuit</a>' : "You can make a plan at your own pace."}</p>
      </div></div>
      <span class="p-art-label" aria-hidden="true">Fig. 01 / A point of curiosity</span>
    </section>
    <section class="p-shell p-section" aria-labelledby="p-feature-heading">
      <header class="p-section-header"><div><p class="p-kicker">Starting points</p><h2 class="p-section-title" id="p-feature-heading">Explore the fields</h2></div>
        <p>Start with a field guide below, or bring a pursuit of your own.</p></header>
      <div class="p-feature-grid">${featured}<button type="button" class="p-feature p-feature-custom" data-action="custom">
        <span class="p-feature-meta">${fieldIcon("custom")}<span class="p-index" aria-hidden="true">Open</span></span>
        <span class="p-feature-title">Your own interest</span><span class="p-feature-description">Type any topic to make it yours</span></button></div>
    </section>
    <section class="p-band" id="my-pursuit"><div class="p-shell p-band-inner">
      <div><p class="p-kicker">Your working journal</p><h2 class="p-section-title">My Pursuit</h2>
        <p>Return to your plan, log what you tried, and see how your week is taking shape.</p></div>
      <button type="button" class="p-button p-button-light" data-action="dashboard">Open My Pursuit <span aria-hidden="true">↗</span></button>
    </div></section>`;
  }

  function people(items) {
    return (items || []).map(person => `<article class="p-person">
      <p class="p-kicker">Sourced profile</p><h3>${esc(person.name)}</h3><p>${esc(person.summary)}</p>${list(person.milestones)}
      ${person.takeaway ? `<p class="p-idea"><strong>Put the idea into practice</strong><br>${esc(person.takeaway)}</p>` : ""}
      ${sources(person.sources) ? `<details><summary>Profile sources</summary>${sources(person.sources)}</details>` : ""}
    </article>`).join("");
  }

  function sourcePanel(journey, item) {
    const results = publicSources?.id === journey.id ? sources(publicSources.items) : "";
    const wikiURL = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(journey.interest)}`;
    return `<section class="p-panel" data-pursuit-sources><h2>Read further</h2>${sources(item?.sources)}
      <p class="p-hint">Look up Wikipedia research leads for the public topic “${esc(journey.interest)}”. Use linked references to verify what you find. This sends the interest label to Wikipedia when you choose to search.</p>
      <div class="p-actions"><button type="button" class="p-button p-button-outline" data-action="sources"${pendingRequest ? " disabled" : ""}>${pendingRequest?.kind === "sources" ? "Looking up sources…" : "Look up public sources"}</button>
        <a href="${esc(wikiURL)}" target="_blank" rel="noopener noreferrer">Search Wikipedia ↗</a></div>
      <div aria-live="polite">${results}${sourceError ? `<p class="p-error">${esc(sourceError)}</p>` : ""}</div>
    </section>`;
  }

  function discovery(journey) {
    const item = entry(journey);
    const profiles = people(item?.people);
    const starter = item?.starter || "Choose one small part of the interest to try this week. Look for a beginner explanation from a library, educator, or relevant organization, then spend five minutes testing a basic skill.";
    return `<div class="p-shell p-view-space">${topbar(journey)}
      ${heading("01 / Field notes", journey.interest, item?.overview || "Make this a working field guide. Map the parts of the field that interest you and start with something small enough to try this week.")}
      <div class="p-page-grid"><div class="p-stack">
        <section class="p-panel"><h2>Inside the field</h2>
          <div class="p-card-list">${(item?.topics || []).map(topic => `<div class="p-topic"><h3>${esc(topic.title)}</h3><p>${esc(topic.text)}</p></div>`).join("") || '<p>Look for the field’s basic vocabulary, the people and tools involved, and one example you can examine closely.</p>'}</div>
          ${tags(item?.skills)}
        </section>
        ${profiles ? `<section class="p-panel"><h2>People worth studying</h2><div class="p-card-list">${profiles}</div></section>` : ""}
        ${item?.routes?.length ? `<section class="p-panel"><h2>Ways in</h2><div class="p-card-list">${item.routes.map(route => `<div class="p-topic"><h3>${esc(route.title)}</h3><p>${esc(route.text)}</p></div>`).join("")}</div></section>` : ""}
        ${sourcePanel(journey, item)}
        ${journey.answers.ageBand === "18-plus" ? companionPanel(journey, true) : ""}
      </div><aside class="p-stack">
        <section class="p-panel p-panel-tint"><p class="p-kicker">02 / Make it yours</p><h2>Your starting point</h2><p>${esc(starter)}</p>
          <div class="p-actions"><button type="button" class="p-button" data-action="${journey.plan ? "dashboard" : "interview"}">${journey.plan ? "Open my plan" : "Find my starting point"} <span aria-hidden="true">→</span></button></div></section>
        ${studyLinks(journey, item)}
      </aside></div>
    </div>`;
  }

  function exploreCategory(journey, item) {
    if (typeof EXPLORE_HUMANITIES === "undefined" || typeof EXPLORE_STEM === "undefined") return null;
    const label = journey.interest;
    const mappings = {
      fashion: "arts",
      performance: /\b(?:theatre|theater|acting|dance|dancer)\b/i.test(label) ? null : "music",
      arts: /\b(?:writ\w*|poetry|literature|storytell\w*)\b/i.test(label) ? "literature" : "arts",
      stem: /\b(?:cod\w*|program\w*|robot\w*|software|ai|technology)\b/i.test(label) ? "technology" : "science",
      "public-service": /\b(?:defen[cs]e|army|navy|air force|military)\b/i.test(label) ? "defence" : null
    };
    const id = item?.exploreCategory || mappings[item?.id];
    return [...EXPLORE_HUMANITIES, ...EXPLORE_STEM].find(category => category.id === id);
  }

  function studyLinks(journey, item) {
    const actions = typeof ExploreActions === "undefined" ? null : ExploreActions;
    const category = exploreCategory(journey, item);
    const studyTopic = encodeURIComponent(journey.interest);
    return `<section class="p-panel"><h2>Keep exploring</h2><div class="p-actions">
      ${category && actions?.openLesson ? '<button type="button" class="p-button p-button-outline" data-action="learn">Learn</button>' : `<a class="p-button p-button-outline" href="study.html?topic=${studyTopic}">Learn</a>`}
      ${category && actions?.openQuiz ? '<button type="button" class="p-button p-button-outline" data-action="quiz">Quiz</button>' : '<a class="p-button p-button-outline" href="quiz.html">Quiz</a>'}
      <a class="p-button p-button-outline" href="wisdom.html">Mindset &amp; Wisdom</a>
      <a class="p-button p-button-outline" href="growth.html">Growth &amp; Power Words</a>
      <a class="p-button p-button-outline" href="diary.html">Diary</a>
      <a class="p-button p-button-outline" href="explore.html">Explore</a>
    </div></section>`;
  }

  function interview(journey) {
    const current = editDraft?.id === journey.id ? { ...journey, answers: editDraft.answers } : journey;
    const questions = store.questions(current);
    const question = questions[step];
    if (!question) return discovery(journey);
    const answer = current.answers[question.key] ?? "";
    const index = step + 1;
    const hasOptions = question.options?.length > 0;
    const questionControl = hasOptions ? `<fieldset class="p-options"><legend class="p-visually-hidden">${esc(question.question)}</legend>
      ${question.options.map(option => `<label class="p-option"><input type="radio" name="answer" value="${esc(option.value)}" ${String(option.value) === String(answer) ? "checked" : ""} required><span>${esc(option.label)}</span></label>`).join("")}</fieldset>`
      : `<label for="p-answer" class="p-question-label">Your answer</label>
      <textarea class="p-text-input" id="p-answer" name="answer" maxlength="240" rows="3" placeholder="${esc(question.placeholder || "")}" required>${esc(answer)}</textarea>
      ${question.suggestions?.length ? `<div class="p-actions" aria-label="Answer suggestions">${question.suggestions.map(suggestion => `<button type="button" class="p-chip" data-action="suggestion" data-value="${esc(suggestion)}">${esc(suggestion)}</button>`).join("")}</div>` : ""}`;
    return `<div class="p-narrow p-interview">
      <div class="p-subnav"><button type="button" class="p-text-button" data-action="exit-interview">← ${returnView === "dashboard" ? "My Pursuit" : "Field notes"}</button></div>
      ${heading(`02 / Your starting point · ${index} of ${questions.length}`, question.question)}
      <div class="p-progress-track" aria-hidden="true"><span style="width:${index / questions.length * 100}%"></span></div>
      <form class="p-panel" data-form="answer" method="post">
        ${questionControl}
        <p class="p-hint">${editDraft ? "Changes are saved when you rebuild your plan." : "Answers are saved in your Studygram account."} Keep personal details out of your responses.</p>
        <div class="p-question-actions">
          ${step > 0 ? '<button type="button" class="p-button p-button-outline" data-action="previous">← Previous</button>' : "<span></span>"}
          <button type="submit" class="p-button">${index === questions.length ? "Build my plan" : "Continue"} <span aria-hidden="true">→</span></button>
        </div>
      </form>
    </div>`;
  }

  function plan(journey) {
    const data = journey.plan;
    if (!data) {
      return `<section class="p-panel p-panel-tint"><h2>Build your plan</h2><p>A few questions about your goal, time, and resources will help you choose your next steps.</p><div class="p-actions"><button type="button" class="p-button" data-action="interview">Continue the interview →</button></div></section>`;
    }
    const labels = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]];
    return `<section class="p-panel"><p class="p-kicker">03 / Action plan</p><h2>${journey.planSource === "ai" ? "Your AI-assisted practice plan" : "Your practice plan"}</h2>
      <div class="p-plan-grid">${labels.map(([key, label]) => `<article class="p-plan-card"><h3>${label}</h3>${Array.isArray(data[key]) ? list(data[key]) : `<p>${esc(data[key])}</p>`}</article>`).join("")}</div>
      <div class="p-actions"><button type="button" class="p-button p-button-outline" data-action="edit">Edit goal and answers</button></div>
      ${data.safety ? `<p class="p-hint"><strong>Make it sustainable.</strong> ${esc(asList(data.safety).join(" "))}</p>` : ""}
    </section>`;
  }

  function chart(week) {
    const max = Math.max(1, ...week.map(day => Number(day.minutes) || 0));
    return `<ul class="p-chart" aria-label="Activity minutes over the last seven days">${week.map(day => {
      const minutes = Number(day.minutes) || 0;
      return `<li><span>${minutes}<span class="p-visually-hidden"> minutes</span></span><span class="p-chart-track" aria-hidden="true"><span style="--bar-height:${Math.max(0, minutes / max * 100)}%"></span></span><span>${esc(day.label)}</span></li>`;
    }).join("")}</ul>`;
  }

  function dateLabel(at) {
    const value = new Date(at);
    return Number.isNaN(value.getTime()) ? "" : dayFormat.format(value);
  }

  function logbook(journey, progress) {
    const logs = [...journey.logs].sort((first, second) => new Date(second.at) - new Date(first.at)).slice(0, 8);
    return `<section class="p-panel"><h2>Your week in minutes</h2>${chart(progress.week)}
      ${progress.week.some(day => day.minutes) ? "" : '<p class="p-hint">Your weekly chart fills in when you log an activity.</p>'}</section>
    <section class="p-panel"><h2>Log an activity</h2>
      <form data-form="activity" method="post"><div class="p-form-row">
        <div class="p-field"><label for="p-log-kind">Activity</label><select id="p-log-kind" name="kind">${Object.entries(logKinds).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
        <div class="p-field"><label for="p-log-minutes">Minutes</label><input id="p-log-minutes" name="minutes" type="number" min="1" max="720" value="15" required></div>
      </div><div class="p-field"><label for="p-log-note">What did you work on?</label><textarea id="p-log-note" name="note" maxlength="500" placeholder="Add a note, if you’d like."></textarea></div>
        <button class="p-button" type="submit">Save activity</button>
      </form></section>
    <section class="p-panel"><h2>Recent activity</h2>
      ${logs.length ? `<ul class="p-log">${logs.map(log => `<li><strong>${esc(logKinds[log.kind] || "Activity")}</strong> <small>${esc(dateLabel(log.at))} · ${esc(log.minutes)} min</small>${log.note ? `<p>${esc(log.note)}</p>` : ""}</li>`).join("")}</ul>` : '<p class="p-empty">Your practice, learning, and reflection notes will appear here.</p>'}</section>`;
  }

  function milestones(journey, item) {
    const milestone = asList(journey.plan?.milestone).join(" ");
    const challenges = asList(item?.challenges);
    return `<section class="p-panel"><h2>Skills to build</h2>${tags(journey.plan?.skills || item?.skills) || '<p class="p-empty">Your plan will suggest skills to practice.</p>'}</section>
      <section class="p-panel"><h2>Challenges &amp; milestones</h2>
      ${challenges.map((label, index) => `<label class="p-option"><input type="checkbox" data-challenge="${index}" ${journey.completedChallenges?.includes(label) ? "checked" : ""}><span>${esc(label)}</span></label>`).join("")}
      ${milestone ? `<label class="p-option p-milestone"><input type="checkbox" data-milestone ${journey.milestoneDone ? "checked" : ""}><span><strong>Plan milestone</strong><br>${esc(milestone)}</span></label>` : '<p class="p-empty">Build a plan to choose a milestone.</p>'}</section>`;
  }

  function companionPanel(journey, isDiscovery = false) {
    const data = companion?.id === journey.id ? companion : null;
    const busy = pendingRequest?.kind;
    return `<section class="p-panel" data-pursuit-companion><h2>Optional AI companion</h2>
      <p class="p-hint">These actions send your interest and interview answers to Meta through Studygram. Keep personal details out of your answers.</p>
      <div class="p-actions">${isDiscovery
        ? `<button class="p-button p-button-outline" type="button" data-action="ai-discover"${busy ? " disabled" : ""}>${busy === "discover" ? "Asking AI…" : "Ask AI to explain this field"}</button>`
        : `<button class="p-button p-button-outline" type="button" data-action="ai-question"${busy ? " disabled" : ""}>${busy === "follow-up" ? "Asking AI…" : "Ask AI for a follow-up"}</button>
          <button class="p-button p-button-outline" type="button" data-action="ai-plan"${busy ? " disabled" : ""}>${busy === "plan" ? "Building an AI draft…" : "Draft a plan with AI"}</button>`}</div>
      ${data?.error ? `<p class="p-error" role="status">${esc(data.error)}</p>` : ""}
      ${data?.explanation && isDiscovery ? `<div class="p-idea"><strong>AI explanation</strong><p>${esc(data.explanation.overview)}</p>${list(data.explanation.avenues)}</div>` : ""}
      ${data?.question && !isDiscovery ? `<form class="p-field" data-form="detail" method="post"><label for="p-detail">${esc(data.question)}</label><textarea id="p-detail" name="detail" maxlength="240" required>${esc(journey.answers.detail || "")}</textarea><div class="p-actions"><button class="p-button p-button-outline" type="submit">Save answer</button></div></form>` : ""}
      ${data?.draft && !isDiscovery ? `<div class="p-idea"><strong>AI draft</strong>${["daily", "weekly", "monthly"].map(key => `<h3>${key[0].toUpperCase() + key.slice(1)}</h3>${list(data.draft[key])}`).join("")}
        ${data.draft.milestone ? `<p><strong>Milestone.</strong> ${esc(asList(data.draft.milestone).join(" "))}</p>` : ""}
        ${data.draft.safety ? `<p><strong>Safety and recovery.</strong> ${esc(asList(data.draft.safety).join(" "))}</p>` : ""}
        <div class="p-actions"><button class="p-button" type="button" data-action="apply-draft">Use this AI draft</button><button class="p-text-button" type="button" data-action="dismiss-draft">Dismiss draft</button></div></div>` : ""}
    </section>`;
  }

  function dashboard(journey, state) {
    if (!journey) {
      return `<div class="p-shell p-view-space">${topbar(null)}${heading("Your working journal", "My Pursuit")}
        <section class="p-panel"><h2>Start a pursuit</h2><p>Choose an interest to build a plan and start tracking what you try.</p><div class="p-actions"><button type="button" class="p-button" data-action="home">Explore the fields →</button></div></section></div>`;
    }
    const logs = journey.logs.map(log => typeof log.at === "string" ? { ...log, at: Date.parse(log.at) } : log);
    const progress = store.progress({ ...journey, logs });
    const item = entry(journey);
    const switcher = state.journeys.length > 1 ? `<div class="p-field"><label for="p-switch">Your saved pursuits</label><select id="p-switch" data-switch>${state.journeys.map(other => `<option value="${esc(other.id)}" ${other.id === journey.id ? "selected" : ""}>${esc(other.interest)}</option>`).join("")}</select></div>` : "";
    return `<div class="p-shell p-view-space">${topbar(journey)}${heading("Your working journal / My Pursuit", journey.interest, journey.answers.goal ? `Current goal · ${journey.answers.goal}` : "Build a plan and keep a record of what you try.")}
      <p class="p-visually-hidden" role="status">${esc(notice)}</p>
      <div class="p-stat-grid p-dashboard-section">
        <div class="p-stat"><strong>${progress.minutes}</strong><span>Minutes logged</span></div>
        <div class="p-stat"><strong>${progress.days}</strong><span>Active days</span></div>
        <div class="p-stat"><strong>${progress.activities}</strong><span>Activities logged</span></div>
      </div>
      <div class="p-page-grid"><div class="p-stack">
        ${plan(journey)}${logbook(journey, progress)}
        ${journey.plan && journey.answers.ageBand === "18-plus" ? companionPanel(journey) : ""}
      </div><aside class="p-stack">
        <section class="p-panel p-panel-tint"><h2>Your pursuits</h2>${switcher}<div class="p-actions"><button type="button" class="p-button p-button-outline" data-action="home">Start another interest</button></div></section>
        ${milestones(journey, item)}${studyLinks(journey, item)}
      </aside></div></div>`;
  }

  function render({ focus = false } = {}) {
    const state = store.load();
    const journey = active(state);
    if (view === "discover" || view === "interview") {
      if (!journey) view = "home";
    }
    const templates = { home, discover: discovery, interview, dashboard };
    root.innerHTML = templates[view](journey, state);
    if (focus) root.querySelector("h1")?.focus();
  }

  function go(next, replace = false) {
    pendingRequest = null;
    view = next;
    if (replace) history.replaceState({ pursuit: view }, "");
    else history.pushState({ pursuit: view }, "");
    render({ focus: true });
    window.scrollTo(0, 0);
  }

  function begin(value) {
    const interest = String(value).trim();
    if (!interest) return;
    const state = store.load();
    const previous = active(state);
    const existing = state.journeys.find(item => item.interest.toLocaleLowerCase() === interest.toLocaleLowerCase());
    const current = existing || store.create(interest);
    if (existing && previous?.id !== existing.id) {
      store.update(saved => { saved.activeId = existing.id; });
    }
    if (previous?.id !== current.id) {
      publicSources = null;
      companion = null;
      sourceError = "";
    }
    notice = "";
    go("discover");
  }

  function startInterview(journey, edit = false) {
    if (!journey) return;
    editDraft = edit ? { id: journey.id, answers: { ...journey.answers } } : null;
    const questions = store.questions(journey);
    const firstUnanswered = questions.findIndex(question => !String(journey.answers[question.key] ?? "").trim());
    step = edit || firstUnanswered < 0 ? 0 : firstUnanswered;
    returnView = view === "dashboard" ? "dashboard" : "discover";
    go("interview");
  }

  function showDialog(title, body) {
    dialog.innerHTML = `<button class="p-close" type="button" data-action="close-dialog" aria-label="Close">×</button><h2 id="pursuit-dialog-title">${esc(title)}</h2>${body}`;
    if (!dialog.open) dialog.showModal();
  }

  function renderRequestPanels(journey, focusAction) {
    const focused = document.activeElement;
    const source = root.querySelector('[data-pursuit-sources]');
    if (source) source.outerHTML = sourcePanel(journey, entry(journey));

    const panel = root.querySelector('[data-pursuit-companion]');
    if (panel) {
      const answer = panel.querySelector('#p-detail');
      const question = panel.querySelector('label[for="p-detail"]')?.textContent;
      panel.outerHTML = companionPanel(journey, view === 'discover');
      const updated = root.querySelector('#p-detail');
      if (answer && updated && root.querySelector('label[for="p-detail"]')?.textContent === question) {
        updated.value = answer.value;
        if (focused === answer) {
          updated.focus();
          updated.setSelectionRange(answer.selectionStart, answer.selectionEnd, answer.selectionDirection);
        }
      }
    }
    if (focusAction && focused === document.body) root.querySelector(`[data-action="${focusAction}"]`)?.focus();
  }

  async function research(journey) {
    if (!journey || pendingRequest) return;
    const request = { kind: 'sources' };
    pendingRequest = request;
    publicSources = null;
    sourceError = "";
    renderRequestPanels(journey);
    try {
      const result = await requestStudygramAI("pursuit-sources", { interest: journey.interest });
      if (pendingRequest !== request || active()?.id !== journey.id) return;
      const items = Array.isArray(result?.sources) ? result.sources : [];
      publicSources = { id: journey.id, items };
      if (!items.length) sourceError = "No source leads came back. Try the Wikipedia search link.";
    } catch {
      if (pendingRequest === request && active()?.id === journey.id) sourceError = "Source lookup is unavailable. You can use the Wikipedia search link.";
    } finally {
      if (pendingRequest === request) {
        pendingRequest = null;
        if (active()?.id === journey.id) renderRequestPanels(journey, 'sources');
      }
    }
  }

  async function askAI(journey, kind) {
    if (pendingRequest || journey?.answers.ageBand !== "18-plus") return;
    const request = { kind };
    pendingRequest = request;
    const existing = companion?.id === journey.id ? companion : { id: journey.id };
    companion = { ...existing, error: "" };
    renderRequestPanels(journey);
    try {
      const data = await requestStudygramAI("pursuit", {
        kind,
        interest: journey.interest,
        catalogId: journey.catalogId,
        answers: { ...journey.answers, ageBand: "adult" },
        ...(kind === "plan" && existing.question ? { question: existing.question } : {})
      });
      if (pendingRequest !== request || active()?.id !== journey.id) return;
      if (kind === "follow-up" && typeof data?.question === "string") companion.question = data.question;
      else if (kind === "plan" && data?.daily && data?.weekly && data?.monthly) companion.draft = data;
      else if (kind === "discover" && typeof data?.overview === "string") companion.explanation = data;
      else throw new Error("Unexpected AI response");
    } catch {
      if (pendingRequest === request && active()?.id === journey.id) companion.error = "The AI companion is unavailable. Your local plan is still available.";
    } finally {
      if (pendingRequest === request) {
        pendingRequest = null;
        const action = { "follow-up": "ai-question", plan: "ai-plan", discover: "ai-discover" }[kind];
        if (active()?.id === journey.id) renderRequestPanels(journey, action);
      }
    }
  }

  async function handleAction(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    event.preventDefault();
    const journey = active();
    const item = journey ? entry(journey) : null;
    switch (trigger.dataset.action) {
      case "home": go("home"); break;
      case "discover": go("discover"); break;
      case "dashboard": notice = ""; go("dashboard"); break;
      case "featured": begin(trigger.dataset.topic); break;
      case "custom": document.getElementById("p-interest")?.focus(); break;
      case "interview": startInterview(journey); break;
      case "edit": startInterview(journey, true); break;
      case "exit-interview": editDraft = null; go(returnView); break;
      case "previous": step = Math.max(0, step - 1); render({ focus: true }); break;
      case "suggestion": {
        const field = document.getElementById("p-answer");
        field.value = trigger.dataset.value;
        field.focus();
        break;
      }
      case "privacy":
        showDialog("Pursuit privacy", `<p>${esc(privacy)}</p><div class="p-actions"><button class="p-button p-button-outline" type="button" data-action="close-dialog">Done</button><button class="p-text-button" type="button" data-action="confirm-clear">Clear Pursuit data</button></div>`);
        break;
      case "confirm-clear":
        showDialog("Clear your Pursuit data?", '<p>This deletes your saved interests, answers, plans, challenges, and logs from your Studygram account.</p><div class="p-actions"><button class="p-button p-button-outline" type="button" data-action="close-dialog" autofocus>Keep my data</button><button class="p-button p-danger" type="button" data-action="clear">Clear Pursuit data</button></div>');
        dialog.querySelector("[autofocus]")?.focus();
        break;
      case "clear":
        trigger.disabled = true;
        try {
          store.clear();
          await Storage.flush();
        } catch {
          trigger.disabled = false;
          return;
        }
        publicSources = null;
        companion = null;
        editDraft = null;
        notice = "";
        sourceError = "";
        dialog.close();
        go("home", true);
        break;
      case "close-dialog": dialog.close(); break;
      case "sources": research(journey); break;
      case "ai-question": askAI(journey, "follow-up"); break;
      case "ai-plan": askAI(journey, "plan"); break;
      case "ai-discover": askAI(journey, "discover"); break;
      case "dismiss-draft":
        if (companion) companion.draft = null;
        render();
        root.querySelector('[data-action="ai-plan"]')?.focus();
        break;
      case "apply-draft":
        if (companion?.id === journey?.id && companion?.draft && journey.answers.ageBand === "18-plus") {
          updateJourney(journey.id, current => {
            current.plan = companion.draft;
            current.planSource = "ai";
            current.milestoneDone = false;
          });
          companion.draft = null;
          notice = "AI draft saved as your plan.";
          render({ focus: true });
        }
        break;
      case "learn":
      case "quiz": {
        const category = journey ? exploreCategory(journey, item) : null;
        if (category) {
          if (trigger.dataset.action === "learn") ExploreActions.openLesson(category);
          else ExploreActions.openQuiz(category);
        }
        break;
      }
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);
    if (form.dataset.form === "interest") {
      const label = String(values.get("interest") || "").trim();
      if (label) begin(label);
      else {
        const field = form.querySelector("input");
        field.value = "";
        field.reportValidity();
      }
      return;
    }

    const journey = active();
    if (!journey) return;
    if (form.dataset.form === "answer") {
      const draft = editDraft?.id === journey.id ? editDraft.answers : null;
      const questions = store.questions(draft ? { ...journey, answers: draft } : journey);
      const question = questions[step];
      const value = String(values.get("answer") ?? "").trim();
      if (!value) {
        const field = form.querySelector("textarea");
        if (field) {
          field.value = "";
          field.reportValidity();
        }
        return;
      }
      const last = step >= questions.length - 1;
      if (draft) draft[question.key] = value;
      if (!draft || last) {
        updateJourney(journey.id, current => {
          current.answers = { ...current.answers, ...(draft || {}), [question.key]: value };
          if (last) {
            if (current.answers.ageBand !== "18-plus") delete current.answers.detail;
            const plan = store.makePlan(current);
            if (asList(current.plan?.milestone).join(" ") !== asList(plan.milestone).join(" ")) current.milestoneDone = false;
            current.plan = plan;
            current.planSource = "local";
          }
        });
      }
      if (last) {
        editDraft = null;
        companion = null;
        notice = "Your practice plan was saved.";
        go("dashboard");
      } else {
        step++;
        render({ focus: true });
      }
    } else if (form.dataset.form === "activity") {
      const minutes = Number(values.get("minutes"));
      const kind = String(values.get("kind"));
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720 || !Object.hasOwn(logKinds, kind)) return;
      const log = {
        id: globalThis.crypto?.randomUUID?.() || `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        minutes,
        kind,
        note: String(values.get("note") ?? "").trim()
      };
      updateJourney(journey.id, current => current.logs.push(log));
      notice = `${logKinds[kind]} logged for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
      render();
      root.querySelector("#p-log-kind")?.focus();
    } else if (form.dataset.form === "detail" && journey.answers.ageBand === "18-plus") {
      const detail = String(values.get("detail") ?? "").trim();
      if (!detail) {
        const field = form.querySelector("textarea");
        field.value = "";
        field.reportValidity();
        return;
      }
      updateJourney(journey.id, current => { current.answers.detail = detail; });
      if (companion) companion.question = null;
      notice = "Your follow-up answer was added to your Pursuit.";
      render();
      root.querySelector('[data-action="ai-plan"]')?.focus();
    }
  }

  function handleChange(event) {
    const control = event.target;
    if (control.matches("[data-switch]")) {
      store.update(state => { state.activeId = control.value; });
      pendingRequest = null;
      notice = "";
      render({ focus: true });
      return;
    }
    const journey = active();
    if (!journey) return;
    if (control.matches("[data-challenge]")) {
      const label = entry(journey)?.challenges?.[Number(control.dataset.challenge)];
      if (!label) return;
      updateJourney(journey.id, current => {
        const currentChallenges = current.completedChallenges || [];
        current.completedChallenges = control.checked ? [...new Set([...currentChallenges, label])] : currentChallenges.filter(challenge => challenge !== label);
      });
    } else if (control.matches("[data-milestone]")) {
      updateJourney(journey.id, current => { current.milestoneDone = control.checked; });
    }
  }

  if (!root || !store) {
    if (root) root.innerHTML = '<p class="p-shell p-noscript">The Pursuit could not load. Refresh this page to try again.</p>';
    return;
  }
  document.addEventListener("click", handleAction);
  root.addEventListener("submit", handleSubmit);
  root.addEventListener("change", handleChange);
  window.addEventListener("popstate", event => {
    pendingRequest = null;
    view = ["home", "discover", "interview", "dashboard"].includes(event.state?.pursuit) ? event.state.pursuit : "home";
    render({ focus: true });
  });
  history.replaceState({ pursuit: view }, "");
  render();
});
