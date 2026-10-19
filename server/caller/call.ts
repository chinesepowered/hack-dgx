// Bagel's phone calls. Bagel is a Cline SDK agent with one real job on the
// line: get the outcome Jordan approved, checking Jordan's calendar mid-call
// when times come up. For the hackathon the other end of the line is simulated
// by a second model playing the front desk with the business's real-world
// policies; in production the same agent talks over a phone line.
import { Agent, createTool } from "@cline/sdk"
import { z } from "zod"
import { config } from "../config.js"
import type { Integrations } from "../integrations/composio.js"
import { persona, type Business } from "../integrations/dataset.js"
import { chat, type ChatMessage } from "../lib/llm.js"
import { addDays, localISO, parseTime, prettyDay, prettyTime, weekdayOf, ymdOf } from "../lib/time.js"
import type { CallItem, CallOutcome, Turn } from "../state.js"

const first = persona.firstName

export interface CallResult {
  transcript: Turn[]
  outcome: CallOutcome
  newEventStart?: string
}

function bagelPrompt(call: CallItem, now: number): string {
  const today = ymdOf(now)
  const week = [0, 1, 2, 3, 4].map((n) => `${weekdayOf(addDays(today, n))} = ${addDays(today, n)}`).join(", ")
  return `You are Bagel, ${persona.name}'s AI assistant (a friendly beagle persona), and you are ON A PHONE CALL right now with ${call.business}.
It is ${prettyTime(now)} on ${weekdayOf(today)}, ${today}. Dates this week: ${week}. Timezone ${persona.timezone} (UTC offset ${localISO(today, "12:00").slice(-6)}). ${first} approved this call this morning.

Goal: ${call.goal}
Why: ${call.why}
Facts you may share when asked: ${call.details.join("; ")}.
${first}'s instructions: ${call.constraints.join("; ")}.

How to talk:
- Your FIRST line must say you're Bagel, an AI assistant calling on behalf of ${persona.name}, and state what you need.
- This is a phone call: one or two short, natural sentences per turn (under 30 words). No lists, no emojis, no stage directions.
- Refer to the appointment or account as ${first}'s, never "ours". Don't assume anyone's gender: use ${first}'s name (or "they"), never "he/she/his/her". Call ${first} by name, not "my human".
- Be warm and polite, a little playful, but efficient. Never share anything that isn't in the facts above (no card numbers, no date of birth).
- Before agreeing to any date or time, call GOOGLECALENDAR_FIND_FREE_SLOTS for that window and only accept a time when ${first} is free. If one of several offered times works, pick it.
- When the goal is done (or clearly impossible), thank them and call end_call with your goodbye as final_line. Make sure you heard any confirmation number before ending.

Reply with exactly what you say out loud, nothing else.`
}

function frontDeskPrompt(biz: Business | undefined, call: CallItem): string {
  const name = biz?.staffer.name ?? "Sam"
  return `You are ${name}, answering the phone at ${call.business}. Personality: ${biz?.staffer.style ?? "friendly and helpful"}.

Follow this policy exactly:
${biz?.policy ?? "- Be helpful and make reasonable accommodations."}

This is a live phone call. Speak in one or two short, natural sentences per turn (under 30 words), like a real person at a front desk. No emojis, no stage directions, no lists. Don't repeat yourself. If the caller says goodbye, say a brief goodbye.
Reply with exactly what you say out loud, nothing else.`
}

function greeting(biz: Business | undefined, call: CallItem): string {
  if (biz?.voice === "dentist") return `Bright Smile Dental, this is ${biz.staffer.name}. How can I help you?`
  if (biz?.voice === "gym") return `Thanks for calling FlexFit Mission, this is ${biz.staffer.name}! How can I help?`
  return `${call.business}, how can I help you?`
}

export async function runCall(opts: {
  call: CallItem
  business?: Business
  integrations: Integrations
  now: () => number
  onTurn?: (turn: Turn) => void
  maxTurns?: number
}): Promise<CallResult> {
  const { call, business, integrations, now } = opts
  const transcript: Turn[] = []
  const push = (turn: Turn) => {
    transcript.push(turn)
    opts.onTurn?.(turn)
  }

  let ended: { status: CallOutcome["status"]; summary: string; final_line: string; confirmation?: string; new_time?: string; fee?: string } | null = null

  const checkSlots = createTool({
    name: "GOOGLECALENDAR_FIND_FREE_SLOTS",
    description: `Composio · Google Calendar: check when ${first} is free between time_min and time_max (RFC3339 with offset, e.g. ${localISO(addDays(ymdOf(now()), 1), "16:00")}). Returns busy and free slots.`,
    inputSchema: z.object({
      time_min: z.string(),
      time_max: z.string(),
      timezone: z.string().optional(),
    }),
    async execute(input) {
      const bad = outOfRange(input.time_min, now())
      if (bad) return { output: { error: bad }, isError: true }
      const res = await integrations.execute("GOOGLECALENDAR_FIND_FREE_SLOTS", { ...input, items: ["primary"] })
      const data = res.data as { calendars: { primary: { free: { start: string; end: string }[] } } } | null
      const free = data?.calendars.primary.free ?? []
      const when = `${prettyDay(ymdOf(parseTime(input.time_min)))} ${prettyTime(parseTime(input.time_min))}`
      push({
        speaker: "tool",
        text: free.length
          ? `Checked ${first}'s calendar: free ${free
              .slice(0, 3)
              .map((f) => `${prettyDay(ymdOf(Date.parse(f.start)))} ${prettyTime(f.start)}–${prettyTime(f.end)}`)
              .join(", ")}`
          : `Checked ${first}'s calendar: ${when} is taken`,
      })
      return res
    },
  })

  const endCall = createTool({
    name: "end_call",
    description: "Hang up. Use when the goal is achieved or clearly impossible.",
    inputSchema: z.object({
      final_line: z.string().describe("Your goodbye, said out loud"),
      status: z.enum(["success", "partial", "failed"]),
      summary: z.string().describe(`One sentence for ${first}: what happened`),
      confirmation: z.string().optional().describe("Confirmation number, if given"),
      new_time: z.string().optional().describe("New appointment start as RFC3339 with offset, if rescheduled"),
      fee: z.string().optional().describe("Any fee charged or waived, e.g. 'waived' or '$50'"),
    }),
    lifecycle: { completesRun: true },
    async execute(input) {
      const bad = input.new_time ? outOfRange(input.new_time, now()) : null
      if (bad) return { output: { error: bad }, isError: true }
      ended = input
      return { ok: true }
    },
  })

  const bagel = new Agent({
    providerId: "openai-compatible",
    modelId: config.llm.model,
    apiKey: config.llm.apiKey,
    baseUrl: config.llm.baseUrl,
    systemPrompt: bagelPrompt(call, now()),
    modelOptions: { reasoningEffort: "low" },
    tools: [checkSlots, endCall],
    maxIterations: 6,
  } as ConstructorParameters<typeof Agent>[0])

  const desk: ChatMessage[] = [{ role: "system", content: frontDeskPrompt(business, call) }]
  const hello = greeting(business, call)
  desk.push({ role: "assistant", content: hello })
  push({ speaker: "them", text: hello })

  let theirLine = hello
  const maxTurns = opts.maxTurns ?? 12
  for (let i = 0; i < maxTurns; i++) {
    const res = i === 0 ? await bagel.run(theirLine) : await bagel.continue(theirLine)
    const spoken = cleanLine(ended ? (ended as { final_line: string }).final_line : res.outputText)
    if (spoken) {
      push({ speaker: "bagel", text: spoken })
      desk.push({ role: "user", content: spoken })
    }
    if (ended) {
      const bye = cleanLine(await chat(desk, { temperature: 0.6, maxTokens: 80 }))
      if (bye) push({ speaker: "them", text: bye })
      break
    }
    theirLine = cleanLine(await chat(desk, { temperature: 0.7, maxTokens: 160 }))
    desk.push({ role: "assistant", content: theirLine })
    push({ speaker: "them", text: theirLine })
  }

  const e = ended as null | { status: CallOutcome["status"]; summary: string; confirmation?: string; new_time?: string; fee?: string }
  const outcome: CallOutcome = e
    ? { status: e.status, summary: e.summary, confirmation: e.confirmation, newTime: e.new_time, fee: e.fee }
    : { status: "partial", summary: "The call ran long, so Bagel wrapped up without a final answer." }

  let newEventStart: string | undefined
  if (outcome.status === "success" && call.purpose === "reschedule" && call.relatedEventId && outcome.newTime) {
    const patched = await integrations.execute("GOOGLECALENDAR_PATCH_EVENT", {
      calendar_id: "primary",
      event_id: call.relatedEventId,
      start_time: outcome.newTime,
    })
    if (patched.successful) {
      newEventStart = outcome.newTime
      push({
        speaker: "tool",
        text: `Moved it on ${first}'s calendar to ${prettyDay(ymdOf(Date.parse(outcome.newTime)))}, ${prettyTime(outcome.newTime)}`,
      })
    }
  }
  return { transcript, outcome, newEventStart }
}

/** Catch the model drifting to the wrong year or week before it touches the calendar. */
function outOfRange(value: string, now: number): string | null {
  const t = parseTime(value)
  if (Number.isNaN(t)) return `Could not read "${value}". Use RFC3339 like ${localISO(ymdOf(now), "16:00")}.`
  if (t < now - 86400e3 || t > now + 14 * 86400e3)
    return `${value} is not within the next two weeks. Today is ${ymdOf(now)}; use dates like ${localISO(addDays(ymdOf(now), 1), "16:00")}.`
  return null
}

function cleanLine(text: string): string {
  return text
    .replace(/^\s*(bagel|karen|tyler|front desk|receptionist)\s*:\s*/i, "")
    .replace(/\*[^*]+\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
