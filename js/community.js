(() => {
  "use strict";

  const byId = id => document.getElementById(`community-${id}`);
  const gate = byId("gate");
  const board = byId("board");
  const authForm = byId("auth");
  const sessionForm = byId("new-session");
  const messageForm = byId("new-message");
  const dialog = byId("dialog");
  const actionForm = byId("action-form");
  const messageList = byId("messages");
  const messageLog = messageList.parentElement;
  const messageInput = byId("message-body");
  const leaderboard = byId("leaderboard");
  const leadersList = byId("leaders");
  const leaderboardRetry = byId("leaderboard-retry");
  const viewButtons = document.querySelectorAll("[data-community-view]");
  const standingsButtons = document.querySelectorAll("[data-community-standings]");
  const compactLayout = window.matchMedia("(max-width: 760px)");
  const viewPanel = { channels: "sidebar", chat: "conversation", rewards: "standings" };
  const avatarColors = ["mint", "lavender", "blue"];
  const leaderboardRefreshInterval = 30_000;
  const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const roomDrafts = new Map();
  const sessionChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel("studygram-community") : null;

  let user = null;
  let rooms = [];
  let registering = false;
  let activeView = null;
  let action = null;
  let sessionCheck = false;
  let signedInOnce = false;
  let rewardsRequestFor = null;
  let rewards = null;
  let leaderboardRequestFor = null;
  let leaderboardRefreshedAt = 0;
  const voice = createCommunityVoice({ api });

  function node(tag, content = "", className = "") {
    const element = document.createElement(tag);
    element.textContent = content;
    element.className = className;
    return element;
  }

  function status(message) {
    writeText("status", message);
  }

  function writeText(id, value) {
    const element = byId(id);
    if (element.textContent !== value) element.textContent = value;
  }

  function nearLatestMessage() {
    return messageLog.scrollHeight - messageLog.scrollTop - messageLog.clientHeight < 75;
  }

  function setMobileView(view, focus = false) {
    if (compactLayout.matches && activeView && board.dataset.mobileView === "chat" && view !== "chat") {
      activeView.needsFollow = nearLatestMessage();
    }
    board.dataset.mobileView = view;
    for (const button of viewButtons) {
      if (button.closest(".community-mobile-nav")) {
        button.setAttribute("aria-pressed", String(button.dataset.communityView === view));
      }
    }
    if (view === "rewards") refreshLeaderboard();
    if (view === "chat" && activeView?.needsFollow) {
      messageLog.scrollTop = messageLog.scrollHeight;
      activeView.needsFollow = false;
    }
    if (focus) byId(viewPanel[view]).focus();
  }

  function setStandingsVisible(visible) {
    board.toggleAttribute("data-standings-hidden", !visible);
    for (const button of standingsButtons) button.setAttribute("aria-expanded", String(visible));
    if (visible) refreshLeaderboard();
  }

  function revealLinkedStandings() {
    if (board.hidden || location.hash !== "#community-leaderboard") return false;
    leaderboard.open = true;
    setStandingsVisible(true);
    setMobileView("rewards");
    byId("leaderboard-title").focus();
    return true;
  }

  function setAvatar(element, nickname) {
    element.textContent = nickname[0].toUpperCase();
    const color = [...nickname].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % avatarColors.length;
    for (const [index, name] of avatarColors.entries()) {
      element.classList.toggle(`community-avatar--${name}`, index === color);
    }
  }

  function clearDrafts() {
    roomDrafts.clear();
    messageForm.reset();
    sessionForm.reset();
    byId("compose").open = false;
  }

  function saveDraft(view) {
    if (!view || view.type === "library") return;
    roomDrafts.set(viewKey(view), { body: messageInput.value, mode: view.mode });
  }

  function signedOut(message = "") {
    saveDraft(activeView);
    activeView = null;
    user = null;
    voice.setSession(null);
    rewards = null;
    rooms = [];
    if (dialog.open) dialog.close();
    messageList.replaceChildren();
    byId("sessions").replaceChildren();
    byId("participants").replaceChildren();
    delete byId("participants").dataset.snapshot;
    board.hidden = true;
    document.body.classList.remove("community-active");
    setMobileView("chat");
    setStandingsVisible(true);
    resetLeaderboard();
    gate.hidden = false;
    byId("password").value = "";
    byId("password").type = "password";
    byId("password-toggle").textContent = "Show";
    byId("password-toggle").setAttribute("aria-label", "Show password");
    byId("auth-error").textContent = "";
    status(message);
  }

  async function api(path, method = "GET", input) {
    const requestingUser = user;
    let response;
    try {
      response = await fetch(`/api/community${path}`, {
        method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(12000),
        ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}),
      });
    } catch {
      throw new Error("The community couldn’t connect. Try again in a moment.");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      if (response.status === 401 && requestingUser && requestingUser === user) signedOut("Your session ended. Sign in again to continue.");
      throw Object.assign(new Error(result?.error || "The community couldn’t complete that request. Try again."), { status: response.status });
    }
    return result;
  }

  function renderRewards() {
    writeText("reward-answers", rewards ? String(rewards.helpfulAnswers) : "—");
    writeText("reward-achievements", rewards ? String(rewards.achievementPoints) : "—");
    writeText("reward-reels", rewards ? String(rewards.reelLikes) : "—");
    const total = rewards ? String(communityRewardTotal(rewards)) : "";
    writeText("reward-total", total || "—");
    writeText("mobile-points", total);
  }

  async function refreshRewards() {
    const member = user;
    if (!member || board.hidden || rewardsRequestFor === member) return;
    rewardsRequestFor = member;
    try {
      const updated = await loadCommunityRewards(member.id);
      if (user !== member) return;
      if (!updated) return signedOut("Your session ended. Sign in again to continue.");
      const balanceChanged = !rewards || communityRewardTotal(updated) !== communityRewardTotal(rewards);
      rewards = updated;
      renderRewards();
      if (balanceChanged) refreshLeaderboard(true);
    } catch (error) {
      if (user === member && error.status === 409) {
        signedOut();
        checkSession();
      }
      // Retain the last confirmed count while the connection recovers.
    } finally {
      if (rewardsRequestFor === member) rewardsRequestFor = null;
    }
  }

  function resetLeaderboard() {
    leadersList.replaceChildren();
    leadersList.hidden = true;
    delete leadersList.dataset.snapshot;
    writeText("leaderboard-status", "");
    leaderboardRetry.hidden = true;
    leaderboardRefreshedAt = 0;
  }

  async function refreshLeaderboard(force = false) {
    const member = user;
    if (!member || board.hidden || !leaderboard.open) return;
    if (force) leaderboardRefreshedAt = 0;
    if (leaderboardRequestFor === member || Date.now() - leaderboardRefreshedAt < leaderboardRefreshInterval) return;

    leaderboardRequestFor = member;
    leaderboardRefreshedAt = Date.now();
    leaderboardRetry.disabled = true;
    if (!leadersList.dataset.snapshot) writeText("leaderboard-status", "Loading standings…");
    try {
      const { leaders } = await api("/leaderboard");
      if (user !== member) return;
      const snapshot = JSON.stringify(leaders);
      if (leadersList.dataset.snapshot !== snapshot) {
        leadersList.replaceChildren(...leaders.map(({ rank, username, points }) => {
          const row = node("li");
          const name = node("strong", username, "community-leader-name");
          if (username === member.username) {
            row.classList.add("community-leader-self");
            name.append(node("span", "You", "community-leader-you"));
          }
          row.append(node("span", `${rank}.`), name, node("span", `${points} ${points === 1 ? "point" : "points"}`));
          return row;
        }));
        leadersList.dataset.snapshot = snapshot;
      }
      leadersList.hidden = leaders.length === 0;
      writeText("leaderboard-status", leaders.length ? "" : "No points yet. Earn an achievement, give a helpful answer, or share a reel that other students can like.");
      if (document.activeElement === leaderboardRetry) byId("leaderboard-title").focus({ preventScroll: true });
      leaderboardRetry.hidden = true;
    } catch {
      if (user !== member) return;
      writeText("leaderboard-status", leadersList.hidden ? "Couldn’t load the leaderboard." : "Couldn’t refresh the leaderboard.");
      leaderboardRetry.hidden = false;
    } finally {
      if (leaderboardRequestFor === member) {
        leaderboardRequestFor = null;
        leaderboardRetry.disabled = false;
        if (user === member && leaderboardRefreshedAt === 0) refreshLeaderboard();
      }
    }
  }

  function fieldError(field, errorId, message) {
    byId(errorId).textContent = message;
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }

  function bindForm(form, errorId, run) {
    form.addEventListener("input", event => {
      event.target.removeAttribute("aria-invalid");
      byId(errorId).textContent = "";
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (form.getAttribute("aria-busy") === "true") return;
      const submit = form.querySelector('[type="submit"]');
      byId(errorId).textContent = "";
      form.setAttribute("aria-busy", "true");
      submit.disabled = true;
      try {
        await run(form.elements);
      } catch (error) {
        byId(errorId).textContent = error.message;
      } finally {
        form.removeAttribute("aria-busy");
        submit.disabled = false;
      }
    });
  }

  function viewFromURL() {
    const params = new URLSearchParams(location.search);
    const libraryId = params.get("library");
    if (libraryId && /^\d+$/.test(libraryId)) return { type: "session", id: libraryId };
    const room = rooms.find(item => item.id === params.get("room"));
    return room ? { type: "chat", id: room.id, room } : { type: "library", id: "library" };
  }

  function viewKey(view) {
    return `${view.type}:${view.id}`;
  }

  function routeURL(type, id) {
    if (type === "library") return "community.html";
    return `community.html?${type === "session" ? "library" : "room"}=${encodeURIComponent(id)}`;
  }

  function go(type, id) {
    history.pushState(null, "", routeURL(type, id));
    showRoute(true);
  }

  function viewLink(type, id, label) {
    const link = node("a", label);
    link.href = routeURL(type, id);
    link.addEventListener("click", event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(type, id);
    });
    return link;
  }

  function renderRoomDirectory() {
    const library = viewLink("library", "library", "");
    library.className = "community-library-link";
    library.append(node("strong", "The Library"), node("span", "Shared study sessions", "community-library-description"));
    library.setAttribute("aria-label", "The Library");
    if (activeView.type !== "chat") library.setAttribute("aria-current", "page");
    const list = node("ul", "", "community-room-list");
    for (const room of rooms) {
      const row = node("li");
      const link = viewLink("chat", room.id, "");
      link.className = "community-channel-link";
      link.setAttribute("aria-label", room.title);
      const mark = node("span", "#", "community-channel-mark");
      mark.setAttribute("aria-hidden", "true");
      link.append(mark, node("span", room.title.toLowerCase().replaceAll(" ", "-")));
      if (activeView.type === "chat" && activeView.id === room.id) link.setAttribute("aria-current", "page");
      row.append(link);
      list.append(row);
    }
    byId("rooms").replaceChildren(library, node("p", "Text channels", "community-kicker community-group-label"), list);
  }

  function questionExcerpt(question) {
    const body = question.body.replace(/\s+/g, " ");
    return body.length > 96 ? `${body.slice(0, 95)}…` : body;
  }

  function renderComposer(view) {
    const { kind, questionId } = view.mode;
    const question = view.questions?.get(String(questionId));
    const context = byId("message-context");
    context.hidden = kind !== "answer";
    writeText("message-context", kind === "answer" ? (question ? `Answering ${question.author}: ${questionExcerpt(question)}` : "Answering a question") : "");
    writeText("message-label", { chat: "Message", question: "Question", answer: "Your answer" }[kind]);
    writeText("message-mode", kind === "chat" ? "Ask a question" : "Switch to chat");
    writeText("message-submit", { chat: "Send message", question: "Post question", answer: "Post answer" }[kind]);
    messageInput.placeholder = kind === "chat" && view.room ? `Message #${view.room.title.toLowerCase().replaceAll(" ", "-")}` : "";
    byId("message-mode").hidden = view.type !== "chat";
  }

  function setComposerMode(mode) {
    if (activeView?.type !== "chat" || messageForm.getAttribute("aria-busy") === "true") return;
    activeView.mode = mode;
    byId("message-error").textContent = "";
    messageInput.removeAttribute("aria-invalid");
    renderComposer(activeView);
    messageInput.focus();
  }

  function showRoute(focus = false) {
    if (!user) return;
    saveDraft(activeView);
    const view = viewFromURL();
    if (view.type !== "session" || activeView?.type !== "session" || activeView.id !== view.id) voice.setSession(null);
    activeView = view;
    setMobileView("chat");
    const isLibrary = view.type === "library";
    byId("library").hidden = !isLibrary;
    byId("chat").hidden = isLibrary;
    renderRoomDirectory();
    if (isLibrary) {
      byId("library-status").textContent = "Looking for active sessions…";
      byId("sessions").replaceChildren();
    } else {
      byId("chat-title").textContent = view.room?.title || "Library session";
      byId("chat-title").classList.toggle("community-chat-title--channel", view.type === "chat");
      byId("chat-kind").textContent = view.room ? "Group chat" : "The Library";
      byId("chat-description").textContent = view.room?.description || "";
      byId("session-clock").hidden = true;
      byId("qa-guide").hidden = view.type !== "chat";
      writeText("chat-feedback", "");
      byId("chat-status").textContent = "Opening chat…";
      messageList.replaceChildren();
      const draft = roomDrafts.get(viewKey(view));
      view.mode = draft?.mode || { kind: "chat" };
      messageInput.value = draft?.body || "";
      renderComposer(view);
      byId("message-error").textContent = "";
      messageInput.removeAttribute("aria-invalid");
      messageForm.hidden = true;
    }
    if (!revealLinkedStandings() && focus) byId(isLibrary ? "library-title" : "chat-title").focus();
    refresh(view);
  }

  function renderLibrary(sessions) {
    const list = byId("sessions");
    const key = JSON.stringify(sessions);
    writeText("library-status", sessions.length ? "" : "No active sessions. Start one and make room for others to join.");
    if (list.dataset.snapshot === key && list.children.length === sessions.length) return;
    list.dataset.snapshot = key;
    const rows = sessions.map(session => {
      const row = node("li");
      const link = viewLink("session", session.id, "");
      link.className = "community-session-link";
      const main = node("span");
      main.append(node("strong", session.title), node("span", `${session.duration} min focus · ${session.activeCount} ${session.activeCount === 1 ? "student" : "students"} here`, "community-session-meta"));
      link.append(main, node("span", "View session →", "community-session-action"));
      row.append(link);
      return row;
    });
    list.replaceChildren(...rows);
  }

  function countdown() {
    const session = activeView?.session;
    if (!session) return;
    const seconds = Math.max(0, Math.ceil((Date.parse(session.endsAt) - Date.now()) / 1000));
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");
    byId("time").textContent = `${minutes}:${remainder}`;
    const join = byId("join-session");
    join.hidden = seconds === 0;
    if (seconds === 0) {
      byId("presence-summary").textContent = "Session complete";
      messageForm.hidden = true;
      voice.setSession(session);
    }
  }

  function renderSession(view, session) {
    view.session = session;
    byId("chat-title").textContent = session.title;
    byId("chat-description").textContent = `${session.duration} minutes of shared study time. Come and go as you need.`;
    byId("session-clock").hidden = false;
    byId("join-session").textContent = session.joined ? "Leave session" : "Join session";
    byId("presence-summary").textContent = `${session.activeCount} ${session.activeCount === 1 ? "student" : "students"} here`;
    const names = Array.isArray(session.participants) ? session.participants : [];
    const participants = byId("participants");
    const nameKey = names.map(person => person.username).join(",");
    if (participants.dataset.snapshot !== nameKey) {
      participants.dataset.snapshot = nameKey;
      participants.replaceChildren(...names.map(person => node("li", person.username)));
    }
    voice.setSession(session);
    countdown();
  }

  function openAction(kind, message) {
    action = { kind, id: message.id, view: activeView };
    actionForm.reset();
    byId("dialog-error").textContent = "";
    const remove = kind === "remove";
    const copy = {
      remove: ["Remove your message?", "This message will be removed from the conversation for everyone.", "Remove message"],
      report: ["Report this message?", "Choose a reason. The message will be hidden from your chat.", "Send report"],
      helpful: ["Mark this answer helpful?", `${message.author} will earn 1 point. You can mark one answer per question.`, "Mark helpful"],
    };
    const [title, description, submit] = copy[kind];
    writeText("dialog-title", title);
    writeText("dialog-description", description);
    writeText("dialog-submit", submit);
    byId("report-reasons").hidden = kind !== "report";
    byId("dialog-submit").classList.toggle("community-danger", remove);
    dialog.showModal();
    byId("dialog-cancel").focus();
  }

  function jumpToMessage(id) {
    const row = Array.from(messageList.children).find(item => item.dataset.id === String(id));
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  }

  function renderMessage(message, reference, question, replies, snapshot) {
    const row = node("li", "", "community-message");
    row.dataset.id = String(message.id);
    row.dataset.kind = message.kind || "chat";
    row.dataset.snapshot = snapshot;
    row.tabIndex = -1;
    const avatar = node("span", "", "community-message-avatar");
    avatar.setAttribute("aria-hidden", "true");
    setAvatar(avatar, message.author);
    const content = node("div", "", "community-message-content");
    const header = node("div", "", "community-message-head");
    const date = new Date(message.createdAt);
    const time = node("time", timeFormat.format(date));
    time.dateTime = message.createdAt;
    const remove = message.canRemove;
    const button = node("button", remove ? "Remove" : "Report", "community-text-button community-message-action");
    button.type = "button";
    button.setAttribute("aria-label", remove ? "Remove your message" : `Report message by ${message.author}`);
    button.addEventListener("click", () => openAction(remove ? "remove" : "report", message));
    header.append(node("strong", message.author), time);
    if (message.kind === "question") header.append(node("span", "Question", "community-message-label"));
    if (message.kind === "answer") {
      const label = node("span", message.helpful ? "Helpful answer · +1 point" : "Answer", "community-message-label");
      if (message.helpful) label.classList.add("community-message-helpful");
      header.append(label);
    }
    header.append(button);
    content.append(header);
    if (reference) {
      row.classList.add("community-message-reply");
      const context = node(question ? "button" : "p", reference, "community-message-reference");
      if (question) {
        context.type = "button";
        context.addEventListener("click", () => jumpToMessage(question.id));
      }
      content.append(context);
    }
    content.append(node("p", message.body, "community-message-body"));
    if (message.kind === "question" || message.canMarkHelpful) {
      const controls = node("div", "", "community-message-controls");
      const isQuestion = message.kind === "question";
      const button = node("button", isQuestion ? "Answer" : "Mark helpful", "community-text-button");
      button.type = "button";
      button.setAttribute("aria-label", isQuestion ? `Answer ${message.author}'s question` : `Mark helpful for ${message.author}'s answer`);
      button.addEventListener("click", () => {
        if (isQuestion) setComposerMode({ kind: "answer", questionId: message.id });
        else openAction("helpful", message);
      });
      controls.append(button);
      if (replies) {
        const thread = node("button", `${replies.count} ${replies.count === 1 ? "reply" : "replies"}`, "community-text-button community-reply-link");
        thread.type = "button";
        thread.addEventListener("click", () => jumpToMessage(replies.firstId));
        controls.append(thread);
      }
      content.append(controls);
    }
    row.append(avatar, content);
    return row;
  }

  function renderMessages(view, messages, follow) {
    const chatVisible = !compactLayout.matches || board.dataset.mobileView === "chat";
    const nearby = chatVisible && nearLatestMessage();
    const firstLoad = !messageList.children.length;
    const existing = new Map(Array.from(messageList.children, child => [child.dataset.id, child]));
    const visible = new Set(messages.map(message => String(message.id)));
    view.questions = new Map(messages.filter(message => message.kind === "question").map(message => [String(message.id), message]));
    const repliesByQuestion = new Map();
    for (const message of messages) {
      if (message.kind !== "answer" || !message.questionId) continue;
      const id = String(message.questionId);
      const replies = repliesByQuestion.get(id) || { firstId: message.id, count: 0 };
      replies.count += 1;
      repliesByQuestion.set(id, replies);
    }
    for (const [id, item] of existing) {
      if (!visible.has(id)) {
        if (item.contains(document.activeElement)) messageLog.focus({ preventScroll: true });
        item.remove();
      }
    }
    for (const [index, message] of messages.entries()) {
      const question = view.questions.get(String(message.questionId));
      const reference = question ? `In reply to ${question.author}: ${questionExcerpt(question)}`
        : message.questionId ? "In reply to an earlier question" : "";
      const replies = repliesByQuestion.get(String(message.id));
      const snapshot = JSON.stringify([message.canRemove, message.kind, message.helpful, message.canMarkHelpful, reference, replies]);
      const oldRow = existing.get(String(message.id));
      const row = oldRow?.dataset.snapshot === snapshot ? oldRow : renderMessage(message, reference, question, replies, snapshot);
      if (oldRow && oldRow !== row) {
        const hasFocus = oldRow.contains(document.activeElement);
        oldRow.replaceWith(row);
        if (hasFocus) row.focus({ preventScroll: true });
      }
      if (messageList.children[index] !== row) messageList.insertBefore(row, messageList.children[index] || null);
    }
    renderComposer(view);
    if (chatVisible && (firstLoad || follow || nearby)) messageLog.scrollTop = messageLog.scrollHeight;
    else if (firstLoad || follow) view.needsFollow = true;
  }

  function roomPath(view) {
    const id = view.type === "session" ? `library:${view.id}` : view.id;
    return `/rooms/${encodeURIComponent(id)}/messages`;
  }

  async function refresh(view = activeView, follow = false) {
    if (!view || view !== activeView || view.pending || !user) return;
    const revision = view.revision;
    const isCurrent = () => view === activeView && view.revision === revision;
    view.pending = true;
    try {
      if (view.type === "library") {
        const { sessions } = await api("/library");
        if (isCurrent()) renderLibrary(sessions);
        return;
      }
      if (view.type === "session") {
        const { session } = await api(`/library/${view.id}`);
        if (!isCurrent()) return;
        renderSession(view, session);
        const ended = Date.parse(session.endsAt) <= Date.now();
        if (!session.joined || ended) {
          messageForm.hidden = true;
          messageList.replaceChildren();
          writeText("chat-status", ended ? "This study session has ended." : "Join the session to read and send messages.");
          return;
        }
      }
      const { messages } = await api(roomPath(view));
      if (!isCurrent()) return;
      renderMessages(view, messages, follow);
      messageForm.hidden = false;
      writeText("chat-status", messages.length ? "" : "No messages yet. Say hello to get started.");
    } catch (error) {
      if (!isCurrent()) return;
      writeText(view.type === "library" ? "library-status" : "chat-status", error.message);
    } finally {
      view.pending = false;
      if (view.refreshAgain) {
        const followAgain = view.followAgain;
        view.refreshAgain = false;
        view.followAgain = false;
        refresh(view, followAgain);
      }
    }
  }

  function refreshAfterWrite(view, follow = false) {
    view.revision = (view.revision || 0) + 1;
    if (view.pending) {
      view.refreshAgain = true;
      view.followAgain ||= follow;
    } else {
      refresh(view, follow);
    }
  }

  async function updatePresence(view, operation) {
    if (!view?.session || view !== activeView) return;
    if (operation === "leave") voice.setSession({ ...view.session, joined: false });
    if (view.presencePending) {
      if (operation !== "heartbeat") view.nextPresence = operation;
      return;
    }
    view.presencePending = true;
    const button = byId("join-session");
    if (operation !== "heartbeat") button.disabled = true;
    try {
      const { session } = await api(`/library/${view.id}/${operation === "leave" ? "leave" : "join"}`, "POST", {});
      if (view !== activeView) return;
      if (session) renderSession(view, session);
      else if (operation === "leave") {
        view.session.joined = false;
        voice.setSession(view.session);
        messageForm.hidden = true;
        messageList.replaceChildren();
      }
      if (operation !== "heartbeat") refreshAfterWrite(view);
    } catch (error) {
      if (view === activeView) {
        if (operation === "leave") refreshAfterWrite(view);
        writeText("chat-status", error.message);
      }
    } finally {
      view.presencePending = false;
      button.disabled = false;
      const next = view.nextPresence;
      delete view.nextPresence;
      if (next) updatePresence(view, next);
    }
  }

  async function signedIn(member, focus) {
    if (signedInOnce && byId("member").dataset.memberId !== String(member.id)) {
      clearDrafts();
      voice.setSession(null);
      activeView = null;
      board.hidden = true;
      resetLeaderboard();
    }
    signedInOnce = true;
    user = member;
    gate.hidden = true;
    status("Opening the common room…");
    const result = await api("/rooms");
    if (user !== member) return;
    rooms = result.rooms;
    byId("member").textContent = member.username;
    byId("member").dataset.memberId = String(member.id);
    setAvatar(byId("membership-avatar"), member.username);
    rewards = null;
    renderRewards();
    board.hidden = false;
    document.body.classList.add("community-active");
    status("");
    showRoute(focus);
    refreshRewards();
    refreshLeaderboard();
  }

  async function checkSession() {
    if (sessionCheck) return;
    sessionCheck = true;
    byId("retry").hidden = true;
    status("Checking your community session…");
    try {
      const result = await api("/session");
      if (result.user) {
        if (result.user.id === user?.id && !board.hidden) {
          status("");
          refreshRewards();
        } else await signedIn(result.user, false);
      }
      else signedOut();
    } catch (error) {
      status(error.message);
      byId("retry").hidden = false;
    } finally {
      sessionCheck = false;
    }
  }

  byId("retry").addEventListener("click", checkSession);
  byId("auth-mode").addEventListener("click", () => {
    registering = !registering;
    byId("auth-title").textContent = registering ? "Create a Studygram account" : "Sign in to Community";
    byId("auth-submit").textContent = registering ? "Create account" : "Sign in";
    byId("auth-mode").textContent = registering ? "I have an account" : "Create an account";
    byId("password").autocomplete = registering ? "new-password" : "current-password";
    byId("password-help").hidden = !registering;
    byId("auth-error").textContent = "";
    byId("username").removeAttribute("aria-invalid");
    byId("password").removeAttribute("aria-invalid");
    byId("username").focus();
  });
  byId("password-toggle").addEventListener("click", event => {
    const password = byId("password");
    const shown = password.type === "password";
    password.type = shown ? "text" : "password";
    event.currentTarget.textContent = shown ? "Hide" : "Show";
    event.currentTarget.setAttribute("aria-label", shown ? "Hide password" : "Show password");
  });
  bindForm(authForm, "auth-error", async fields => {
    const username = fields.username.value.trim();
    const password = fields.password.value;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/.test(username)) return fieldError(fields.username, "auth-error", "Enter a nickname with 3–24 letters, numbers, underscores or hyphens, starting with a letter or number.");
    if (!password || (registering && password.length < 15)) return fieldError(fields.password, "auth-error", registering ? "Choose a password with at least 15 characters." : "Enter your password.");
    const { user: member } = await api(registering ? "/register" : "/login", "POST", { username, password });
    fields.password.value = "";
    if (typeof StudygramPrivateSession !== "undefined") {
      StudygramPrivateSession.sessionChanged(window.location.href);
      return;
    }
    sessionChannel?.postMessage("session-changed");
    try {
      await signedIn(member, true);
    } catch (error) {
      status(error.message);
      byId("retry").hidden = false;
    }
  });
  byId("sign-out").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    voice.leave();
    try {
      if (typeof StudygramPrivateSession !== "undefined") await Storage.flush().catch(() => {});
      await api("/logout", "POST", {});
      if (typeof StudygramPrivateSession !== "undefined") {
        StudygramPrivateSession.sessionChanged(window.location.href);
        return;
      }
      sessionChannel?.postMessage("session-changed");
      clearDrafts();
      signedOut("You’re signed out of Community.");
      byId("username").focus();
    } catch (error) {
      status(error.message);
    } finally {
      button.disabled = false;
    }
  });
  bindForm(sessionForm, "compose-error", async fields => {
    const view = activeView;
    const title = fields.title.value.trim();
    if (!title) return fieldError(fields.title, "compose-error", "Enter a topic or goal for this session.");
    const { id } = await api("/library", "POST", { title, duration: Number(fields.duration.value) });
    sessionForm.reset();
    byId("compose").open = false;
    if (view === activeView) go("session", id);
  });
  bindForm(messageForm, "message-error", async fields => {
    const view = activeView;
    const member = user;
    const key = viewKey(view);
    const isSameRoom = () => user === member && activeView && viewKey(activeView) === key;
    const { mode } = view;
    const draftBody = fields.body.value;
    const body = draftBody.trim();
    if (!body) {
      const emptyMessage = { chat: "Write a message first.", question: "Write a question first.", answer: "Write your answer first." }[mode.kind];
      return fieldError(fields.body, "message-error", emptyMessage);
    }
    try {
      await api(roomPath(view), "POST", mode.kind === "chat" ? { body } : { body, ...mode });
    } catch (error) {
      if (isSameRoom()) throw error;
      return;
    }
    if (user !== member) return;
    const draft = roomDrafts.get(key);
    if (draft?.body === draftBody && draft.mode === mode) roomDrafts.delete(key);
    if (!isSameRoom()) return;
    if (fields.body.value === draftBody && activeView.mode === mode) {
      fields.body.value = "";
      activeView.mode = { kind: "chat" };
      renderComposer(activeView);
    }
    writeText("chat-feedback", { chat: "", question: "Question posted.", answer: "Answer posted." }[mode.kind]);
    refreshAfterWrite(activeView, true);
  });
  bindForm(actionForm, "dialog-error", async fields => {
    if (!action) return;
    const { kind, id, view } = action;
    const member = user;
    if (kind === "report") {
      if (!fields.reason.value) return fieldError(fields.reason[0], "dialog-error", "Select a reason before sending your report.");
      await api("/report", "POST", { targetId: id, reason: fields.reason.value });
    } else if (kind === "helpful") {
      await api(`/messages/${encodeURIComponent(id)}/helpful`, "POST", {});
    } else {
      await api(`/messages/${encodeURIComponent(id)}`, "DELETE");
    }
    dialog.close();
    if (user === member) refreshLeaderboard(true);
    if (view !== activeView) return;
    if (kind === "helpful") {
      writeText("chat-feedback", "Answer marked helpful. Its author earned 1 point.");
    } else {
      Array.from(messageList.children).find(child => child.dataset.id === String(id))?.remove();
      status(kind === "report" ? "Report sent. The message is hidden from your chat." : "Message removed.");
    }
    if (document.activeElement === document.body) messageLog.focus();
    refreshAfterWrite(view);
  });
  byId("dialog-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { action = null; });
  byId("refresh-library").addEventListener("click", () => refresh());
  byId("refresh-chat").addEventListener("click", () => {
    refresh();
    refreshRewards();
    refreshLeaderboard(true);
  });
  leaderboard.addEventListener("toggle", () => refreshLeaderboard());
  leaderboardRetry.addEventListener("click", () => refreshLeaderboard(true));
  for (const button of viewButtons) {
    button.addEventListener("click", () => setMobileView(button.dataset.communityView, true));
  }
  for (const button of standingsButtons) {
    button.addEventListener("click", () => setStandingsVisible(board.hasAttribute("data-standings-hidden")));
  }
  byId("message-mode").addEventListener("click", () => {
    setComposerMode({ kind: activeView?.mode?.kind === "chat" ? "question" : "chat" });
  });
  byId("join-session").addEventListener("click", () => {
    const view = activeView;
    updatePresence(view, view?.session?.joined ? "leave" : "join");
  });

  function heartbeat() {
    const view = activeView;
    if (view?.session?.joined && Date.parse(view.session.endsAt) > Date.now()) updatePresence(view, "heartbeat");
  }

  window.addEventListener("popstate", () => showRoute(true));
  window.addEventListener("hashchange", revealLinkedStandings);
  window.addEventListener("pageshow", event => {
    if (event.persisted) checkSession();
  });
  sessionChannel?.addEventListener("message", event => {
    if (event.data === "session-changed") checkSession();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    heartbeat();
    refresh();
    refreshRewards();
    refreshLeaderboard();
  });
  window.setInterval(() => {
    if (document.hidden) return;
    refresh();
    refreshRewards();
    refreshLeaderboard();
  }, 4000);
  window.setInterval(heartbeat, 15000);
  window.setInterval(countdown, 1000);
  if (typeof StudygramPrivateSession === "undefined") checkSession();
  else StudygramPrivateSession.start(checkSession);
})();
