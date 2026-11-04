const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createEventFeed } = require("../server/events");
const { createStudygramServer } = require("../server/index");

const now = Date.parse("2026-11-05T06:00:00Z");

function listing(id, overrides = {}) {
  return {
    id,
    attributes: {
      title: "  Build   a robot with Python ", publish: true, cancelled: false,
      "start-time": "2026-11-06T09:00:00+05:30", "end-time": "2026-11-06T12:00:00+05:30",
      "location-type": "hybrid", city: "Pune", virtual: true,
      link: "http://localhost/private", ...overrides,
    },
  };
}

test("public events API lists valid organizer pages without sending student data", async t => {
  const sourceRequests = [];
  const lookup = async url => {
    sourceRequests.push(url);
    return Response.json({ data: [listing("123"), listing("124", { cancelled: true }),
      listing("125", { publish: false }), listing("126", { "start-time": "invalid" }),
      listing("127", { "start-time": "2025-11-06T00:00:00Z", "end-time": "2025-11-06T01:00:00Z" }),
    ] });
  };
  const server = createStudygramServer(undefined, {}, { lookup, now: () => now });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/events`;
  const response = await fetch(`${url}?student=private`);
  assert.equal(response.status, 200);
  const feed = await response.json();
  assert.equal(feed.stale, false);
  assert.deepEqual(feed.events, [{
    id: "ieee-123", title: "Build a robot with Python", url: "https://events.vtools.ieee.org/m/123",
    startDate: "2026-11-06T03:30:00.000Z", endDate: "2026-11-06T06:30:00.000Z", location: "Pune",
    format: "hybrid", source: "IEEE", topics: ["Coding", "Robotics & electronics"],
  }]);
  assert.equal(sourceRequests.length, 2);
  assert.ok(sourceRequests.every(request => request.hostname === "events.vtools.ieee.org" && !request.searchParams.has("student")));
  assert.equal((await fetch(url, { method: "POST" })).status, 405);
});

test("event feed coalesces refreshes, caches results and marks them stale on failure", async () => {
  let clock = now;
  let requestCount = 0;
  let sourceOnline = true;
  const getEvents = createEventFeed({
    now: () => clock,
    lookup: async () => {
      requestCount++;
      return sourceOnline ? Response.json({ data: [listing("123")] }) : new Response(null, { status: 500 });
    },
  });
  const [first, second] = await Promise.all([getEvents(), getEvents()]);
  assert.strictEqual(first, second);
  assert.strictEqual(await getEvents(), first);
  assert.equal(requestCount, 2);
  clock += 16 * 60_000;
  sourceOnline = false;
  assert.deepEqual(await getEvents(), { ...first, stale: true });
  assert.deepEqual(await getEvents(), { ...first, stale: true });
  assert.equal(requestCount, 4);
  clock += 24 * 60 * 60_000;
  await assert.rejects(getEvents(), { status: 503 });
});
