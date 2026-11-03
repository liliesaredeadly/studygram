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
  const path = window.location.pathname;
  document.querySelectorAll(".navbar-links a").forEach(link => {
    link.classList.remove("active");
    if (path.includes(link.getAttribute("href"))) {
      link.classList.add("active");
    }
  });
  // Special case for home
  if (path.endsWith("/") || path.endsWith("index.html")) {
    document.querySelector('.navbar-links a[href="../index.html"]')?.classList.add("active");
  }
}

// ---- Page Transition ----
function navigateTo(url) {
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.25s ease";
  setTimeout(() => { window.location.href = url; }, 250);
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

// Sparkle every button/link click site-wide
document.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target.closest('a')) {
    createSparkles(e.clientX, e.clientY, 14);
  }
});

// ================================================================
// NAVBAR PROFILE PILL — shown on every page when signed in
// ================================================================
function renderNavProfile() {
  if (typeof Storage === 'undefined') return;
  const profile = Storage.getStudentProfile();
  const navLinks = document.querySelector('.navbar-links');
  if (!navLinks) return;

  // Remove existing profile pill
  navLinks.querySelector('.nav-profile')?.remove();

  if (profile) {
    const pill = document.createElement('div');
    pill.className = 'nav-profile';
    pill.style.cssText = `
      display:flex;align-items:center;gap:8px;
      background:rgba(201,169,110,0.10);
      border:1px solid rgba(201,169,110,0.28);
      border-radius:9999px;
      padding:5px 14px 5px 8px;
      cursor:pointer;margin-left:6px;
      transition:all 0.2s ease;
    `;
    pill.title = `View your passport — ${profile.studentId}`;
    pill.innerHTML = `
      <span style="font-size:1.05rem;">${profile.avatar || '🎓'}</span>
      <span style="font-family:'Jost',sans-serif;font-size:0.78rem;font-weight:500;
                   color:var(--accent);white-space:nowrap;">
        ${profile.name.split(' ')[0]}
      </span>
    `;
    pill.addEventListener('mouseover', () => {
      pill.style.background = 'rgba(201,169,110,0.18)';
      pill.style.borderColor = 'rgba(201,169,110,0.5)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.background = 'rgba(201,169,110,0.10)';
      pill.style.borderColor = 'rgba(201,169,110,0.28)';
    });
    pill.addEventListener('click', (e) => {
      createSparkles(e.clientX, e.clientY, 22);
      // Navigate to passport page
      const isInPages = window.location.pathname.includes('/pages/');
      window.location.href = isInPages ? 'login.html' : 'pages/login.html';
    });
    navLinks.appendChild(pill);
  } else {
    // Show "Sign In" link
    const existing = navLinks.querySelector('.nav-signin-link');
    if (!existing) {
      const a = document.createElement('a');
      a.className = 'nav-signin-link';
      a.href = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
      a.style.cssText = `
        margin-left:6px;padding:6px 14px;
        border:1px solid rgba(201,169,110,0.3);
        border-radius:9999px;
        font-size:0.78rem;font-weight:500;
        color:var(--accent);
        text-decoration:none;
        background:rgba(201,169,110,0.06);
        transition:all 0.2s ease;
      `;
      a.setAttribute('aria-label', 'Sign In');
      a.innerHTML = '🪪 <span>Sign In</span>';
      navLinks.appendChild(a);
    }
  }
}

// ---- Run on every page load ----
document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNav();
  renderNavProfile();
  // Fade in the page
  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 0.3s ease";
    document.body.style.opacity = "1";
  });
});
