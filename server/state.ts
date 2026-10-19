import { EventEmitter } from "node:events"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname } from "node:path"
import type { Activity } from "./integrations/composio.js"
import type { Dataset } from "./integrations/dataset.js"

export type TrailKind =
  | "start"
  | "sniff"
  | "calendar"
  | "drive"
  | "research"
  | "promise"
  | "conflict"
  | "call"
  | "paper"
  | "think"
  | "error"

export interface TrailStep {
  id: string
  at: number // demo-clock ms
  kind: TrailKind
  text: string
  detail?: string
  status: "active" | "done" | "error"
  tool?: string // the agent's tool call behind this step, e.g. GMAIL_FETCH_EMAILS
  args?: string // compact JSON of the tool arguments
}

type ItemState = "pending" | "approved" | "skipped" | "done"

export interface Draft {
  to: string
  subject: string
  body: string
  attachment?: { fileId: string; name: string }
  threadId?: string
}

export interface PromiseItem {
  id: string
  kind: "promise"
  direction: "you_owe" | "owed_to_you"
  person: string
  email: string
  what: string
  due: string // YYYY-MM-DD
  status: "overdue" | "due_today" | "upcoming"
  why: string
  sourceMessageId?: string
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
  runId?: string
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
  start?: number // seconds into the call recording
  end?: number
}

export interface CallOutcome {
  status: "success" | "partial" | "failed"
  summary: string
  confirmation?: string
  newTime?: string
  fee?: string
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
  opensAt: string // HH:MM local
  scheduledFor?: number // demo-clock ms
  callStartedAt?: number // demo-clock ms when the recording starts playing
  state: "proposed" | "scheduled" | "dialing" | "in_call" | "done" | "failed" | "skipped"
  transcript?: Turn[]
  audioUrl?: string
  durationSec?: number
  outcome?: CallOutcome
  error?: string
}

export type PaperItem = PromiseItem | BriefItem | ConflictItem | CallItem

export interface Paper {
  date: string // the day this paper is for
  headline: string
  summary: string
  items: PaperItem[]
}

export interface AppState {
  mode: "live" | "replay"
  dataset: Dataset
  nightShift: {
    status: "idle" | "running" | "done" | "failed"
    startedAt?: number
    finishedAt?: number
    error?: string
    stats?: { iterations: number; inputTokens: number; outputTokens: number; seconds: number }
  }
  trail: TrailStep[]
  paper: Paper | null
  activity: Activity[]
  streak: number
}

export class Store extends EventEmitter {
  state: AppState
  private saveTimer: NodeJS.Timeout | null = null

  constructor(
    initial: AppState,
    private file?: string,
  ) {
    super()
    this.state = initial
  }

  update(fn: (s: AppState) => void) {
    fn(this.state)
    this.emit("change", this.state)
    this.scheduleSave()
  }

  replace(next: AppState) {
    this.state = next
    this.emit("change", this.state)
    this.scheduleSave()
  }

  private scheduleSave() {
    if (!this.file || this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      mkdirSync(dirname(this.file!), { recursive: true })
      writeFileSync(this.file!, JSON.stringify(this.state, null, 2))
    }, 200)
  }

  static load(file: string): AppState | null {
    if (!existsSync(file)) return null
    try {
      return JSON.parse(readFileSync(file, "utf8")) as AppState
    } catch {
      return null
    }
  }
}

let idSeq = 0
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${(++idSeq).toString(36)}`
}
