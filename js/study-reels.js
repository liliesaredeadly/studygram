(() => {
  const title = document.getElementById("study-reels-title");
  const list = document.getElementById("study-reels-list");
  const status = document.getElementById("study-reels-status");
  const signIn = document.getElementById("study-reels-signin");
  const more = document.getElementById("study-reels-more");
  const dates = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const sessionChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("studygram-community") : null;
  let version = 0;
  let nextCursor = null;
  let loading = false;
  let playing = null;

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label) node.textContent = label;
    return node;
  }

  function button(className, label) {
    const node = element("button", className, label);
    node.type = "button";
    return node;
  }

  async function request(path, method = "GET", input) {
    const response = await fetch(`/api/community/reels${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      ...(input && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      throw Object.assign(new Error(data?.error || "The reel feed couldn’t complete that request."), { status: response.status });
    }
    return data;
  }

  function resetFeed() {
    version++;
    loading = false;
    nextCursor = null;
    for (const video of list.querySelectorAll("video[src]")) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    playing = null;
    list.replaceChildren();
    list.hidden = true;
    list.removeAttribute("aria-busy");
    more.hidden = true;
    more.disabled = false;
    signIn.hidden = true;
  }

  function requireSignIn() {
    const focusLost = list.contains(document.activeElement) || document.activeElement === more;
    resetFeed();
    status.textContent = "Sign in to watch and like reels shared by students.";
    signIn.hidden = false;
    if (focusLost) signIn.focus();
  }

  function makePlayer(reel, feedback) {
    const player = element("div", "study-reel-player");
    const video = element("video", "study-reel-video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.hidden = true;
    video.setAttribute("aria-label", `Study reel: ${reel.title}`);
    const play = button("indie-button study-reel-play");
    play.setAttribute("aria-label", `Play ${reel.title}`);
    const mark = element("span", "study-reel-play-mark", "▶");
    mark.setAttribute("aria-hidden", "true");
    play.append(mark, element("span", "study-reel-play-label", "Play reel"));
    play.addEventListener("click", () => {
      if (playing && playing !== video) playing.pause();
      playing = video;
      feedback.textContent = "";
      video.src = reel.videoUrl;
      video.hidden = false;
      play.hidden = true;
      video.focus({ preventScroll: true });
      video.play().catch(() => {});
    });
    video.addEventListener("play", () => {
      if (playing && playing !== video) playing.pause();
      playing = video;
    });
    video.addEventListener("error", () => {
      if (!video.hasAttribute("src")) return;
      const hadFocus = document.activeElement === video;
      video.removeAttribute("src");
      video.load();
      video.hidden = true;
      play.hidden = false;
      feedback.textContent = "This reel couldn’t play. Try again.";
      if (hadFocus) play.focus({ preventScroll: true });
    });
    player.append(video, play);
    return player;
  }

  function removeCard(card, player, message) {
    const neighbor = card.nextElementSibling || card.previousElementSibling;
    const hadFocus = card.contains(document.activeElement);
    const video = player.querySelector("video");
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (playing === video) playing = null;
    card.remove();
    list.hidden = !list.children.length;
    status.textContent = list.children.length || nextCursor ? message : `${message} The feed is empty.`;
    if (hadFocus) (neighbor?.querySelector("h3") || title).focus({ preventScroll: true });
  }

  function makeCard(reel) {
    const card = element("li", "study-reel-card");
    const meta = element("div", "study-reel-meta");
    const heading = element("h3", null, reel.title);
    heading.tabIndex = -1;
    const posted = new Date(reel.createdAt);
    const credit = element("p", null, `By ${reel.username} · `);
    const time = element("time", null, dates.format(posted));
    time.dateTime = reel.createdAt;
    credit.append(time);
    meta.append(heading, credit);

    const feedback = element("p", "study-reel-feedback");
    feedback.setAttribute("role", "status");
    const player = makePlayer(reel, feedback);
    const actions = element("div", "study-reel-actions");
    const count = element("span", "study-reel-count");
    count.setAttribute("aria-live", "polite");
    const setCount = value => { count.textContent = `${value} ${value === 1 ? "like" : "likes"}`; };
    setCount(reel.likes);

    if (reel.canRemove) {
      const remove = button("indie-button study-reel-remove", "Unpublish");
      remove.setAttribute("aria-expanded", "false");
      const confirm = element("div", "study-reel-confirm");
      confirm.id = `study-reel-confirm-${reel.id}`;
      remove.setAttribute("aria-controls", confirm.id);
      confirm.hidden = true;
      const cancel = button("indie-button", "Cancel");
      const unpublish = button("indie-button indie-button-ink", "Unpublish reel");
      confirm.append(element("p", null, "Unpublish this reel from the feed?"), cancel, unpublish);
      remove.addEventListener("click", () => {
        confirm.hidden = !confirm.hidden;
        remove.setAttribute("aria-expanded", String(!confirm.hidden));
        if (!confirm.hidden) cancel.focus();
      });
      cancel.addEventListener("click", () => {
        confirm.hidden = true;
        remove.setAttribute("aria-expanded", "false");
        remove.focus();
      });
      unpublish.addEventListener("click", async () => {
        for (const control of [remove, cancel, unpublish]) control.disabled = true;
        feedback.textContent = "";
        try {
          await request(`/${reel.id}`, "DELETE");
          if (!card.isConnected) return;
          removeCard(card, player, "Reel unpublished.");
        } catch (error) {
          if (!card.isConnected) return;
          if (error.status === 401) return requireSignIn();
          if (error.status === 404) return removeCard(card, player, "This reel is no longer available.");
          feedback.textContent = error.status ? error.message : "Couldn’t unpublish the reel. Try again.";
        } finally {
          for (const control of [remove, cancel, unpublish]) control.disabled = false;
        }
      });
      actions.append(element("span", "study-reel-own", "Your reel"), count, remove);
      card.append(player, meta, actions, confirm, feedback);
    } else {
      const like = button("indie-button study-reel-like");
      const heart = element("span", null, "♥");
      heart.setAttribute("aria-hidden", "true");
      like.append(heart, element("span", null, "Like"));
      like.setAttribute("aria-label", `Like ${reel.title}`);
      like.setAttribute("aria-pressed", String(reel.liked));
      like.addEventListener("click", async () => {
        const hadFocus = document.activeElement === like;
        like.disabled = true;
        feedback.textContent = "";
        try {
          const { likes, liked } = await request(`/${reel.id}/like`, "PUT", { liked: like.getAttribute("aria-pressed") !== "true" });
          if (!card.isConnected) return;
          like.setAttribute("aria-pressed", String(liked));
          setCount(likes);
        } catch (error) {
          if (!card.isConnected) return;
          if (error.status === 401) return requireSignIn();
          if (error.status === 404) return removeCard(card, player, "This reel is no longer available.");
          feedback.textContent = error.status ? error.message : "Couldn’t save your like. Try again.";
        } finally {
          like.disabled = false;
          if (hadFocus && card.isConnected && document.activeElement === document.body) like.focus({ preventScroll: true });
        }
      });
      actions.append(like, count);
      card.append(player, meta, actions, feedback);
    }
    return card;
  }

  async function loadPage() {
    if (loading) return;
    const requestVersion = version;
    const focusMore = document.activeElement === more;
    loading = true;
    more.disabled = true;
    list.setAttribute("aria-busy", "true");
    status.textContent = nextCursor ? "Loading more reels…" : "Loading student reels…";
    try {
      const data = await request(nextCursor ? `?before=${encodeURIComponent(nextCursor)}` : "");
      if (version !== requestVersion) return;
      const cards = data.reels.map(makeCard);
      list.append(...cards);
      list.hidden = !list.children.length;
      nextCursor = data.nextCursor;
      more.hidden = !nextCursor;
      more.textContent = "Load more reels";
      status.textContent = list.children.length ? "" : "No reels have been shared yet. You can publish one from your lesson after it’s ready.";
      if (focusMore && document.activeElement === document.body) {
        (cards[0]?.querySelector("h3") || title).focus({ preventScroll: true });
      }
    } catch (error) {
      if (version !== requestVersion) return;
      if (error.status === 401) return requireSignIn();
      status.textContent = "Couldn’t load student reels. Try again.";
      more.textContent = "Retry";
      more.hidden = false;
    } finally {
      if (version === requestVersion) {
        loading = false;
        more.disabled = false;
        list.removeAttribute("aria-busy");
        if (focusMore && !more.hidden && document.activeElement === document.body) more.focus({ preventScroll: true });
      }
    }
  }

  function reloadFeed() {
    resetFeed();
    loadPage();
  }

  more.addEventListener("click", loadPage);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) playing?.pause();
  });
  sessionChannel?.addEventListener("message", event => {
    if (event.data === "session-changed") reloadFeed();
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) reloadFeed();
  });
  loadPage();
})();
