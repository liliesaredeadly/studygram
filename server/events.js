const endpoint = "https://events.vtools.ieee.org/RST/events/api/public/v8/events/list.json";
const day = 24 * 60 * 60 * 1000;
const refreshInterval = 15 * 60 * 1000;
const retryInterval = 60 * 1000;
const maxCacheAge = day;

const topicPatterns = [
  ["AI & data", /\b(?:ai|machine learning|deep learning|data science|generative ai|llms?|computer vision|analytics)\b/i],
  ["Coding", /\b(?:coding|programming|software|python|javascript|next\.js|web development|open source|git|developers?)\b/i],
  ["Cybersecurity", /\b(?:cyber\w*|security|privacy|cryptography)\b/i],
  ["Robotics & electronics", /\b(?:robot\w*|electronics|hardware|embedded|iot|internet of things|semiconductors?|circuits?)\b/i],
  ["Cloud & networks", /\b(?:cloud|networks?|telecommunications?|5g|6g|kubernetes|devops)\b/i],
  ["Engineering", /\b(?:engineer\w*|energy|power|electric vehicles?|quantum|satellites?|renewables?)\b/i],
];

function eventDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeEvent(row, countries) {
  const item = row?.attributes;
  if (!item || item.publish !== true || item.cancelled !== false || !/^\d+$/.test(row.id)) return null;
  const title = typeof item.title === "string" ? item.title.trim().replace(/\s+/g, " ") : "";
  const startDate = eventDate(item["start-time"]);
  const endDate = eventDate(item["end-time"]) || startDate;
  if (!title || !startDate || endDate < startDate) return null;

  const locationType = item["location-type"];
  const format = locationType === "hybrid" ? "hybrid"
    : locationType === "virtual" || item.virtual === true ? "online"
    : locationType === "physical" || item.virtual === false ? "in-person" : "unknown";
  const city = typeof item.city === "string" ? item.city.trim().slice(0, 100) : "";
  const country = countries.get(row.relationships?.country?.data?.id) || "";
  const location = format === "online" ? "Online" : [...new Set([city, country].filter(Boolean))].join(", ");
  const searchText = `${title} ${typeof item.keywords === "string" ? item.keywords : ""}`;
  const topics = topicPatterns.filter(([, pattern]) => pattern.test(searchText)).map(([topic]) => topic);
  return {
    id: `ieee-${row.id}`, title: title.slice(0, 240), startDate, endDate, location, format,
    url: `https://events.vtools.ieee.org/m/${row.id}`, source: "IEEE", topics,
  };
}

async function fetchEvents(lookup, span, sort) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ span, sort, limit: "60", category_id: "2" });
  const response = await lookup(url, {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) throw new Error("Event source request failed.");
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error("Invalid event source response.");
  const included = Array.isArray(payload.included) ? payload.included : [];
  const countries = new Map(included
    .filter(item => item?.type === "countries" && typeof item.attributes?.name === "string")
    .map(item => [item.id, item.attributes.name.trim().slice(0, 100)]));
  return payload.data.map(row => normalizeEvent(row, countries)).filter(Boolean);
}

function createEventFeed({ lookup = fetch, now = Date.now } = {}) {
  let cached;
  let pending;
  let retryAfter = 0;

  function lastAvailable() {
    if (cached && now() - cached.fetchedAt < maxCacheAge) return { ...cached.result, stale: true };
    throw Object.assign(new Error("Technology events couldn’t refresh. Try again in a moment."), { status: 503 });
  }

  async function refresh() {
    try {
      const [upcoming, recent] = await Promise.all([
        fetchEvents(lookup, "now~now+45", "start-time"),
        fetchEvents(lookup, "now-30~now", "-start-time"),
      ]);
      const fetchedAt = now();
      const cutoff = new Date(fetchedAt - 30 * day).toISOString();
      const end = new Date(fetchedAt + 45 * day).toISOString();
      const events = [...new Map([...upcoming, ...recent].map(event => [event.id, event])).values()]
        .filter(event => event.endDate >= cutoff && event.startDate <= end)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      const result = { events, updatedAt: new Date(fetchedAt).toISOString(), stale: false };
      cached = { result, fetchedAt };
      return result;
    } catch {
      retryAfter = now() + retryInterval;
      return lastAvailable();
    }
  }

  return async function getEvents() {
    if (cached && now() - cached.fetchedAt < refreshInterval) return cached.result;
    if (now() < retryAfter) return lastAvailable();
    if (!pending) pending = refresh().finally(() => { pending = null; });
    return pending;
  };
}

module.exports = { createEventFeed };
