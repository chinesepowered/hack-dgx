# Bagel works the night shift: the pitch

> **A beagle who preps tomorrow while you sleep, and makes the calls you dread.**

Slides: [`slides.html`](slides.html) (arrow keys, F for full screen) · [`slides.pdf`](slides.pdf) · Demo video: [`demo/bagel-demo.mp4`](demo/bagel-demo.mp4)

---

## The 30-second version

Bagel is a personal agent you'll use every day, because you never have to ask. He's a beagle who works the night shift. At 2 AM he reads tomorrow's calendar and your inbox, catches every promise and double-booking, and researches your first meetings with Parallel. At 7, *The Morning Bark* is at your door, with everything ready to approve in one tap. At 9, he makes the awkward calls: he reschedules, cancels, gets fees waived, and always says he's an AI.

## The 2-minute version (with the slides)

About 270 words, so it runs just under two minutes at a relaxed pace.

**Slide 1: Bagel works the night shift.**
Hi, we're [team]. Who here has a phone call they've been putting off? Meet Bagel. He's a beagle who works the night shift: he preps tomorrow while you sleep, and he makes the calls you dread.

**Slide 2: The gap.**
Personal agents like Muse and Instinct are great, when you remember to ask. But what drains a day is the stuff nobody thinks to ask for: the deck you promised, the redlines you're owed, a coffee you haven't prepped for, a double-booking, and a gym that only cancels by phone.

**Slide 3: One day with Bagel.**
So Bagel runs on a ritual. At 2 AM he reads tomorrow's calendar and your inbox, tracks every promise in both directions, and researches first meetings. At 7, *The Morning Bark* is at your door: drafts with the right file attached, a cited brief, and a fix for the clash. One tap each. At 9, when businesses open, he calls. He says he's an AI, checks your calendar mid-call, moves the dentist to Thursday, gets the $50 late fee waived, and cancels the gym.

**Slide 4: Under the hood.**
Bagel is a Cline SDK agent running Qwen 3.8 on W&B Inference. At night he reads through Composio's Gmail, Calendar and Drive tools, and researches with Parallel, with a source for every fact. On the phone he's a second Cline agent with calendar tools and an ElevenLabs voice. The night shift you'll see took 76 seconds. The demo runs on a sample inbox with a simulated front desk; connecting real accounts is one Composio swap.

**Slide 5: Why every day.**
He shows up on his own, he does the work instead of summarizing it, and he always asks first. That's an agent you'd use every day. Every night, Bagel's on duty. Thank you!

## If you demo live

The app starts in replay mode, which plays back the recorded run and needs no keys or network.

1. Tap **Tuck in 🌙**. The night shift runs as a trail of paw prints, with emails, calendar, Drive, Parallel research and the double-booking.
2. Tap **Wake up ☀️**. *The Morning Bark* arrives. Point out the deck draft with the file attached, the overdue redlines nudge, and the Parallel brief and its sources.
3. Tap **Approve call at 9:00** on the dentist fix and on the gym. Use the side panel to jump to **9:00 AM**.
4. Let the dentist call play. Bagel checks the calendar mid-call and gets the fee waived. Then the gym call: the retention offers are declined and the confirmation number comes back. The paper stamps both calls as done.

## Numbers you can quote

All from the recorded run that the demo replays.

| What | Number |
| --- | --- |
| Night shift | 76 s, 4 agent turns, 31.7k input / 2.3k output tokens |
| Found overnight | 4 promises (2 you owe, 2 owed to you), 1 double-booking, 2 calls to make, 1 first meeting |
| Meeting brief | 1 Parallel Task run (`base` processor): 6 facts (3 news items, 3 talking points), 2 key people, 5 sources |
| Dentist call | 76 s. Moved Tue 2 PM → Thu Oct 22, 4 PM with Dr. Patel; the $50 late-change fee was waived |
| Gym call | 74 s. Cancelled before the Oct 23 renewal, no fees, confirmation CX-4471 |
| Speech per call | ~1,000–1,100 characters across both sides; Bagel's own lines are ~500 |

## Judge Q&A

**How is this different from Muse or Instinct?**
They're on-demand: you ask and they act. Bagel is scheduled and proactive. He runs on a daily ritual (2 AM, 7 AM, 9 AM) and finds work you didn't know to ask for: promises buried in threads, replies you're owed, a meeting you haven't prepped for, a double-booking. And he hands you finished work, like a draft with the file attached or an appointment already moved, rather than a reminder.

**Are the phone calls real?**
Bagel's side is real: a Cline SDK agent on Qwen 3.8 decides every line and checks your calendar with tools mid-call. In the demo, the business's front desk is a second model role-playing the business with its real-world policies (the 24-hour late-change fee, the gym's retention offers), voiced by ElevenLabs, because we can't call a real dentist on stage. In production the same agent talks over a phone line (Twilio plus ElevenLabs streaming voice). His first line always says he's an AI assistant calling on your behalf.

**What's real and what's sample data?**
Real: both agents, the Qwen 3.8 calls on W&B Inference, the Parallel research (live web, real sources), and the ElevenLabs voices. The demo replays an actual recorded run. Sample: Jordan's inbox, calendar and Drive, and the two businesses. Bagel reaches them through Composio's tool slugs and arguments (`GMAIL_FETCH_EMAILS`, `GOOGLECALENDAR_PATCH_EVENT`, …), answered from sample data for the hackathon.

**Why not connect a real Gmail account today?**
We didn't want a hackathon build holding the keys to a real inbox. Composio is the production path: it handles OAuth and per-toolkit scopes, and Bagel's calls already use Composio's slugs and argument names, so switching is `session.execute(slug, args)` in place of the sample data.

**What stops Bagel from doing something dumb?**
It's draft-first: nothing is sent and no call is placed without your tap. The night shift only reads. Writes (sending an email, moving an event) happen only after you approve. On a call he discloses he's an AI, sticks to the outcome you approved, and moves your calendar only after the business confirms. If a call doesn't go to plan, he ends it as "partial" or "failed" and tells you instead of improvising.

**What does it cost to run?**
One night shift is about 34k tokens on an open 27B model. Add one Parallel `base` task per first-time meeting ($0.01) and roughly 500 characters of Bagel's speech per call, since in production the other side of the line is a person. It's cheap enough to run every night for everyone.

**Why Qwen 3.8 and the Cline SDK?**
The Cline SDK gives us the agent loop, typed tools (`createTool` with zod), completion tools (`publish_morning_bark`, `end_call`) and an event stream. That stream draws the paw-print trail live. Qwen 3.8 (27B) on W&B Inference is fast and cheap enough for a nightly job and for snappy phone turns, with reasoning effort set to low for both.

**What's next?**
Real phone lines, real Gmail and Calendar through Composio, *The Morning Bark* delivered to Telegram, and drafts that learn your voice from your edits.

**Why a beagle?**
Beagles are scent hounds. Sniffing out what's buried in your inbox is literally the job description. And they're very good boys.
