import { useEffect, useRef, useState } from "react"

// Mirrors the server's publicState() and paper item types.
export interface TrailStep {
  id: string
  at: number
  kind: "start" | "sniff" | "calendar" | "drive" | "research" | "promise" | "conflict" | "call" | "paper" | "think" | "error"
  text: string
  detail?: string
  status: "active" | "done" | "error"
  tool?: string
  args?: string
}

export interface Draft {
  to: string
  subject: string
  body: string
  attachment?: { fileId: string; name: string }
}

type ItemState = "pending" | "approved" | "skipped" | "done"

export interface PromiseItem {
  id: string
  kind: "promise"
  direction: "you_owe" | "owed_to_you"
  person: string
  email: string
  what: string
  due: string
  status: "overdue" | "due_today" | "upcoming"
  why: string
  draft: Draft | null
  state: ItemState
}
export interface BriefItem {
  id: string
  kind: "brief"
  eventId: string
  eventTitle: string
  start: string
  company: string
  oneLiner: string
  recentNews: string[]
  keyPeople: string[]
  talkingPoints: string[]
  sources: { url: string; title?: string }[]
  processor: string
  state: ItemState
}
export interface ConflictItem {
  id: string
  kind: "conflict"
  eventIds: string[]
  keepEventId: string
  moveEventId: string
  summary: string
  proposal: string
  callId?: string
  state: ItemState
}
export interface Turn {
  speaker: "bagel" | "them" | "tool"
  text: string
  start?: number
  end?: number
}
export interface CallItem {
  id: string
  kind: "call"
  businessId?: string
  business: string
  phone: string
  purpose: "reschedule" | "cancel" | "book" | "other"
  goal: string
  why: string
  details: string[]
  constraints: string[]
  relatedEventId?: string
  opensAt: string
  scheduledFor?: number
  callStartedAt?: number
  state: "proposed" | "scheduled" | "dialing" | "in_call" | "done" | "failed" | "skipped"
  transcript?: Turn[]
  audioUrl?: string
  durationSec?: number
  outcome?: { status: "success" | "partial" | "failed"; summary: string; confirmation?: string; newTime?: string; fee?: string }
  error?: string
}
export type PaperItem = PromiseItem | BriefItem | ConflictItem | CallItem

export interface AppState {
  mode: "live" | "replay"
  clock: { now: number; real: number }
  persona: { name: string; firstName: string; company: string }
  today: string
  tomorrow: string
  nightShift: {
    status: "idle" | "running" | "done" | "failed"
    startedAt?: number
    finishedAt?: number
    error?: string
    stats?: { iterations: number; inputTokens: number; outputTokens: number; seconds: number }
  }
  trail: TrailStep[]
  paper: { date: string; headline: string; summary: string; items: PaperItem[] } | null
  activity: { id: string; at: number; slug: string; summary: string; ok: boolean; write: boolean }[]
  streak: number
  calendar: { id: string; summary: string; start: string; end: string; location?: string }[]
  sent: { id: string; to: string; subject: string; at: string }[]
  nextJob: { label: string; dueAt: number } | null
  milestones: { evening: number; nightShift: number; paper: number; calls: number }
  missingKeys: string[]
  canReplay: boolean
}

/** Live app state over server-sent events, plus the demo clock offset. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null)
  const offset = useRef(0)
  useEffect(() => {
    let es: EventSource | null = null
    let retry: number | undefined
    const connect = () => {
      es = new EventSource("/api/events")
      es.onmessage = (e) => {
        const next = JSON.parse(e.data) as AppState
        offset.current = next.clock.now - Date.now()
        setState(next)
      }
      es.onerror = () => {
        es?.close()
        retry = window.setTimeout(connect, 1500)
      }
    }
    connect()
    return () => {
      es?.close()
      window.clearTimeout(retry)
    }
  }, [])
  return { state, offset }
}

/** Re-render on an interval and return the current demo-clock time. */
export function useDemoNow(offset: React.RefObject<number>, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now() + (offset.current ?? 0))
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + (offset.current ?? 0)), everyMs)
    return () => window.clearInterval(id)
  }, [offset, everyMs])
  return now
}

export async function post(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

export const actions = {
  reset: (mode?: "live" | "replay") => post("/api/reset", mode ? { mode } : {}),
  jump: (to: string, lead = 2) => post("/api/jump", { to, lead }),
  approve: (id: string, edits?: { subject?: string; body?: string }) => post(`/api/items/${id}/approve`, edits ?? {}),
  skip: (id: string) => post(`/api/items/${id}/skip`),
}

// --- Time formatting in Jordan's timezone -----------------------------------------
const TZ = "America/Los_Angeles"
export const fmtTime = (ms: number | string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms))
export const fmtClock = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(ms))
    .replace(/\s?[AP]M$/, "")
export const fmtDay = (ms: number | string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(ms))
export const fmtLongDate = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${ymd}T12:00:00Z`),
  )
export const fmtDue = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${ymd}T12:00:00Z`))
export const ampm = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: true }).format(new Date(ms)).slice(-2)
