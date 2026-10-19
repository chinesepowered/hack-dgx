// Record the demo video's picture: drives the app (replay mode) through the
// story in /?video layout and captures 1080p frames over the Chrome DevTools
// screencast. Also logs when each narration line and each stretch of call
// audio should play, for scripts/make-video.mjs to mix.
// Needs the dev servers running (npm run dev). Usage: node scripts/record-video.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(import.meta.dirname, "..")
const base = process.env.BASE ?? "http://localhost:5173"
const out = resolve(root, "data/runtime/video")
const framesDir = resolve(out, "frames")
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })

const script = JSON.parse(readFileSync(resolve(root, "demo/script.json"), "utf8"))
const manifest = JSON.parse(readFileSync(resolve(root, "demo/narration/manifest.json"), "utf8"))
const seg = Object.fromEntries(script.segments.map((s) => [s.id, s]))
const dur = (id) => manifest[id].duration

const post = (p, body = {}) =>
  fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())
const state = () => fetch(`${base}/api/state`).then((r) => r.json())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const wall = () => Date.now() / 1000

await post("/api/reset", { mode: "replay" })
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const page = await context.newPage()
page.on("pageerror", (e) => console.log("page error:", e.message))
await page.goto(`${base}/?video`, { waitUntil: "load" })
await page.waitForTimeout(2000)

// --- capture ------------------------------------------------------------------
const frames = []
const cdp = await context.newCDPSession(page)
cdp.on("Page.screencastFrame", async (f) => {
  const file = resolve(framesDir, `${String(frames.length).padStart(6, "0")}.jpg`)
  frames.push({ file, ts: f.metadata.timestamp })
  writeFileSync(file, Buffer.from(f.data, "base64"))
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {})
})
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 })

const events = []
const start = {}
const say = (id) => {
  start[id] = wall()
  events.push({ type: "narration", id, at: start[id] })
  console.log(`${(start[id] - t0).toFixed(1)}s  ▶ ${id}`)
}
const ends = (id) => start[id] + dur(id)
const until = async (t) => {
  const ms = (t - wall()) * 1000
  if (ms > 0) await sleep(ms)
}
const caption = (id) => page.evaluate(([t, b]) => window.__caption(t, b), seg[id].caption ?? ["", ""])
const scrollTo = (selector, offset = 76) =>
  page.evaluate(
    ([sel, off]) => {
      const el = document.querySelector(sel)
      const paper = el?.closest(".paper")
      if (!el || !paper) return
      const top = el.getBoundingClientRect().top - paper.getBoundingClientRect().top + paper.scrollTop
      paper.scrollTo({ top: top - off, behavior: "smooth" })
    },
    [selector, offset],
  )
const waitFor = async (pred, timeout = 60000) => {
  const t = Date.now()
  while (Date.now() - t < timeout) {
    const s = await state()
    const v = pred(s)
    if (v) return { s, v }
    await sleep(80)
  }
  throw new Error("timed out waiting")
}
const t0 = wall()

// --- 1. Bedtime ---------------------------------------------------------------
await caption("s01-intro")
await sleep(300)
say("s01-intro")
await until(ends("s01-intro") + 0.25)

// --- 2. Night shift ---------------------------------------------------------------
await page.getByRole("button", { name: /Tuck in/ }).click()
await caption("s02-night")
await sleep(150)
say("s02-night")
await waitFor((s) => s.nightShift.status === "done")
await until(ends("s02-night") + 0.3)

// --- 3. The Morning Bark ------------------------------------------------------------
await page.getByRole("button", { name: /Wake up/ }).click()
await caption("s03-paper")
await sleep(150)
say("s03-paper")
const { s: paperState } = await waitFor((s) => s.paper?.items?.length)
const items = paperState.paper.items
const maya = items.find((i) => i.kind === "promise" && i.person.startsWith("Maya"))
await until(ends("s03-paper") - 0.75)
await page.locator(`#item-${maya.id}`).getByRole("button", { name: "Send", exact: true }).click()
await sleep(600)

// --- 4. Brief --------------------------------------------------------------------
await caption("s04-brief")
await scrollTo('[data-kind="brief"]')
await sleep(250)
say("s04-brief")
await sleep(3200)
await scrollTo('[data-kind="brief"] h4:nth-of-type(2)', 300)
await until(ends("s04-brief") - 0.6)
await page.locator('[data-kind="brief"]').getByRole("button", { name: "Got it" }).click()
await sleep(450)

// --- 5. Conflict + gym ---------------------------------------------------------------
await caption("s05-approve")
await scrollTo('[data-kind="conflict"]')
await sleep(250)
say("s05-approve")
await until(ends("s05-approve") - 2.7)
await page.locator('[data-kind="conflict"]').getByRole("button", { name: /Approve call/ }).click()
await sleep(350)
await scrollTo('[data-kind="call"]', 120)
await until(ends("s05-approve") - 0.4)
await page.locator('[data-kind="call"]').getByRole("button", { name: /Approve call/ }).click()
await sleep(600)

// --- 6. The calls ---------------------------------------------------------------------
// Call audio is placed by call position: pos(t) = t - origin for each stretch of playback.
const AUDIBLE = {
  "(415) 555-0199": [
    [0, 18.6],
    [42.6, 61.0],
  ],
}
let stretch = null // { phone, audio, origin, startPos }: pos(t) = t - origin while it plays
const callPos = (s, call) => (s.clock.now - call.callStartedAt) / 1000 // seconds into the recording, at fetch time
async function beginStretch(phone) {
  const before = wall()
  const s = await state()
  const after = wall()
  const call = s.paper.items.find((i) => i.kind === "call" && i.phone === phone)
  const pos = callPos(s, call)
  stretch = { phone, audio: call.audioUrl, origin: (before + after) / 2 - pos, startPos: pos }
}
function endStretch() {
  if (!stretch) return
  const endPos = wall() - stretch.origin
  for (const [a, b] of AUDIBLE[stretch.phone] ?? []) {
    const s0 = Math.max(a, stretch.startPos)
    const s1 = Math.min(b, endPos)
    if (s1 > s0 + 0.05) events.push({ type: "call", audio: stretch.audio, from: s0, to: s1, at: stretch.origin + s0 })
  }
  stretch = null
}
async function seek(phone, toPos) {
  const s = await state()
  const call = s.paper.items.find((i) => i.kind === "call" && i.phone === phone)
  endStretch()
  await post("/api/advance", { seconds: Math.max(0.05, toPos - callPos(s, call)) })
  await beginStretch(phone)
}
async function untilPos(pos) {
  await until(stretch.origin + pos)
}

const dentist = "(415) 555-0199"
const gym = "(415) 555-0142"
await caption("s06-calls")
await post("/api/jump", { to: "09:00", lead: 0.4 })
await sleep(100)
say("s06-calls")
await waitFor((s) => s.paper.items.find((i) => i.phone === dentist)?.state === "in_call")
await beginStretch(dentist)
// Trim a little ringing once the narration line is done (Karen picks up at 4.2s).
await until(ends("s06-calls") + 0.2)
if (wall() - stretch.origin < 3.5) await seek(dentist, 3.6)
await untilPos(18.55)
await seek(dentist, 38.0)
say("s07-fee")
await untilPos(60.95)
await seek(dentist, 76.5)
endStretch()
await waitFor((s) => s.paper.items.find((i) => i.phone === dentist)?.state === "done")
await sleep(350)
say("s08-moved")
await until(ends("s08-moved") + 0.25)

await post("/api/advance", { seconds: 7.5 })
await caption("s09-gym")
say("s09-gym")
await waitFor((s) => s.paper.items.find((i) => i.phone === gym)?.state === "in_call")
await sleep(700)
{
  const s = await state()
  const call = s.paper.items.find((i) => i.phone === gym)
  await post("/api/advance", { seconds: (call.durationSec ?? 75) + 1 - callPos(s, call) })
}
await waitFor((s) => s.paper.items.find((i) => i.phone === gym)?.state === "done")
await until(ends("s09-gym") + 0.3)

// --- 7. Outro ---------------------------------------------------------------------------
await page.getByRole("button", { name: /Back to the paper/ }).click()
await caption("s10-outro")
await sleep(80)
say("s10-outro")
await page.evaluate(() => document.querySelector(".paper")?.scrollTo({ top: 0, behavior: "smooth" }))
await sleep(5200)
await scrollTo('[data-kind="conflict"]', 90)
await until(ends("s10-outro") + 0.8)

await cdp.send("Page.stopScreencast")
await sleep(300)
await browser.close()
writeFileSync(resolve(out, "timeline.json"), JSON.stringify({ t0, frames, events }, null, 2))
console.log(`captured ${frames.length} frames over ${(wall() - t0).toFixed(1)}s`)
