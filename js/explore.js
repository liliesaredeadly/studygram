(typeof StudygramPrivateSession === "undefined" ? callback => callback() : StudygramPrivateSession.start)(() => {
  "use strict";

  const subjects = [
    ...(typeof EXPLORE_HUMANITIES === "undefined" ? [] : EXPLORE_HUMANITIES),
    ...(typeof EXPLORE_STEM === "undefined" ? [] : EXPLORE_STEM),
  ];
  const content = document.getElementById("explore-content");
  const requestedId = new URLSearchParams(location.search).get("category");
  const subject = subjects.find(item => item.id === requestedId);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const subjectURL = id => `?category=${encodeURIComponent(id)}`;

  const illustrations = {
    defence: `<path d="M80 16 111 28v24c0 18-13 28-31 38C62 80 49 70 49 52V28z" fill="currentColor" fill-opacity=".16"/>
      <path d="M80 25 103 34v18c0 13-10 22-23 30-13-8-23-17-23-30V34z M80 35v36 M62 53h36"/>
      <circle cx="80" cy="53" r="10"/><path d="M32 50h9m78 0h9m-96 7h9m78 0h9"/>`,
    arts: `<path d="m49 68 7-44 42 6-7 44z" fill="currentColor" fill-opacity=".15"/><path d="m67 76 7-43 42 7-7 43z" fill="var(--atlas-card-wash)"/>
      <path d="m71 70 17-20 12 18 6-6 4 10 M46 81l15 2 M108 16v12m-6-6h12 M43 38v10m-5-5h10"/>
      <circle cx="103" cy="51" r="4" fill="currentColor"/>`,
    music: `<path d="M36 37h88m-88 8h88m-88 8h88m-88 8h88m-88 8h88" opacity=".38"/>
      <path d="M70 66V34l30-8v31m-30-14 30-8" stroke-width="3"/>
      <ellipse cx="63" cy="68" rx="8" ry="5.5" fill="currentColor" transform="rotate(-17 63 68)"/>
      <ellipse cx="93" cy="59" rx="8" ry="5.5" fill="currentColor" transform="rotate(-17 93 59)"/>
      <path d="M114 27v9m-4.5-4.5h9 M47 20v9m-4.5-4.5h9"/>`,
    literature: `<path d="M80 37c-14-10-28-11-44-6v38c16-5 30-4 44 6 14-10 28-11 44-6V31c-16-5-30-4-44 6Z" fill="currentColor" fill-opacity=".16"/>
      <path d="M80 37v38M43 42c11-3 21-2 30 4m-30 5c11-3 21-2 30 4m-30 5c11-3 21-2 30 4m14-18c9-6 19-7 30-4m-30 13c9-6 19-7 30-4m-30 13c9-6 19-7 30-4"/>
      <path d="M30 37v39c16-5 31-5 50 6 19-11 34-11 50-6V37"/>`,
    science: `<ellipse cx="80" cy="51" rx="39" ry="14"/><ellipse cx="80" cy="51" rx="39" ry="14" transform="rotate(60 80 51)"/>
      <ellipse cx="80" cy="51" rx="39" ry="14" transform="rotate(-60 80 51)"/><circle cx="80" cy="51" r="6" fill="currentColor"/>
      <circle cx="115" cy="57" r="4" fill="currentColor"/><circle cx="58" cy="24" r="3.5" fill="currentColor"/>`,
    technology: `<rect x="58" y="30" width="44" height="43" rx="4" fill="currentColor" fill-opacity=".14"/><rect x="69" y="41" width="22" height="21" rx="2"/>
      <path d="M66 30V20m9 10V20m10 10V20m9 10V20M66 73v10m9-10v10m10-10v10m9-10v10M58 39H41m17 8H47m11 9H47m11 8H41m61-25h17m-17 8h11m-11 9h11m-11 8h17"/>
      <circle cx="39" cy="39" r="2"/><circle cx="121" cy="64" r="2"/>`,
    research: `<path d="m93 62 19 20c2 2 5 2 7 0s2-5 0-7L99 56" fill="currentColor" fill-opacity=".24"/>
      <circle cx="77" cy="43" r="26" fill="currentColor" fill-opacity=".13"/><circle cx="77" cy="43" r="20"/>
      <path d="m63 49 9-9 7 5 11-12M63 53h27" stroke-width="2"/><path d="M40 71h28m-28 7h20m49-54h14m-7-7v14"/>`,
  };

  function illustration(id) {
    return `<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 27V11h16m104 0h16v16m0 46v16h-16M28 89H12V73" opacity=".4"/>
      ${illustrations[id] || illustrations.research}
    </svg>`;
  }

  const subjectEditions = {
    defence: { kicker: "Field operations / Rescue briefing", plate: "Search area · schematic", guide: "Mission briefing", path: "Plan of action" },
    arts: { kicker: "The visual arts issue", plate: "Study in line and shape", guide: "Inside the issue", path: "Studio notes" },
    music: { kicker: "Listening room / Rhythm issue", plate: "Beat grid · eight counts", guide: "The tracklist", path: "Your practice queue" },
    literature: { kicker: "The reading room", plate: "An open page · study in translation", guide: "Chapters", path: "Reading order" },
    science: { kicker: "Field notebook / Water cycle", plate: "Figure 01 · How water moves", guide: "Lab notebook", path: "Observation plan" },
    technology: { kicker: "Systems lab / Robotics", plate: "System 01 · Sensor to action", guide: "Lab modules", path: "Build sequence" },
    research: { kicker: "Methods journal / Study guide", guide: "Methods and evidence", path: "Reading sequence" },
  };

  const subjectPlates = {
    science: `<svg viewBox="0 0 340 210" role="img" aria-label="Water cycle diagram. Evaporation takes water from a puddle into the air. It condenses into clouds and returns as rain." fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
      <g opacity=".22"><path d="M35 40h270M35 90h270M35 140h270M35 190h270M40 35v155M105 35v155M170 35v155M235 35v155M300 35v155" stroke-dasharray="2 5"/></g>
      <path d="M55 169c25-13 43-13 69 0s45 13 70 0 46-13 79 0v15H55z" fill="currentColor" fill-opacity=".15"/>
      <path d="M64 160c15-6 30-6 48 0m81-1c22-8 45-8 70 0M107 141v-63m-6 7 6-7 6 7M76 135V98m-6 7 6-7 6 7m58 31V90m-6 7 6-7 6 7"/>
      <path d="M120 63c-1-13 10-23 25-21 4-18 30-24 44-8 16-10 37 0 37 15 20-2 28 22 8 26H132c-7 0-12-5-12-12z" fill="currentColor" fill-opacity=".10"/>
      <path d="m210 95-5 13m27-13-5 13m27-13-5 13m-31 8-5 13m27-13-5 13m27-13-5 13"/>
      <g stroke="none" fill="currentColor" font-family="ui-monospace,monospace" font-size="10"><text x="152" y="16">02 · CONDENSE</text><text x="23" y="65">01 · EVAPORATE</text><text x="215" y="145">03 · PRECIPITATE</text><text x="115" y="200">04 · COLLECTION</text></g>
    </svg>`,
    technology: `<svg viewBox="0 0 340 210" role="img" aria-label="A robotics system diagram that flows from a sensor to a controller and then to an actuator." fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
      <path d="M37 72h52v52H37zm106-12h58v77h-58zm110 12h52v52h-52z" fill="currentColor" fill-opacity=".09"/>
      <circle cx="63" cy="98" r="13"/><circle cx="63" cy="98" r="5" fill="currentColor"/><path d="M154 74h36v45h-36zm5-14v-9m12 9v-9m12 9v-9m-24 86v9m12-9v9m12-9v9M163 87h18m-18 10h18m-18 10h18"/>
      <path d="M273 89v19l17-9z" fill="currentColor"/><path d="M89 98h54m-10-5 6 5-6 5m68-5h52m-10-5 6 5-6 5M38 141v19h267v-19M22 44h26m-13-13v26m258 100h28m-14-14v28" stroke-dasharray="4 4"/>
      <g stroke="none" fill="currentColor" font-family="ui-monospace,monospace" font-size="10" text-anchor="middle"><text x="63" y="136">SENSOR</text><text x="171" y="159">CONTROLLER</text><text x="279" y="136">ACTUATOR</text></g>
    </svg>`,
    defence: `<svg viewBox="0 0 340 210" role="img" aria-label="A schematic rescue search grid showing the last known position, search route, and a direction marker." fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
      <path d="M31 25h277v159H31zM31 65h277M31 104h277M31 144h277M86 25v159m56-159v159m56-159v159m55-159v159" opacity=".4"/>
      <path d="M31 93c36-19 52-13 70 5 23 23 20 45 42 86H31z" fill="currentColor" fill-opacity=".13"/>
      <path d="m123 83 82-28 50 32-81 28 45 30" stroke-dasharray="5 5" stroke-width="2"/><circle cx="123" cy="83" r="15"/><circle cx="123" cy="83" r="5" fill="currentColor"/>
      <path d="m267 75 12-25 12 25-12-5z" fill="currentColor"/><path d="M207 145h24m-12-12v24"/>
      <g stroke="none" fill="currentColor" font-family="ui-monospace,monospace" font-size="10"><text x="96" y="63">LAST KNOWN</text><text x="275" y="45">N</text><text x="236" y="152">SEARCH</text><text x="33" y="201">SCHEMATIC / NOT TO SCALE</text></g>
    </svg>`,
    arts: `<svg viewBox="0 0 340 210" aria-hidden="true" focusable="false">
      <circle cx="173" cy="109" r="83" fill="#f3a874"/><path d="M101 24 230 44l-21 145-128-21z" fill="#792057"/>
      <path d="m146 44 122 48-41 104-122-48z" fill="#f8ede1" stroke="#301d2c" stroke-width="1.5"/>
      <path d="m122 136 68-54 19 52 26-13-20 51z" fill="#c34b46"/><circle cx="225" cy="106" r="12" fill="#792057"/>
      <path d="M73 47v28m-14-14h28m172 93 20 25m-10-29 17 20M51 148l41 8m-41 2 32 6" fill="none" stroke="#301d2c" stroke-width="2"/>
    </svg>`,
    music: `<svg viewBox="0 0 340 210" role="img" aria-label="A waveform and an eight-count beat grid illustrating repeated pulses." fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M26 58h288M26 108h288M26 158h288" opacity=".35"/>
      <path d="M26 108h17l5-11 4 30 6-74 7 104 8-78 6 47 5-18h14l6-12 6 34 7-64 8 84 8-64 6 34 6-12h14l6-14 5 40 9-80 7 109 7-88 6 50 6-17h14l5-12 6 38 8-62 7 73 9-56 6 30 5-11h13l6-14 7 30 6-16h12" stroke-width="2.5"/>
      <path d="M42 173v10m37-10v10m37-10v10m37-10v10m37-10v10m37-10v10m37-10v10m37-10v10" stroke-width="2"/>
      <g stroke="none" fill="currentColor" font-family="ui-monospace,monospace" font-size="10" text-anchor="middle"><text x="42" y="198">1</text><text x="79" y="198">2</text><text x="116" y="198">3</text><text x="153" y="198">4</text><text x="190" y="198">5</text><text x="227" y="198">6</text><text x="264" y="198">7</text><text x="301" y="198">8</text></g>
    </svg>`,
  };

  function subjectArtwork(item, edition) {
    if (item.id === "research") {
      const metrics = [
        ["Lesson scenes", item.lesson.scenes.length],
        ["Review questions", item.questions.length],
        ["References", item.sources.length],
      ];
      return `<dl class="atlas-research-metrics" aria-label="Guide contents">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
    }
    return `<figure class="atlas-subject-art">${subjectPlates[item.id] || illustration(item.id)}<figcaption>${edition.plate}</figcaption></figure>`;
  }

  const globe = `<svg class="atlas-globe" viewBox="0 0 350 254" aria-hidden="true" focusable="false" fill="none">
    <path d="M175 7v240M52 127h246" stroke="#b9c4a4" stroke-opacity=".5" stroke-dasharray="2 5"/>
    <circle cx="175" cy="127" r="111" stroke="#d1d0a7" stroke-opacity=".5" stroke-dasharray="1 5"/>
    <circle cx="175" cy="127" r="96" fill="#d5d9ae" fill-opacity=".06" stroke="#e3deb5" stroke-width="1.4"/>
    <ellipse cx="175" cy="127" rx="64" ry="96" stroke="#b9c4a4" stroke-opacity=".65"/>
    <ellipse cx="175" cy="127" rx="30" ry="96" stroke="#b9c4a4" stroke-opacity=".55"/>
    <path d="M83 100c50 19 134 19 184 0M83 154c50-19 134-19 184 0M103 63c46 28 98 28 144 0m-144 128c46-28 98-28 144 0" stroke="#b9c4a4" stroke-opacity=".65"/>
    <path d="m132 61-9 10-19 4-9 14 7 6 11-2 3 14 15 13 3 14 13 4 5 12 8-4-4-12-11-8-1-11-12-6 3-13 14-10 3-14-11-12zm25 78 21 8 4 11-10 11-3 17-12 17-6-8 2-15-6-12 4-14zm48-68-12 6-1 14-13 8-4 14 15 13 18-2 3 17 9 17 11-6 8-20-8-11 6-12 11 5 10-12-6-18-13 3-7-11-12 3zm35 93 16-5 8 10-12 12-16-5z" fill="#bccb9e" fill-opacity=".45" stroke="#d5d9ae" stroke-width="1" stroke-linejoin="round"/>
    <ellipse cx="175" cy="127" rx="148" ry="42" transform="rotate(-24 175 127)" stroke="#f3d49a" stroke-opacity=".8" stroke-width="1.2" stroke-dasharray="4 5"/>
    <circle cx="61" cy="161" r="4" fill="#f3d49a"/><circle cx="273" cy="75" r="4" fill="#f3d49a"/>
    <path d="M306 31v28m-14-14h28m-23-9 18 18m0-18-18 18M44 59v16m-8-8h16m253 111v16m-8-8h16" stroke="#f3d49a" stroke-linecap="round"/>
  </svg>`;

  async function saveNotebook(notebook) {
    try {
      Storage.setPrivateValue(Storage.getExploreNotebookKey(), JSON.stringify(notebook));
      await Storage.flush();
      return true;
    } catch {
      return false;
    }
  }

  function sectionLink(item) {
    return `<a href="${subjectURL(item.id)}">${escape(item.title)}</a>`;
  }

  function refreshSavedInterests() {
    const saved = Storage.getExploreNotebook().saved;
    const savedSubjects = subjects.filter(item => saved.includes(item.id));
    const section = document.getElementById("saved-interests");
    const list = section.querySelector("ul");
    const empty = savedSubjects.length === 0;
    const links = savedSubjects.map(item => `<li>${sectionLink(item)}</li>`).join("");
    if (list.innerHTML !== links) list.innerHTML = links;
    list.hidden = empty;
    section.querySelector("p").hidden = !empty;
    section.hidden = empty && location.hash !== "#saved-interests";
  }

  function openSavedInterests() {
    refreshSavedInterests();
    if (location.hash !== "#saved-interests") return;
    const section = document.getElementById("saved-interests");
    section.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }

  function renderHub() {
    content.innerHTML = `
      <section class="atlas-cover" aria-labelledby="atlas-title">
        <div class="atlas-cover-copy">
          <p class="atlas-eyebrow">The Studygram field atlas</p>
          <h1 id="atlas-title">Explore <em>the World</em></h1>
          <p>What are you curious about today? Pick a subject, watch a short lesson, and try something you can make or investigate yourself.</p>
          <a class="btn atlas-cover-action" href="#atlas-subjects">Browse the atlas <span aria-hidden="true">↓</span></a>
          <a class="btn atlas-cover-action" href="pursuit.html">Start a pursuit <span aria-hidden="true">↗</span></a>
          <p><a class="atlas-event-jump" href="#tech-events">Browse tech events <span aria-hidden="true">↓</span></a></p>
        </div>
        ${globe}
      </section>
      ${requestedId ? '<p class="atlas-route-note" role="status">That subject could not be found. Pick a subject from the atlas.</p>' : ""}
      <section class="atlas-index" aria-labelledby="atlas-subjects">
        <div class="atlas-index-heading">
          <div>
            <p class="atlas-eyebrow">Subject index</p>
            <h2 id="atlas-subjects">Where will you go?</h2>
          </div>
          <p>${subjects.length} subjects to explore at your own pace</p>
        </div>
        <section class="atlas-saved" id="saved-interests" aria-labelledby="saved-interests-title" tabindex="-1" hidden>
          <strong id="saved-interests-title">Saved interests</strong>
          <ul></ul>
          <p hidden>Nothing saved yet. Open a subject below and select Save interest to keep it here.</p>
        </section>
        ${subjects.length ? `<ul class="atlas-card-grid">${subjects.map(item => `
          <li>
            <a class="atlas-tile atlas-${escape(item.id)}" href="${subjectURL(item.id)}">
              <span class="atlas-tile-art">${illustration(item.id)}</span>
              <span class="atlas-tile-text">
                <span class="atlas-tile-title">${escape(item.title)}</span>
                <span class="atlas-tile-tagline">${escape(item.tagline)}</span>
              </span>
              <span class="atlas-tile-arrow" aria-hidden="true">↗</span>
            </a>
          </li>`).join("")}</ul>` : '<p role="alert">The subject guides could not load. Reload this page to try again.</p>'}
      </section>
      <section class="atlas-events" id="tech-events" aria-labelledby="tech-events-title" tabindex="-1"></section>
      ${subjects.length ? assistant() : ""}`;
    openSavedInterests();
    window.addEventListener("hashchange", openSavedInterests);
    window.addEventListener("pageshow", event => {
      if (event.persisted) refreshSavedInterests();
    });
  }

  function subjectEntries(items) {
    return `<ul class="atlas-entry-list">${items.map(item => `<li>
      <h3>${item.url ? externalLink(item.title, item.url) : escape(item.title)}</h3>
      <p>${escape(item.text)}</p>
    </li>`).join("")}</ul>`;
  }

  function externalLink(title, url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return `<a href="${escape(parsed.href)}" target="_blank" rel="noopener noreferrer">${escape(title)} <span aria-hidden="true">↗</span><span class="atlas-sr"> (opens in a new tab)</span></a>`;
      }
    } catch {
      // A guide entry with a missing or invalid link remains readable.
    }
    return escape(title);
  }

  function disclosure(id, label, intro, body, open = false) {
    return `<details class="atlas-disclosure" id="${id}"${open ? " open" : ""}>
      <summary><span><span class="atlas-disclosure-title">${label}</span><span class="atlas-disclosure-intro">${intro}</span></span><span class="atlas-disclosure-mark" aria-hidden="true"></span></summary>
      <div class="atlas-disclosure-body">${body}</div>
    </details>`;
  }

  function projectContent(item) {
    const { title, intro, steps } = item.project;
    const completed = Storage.getExploreNotebook().projects[item.id];
    const checked = Array.isArray(completed) ? completed : [];
    return `<h3>${escape(title)}</h3>
      <p>${escape(intro)}</p>
      <fieldset class="atlas-checklist">
        <legend class="atlas-eyebrow">Project checklist</legend>
        ${steps.map((step, index) => `<label><input type="checkbox" name="project-step" value="${index}"${checked.includes(index) ? " checked" : ""} /> <span>${escape(step)}</span></label>`).join("")}
      </fieldset>
      <p class="atlas-feedback" id="atlas-project-status" role="status"></p>`;
  }

  function lessonContent(lesson) {
    const duration = lesson.scenes.reduce((total, scene) => total + (Number(scene.duration) || 0), 0);
    const lessonLength = duration ? ` · ${duration < 60 ? `${Math.round(duration)} sec` : `About ${Math.round(duration / 60)} min`}` : "";
    return `<h3>${escape(lesson.title)}</h3>
      <p>${lesson.scenes.length} scenes${lessonLength}</p>
      <ol class="atlas-scene-list" aria-label="Lesson preview">
        ${lesson.scenes.map(scene => `<li>
          <h4>${escape(scene.title)}</h4>
          <p>${escape(scene.caption)}</p>
          ${scene.visual === "steps" && scene.items?.length ? `<ol class="atlas-scene-steps">
            ${scene.items.map(step => `<li>${escape(step)}</li>`).join("")}
          </ol>` : ""}
        </li>`).join("")}
      </ol>
      <button class="btn btn-primary" type="button" data-activity="openLesson">Watch lesson <span aria-hidden="true">▶</span></button><p class="atlas-feedback" role="status"></p>`;
  }

  function renderSubject(item) {
    const saved = Storage.getExploreNotebook().saved.includes(item.id);
    const edition = subjectEditions[item.id] || { kicker: "Subject guide", guide: "Start exploring", path: "Where to start" };
    content.innerHTML = `
      <nav class="atlas-breadcrumb" aria-label="Breadcrumb">
        <a href="explore.html"><span aria-hidden="true">←</span> Explore the World</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${escape(item.title)}</span>
      </nav>
      <header class="atlas-subject-cover atlas-${escape(item.id)}">
        <div>
          <p class="atlas-eyebrow">${edition.kicker}</p>
          <h1 id="atlas-title" tabindex="-1">${escape(item.title)}</h1>
          <p>${escape(item.tagline)}</p>
          <button class="btn btn-secondary atlas-save" id="atlas-save" type="button" aria-pressed="${saved}">Save interest</button>
          ${item.id === "technology" ? '<a class="atlas-event-jump" href="#tech-events">Browse tech events <span aria-hidden="true">↓</span></a>' : ""}
          <p class="atlas-feedback" id="atlas-save-status" role="status">${saved ? "In your saved interests" : ""}</p>
        </div>
        ${subjectArtwork(item, edition)}
      </header>
      ${item.id === "technology" ? '<section class="atlas-events" id="tech-events" aria-labelledby="tech-events-title" tabindex="-1"></section>' : ""}
      <div class="atlas-subject-layout">
        <section class="atlas-guide" aria-labelledby="atlas-guide-title">
          <p class="atlas-eyebrow">Subject guide</p>
          <h2 id="atlas-guide-title">${edition.guide}</h2>
          <div class="atlas-guide-sections">
            ${disclosure("discover", "Discover", "Get your bearings with the big ideas.", subjectEntries(item.discover), true)}
            ${disclosure("lesson", "Learn", "Watch a short illustrated lesson.", lessonContent(item.lesson))}
            ${disclosure("explore-more", "Explore", "Follow questions that take you a little deeper.", subjectEntries(item.explore))}
            ${disclosure("quiz", "Test Yourself", "Check your understanding with instant feedback.", `<p>${item.questions.length} questions with an explanation for each answer.</p><button class="btn btn-primary" type="button" data-activity="openQuiz">Start quiz <span aria-hidden="true">→</span></button><p class="atlas-feedback" role="status"></p>`)}
            ${disclosure("careers", "Career Paths", "See where this subject can take you.", subjectEntries(item.careers))}
            ${disclosure("people", "Inspiring People", "Meet people whose work shaped the field.", subjectEntries(item.people))}
            ${disclosure("project", "Try It Yourself", "Put an idea to work in a small project.", projectContent(item))}
          </div>
        </section>
        <aside class="atlas-sidebar" aria-label="Learning resources">
          <section class="atlas-path" aria-labelledby="atlas-path-title">
            <p class="atlas-eyebrow">Study path</p>
            <h2 id="atlas-path-title">${edition.path}</h2>
            <ol>${item.path.map(step => `<li>${escape(step)}</li>`).join("")}</ol>
          </section>
          ${assistant(item)}
        </aside>
      </div>
      <section class="atlas-sources" aria-labelledby="atlas-sources-title">
        <h2 id="atlas-sources-title">Sources and further reading</h2>
        <ul>${item.sources.map(source => `<li>${externalLink(source.title, source.url)}</li>`).join("")}</ul>
      </section>
      <nav class="atlas-other" aria-labelledby="atlas-other-title">
        <h2 id="atlas-other-title">Explore another subject</h2>
        <ul>${subjects.filter(other => other !== item).map(other => `<li>${sectionLink(other)}</li>`).join("")}</ul>
      </nav>`;
  }

  function assistant(item) {
    return `<section class="atlas-assistant" id="explore-assistant" aria-labelledby="atlas-assistant-title">
      <p class="atlas-eyebrow"><span aria-hidden="true">✦</span> Explore Companion</p>
      <h2 id="atlas-assistant-title">Ask for a direction</h2>
      <p>${item ? `Ask about getting started in ${escape(item.title)}, trying a project, or exploring a career.` : "Get a first step, a project idea, or a path to learn more about a subject."}</p>
      <form id="atlas-ask" method="post" novalidate>
        <label class="form-label" for="atlas-ask-subject">Subject</label>
        <!-- Use the platform's native subject picker for its short list of options. -->
        <select class="form-select" id="atlas-ask-subject" name="category">
          <option value="">Match my question</option>
          ${subjects.map(topic => `<option value="${escape(topic.id)}"${topic === item ? " selected" : ""}>${escape(topic.title)}</option>`).join("")}
        </select>
        <label class="form-label" for="atlas-question">Your question</label>
        <textarea class="form-textarea" id="atlas-question" name="message" rows="3" maxlength="800" required aria-describedby="atlas-ask-privacy atlas-question-error" placeholder="What should I learn first?"></textarea>
        <p class="atlas-privacy" id="atlas-ask-privacy">With live AI enabled, Studygram sends your question to Meta AI. Leave out names and personal details.</p>
        <p class="atlas-error" id="atlas-question-error" role="alert" hidden></p>
        <div class="atlas-ask-controls">
          <button class="btn btn-primary" type="submit">Ask companion <span aria-hidden="true">→</span></button>
          <p class="atlas-feedback" id="atlas-ask-status" role="status"></p>
        </div>
      </form>
      <div class="atlas-reply" id="atlas-ask-reply" aria-live="polite" aria-atomic="true"></div>
    </section>`;
  }

  function bindSubject(item) {
    const save = document.getElementById("atlas-save");
    const status = document.getElementById("atlas-save-status");
    save.addEventListener("click", async () => {
      if (!StudygramPrivateSession.requireAccount()) return;
      const notebook = Storage.getExploreNotebook();
      const wasSaved = notebook.saved.includes(item.id);
      notebook.saved = wasSaved ? notebook.saved.filter(id => id !== item.id) : [...notebook.saved, item.id];
      if (await saveNotebook(notebook)) {
        save.setAttribute("aria-pressed", String(!wasSaved));
        status.textContent = wasSaved ? "Removed from saved interests" : "In your saved interests";
      } else {
        status.textContent = "Your account couldn’t save this interest. Try again.";
      }
    });

    const project = document.getElementById("project");
    project.addEventListener("change", async event => {
      if (event.target.name !== "project-step") return;
      if (!StudygramPrivateSession.requireAccount()) return;
      const notebook = Storage.getExploreNotebook();
      const completed = new Set(Array.isArray(notebook.projects[item.id]) ? notebook.projects[item.id] : []);
      const step = Number(event.target.value);
      if (event.target.checked) completed.add(step);
      else completed.delete(step);
      notebook.projects[item.id] = [...completed];
      const projectStatus = document.getElementById("atlas-project-status");
      if (await saveNotebook(notebook)) {
        projectStatus.textContent = `${completed.size} of ${item.project.steps.length} steps checked. Progress saved.`;
      } else {
        event.target.checked = !event.target.checked;
        projectStatus.textContent = "Your account couldn’t save this project. Try again.";
      }
    });

    content.querySelectorAll("[data-activity]").forEach(button => {
      button.addEventListener("click", async () => {
        const feedback = button.nextElementSibling;
        button.disabled = true;
        feedback.textContent = "Opening…";
        try {
          await ExploreActions[button.dataset.activity](item);
          // Navigation is handed off to the lesson or quiz player.
        } catch {
          feedback.textContent = "This activity couldn’t open. Try again or check that your browser allows Studygram to save progress.";
        } finally {
          button.disabled = false;
        }
      });
    });

    // A link to a guide section should expose its content immediately.
    const section = document.getElementById(location.hash.slice(1));
    if (section?.tagName === "DETAILS") {
      section.open = true;
    }
    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      const notebook = Storage.getExploreNotebook();
      const isSaved = notebook.saved.includes(item.id);
      save.setAttribute("aria-pressed", String(isSaved));
      status.textContent = isSaved ? "In your saved interests" : "";
      const completed = notebook.projects[item.id];
      project.querySelectorAll('input[name="project-step"]').forEach(box => {
        box.checked = Array.isArray(completed) && completed.includes(Number(box.value));
      });
      content.querySelectorAll("[data-activity]").forEach(button => {
        button.disabled = false;
        button.nextElementSibling.textContent = "";
      });
    });
  }

  function bindAssistant() {
    const form = document.getElementById("atlas-ask");
    if (!form) return;
    const input = form.elements.message;
    const button = form.querySelector("button");
    const error = document.getElementById("atlas-question-error");
    const status = document.getElementById("atlas-ask-status");
    const reply = document.getElementById("atlas-ask-reply");
    let pending = false;

    function clearError() {
      input.removeAttribute("aria-invalid");
      error.hidden = true;
    }

    input.addEventListener("input", clearError);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (pending) return;
      const message = input.value.trim();
      if (!message || message.length > input.maxLength) {
        error.textContent = `Enter a question using up to ${input.maxLength} characters.`;
        error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      clearError();
      const category = form.elements.category.value;
      pending = true;
      button.disabled = true;
      status.textContent = "Finding a direction…";
      reply.setAttribute("aria-busy", "true");
      try {
        const result = await ExploreActions.ask({ category, message });
        const steps = Array.isArray(result.steps) ? result.steps : [];
        const mode = result.mode === "live" ? "Live AI" : "Studygram guide";
        reply.innerHTML = `<p class="atlas-reply-mode">${escape(result.category)} · ${mode}</p>
          <p>${escape(result.reply)}</p>
          ${steps.length ? `<ol>${steps.map(step => `<li>${escape(step)}</li>`).join("")}</ol>` : ""}`;
        status.textContent = "";
      } catch {
        status.textContent = "The companion couldn’t answer. Try sending your question again.";
      } finally {
        pending = false;
        button.disabled = false;
        reply.setAttribute("aria-busy", "false");
      }
    });
  }

  if (subject) {
    document.title = `${subject.title} · Explore the World · Studygram`;
    document.body.dataset.atlasSubject = subject.id;
    renderSubject(subject);
    bindSubject(subject);
  } else {
    renderHub();
  }
  const events = document.getElementById("tech-events");
  if (events) {
    const refreshEventInterest = ExploreEvents.mount(events, () => Storage.getExploreNotebook().saved.includes("technology"));
    document.getElementById("atlas-save")?.addEventListener("click", refreshEventInterest);
    window.addEventListener("pageshow", refreshEventInterest);
    window.addEventListener("storage", event => {
      if (event.key === null || event.key === "sg_student" || event.key === Storage.getExploreNotebookKey()) {
        refreshEventInterest();
        if (!subject) refreshSavedInterests();
      }
    });
  }
  bindAssistant();
});
