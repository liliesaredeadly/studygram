# Lily Voice and Real Video Reels Implementation Plan

> For implementation, use the Superpowers executing-plans workflow. Write and run the regression checks before changing behavior, then verify each stage on Windows.

**Goal** — A student can say “Hey Lily” and be heard, or tap a mic to speak directly. A study set produces a real narrated vertical MP4, with a quiz drawn from the same source material.

**Architecture** — Keep the current browser app and local Node.js server. The browser handles live speech recognition and Lily conversation. The server sends study material to Meta for the script and quiz, uses Kokoro locally to create narration, and combines animated frames, captions, and narration into an MP4 using FFmpeg.

**Stack** — Node.js 22, Web Speech API, Meta Model API, Kokoro via `kokoro-js`, a Node canvas renderer, and FFmpeg plus ffprobe.

**Spec** — The chat requests for reliable “Hey Lily” input, real animated video, and local narration. This plan updates the voice and reel portions of the [student-first plan](2026-11-03-student-studygram.md).

## What the student will see

1. On Home, the Lily panel shows **Waiting for “Hey Lily”**, **Listening**, **Thinking**, or a specific microphone error. They can tap **Talk to Lily** and speak immediately, see their words as they come in, and edit or send them if recognition stops early. Typing stays available.
2. The student adds a topic and notes, or accepts a focused study set from Lily. Studygram shows **Writing script → Recording voice → Rendering video**.
3. A vertical video opens with ordinary play, pause, seek, volume, fullscreen, and **Download MP4** controls. The student can take the quiz underneath. Returning to the saved set plays the same file.

## Implementation order

### 1. Fix how Lily hears the student

**Files** — `index.html`, `style.css`, `js/lily.js`, and new `js/lily-voice.js`.

- [ ] Reproduce on the Windows browser and exact Studygram address the user opens. Record recognition event names, timestamps, and error codes during the test. Keep speech transcripts out of logs. Test both “Hey Lily, explain K-maps” and “Hey Lily” followed by a separate request. The current code waits for final results and uses a fixed 12-second command window. The manual run determines whether permission, browser service, wake matching, or timing is causing the reported failure.
- [ ] Separate microphone states from Lily’s conversation logic. Use **Waiting**, **Listening**, **Processing**, **Speaking**, and **Off**. Browser support and permission determine whether automatic wake listening can start. **Talk to Lily** explicitly starts capture without requiring the wake phrase. **Stop** ends capture and leaves unfinished text available for editing.
- [ ] Use interim results for the visible draft and to keep the command window open while speech continues. When “Hey Lily” and the request arrive together, strip the wake phrase and retain the words after it. Use a short pause to submit a completed request, an idle limit for silence, and a separate upper bound for a stuck session. Send each utterance once. If recognition ends with only partial text, keep it editable and let the student send it.
- [ ] Show specific messages for permission denied, no mic, and speech service unavailable. Retry ordinary silence without looping on a permission or network error. Stop capture while Lily speaks or while the page is hidden. Restart wake listening after speech playback ends, with a timeout recovery if playback stalls.
- [ ] Test with fake recognition events for both wake-phrase patterns, a slow interim transcript, permission denied, recognition ending before a final result, duplicate callbacks, and Lily speaking. Then test a real mic, once with a normal request and once with a longer sentence. Verify that check-ins and the focused-study flow still work.

### 2. Prove local narration on this PC

**Files** — New `server/narration.js`, a local voice smoke test, and setup instructions in `README.md`.

- [ ] Download and cache the Kokoro model and voice assets once. Test `kokoro-js` on Node CPU with the quantized model and `af_heart`. Generate a 15-second sample from a fixed script containing “K-map,” “Gray code,” and “zero zero.” Listen for pronunciation, tone, and pauses. Record the generation time on this Windows machine before choosing the default voice.
- [ ] Implement `synthesizeNarration({ text, outputPath })` to produce a local WAV file. Keep one model instance warm per renderer process. Use fixed narration text from the approved script and let the rendering timeline measure each WAV. Use one voice consistently across the reel.
- [ ] If Kokoro fails the setup or speed check, provide Windows speech synthesis as a local fallback. Show which voice engine was used. If both engines fail, show a narration error with a retry button. Keep the generated script and quiz available for a retry.
- [ ] Verify a playable, non-silent WAV and an offline repeat run after model setup. Check that WAV generation makes zero Meta calls. The first setup needs a model download and the local narration speed and voice quality remain to be measured.

### 3. Turn Meta’s script into an animation timeline

**Files** — `server/tasks.js`, new `server/reel-timeline.js`, and `js/sample-study.js`.

- [ ] Add a versioned video storyboard to the study-set response. Each scene contains ordered beats with a short narration line, a caption, a visual template, and the element IDs to highlight or reveal during that line. Start with grid grouping, step-by-step diagrams, and highlighted labels. The model provides data and the renderer owns all drawing logic.
- [ ] Keep the quiz in the same response and tie it to the same topic and source material. Give the script a spoken hook, one worked example, and a short takeaway. Target 30–60 seconds. For the K-map sample, show Gray-code labels, light up the two edge cells, and visibly connect the pair across the edges.
- [ ] Measure the WAV for each beat and build the scene and caption timings from those durations. Add brief transition gaps. If audio runs long, flag it in the render job or shorten the script before exporting. Preserve complete spoken lines.
- [ ] Convert the existing saved scene format into a storyboard using its narration, captions, and visuals so legacy study sets can render without another AI call. Test that the fallback K-map sample builds from its bundled script and quiz with no Meta key.

### 4. Render, play, and download a real video

**Files** — New `server/reel-render.js` and `server/reel-jobs.js`, plus `server/index.js`, `js/ai.js`, `js/storage.js`, `js/lesson.js`, and `pages/lesson.html`.

- [ ] Verify FFmpeg and ffprobe on Windows before adding the video UI. Draw animated frames with Canvas and encode a **720 × 1280, 30 fps MP4 with H.264 video and AAC narration**. Draw the captions into the frames using the beat timings. Stream frames to FFmpeg and keep temporary audio and partial output out of public routes.
- [ ] Add a local render job API. `POST /api/reel-jobs` validates the saved storyboard and returns a job ID. `GET /api/reel-jobs/:id` reports progress or a specific error. A ready job exposes a local MP4 URL with byte ranges for seeking and a download action. Queue one render at a time, enforce a timeout, and publish the file only after validation succeeds.
- [ ] Save the MP4 reference with the study set. Reuse a completed render when the storyboard, voice, and render version match. After restart, look up the completed file from its persisted ID. A missing file offers **Render again** from the saved script. Retrying a render uses the saved script and makes zero Meta calls.
- [ ] Replace the timed card player with a native video player when the render is ready. While it runs, show progress. On failure, show what failed and a retry. Keep the quiz accessible and label the video status clearly.
- [ ] Check each completed file with ffprobe for one H.264 video stream, one AAC audio stream, portrait dimensions, and matching audio and video lengths. Check the downloaded MP4 outside Studygram. Watch the K-map animation and confirm the highlights and captions follow the spoken lines.

### 5. Verify the whole flow

- [ ] Run the bundled K-map set from a fresh browser session without a Meta key. Confirm it produces a narrated MP4 and the quiz still offers a targeted retry.
- [ ] With the user’s authorization for a live Meta request, generate one study set from sample notes. Confirm the normal generation path uses one Meta call for the script and quiz, and the audio, video, playback, and render retry all run locally.
- [ ] Test real microphone input in the user’s Windows browser, including the direct mic button, wake phrase, a longer spoken request, a typed fallback, and Lily resuming listening after a spoken reply.
- [ ] Test an FFmpeg error, a missing voice model, a server restart, and an older saved set. Verify the app explains the problem and keeps the student’s notes and quiz. Record render time on the actual PC.

## Done when

- “Hey Lily, explain K-maps” submits once, and “Hey Lily” followed by a separate sentence works.
- **Talk to Lily** captures a request without the wake phrase, and the student can see and edit the transcript.
- A saved study set plays and downloads a portrait MP4 containing real narration, captions, and visible motion. The downloaded file plays outside Studygram.
- The K-map example highlights the correct cells while the narration explains them. The quiz uses that same example.
- Rendering again from an existing script requires zero Meta calls.

[Web Speech API](https://webaudio.github.io/web-speech-api/) · [Kokoro JavaScript repo](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) · [Windows speech synthesis](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer) · [FFmpeg documentation](https://ffmpeg.org/documentation.html)
