# Student-First Studygram Implementation Plan

> For implementation, use the Superpowers executing-plans workflow and verify each task before moving on.

**Goal** — A student adds a topic and their own study material, watches a short animated reel, takes a quiz, and can ask Lily for help with the parts they missed.

**Architecture** — Keep the existing browser app and add a small Node.js backend for AI requests. Studygram sends the chosen topic and relevant source text to the backend. The model returns structured lesson, quiz, or chat content. The browser plays the reel, scores the quiz, handles voice, and stores the student's study sets on the device.

**Stack** — Existing HTML, CSS, and JavaScript, browser speech recognition and speech synthesis, browser storage, and a Node.js backend.

**Spec** — The current chat requirements and the product flow below define this update.

## The product flow

1. On Home, the student chooses **New Study Set**.
2. They enter a topic such as **K-maps** and optionally paste notes or attach a text file or a searchable PDF. They can also start with just a topic.
3. Studygram creates a short reel and a quiz from the same material. The student can save the set, replay the reel, and retry the quiz.
4. In **Self-Study**, they can say, “Hey Lily, the wraparound part cooked me today.” Lily asks up to three or four short questions, one at a time, and offers a focused reel and quiz. If the student is venting, Lily listens first and asks whether they want to talk or get study help.
5. If the student agrees to a follow-up, Lily can remember a short, neutral next step on this device. On a later visit she checks in once, lets the student skip, and then continues the study request they came in with.

## AI provider decision

For a prototype with adult testers, use the official **Meta Model API** and a Muse Spark model available to the project. Put the Meta-issued key in the server's `MODEL_API_KEY` environment variable. Configure the model on the server and verify a sample request before connecting the UI. Students use the app without entering an API key.

Meta's current hosted terms require end users to be 18 or older and prohibit products targeting under-18s. An adult-only demo must be scoped to adults. For the intended younger-student version, keep the same app and swap the backend adapter for a self-hosted Meta Llama model, subject to checking its license, use policy, and the requirements for the intended audience. In that setup the server runs Llama directly and does not use a Meta-issued API key. Access to a live key and model has yet to be verified.

[Meta Model API terms](https://dev.meta.ai/legal/terms-of-service?project_id=1366748018914493) · [Meta API authentication](https://dev.meta.ai/docs/authentication) · [Meta's distinction between Llama and Model API](https://dev.meta.ai/help/about-model-api/llama-and-model-api)

## Files and responsibilities

| Area | Files |
|---|---|
| Student entry point | Update `index.html` and navigation in `pages/`. Add `pages/study.html` and `js/study.js` for creating and opening sets. Remove `pages/teacher.html`. |
| Saved study sets | Update `js/storage.js`. Reuse existing topic IDs and retain links to prior progress and scores. |
| Meta AI connection | Use `js/ai.js` as the sole browser AI module. Add `server/index.js` for Studygram's API and `server/model.js` for the Meta model call. Update API error messages in `js/app.js` and document Meta setup in `README.md`. |
| Learning experience | Update `js/lesson.js`, `pages/lesson.html`, `js/quiz.js`, `pages/quiz.html`, and `style.css`. |
| Self-Study and voice | Update `js/lily.js`, `js/diary.js`, and `pages/diary.html` so Lily and the diary can launch the same study-set flow. |

## Build order

### 1. Replace the teacher section with New Study Set

- [ ] Remove Teach from all menus, homepage cards, empty states, and Lily commands. Put **New Study Set** in the main student flow and list saved sets under **My Study Sets**.
- [ ] Add a topic field, an optional notes field, and an optional file picker. Read TXT and PDFs with selectable text. Show the extracted text so students can check it. For a scanned or unreadable PDF, ask them to paste the text. Keep the extracted text and avoid storing the original file.
- [ ] Add `Storage.saveStudySet({ name, sourceText })`, returning a record with an ID. Reuse the existing saved-topic format and read older records using `originalSummary` or `summary` as source text. Keep the old ID so existing bookmarks, quiz scores, and completed lessons still resolve.
- [ ] Verify that a topic alone, pasted notes, and a readable PDF each create a set. Check that a scanned PDF gives a helpful message, a saved set reopens after refresh, and no navigation points to Teach.

### 2. Connect every AI feature to Meta

- [ ] Serve the web app and API from the same server. Add three endpoints with fixed purposes. `POST /api/study-set` accepts the topic, source text, and optional learning gap. `POST /api/lily` accepts the current message and recent conversation. `POST /api/diary` accepts the entry and returns the existing diary analysis fields.
- [ ] Implement the Meta server adapter `generateText({ instructions, input })`. The adult demo sends a chat request to Meta using a server-side key and configured model. Point every AI feature to `js/ai.js`, then remove the legacy client, key prompts, and setup instructions. The browser AI module exposes `generateStudySet(input)`, `getLilyReply(input)`, and `analyzeDiary(entry)`.
- [ ] Validate request sizes and the AI response on the server. Return readable errors for an unavailable service, invalid output, or a time limit. Keep the student's draft available for retry. Keep keys and raw conversation text out of app logs. Treat pasted materials as source text and keep the model's instructions separate.
- [ ] Verify with a fake provider that each endpoint handles success, timeout, and malformed output. With an eligible Meta account and server key, run one real request per flow. Inspect browser requests to confirm the Meta key stays on the server.

### 3. Generate and play the reel

- [ ] Return a study set with `scenes` and `questions` together so both use the same source and focus. Each scene has a title, caption, narration, duration, and a visual type the player knows how to display. Each question has a concept, difficulty, options, correct answer index, and explanation.
- [ ] Turn the existing lesson view into a vertical, timed player with pause, replay, captions, and optional browser narration. Start with reusable visuals such as step reveals, highlighted terms, and a grid. Build the visuals in the browser from structured data, with plain captions as the fallback.
- [ ] Save the validated result with the study set so replay does not need another AI call. Add **Take Quiz** at the end.
- [ ] Verify one complete K-map reel on desktop and mobile width. Check that captions match the scene, pause stops progress and narration, and the saved reel replays after a refresh.

### 4. Make the quiz respond to answers

- [ ] Start with an easy question. Use the answer to choose from the existing question bank. A correct answer moves the student up a level when a question is available. A wrong answer shows the explanation and chooses an unused question on the same concept at the same or easier level.
- [ ] Track questions already shown, fall back to the nearest unused question when the ideal one is missing, and finish cleanly when the bank is exhausted. Save results to the existing progress store using the study-set ID.
- [ ] Verify that right and wrong answers lead to different next questions, explanations match the selected question, and a completed attempt saves the score.

### 5. Connect Lily, Self-Study, and the reel player

- [ ] Keep the browser microphone and spoken replies. Add typed input for the same flow when microphone access or speech recognition is unavailable. Keep Lily's language casual and specific.
- [ ] Add a study flow that asks up to four questions before offering a focused reel and quiz. When the student accepts, send the topic, relevant notes, and confirmed learning gap to the existing study-set endpoint. If the student wants to vent, respond to what they said and offer to listen before suggesting a study activity.
- [ ] Extend the date-only check-in to store the date and a student-approved next step, such as “talk to someone you trust.” Keep it local, leave names out of spoken reminders, and provide skip and forget controls. Hold the original request while checking in and resume it when the check-in is done.
- [ ] Verify a voice and typed study session, a supportive conversation, a declined reminder, a next-day check-in with a queued quiz request, and the forget flow.

### 6. Run the complete demo

- [ ] Add one ready-to-play K-map study set with a reel and quiz so the demo can show the learning flow during an API outage. Label it as a sample.
- [ ] Run the demo from a fresh browser session. Add student notes, generate the reel, answer a question incorrectly, see the targeted retry, then ask Lily about that same concept and open a focused reel.
- [ ] Confirm the audience and AI setup before sharing. For a younger-student pilot, review age-appropriate privacy and support behavior before collecting real voice conversations or personal check-ins.
