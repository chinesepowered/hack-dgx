// Bagel's night shift: a Cline SDK agent (Qwen 3.8 on W&B Inference) that reads
// tomorrow's calendar and recent mail through Composio-shaped tools, researches
// first meetings with Parallel, and fills The Morning Bark with drafts, briefs,
// conflict fixes and phone calls, none of which happen without Jordan's tap.
import { Agent, createTool } from "@cline/sdk"
import { z } from "zod"
import { config } from "../config.js"
import type { ComposioSlug, Integrations } from "../integrations/composio.js"
import { persona } from "../integrations/dataset.js"
import { researchMeeting } from "../research/parallel.js"
import { addDays, localISO, prettyDay, prettyTime, weekdayOf } from "../lib/time.js"
import { newId, type CallItem, type PaperItem, type Store } from "../state.js"
import { Trail } from "./trail.js"

interface Ctx {
  store: Store
  integrations: Integrations
  now: () => number
}

const first = persona.firstName

function systemPrompt(today: string, tomorrow: string, now: number): string {
  return `You are Bagel, a cheerful, sharp beagle who works the night shift as ${persona.name}'s personal assistant. ${first} is the ${persona.role}, based in ${persona.city}. ${first}'s email is ${persona.email}.

It is ${prettyTime(now)}, the night between ${weekdayOf(today)} and ${weekdayOf(tomorrow)} (timezone ${persona.timezone}). ${first} is asleep. Your job: prepare ${first}'s ${weekdayOf(tomorrow)} (${prettyDay(tomorrow)}, date ${tomorrow}) so that "The Morning Bark" at 7:00 AM has everything ready to approve with one tap. Nothing is sent, booked or changed without ${first}'s approval, so draft freely.

Work through these steps:
1. Read tomorrow's calendar: GOOGLECALENDAR_EVENTS_LIST with timeMin "${localISO(tomorrow, "00:00")}" and timeMax "${localISO(addDays(tomorrow, 1), "00:00")}".
2. Read recent mail with GMAIL_FETCH_EMAILS: first query "in:sent newer_than:14d", then "in:inbox newer_than:14d", max_results 50 each.
3. Commitments: find concrete promises with a deadline.
   - Promises ${first} made (sent mail) -> record_promise with direction "you_owe".
   - Promises someone made to ${first} (inbox) -> record_promise with direction "owed_to_you". Draft a polite nudge only if it is overdue.
   - status: "overdue" if the deadline is before ${tomorrow}, "due_today" if it is ${tomorrow}, otherwise "upcoming".
   - Drafts are in ${first}'s voice: short, warm, specific, no filler, signed "${first}". Replies keep "Re: <original subject>" and the thread_id.
   - If a promise involves a file (deck, doc), find it with GOOGLEDRIVE_FIND_FILE and attach it.
   - Ignore newsletters, notifications and mail without a commitment.
4. Meetings: for each FIRST-TIME meeting tomorrow with an outside company, call research_meeting once for that company. Skip internal meetings and people ${first} already works with.
5. Conflicts: if two events overlap tomorrow, call record_conflict. Keep the event with outside people or higher stakes; move the personal errand.
6. Phone calls: some things can only be done by phone (the email says to call). Use propose_call to (a) reschedule an appointment that conflicts, and (b) cancel something ${first} clearly isn't using before it renews. Use the phone number and opening time from the email. Put facts Bagel may share on the call in "details" (full name, phone on file ${persona.phoneOnFile}, ZIP ${persona.zip}, member IDs from the email) and ${first}'s wishes in "constraints" (for example: politely ask to waive fees; decline retention offers; only accept times when ${first}'s calendar is free).
7. Finish by calling publish_morning_bark with a playful headline (max 8 words) and one short summary sentence (max 20 words).

Rules: use only facts from the tools; never invent people, numbers, dates or times. Don't assume anyone's gender: use names or "they". One research_meeting per company. Be efficient.`
}

export async function runNightShift(ctx: Ctx): Promise<void> {
  const { store, integrations, now } = ctx
  const { today, tomorrow } = store.state.dataset
  const startedReal = Date.now()

  store.update((s) => {
    s.nightShift = { status: "running", startedAt: now() }
    s.trail = []
    s.paper = { date: tomorrow, headline: "", summary: "", items: [] }
  })
  const trail = new Trail(store, now)
  trail.add("start", "Clocked in for the night shift", `Prepping ${prettyDay(tomorrow)}`)

  const addItem = (item: PaperItem) => store.update((s) => s.paper!.items.push(item))

  // --- Composio-shaped tools (same slugs and argument names as Composio) -----
  const composioTool = <S extends z.ZodRawShape>(
    slug: ComposioSlug,
    description: string,
    shape: S,
    describe: (args: z.infer<z.ZodObject<S>>, data: any) => string,
  ) =>
    createTool({
      name: slug,
      description,
      inputSchema: z.object(shape),
      async execute(input, toolCtx) {
        const res = await integrations.execute(slug, input as Record<string, unknown>)
        if (res.successful) trail.result(toolCtx.toolCallId, describe(input as any, res.data))
        return res
      },
    })

  const tools = [
    composioTool(
      "GOOGLECALENDAR_EVENTS_LIST",
      "Composio · Google Calendar: list the user's events overlapping a time window. Returns items with id, summary, description, location, start, end and attendees.",
      {
        timeMin: z.string().describe("RFC3339 lower bound, e.g. 2026-10-20T00:00:00-07:00"),
        timeMax: z.string().describe("RFC3339 upper bound"),
        timeZone: z.string().optional(),
        orderBy: z.enum(["startTime", "updated"]).optional(),
        singleEvents: z.boolean().optional(),
      },
      (args, data) => {
        const n = data.items.length
        const isTomorrow = args.timeMin.startsWith(tomorrow)
        return isTomorrow ? `Checked ${weekdayOf(tomorrow)}: ${n} event${n === 1 ? "" : "s"}` : `Checked the calendar: ${n} events`
      },
    ),
    composioTool(
      "GMAIL_FETCH_EMAILS",
      "Composio · Gmail: fetch messages. Supports Gmail search operators in `query` (in:sent, in:inbox, from:, newer_than:14d, is:unread). Always set max_results.",
      {
        query: z.string().optional().describe("Gmail search query, e.g. 'in:sent newer_than:14d'"),
        max_results: z.number().int().optional().describe("Max messages to return, e.g. 50"),
        include_payload: z.boolean().optional(),
      },
      (args, data) => {
        const n = data.messages.length
        const where = (args.query ?? "").includes("in:sent") ? "sent emails" : "emails in your inbox"
        return `Sniffed ${n} ${where}`
      },
    ),
    composioTool(
      "GOOGLEDRIVE_FIND_FILE",
      "Composio · Google Drive: find files. `q` accepts plain words or Drive query syntax like name contains 'Q3'.",
      { q: z.string().describe("Search query") },
      (_args, data) =>
        data.files.length ? `Dug up “${data.files[0].name}” in Drive` : "Dug around Drive, found nothing",
    ),

    createTool({
      name: "research_meeting",
      description:
        "Research an outside company before a first meeting, using Parallel's web research (takes about a minute). Returns a one-liner, recent news, key people, talking points and sources, and adds a brief to the morning paper.",
      inputSchema: z.object({
        company: z.string().describe("Company name"),
        website: z.string().optional().describe("Company website if known"),
        event_id: z.string().describe("Calendar event id of the meeting"),
        context: z.string().describe("What the meeting is about and why it matters to Jordan"),
      }),
      timeoutMs: 420_000,
      retryable: false,
      async execute(input, toolCtx) {
        const ev = store.state.dataset.events.find((e) => e.id === input.event_id)
        const brief = await researchMeeting({ company: input.company, website: input.website, context: input.context }, { signal: toolCtx.signal })
        addItem({
          id: newId("brief"),
          kind: "brief",
          eventId: input.event_id,
          eventTitle: ev?.summary ?? input.company,
          start: ev?.start.dateTime ?? "",
          company: input.company,
          oneLiner: brief.oneLiner,
          recentNews: brief.recentNews,
          keyPeople: brief.keyPeople,
          talkingPoints: brief.talkingPoints,
          sources: brief.sources,
          processor: brief.processor,
          runId: brief.runId,
          state: "pending",
        })
        const facts = brief.recentNews.length + brief.talkingPoints.length
        trail.result(toolCtx.toolCallId, `Found ${facts} things to know about ${input.company}`, `${brief.sources.length} sources via Parallel`)
        return { ...brief, sources: brief.sources.slice(0, 5) }
      },
    }),

    createTool({
      name: "record_promise",
      description:
        "Add a commitment to the morning paper, with a ready-to-send draft when an email is needed. Use once per promise.",
      inputSchema: z.object({
        direction: z.enum(["you_owe", "owed_to_you"]),
        person: z.string().describe("The other person's name"),
        email: z.string().describe("The other person's email"),
        what: z.string().describe("Short description, e.g. 'Send the Q3 pilot metrics deck'"),
        due: z.string().describe("Deadline as YYYY-MM-DD"),
        status: z.enum(["overdue", "due_today", "upcoming"]),
        why: z.string().describe("One sentence of evidence quoting the email"),
        source_message_id: z.string().optional(),
        draft_subject: z.string().optional(),
        draft_body: z.string().optional().describe("Ready-to-send email body in Jordan's voice"),
        thread_id: z.string().optional(),
        attachment_file_id: z.string().optional(),
        attachment_name: z.string().optional(),
      }),
      async execute(input, toolCtx) {
        const draft = input.draft_body
          ? {
              to: input.email,
              subject: input.draft_subject ?? input.what,
              body: input.draft_body,
              threadId: input.thread_id,
              attachment:
                input.attachment_file_id && input.attachment_name
                  ? { fileId: input.attachment_file_id, name: input.attachment_name }
                  : undefined,
            }
          : null
        addItem({
          id: newId("promise"),
          kind: "promise",
          direction: input.direction,
          person: input.person,
          email: input.email,
          what: input.what,
          due: input.due,
          status: input.status,
          why: input.why,
          sourceMessageId: input.source_message_id,
          draft,
          state: "pending",
        })
        const firstName = input.person.split(" ")[0]
        trail.result(
          toolCtx.toolCallId,
          input.direction === "you_owe" ? `Found a promise to ${firstName}` : `${firstName} owes you something`,
          input.what,
        )
        return { ok: true }
      },
    }),

    createTool({
      name: "record_conflict",
      description: "Add a double-booking to the morning paper with the proposed fix.",
      inputSchema: z.object({
        keep_event_id: z.string(),
        move_event_id: z.string(),
        summary: z.string().describe("e.g. '2:00 PM: investor update overlaps your dentist cleaning'"),
        proposal: z.string().describe("The fix, in one or two sentences"),
      }),
      async execute(input, toolCtx) {
        addItem({
          id: newId("conflict"),
          kind: "conflict",
          eventIds: [input.keep_event_id, input.move_event_id],
          keepEventId: input.keep_event_id,
          moveEventId: input.move_event_id,
          summary: input.summary,
          proposal: input.proposal,
          state: "pending",
        })
        trail.result(toolCtx.toolCallId, "Uh-oh: a double-booking", input.summary)
        return { ok: true }
      },
    }),

    createTool({
      name: "propose_call",
      description:
        "Line up a phone call Bagel can make for Jordan once the business opens (only after Jordan approves in the morning).",
      inputSchema: z.object({
        business: z.string(),
        phone: z.string(),
        purpose: z.enum(["reschedule", "cancel", "book", "other"]),
        goal: z.string().describe("What the call should achieve, one sentence"),
        why: z.string().describe("Why Bagel suggests it, one sentence"),
        opens_at: z.string().describe("Opening time HH:MM (24h) from the email"),
        details: z.array(z.string()).describe("Facts Bagel may share on the call"),
        constraints: z.array(z.string()).describe("Jordan's wishes and limits for the call"),
        related_event_id: z.string().optional(),
      }),
      async execute(input, toolCtx) {
        const biz = store.state.dataset.businesses.find((b) => b.phone === input.phone)
        const call: CallItem = {
          id: newId("call"),
          kind: "call",
          businessId: biz?.id,
          business: input.business,
          phone: input.phone,
          purpose: input.purpose,
          goal: input.goal,
          why: input.why,
          details: input.details,
          constraints: input.constraints,
          relatedEventId: input.related_event_id,
          opensAt: /^\d{1,2}:\d{2}$/.test(input.opens_at) ? input.opens_at.padStart(5, "0") : biz?.opens ?? "09:00",
          state: "proposed",
        }
        addItem(call)
        store.update((s) => {
          const conflict = s.paper!.items.find((i) => i.kind === "conflict" && i.moveEventId === input.related_event_id)
          if (conflict && conflict.kind === "conflict") conflict.callId = call.id
        })
        trail.result(toolCtx.toolCallId, `Lined up a call to ${input.business}`, `for ${prettyTime(localISO(tomorrow, call.opensAt))} when they open`)
        return { ok: true, call_id: call.id }
      },
    }),

    createTool({
      name: "publish_morning_bark",
      description: "Finish the night shift and publish The Morning Bark.",
      inputSchema: z.object({
        headline: z.string().describe("Playful headline, max 8 words"),
        summary: z.string().describe("One short sentence (max 20 words) on what is ready"),
      }),
      lifecycle: { completesRun: true },
      async execute(input, toolCtx) {
        store.update((s) => {
          s.paper!.headline = input.headline
          s.paper!.summary = input.summary
        })
        trail.result(toolCtx.toolCallId, "Rolled up The Morning Bark", input.headline)
        return { ok: true }
      },
    }),
  ]

  const agent = new Agent({
    providerId: "openai-compatible",
    modelId: config.llm.model,
    apiKey: config.llm.apiKey,
    baseUrl: config.llm.baseUrl,
    systemPrompt: systemPrompt(today, tomorrow, now()),
    modelOptions: { reasoningEffort: "low" },
    tools,
    maxIterations: 40,
  } as ConstructorParameters<typeof Agent>[0])

  agent.subscribe((event) => {
    if (event.type === "tool-started") {
      const { toolCallId, toolName, input } = event.toolCall
      trail.start(toolCallId, kindFor(toolName), startText(toolName, input as Record<string, unknown>), {
        name: toolName,
        args: compactArgs(input as Record<string, unknown>),
      })
    } else if (event.type === "tool-finished") {
      const parts = Array.isArray(event.message?.content) ? event.message.content : []
      const failed = parts.some((p: any) => p?.type === "tool-result" && p.isError)
      trail.finish(event.toolCall.toolCallId, doneFallback(event.toolCall.toolName), failed)
    }
  })

  try {
    const result = await agent.run(
      `Night shift starts now. Prepare ${first}'s ${weekdayOf(tomorrow)}, then publish The Morning Bark.`,
    )
    store.update((s) => {
      if (!s.paper!.headline) {
        s.paper!.headline = "Your day, sniffed out"
        s.paper!.summary = "Drafts, briefs and fixes are ready for your tap."
      }
      s.nightShift = {
        status: result.status === "completed" ? "done" : "failed",
        startedAt: s.nightShift.startedAt,
        finishedAt: now(),
        error: result.error?.message,
        stats: {
          iterations: result.iterations,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          seconds: Math.round((Date.now() - startedReal) / 1000),
        },
      }
    })
  } catch (err) {
    trail.add("error", "Lost the scent", (err as Error).message, "error")
    store.update((s) => {
      s.nightShift = { status: "failed", startedAt: s.nightShift.startedAt, finishedAt: now(), error: (err as Error).message }
    })
    throw err
  }
}

function kindFor(tool: string) {
  if (tool.startsWith("GMAIL")) return "sniff" as const
  if (tool.startsWith("GOOGLECALENDAR")) return "calendar" as const
  if (tool.startsWith("GOOGLEDRIVE")) return "drive" as const
  if (tool === "research_meeting") return "research" as const
  if (tool === "record_promise") return "promise" as const
  if (tool === "record_conflict") return "conflict" as const
  if (tool === "propose_call") return "call" as const
  return "paper" as const
}

function startText(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case "GMAIL_FETCH_EMAILS":
      return String(input.query ?? "").includes("in:sent") ? "Sniffing through your sent mail…" : "Sniffing through your inbox…"
    case "GOOGLECALENDAR_EVENTS_LIST":
      return "Checking tomorrow's calendar…"
    case "GOOGLEDRIVE_FIND_FILE":
      return "Digging through Drive…"
    case "research_meeting":
      return `On the scent: researching ${String(input.company ?? "a company")}…`
    case "record_promise":
      return "Writing down a promise…"
    case "record_conflict":
      return "Untangling a double-booking…"
    case "propose_call":
      return `Planning a call to ${String(input.business ?? "a business")}…`
    default:
      return "Rolling up the paper…"
  }
}

/** Short, readable tool arguments for the "under the hood" log. */
function compactArgs(input: Record<string, unknown>): string {
  const keep = ["query", "max_results", "timeMin", "timeMax", "q", "company", "direction", "person", "what", "status", "business", "purpose", "opens_at", "headline", "keep_event_id", "move_event_id"]
  const out: Record<string, unknown> = {}
  for (const k of keep) if (input[k] !== undefined) out[k] = input[k]
  const json = JSON.stringify(out)
  return json.length > 140 ? `${json.slice(0, 137)}…}` : json
}

function doneFallback(tool: string): string {
  return tool === "publish_morning_bark" ? "Rolled up The Morning Bark" : "Done"
}
