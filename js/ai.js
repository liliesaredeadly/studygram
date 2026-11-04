async function requestStudygramAI(endpoint, input) {
  if (window.location.protocol === "file:") {
    throw new Error("Open Studygram through its local server to use live AI.");
  }
  let response;
  let result;
  try {
    response = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(55000),
    });
    result = await response.json().catch(error => {
      if (error.name === "TimeoutError" || error.name === "AbortError") throw error;
      return null;
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("The AI took too long. Try sending your request again.");
    }
    throw new Error("Studygram couldn’t reach the AI. Try again.");
  }
  if (!response.ok || !result) {
    throw new Error(result?.error || "Studygram couldn’t reach the AI. Try again.");
  }
  return result;
}

function generateStudySet({ name, sourceText = "", focus = "" }) {
  const account = typeof StudygramPrivateSession === "undefined" ? {} : {
    accountId: StudygramPrivateSession.user()?.id ?? null,
  };
  return requestStudygramAI("study-set", { name, sourceText, focus, ...account });
}

function getLilyReply(input) {
  return requestStudygramAI("lily", input);
}

function analyzeDiary(entry) {
  return requestStudygramAI("diary", { entry });
}

function draftDiary(entry) {
  return requestStudygramAI("diary-draft", { entry });
}

async function loadStudyContent(topic) {
  if (topic.content) return topic.content;
  const content = await generateStudySet(topic);
  topic.content = content;
  try {
    if (topic.id) {
      Storage.saveStudyContent(topic.id, content);
    } else {
      topic.id = Storage.saveStudySet(topic).id;
    }
  } catch {
    showToast("This study set is ready, but your browser couldn’t save it.", "warning");
  }
  return content;
}
