const assert = require("node:assert/strict");
const test = require("node:test");
const { getWisdomResponse } = require("../server/wisdom");

test("Wisdom accepts only bounded student messages and supported choices", () => {
  const message = "I failed my exam.";
  for (const input of [null, [], {}, { message: "  " }, { message: "a".repeat(1001) },
    { message, history: "previous" }, { message, history: [{ role: "student", text: "a" }] },
    { message, history: Array(7).fill("a") }, { message, history: ["a".repeat(1001)] },
    { message, tradition: "custom" }]) {
    assert.equal(getWisdomResponse(input), null);
  }
});

test("Wisdom gives immediate support before scripture choice or matching", () => {
  for (const message of ["I want to kill myself after failing my exam.",
    "I’m going to end my life.", "I might hurt myself tonight.", "I’m gonna kill myself.",
    "I’m going to hurt someone.", "I took pills to kill myself.",
    "I don't think I can stay safe.", "I said I want to kill myself and I mean it."]) {
    const response = getWisdomResponse({ message, tradition: "gita" });
    assert.deepEqual(Object.keys(response).sort(), ["kind", "message"]);
    assert.equal(response.kind, "support_now", message);
    assert.match(response.message, /someone you trust/i);
    assert.match(response.message, /local emergency services/i);
  }
});

test("Wisdom checks ambiguous language without showing cards", () => {
  for (const message of ["I can't go on.", "I don't want to be here anymore.",
    "I wish I could disappear.", "I don't want to kill myself. I just failed my exam.",
    'In the movie he says "I want to kill myself."']) {
    const response = getWisdomResponse({ message, tradition: "gita" });
    assert.deepEqual(Object.keys(response).sort(), ["kind", "message"]);
    assert.equal(response.kind, "check_safety", message);
    assert.match(response.message, /are you thinking about hurting yourself/i);
  }
});

test("A new scripture choice cannot replace an earlier danger disclosure", () => {
  const response = getWisdomResponse({
    message: "I failed my exam.", history: ["I want to end my life."], tradition: "gita",
  });
  assert.equal(response.kind, "support_now");
});

test("Wisdom keeps an open safety question ahead of cards until the student says they are safe", () => {
  const history = ["I wish I could disappear."];
  assert.equal(getWisdomResponse({ message: "I failed my exam.", history, tradition: "gita" }).kind,
    "check_safety");
  assert.equal(getWisdomResponse({
    message: "I failed my exam.", history: [...history, "No, I'm safe."],
  }).kind, "choose_tradition");
  assert.equal(getWisdomResponse({
    message: "I failed my exam.", history: [...history, "No."],
  }).kind, "choose_tradition");
  assert.equal(getWisdomResponse({
    message: "I failed my exam.", history: [...history, "This is not about safety."],
  }).kind, "choose_tradition");
});

test("Wisdom handles short answers to its safety question in context", () => {
  const history = ["I wish I could disappear."];
  assert.equal(getWisdomResponse({ message: "Maybe.", history }).kind, "check_safety");
  for (const message of ["Yes.", "I might."]) {
    assert.equal(getWisdomResponse({ message, history }).kind, "support_now");
    assert.equal(getWisdomResponse({
      message: "I failed my exam.", history: [...history, message], tradition: "gita",
    }).kind, "support_now");
  }
});

test("new safety language takes precedence over a safety denial", () => {
  const result = getWisdomResponse({
    message: "No, I am safe, but I want to die and I failed my exam.",
    history: ["I can't go on."],
    tradition: "gita",
  });
  assert.equal(result.kind, "check_safety");
  assert.equal(result.cards, undefined);
});

test("Wisdom clarifies vague loss or failure and asks for a choice after context", () => {
  assert.equal(getWisdomResponse({ message: "I failed." }).kind, "clarify");
  assert.equal(getWisdomResponse({ message: "I lost." }).kind, "clarify");
  assert.equal(getWisdomResponse({ message: "I lost something very important to me." }).kind, "clarify");
  assert.equal(getWisdomResponse({ message: "I failed my exam." }).kind, "choose_tradition");
  assert.equal(getWisdomResponse({ message: "My math exam", history: ["I failed."] }).kind,
    "choose_tradition");
});

test("Wisdom shows five cards with an attributed passage only for each reviewed match", () => {
  for (const [message, tradition, scene, reference] of [
    ["I failed my exam.", "gita", "chariot", /2[.:]47/],
    ["I hurt someone I care about.", "bible", "lantern", /Ephesians 4:32/],
  ]) {
    const response = getWisdomResponse({ message, tradition });
    assert.equal(response.kind, "experience");
    assert.equal(response.cards.length, 5);
    for (const card of response.cards) {
      assert.ok(card.title);
      assert.ok(card.text);
    }
    assert.equal(response.cards[1].scene, scene);
    const { source } = response.cards[2];
    assert.match(source.reference, reference);
    assert.ok(source.edition);
    assert.match(source.url, /^https:\/\//);
    assert.equal(response.cards.filter(card => Object.hasOwn(card, "source")).length, 1);
  }
});

test("Either selects a reviewed passage for the situation", () => {
  for (const [message, scene] of [
    ["I failed my exam.", "chariot"],
    ["I hurt someone I care about.", "lantern"],
  ]) {
    const response = getWisdomResponse({ message, tradition: "either" });
    assert.equal(response.kind, "experience");
    assert.equal(response.cards[1].scene, scene);
    assert.ok(response.cards[2].source);
  }
});

test("Wisdom provides non-religious reflection when requested or when either has no passage", () => {
  for (const [message, tradition] of [
    ["I failed my exam.", "secular"],
    ["I feel overwhelmed at school.", "either"],
  ]) {
    const response = getWisdomResponse({ message, tradition });
    assert.equal(response.kind, "experience");
    assert.equal(response.cards[1].scene, "shore");
    assert.ok(response.cards.every(card => !Object.hasOwn(card, "source")));
  }
});

test("Wisdom offers another choice when a recognized situation lacks a passage from the chosen tradition", () => {
  const response = getWisdomResponse({ message: "I failed my exam.", tradition: "bible" });
  assert.equal(response.kind, "choose_tradition");
  assert.match(response.message, /reviewed passage/);
});

test("Wisdom listens when context has no reviewed match", () => {
  assert.equal(getWisdomResponse({ message: "Tell me the weather.", tradition: "either" }).kind, "listen");
  assert.equal(getWisdomResponse({ message: "I feel awful.", history: ["I failed."], tradition: "gita" }).kind,
    "listen");
  for (const message of ["Someone hurt me.", "I didn't hurt anyone.", "I didn’t hurt someone. They hurt me."]) {
    assert.equal(getWisdomResponse({ message, tradition: "bible" }).kind, "listen");
  }
});
