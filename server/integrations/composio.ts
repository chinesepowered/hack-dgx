// Bagel's connection to Jordan's accounts.
//
// Every call goes through `execute(slug, args)` using Composio's real tool slugs
// and argument names. Today the mock below answers from sample data; in
// production a Composio session answers instead:
//
//   import { Composio } from "@composio/core"
//   const session = await new Composio().create(userId)  // Gmail, Calendar, Drive
//   const result = await session.execute(slug, args)      // same slugs, same args
//
// That one swap is the only change needed to go from sample data to real accounts.
import { addDays, localISO, parseTime, ymdOf } from "../lib/time.js"
import type { CalendarEvent, Dataset, GmailMessage } from "./dataset.js"
import { persona } from "./dataset.js"

export type ComposioSlug =
  | "GMAIL_FETCH_EMAILS"
  | "GMAIL_SEND_EMAIL"
  | "GMAIL_CREATE_EMAIL_DRAFT"
  | "GOOGLECALENDAR_EVENTS_LIST"
  | "GOOGLECALENDAR_FIND_FREE_SLOTS"
  | "GOOGLECALENDAR_PATCH_EVENT"
  | "GOOGLEDRIVE_FIND_FILE"

export interface ToolResult {
  successful: boolean
  data: unknown
  error?: string
}

export interface Activity {
  id: string
  at: number
  slug: ComposioSlug
  summary: string
  ok: boolean
  write: boolean
}

export interface Integrations {
  readonly mode: "mock" | "composio"
  execute(slug: ComposioSlug, args: Record<string, unknown>): Promise<ToolResult>
}

const WRITE_SLUGS = new Set<ComposioSlug>(["GMAIL_SEND_EMAIL", "GMAIL_CREATE_EMAIL_DRAFT", "GOOGLECALENDAR_PATCH_EVENT"])

export class MockComposio implements Integrations {
  readonly mode = "mock" as const
  private seq = 0

  constructor(
    private ds: Dataset,
    private now: () => number,
    private onActivity: (a: Activity) => void = () => {},
  ) {}

  async execute(slug: ComposioSlug, args: Record<string, unknown>): Promise<ToolResult> {
    let result: ToolResult
    let summary: string = slug
    try {
      switch (slug) {
        case "GMAIL_FETCH_EMAILS": {
          const messages = this.fetchEmails(args)
          summary = `Read ${messages.length} emails`
          result = { successful: true, data: { messages, nextPageToken: null, resultSizeEstimate: messages.length } }
          break
        }
        case "GOOGLECALENDAR_EVENTS_LIST": {
          const items = this.listEvents(String(args.timeMin ?? ""), String(args.timeMax ?? ""))
          summary = `Listed ${items.length} events`
          result = { successful: true, data: { kind: "calendar#events", summary: persona.name, timeZone: persona.timezone, items } }
          break
        }
        case "GOOGLECALENDAR_FIND_FREE_SLOTS": {
          const data = this.freeSlots(String(args.time_min ?? ""), String(args.time_max ?? ""))
          summary = `Checked free time (${data.calendars.primary.free.length} open slots)`
          result = { successful: true, data }
          break
        }
        case "GOOGLECALENDAR_PATCH_EVENT": {
          const ev = this.patchEvent(args)
          summary = `Updated "${ev.summary}"`
          result = { successful: true, data: ev }
          break
        }
        case "GMAIL_SEND_EMAIL": {
          const msg = this.send(args)
          summary = `Sent "${msg.subject}" to ${msg.to}`
          result = { successful: true, data: { id: msg.messageId, threadId: msg.threadId, labelIds: msg.labelIds } }
          break
        }
        case "GMAIL_CREATE_EMAIL_DRAFT": {
          const id = `draft_${++this.seq}`
          summary = `Saved a draft to ${String(args.recipient_email ?? args.to ?? "")}`
          result = { successful: true, data: { id, message: { id: `msg_d${this.seq}`, labelIds: ["DRAFT"] } } }
          break
        }
        case "GOOGLEDRIVE_FIND_FILE": {
          const files = this.findFiles(String(args.q ?? args.query ?? ""))
          summary = `Found ${files.length} Drive file${files.length === 1 ? "" : "s"}`
          result = { successful: true, data: { kind: "drive#fileList", files } }
          break
        }
        default:
          result = { successful: false, data: null, error: `Unknown tool ${slug}` }
      }
    } catch (err) {
      result = { successful: false, data: null, error: (err as Error).message }
    }
    this.onActivity({
      id: `act_${Date.now().toString(36)}_${++this.seq}`,
      at: this.now(),
      slug,
      summary: result.successful ? summary : `${slug} failed: ${result.error}`,
      ok: result.successful,
      write: WRITE_SLUGS.has(slug),
    })
    return result
  }

  // --- Gmail ----------------------------------------------------------------

  private fetchEmails(args: Record<string, unknown>): GmailMessage[] {
    const query = String(args.query ?? "").toLowerCase()
    const labelIds = (Array.isArray(args.label_ids) ? args.label_ids : []).map((l) => String(l).toUpperCase())
    // Composio defaults to 1 result; the sample inbox is small, so be generous.
    const max = Math.max(1, Math.min(500, Number(args.max_results ?? 50)))
    const nowMs = this.now()
    let list = [...this.ds.messages]

    const tokens = query.match(/(\w+):("[^"]+"|\S+)/g) ?? []
    for (const tok of tokens) {
      const [key, raw] = [tok.slice(0, tok.indexOf(":")), tok.slice(tok.indexOf(":") + 1).replace(/"/g, "")]
      if (key === "in" || key === "label") {
        const label = raw.toUpperCase()
        if (label !== "ANYWHERE") list = list.filter((m) => m.labelIds.includes(label))
      } else if (key === "from") {
        list = list.filter((m) => m.sender.toLowerCase().includes(raw))
      } else if (key === "to") {
        list = list.filter((m) => m.to.toLowerCase().includes(raw))
      } else if (key === "subject") {
        list = list.filter((m) => m.subject.toLowerCase().includes(raw))
      } else if (key === "is" && raw === "unread") {
        list = list.filter((m) => m.labelIds.includes("UNREAD"))
      } else if (key === "newer_than" || key === "older_than") {
        const n = parseInt(raw, 10)
        const unit = raw.slice(-1)
        const ms = n * (unit === "h" ? 3600e3 : unit === "m" ? 30 * 86400e3 : unit === "y" ? 365 * 86400e3 : 86400e3)
        list = list.filter((m) => {
          const age = nowMs - Date.parse(m.messageTimestamp)
          return key === "newer_than" ? age <= ms : age > ms
        })
      }
    }
    for (const label of labelIds) list = list.filter((m) => m.labelIds.includes(label))
    list = list.filter((m) => Date.parse(m.messageTimestamp) <= nowMs)
    list.sort((a, b) => Date.parse(b.messageTimestamp) - Date.parse(a.messageTimestamp))
    return list.slice(0, max)
  }

  private send(args: Record<string, unknown>): GmailMessage {
    const to = String(args.recipient_email ?? args.to ?? "")
    if (!to) throw new Error("recipient_email is required")
    const id = `msg_out_${++this.seq}`
    const attachment = args.attachment ? String(args.attachment) : ""
    const msg: GmailMessage = {
      messageId: id,
      threadId: String(args.thread_id ?? `thr_${id}`),
      labelIds: ["SENT"],
      sender: `${persona.name} <${persona.email}>`,
      to,
      cc: Array.isArray(args.cc) ? args.cc.join(", ") : undefined,
      subject: String(args.subject ?? ""),
      messageText: String(args.body ?? ""),
      messageTimestamp: new Date(this.now()).toISOString(),
      preview: { subject: String(args.subject ?? ""), body: String(args.body ?? "").slice(0, 120) },
      attachmentList: attachment ? [{ filename: attachment, mimeType: "application/pdf" }] : [],
    }
    this.ds.messages.push(msg)
    return msg
  }

  // --- Calendar ---------------------------------------------------------------

  private listEvents(timeMin: string, timeMax: string): CalendarEvent[] {
    const lo = timeMin ? parseTime(timeMin) : -Infinity
    const hi = timeMax ? parseTime(timeMax) : Infinity
    return this.ds.events
      .filter((e) => e.status === "confirmed")
      .filter((e) => Date.parse(e.end.dateTime) > lo && Date.parse(e.start.dateTime) < hi)
      .sort((a, b) => Date.parse(a.start.dateTime) - Date.parse(b.start.dateTime))
  }

  private freeSlots(timeMin: string, timeMax: string) {
    const lo = timeMin ? parseTime(timeMin) : this.now()
    const hi = timeMax ? parseTime(timeMax) : lo + 7 * 86400e3
    const busy = this.listEvents(new Date(lo).toISOString(), new Date(hi).toISOString()).map((e) => ({
      start: e.start.dateTime,
      end: e.end.dateTime,
    }))
    // Free time inside working hours (9:00–18:00 local), day by day.
    const free: { start: string; end: string }[] = []
    for (let day = ymdOf(lo); Date.parse(localISO(day, "00:00")) < hi; day = addDays(day, 1)) {
      let cursor = Math.max(Date.parse(localISO(day, "09:00")), lo)
      const dayEnd = Math.min(Date.parse(localISO(day, "18:00")), hi)
      const dayBusy = busy
        .map((b) => [Date.parse(b.start), Date.parse(b.end)] as const)
        .filter(([s, e]) => e > cursor && s < dayEnd)
        .sort((a, b) => a[0] - b[0])
      for (const [s, e] of dayBusy) {
        if (s - cursor >= 30 * 60e3) free.push({ start: iso(cursor), end: iso(s) })
        cursor = Math.max(cursor, e)
      }
      if (dayEnd - cursor >= 30 * 60e3) free.push({ start: iso(cursor), end: iso(dayEnd) })
    }
    return { timeMin: iso(lo), timeMax: iso(hi), calendars: { primary: { busy, free } } }
  }

  private patchEvent(args: Record<string, unknown>): CalendarEvent {
    const ev = this.ds.events.find((e) => e.id === String(args.event_id ?? ""))
    if (!ev) throw new Error(`No event with id ${String(args.event_id)}`)
    const duration = Date.parse(ev.end.dateTime) - Date.parse(ev.start.dateTime)
    if (args.start_time) {
      const start = parseTime(String(args.start_time))
      ev.start.dateTime = iso(start)
      ev.end.dateTime = iso(args.end_time ? parseTime(String(args.end_time)) : start + duration)
    } else if (args.end_time) {
      ev.end.dateTime = iso(parseTime(String(args.end_time)))
    }
    for (const key of ["summary", "description", "location"] as const) {
      if (typeof args[key] === "string") ev[key] = args[key] as string
    }
    if (args.status === "cancelled") ev.status = "cancelled"
    return ev
  }

  // --- Drive --------------------------------------------------------------------

  private findFiles(q: string) {
    const quoted = [...q.matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase())
    const words = (quoted.length ? quoted.join(" ") : q.toLowerCase())
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !["name", "contains", "and", "the", "mimetype", "trashed", "false"].includes(w))
    return this.ds.files.filter((f) => {
      const name = f.name.toLowerCase()
      return words.length === 0 || words.some((w) => name.includes(w))
    })
  }
}

// RFC3339 in Jordan's timezone, e.g. 2026-10-20T16:00:00-07:00
function iso(ms: number): string {
  const day = ymdOf(ms)
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: persona.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms))
  return localISO(day, hhmm)
}
