(() => {
  "use strict";

  const explore = "pages/explore.html?category=";
  const worlds = [
    ["academy", "Academy", "Open the learning workbench and pick a lesson, a quiz, or a question to investigate.", "pages/lesson.html"],
    ["mindset", "Mindset", "Take a quiet pause with an illustrated reflection and find a different way to see a difficult moment.", "pages/wisdom.html"],
    ["growth", "Growth", "Step into the reading room for writing prompts, focus practice, and time to reflect.", "pages/growth.html"],
    ["defence", "Defence", "Read a field briefing and explore the planning, teamwork, and decisions behind a rescue.", `${explore}defence`],
    ["arts", "Arts", "Look closer at line and shape, then make something of your own in the studio.", `${explore}arts`],
    ["music", "Music", "Follow a rhythm into the world of sound. Listen for a pattern, then try making one.", `${explore}music`],
    ["literature", "Literature", "Open the reading room to explore language, stories, and the choices that shape them.", `${explore}literature`],
    ["science", "Science", "Look closer at how the natural world works, then try an observation or an experiment of your own.", `${explore}science`],
    ["technology", "Technology", "Follow a signal from sensor to action and see how people build systems that solve problems.", `${explore}technology`],
    ["research", "Research", "Turn a question into something you can test and see what counts as good evidence.", `${explore}research`],
    ["football", "Football and Sports", "Read the game, choose a skill to practise, and build a plan you can follow.", "pages/pursuit.html#p-feature-heading"],
    ["careers", "Creative Careers", "Explore the roles and skills behind a career in art, design, or storytelling.", `${explore}arts#careers`],
  ];

  const ideas = [
    {
      title: "Look at one ordinary thing twice.",
      copy: "Pick something near you. Draw it from memory, then look again and draw what you missed. Which details did your brain keep?",
      icon: "eye",
      href: `${explore}arts#project`,
      link: "Try an art project",
    },
    {
      title: "What does your room sound like?",
      copy: "Listen for one minute. Write down the closest sound, the farthest sound, and the one that repeats. Can you turn those three into a rhythm?",
      icon: "music",
      href: `${explore}music#project`,
      link: "Explore music",
    },
    {
      title: "Make a better question.",
      copy: "Take a big question you’ve been carrying. Rewrite it so you could learn something about it today. What would count as an answer?",
      icon: "bulb",
      href: `${explore}research`,
      link: "Open the research field guide",
    },
    {
      title: "Watch a game away from the ball.",
      copy: "Follow one player for a minute without tracking the ball. Notice when they stop, when they move, and how their teammates respond.",
      icon: "football",
      href: "pages/pursuit.html#p-feature-heading",
      link: "Find your next pursuit",
    },
  ];

  const art = name => typeof IndiePixel === "function" ? IndiePixel(name) : "";

  function renderWorlds() {
    const atlas = document.getElementById("indie-world-atlas");
    const grid = document.getElementById("indie-worlds-grid");
    const preview = document.getElementById("indie-world-preview");
    if (!atlas || !grid || !preview) return;

    const title = document.getElementById("indie-preview-title");
    const copy = document.getElementById("indie-preview-copy");
    const figure = document.getElementById("indie-preview-art");
    const number = document.getElementById("indie-preview-number");
    const link = document.getElementById("indie-preview-link");
    const controls = [];
    let current;

    function selectWorld(index) {
      if (index === current) return;
      const [id, name, description, href] = worlds[index];
      if (current !== undefined) {
        controls[current].setAttribute("aria-checked", "false");
        controls[current].tabIndex = -1;
      }
      controls[index].setAttribute("aria-checked", "true");
      controls[index].tabIndex = 0;
      current = index;
      preview.dataset.world = id;
      title.textContent = name;
      copy.textContent = description;
      number.textContent = `Plate ${String(index + 1).padStart(2, "0")}`;
      figure.innerHTML = typeof IndieAtlasArt === "object" ? IndieAtlasArt[id] : "";
      link.href = href;
      link.textContent = `Enter ${name} ↗`;
    }

    worlds.forEach(([, name], index) => {
      const button = document.createElement("button");
      button.className = "indie-world";
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-controls", preview.id);
      button.setAttribute("aria-checked", "false");
      button.tabIndex = -1;
      const mark = document.createElement("span");
      mark.className = "indie-world-marker";
      mark.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "indie-world-title";
      label.textContent = name;
      button.append(mark, label);
      button.addEventListener("click", () => selectWorld(index));
      controls.push(button);
    });
    grid.append(...controls);
    const directions = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    grid.addEventListener("keydown", event => {
      if (!Object.hasOwn(directions, event.key)) return;
      event.preventDefault();
      const index = (current + directions[event.key] + worlds.length) % worlds.length;
      selectWorld(index);
      controls[index].focus();
    });
    selectWorld(worlds.findIndex(([id]) => id === "science"));
    atlas.hidden = false;
  }

  function activateEditorial() {
    const title = document.getElementById("indie-editorial-title");
    const copy = document.getElementById("indie-editorial-copy");
    const icon = document.getElementById("indie-editorial-icon");
    const link = document.getElementById("indie-editorial-link");
    const count = document.getElementById("indie-editorial-count");
    const next = document.getElementById("indie-next-idea");
    if (!title || !copy || !icon || !link || !count || !next) return;

    let index = 0;

    function renderIdea() {
      const idea = ideas[index];
      title.textContent = idea.title;
      copy.textContent = idea.copy;
      icon.innerHTML = art(idea.icon);
      link.href = idea.href;
      link.textContent = idea.link;
      count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(ideas.length).padStart(2, "0")}`;
    }

    renderIdea();
    next.hidden = false;
    next.addEventListener("click", () => {
      index = (index + 1) % ideas.length;
      renderIdea();
    });
  }

  renderWorlds();
  activateEditorial();
})();
