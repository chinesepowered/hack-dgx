import type { ReactNode } from "react"
import { fmtClock } from "../api"

export function Phone({ now, tone, children }: { now: number; tone: "night" | "paper" | "call"; children: ReactNode }) {
  const dark = tone === "night"
  return (
    <div className="phone">
      <div className="phone__screen">
        <div className={`statusbar statusbar--${tone} ${dark ? "statusbar--dark" : ""}`}>
          <span className="statusbar__time">{fmtClock(now)}</span>
          <span className="statusbar__island" />
          <span className="statusbar__icons" aria-hidden="true">
            <svg width="18" height="12" viewBox="0 0 18 12">
              <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
              <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
              <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
              <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12">
              <path d="M8 11.5 L5.6 8.6 a3.4 3.4 0 0 1 4.8 0 Z" fill="currentColor" />
              <path d="M3.3 6.4 a6.6 6.6 0 0 1 9.4 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M1 3.9 a9.9 9.9 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
            <svg width="27" height="13" viewBox="0 0 27 13">
              <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" fill="none" opacity="0.5" />
              <rect x="2.5" y="2.5" width="17" height="8" rx="2" fill="currentColor" />
              <rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" />
            </svg>
          </span>
        </div>
        <div className="phone__content">{children}</div>
        <div className={`phone__home ${dark ? "phone__home--dark" : ""}`} />
      </div>
    </div>
  )
}
