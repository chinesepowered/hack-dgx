<p align="center"><img src="docs/bagel.png" width="180" alt="Bagel the beagle"></p>

<h1 align="center">Bagel works the night shift</h1>

<p align="center"><b>A personal agent you'll actually use every day.</b><br>
While you sleep, Bagel the beagle preps tomorrow. At 7:00 AM he drops <i>The Morning Bark</i> at your door:<br>
every promise you made, every reply you're owed, a brief for your first meeting, and the awkward calls, already lined up.<br>
One tap each. Then at 9:00 he makes the calls.</p>

<!-- Demo video: swap this link for the YouTube URL once it's uploaded. -->
<p align="center"><b>▶ <a href="demo/bagel-demo.mp4">Watch the 2-minute demo</a></b> · <a href="slides.pdf">Slides</a> · <a href="PITCH.md">Pitch</a></p>

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

## Architecture

```mermaid
flowchart LR
  subgraph night["🌙 2:00 AM · the night shift"]
    direction TB
    NS["<b>Night-shift agent</b><br/>Cline SDK · Qwen 3.8 on W&B Inference"]
    C1["<b>Composio</b> · Gmail, Calendar, Drive<br/>GMAIL_FETCH_EMAILS<br/>GOOGLECALENDAR_EVENTS_LIST<br/>GOOGLEDRIVE_FIND_FILE"]
    P1["<b>Parallel</b> Task API<br/>cited meeting research"]
    NS -- "reads" --> C1
    NS -- "research_meeting" --> P1
  end
  MB[["🗞️ <b>The Morning Bark</b><br/>promises · brief<br/>conflict fix · calls"]]
  subgraph morning["☀️ 7:00 AM · one tap each"]
    direction TB
    U(("🙋 You"))
    C2["<b>Composio</b> · Gmail<br/>GMAIL_SEND_EMAIL"]
    U -- "Send" --> C2
  end
  subgraph calls["📞 9:00 AM · the calls"]
    direction TB
    CA["<b>Call agent</b><br/>Cline SDK · Qwen 3.8"]
    C3["<b>Composio</b> · Calendar<br/>FIND_FREE_SLOTS · PATCH_EVENT"]
    FD["Front desk<br/>(simulated voice in the demo)"]
    EL["<b>ElevenLabs</b><br/>voices"]
    CA -- "checks your calendar,<br/>moves the event" --> C3
    CA <-- "conversation" --> FD
    CA --> EL
  end
  NS -- "record_promise<br/>record_conflict<br/>propose_call" --> MB
  MB --> U
  U -- "Approve call" --> CA
```

The phone app (React) talks to a small Express server over server-sent events. The server owns a demo clock, so the night shift, the 7:00 AM paper and the 9:00 AM calls can run on schedule or be skipped to on stage. Each tool call the agents make becomes a paw print on the trail and a line in the app's "under the hood" log.

## Built with

- **Cline SDK** (`@cline/sdk`) is Bagel's brain, twice: the night-shift agent (`server/agent/nightshift.ts`) and Bagel on the phone (`server/caller/call.ts`). It uses custom tools built with `createTool`, completion tools (`publish_morning_bark`, `end_call`), and the SDK's event stream, which drives the trail.
- **Qwen 3.8** (`Qwen/Qwen3.8-27B`) on **W&B Inference**, through Cline's `openai-compatible` provider, with reasoning effort set per job.
- **Parallel** Task API (`base` processor, JSON output schema) researches first meetings and returns a one-liner, recent news, key people and talking points, with sources for every field.
- **Composio**: Bagel reaches your accounts through Composio's tool slugs and argument names (`GMAIL_FETCH_EMAILS`, `GOOGLECALENDAR_EVENTS_LIST`, `GOOGLECALENDAR_FIND_FREE_SLOTS`, `GOOGLECALENDAR_PATCH_EVENT`, `GMAIL_SEND_EMAIL`, `GOOGLEDRIVE_FIND_FILE`). The hackathon build answers them from sample data (`server/integrations/`); connecting real accounts is one swap:

  ```ts
  const session = await new Composio().create(userId)   // Gmail, Calendar, Drive
  const result = await session.execute(slug, args)       // same slugs, same args
  ```
- **ElevenLabs** voices Bagel on the phone (`server/caller/voice.ts`), mixed with a ringback tone and a phone-line filter.

## Run it

```bash
npm install
npm run dev            # app on http://localhost:5173
```

It starts in replay mode, which plays back a recorded run and needs no keys. To run the agents live, copy `.env.example` to `.env`, add the keys, and press **Live** in the side panel.

## Project layout

```
server/agent/          the night-shift agent
server/caller/         Bagel on the phone + voices
server/research/       Parallel meeting briefs
server/integrations/   Composio-shaped tools over sample data
server/engine.ts       demo clock, approvals, call queue
web/src/               the phone app: Bagel, the night trail, The Morning Bark, the call screen
```
