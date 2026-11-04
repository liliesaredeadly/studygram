StudygramPrivateSession.start(() => {
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
    const isText = /\.txt$/i.test(file.name);
    if (!isText && !/\.pdf$/i.test(file.name)) throw new Error("Choose a TXT file or PDF.");
    const data = new Uint8Array(await file.arrayBuffer().catch(() => {
      throw new Error("Studygram couldn’t read that file. Choose it again or paste your notes.");
    }));
    const hasPdfHeader = /%PDF-\d\.\d/.test(new TextDecoder().decode(data.subarray(0, 1024)));
    if (isText) {
      const encoding = data[0] === 0xff && data[1] === 0xfe ? "utf-16le"
        : data[0] === 0xfe && data[1] === 0xff ? "utf-16be" : "utf-8";
      let text;
      try {
        text = new TextDecoder(encoding, { fatal: true }).decode(data);
      } catch {
        throw new Error("This TXT file couldn’t be read as text. Save it as UTF-8 and try again.");
      }
      if (text.startsWith("%PDF-") || /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/.test(text)) {
        throw new Error("This file doesn’t look like plain text. Choose a TXT file or PDF.");
      }
      return text;
    }
    if (!hasPdfHeader) throw new Error("This file doesn’t look like a PDF. Choose another file.");

    const pdfjs = await import("/vendor/pdf.mjs").catch(() => {
      throw new Error("PDF import needs the server’s PDF dependency. You can paste your notes for now.");
    });
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
    const task = pdfjs.getDocument({
      data,
      isEvalSupported: false,
      enableScripting: false,
      useWasm: false,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 40) throw new Error("Choose a PDF with up to 40 pages or paste an excerpt.");
      let text = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const reader = page.streamTextContent().getReader();
        if (pageNumber > 1) text += "\n\n";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            for (const item of value.items) {
              if (!item.str) continue;
              text += item.str + (item.hasEOL ? "\n" : " ");
              if (text.length > studyNotes.maxLength) {
                await reader.cancel().catch(() => {});
                throw new Error("This PDF is too long. Paste the part you want to study.");
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      return text;
    } catch (error) {
      if (error.name === "PasswordException") throw new Error("This PDF is locked. Paste the notes or pick another file.");
      if (error.name === "InvalidPDFException") throw new Error("This PDF couldn’t be opened. Try another file.");
      if (error.message === "Choose a PDF with up to 40 pages or paste an excerpt."
          || error.message === "This PDF is too long. Paste the part you want to study.") throw error;
      throw new Error("This PDF couldn’t be read. Paste your notes or try another file.");
    } finally {
      await task.destroy().catch(() => {});
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

  async function openStudyReel(studySet) {
    await Storage.flush();
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
      await openStudyReel(Storage.saveStudySet({ ...input, content }));
    } catch (error) {
      studyStatus.textContent = error.message;
      setStudyBusy(false);
    }
  });

  studySample.addEventListener("click", async () => {
    studySample.disabled = true;
    try {
      const existing = Storage.getTopics().find(set => set.name === KMAP_SAMPLE.name && set.content);
      await openStudyReel(existing || Storage.saveStudySet(KMAP_SAMPLE));
    } catch (error) {
      studyStatus.textContent = error.message || "Your account couldn’t save this study set.";
      studySample.disabled = false;
    }
  });
});
