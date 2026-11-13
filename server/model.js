const META_BASE = "https://api.meta.ai/v1";
const certificateErrors = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);
const problems = {
  META_CONNECTION_REQUIRED: [428, "Connect your own Meta API key in Settings to use live AI."],
  META_KEY_INVALID: [422, "Enter a valid Meta API key in Settings. The key must contain no spaces and be at most 2048 characters."],
  META_ADULT_REQUIRED: [428, "Confirm in Settings that you are 18 or older before using Meta AI."],
  META_DISABLED: [503, "Live AI is turned off on this server. The operator must enable the adult demo."],
  META_KEY_REJECTED: [422, "Meta rejected your API key. Replace the key in Settings."],
  META_BILLING_REQUIRED: [422, "Meta reported a billing issue. Check Billing in your Meta dashboard."],
  META_PERMISSION_DENIED: [403, "Your Meta key does not have permission to use this model. Check your Meta project."],
  META_MODEL_UNAVAILABLE: [422, "The configured Meta model is unavailable for your project. Check your Meta project or contact the Studygram operator."],
  META_RATE_LIMITED: [429, "Meta AI is busy or your project has reached its rate limit. Try again in a moment."],
  META_TIMEOUT: [504, "Meta AI took too long. Try again."],
  META_CERTIFICATE: [502, "Studygram couldn’t verify Meta’s certificate. Restart with Start Studygram.cmd to load Windows’ trusted certificates."],
  META_UNAVAILABLE: [502, "Live AI is temporarily unavailable. Try again in a moment."],
};
const providerProblems = {
  401: "META_KEY_REJECTED", 402: "META_BILLING_REQUIRED", 403: "META_PERMISSION_DENIED",
  404: "META_MODEL_UNAVAILABLE", 429: "META_RATE_LIMITED",
};

function metaError(code) {
  const [status, message] = problems[code];
  return Object.assign(new Error(message), { status, code });
}

function publicMetaError(error) {
  if (!Object.hasOwn(problems, error?.code)) return null;
  const [status, message] = problems[error.code];
  return { status, body: { error: message, code: error.code } };
}

function getMetaConnection() {
  return { enabled: process.env.STUDYGRAM_ADULT_DEMO === "1", model: process.env.META_MODEL || "muse-spark-1.3" };
}

function validateMetaKey(apiKey) {
  if (apiKey === undefined || apiKey === null || apiKey === "") throw metaError("META_CONNECTION_REQUIRED");
  if (typeof apiKey !== "string" || apiKey.length > 2048 || !/^[\x21-\x7e]+$/.test(apiKey)) {
    throw metaError("META_KEY_INVALID");
  }
  return apiKey;
}

function connectionFailure(error) {
  if (error.name === "TimeoutError" || error.name === "AbortError") return metaError("META_TIMEOUT");
  return metaError(certificateErrors.has(error.cause?.code) ? "META_CERTIFICATE" : "META_UNAVAILABLE");
}

async function requestMeta(path, { apiKey, method, body, timeout }) {
  if (!getMetaConnection().enabled) throw metaError("META_DISABLED");
  const key = validateMetaKey(apiKey);
  let response;
  try {
    response = await fetch(`${META_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
    });
  } catch (error) {
    throw connectionFailure(error);
  }
  if (!response.ok) throw metaError(providerProblems[response.status] || "META_UNAVAILABLE");
  try {
    return await response.json();
  } catch (error) {
    throw connectionFailure(error);
  }
}

async function verifyMetaConnection({ apiKey }) {
  const { model } = getMetaConnection();
  const result = await requestMeta(`/models/${encodeURIComponent(model)}`, { apiKey, method: "GET", timeout: 10_000 });
  if (result?.id !== model) throw metaError("META_UNAVAILABLE");
  return { connected: true, model };
}

async function generateText({ instructions, input, apiKey }) {
  const { model } = getMetaConnection();
  const result = await requestMeta("/chat/completions", {
    apiKey, method: "POST", timeout: 45_000,
    body: {
      model,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(input) },
      ],
    },
  });
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw metaError("META_UNAVAILABLE");
  return content;
}

module.exports = { generateText, verifyMetaConnection, getMetaConnection, validateMetaKey, metaError, publicMetaError };
