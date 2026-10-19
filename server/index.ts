import express from "express"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config, missingKeys } from "./config.js"
import { Engine } from "./engine.js"
import { persona } from "./integrations/dataset.js"
import { addDays, localISO } from "./lib/time.js"

const engine = new Engine()
const app = express()
app.use(express.json())

function publicState() {
  const s = engine.state
  const lo = Date.parse(localISO(s.dataset.tomorrow, "00:00"))
  const hi = Date.parse(localISO(addDays(s.dataset.tomorrow, 4), "00:00"))
  const next = engine.clock.pending()[0]
  return {
    mode: s.mode,
    clock: { now: engine.clock.now(), real: Date.now() },
    persona: { name: persona.name, firstName: persona.firstName, company: persona.company },
    today: s.dataset.today,
    tomorrow: s.dataset.tomorrow,
    nightShift: s.nightShift,
    trail: s.trail,
    paper: s.paper,
    activity: s.activity.slice(-40),
    streak: s.streak,
    calendar: s.dataset.events
      .filter((e) => e.status === "confirmed" && Date.parse(e.start.dateTime) >= lo && Date.parse(e.start.dateTime) < hi)
      .map((e) => ({ id: e.id, summary: e.summary, start: e.start.dateTime, end: e.end.dateTime, location: e.location }))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    sent: s.dataset.messages
      .filter((m) => m.messageId.startsWith("msg_out_"))
      .map((m) => ({ id: m.messageId, to: m.to, subject: m.subject, at: m.messageTimestamp })),
    nextJob: next ? { label: next.label, dueAt: next.dueAt } : null,
    milestones: {
      evening: Date.parse(localISO(s.dataset.today, "23:58")),
      nightShift: Date.parse(localISO(s.dataset.tomorrow, "02:00")),
      paper: Date.parse(localISO(s.dataset.tomorrow, "07:00")),
      calls: Date.parse(localISO(s.dataset.tomorrow, "09:00")),
    },
    missingKeys: s.mode === "live" ? missingKeys() : [],
    canReplay: Boolean(engine.snapshot),
  }
}

// --- Live updates (server-sent events) ----------------------------------------
const clients = new Set<express.Response>()
let pending: NodeJS.Timeout | null = null
function broadcast() {
  if (pending) return
  pending = setTimeout(() => {
    pending = null
    const data = `data: ${JSON.stringify(publicState())}\n\n`
    for (const res of clients) res.write(data)
  }, 60)
}
engine.store.on("change", broadcast)
setInterval(broadcast, 2000)

app.get("/api/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
  res.write(`data: ${JSON.stringify(publicState())}\n\n`)
  clients.add(res)
  req.on("close", () => clients.delete(res))
})

app.get("/api/state", (_req, res) => {
  res.json(publicState())
})

const handle =
  (fn: (req: express.Request) => unknown | Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try {
      const out = await fn(req)
      res.json({ ok: true, ...(typeof out === "object" && out ? out : {}) })
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message })
    }
  }

app.post(
  "/api/reset",
  handle((req) => engine.reset(req.body?.mode === "live" ? "live" : req.body?.mode === "replay" ? "replay" : undefined)),
)
app.post(
  "/api/jump",
  handle((req) => {
    const to = String(req.body?.to ?? "")
    if (!/^\d{2}:\d{2}$/.test(to)) throw new Error("to must be HH:MM")
    engine.jump(to, Number(req.body?.lead ?? 2))
  }),
)
app.post(
  "/api/advance",
  handle((req) => {
    const seconds = Number(req.body?.seconds ?? 0)
    if (!(seconds > 0 && seconds < 86400)) throw new Error("seconds must be between 0 and 86400")
    engine.advance(seconds)
  }),
)
app.post(
  "/api/nightshift/start",
  handle(() => {
    engine.jump("02:00", 0)
  }),
)
app.post(
  "/api/items/:id/approve",
  handle((req) => engine.approve(String(req.params.id), req.body ?? {})),
)
app.post(
  "/api/items/:id/skip",
  handle((req) => engine.skip(String(req.params.id))),
)
app.post(
  "/api/snapshot/save",
  handle(() => ({ recordedAt: engine.saveSnapshot().recordedAt })),
)

// Call recordings and other generated media.
app.use("/media/demo", express.static(config.dirs.demo, { fallthrough: false }))
app.use("/media/runtime", express.static(config.dirs.runtime, { fallthrough: false }))

// The built web app (npm run build). In development Vite serves it instead.
if (existsSync(config.dirs.web)) {
  app.use(express.static(config.dirs.web))
  app.get(/^\/(?!api|media).*/, (_req, res) => res.sendFile(resolve(config.dirs.web, "index.html")))
}

app.listen(config.port, () => {
  console.log(`🐶 Bagel is on duty at http://localhost:${config.port} (${engine.state.mode} mode)`)
  const missing = missingKeys()
  if (engine.state.mode === "live" && missing.length) console.log(`   Missing keys for live mode: ${missing.join(", ")}`)
})
