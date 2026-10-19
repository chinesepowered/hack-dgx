// Wires Bagel together: demo clock, sample data behind Composio-shaped tools,
// the night shift, approvals, and the 9:00 AM calls.
//
// Two modes:
//   live   - runs the Cline SDK agent, Parallel research and ElevenLabs voices for real.
//   replay - plays back a recorded live run (data/demo/snapshot.json), so a demo
//            works offline and costs nothing. Approvals and calendar changes
//            still execute against the sample data.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { runNightShift } from "./agent/nightshift.js"
import { runCall } from "./caller/call.js"
import { renderCall } from "./caller/voice.js"
import { DemoClock } from "./clock.js"
import { config } from "./config.js"
import { MockComposio } from "./integrations/composio.js"
import { buildDataset } from "./integrations/dataset.js"
import { localISO, prettyTime, todayYMD } from "./lib/time.js"
import { Store, type AppState, type CallItem, type CallOutcome, type Paper, type TrailStep, type Turn } from "./state.js"

export interface Snapshot {
  version: 1
  recordedAt: string
  today: string
  nightShift: { trail: TrailStep[]; paper: Paper; stats?: AppState["nightShift"]["stats"] }
  calls: Record<string, { transcript: Turn[]; outcome: CallOutcome; audio: string; durationSec: number }>
}

const snapshotFile = resolve(config.dirs.demo, "snapshot.json")
const stateFile = resolve(config.dirs.runtime, "state.json")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Engine {
  readonly clock: DemoClock
  readonly store: Store
  integrations!: MockComposio
  snapshot: Snapshot | null
  private callQueue: Promise<void> = Promise.resolve()

  constructor(opts: { mode?: "live" | "replay"; persist?: boolean } = {}) {
    this.snapshot = existsSync(snapshotFile) ? (JSON.parse(readFileSync(snapshotFile, "utf8")) as Snapshot) : null
    this.clock = new DemoClock()
    const mode = opts.mode ?? (process.env.BAGEL_MODE === "live" || !this.snapshot ? "live" : "replay")
    this.store = new Store(this.freshState(mode), opts.persist === false ? undefined : stateFile)
    this.reset(mode)
  }

  get state() {
    return this.store.state
  }

  private freshState(mode: "live" | "replay"): AppState {
    const today = mode === "replay" && this.snapshot ? this.snapshot.today : process.env.DEMO_DATE ?? todayYMD()
    return {
      mode,
      dataset: buildDataset(today),
      nightShift: { status: "idle" },
      trail: [],
      paper: null,
      activity: [],
      streak: 11,
    }
  }

  /** Back to 11:58 PM the night before, with the night shift booked for 2:00 AM. */
  reset(mode: "live" | "replay" = this.state.mode) {
    if (mode === "replay" && !this.snapshot) mode = "live"
    this.clock.clear()
    this.store.replace(this.freshState(mode))
    this.integrations = new MockComposio(this.state.dataset, () => this.clock.now(), (a) =>
      this.store.update((s) => s.activity.push(a)),
    )
    this.callQueue = Promise.resolve()
    this.clock.set(Date.parse(localISO(this.state.dataset.today, "23:58")))
    this.clock.schedule({
      id: "nightshift",
      label: "night shift",
      dueAt: Date.parse(localISO(this.state.dataset.tomorrow, "02:00")),
      run: () => this.startNightShift(),
    })
  }

  /** Move the demo clock forward, e.g. to skip ahead inside a call. */
  advance(seconds: number) {
    this.clock.set(this.clock.now() + seconds * 1000)
    this.clockChanged()
  }

  /** Let the app re-sync its clock right away instead of on the next heartbeat. */
  private clockChanged() {
    this.store.emit("change", this.store.state)
  }

  /** Jump the demo clock to a time on the day being prepped (or the evening before). */
  jump(hhmm: string, leadSeconds = 2) {
    const day = hhmm >= "12:00" ? this.state.dataset.today : this.state.dataset.tomorrow
    this.clock.set(Date.parse(localISO(day, hhmm)) - leadSeconds * 1000)
    this.clockChanged()
  }

  async startNightShift() {
    if (this.state.nightShift.status === "running") return
    if (this.state.mode === "replay" && this.snapshot) return this.replayNightShift(this.snapshot)
    return runNightShift({ store: this.store, integrations: this.integrations, now: () => this.clock.now() })
  }

  private async replayNightShift(snap: Snapshot) {
    const { tomorrow } = this.state.dataset
    this.store.update((s) => {
      s.nightShift = { status: "running", startedAt: this.clock.now() }
      s.trail = []
      s.paper = { date: tomorrow, headline: "", summary: "", items: [] }
    })
    // Replay the steps in order, compressing the long waits, while the demo clock
    // follows the recorded run's own timing.
    const startDemo = this.clock.now()
    const startRec = snap.nightShift.trail[0]?.at ?? 0
    for (const step of snap.nightShift.trail) {
      const id = step.id
      const target = startDemo + (step.at - startRec)
      if (target > this.clock.now()) this.clock.set(target)
      const active = { ...step, status: "active" as const, at: this.clock.now() }
      this.store.update((s) => s.trail.push(active))
      await sleep(step.kind === "research" ? 3000 : step.kind === "start" ? 800 : 560)
      this.store.update((s) => {
        const t = s.trail.find((x) => x.id === id)!
        t.status = "done"
        t.at = this.clock.now()
      })
      await sleep(220)
    }
    const paper = structuredClone(snap.nightShift.paper)
    this.store.update((s) => {
      s.paper = paper
      s.nightShift = { status: "done", startedAt: s.nightShift.startedAt, finishedAt: this.clock.now(), stats: snap.nightShift.stats }
    })
  }

  // --- Morning approvals ------------------------------------------------------

  async approve(itemId: string, edits?: { subject?: string; body?: string; constraints?: string[] }) {
    const item = this.state.paper?.items.find((i) => i.id === itemId)
    if (!item) throw new Error(`No paper item ${itemId}`)
    if (item.kind === "promise") {
      if (item.draft) {
        if (edits?.subject) item.draft.subject = edits.subject
        if (edits?.body) item.draft.body = edits.body
        const res = await this.integrations.execute("GMAIL_SEND_EMAIL", {
          recipient_email: item.draft.to,
          subject: item.draft.subject,
          body: item.draft.body,
          thread_id: item.draft.threadId,
          attachment: item.draft.attachment?.name,
        })
        if (!res.successful) throw new Error(res.error ?? "send failed")
        this.store.update(() => (item.state = "done"))
      } else {
        this.store.update(() => (item.state = "approved"))
      }
    } else if (item.kind === "brief") {
      this.store.update(() => (item.state = "done"))
    } else if (item.kind === "conflict") {
      this.store.update(() => (item.state = "approved"))
      if (item.callId) this.scheduleCall(item.callId, edits?.constraints)
    } else if (item.kind === "call") {
      this.scheduleCall(item.id, edits?.constraints)
    }
    this.bumpStreak()
  }

  skip(itemId: string) {
    const item = this.state.paper?.items.find((i) => i.id === itemId)
    if (!item) throw new Error(`No paper item ${itemId}`)
    this.store.update(() => {
      item.state = "skipped"
      if (item.kind === "call") this.clock.cancel(`call:${item.id}`)
    })
    this.bumpStreak()
  }

  private bumpStreak() {
    const items = this.state.paper?.items ?? []
    const open = items.some((i) => (i.kind === "call" ? i.state === "proposed" : i.state === "pending"))
    if (!open && this.state.streak === 11) this.store.update((s) => (s.streak = 12))
  }

  scheduleCall(callId: string, constraints?: string[]) {
    const call = this.call(callId)
    if (call.state !== "proposed") return
    const opens = Date.parse(localISO(this.state.dataset.tomorrow, call.opensAt))
    const dueAt = Math.max(opens, this.clock.now() + 1000)
    this.store.update(() => {
      if (constraints?.length) call.constraints = constraints
      call.state = "scheduled"
      call.scheduledFor = dueAt
    })
    this.clock.schedule({ id: `call:${callId}`, label: `call ${call.business}`, dueAt, run: () => this.placeCall(callId) })
  }

  /** Calls go out one at a time, in the order they come due. */
  placeCall(callId: string, opts: { realtime?: boolean } = {}): Promise<void> {
    const realtime = opts.realtime ?? true
    // Leave a few seconds between calls so the last outcome can be read.
    const next = this.callQueue.then(async () => {
      await this.doCall(callId, realtime)
      if (!realtime) return
      const until = this.clock.now() + 7000
      while (this.clock.now() < until) await sleep(100)
    })
    this.callQueue = next.catch(() => {})
    return next
  }

  private call(callId: string): CallItem {
    const item = this.state.paper?.items.find((i) => i.id === callId)
    if (!item || item.kind !== "call") throw new Error(`No call ${callId}`)
    return item
  }

  private async doCall(callId: string, realtime: boolean) {
    const call = this.call(callId)
    this.store.update(() => (call.state = "dialing"))
    try {
      const recorded = this.state.mode === "replay" ? this.snapshot?.calls[call.phone] : undefined
      let transcript: Turn[]
      let outcome: CallOutcome
      let audioUrl: string
      let durationSec: number
      if (recorded) {
        await sleep(900)
        ;({ transcript, outcome, durationSec } = recorded)
        audioUrl = `/media/demo/audio/${recorded.audio}`
      } else {
        const business = this.state.dataset.businesses.find((b) => b.id === call.businessId)
        const result = await runCall({ call, business, integrations: this.integrations, now: () => this.clock.now() })
        const voice = business?.voice ?? "dentist"
        const file = resolve(config.dirs.runtime, "audio", `${call.id}.mp3`)
        const rendered = await renderCall(result.transcript, { bagel: config.voices.bagel, them: config.voices[voice] }, file)
        transcript = rendered.transcript
        outcome = result.outcome
        durationSec = rendered.durationSec
        audioUrl = `/media/runtime/audio/${basename(file)}`
      }
      this.store.update(() => {
        call.state = "in_call"
        call.transcript = transcript
        call.audioUrl = audioUrl
        call.durationSec = durationSec
        call.callStartedAt = this.clock.now()
      })
      // The call plays out on the demo clock, so a demo can fast-forward through it.
      if (realtime) {
        const endsAt = call.callStartedAt! + durationSec * 1000
        while (this.clock.now() < endsAt) await sleep(100)
      }
      // Replays apply the recorded calendar change against the sample data too.
      if (recorded && outcome.status === "success" && call.purpose === "reschedule" && call.relatedEventId && outcome.newTime) {
        await this.integrations.execute("GOOGLECALENDAR_PATCH_EVENT", {
          calendar_id: "primary",
          event_id: call.relatedEventId,
          start_time: outcome.newTime,
        })
      }
      this.store.update((s) => {
        call.state = "done"
        call.outcome = outcome
        const conflict = s.paper?.items.find((i) => i.kind === "conflict" && i.callId === call.id)
        if (conflict && outcome.status === "success") conflict.state = "done"
      })
    } catch (err) {
      this.store.update(() => {
        call.state = "failed"
        call.error = (err as Error).message
      })
      throw err
    }
  }

  // --- Recording ---------------------------------------------------------------

  /** Save the current (live) run as the replay snapshot, copying call audio into data/demo. */
  saveSnapshot() {
    const s = this.state
    if (!s.paper || s.nightShift.status !== "done") throw new Error("Run the night shift first")
    const audioDir = resolve(config.dirs.demo, "audio")
    mkdirSync(audioDir, { recursive: true })
    const calls: Snapshot["calls"] = {}
    for (const item of s.paper.items) {
      if (item.kind !== "call" || item.state !== "done" || !item.audioUrl || !item.transcript || !item.outcome) continue
      const src = resolve(config.root, "data", item.audioUrl.replace(/^\/media\//, ""))
      const name = `${item.businessId ?? item.id}.mp3`
      if (src !== join(audioDir, name)) copyFileSync(src, join(audioDir, name))
      calls[item.phone] = { transcript: item.transcript, outcome: item.outcome, audio: name, durationSec: item.durationSec ?? 0 }
    }
    const pristine = structuredClone(s.paper)
    for (const item of pristine.items) {
      if (item.kind === "call") {
        Object.assign(item, { state: "proposed" })
        for (const key of ["transcript", "audioUrl", "durationSec", "outcome", "scheduledFor", "callStartedAt", "error"] as const)
          delete (item as Partial<CallItem>)[key]
      } else {
        item.state = "pending"
      }
    }
    const snap: Snapshot = {
      version: 1,
      recordedAt: new Date().toISOString(),
      today: s.dataset.today,
      nightShift: { trail: s.trail, paper: pristine, stats: s.nightShift.stats },
      calls,
    }
    mkdirSync(config.dirs.demo, { recursive: true })
    writeFileSync(snapshotFile, JSON.stringify(snap, null, 2))
    this.snapshot = snap
    return snap
  }

  describeClock(): string {
    return prettyTime(this.clock.now())
  }
}
