import { useEffect, useRef } from "react"
import { actions, fmtTime, type AppState, type TrailStep } from "../api"
import { Bagel, Paw } from "./Bagel"

const ICON: Record<TrailStep["kind"], string> = {
  start: "🌙",
  sniff: "✉️",
  calendar: "📅",
  drive: "📁",
  research: "🔎",
  promise: "🦴",
  conflict: "⚠️",
  call: "📞",
  paper: "🗞️",
  think: "💭",
  error: "😵",
}

export function NightScreen({ state, now }: { state: AppState; now: number }) {
  const ns = state.nightShift
  const counts = {
    promises: state.paper?.items.filter((i) => i.kind === "promise").length ?? 0,
    briefs: state.paper?.items.filter((i) => i.kind === "brief").length ?? 0,
    calls: state.paper?.items.filter((i) => i.kind === "call").length ?? 0,
  }

  return (
    <div className="night">
      <div className="night__sky" aria-hidden="true">
        <div className="stars stars--a" />
        <div className="stars stars--b" />
        {ns.status === "idle" && <div className="moon" />}
      </div>
      <header className="appbar appbar--night">
        <Paw size={20} color="#ffd166" />
        <span>Bagel</span>
        <span className="appbar__tag">night shift</span>
      </header>

      {ns.status === "idle" && (
        <div className="night__intro">
          <Bagel pose="happy" headlamp size={210} className="bagel--float" />
          <h1>Goodnight, {state.persona.firstName}</h1>
          <p className="night__lede">I'll take the night shift. Your day will be on the doorstep at 7.</p>
          <ul className="night__plan">
            <li>📅 Read tomorrow's calendar &amp; inbox</li>
            <li>🦴 Fetch every promise, both ways</li>
            <li>🔎 Research first meetings</li>
            <li>📞 Line up the awkward calls</li>
          </ul>
          <button className="btn btn--moon" onClick={() => actions.jump("02:00")}>
            Tuck in 🌙
          </button>
          <p className="night__fine">Night shift starts at 2:00 AM · nothing is sent without your tap</p>
        </div>
      )}

      {ns.status !== "idle" && (
        <div className="night__work">
          <div className="night__hero">
            <Bagel pose={ns.status === "running" ? "sniff" : "paper"} headlamp={ns.status === "running"} size={130} />
            <div>
              <div className="night__kicker">{ns.status === "running" ? "On the night shift" : ns.status === "done" ? "Night shift done" : "Hit a snag"}</div>
              <div className="night__title">
                {ns.status === "running" && "Sniffing around…"}
                {ns.status === "done" && `Done by ${fmtTime(ns.finishedAt ?? now)}`}
                {ns.status === "failed" && "Lost the scent"}
              </div>
              {ns.status === "done" && (
                <div className="night__sub">
                  {counts.promises} promises · {counts.briefs} brief · {counts.calls} calls lined up
                </div>
              )}
            </div>
          </div>
          <Trail steps={state.trail} />
          {ns.status === "done" && (
            <div className="night__wake">
              <p>The Morning Bark lands at 7:00 AM.</p>
              <button className="btn btn--sun" onClick={() => actions.jump("07:00")}>
                Wake up ☀️
              </button>
            </div>
          )}
          {ns.status === "failed" && <p className="night__error">{ns.error}</p>}
        </div>
      )}
    </div>
  )
}

function Trail({ steps }: { steps: TrailStep[] }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [steps.length])
  return (
    <ol className="trail">
      {steps.map((s, i) => (
        <li key={s.id} className={`trail__step trail__step--${s.status} ${i % 2 ? "trail__step--r" : ""}`}>
          <span className="trail__paw">
            <Paw size={18} />
          </span>
          <span className="trail__icon">{ICON[s.kind]}</span>
          <span className="trail__body">
            <span className="trail__text">
              {s.text}
              {s.status === "active" && <span className="dots" />}
            </span>
            {s.detail && <span className="trail__detail">{s.detail}</span>}
          </span>
          <span className="trail__time">{fmtTime(s.at)}</span>
        </li>
      ))}
      <div ref={end} />
    </ol>
  )
}
