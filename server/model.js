const META_ENDPOINT = "https://api.meta.ai/v1/chat/completions";

async function generateText({ instructions, input }) {
  const key = process.env.MODEL_API_KEY;
  if (!key || process.env.STUDYGRAM_ADULT_DEMO !== "1") {
    throw Object.assign(new Error("Live AI is unavailable. You can still try the sample study set."), { status: 503 });
  }

  const response = await fetch(META_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.META_MODEL || "muse-spark-1.3",
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const message = response.status === 429
      ? "Meta AI is busy right now. Try again in a moment."
      : "Studygram couldn’t connect to Meta AI. Try again later.";
    throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502 });
  }
  return (await response.json()).choices?.[0]?.message?.content;
}

module.exports = { generateText };
