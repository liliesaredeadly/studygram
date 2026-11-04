// ============================================================
// app.js — Shared utilities used by every page
// ============================================================

// ---- Toast Notifications ----
// Small pop-up messages that appear in the top-right corner

function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "💡", warning: "⚠️" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "💡"}</span>
    <span class="toast-text"></span>
  `;
  toast.querySelector(".toast-text").textContent = message;
  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- Loading State Helper ----
// Shows/hides a spinner inside any element

function setLoading(element, isLoading, loadingText = "AI is thinking...") {
  if (!element) return;
  if (isLoading) {
    element.dataset.originalHTML = element.innerHTML;
    element.innerHTML = `<div class="loading-overlay">
      <div class="spinner"></div>
      <p>${loadingText}</p>
    </div>`;
  } else {
    element.innerHTML = element.dataset.originalHTML || "";
  }
}

// ---- Button Loading State ----
function setBtnLoading(btn, isLoading, loadingText = "Loading...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px;"></span> ${loadingText}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

// ---- Navigation Highlight ----
// Adds "active" class to the nav link matching the current page

function highlightActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '/index.html');
  document.querySelectorAll(".navbar-links > a").forEach(link => {
    const current = !link.hidden && link.hasAttribute('href') && new URL(link.href).pathname === path;
    link.classList.toggle('active', current);
    if (current) link.setAttribute('aria-current', 'page');
    else if (link.getAttribute('aria-current') === 'page') link.removeAttribute('aria-current');
  });
}

function navigateTo(url) {
  window.location.href = url;
}

function setExploreReturnLink(linkId, category) {
  const link = document.getElementById(linkId);
  link.hidden = !category;
  if (category) link.href = `explore.html?category=${encodeURIComponent(category)}`;
}

// ---- Format date nicely ----
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

// ---- Show an AI service error ----
function handleAPIError(error, containerEl, retry = () => location.reload()) {
  const message = error.message || "Something went wrong. Please try again.";
  if (containerEl) {
    containerEl.innerHTML = `
      <div class="card completion-card">
        <p role="alert"></p>
        <button class="btn btn-secondary btn-sm" type="button">Try Again</button>
        <a href="study.html" class="btn btn-ghost btn-sm">Open Study Sets</a>
      </div>`;
    containerEl.querySelector("p").textContent = message;
    containerEl.querySelector("button").addEventListener("click", retry);
  }
  showToast(message, "error");
}

// ================================================================
// GLOBAL SPARKLE BURST — available on every page
// ================================================================
const _sparkleChars  = ['✦','★','✧','⋆','◆','✴','✵','❋','✿','❀','✽'];
const _sparkleColors = ['#C9A96E','#9B8EC4','#B97A78','#7A9E8E','#D4B896','#8B7355'];

function createSparkles(x, y, count = 18) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < count; i++) {
    const el       = document.createElement('span');
    const size     = 9 + Math.random() * 13;
    const color    = _sparkleColors[Math.floor(Math.random() * _sparkleColors.length)];
    const angle    = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.6;
    const distance = 40 + Math.random() * 100;
    const dx       = Math.cos(angle) * distance;
    const dy       = Math.sin(angle) * distance;
    const duration = 550 + Math.random() * 600;
    const delay    = Math.random() * 80;

    el.textContent = _sparkleChars[Math.floor(Math.random() * _sparkleChars.length)];
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;
      font-size:${size}px;color:${color};
      pointer-events:none;z-index:99999;
      transform:translate(-50%,-50%) scale(1) rotate(0deg);
      opacity:1;
      transition:transform ${duration}ms ${delay}ms ease-out,
                 opacity   ${duration}ms ${delay}ms ease-out;
      will-change:transform,opacity;
    `;
    document.body.appendChild(el);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(0) rotate(${(Math.random()-0.5)*720}deg)`;
      el.style.opacity = '0';
    }));

    setTimeout(() => el.remove(), duration + delay + 150);
  }
}

// ================================================================
// PASSPORT AVATARS — one collection for the picker, card and navigation
// ================================================================
const PassportAvatars = Object.freeze([
  ['pink-heart', 'Pink heart'],
  ['retro-computer', 'Retro computer'],
  ['tamagotchi', 'Pink Tamagotchi'],
  ['grey-cat', 'Grey cat'],
  ['pink-sneaker', 'Pink sneaker'],
  ['sandwich-cookie', 'Sandwich cookie'],
  ['anatomical-heart', 'Anatomical heart'],
  ['pixel-dinosaur', 'Pixel dinosaur'],
  ['coffee-cup', 'Coffee cup'],
  ['spade-card', 'Spade card'],
  ['pixel-eye', 'Pixel eyeball'],
  ['arcade-machine', 'Arcade machine'],
  ['chocolate-chip-cookie', 'Chocolate chip cookie'],
  ['pixel-cursor', 'Pixel cursor'],
  ['red-mushroom', 'Red mushroom'],
].map(([id, name]) => Object.freeze({ id, name })));

// Give passports saved with an old emoji a stable sprite until their next save.
const LegacyPassportAvatars = ['🎓','📚','🦊','🦋','🌸','🌙','⭐','🎨','🔬','🌿','🦅','🧠','🌺','🪐','🎭'];
const passportAvatarDirectory = new URL('../assets/avatars/', document.currentScript?.src || document.baseURI);

function getPassportAvatar(value) {
  return PassportAvatars.find(avatar => avatar.id === value)
    || PassportAvatars[LegacyPassportAvatars.indexOf(value)]
    || PassportAvatars[0];
}

function createPassportAvatar(value, size, decorative = false) {
  const avatar = getPassportAvatar(value);
  const image = document.createElement('img');
  image.className = 'passport-avatar-art';
  image.src = new URL(`${avatar.id}.svg`, passportAvatarDirectory).href;
  image.alt = decorative ? '' : `${avatar.name} avatar`;
  image.width = image.height = size;
  image.draggable = false;
  return image;
}

// ================================================================
// NAVBAR PROFILE — shared access to the Passport and learning activity
// ================================================================
function profilePreviewText(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function profilePreviewLink(href, label, className) {
  const link = profilePreviewText('a', label, className);
  link.href = href;
  link.addEventListener('click', () => closeNavProfile());
  return link;
}

function createProfilePreviewSection(title, href, linkLabel) {
  const section = document.createElement('section');
  section.className = 'nav-profile-section';
  const header = document.createElement('div');
  header.className = 'nav-profile-section-heading';
  header.append(profilePreviewText('h2', title), profilePreviewLink(href, linkLabel, 'nav-profile-more'));
  section.append(header);
  return section;
}

function communityRewardTotal({ helpfulAnswers, achievementPoints, reelLikes }) {
  return helpfulAnswers + achievementPoints + reelLikes;
}

async function loadCommunityRewards(accountId) {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return null;
  const response = await fetch(`/api/community/rewards?accountId=${encodeURIComponent(accountId)}`, {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw Object.assign(new Error('Couldn’t load Community rewards.'), { status: response.status });
  const rewards = await response.json();
  for (const value of [rewards.helpfulAnswers, rewards.achievementPoints, rewards.reelLikes]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Community returned an invalid point balance.');
  }
  return rewards;
}

function createNavProfileRewards(community) {
  const section = createProfilePreviewSection('Reward points', community, 'Open Community');
  const breakdown = document.createElement('dl');
  breakdown.className = 'nav-profile-reward-breakdown';
  const status = profilePreviewText('p', 'Loading reward points…', 'nav-profile-empty');
  const balance = document.createElement('div');
  balance.setAttribute('aria-live', 'polite');

  function addPoints(label, value) {
    const row = document.createElement('div');
    const points = profilePreviewText('dd', value);
    row.append(profilePreviewText('dt', label), points);
    breakdown.append(row);
    return points;
  }

  const total = addPoints('Total points', '—');
  const helpful = addPoints('Helpful answers', '—');
  const achievements = addPoints('Verified achievements', '—');
  const reelLikes = addPoints('Reel likes', '—');
  balance.append(breakdown, status);
  section.append(balance);

  async function loadPoints() {
    try {
      const member = StudygramPrivateSession.user();
      const rewards = await loadCommunityRewards(member?.id);
      if (!rewards) {
        status.textContent = 'Sign in to Community to see your account points.';
        return;
      }
      total.textContent = String(communityRewardTotal(rewards));
      helpful.textContent = String(rewards.helpfulAnswers);
      achievements.textContent = String(rewards.achievementPoints);
      reelLikes.textContent = String(rewards.reelLikes);
      status.textContent = '';
    } catch {
      status.textContent = 'Couldn’t load Community points. Reopen the menu to try again.';
    }
  }

  loadPoints();
  return section;
}

function renderNavProfilePreview(panel, profile, home, pages) {
  const passport = profilePreviewLink(
    `${pages}login.html${profile ? '?view=passport' : ''}`, '', 'nav-profile-passport'
  );
  const passportText = document.createElement('div');
  passportText.append(profilePreviewText('small', 'Student Passport', 'nav-profile-kicker'));
  if (profile) {
    passport.append(createPassportAvatar(profile.avatar, 44, true));
    passportText.append(profilePreviewText('strong', profile.name.trim() || 'Your Studygram'));
    const details = [profile.year, profile.stream]
      .filter(value => typeof value === 'string' && value.trim()).join(' · ');
    if (details) passportText.append(profilePreviewText('span', details, 'nav-profile-passport-details'));
  } else {
    passportText.append(profilePreviewText('strong', Storage.isSignedIn() ? 'Create a Passport' : 'Sign in to Studygram'));
  }
  passport.append(passportText);
  const arrow = profilePreviewText('span', '↗', 'nav-profile-passport-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  passport.append(arrow);

  const topics = Storage.getTopics();
  const { milestones } = Storage.getLearningProgress({ topics });
  const rewards = createNavProfileRewards(`${pages}community.html`);
  const achievements = createProfilePreviewSection('Personal milestones', `${home}#achievements`, 'All milestones');
  if (milestones.length) {
    const list = document.createElement('ul');
    list.className = 'nav-profile-milestones';
    list.append(...milestones.slice(-2).map(label => profilePreviewText('li', label)));
    achievements.append(list);
  } else {
    achievements.append(profilePreviewText('p', 'Your first milestone will appear here.', 'nav-profile-empty'));
  }

  const saved = createProfilePreviewSection('Saved items', `${home}#study-sets`, 'All saved items');
  const subjectLabels = new Map([
    ['defence', 'Defence & Security'], ['arts', 'Arts & Creativity'], ['music', 'Music'],
    ['literature', 'Literature & Languages'], ['science', 'Science'],
    ['technology', 'Technology'], ['research', 'Research & Innovation'],
  ]);
  const interests = Storage.getExploreNotebook().saved.filter(id => subjectLabels.has(id));
  const savedLinks = topics.slice().sort((a, b) => b.id - a.id).slice(0, 2).map(topic =>
    profilePreviewLink(`${pages}lesson.html?topicId=${encodeURIComponent(topic.id)}`, topic.name, 'nav-profile-saved-link')
  );
  for (const id of interests.slice(savedLinks.length ? -1 : -2).reverse()) {
    savedLinks.push(profilePreviewLink(
      `${pages}explore.html?category=${encodeURIComponent(id)}`, subjectLabels.get(id), 'nav-profile-saved-link'
    ));
  }
  if (savedLinks.length) {
    const list = document.createElement('ul');
    list.className = 'nav-profile-saved-list';
    for (const link of savedLinks) {
      const row = document.createElement('li');
      row.append(link);
      list.append(row);
    }
    saved.append(list);
  } else {
    saved.append(profilePreviewText('p', 'Your study sets and saved interests will appear here.', 'nav-profile-empty'));
  }
  const chats = createProfilePreviewSection('Group chats', `${pages}community.html`, 'All rooms');
  const roomList = document.createElement('ul');
  roomList.className = 'nav-profile-chat-list';
  for (const [id, label] of [
    ['technology', 'Tech GC'],
    ['research', 'Research GC'],
    ['study-lounge', 'Study Lounge'],
  ]) {
    const item = document.createElement('li');
    item.append(profilePreviewLink(`${pages}community.html?room=${id}`, label, 'nav-profile-chat-link'));
    roomList.append(item);
  }
  chats.append(roomList);
  panel.replaceChildren(passport, rewards, achievements, saved, chats);
}

function renderNavProfile() {
  if (typeof Storage === 'undefined') return;
  const navLinks = document.querySelector('.navbar-links');
  if (!navLinks) return;
  const profile = Storage.getStudentProfile();
  const oldProfile = navLinks.querySelector('.nav-profile');
  const hadFocus = oldProfile?.contains(document.activeElement);
  oldProfile?.remove();
  const passportLink = navLinks.querySelector(':scope > a[href="login.html"]');
  if (passportLink) passportLink.hidden = true;

  const inPages = window.location.pathname.includes('/pages/');
  const home = inPages ? '../index.html' : 'index.html';
  const pages = inPages ? '' : 'pages/';
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-profile';
  const trigger = document.createElement('button');
  trigger.className = 'nav-profile-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Your profile');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'nav-profile-panel');
  if (profile) {
    trigger.append(createPassportAvatar(profile.avatar, 30, true));
  } else {
    trigger.innerHTML = '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19v-.8a6.5 6.5 0 0 1 13 0v.8"/></svg>';
  }

  const panel = document.createElement('div');
  panel.className = 'nav-profile-panel';
  panel.id = 'nav-profile-panel';
  panel.hidden = true;
  wrapper.append(trigger, panel);
  navLinks.append(wrapper);
  trigger.addEventListener('click', () => {
    if (!panel.hidden) return closeNavProfile();
    renderNavProfilePreview(panel, profile, home, pages);
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    // Keep the panel inside the viewport when the avatar wraps on a narrow navbar.
    panel.style.translate = '';
    const box = panel.getBoundingClientRect();
    panel.style.setProperty('--profile-available-height', `${Math.max(0, window.innerHeight - box.top - 12)}px`);
    const rightEdge = document.documentElement.clientWidth - 12;
    const shift = box.left < 12 ? 12 - box.left : Math.min(0, rightEdge - box.right);
    if (shift) panel.style.translate = `${shift}px`;
  });
  if (hadFocus) trigger.focus({ preventScroll: true });
  highlightActiveNav();
}

function closeNavProfile(restoreFocus = false) {
  const panel = document.getElementById('nav-profile-panel');
  if (!panel || panel.hidden) return;
  const trigger = panel.previousElementSibling;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger.focus();
}

function dismissNavProfile(event) {
  const panel = document.getElementById('nav-profile-panel');
  if (panel && !panel.parentElement.contains(event.target)) closeNavProfile();
}

function renderWorldNavigation() {
  const nav = document.querySelector('.indie-nav, .academy .navbar, .diary-page .navbar, .explore-page .navbar, .growth-page .navbar, .wisdom-page .navbar');
  if (!nav) return;
  nav.classList.add('world-navigation');
  const labels = { 'lesson.html': 'Learn', 'quiz.html': 'Quiz', 'diary.html': 'Diary', 'explore.html': 'Explore', 'study.html': 'New set', 'growth.html': 'Growth' };
  const list = nav.querySelector('.navbar-links');
  if (!list) return;
  for (const link of list.querySelectorAll('a')) {
    const page = link.getAttribute('href')?.split('/').pop();
    if (page === 'index.html') link.hidden = true;
    else if (Object.hasOwn(labels, page)) {
      link.textContent = labels[page];
      if (page === 'study.html') link.setAttribute('aria-label', 'New Study Set');
    }
  }
}

// ---- Run on every page load ----
document.addEventListener("DOMContentLoaded", async () => {
  renderWorldNavigation();
  if (typeof StudygramPrivateSession !== 'undefined') await StudygramPrivateSession.ready;
  renderNavProfile();
  if (document.getElementById('nav-profile-panel') && typeof BroadcastChannel === 'function') {
    const communityChannel = new BroadcastChannel('studygram-community');
    communityChannel.addEventListener('message', event => {
      if (event.data === 'session-changed') closeNavProfile();
    });
  }
});
window.addEventListener('studygram:save-error', event => {
  showToast(event.detail || 'Studygram couldn’t save your changes. Try again.', 'error', 6000);
});
document.addEventListener('pointerdown', dismissNavProfile);
document.addEventListener('focusin', dismissNavProfile);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeNavProfile(true);
});
window.addEventListener('resize', () => closeNavProfile());
window.addEventListener('storage', event => {
  if (event.key === 'sg_student' || event.key === null) renderNavProfile();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) renderNavProfile();
});
