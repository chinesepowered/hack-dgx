// Run one night shift outside the server and print what Bagel produced.
// Usage: npx tsx scripts/try-nightshift.ts [YYYY-MM-DD]
import { writeFileSync, mkdirSync } from "node:fs"
import { runNightShift } from "../server/agent/nightshift.js"
import { MockComposio } from "../server/integrations/composio.js"
import { buildDataset } from "../server/integrations/dataset.js"
import { localISO, prettyTime, todayYMD } from "../server/lib/time.js"
import { Store } from "../server/state.js"
import { config } from "../server/config.js"

const today = process.argv[2] ?? todayYMD()
const dataset = buildDataset(today)
const t0Real = Date.now()
const t0Demo = Date.parse(localISO(dataset.tomorrow, "02:00"))
const now = () => t0Demo + (Date.now() - t0Real)

const store = new Store({
  mode: "live",
  dataset,
  nightShift: { status: "idle" },
  trail: [],
  paper: null,
  activity: [],
  streak: 11,
})
const integrations = new MockComposio(dataset, now, (a) => store.update((s) => s.activity.push(a)))

let printed = 0
store.on("change", (s) => {
  for (; printed < s.trail.length; printed++) {
    const t = s.trail[printed]
    console.log(`  ${prettyTime(t.at)}  [${t.kind}] ${t.text}`)
  }
})

await runNightShift({ store, integrations, now })
const s = store.state
console.log("\nnight shift:", JSON.stringify(s.nightShift))
console.log("\nfinal trail:")
for (const t of s.trail) console.log(`  [${t.status}] ${t.kind}: ${t.text}${t.detail ? ` — ${t.detail}` : ""}`)
console.log("\npaper:", JSON.stringify(s.paper, null, 2))
mkdirSync(config.dirs.runtime, { recursive: true })
writeFileSync(`${config.dirs.runtime}/try-nightshift.json`, JSON.stringify(s, null, 2))
