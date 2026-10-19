// Screenshot a URL: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from "playwright"
const [url, out, w = "1400", h = "900", wait = "800"] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()))
page.on("pageerror", (e) => console.log("page error:", e.message))
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(+wait)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
