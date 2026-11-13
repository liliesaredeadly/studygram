# Deploying Studygram with Vercel

The repository is a local Node.js application, not a deployment-ready Vercel project. A GitHub import alone will not preserve accounts, Community, narrated reels and voice rooms. Choose the architecture below before configuring Vercel. No migration or deployment is performed by these instructions.

## Connect personal Meta keys first

1. Enable `STUDYGRAM_ADULT_DEMO=1` on the backend and restart it. This operator switch remains required for the adult-only hosted-AI demo.
2. Sign in to Studygram, open `/pages/settings.html`, and connect your own Meta project API key.
3. Connection checks model metadata; it does not request generated content or incur a generation charge. Generating content uses the connected key and is billed to its Meta project under that project's pricing and quotas.

The key stays in the current browser tab's `sessionStorage`, bound to the current Studygram account. Disconnecting, signing out or changing accounts clears it. Studygram does not persist it in the account database. Live requests carry it to Studygram's backend in `X-Studygram-Meta-Key`, and the backend authenticates the upstream Meta request with it. There is no shared `MODEL_API_KEY` fallback. Do not add personal keys to GitHub, Vercel environment variables or a frontend build.

The hosted Meta mode retains the app's adult-only constraint. See the [README setup](../README.md#turn-on-meta-ai-for-an-adult-only-demo) and [Meta Model API terms](https://dev.meta.ai/legal/terms-of-service).

## Why the current app needs changes

| Dependency | Current implementation | Consequence on Vercel Functions |
| --- | --- | --- |
| Accounts, sessions and learning data | `server/community.js` opens a local `node:sqlite` database in WAL mode; auth, private state and Community share it | A writable, shared database must move to a persistent service |
| Reel files | `server/index.js` points reel storage at `.studygram-reels/`; `server/reel-jobs.js` writes MP4 and metadata files there | Generated files need durable storage accessible across instances |
| Render jobs | `server/reel-jobs.js` keeps its queue/status in Maps and starts rendering after returning a queued response | Jobs need a durable queue and a worker with a supported lifecycle |
| Narration and encoding | `server/narration.js` rejects platforms other than Windows; rendering invokes Windows Speech, FFmpeg and ffprobe | Keep a Windows render worker or replace narration with a portable engine and supply encoding tools |
| Voice signaling | `server/community-voice.js` keeps peers and signals in process memory | Requests must share signaling state across instances |
| HTTPS and origins | `server/index.js` and `server/community.js` derive HTTPS from `request.socket.encrypted`; production startup expects TLS certificate files | Add an explicit trusted proxy transport for HTTPS, host validation and secure session cookies |
| Private-state sync size | `server/private-data.js` accepts requests up to 7 MB and account state up to 6 MB | Reduce or split sync requests and buffered responses to fit function limits |
| Entry and static assets | Startup is `node server/index.js`; HTML receives a CSP nonce, and PDF.js is served from `node_modules` | Add a supported Vercel entry or an intentional public build; preserve the existing page policy and PDF assets |

Vercel Functions have a read-only filesystem except temporary `/tmp` scratch space. **Do not point SQLite at `/tmp` as a deployment fix:** instances do not share that directory and it is not durable account storage. Vercel documents this specifically in its [SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) and [runtime filesystem documentation](https://vercel.com/docs/functions/runtimes).

Vercel supports [native Node.js HTTP servers](https://vercel.com/changelog/deploy-node-servers-with-zero-configuration); changing frameworks is not required. Its [function limits](https://vercel.com/docs/functions/limitations) still apply: requests and buffered responses are limited to 4.5 MB. Streamed responses are exempt from the response-body limit, so the current MP4 streaming route's size is not itself the persistence problem.

Vercel also offers [Daemons in beta](https://vercel.com/docs/daemons) for continuous background workers. Their storage is ephemeral; they do not make the existing local SQLite database or MP4 directory persistent.

## Option A: Vercel in front of a persistent Windows backend

This is the smallest path that retains the current narration engine, SQLite database, Community, voice rooms and reel rendering. Vercel provides the public address and forwards requests to one persistent Windows server. That server runs the existing application and owns its database and reel files.

Complete these changes before importing the Vercel project:

1. Provision a Windows host reachable at a stable HTTPS origin, with Node.js 22.13 or newer, a desktop speech voice, FFmpeg and ffprobe. Run Studygram as a supervised process using a persistent service directory.
2. Set `STUDYGRAM_DB_PATH` to a database on persistent storage. Keep `.studygram-reels/` on persistent storage too; its path is currently relative to the project root. Preserve both across application releases and back them up. Run one app instance while the render queue and voice signaling remain in memory.
3. Implement trusted proxy support in the backend. Validate the intended public origin; use Vercel's forwarded host/protocol only on authenticated proxy requests. Ensure sign-in creates secure cookies for the public HTTPS address and same-origin checks work for POST requests. Keep the existing direct local-development mode available.
4. Configure an origin secret on the proxy and backend so the backend can distinguish trusted Vercel requests. Vercel's [external rewrite guide](https://vercel.com/docs/routing/rewrites) documents forwarded headers and adding a secret request header. Do not trust visitor-supplied forwarding headers without that boundary.
5. Prepare a small Vercel routing project that proxies all paths to the backend, preserving the path, method, cookies, `Origin` and `X-Studygram-Meta-Key`. Proxying pages as well as APIs preserves the server's HTML nonce handling and `/vendor/pdf.mjs` assets. Keep authenticated and personal responses uncached.
6. Test using the intended public hostname before promoting the deployment. Verify sign-in, Settings connection, live AI, private storage, video playback/download and Community voice signaling.

This option still requires the proxy work above. There is currently no checked-in Vercel routing configuration or backend proxy adapter that completes it automatically. Vercel does not host the Windows backend or its persistent disk.

Backend configuration for this option:

| Setting | Where and why |
| --- | --- |
| `NODE_ENV=production` | Backend; enables production behavior |
| `STUDYGRAM_ADULT_DEMO=1` | Backend; explicitly enables adult hosted-AI use |
| `META_MODEL` | Optional backend model override; defaults to `muse-spark-1.3` |
| `PORT` | Backend process listening port |
| `STUDYGRAM_HOST` | Backend listening address suitable for its ingress |
| `STUDYGRAM_DB_PATH` | Backend absolute path on persistent storage |
| `STUDYGRAM_ORIGIN` | Intended public HTTPS origin; the trusted proxy implementation must validate it correctly |
| `STUDYGRAM_TLS_CERT`, `STUDYGRAM_TLS_KEY` | The current backend startup requires certificate/key file paths in production; an HTTP listener behind trusted TLS ingress requires an explicit transport change |
| `REEL_FFMPEG`, `REEL_FFPROBE` | Optional backend executable paths if the tools are not on `PATH` |
| Origin proxy secret | Backend and Vercel; add and document its exact environment-variable name with the proxy implementation |

Personal Meta keys are entered by users in Settings, not in this configuration.

## Option B: Run the APIs on Vercel with external state and rendering

Choose this for an application whose web/API layer scales on Vercel. It is a larger implementation change:

1. Replace the local `DatabaseSync` adapter with a managed database client and migrate the schema, accounts, password hashes, sessions, private state and Community data. A connection URL alone will not convert the current synchronous SQLite code. Vercel lists [managed database integrations](https://vercel.com/docs/storage), including Postgres and Redis providers.
2. Put generated MP4s and render metadata in durable object storage such as Vercel Blob. Preserve owner authorization for private videos and require an explicit Community publication before shared playback. Account for the current same-origin media policy when choosing URLs or delivery routes.
3. Persist render jobs and progress in the database or queue. Process them in a durable worker, using either a Windows worker for the existing narration or a portable narration implementation with FFmpeg/ffprobe. Do not depend on an untracked promise continuing after a function responds.
4. Move voice room membership, leases and pending signaling messages into shared storage or a signaling service. Keep authorization and expiration checks. Move per-user/IP rate limits into shared storage as well.
5. Add trusted HTTPS/origin handling for Vercel ingress. Preserve secure cookies, account checks and same-origin checks. The operator's adult-demo switch must remain enforced on the backend.
6. Split or reduce private sync bodies so requests and buffered responses stay below 4.5 MB, including JSON overhead. Preserve conflict/version checks.
7. Add a recognized native Node entry or a Vercel function handler. Configure routes and include required static HTML/CSS/JS, avatars and PDF.js assets. Preserve CSP handling. If producing static output, copy only public assets into it; do not publish the repository root as a file directory.
8. Document and configure the selected database, object-storage, queue, worker, signaling and proxy credentials. Keep those operator secrets on the server. Test the full app against these services before deployment.

Do not set the local TLS file variables on a Vercel function as a substitute for ingress support, and do not deploy a temporary SQLite database. Vercel terminates public HTTPS; the application needs an intentional transport adapter for that environment.

## Import through GitHub after the chosen path is ready

These steps publish the prepared architecture; they do not perform the migrations above.

1. Run `npm install` and `npm test`. Verify the selected production architecture locally or in staging, including persistence across an app restart. Review the prepared changes and push them to your GitHub repository. Keep `.env`, databases, TLS keys, generated reels and local tool binaries out of Git; the repository's `.gitignore` already covers them.
2. Open [Vercel New Project](https://vercel.com/new), import the GitHub repository, and select the project root. If Option A uses a separate routing subdirectory, select that prepared directory instead.
3. Use the framework/build/output settings supplied by the completed implementation. For Option A this is the routing project; for Option B it is the prepared Node/API project and public assets. Do not use `npm start` as a static build command or guess an output directory to make an unprepared import pass.
4. Add the operator environment variables needed by the selected Vercel project. With Option A, the adult-demo/model/database/render configuration belongs on the Windows backend; Vercel needs its routing/origin authentication configuration. With Option B, Vercel needs the adult-demo switch, optional model override and credentials for the selected persistent services. No shared Meta key is needed.
5. Deploy a preview where the selected services support it. Configure the exact preview/public origin in the prepared origin adapter. Keep preview and production learning data separate.
6. Open the HTTPS deployment. Create an account, connect a personal key in Settings, generate a study set, render a reel, play/download it and explicitly share it. Verify a second account cannot read private data or reels. Exercise a Community voice room from two browsers.
7. Restart the backend/worker, or exercise a fresh function instance, and verify saved data and completed reels remain available. Check that changing accounts or signing out clears the tab's Meta key.
8. Add the production domain in Vercel, set the matching production origin and service variables, then redeploy to production. Repeat the account, AI, persistence and video checks on that hostname.

See Vercel's [Git deployment documentation](https://vercel.com/docs/deployments/git) for import and automatic deployment behavior. The project is ready for these final import steps only after one of the architectures above has been implemented and verified.
