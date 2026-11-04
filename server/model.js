const META_ENDPOINT = "https://api.meta.ai/v1/chat/completions";
const certificateErrors = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);
const metaErrors = {
  401: "Meta rejected the API key. Check the key in your Studygram settings.",
  402: "Meta reported a billing issue. Check Billing in the Meta dashboard.",
  403: "This Meta key does not have permission to use the configured model.",
  404: "The configured Meta model is unavailable for this project.",
  429: "Meta AI is busy right now. Try again in a moment.",
};

async function generateText({ instructions, input }) {
  if (process.env.STUDYGRAM_ADULT_DEMO !== "1") {
    throw Object.assign(new Error("Live AI is turned off on this server. Open the Studygram server started for the adult demo."), { status: 503 });
  }
  const key = process.env.MODEL_API_KEY?.trim();
  if (!key) {
    throw Object.assign(new Error("Live AI needs a Meta API key in the server settings. Add the key and restart Studygram."), { status: 503 });
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
    redirect: "error",
  }).catch(error => {
    if (certificateErrors.has(error.cause?.code)) {
      throw Object.assign(new Error("Studygram couldn’t verify Meta’s certificate. Restart with Start Studygram.cmd to load Windows’ trusted certificates."), { status: 502 });
    }
    throw error;
  });
  if (!response.ok) {
    const message = metaErrors[response.status] || "Studygram couldn’t connect to Meta AI. Try again later.";
    throw Object.assign(new Error(message), { status: response.status === 429 ? 429 : 502 });
  }
  return (await response.json()).choices?.[0]?.message?.content;
}

module.exports = { generateText };
