const ReelVideo = (() => {
  const panel = document.getElementById("reel-video-panel");
  const status = document.getElementById("reel-video-status");
  const details = document.getElementById("reel-video-details");
  const video = document.getElementById("reel-video");
  const download = document.getElementById("reel-download");
  const retry = document.getElementById("reel-retry");
  const signIn = document.getElementById("reel-sign-in");
  const quiz = document.getElementById("reel-quiz");
  const preview = document.getElementById("reel-preview");
  const share = document.getElementById("lesson-reel-share");
  const shared = document.getElementById("lesson-reel-shared");
  const shareDialog = document.getElementById("reel-share-dialog");
  const shareForm = document.getElementById("reel-share-form");
  const shareName = document.getElementById("reel-share-name");
  const shareStatus = document.getElementById("reel-share-status");
  const shareSignIn = document.getElementById("reel-share-sign-in");
  const shareCancel = document.getElementById("reel-share-cancel");
  const shareSubmit = document.getElementById("reel-share-submit");
  let controller;
  let showPreview;
  let shareReel;

  async function request(path, options) {
    const response = await fetch(`/api/reel-jobs${path}`, options);
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      throw Object.assign(new Error(body?.error || "Studygram couldn’t reach the reel renderer. Try again."), { status: response.status });
    }
    return body;
  }

  function clear() {
    controller?.abort();
    panel.hidden = true;
    details.textContent = "";
    retry.hidden = true;
    signIn.hidden = true;
    share.hidden = true;
    shared.hidden = true;
    shareReel = null;
    if (shareDialog.open) shareDialog.close();
    download.hidden = true;
    download.removeAttribute("href");
    video.hidden = true;
    video.onended = null;
    video.onerror = null;
    video.onplay = null;
    if (video.hasAttribute("src")) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    showPreview = null;
  }

  function setPreview(visible) {
    preview.setAttribute("aria-expanded", String(visible));
    preview.textContent = visible ? "Close storyboard preview" : "Storyboard preview";
    if (visible && !video.hidden) video.pause();
    showPreview?.(visible);
  }

  preview.addEventListener("click", () => setPreview(preview.getAttribute("aria-expanded") !== "true"));

  share.addEventListener("click", () => {
    if (!shareReel) return;
    video.pause();
    shareName.value = shareReel.title;
    shareStatus.textContent = "";
    shareSignIn.hidden = true;
    shareDialog.showModal();
    shareName.focus();
  });
  shareCancel.addEventListener("click", () => shareDialog.close());
  shareDialog.addEventListener("cancel", event => {
    if (shareSubmit.disabled) event.preventDefault();
  });
  shareForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!shareReel || shareSubmit.disabled) return;
    const reel = shareReel;
    const title = shareName.value.trim();
    if (!title) {
      shareStatus.textContent = "Enter a title for your reel.";
      shareName.focus();
      return;
    }
    shareSubmit.disabled = shareCancel.disabled = true;
    shareSignIn.hidden = true;
    shareStatus.textContent = "Publishing reel…";
    try {
      const response = await fetch("/api/community/reels", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId: reel.id, title }),
        signal: AbortSignal.any([reel.signal, AbortSignal.timeout(10000)]),
      });
      if (reel !== shareReel) return;
      if (response.status === 401) {
        if (typeof StudygramPrivateSession !== "undefined") shareSignIn.href = StudygramPrivateSession.signInURL();
        shareSignIn.hidden = false;
        shareStatus.textContent = "Sign in to Studygram to publish your reel.";
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Couldn’t publish the reel. Try again.");
      }
      shareDialog.close();
      share.hidden = true;
      shared.hidden = false;
      shared.querySelector("a").focus({ preventScroll: true });
    } catch (error) {
      if (reel === shareReel) shareStatus.textContent = error.name === "TimeoutError" || error instanceof TypeError
        ? "Couldn’t reach Student reels. Try again." : error.message;
    } finally {
      shareSubmit.disabled = shareCancel.disabled = false;
    }
  });

  function open(topic, content, togglePreview, replace = false) {
    clear();
    showPreview = togglePreview;
    setPreview(false);
    panel.hidden = false;
    status.textContent = "Preparing your reel…";
    quiz.href = topic.id ? `quiz.html?topicId=${topic.id}` : `quiz.html?topic=${encodeURIComponent(topic.name)}`;
    const signal = (controller = new AbortController()).signal;

    function showFailure(message, replaceVideo = false, needsSignIn = false) {
      video.hidden = true;
      download.hidden = true;
      share.hidden = true;
      status.textContent = message;
      details.textContent = "";
      retry.onclick = () => open(topic, content, togglePreview, replaceVideo);
      retry.hidden = false;
      signIn.hidden = !needsSignIn;
      if (needsSignIn && typeof StudygramPrivateSession !== "undefined") signIn.href = StudygramPrivateSession.signInURL();
    }

    async function render() {
      const account = typeof StudygramPrivateSession === "undefined" ? {} : {
        accountId: StudygramPrivateSession.user()?.id ?? null,
      };
      let job = await request("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: topic.name, scenes: content.scenes, storyboard: content.storyboard, replace, ...account }),
        signal,
      });
      while (!signal.aborted) {
        status.textContent = job.message;
        if (job.stage === "failed") throw new Error(job.message);
        if (job.stage === "ready") {
          details.textContent = [job.engine && `Narration: ${job.engine}`, job.warning].filter(Boolean).join(" · ");
          video.onended = () => {
            recordLessonCompletion(topic);
            status.textContent = "What did you take away? Try Explain It Yourself or take the quiz.";
          };
          video.onplay = () => {
            if (preview.getAttribute("aria-expanded") === "true") setPreview(false);
          };
          video.onerror = () => showFailure("This video couldn’t be played. You can render it again.", true);
          video.src = job.videoUrl;
          video.hidden = false;
          download.href = job.downloadUrl;
          download.hidden = false;
          shareReel = { id: job.id, title: topic.name, signal };
          share.hidden = false;
          topic.reelId = job.id;
          try { if (topic.id) Storage.saveStudyReel(topic.id, job.id); } catch { /* The reel is still playable. */ }
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (signal.aborted) return;
        job = await request(`/${job.id}`, { signal });
      }
    }

    void render().catch(error => {
      if (!signal.aborted) showFailure(error.message, replace, error.status === 401);
    });
  }

  return { open, clear, hidePreview: () => setPreview(false) };
})();
