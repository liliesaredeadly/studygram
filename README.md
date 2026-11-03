# Studygram

Studygram turns a student's topic and notes into a short animated study reel and a quiz. Lily can talk through a confusing topic, offer a focused study set, or listen when the student needs a minute.

## Start locally

Use Node.js 22 or newer. From the project folder, run:

```powershell
npm install
npm start
```

Open http://localhost:3000 and choose **New Study Set**. Select **Try the K-map sample** to play a complete reel and quiz without a live AI connection. The PDF dependency is needed for importing searchable PDFs. Pasted notes, TXT files, and the sample work without it.

## Turn on Meta AI for an adult-only demo

Meta's hosted Model API requires end users to be 18 or older and prohibits integrated products targeting under-18s. Use this mode only for an adult demo. The app starts with hosted AI disabled.

1. Create a project API key in the Meta Model API dashboard.
2. Create a file named `.env` in the project folder next to `package.json`. Paste these settings and replace the placeholder with your own key. The file is ignored by Git and stays on your machine.

```dotenv
MODEL_API_KEY="paste-your-key-here"
STUDYGRAM_ADULT_DEMO=1
PORT=3001
```

3. Stop the previous server if it is still using port 3001. Double-click `Start Studygram.cmd` and open http://localhost:3001. Keep the launcher window open while using Studygram.

The default model is `muse-spark-1.3`. Set the optional server variable `META_MODEL` to select another model available to the project. The server listens on loopback for this local prototype.

For a deployment intended for younger students, assess an appropriate self-hosted Meta Llama configuration and its terms before enabling live AI for that audience.

[Meta API setup](https://dev.meta.ai/docs/authentication) · [Meta Model API terms](https://dev.meta.ai/legal/terms-of-service)

## Use the prototype

- Enter a topic and optionally paste notes or attach a TXT or searchable PDF. Review the imported text before creating the reel.
- Start playback and turn on narration if you want it. Take the quiz at the end. Correct answers can raise the difficulty and missed answers can lead to another question on the same concept.
- On Home, type to Lily or say “Hey Lily” in a browser that supports speech recognition. If Lily offers a focused set, reply “make it.” The study form opens with the topic and focus filled in.
- Study sets, diary history, quiz scores, and agreed check-ins are saved in the current browser. Live AI sends submitted text to the model through Studygram's server. The server does not store the messages.

Run `npm test` for automated checks.
