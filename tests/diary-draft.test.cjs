const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { test } = require("node:test");
const { createStudygramServer } = require("../server/index");

function draftEndpoint(model) {
  const server = createStudygramServer(model);
  return input => new Promise(resolve => {
    const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(input))]), {
      url: "/api/diary-draft", method: "POST", headers: { "content-type": "application/json", host: "localhost" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    const headers = new Headers();
    const response = {
      setHeader: (name, value) => headers.set(name, value),
      writeHead(status, values) {
        this.status = status;
        for (const [name, value] of Object.entries(values)) headers.set(name, value);
      },
      end(body) { resolve(new Response(body, { status: this.status, headers })); },
    };
    server.emit("request", request, response);
  });
}

test("Diary drafting sends just the short notes and returns only an editable draft", async () => {
  let modelInput;
  const post = draftEndpoint(async ({ input }) => {
    modelInput = input;
    return JSON.stringify({ draft: "  I studied fractions and finished a worksheet.  ", save: true });
  });

  const response = await post({ entry: "  fractions, finished worksheet  ", profile: { name: "private" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(modelInput, { entry: "fractions, finished worksheet" });
  assert.deepEqual(await response.json(), { draft: "I studied fractions and finished a worksheet." });
});

test("Diary drafting rejects empty or oversized notes and unusable model responses", async () => {
  let modelCalls = 0;
  const post = draftEndpoint(async () => {
    modelCalls++;
    return JSON.stringify({ draft: " " });
  });

  for (const entry of ["  ", 42, "a".repeat(1001)]) {
    assert.equal((await post({ entry })).status, 400);
  }
  assert.equal(modelCalls, 0);
  assert.equal((await post({ entry: "fractions" })).status, 502);
  assert.equal(modelCalls, 1);
});
