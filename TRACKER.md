# Voice Agent Platform: Build Tracker

What we're building: our own dashboard, modeled on the Bolna playground (screenshots in
`bolna-app-screenshots/`), running on our self-hosted Bolna fork, in NexaNeura's look.

**How we work:** one feature at a time. For each one: **Plan** (what we can do, what's hard, what's
out) → **you approve** → **build frontend + backend together** → **verify** → tick it off here.

**Legend**

| Mark | Meaning |
|---|---|
| ✅ | Backend already supports it; mostly UI work |
| 🟡 | Possible, but needs new backend work or a setup step |
| 🔴 | Not possible right now (missing service, or out of scope); explained in the feature |
| `P0` | Needed for the investor demo |
| `P1` | Strong to have, right after the demo path |
| `P2` | Later |

Status per feature: `todo` → `planning` → `approved` → `ui-done` (screen built on sample data) → `building` (backend) → `done`

**Frontend status (2026-11-20):** every screen below is built on sample data (`frontend/src/mocks`). Screens read data only through `frontend/src/services/*`, so backend integration swaps one service at a time; each service file lists the endpoint it will call.

---

## 0. Design system (NexaNeura theme)

Taken from https://nexaneura.com (`assets/css/styles.css`). Light theme only, like the site.

| Token | Value | Use |
|---|---|---|
| Indigo (primary) | `#4F46E5` | Primary buttons, active nav, links, focus |
| Indigo deep | `#3A31C4` | Primary hover |
| Indigo wash | `#EEF0FE` | Active nav background, selected chips |
| Indigo light | `#A5A0FF` | Accents, chart lines |
| Navy | `#0A1733` | Headings, wordmark |
| Body text | `#212B47` | Body copy |
| Secondary text | `#3C4866` | Labels, muted text |
| Line | `#DFE4EF` | Borders, dividers |
| Ground / Alt | `#FFFFFF` / `#F4F6FB` | Cards / page background |
| Green / wash | `#0B8F6C` / `#EAF8F2` | Success, "Live", completed calls |
| Amber | `#B45309` | Warnings |
| Wine / wash | `#9E2F4E` / `#FBEEF1` | Errors, failed calls, end nodes |
| Dark surface | `#070D1E` | Optional dark hero / login panel |
| Radius | `16px` cards, `9–14px` controls, `999px` pills | |
| Shadow (card) | `0 1px 2px rgba(10,23,51,.06), 0 12px 32px rgba(10,23,51,.09)` | |
| Shadow (lift) | `0 4px 10px rgba(10,23,51,.08), 0 28px 60px rgba(10,23,51,.16)` | Hover / popovers |
| Font | **Space Grotesk** 300–700; Devanagari fallback `Noto Sans Devanagari`; mono `ui-monospace` | |
| Primary button | Indigo fill, white text, 600 weight, indigo glow shadow, lifts 1px on hover | |
| Secondary button | White, navy text, line border → indigo border + indigo wash on hover | |
| Wordmark | "Nexa**Neura**": 700 weight, `-0.032em` tracking, "Neura" in indigo | |
| Signature gradient | Soft radial blend: `#8FD8F2` · `#37B394` · `#C226CF` · `#FBA7D6` | Empty states, login, hero cards only |

### How we differ from Bolna (UI/UX tweaks, not a copy)

- **Sidebar:** slimmer, with the NexaNeura wordmark and fewer, clearer groups. The active item is an indigo-wash pill with an indigo icon, not grey.
- **Agent Studio:** **vertical tabs on the left of the editor** (one section at a time, kept in the URL as `?tab=`), with a completeness mark per tab, instead of 7 equal horizontal tabs.
- **"Test agent" drawer** on the right, available on every agent page: phone call, web call and chat in one place, with the live transcript inside the drawer. Bolna splits these between a footer button and an inspector tab.
- **"Stack" summary** in the agent header (STT · LLM · TTS · Telephony chips) instead of Bolna's cost bar. No price estimate and no fake credit balance.
- **Call history:** clicking a row opens a **side sheet** with chat-bubble transcript, audio player and latency timeline, instead of separate Debug / Conversation columns.
- **Graph editor:** nodes colored by type (LLM = indigo, static = green, end = wine), a minimap, and the inspector reusing the Agent Studio forms.
- **Sticky save bar** that appears only when there are unsaved changes, showing "Unsaved changes · Discard · Save".

---

## 1. Foundations

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| F1 | Bare frontend (Vite + React + TS + Tailwind + TanStack Query) | ✅ | P0 | **done** |
| F2 | Postgres in docker-compose + `/db/health` | ✅ | P0 | **done** (VM rollout pending: DevOps doc sent) |
| F3 | Apply NexaNeura theme: tokens, Space Grotesk, buttons, cards, wordmark, sidebar groups | ✅ | P0 | **done** |
| F4 | Shared UI kit: input, textarea, select, combobox, switch, slider + number box, tabs, dialog, sheet, tooltip, table, toast, copy-chip | ✅ | P0 | **done** |
| F5 | Agent-config typings + form↔JSON mapper (UI form ⇄ Bolna `agent_config` + `agent_prompts`) | ✅ | P0 | **done** |
| F6 | Production serving: nginx serves `frontend/dist`, routes `/api/bolna/*` and `/api/telephony/*`; plivo routes stay reachable | 🟡 | P0 | todo |
| F7 | Basic access gate (single password / PIN) before the dashboard is on a public URL | 🟡 Not in Bolna; small backend add | P0 | todo |
| F8 | Fix `GET/PUT/DELETE /agent/{id}` returning 500 instead of 404 | ✅ | P0 | todo |
| F9 | Store `created_at` / `updated_at` / `agent_type` on agents (for "Updated 21 days ago" and the agent lists) | ✅ | P0 | todo |

---

## 2. Agent Studio (`Agent Studio/*` screenshots)

### 2.0 Agent list + create

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A0.1 | Agent list (cards, search, "Updated …") | ✅ `GET /all` | P0 | ui-done |
| A0.2 | Create agent: blank, or from template (our `agent.json`, graph v3, v4 multilingual) | ✅ `POST /agent` | P0 | ui-done |
| A0.3 | Delete / duplicate agent | ✅ | P1 | ui-done |

### 2.1 Agent header

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A1.1 | Inline-editable agent name, breadcrumb, agent-ID copy chip | ✅ | P0 | ui-done |
| A1.2 | Stack summary (providers in use) | ✅ | P1 | ui-done (cost estimate removed on request) |
| A1.3 | Voice engine selector (Cascaded vs speech-to-speech) | 🟡 Bolna has `s2s/`; we only run cascaded. Show as read-only "Cascaded" for now | P2 | skipped (scope 2026-11-20) |
| A1.4 | Version history + "v40 Live" switcher | 🔴 Now / 🟡 later: needs an `agent_versions` table in Postgres | P2 | skipped (scope 2026-11-20) |
| A1.5 | Credits balance / top-up | 🔴 No billing system; leave out | — | won't do |

### 2.2 Agent tab → our "Prompt" section

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A2.1 | Welcome message with `{{variable}}` hint | ✅ `agent_welcome_message` | P0 | ui-done |
| A2.2 | Welcome delay (ms) slider | ✅ `welcome_message_delay` | P1 | ui-done |
| A2.3 | Ignore user speech before the welcome finishes | 🟡 Need to confirm the config key during planning | P2 | ui-done |
| A2.4 | Prompt editor (system prompt) with token count and variable chips | ✅ `agent_prompts.task_1.system_prompt` | P0 | ui-done |
| A2.5 | Per-language prompt tabs (Bengali / English / Hindi) | 🟡 Check how our multilingual agent stores per-language prompts | P1 | ui-done |
| A2.6 | Variables panel (detect `{{…}}`, set test values) | ✅ Front-end parse; values sent as context at call time | P1 | ui-done |
| A2.7 | "AI Edit" (rewrite the prompt with an LLM) | 🟡 Small backend endpoint calling OpenAI | P2 | ui-done |
| A2.8 | Hang up using a prompt (toggle + prompt) | ✅ Bolna hangup-prompt config | P1 | ui-done |

### 2.3 Intelligence

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A3.1 | LLM provider + model select (with provider logos) | ✅ | P0 | ui-done |
| A3.2 | Max tokens + temperature sliders | ✅ | P0 | ui-done |
| A3.3 | Attach knowledge bases | 🔴 Depends on §5 Knowledge Base | P2 | ui-done |

### 2.4 Languages (voice + transcription)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A4.1 | Language chips (default + extra languages); switch mode "requested or auto-detected" | ✅ `synthesizer.multilingual` + `active` (already used by our v4 agent) | P0 | ui-done |
| A4.2 | Voice: provider / model / voice per language (Cartesia, Sarvam) | ✅ | P0 | ui-done |
| A4.3 | **Voice preview ▶** | 🟡 Small endpoint; reuses the TTS code already in `quickstart_server.py` | P1 | ui-done |
| A4.4 | Voice advanced settings (speed, buffer, etc.) | ✅ | P2 | todo |
| A4.5 | Transcription: provider / model per language (Gemini, Sarvam) | ✅ | P0 | ui-done |
| A4.6 | Keywords (ASR biasing) + context | ✅ Bolna supports keyword biasing per provider; confirm for Gemini/Sarvam | P1 | ui-done |
| A4.7 | Hand-in: agent name + hand-in message on language switch | 🟡 Confirm config key during planning | P2 | ui-done |

### 2.5 Calling

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A5.1 | Telephony provider select (Plivo active; Twilio shown as "not configured") | ✅ | P0 | ui-done |
| A5.2 | Ambient noise (presets in `local_setup/presets/ambient_noise`) + preview | ✅ | P1 | ui-done |
| A5.3 | Voicemail detection, keypad input (DTMF) | ✅ Supported in Bolna | P1 | ui-done |
| A5.4 | Noise cancellation | 🟡 Need to check for support | P2 | ui-done |
| A5.5 | Auto reschedule | 🔴 No scheduler; leave out | — | won't do |
| A5.6 | Inbound calling (assign a number, answer with this agent) | 🟡 Needs an inbound Plivo answer URL + number→agent mapping | P2 | ui-done |
| A5.7 | Outbound timing restrictions | 🔴 Only meaningful with campaigns (§7) | — | ui-done (saved, not enforced) |

### 2.6 Engine

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A6.1 | Response latency: linear delay (ms) | ✅ `incremental_delay` | P1 | ui-done |
| A6.2 | Words to wait for before interrupting | ✅ `number_of_words_for_interruption` | P1 | ui-done |
| A6.3 | User online detection: message per language + invoke-after seconds | ✅ | P1 | ui-done |
| A6.4 | Final call message per language + allow interruption | ✅ `call_hangup_message` (per-language dict supported) | P1 | ui-done |
| A6.5 | Hang up on user silence (s), total call timeout (s) | ✅ | P0 | ui-done |

### 2.7 Tools

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A7.1 | Active tools list (configure / delete) | ✅ | P1 | ui-done |
| A7.2 | Transfer call (number) | ✅ We built `/transfer_call` | P0 | ui-done |
| A7.3 | Custom function: write manually (name, description, params, URL, method) | ✅ Bolna `api_tools` | P1 | ui-done |
| A7.4 | Custom function: generate from cURL | ✅ Front-end parser | P2 | ui-done |
| A7.5 | Calendar availability / book appointment | 🟡 Bolna has calendar tooling but needs a Cal.com account and key; confirm during planning | P2 | ui-done |
| A7.6 | Web search tool | 🟡 Confirm provider and key during planning | P2 | ui-done |

### 2.8 Extractions (post-call)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A8.1 | Webhook URL (+ headers) | ✅ Bolna webhook task | P1 | ui-done |
| A8.2 | Trigger on statuses | 🟡 Filter in our backend | P2 | ui-done |
| A8.3 | "Send test": post a sample payload | ✅ Small endpoint | P2 | ui-done |
| A8.4 | Delivery health | 🟡 Needs delivery logging in Postgres | P2 | ui-done |
| A8.5 | Call summary toggle | ✅ Bolna summarization task | P1 | ui-done |
| A8.6 | Custom extraction categories (+ Test) | ✅ Bolna extraction task (`extraction_details`) | P1 | ui-done |
| A8.7 | Extraction library (prebuilt templates) | 🟡 Front-end templates only | P2 | ui-done |

### 2.9 Save + test

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| A9.1 | Save (sticky unsaved-changes bar) | ✅ `PUT /agent/{id}` | P0 | ui-done |
| A9.2 | Test drawer → **Get a call** (phone number input) | ✅ `POST /call`; change it to return the call ID | P0 | ui-done |
| A9.3 | Test drawer → **Web call** (talk in the browser, live transcript) | 🟡 New `/chat/v1/web/{id}` route + Web Audio client (planned earlier) | P0 | ui-done |
| A9.4 | Test drawer → **Chat with agent** (text) | 🟡 Bolna has a turn-based text mode; needs a route | P1 | ui-done |

---

## 3. Graph Agent (`Graph Agent/*` screenshots)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| G1 | Graph agent list (cards, search, Create ▾ from template) | ✅ Filter `GET /all` by agent type | P0 | ui-done |
| G2 | Canvas: render nodes + edges from our graph JSON (React Flow), auto-layout, zoom / fit / minimap | ✅ | P0 | ui-done |
| G3 | Node details on click (prompt, static message, edges and conditions) | ✅ | P0 | ui-done |
| G4 | Edit nodes / edges, add node, delete node | ✅ Large UI task | P1 | ui-done |
| G5 | Import / export JSON, raw JSON view (`{}`) | ✅ | P1 | ui-done |
| G6 | Undo / redo, search nodes | ✅ Client-side | P2 | ui-done |
| G7 | Validate graph (✓ button): unreachable nodes, missing edges, no end node | ✅ Client-side | P1 | ui-done |
| G8 | Inspector → Agent setup (basics, languages + voice, LLM, conversation settings, advanced JSON) | ✅ Reuses Agent Studio forms | P1 | ui-done |
| G9 | Inspector → Tools with **per-node tool visibility** | ✅ Graph agent has per-node tools | P2 | ui-done |
| G10 | Inspector → Test agent (phone / web / chat) | ✅ Reuses the test drawer | P0 | ui-done |
| G11 | Version history (clock icon) | 🔴 Same as A1.4 | P2 | later |
| G12 | AI generate / magic-wand graph | 🔴 Later | — | later |

---

## 4. Call History (`Call History/*` screenshot)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| C1 | **Persist every call** to Postgres `calls` (run_id, call_sid, agent, number, type, status, start/end, duration, hangup reason, transcript JSONB, latencies JSONB, recording path) | 🟡 Core backend work; bolna-app writes at call end, plivo-app adds the recording | P0 | todo |
| C2 | Call status lifecycle (queued → ringing → in-progress → completed / no-answer / failed) | 🟡 Plivo hangup callback + `/call` creates the row | P0 | todo |
| C3 | Stat cards: total calls, total duration, avg duration (+ estimated cost) | ✅ After C1 | P0 | ui-done |
| C4 | Table: execution ID, number, type, duration, hang-up by, termination reason, started at, status | ✅ After C1 | P0 | ui-done |
| C5 | Filters: agent, date range, status, call type, provider; search by ID / number; pagination | ✅ After C1 | P0 | ui-done |
| C6 | **Call detail sheet:** transcript bubbles, audio player, latency breakdown per turn, extracted data / summary | 🟡 Recording: signed GCS URL works on the VM; **no recordings locally or for web calls** (Bolna disables recording on web calls) | P0 | ui-done |
| C7 | Download CSV | ✅ | P1 | ui-done |
| C8 | Rating per call | ✅ Column in `calls` | P2 | ui-done |
| C9 | Campaign / batch / version filters, "Stop queued calls" | 🔴 Need campaigns (§7) and versions (A1.4) | — | later |

---

## 5. Knowledge Base (`Knowledge Base/*` screenshot)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| K1 | KB list (ID, source, type, created, status, download, delete) + upload PDF | 🔴 **Now.** Bolna's agent calls a separate **RAG server** (`RAG_SERVER_URL`: `POST /conversation/query`, `GET /collections/{id}/health`) that is **not open source**. | P2 | ui-done |
| K2 | Our own RAG service implementing that contract (PDF parse → chunks → OpenAI embeddings → **pgvector** in our Postgres) | 🟡 About a day of work; then K1 and A3.3 become possible | P2 | todo |
| K3 | API / MCP buttons | 🔴 Out of scope | — | won't do |

---

## 6. App shell and remaining sidebar items

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| S1 | Sidebar groups: **Build** (Agents, Graph Agents, Knowledge Base) · **Monitor** (Call History, Analytics) · **Settings** | ✅ | P0 | ui-done |
| S2 | Overview / Analytics: calls per day, success rate, avg duration, latency charts | ✅ After C1 | P1 | ui-done |
| S3 | My Numbers: list our Plivo numbers (read-only) | 🟡 Plivo API call | P2 | ui-done |
| S4 | Settings: show which provider keys are configured (never the values) | 🟡 | P2 | ui-done |
| S5 | Org switcher, user profile, multi-user login | 🔴 No auth / tenancy in this stack (F7 is a simple gate only) | — | later |
| S6 | Ask Bolna (AI assistant), Workflows, SIP Trunks, Reports, Developers / API keys | 🔴 Out of scope for now | — | won't do |
| S7 | Top promo banner, floating help bubble | — Bolna marketing; not needed | — | won't do |

## 7. Deploy features (not in the screenshots; listed so nothing is forgotten)

| # | Item | Feasibility | Priority | Status |
|---|---|---|---|---|
| D1 | Campaigns / Batches: upload CSV of numbers + variables, call them with rate limits | 🟡 Needs a job queue + scheduler | P2 | todo |

---

## Suggested build order

1. **F3–F5, F8, F9** (theme, UI kit, config mapper, backend fixes)
2. **Agent list + Agent Studio P0** (A0, A1.1, A2.1, A2.4, A3.1–2, A4.1–2, A4.5, A5.1, A6.5, A7.2, A9.1–2)
3. **Call History P0** (C1–C6)
4. **Web call** (A9.3)
5. **Graph Agent P0** (G1–G3, G10)
6. **F6–F7** (production serving + access gate) → deploy for the demo
7. P1 items, then P2

## Not possible right now (summary)

- **Knowledge Base:** Bolna's RAG server is closed source. Possible later if we build our own (K2, about a day).
- **Credits / billing, auto reschedule, campaigns' timing rules, versions:** no backing system yet.
- **Recordings for web calls and local runs:** Bolna turns recording off for web calls; local runs have no GCS bucket.
- **Multi-user / org accounts:** no auth in this stack; a simple access gate only (F7).
