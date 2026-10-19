import { useEffect, useState } from "react"
import { useAppState, useDemoNow, type CallItem } from "./api"
import { Bagel } from "./components/Bagel"
import { CallScreen } from "./components/CallScreen"
import { MorningBark } from "./components/MorningBark"
import { NightScreen } from "./components/NightScreen"
import { Phone } from "./components/Phone"
import { SidePanel, Stack, UnderTheHood } from "./components/SidePanel"

const video = new URLSearchParams(location.search).has("video")

export function App() {
  const { state, offset } = useAppState()
  const now = useDemoNow(offset)
  const [dismissed, setDismissed] = useState<string[]>([])
  const caption = useCaption()
  const endcard = useEndcard()

  if (!state) {
    return (
      <div className="loading">
        <Bagel pose="sniff" size={160} />
        <p>Sniffing for the server…</p>
      </div>
    )
  }

  const calls = (state.paper?.items ?? []).filter((i): i is CallItem => i.kind === "call")
  // A call in progress wins; otherwise show the latest finished call until it's dismissed.
  const latestFinished = calls
    .filter((c) => c.state === "done" || c.state === "failed")
    .sort((a, b) => (b.callStartedAt ?? 0) - (a.callStartedAt ?? 0))[0]
  const activeCall =
    calls.find((c) => c.state === "dialing" || c.state === "in_call") ??
    (latestFinished && !dismissed.includes(latestFinished.id) ? latestFinished : undefined)
  const showPaper = Boolean(state.paper) && state.nightShift.status === "done" && now >= state.milestones.paper
  const screen = activeCall ? "call" : showPaper ? "paper" : "night"

  const phone = (
    <Phone now={now} tone={screen}>
      {screen === "call" && activeCall && (
        <CallScreen key={activeCall.id} call={activeCall} now={now} onClose={() => setDismissed((d) => [...d, activeCall.id])} />
      )}
      {screen === "paper" && <MorningBark key={state.paper!.date + state.mode} state={state} />}
      {screen === "night" && <NightScreen state={state} now={now} />}
    </Phone>
  )

  if (video) {
    return (
      <div className={`stage stage--video stage--${screen}`}>
        <div className="video__caption">
          <div className="video__brand">
            <Bagel pose="happy" size={64} /> <span>Bagel</span>
          </div>
          {caption && (
            <div className="video__text" key={caption.title}>
              <h2>{caption.title}</h2>
              {caption.body && <p>{caption.body}</p>}
            </div>
          )}
        </div>
        <div className="video__phone">{phone}</div>
        <div className="video__side">
          <UnderTheHood state={state} now={now} big />
          <Stack />
        </div>
        {endcard && (
          <div className="video__end">
            <Bagel pose="proud" frisbee size={400} />
            <div className="video__end-copy">
              <h1>
                Bagel does the work, <em>so you can go play frisbee with your dog.</em>
              </h1>
              <p className="video__end-open">🔓 Open source, open weights · 💻 Runs on your machine · 🧠 Your choice of model</p>
              <p className="video__end-stack">Cline SDK · Qwen 3.8 on W&amp;B Inference · Parallel · ElevenLabs · Composio-ready</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`stage stage--${screen}`}>
      <div className="stage__phone">{phone}</div>
      <SidePanel state={state} now={now} />
    </div>
  )
}

/** Captions for the demo video, set by the recording script via window.__caption(). */
function useCaption() {
  const [caption, setCaption] = useState<{ title: string; body?: string } | null>(null)
  useEffect(() => {
    ;(window as unknown as { __caption: (title: string, body?: string) => void }).__caption = (title, body) =>
      setCaption(title ? { title, body } : null)
  }, [])
  return caption
}

/** The closing card for the demo video, shown by the recording script via window.__endcard(). */
function useEndcard() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    ;(window as unknown as { __endcard: (on: boolean) => void }).__endcard = setOn
  }, [])
  return on
}
