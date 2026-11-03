const studyForm = document.getElementById("study-form");
const studyTopic = document.getElementById("study-topic");
const studyNotes = document.getElementById("study-notes");
const studyFile = document.getElementById("study-file");
const studyStatus = document.getElementById("study-status");
const studyCreate = document.getElementById("study-create");
const studySample = document.getElementById("study-sample");
const sourcePicker = document.getElementById("study-source-picker");
const addNotes = document.getElementById("study-add-notes");
const studyParams = new URLSearchParams(window.location.search);
const studyFocus = (studyParams.get("focus") || "").slice(0, 500);

studyTopic.value = (studyParams.get("topic") || "").slice(0, 120);
const source = Storage.getTopicById(studyParams.get("from"));
if (source) studyNotes.value = source.sourceText.slice(0, 20000);
if (studyFocus) {
  const focusLabel = document.getElementById("study-focus");
  focusLabel.textContent = `Focus: ${studyFocus}`;
  focusLabel.hidden = false;
  const sources = Storage.getTopics().filter(set => set.sourceText && set.id !== source?.id);
  for (const set of sources) sourcePicker.add(new Option(set.name, set.id));
  if (sources.length) document.getElementById("study-saved-source").hidden = false;
}

function setStudyBusy(busy) {
  for (const control of [studyTopic, studyNotes, studyFile, studyCreate, studySample, sourcePicker, addNotes]) {
    control.disabled = busy;
  }
  studyForm.setAttribute("aria-busy", String(busy));
}

function appendStudyNotes(text) {
  const current = studyNotes.value.trim();
  const combined = current.includes(text) ? current : [current, text].filter(Boolean).join("\n\n");
  if (combined.length > studyNotes.maxLength) throw new Error("These notes are too long. Try a shorter excerpt.");
  studyNotes.value = combined;
  studyStatus.textContent = "Notes added. Give them a quick look before creating your set.";
}

addNotes.addEventListener("click", () => {
  const saved = Storage.getTopicById(sourcePicker.value);
  if (!saved) return;
  try {
    appendStudyNotes(saved.sourceText.trim());
  } catch (error) {
    studyStatus.textContent = error.message;
  }
});

async function readStudyMaterial(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file smaller than 5 MB.");
  if (/\.txt$/i.test(file.name)) return file.text();
  if (!/\.pdf$/i.test(file.name)) throw new Error("Choose a TXT file or PDF.");

  const pdfjs = await import("/vendor/pdf.mjs").catch(() => {
    throw new Error("PDF import needs the server’s PDF dependency. You can paste your notes for now.");
  });
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 40) throw new Error("Choose a PDF with up to 40 pages or paste an excerpt.");
    const pages = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const pageText = items.map(item => item.str ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      total += pageText.length;
      if (total > studyNotes.maxLength) throw new Error("This PDF is too long. Paste the part you want to study.");
      pages.push(pageText);
    }
    return pages.join("\n\n");
  } catch (error) {
    if (error.name === "PasswordException") throw new Error("This PDF is locked. Paste the notes or pick another file.");
    if (error.name === "InvalidPDFException") throw new Error("This PDF couldn’t be opened. Try another file.");
    throw error;
  } finally {
    await task.destroy();
  }
}

studyFile.addEventListener("change", async () => {
  const file = studyFile.files[0];
  if (!file) return;
  setStudyBusy(true);
  studyStatus.textContent = "Reading your file…";
  try {
    const extracted = (await readStudyMaterial(file)).trim();
    if (!extracted) throw new Error("No readable text found. If it’s a scan, paste the notes above.");
    appendStudyNotes(extracted);
  } catch (error) {
    studyStatus.textContent = error.message;
  } finally {
    studyFile.value = "";
    setStudyBusy(false);
  }
});

function openStudyReel(studySet) {
  window.location.assign(`lesson.html?topicId=${studySet.id}`);
}

studyForm.addEventListener("submit", async event => {
  event.preventDefault();
  const name = studyTopic.value.trim();
  if (!name) {
    studyStatus.textContent = "Enter a topic to get started.";
    studyTopic.focus();
    return;
  }
  const input = { name, sourceText: studyNotes.value.trim(), focus: studyFocus };
  setStudyBusy(true);
  studyStatus.textContent = "Meta AI is putting your reel and quiz together…";
  try {
    const content = await generateStudySet(input);
    openStudyReel(Storage.saveStudySet({ ...input, content }));
  } catch (error) {
    studyStatus.textContent = error.message;
    setStudyBusy(false);
  }
});

studySample.addEventListener("click", () => {
  try {
    const existing = Storage.getTopics().find(set => set.name === KMAP_SAMPLE.name && set.content);
    openStudyReel(existing || Storage.saveStudySet(KMAP_SAMPLE));
  } catch {
    studyStatus.textContent = "Your browser couldn’t save this study set.";
  }
});
