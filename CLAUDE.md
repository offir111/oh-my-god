# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Run both client and server together
npm run dev:full

# Client only (port 5173, proxies /api and /socket.io to localhost:3001)
npm run dev:client

# Server only (port 3001, auto-restarts with --watch)
npm run dev:server
```

### Build & Deploy
```bash
# Build client for production
npm run build:client

# Deploy client to Vercel (manual — no GitHub auto-deploy)
cd client && npx vercel deploy --prod

# Android
npm run android:sync   # builds client then syncs to Capacitor
npm run android:open   # opens in Android Studio

# iOS
npm run ios:sync
npm run ios:open
```

### Server env setup
```bash
cp server/.env.example server/.env
# Fill in GROQ_API_KEY (required for AI debates) and OMG_ADMIN_PASSWORD (8 chars)
```

## Architecture

### Monorepo structure
```
debate-app/
├── client/          # React 18 + Vite + Zustand + Socket.IO client
├── server/          # Node.js (ES modules) + Express + Socket.IO server
├── android/         # Capacitor Android wrapper
└── ios/             # Capacitor iOS wrapper
```

### Data persistence — no database
All data lives in `server/store/memory.js` as an in-memory `store` object. Every write calls `saveSnapshot()` which serializes to `server/store-snapshot.json`. The server also runs an auto-save interval. On boot, `loadSnapshot()` restores state.

Key collections in `store`:
- `users` Map — `socketId → { username, side, score, … }` (online session only, cleared on disconnect)
- `registeredUsernames` Set + `registeredPasswords` Map — append-only; usernames are **never removed**
- `registeredCount` — always `Math.max(count, set.size)`; never decrements
- `userScores` Map — `username → { score, voiceDebates, giftsReceived, side }`
- `archivedDebates` Array — finished debates used for stats and knowledge base
- `topicCounts` Map — topic popularity

Username normalization: all lookups use `normalizeUsername()` (trim + lowercase). The reserved admin username is `omg`.

### Authentication
- Regular users: 4-char password, SHA-256 hashed, checked at `/api/register` (idempotent — same hash = login, different hash = error)
- Admin (OMG): 8-char password from `OMG_ADMIN_PASSWORD` env, returns JWT Bearer token for `/api/admin/*` routes
- No session tokens for regular users — identity is passed via `socket.auth = { username, side }` on every connect

### Client state
`client/src/store/appStore.js` — single Zustand store. Persists `user` and `pendingUser` to localStorage (`omg_user`, `omg_pending`).

`client/src/socket.js` — singleton Socket.IO client. `connectSocket(username, side)` reconnects only when identity changes.

### Socket events flow
1. Client connects with `socket.auth = { username, side }`
2. Server registers in `store.users` and emits `registered` count
3. Matchmaking: `join_queue` → server pairs two users → `debate_started`
4. During debate: `send_message`, `send_voice`, `give_gift`, `like_message`
5. Spectating: `join_debate`, `leave_debate` via `socket/spectator.js`
6. Faith chat: separate namespace in `socket/faithChat.js`

Socket handlers are split across `server/socket/`: `matchmaking.js`, `debate.js`, `spectator.js`, `faithChat.js`. All share the same `store` import.

### API routes
- `GET /api/stats` — registered count + online count + lists
- `POST /api/register` — register or re-authenticate (idempotent by username+hash)
- `GET /api/users/:username/stats` — per-user score/debate stats
- `GET /api/leaderboard` — top 20 by score + quality
- `GET /api/debates/*` — archived debates (knowledge base)
- `GET|POST /api/admin/*` — admin panel (requires Bearer token)
- `POST /api/bible-search` — Groq AI search
- `GET /api/health`

### Client routing (React Router)
All pages are in `client/src/pages/`. Key pages:
- `/login` — LoginPage.jsx — registration + side selection (believer/atheist)
- `/lobby` — LobbyPage.jsx — matchmaking queue, friend list, live debates
- `/debate/:id` — DebatePage.jsx — live text + voice debate
- `/leaderboard` — LeaderboardPage.jsx
- `/profile/:username` — CageUserProfilePage.jsx — user profile (partially localStorage-based)
- `/live-events` — spectate live debates
- `/knowledge` — archived debate knowledge base
- `/info/contact` — also hosts the admin panel (collapsible login section)
- `/faith` — faith chat + articles

### Dev vs. production URL handling
In dev, Vite proxies `/api` and `/socket.io` to `localhost:3001` — client uses relative URLs. In production, `VITE_API_URL=https://oh-my-god-production.up.railway.app` is set in `client/.env.production`. Logic lives in `client/src/lib/apiBaseUrl.js`.

### Mobile (Capacitor)
The client builds to a static bundle that Capacitor wraps. After any client change: `npm run android:sync` (build + `cap sync`). Vite config reads `process.env.PORT` for the dev server port so the preview tool's auto-port works.

### AI integration
Groq SDK (`groq-sdk`) is used for AI debate opponents and Bible search. Model: `llama-3.3-70b-versatile` with fallback to `llama-3.1-8b-instant`. All Groq calls go through `server/lib/groqChat.js` (`chatCompletionWithFallback`).

## Recent client updates (Claude-assisted)

Use `git log` / `git diff` for the full branch; below is a concise map of behavior and files.

### Faith chat — presence user menu (`client/src/components/faith/FaithChatPanel.jsx`)
- Floating menu on usernames in the “נוכחים” list: **stabilized** so moving the pointer to “שיחה פרטית” does not dismiss the sheet (pin when pointer enters the portal sheet, longer delayed close when unpinned, `mousedown` outside closes and clears pin, wider overlap bridge in CSS between name and sheet). Opening another user while the menu is open is allowed.

### AI voice page (`client/src/pages/AiVoicePage.jsx`)
- Header copy includes **«שלך»** in the subtitle; header gold uses a stronger accent (`HEADER_TITLE_COLOR`) vs page background gold.
- **No** idle or in-call **×** escape buttons in the page body (exit via header AI toggle / end-call UI). `useNavigate` is not used for those removed controls.

### Podcast LIVE — header dropdown (`HomeLivePodcastPanel.jsx`, `headerPodcastPanel.css`, `globals.css`, `AppHeader.jsx`)
- Panel stays **fixed** under the shell; when open, `#root` gets class `header-podcast-panel-open` and `--header-podcast-panel-reserved-h` (measured with **ResizeObserver**) so **`#root` `padding-top`** grows and **main content is pushed down** instead of being covered.
- **No** title line «פודקאסט LIVE — הקשבה» in the panel.
- **Close ×** sits in the **same flex row** as the podcast tabs (`home-live-broadcast-row`), with compact tab strip (`fit-content`), tuned tab gaps/padding/font sizes, and × shifted **1cm left** via `transform: translateX(-1cm)` at **34×34px**.
- **AppHeader** grid: “פודקאסט LIVE” uses **`toggleHeaderPodcastPanel`** (same idea as `SiteQuickNav`) so the menu can open/close the panel without relying only on × / Esc.

### Registered members page (`client/src/pages/RegisteredMembersPage.jsx`)
- Keeps a **page-local ×** (`.registered-page__close`) for back navigation — there is **no** global floating exit button in `App.jsx` (a shared `AppExitCloseButton` was tried and **removed**).

### Other touched areas in this worktree (inspect diffs locally)
- Examples: `AppHeader.jsx`, `MiniRadioBar.jsx`, `RadioAudioContext.jsx`, `israeliRadioStations.js`, `radioStationIsraelOrder.js`, `ytStationsLocal.js`, `BlogPage.jsx`, `CageUserProfilePage.jsx`, `LiveEventsPage.jsx`, `VideoLivePage.jsx`, `ArgumentsPage.jsx`, `socketFaith.js`, `server/routes/admin.js`, `server/socket/matchmaking.js`, `server/store/memory.js`, untracked `client/src/components/media/`, scripts `seed-users.mjs`, `set-online.mjs`.
