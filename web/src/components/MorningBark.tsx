import { useEffect, useState } from "react"
import {
  actions,
  fmtDue,
  fmtLongDate,
  fmtTime,
  type AppState,
  type BriefItem,
  type CallItem,
  type ConflictItem,
  type PaperItem,
  type PromiseItem,
} from "../api"
import { Bagel, Paw } from "./Bagel"

// The delivery animation plays once per paper, not every time you come back to it.
let deliveredKey = ""

export function MorningBark({ state }: { state: AppState }) {
  const paper = state.paper!
  const key = `${paper.date}|${state.mode}|${state.nightShift.finishedAt}`
  const [alreadyDelivered] = useState(deliveredKey === key)
  const [delivering, setDelivering] = useState(!alreadyDelivered)
  const [editing, setEditing] = useState<PromiseItem | null>(null)
  const [composio, setComposio] = useState(false)
  useEffect(() => {
    if (!delivering) return
    const t = window.setTimeout(() => {
      deliveredKey = key
      setDelivering(false)
    }, 2600)
    return () => window.clearTimeout(t)
  }, [delivering, key])

  const items = paper.items
  const promises = items.filter((i): i is PromiseItem => i.kind === "promise")
  const dueToday = promises.filter((p) => p.direction === "you_owe" && p.status !== "upcoming")
  const nudges = promises.filter((p) => p.direction === "owed_to_you" && p.status === "overdue")
  const radar = promises.filter((p) => p.status === "upcoming")
  const briefs = items.filter((i): i is BriefItem => i.kind === "brief")
  const conflicts = items.filter((i): i is ConflictItem => i.kind === "conflict")
  const calls = items.filter((i): i is CallItem => i.kind === "call")
  const linked = new Set(conflicts.map((c) => c.callId))
  const looseCalls = calls.filter((c) => !linked.has(c.id))
  const scheduled = calls.filter((c) => c.state === "scheduled")
  const open = items.filter((i) => (i.kind === "call" ? i.state === "proposed" : i.state === "pending")).length
  const callById = (id?: string) => calls.find((c) => c.id === id)

  return (
    <div className="morning">
      {delivering && <Delivery />}
      <div className={`paper ${delivering ? "paper--hidden" : alreadyDelivered ? "" : "paper--in"}`}>
        <header className="masthead">
          <div className="masthead__ears">
            <span>Sniffed overnight by Bagel</span>
            <span>
              <Paw size={12} /> Day {state.streak}
            </span>
          </div>
          <h1 className="masthead__title">The Morning Bark</h1>
          <div className="masthead__line">
            <span>{fmtLongDate(paper.date)}</span>
            <span>Edition for {state.persona.firstName}</span>
          </div>
        </header>
        <h2 className="paper__headline">{paper.headline}</h2>
        <p className="paper__deck">{paper.summary}</p>

        {open === 0 && (
          <div className="paper__done">
            <Bagel pose="proud" size={92} />
            <div>
              <strong>That's the whole paper.</strong>
              <span>Good boy, Bagel. 🐾 {state.streak}-day streak</span>
            </div>
          </div>
        )}

        {scheduled.length > 0 && (
          <div className="callbanner" id="callbanner">
            <span className="callbanner__icon">📞</span>
            <span>
              Bagel will call {scheduled.map((c) => c.business).join(" & ")} at{" "}
              {fmtTime(Math.min(...scheduled.map((c) => c.scheduledFor ?? Infinity)))} when they open.
            </span>
          </div>
        )}

        {dueToday.length > 0 && (
          <Section title="Due today" note="promises you made">
            {dueToday.map((p) => (
              <PromiseCard key={p.id} item={p} onEdit={() => setEditing(p)} />
            ))}
          </Section>
        )}

        {briefs.length > 0 && (
          <Section title="Meeting brief" note="researched with Parallel">
            {briefs.map((b) => (
              <BriefCard key={b.id} item={b} />
            ))}
          </Section>
        )}

        {conflicts.length > 0 && (
          <Section title="Double-booked" note="Bagel has a fix">
            {conflicts.map((c) => (
              <ConflictCard key={c.id} item={c} call={callById(c.callId)} calendar={state.calendar} />
            ))}
          </Section>
        )}

        {looseCalls.length > 0 && (
          <Section title="Bagel can call" note="so you don't have to">
            {looseCalls.map((c) => (
              <CallCard key={c.id} item={c} />
            ))}
          </Section>
        )}

        {nudges.length > 0 && (
          <Section title="Waiting on others" note="overdue">
            {nudges.map((p) => (
              <PromiseCard key={p.id} item={p} onEdit={() => setEditing(p)} />
            ))}
          </Section>
        )}

        {radar.length > 0 && (
          <Section title="On Bagel's radar" note="coming up">
            {radar.map((p) => (
              <PromiseCard key={p.id} item={p} onEdit={() => setEditing(p)} compact />
            ))}
          </Section>
        )}

        <button className="composio-tease" onClick={() => setComposio(true)}>
          <span className="composio-tease__dot" />
          <span>
            Running on sample data. <strong>Connect Gmail &amp; Calendar with Composio →</strong>
          </span>
        </button>
        <div className="paper__end">
          <Paw size={14} /> <Paw size={14} /> <Paw size={14} />
        </div>
      </div>

      {editing && <EditDraft item={editing} onClose={() => setEditing(null)} />}
      {composio && <ComposioSheet onClose={() => setComposio(false)} />}
    </div>
  )
}

function Delivery() {
  return (
    <div className="delivery">
      <div className="delivery__sun" />
      <div className="delivery__dog">
        <Bagel pose="paper" size={180} />
      </div>
      <div className="delivery__thump">thump!</div>
    </div>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h3 className="section__title">
        <span>{title}</span>
        {note && <em>{note}</em>}
      </h3>
      {children}
    </section>
  )
}

function Stamp({ label, tone = "ink" }: { label: string; tone?: "ink" | "green" | "grey" }) {
  return (
    <div className={`stamp stamp--${tone}`}>
      <Paw size={14} /> {label}
    </div>
  )
}

function useAct(fn: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

function dueChip(p: PromiseItem) {
  if (p.status === "overdue") return <span className="chip chip--red">Overdue</span>
  if (p.status === "due_today") return <span className="chip chip--amber">Due today</span>
  return <span className="chip">{fmtDue(p.due)}</span>
}

function PromiseCard({ item, onEdit, compact = false }: { item: PromiseItem; onEdit: () => void; compact?: boolean }) {
  const send = useAct(() => actions.approve(item.id))
  const skip = useAct(() => actions.skip(item.id))
  const label = item.direction === "you_owe" ? (item.draft ? "Send" : "Got it") : item.draft ? "Send nudge" : "Keep watching"
  return (
    <article className={`card card--${item.state}`} id={`item-${item.id}`} data-kind="promise">
      <div className="card__head">
        <span className="avatar">{initials(item.person)}</span>
        <div className="card__who">
          <strong>{item.person}</strong>
          <span>{item.direction === "you_owe" ? "you promised" : "promised you"}</span>
        </div>
        {dueChip(item)}
      </div>
      <p className="card__title">{item.what}</p>
      {!compact && <p className="card__why">{item.why}</p>}
      {item.draft && item.state === "pending" && (
        <div className="draft">
          <div className="draft__meta">
            <span>To {item.draft.to}</span>
            <span>{item.draft.subject}</span>
          </div>
          <p className="draft__body">{item.draft.body}</p>
          {item.draft.attachment && <span className="attach">📎 {item.draft.attachment.name}</span>}
        </div>
      )}
      {item.state === "pending" ? (
        <div className="card__actions">
          <button className="btn btn--primary" disabled={send.busy} onClick={send.run}>
            {send.busy ? "Sending…" : label}
          </button>
          {item.draft && (
            <button className="btn btn--ghost" onClick={onEdit}>
              Edit
            </button>
          )}
          <button className="btn btn--text" disabled={skip.busy} onClick={skip.run}>
            Skip
          </button>
        </div>
      ) : (
        <Stamp
          label={item.state === "done" ? (item.direction === "you_owe" ? "Sent" : "Nudged") : item.state === "skipped" ? "Skipped" : "Noted"}
          tone={item.state === "skipped" ? "grey" : "green"}
        />
      )}
      {(send.error || skip.error) && <p className="card__error">{send.error ?? skip.error}</p>}
    </article>
  )
}

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function BriefCard({ item }: { item: BriefItem }) {
  const ack = useAct(() => actions.approve(item.id))
  const [showSources, setShowSources] = useState(false)
  return (
    <article className={`card card--brief card--${item.state}`} id={`item-${item.id}`} data-kind="brief">
      <div className="card__head">
        <span className="when">{item.start ? fmtTime(item.start) : ""}</span>
        <div className="card__who">
          <strong>{item.eventTitle}</strong>
          <span>first meeting · {item.company}</span>
        </div>
      </div>
      <p className="brief__one">{item.oneLiner}</p>
      <h4>Recent news</h4>
      <ul className="brief__list">
        {item.recentNews.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {item.keyPeople.length > 0 && (
        <div className="brief__people">
          {item.keyPeople.map((p) => (
            <span className="chip chip--soft" key={p}>
              {p}
            </span>
          ))}
        </div>
      )}
      <h4>Ask about</h4>
      <ul className="brief__list brief__list--ask">
        {item.talkingPoints.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <button className="sources" onClick={() => setShowSources((v) => !v)}>
        <span className="sources__badge">Parallel</span>
        {item.sources.length} sources {showSources ? "▴" : "▾"}
      </button>
      {showSources && (
        <ul className="sources__list">
          {item.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title ?? domain(s.url)}
              </a>
              <span>{domain(s.url)}</span>
            </li>
          ))}
        </ul>
      )}
      {item.state === "pending" ? (
        <div className="card__actions">
          <button className="btn btn--primary" disabled={ack.busy} onClick={ack.run}>
            Got it
          </button>
        </div>
      ) : (
        <Stamp label="Read" tone="green" />
      )}
    </article>
  )
}

function ConflictCard({ item, call, calendar }: { item: ConflictItem; call?: CallItem; calendar: AppState["calendar"] }) {
  const approve = useAct(() => actions.approve(item.id))
  const skip = useAct(() => actions.skip(item.id))
  const keep = calendar.find((e) => e.id === item.keepEventId)
  const move = calendar.find((e) => e.id === item.moveEventId)
  return (
    <article className={`card card--conflict card--${item.state}`} id={`item-${item.id}`} data-kind="conflict">
      <p className="card__title">{item.summary}</p>
      <div className="clash">
        {keep && (
          <div className="clash__row clash__row--keep">
            <span>{fmtTime(keep.start)}</span>
            <span>{keep.summary}</span>
            <em>keep</em>
          </div>
        )}
        {move && (
          <div className={`clash__row ${call?.state === "done" ? "clash__row--moved" : "clash__row--move"}`}>
            <span>{fmtTime(move.start)}</span>
            <span>{move.summary}</span>
            <em>{call?.state === "done" ? `moved → ${fmtDue(move.start.slice(0, 10))}` : "move"}</em>
          </div>
        )}
      </div>
      <p className="card__why">{item.proposal}</p>
      {call && <CallBox call={call} />}
      {item.state === "pending" ? (
        <div className="card__actions">
          <button className="btn btn--primary" disabled={approve.busy} onClick={approve.run}>
            {call ? `Approve call at ${call.opensAt.replace(/^0/, "")}` : "Approve"}
          </button>
          <button className="btn btn--text" disabled={skip.busy} onClick={skip.run}>
            Skip
          </button>
        </div>
      ) : (
        <CallStamp call={call} fallback={item.state === "skipped" ? "Skipped" : "Approved"} />
      )}
    </article>
  )
}

function CallCard({ item }: { item: CallItem }) {
  const approve = useAct(() => actions.approve(item.id))
  const skip = useAct(() => actions.skip(item.id))
  return (
    <article className={`card card--call card--${item.state}`} id={`item-${item.id}`} data-kind="call">
      <div className="card__head">
        <span className="avatar avatar--call">📞</span>
        <div className="card__who">
          <strong>{item.business}</strong>
          <span>{item.phone}</span>
        </div>
        <span className="chip chip--blue">{item.purpose}</span>
      </div>
      <p className="card__title">{item.goal}</p>
      <p className="card__why">{item.why}</p>
      <CallBox call={item} hideHeader />
      {item.state === "proposed" ? (
        <div className="card__actions">
          <button className="btn btn--primary" disabled={approve.busy} onClick={approve.run}>
            Approve call at {item.opensAt.replace(/^0/, "")}
          </button>
          <button className="btn btn--text" disabled={skip.busy} onClick={skip.run}>
            Skip
          </button>
        </div>
      ) : (
        <CallStamp call={item} fallback="Skipped" />
      )}
    </article>
  )
}

function CallBox({ call, hideHeader = false }: { call: CallItem; hideHeader?: boolean }) {
  return (
    <div className="callbox">
      {!hideHeader && (
        <div className="callbox__head">
          📞 Bagel can call <strong>{call.business}</strong> when they open
        </div>
      )}
      <div className="callbox__rules">
        {call.constraints.slice(0, 3).map((c) => (
          <span className="rule" key={c}>
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

function CallStamp({ call, fallback }: { call?: CallItem; fallback: string }) {
  if (!call || call.state === "skipped") return <Stamp label={fallback} tone="grey" />
  if (call.state === "done" && call.outcome)
    return (
      <div className="outcome">
        <Stamp label={call.outcome.status === "success" ? "Done" : "Needs you"} tone={call.outcome.status === "success" ? "green" : "ink"} />
        <p>{call.outcome.summary}</p>
      </div>
    )
  if (call.state === "scheduled") return <Stamp label={`Calling at ${fmtTime(call.scheduledFor ?? 0)}`} tone="ink" />
  if (call.state === "dialing" || call.state === "in_call") return <Stamp label="On the phone…" tone="ink" />
  if (call.state === "failed") return <Stamp label="Call failed" tone="grey" />
  return <Stamp label={fallback} tone="ink" />
}

function EditDraft({ item, onClose }: { item: PromiseItem; onClose: () => void }) {
  const [subject, setSubject] = useState(item.draft?.subject ?? "")
  const [body, setBody] = useState(item.draft?.body ?? "")
  const send = useAct(async () => {
    await actions.approve(item.id, { subject, body })
    onClose()
  })
  return (
    <div className="sheet" role="dialog" aria-label="Edit draft">
      <div className="sheet__panel">
        <div className="sheet__grab" />
        <h3>Edit before sending</h3>
        <label>
          To <input value={item.draft?.to ?? ""} readOnly />
        </label>
        <label>
          Subject <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label>
          Message <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="card__actions">
          <button className="btn btn--primary" disabled={send.busy} onClick={send.run}>
            Send
          </button>
          <button className="btn btn--text" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ComposioSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-label="Connect with Composio" onClick={onClose}>
      <div className="sheet__panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <h3>From sample data to your real day</h3>
        <p>
          Bagel already talks to your accounts through Composio's tool names: <code>GMAIL_FETCH_EMAILS</code>,{" "}
          <code>GOOGLECALENDAR_EVENTS_LIST</code>, <code>GOOGLECALENDAR_FIND_FREE_SLOTS</code>, <code>GMAIL_SEND_EMAIL</code>.
        </p>
        <p>
          Today those calls are answered by sample data. In production, a Composio session answers them instead: same tools, same
          arguments, your real Gmail and Calendar, with read-only scopes and every send behind your tap.
        </p>
        <button className="btn btn--primary" onClick={onClose}>
          Sounds good
        </button>
      </div>
    </div>
  )
}

export function isOpen(i: PaperItem) {
  return i.kind === "call" ? i.state === "proposed" : i.state === "pending"
}
