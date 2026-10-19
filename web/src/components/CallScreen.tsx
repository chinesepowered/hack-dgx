import { useEffect, useRef, useState } from "react"
import { fmtDay, fmtTime, type CallItem } from "../api"
import { Bagel } from "./Bagel"

export function CallScreen({ call, now, onClose }: { call: CallItem; now: number; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const [blocked, setBlocked] = useState(false)
  const live = call.state === "in_call"
  const done = call.state === "done" || call.state === "failed"
  const elapsed = live && call.callStartedAt ? Math.max(0, (now - call.callStartedAt) / 1000) : done ? Infinity : 0
  const turns = (call.transcript ?? []).filter((t) => (t.start ?? 0) <= elapsed + 0.1)
  const speaking = (call.transcript ?? []).find((t) => t.speaker !== "tool" && (t.start ?? 0) <= elapsed && elapsed < (t.end ?? 0))
  const firstLine = call.transcript?.find((t) => t.speaker !== "tool")?.start ?? 0
  const ringing = call.state === "dialing" || (live && elapsed < firstLine)

  useEffect(() => {
    const el = audio.current
    if (!el || !live || !call.audioUrl || !call.callStartedAt) return
    el.currentTime = Math.min(Math.max(0, (now - call.callStartedAt) / 1000), call.durationSec ?? 0)
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    )
    return () => el.pause()
    // Start once per call recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, call.audioUrl, call.callStartedAt])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns.length])

  const mm = Number.isFinite(elapsed) ? `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}` : ""

  return (
    <div className="call">
      {call.audioUrl && <audio ref={audio} src={call.audioUrl} preload="auto" />}
      <div className="call__top">
        <div className="call__label">{done ? "Call ended" : ringing ? "Calling…" : "Bagel is on the phone"}</div>
        <div className="call__who">{call.business}</div>
        <div className="call__meta">
          {call.phone} {live && !ringing && <span className="call__timer">· {mm}</span>}
        </div>
      </div>
      <div className={`call__dog ${ringing ? "call__dog--ring" : ""}`}>
        <div className="call__ring" />
        <Bagel pose={speaking?.speaker === "bagel" ? "talk" : "phone"} size={150} />
      </div>
      <div className="call__transcript">
        {turns.map((t, i) =>
          t.speaker === "tool" ? (
            <div className="toolchip" key={i}>
              <span>📅</span> {t.text}
            </div>
          ) : (
            <div className={`bubble bubble--${t.speaker} ${speaking === t ? "bubble--speaking" : ""}`} key={i}>
              <span className="bubble__who">{t.speaker === "bagel" ? "Bagel" : call.business}</span>
              {t.text}
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      {blocked && live && (
        <button className="btn btn--ghost call__listen" onClick={() => audio.current?.play().then(() => setBlocked(false))}>
          🔊 Tap to listen
        </button>
      )}
      <div className="call__honest">Demo: the front desk is a simulated AI voice · Bagel always says he's an AI</div>
      {done && call.outcome && (
        <div className="outcome-sheet">
          <div className={`outcome-sheet__icon ${call.outcome.status === "success" ? "ok" : ""}`}>{call.outcome.status === "success" ? "✓" : "!"}</div>
          <p>{call.outcome.summary}</p>
          <div className="outcome-sheet__chips">
            {call.outcome.newTime && (
              <span className="chip chip--green">
                📅 {fmtDay(call.outcome.newTime)}, {fmtTime(call.outcome.newTime)}
              </span>
            )}
            {call.outcome.confirmation && <span className="chip chip--green"># {call.outcome.confirmation}</span>}
            {call.outcome.fee && <span className="chip chip--green">Fee: {call.outcome.fee}</span>}
            {call.purpose === "reschedule" && call.outcome.newTime && <span className="chip chip--soft">Calendar updated</span>}
          </div>
          <button className="btn btn--primary" onClick={onClose}>
            Back to the paper
          </button>
        </div>
      )}
      {call.state === "failed" && <p className="card__error">{call.error}</p>}
    </div>
  )
}
