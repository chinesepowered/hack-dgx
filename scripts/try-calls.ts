// Run Bagel's proposed calls from the last try-nightshift run, text only.
// Usage: npx tsx scripts/try-calls.ts [callIndex]
import { readFileSync } from "node:fs"
import { runCall } from "../server/caller/call.js"
import { MockComposio } from "../server/integrations/composio.js"
import { localISO } from "../server/lib/time.js"
import type { AppState, CallItem } from "../server/state.js"
import { config } from "../server/config.js"

const state = JSON.parse(readFileSync(`${config.dirs.runtime}/try-nightshift.json`, "utf8")) as AppState
const calls = state.paper!.items.filter((i): i is CallItem => i.kind === "call")
const which = process.argv[2] ? [calls[Number(process.argv[2])]] : calls
const t0Real = Date.now()
const t0Demo = Date.parse(localISO(state.dataset.tomorrow, "09:00"))
const now = () => t0Demo + (Date.now() - t0Real)
const integrations = new MockComposio(state.dataset, now)

for (const call of which) {
  console.log(`\n=== ${call.business} (${call.purpose}) ===`)
  const t = Date.now()
  const res = await runCall({
    call,
    business: state.dataset.businesses.find((b) => b.id === call.businessId),
    integrations,
    now,
    onTurn: (turn) => console.log(`${turn.speaker === "bagel" ? "BAGEL" : turn.speaker === "them" ? "DESK " : "  ·  "} ${turn.text}`),
  })
  console.log("outcome:", JSON.stringify(res.outcome), `(${((Date.now() - t) / 1000).toFixed(0)}s)`)
  const chars = res.transcript.filter((x) => x.speaker !== "tool").reduce((n, x) => n + x.text.length, 0)
  console.log("voiced characters:", chars)
}
