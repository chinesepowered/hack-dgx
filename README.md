<p align="center"><img src="docs/bagel.png" width="180" alt="Bagel the beagle"></p>

<h1 align="center">Bagel works the night shift</h1>

<p align="center"><b>A personal agent you'll actually use every day.</b><br>
While you sleep, Bagel the beagle preps tomorrow. At 7:00 AM he drops <i>The Morning Bark</i> at your door:<br>
every promise you made, every reply you're owed, a brief for your first meeting, and the awkward calls, already lined up.<br>
One tap each. Then at 9:00 he makes the calls.</p>

---

## The daily loop

| When | What Bagel does |
| --- | --- |
| **2:00 AM** · the night shift | Reads tomorrow's calendar and your inbox, finds commitments in both directions, researches first-time meetings, spots double-bookings, and lines up phone calls. Every step shows up as a paw print on the trail. |
| **7:00 AM** · *The Morning Bark* | A newspaper of ready-to-approve work: drafts with the right file already attached, nudges for overdue replies, a cited meeting brief, a fix for the double-booking. Nothing is sent without your tap. |
| **9:00 AM** · the awkward calls | When the business opens, Bagel calls: moves the dentist that clashes with your investor update (checking your calendar mid-call), cancels the gym you haven't visited since August, declines the retention offers, and asks for the late fee to be waived. Then he updates your calendar. |

| Night shift | The Morning Bark | On the phone |
| --- | --- | --- |
| ![Night shift](docs/night-shift.png) | ![The Morning Bark](docs/morning-bark.png) | ![Call](docs/call.png) |

## Run it

```bash
npm install
npm run dev            # server on :8787, app on http://localhost:5173
```

Open http://localhost:5173 and use the time buttons (11:58 PM → 2:00 AM → 7:00 AM → 9:00 AM), or tap through the phone.

- **Replay mode** (default) plays back a recorded *real* run from `data/demo/snapshot.json`: the agent's actual tool calls, the actual Parallel brief, the actual voiced calls. No keys, no network, no cost. Approvals and calendar changes still execute.
- **Live mode** runs everything for real. `cp .env.example .env`, add keys, then hit **Live** in the side panel (or `BAGEL_MODE=live npm run dev`). A live night shift takes about a minute (plus a minute or two for Parallel research on a new company); each call takes ~15 s to converse and ~20 s to voice.

`npm start` builds the web app and serves everything from :8787. On a phone-sized screen the app fills the screen; open it on your phone.

## How it works

```
                    ┌──────────────── Cline SDK Agent (Qwen 3.8 on W&B Inference) ────────────────┐
  2:00 AM  ───────▶ │ tools: GMAIL_FETCH_EMAILS · GOOGLECALENDAR_EVENTS_LIST · GOOGLEDRIVE_FIND_FILE │──▶ The Morning Bark
                    │        research_meeting (Parallel) · record_promise · record_conflict ·       │    (promises, brief,
                    │        propose_call · publish_morning_bark                                     │     conflict, calls)
                    └─────────────────────── events ▶ paw-print trail ────────────────────────────────┘
  7:00 AM  ───────▶ you tap Send / Approve call  ──▶ GMAIL_SEND_EMAIL · schedule call for opening time
                    ┌──────── Cline SDK Agent: Bagel on the phone ────────┐
  9:00 AM  ───────▶ │ tools: GOOGLECALENDAR_FIND_FREE_SLOTS · end_call     │──▶ GOOGLECALENDAR_PATCH_EVENT
                    └───── voices: ElevenLabs (Bagel + front desk) ────────┘     outcome + recording
```

**Sponsor tech, and where it lives**

- **Cline SDK** (`@cline/sdk`) is Bagel's brain, twice: the night-shift agent (`server/agent/nightshift.ts`) and Bagel on the phone (`server/caller/call.ts`). Custom tools via `createTool` with zod schemas, a completion tool (`publish_morning_bark`, `end_call`), and the SDK's event stream (`tool-started` / `tool-finished`) drives the paw-print trail and the "under the hood" log.
- **Qwen 3.8** (`Qwen/Qwen3.8-27B`) on **W&B Inference**, through Cline's `openai-compatible` provider. Reasoning is set per job with `modelOptions.reasoningEffort` (`low` for planning, off for the simulated front desk).
- **Parallel** Task API (`base` processor, JSON output schema) researches first meetings and returns a one-liner, recent news, key people and talking points, with the sources behind each field (`server/research/parallel.ts`).
- **Composio**: Bagel calls your accounts through Composio's real tool slugs and argument names (`GMAIL_FETCH_EMAILS`, `GOOGLECALENDAR_EVENTS_LIST`, `GOOGLECALENDAR_FIND_FREE_SLOTS`, `GOOGLECALENDAR_PATCH_EVENT`, `GMAIL_SEND_EMAIL`, `GOOGLEDRIVE_FIND_FILE`). For the hackathon those calls are answered by sample data (`server/integrations/composio.ts`, `dataset.ts`). Going live is one swap:

  ```ts
  import { Composio } from "@composio/core"
  const session = await new Composio().create(userId)   // Gmail, Calendar, Drive
  const result = await session.execute(slug, args)       // same slugs, same args
  ```

  For a real account: use read-only Gmail scopes on the auth config, restrict the session to read-only tools, and keep every send behind a tap.
- **ElevenLabs** voices Bagel and the front desk (`server/caller/voice.ts`); ffmpeg mixes in a ringback tone and a phone-line filter.

## Honest notes

- Everything Jordan sees comes from **sample data** shaped exactly like Composio's responses. The meeting brief is **real** Parallel research on a real company.
- On the calls, **the front desk is simulated**: a second model plays the receptionist, following the business's policies (fees, retention offers, open slots). Bagel's side is the real agent, and his first line always says he's an AI assistant calling on Jordan's behalf. Real phone numbers (e.g. Twilio or ElevenLabs' phone integration) are the production step.
- Nothing is sent, booked or changed without a tap in *The Morning Bark*.

## Recording a new demo run

```bash
npm run record                      # live night shift + both calls, voiced; overwrites data/demo/snapshot.json
npm run record -- --keep=biz_gym    # re-record, but keep an existing call recording
```

Each call is rehearsed as text first and only voiced once it passes checks (goal met, AI disclosure, no gendered language, length), so ElevenLabs credits aren't spent on bad takes. Voiced lines are cached in `data/runtime/tts`.

## Layout

```
server/
  agent/nightshift.ts     the night shift (Cline SDK agent + tools)
  caller/call.ts          Bagel on the phone (Cline SDK agent) + simulated front desk
  caller/voice.ts         ElevenLabs voices + ffmpeg mixing
  research/parallel.ts    Parallel Task API meeting briefs
  integrations/           Composio-shaped tools over sample data
  engine.ts               demo clock, approvals, call queue, record/replay
  index.ts                API + live updates (SSE)
web/src/                  the phone app: Bagel (SVG), night trail, The Morning Bark, call screen
scripts/                  record-snapshot, try-nightshift, try-calls, flow (end-to-end screenshots)
data/demo/                the recorded run used by replay mode (+ call audio)
```
