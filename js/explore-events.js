const ExploreEvents = (() => {
  "use strict";

  const PAGE_SIZE = 5;
  const RECENT_DAYS = 30;
  const dateFormats = timeZone => ({
    full: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone }),
    month: new Intl.DateTimeFormat(undefined, { month: "short", timeZone }),
    day: new Intl.DateTimeFormat(undefined, { day: "numeric", timeZone }),
    year: new Intl.DateTimeFormat(undefined, { year: "numeric", timeZone }),
  });
  const calendar = dateFormats("UTC");
  const local = dateFormats();
  const timeOptions = { hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const localTime = new Intl.DateTimeFormat(undefined, timeOptions);
  const localDateTime = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", ...timeOptions });
  const checkedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const formatLabels = { online: "Online", hybrid: "Hybrid", "in-person": "In person" };

  function normalizeEvent(event) {
    if (typeof event?.title !== "string" || !event.title.trim()) return null;
    const start = parseDate(event.startDate);
    const end = parseDate(event.endDate) || start;
    if (!start) return null;
    const startTime = boundary(start);
    const endTime = boundary(end, true);
    if (endTime < startTime) return null;
    try {
      const url = new URL(event.url);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      return { ...event, url: url.href, start, end, startTime, endTime };
    } catch {
      return null;
    }
  }

  function parseDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
    const allDay = value.length === 10;
    const date = new Date(allDay ? `${value}T00:00:00Z` : value);
    if (!Number.isFinite(date.getTime()) || (allDay && date.toISOString().slice(0, 10) !== value)) return null;
    return { value, date, allDay };
  }

  function boundary({ date, allDay }, includeFullDay = false) {
    if (!allDay) return date.getTime();
    const localMidnight = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + Number(includeFullDay));
    return localMidnight.getTime() - Number(includeFullDay);
  }

  function schedule(start, end) {
    if (start.allDay && end.allDay) return start.value === end.value ? "" : calendar.full.formatRange(start.date, end.date);
    if (!start.allDay && !end.allDay) {
      const sameDay = local.full.format(start.date) === local.full.format(end.date);
      const format = sameDay ? localTime : localDateTime;
      return format.formatRange(start.date, end.date);
    }
    const print = point => (point.allDay ? calendar.full : localDateTime).format(point.date);
    return `${print(start)} – ${print(end)}`;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function eventRow(event) {
    const row = element("li");
    const link = element("a", "atlas-event-row");
    link.href = event.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const date = element("time", "atlas-event-date");
    date.dateTime = event.start.value;
    const { date: start, allDay } = event.start;
    const formats = allDay ? calendar : local;
    const stamp = element("span", "atlas-event-date-stamp");
    stamp.setAttribute("aria-hidden", "true");
    stamp.append(element("span", "", formats.month.format(start)), element("strong", "", formats.day.format(start)), element("span", "", formats.year.format(start)));
    date.append(stamp, element("span", "atlas-sr", formats.full.format(start)));

    const info = element("span", "atlas-event-info");
    info.append(element("strong", "atlas-event-name", event.title));
    const format = Object.hasOwn(formatLabels, event.format) ? formatLabels[event.format] : "";
    const place = typeof event.location === "string" ? event.location.trim() : "";
    const location = place.toLowerCase() === format.toLowerCase() ? place : [format, place].filter(Boolean).join(" · ");
    const source = typeof event.source === "string" ? event.source : "";
    const details = [schedule(event.start, event.end), location, source].filter(Boolean).join(" · ");
    if (details) info.append(element("span", "atlas-event-meta", details));

    const action = element("span", "atlas-event-action");
    action.setAttribute("aria-hidden", "true");
    action.append(element("span", "atlas-event-action-label", "Event details"), element("span", "", "↗"));
    link.append(date, info, action, element("span", "atlas-sr", " (opens in a new tab)"));
    row.append(link);
    return row;
  }

  function mount(root, hasTechnologyInterest) {
    root.innerHTML = `
      <header class="atlas-events-heading">
        <div>
          <p class="atlas-eyebrow">Explore calendar</p>
          <h2 id="tech-events-title">Tech events</h2>
          <p class="atlas-events-intro"></p>
        </div>
        <div class="atlas-events-filters">
          <div class="atlas-events-period" role="group" aria-label="Event dates">
            <button class="btn btn-secondary" type="button" data-event-period="upcoming" aria-pressed="true">Upcoming</button>
            <button class="btn btn-secondary" type="button" data-event-period="recent" aria-pressed="false">Recent</button>
          </div>
          <button class="btn btn-secondary atlas-events-online" type="button" aria-pressed="false">Online &amp; hybrid</button>
        </div>
      </header>
      <p class="atlas-events-status" role="status"></p>
      <ul class="atlas-events-list" aria-label="Technology events" hidden></ul>
      <button class="btn btn-secondary atlas-events-retry" type="button" hidden>Retry</button>
      <button class="btn btn-secondary atlas-events-more" type="button" hidden>Show more events</button>
      <footer class="atlas-events-footer">
        <p>Organizer calendars <span aria-hidden="true">·</span>
          <a href="https://events.vtools.ieee.org/events/search" target="_blank" rel="noopener noreferrer">IEEE <span aria-hidden="true">↗</span><span class="atlas-sr"> (opens in a new tab)</span></a>
          <span aria-hidden="true">·</span>
          <a href="https://ghw.mlh.com/" target="_blank" rel="noopener noreferrer">Major League Hacking <span aria-hidden="true">↗</span><span class="atlas-sr"> (opens in a new tab)</span></a>
        </p>
        <p><a href="community.html?room=technology">Discuss events in Tech GC <span aria-hidden="true">↗</span></a></p>
        <p class="atlas-events-checked"></p>
      </footer>`;

    const heading = root.querySelector("h2");
    const intro = root.querySelector(".atlas-events-intro");
    const status = root.querySelector(".atlas-events-status");
    const list = root.querySelector(".atlas-events-list");
    const retry = root.querySelector(".atlas-events-retry");
    const more = root.querySelector(".atlas-events-more");
    const checked = root.querySelector(".atlas-events-checked");
    const online = root.querySelector(".atlas-events-online");
    const filters = root.querySelectorAll("[data-event-period]");
    let period = "upcoming";
    let onlineOnly = false;
    let limit = PAGE_SIZE;
    let feed;
    let loading = false;

    function refreshInterest() {
      const saved = hasTechnologyInterest();
      heading.textContent = saved ? "Tech events for you" : "Tech events";
      intro.textContent = saved
        ? "Events from organizer calendars for your saved Technology interest."
        : "Find workshops, meetups, and hackathons from organizer calendars.";
    }

    function render() {
      retry.hidden = feed !== null && !feed?.stale;
      retry.setAttribute("aria-disabled", String(loading));
      more.hidden = true;
      list.replaceChildren();
      list.hidden = true;
      checked.textContent = "";
      if (loading) {
        status.textContent = "Checking organizer calendars…";
        return;
      }
      if (!feed) {
        status.textContent = "Events couldn’t load. Try again or browse the organizer calendars below.";
        return;
      }

      const now = Date.now();
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
      const upcoming = period === "upcoming";
      const eligible = onlineOnly ? feed.events.filter(event => event.format === "online" || event.format === "hybrid") : feed.events;
      const events = upcoming
        ? eligible.filter(event => event.endTime >= now).sort((a, b) => a.startTime - b.startTime)
        : eligible.filter(event => event.endTime >= cutoff.getTime() && event.endTime < now).sort((a, b) => b.endTime - a.endTime);

      const shown = events.slice(0, limit);
      list.append(...shown.map(eventRow));
      list.hidden = !shown.length;
      more.hidden = shown.length >= events.length;
      const eventType = onlineOnly ? "online or hybrid event" : "event";
      let summary = upcoming ? `No upcoming ${eventType}s are listed right now.` : `No ${eventType}s ended in the last 30 days.`;
      if (events.length) {
        const count = `${events.length} ${period} ${eventType}${events.length === 1 ? "" : "s"}`;
        summary = shown.length < events.length ? `Showing ${shown.length} of ${count}.` : `${count}.`;
      }
      status.textContent = feed.stale ? `Organizer calendars couldn’t refresh. ${summary}` : summary;
      const updated = typeof feed.updatedAt === "string" ? new Date(feed.updatedAt) : null;
      if (updated && Number.isFinite(updated.getTime())) checked.textContent = `Checked ${checkedAt.format(updated)}`;
    }

    async function load() {
      if (loading) return;
      loading = true;
      render();
      try {
        const response = await fetch("/api/events");
        if (!response.ok) throw new Error("Event feed unavailable");
        const data = await response.json();
        if (!Array.isArray(data?.events)) throw new Error("Invalid event feed");
        feed = { ...data, events: data.events.map(normalizeEvent).filter(Boolean) };
      } catch {
        feed = feed ? { ...feed, stale: true } : null;
      } finally {
        loading = false;
        const focusFilter = feed && !feed.stale && document.activeElement === retry;
        render();
        if (focusFilter) Array.from(filters).find(filter => filter.dataset.eventPeriod === period)?.focus();
      }
    }

    for (const button of filters) {
      button.addEventListener("click", () => {
        if (button.dataset.eventPeriod === period) return;
        period = button.dataset.eventPeriod;
        limit = PAGE_SIZE;
        for (const filter of filters) filter.setAttribute("aria-pressed", String(filter === button));
        render();
      });
    }
    online.addEventListener("click", () => {
      onlineOnly = !onlineOnly;
      online.setAttribute("aria-pressed", String(onlineOnly));
      limit = PAGE_SIZE;
      render();
    });
    retry.addEventListener("click", load);
    more.addEventListener("click", () => {
      const next = list.children.length;
      limit += PAGE_SIZE;
      render();
      list.children[next]?.firstElementChild?.focus();
    });
    refreshInterest();
    load();
    return refreshInterest;
  }

  return { mount };
})();
