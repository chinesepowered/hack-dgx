import { useEffect, useRef, useState } from "react"
import { actions, fmtDay, fmtTime, type AppState, type CallItem } from "../api"
import { Paw } from "./Bagel"

interface LogEntry {
  at: number
  tool: string
  args?: string
  result: string
  active?: boolean
}

function providerOf(tool: string): { label: string; cls: string } {
  if (/^(GMAIL|GOOGLECALENDAR|GOOGLEDRIVE)_/.test(tool)) return { label: "Composio", cls: "prov--composio" }
  if (tool === "research_meeting") return { label: "Parallel", cls: "prov--parallel" }
  if (tool === "phone_call") return { label: "ElevenLabs", cls: "prov--eleven" }
  return { label: "Cline tool", cls: "prov--cline" }
}

/** Everything Bagel actually called, in order: the agent's tool calls, approvals, and mid-call checks. */
function buildLog(state: AppState, now: number): LogEntry[] {
  const log: LogEntry[] = []
  for (const s of state.trail) {
    if (!s.tool) continue
    log.push({ at: s.at, tool: s.tool, args: s.args, result: s.status === "active" ? "running…" : s.text, active: s.status === "active" })
  }
  const nightEnd = state.nightShift.finishedAt ?? Infinity
  for (const a of state.activity) {
    if (a.at < nightEnd || a.slug === "GOOGLECALENDAR_FIND_FREE_SLOTS") continue
    if (a.slug === "GOOGLECALENDAR_PATCH_EVENT" && state.mode === "replay") continue
    log.push({ at: a.at, tool: a.slug, result: a.summary })
  }
  const calls = (state.paper?.items ?? []).filter((i): i is CallItem => i.kind === "call")
  for (const c of calls) {
    if (!c.callStartedAt || !c.transcript) continue
    log.push({ at: c.callStartedAt, tool: "phone_call", args: JSON.stringify({ to: c.business }), result: "Bagel's voice: ElevenLabs" })
    const elapsed = (now - c.callStartedAt) / 1000
    for (const t of c.transcript) {
      if (t.speaker !== "tool" || (t.start ?? 0) > elapsed) continue
      const tool = t.text.startsWith("Moved") ? "GOOGLECALENDAR_PATCH_EVENT" : "GOOGLECALENDAR_FIND_FREE_SLOTS"
      log.push({ at: c.callStartedAt + (t.start ?? 0) * 1000, tool, result: t.text })
    }
  }
  return log.sort((a, b) => a.at - b.at)
}

export function UnderTheHood({ state, now, big = false }: { state: AppState; now: number; big?: boolean }) {
  const log = buildLog(state, now)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [log.length])
  const st = state.nightShift.stats
  return (
    <div className={`hood ${big ? "hood--big" : ""}`}>
      <div className="hood__head">
        <strong>Under the hood</strong>
        <span>Cline SDK agent · Qwen 3.8 on W&amp;B</span>
      </div>
      {st && (
        <div className="hood__stats">
          {st.iterations} agent turns · {(st.inputTokens / 1000).toFixed(1)}k tokens in · {(st.outputTokens / 1000).toFixed(1)}k out
        </div>
      )}
      <div className="hood__log">
        {log.length === 0 && <div className="hood__empty">Waiting for the night shift…</div>}
        {log.map((e, i) => {
          const p = providerOf(e.tool)
          return (
            <div className={`hood__row ${e.active ? "hood__row--active" : ""}`} key={i}>
              <span className="hood__time">{fmtTime(e.at)}</span>
              <span className={`prov ${p.cls}`}>{p.label}</span>
              <code className="hood__tool">{e.tool}</code>
              {e.args && e.args !== "{}" && <code className="hood__args">{e.args}</code>}
              <span className="hood__result">→ {e.result}</span>
            </div>
          )
        })}
        <div ref={end} />
      </div>
    </div>
  )
}

export function Stack() {
  return (
    <div className="stack">
      <span className="stack__chip">🧠 Cline SDK</span>
      <span className="stack__chip">🐉 Qwen 3.8 · W&amp;B Inference</span>
      <span className="stack__chip">🔎 Parallel</span>
      <span className="stack__chip">🗣️ ElevenLabs</span>
      <span className="stack__chip stack__chip--dashed">🔌 Composio (sample data)</span>
    </div>
  )
}

export function SidePanel({ state, now }: { state: AppState; now: number }) {
  const [busy, setBusy] = useState(false)
  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  const scheduledCalls = (state.paper?.items ?? []).some((i) => i.kind === "call" && i.state === "scheduled")
  return (
    <aside className="panel">
      <div className="panel__brand">
        <Paw size={22} color="#e8743b" />
        <div>
          <strong>Bagel</strong>
          <span>works the night shift so you don't have to</span>
        </div>
      </div>
      <div className="panel__clock">
        <span className="panel__time">{fmtTime(now)}</span>
        <span className="panel__day">{fmtDay(now)}</span>
        <span className={`panel__mode panel__mode--${state.mode}`}>{state.mode === "replay" ? "replaying a recorded run" : "live APIs"}</span>
      </div>
      <div className="panel__jumps">
        <button disabled={busy} onClick={run(() => actions.reset())}>
          <span>11:58 PM</span> Bedtime (reset)
        </button>
        <button disabled={busy || state.nightShift.status !== "idle"} onClick={run(() => actions.jump("02:00"))}>
          <span>2:00 AM</span> Night shift
        </button>
        <button disabled={busy || state.nightShift.status !== "done"} onClick={run(() => actions.jump("07:00"))}>
          <span>7:00 AM</span> The Morning Bark
        </button>
        <button disabled={busy || !scheduledCalls} onClick={run(() => actions.jump("09:00"))}>
          <span>9:00 AM</span> Bagel's calls
        </button>
      </div>
      <div className="panel__modes">
        <button className={state.mode === "replay" ? "on" : ""} disabled={busy || !state.canReplay} onClick={run(() => actions.reset("replay"))}>
          Replay
        </button>
        <button className={state.mode === "live" ? "on" : ""} disabled={busy} onClick={run(() => actions.reset("live"))}>
          Live
        </button>
      </div>
      {state.missingKeys.length > 0 && <p className="panel__warn">Live mode needs: {state.missingKeys.join(", ")}</p>}
      <UnderTheHood state={state} now={now} />
      <Stack />
    </aside>
  )
}
