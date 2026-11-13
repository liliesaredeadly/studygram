# Studygram

Studygram turns a student's topic and notes into a short animated study reel and a quiz. Lily can talk through a confusing topic, offer a focused study set, or listen when the student needs a minute.

## Start locally

Use Node.js 22.13 or newer. From the project folder, run:

```powershell
npm install
npm start
```

Open http://localhost:3000, create a local Studygram account, and choose **New Study Set**. Select **Try the K-map sample** to open a ready-made storyboard and quiz without a live AI connection. The PDF dependency is needed for importing searchable PDFs. Pasted notes, TXT files, and the sample work without it.

## Judge walkthrough

1. Open the K-map sample and select **Storyboard preview**. On a Windows setup with the reel tools below, you can also render and play the narrated MP4.
2. Select **Take Quiz** and miss the first wraparound question. Studygram follows it with a question on the same concept. Complete the quiz to see your results.
3. For a live adult demo, use synthetic course notes to generate a new study set. Muse Spark returns the lesson script and quiz questions. Studygram renders the script and selects the next question based on the learner’s answer.

## Turn on Meta AI for an adult-only demo

Meta's hosted Model API requires end users to be 18 or older and prohibits integrated products targeting under-18s. Use this mode only for an adult demo. The app starts with hosted AI disabled.

1. As the operator, create a file named `.env` in the project folder next to `package.json` and enable the adult demo. Do not put a student's Meta key in this file.

```dotenv
STUDYGRAM_ADULT_DEMO=1
PORT=3001
```

2. Stop the previous server if it is still using port 3001. Double-click `Start Studygram.cmd` and open http://localhost:3001. Keep the launcher window open while using Studygram.
3. Sign in to your Studygram account and open **Settings** at `/pages/settings.html`.
4. Create a personal project API key in the [Meta Model API dashboard](https://dev.meta.ai/), paste it into Settings, and connect it. Connecting checks access to model metadata without requesting generated content or incurring a generation charge.

Each signed-in user supplies their own key. Generated requests use that key and are billed to its Meta project according to that project's pricing and quotas. There is no shared `MODEL_API_KEY` fallback.

The key is held in this browser tab's `sessionStorage`, bound to the signed-in Studygram account. It is cleared when you disconnect, sign out, or change accounts. It is not saved in your Studygram account or database. For live requests, the browser sends it to Studygram's server in the `X-Studygram-Meta-Key` header, and the server uses it to authenticate with Meta. Use HTTPS for a public deployment.

The operator's `STUDYGRAM_ADULT_DEMO=1` switch is still required independently of each user's key. Supplying a personal key cannot enable a disabled hosted-AI demo.

If you started an offline preview from PowerShell with `$env:STUDYGRAM_ADULT_DEMO='0'`, close that shell and restart Studygram from a fresh shell or the Windows launcher. Settings inherited from the shell take precedence over `.env`.

The default model is `muse-spark-1.3`. Set the optional server variable `META_MODEL` to select another model available to the project. The server listens on loopback for this local prototype.

For a deployment intended for younger students, assess an appropriate self-hosted Meta Llama configuration and its terms before enabling live AI for that audience.

[Meta API setup](https://dev.meta.ai/docs/authentication) · [Meta Model API terms](https://dev.meta.ai/legal/terms-of-service)

## Use the prototype

- Enter a topic and optionally paste notes or attach a TXT or searchable PDF. Review the imported text before creating the reel.
- Select **Create reel + quiz** and watch the progress on the lesson page. When the video is ready, play it there or select **Download MP4**. **Storyboard preview** opens the optional scene cards. **Take Quiz** is available while the video renders.
- On Home, select **Talk to Lily** to open the chat. Type a message, select **Use microphone** to speak directly, or select **Enable Hey Lily** to listen for the wake phrase. Allow microphone access if prompted. **Stop** keeps unfinished words in the text box. When Lily asks a follow-up or offers a focused set, wait for **Listening…** and answer without saying the wake phrase again. Say or type “make it” to open the prefilled study form.
- Hey Lily reconnects after brief speech service interruptions. If **Set up offline mic** appears, you can use it to download the browser’s English speech pack while the mic is off. The speech pack handles recognition locally, and Lily still needs the live AI connection to answer. Use **Replay reply** if you miss the audio.
- On Home, open **Cinematic Wisdom** and try an example. The local demo offers five illustrated cards for supported situations, with a choice of scripture or secular reflection. It uses built-in responses and clears the conversation when you leave or start over. It works without a model API key.
- Signed-in students save their Passport, study sets, diary history, quiz scores and agreed check-ins in their account. The Passport offers an import if the browser's older data was already linked to that account. Live AI sends submitted text to the configured model through Studygram's server using the personal Meta key connected in Settings. That key is kept separately from saved learning data.

Run `npm test` for automated checks.

## Student Community pilot

Open **Student Community** from Home or sign in from the Student Passport page. Studygram uses the same nickname and password for your private learning data and Community access. Signed-in members of the same server share group chats and timed Library sessions. The Windows launcher also loads Windows' trusted certificates for the live IEEE events feed in Explore.

The pilot listens on the local computer. Reports hide a message from the reporter. The operator can review reports with `node server/community-moderate.js reports`, then use `node server/community-moderate.js hide <message-id>` or `node server/community-moderate.js restore <message-id>`.

## Serve Studygram over HTTPS

The launcher defaults to loopback for local development. For production, set these server environment variables using a certificate trusted by your students' browsers and a private key stored outside the checkout. Keep the database in a directory restricted to the Studygram service account.

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `STUDYGRAM_ORIGIN` | Exact HTTPS origin, including the port if it differs from 443 |
| `STUDYGRAM_TLS_CERT` | Absolute path to the certificate and certificate chain in PEM format |
| `STUDYGRAM_TLS_KEY` | Absolute path to the matching PEM private key |
| `STUDYGRAM_HOST` | Explicit listening address. The default is `127.0.0.1` |
| `STUDYGRAM_DB_PATH` | Optional absolute path to the SQLite database, used by both the app and moderation CLI |

Production and non-loopback listeners require TLS. Restart Studygram when its certificate files are renewed. For local HTTPS, configure the same certificate and key settings using a certificate trusted for your localhost address. If the Passport offers an import of browser-only work from an HTTP address, complete it from that address before switching to HTTPS.

Connect personal Meta keys through Settings; they do not belong in `.env` or deployment environment variables. Keep operator configuration in the ignored `.env` or your deployment's environment settings. Use a unique account password. On Windows, restrict the database, its directory, and the TLS private key with Windows file permissions. The application serves neither SQLite files nor the moderation CLI.

## Deploy with Vercel

The current server needs persistent SQLite storage, local reel files, Windows Speech and a continuous render queue. Importing this repository into Vercel as it stands does not provide a working deployment of the full app. Personal keys in Settings do not change these hosting requirements.

See [the Vercel deployment guide](docs/deployment-vercel.md) for the actual blockers, architecture options, required changes and GitHub import steps. The smallest path that preserves all current features is to use Vercel as a reverse proxy in front of a persistent Windows backend after adding trusted proxy support. Running the APIs directly on Vercel requires a storage and rendering migration first.

## Render reels on Windows

Reels use an installed Windows desktop speech voice for narration. Install FFmpeg and ffprobe from a [Windows build listed by FFmpeg](https://ffmpeg.org/download.html#build-windows), then restart Studygram. Put both executables on PATH or at `.studygram-tools/ffmpeg/bin/` inside the project. You can also set `REEL_FFMPEG` and `REEL_FFPROBE` to their full paths in `.env`.

Open the K-map sample and sign in to render a video without an AI key. Studygram saves completed MP4s under `.studygram-reels/` on the server and restricts private playback and download to the owner. Share a rendered reel explicitly to put it in the Community feed. If a saved video is missing, Studygram queues a render from its saved script. If playback fails, **Render again** requests a fresh render. These steps make zero Meta API calls.
