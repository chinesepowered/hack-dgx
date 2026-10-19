// Capture phone-screen screenshots for the slide deck (docs/slides/*.jpg).
// Needs the dev servers running (npm run dev). Usage: node scripts/capture-slide-shots.mjs
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright"

const root = resolve(import.meta.dirname, "..")
const base = process.env.BASE ?? "http://localhost:5173"
const out = resolve(root, "docs/slides")
mkdirSync(out, { recursive: true })
const post = (p, body = {}) =>
  fetch(`${base}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json())
const state = () => fetch(`${base}/api/state`).then((r) => r.json())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitFor = async (pred) => {
  for (let i = 0; i < 600; i++) {
    const s = await state()
    if (pred(s)) return s
    await sleep(100)
  }
  throw new Error("timed out")
}

await post("/api/reset", { mode: "replay" })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
await page.goto(base, { waitUntil: "load" })
// Shoot the bare screen; the slides draw their own phone frame.
await page.addStyleTag({
  content: ".phone{padding:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}.phone__screen{border-radius:0!important}",
})
await sleep(1200)
const shot = async (name) => {
  const png = resolve(out, `${name}.png`)
  await page.locator(".phone__screen").screenshot({ path: png })
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-q:v", "3", resolve(out, `${name}.jpg`)])
  rmSync(png)
  console.log("shot", name)
}

await page.getByRole("button", { name: /Tuck in/ }).click()
await waitFor((s) => s.nightShift.status === "done")
await sleep(900)
await page.locator(".night").evaluate((el) => el.scrollTo(0, 0))
await sleep(600)
await shot("night")

await page.getByRole("button", { name: /Wake up/ }).click()
await sleep(5600)
await shot("paper")

const s = await state()
for (const item of s.paper.items) {
  if (item.kind === "conflict" || (item.kind === "call" && item.purpose === "cancel")) await post(`/api/items/${item.id}/approve`)
}
await post("/api/jump", { to: "09:00", lead: 0.3 })
const live = await waitFor((st) => st.paper.items.some((i) => i.kind === "call" && i.state === "in_call"))
const call = live.paper.items.find((i) => i.kind === "call" && i.state === "in_call")
await post("/api/advance", { seconds: 58.2 - (live.clock.now - call.callStartedAt) / 1000 })
await sleep(1500)
await shot("call")
await browser.close()
