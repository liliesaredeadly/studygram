async function requestStudygramAI(endpoint, input) {
  if (window.location.protocol === "file:") {
    throw new Error("Open Studygram through its local server to use live AI.");
  }
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error || "Studygram couldn’t reach the AI. Try again.");
  }
  return result;
}

function generateStudySet({ name, sourceText = "", focus = "" }) {
  return requestStudygramAI("study-set", { name, sourceText, focus });
}

function getLilyReply(input) {
  return requestStudygramAI("lily", input);
}

function analyzeDiary(entry) {
  return requestStudygramAI("diary", { entry });
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
