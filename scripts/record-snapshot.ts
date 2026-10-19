// Record a real run for replay mode: a live night shift (Cline SDK + Qwen +
// Parallel), then both proposed calls, voiced with ElevenLabs.
// Usage: npx tsx scripts/record-snapshot.ts [--keep=<business id>,...]
//   --keep=biz_gym   reuse that call's existing recording from the current snapshot
//
// Call conversations are generated as text first and checked; only a
// conversation that passes is voiced, so ElevenLabs credits aren't spent on
// retries.
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runCall } from "../server/caller/call.js"
import { renderCall, uncachedChars } from "../server/caller/voice.js"
import { config } from "../server/config.js"
import { Engine } from "../server/engine.js"
import { MockComposio } from "../server/integrations/composio.js"
import type { CallItem } from "../server/state.js"
import type { Snapshot } from "../server/engine.js"

const keep = new Set((process.argv.find((a) => a.startsWith("--keep="))?.slice(7) ?? "").split(",").filter(Boolean))
const previousFile = resolve(config.dirs.demo, "snapshot.json")
const previous: Snapshot | null = existsSync(previousFile) ? JSON.parse(readFileSync(previousFile, "utf8")) : null

const engine = new Engine({ mode: "live", persist: false })
const log = (...a: unknown[]) => console.log(`[${engine.describeClock()}]`, ...a)

engine.jump("02:00", 0)
engine.clock.clear()
log("night shift starting (live)…")
let shown = 0
engine.store.on("change", (s) => {
  for (; shown < s.trail.length; shown++) if (s.trail[shown].status !== "active") log("  ·", s.trail[shown].text)
})
await engine.startNightShift()
const ns = engine.state.nightShift
log("night shift", ns.status, JSON.stringify(ns.stats))
if (ns.status !== "done") process.exit(1)

const calls = engine.state.paper!.items.filter((i): i is CallItem => i.kind === "call")
engine.jump("09:00", 0)
for (const call of calls) {
  const business = engine.state.dataset.businesses.find((b) => b.id === call.businessId)
  const kept = call.businessId && keep.has(call.businessId) ? previous?.calls[call.phone] : undefined
  if (kept) {
    log(`${call.business}: keeping the existing recording (${kept.durationSec.toFixed(1)}s)`)
    engine.store.update(() => {
      Object.assign(call, {
        state: "done",
        transcript: kept.transcript,
        audioUrl: `/media/demo/audio/${kept.audio}`,
        durationSec: kept.durationSec,
        outcome: kept.outcome,
      })
    })
    continue
  }
  let accepted: Awaited<ReturnType<typeof runCall>> | null = null
  for (let attempt = 1; attempt <= 3 && !accepted; attempt++) {
    // Rehearse against a copy of the data so a rejected take doesn't move events.
    const rehearsal = new MockComposio(structuredClone(engine.state.dataset), () => engine.clock.now())
    const take = await runCall({ call, business, integrations: rehearsal, now: () => engine.clock.now() })
    const spoken = take.transcript.filter((t) => t.speaker !== "tool")
    const chars = spoken.reduce((n, t) => n + t.text.length, 0)
    const disclosed = /AI assistant/i.test(spoken.find((t) => t.speaker === "bagel")?.text ?? "")
    const gendered = spoken.some((t) => t.speaker === "bagel" && /\b(he|his|him|she|her|hers|my human)\b/i.test(t.text))
    const ok = take.outcome.status === "success" && disclosed && !gendered && chars <= 1500 && spoken.length <= 16
    log(`${call.business} take ${attempt}: ${take.outcome.status}, ${spoken.length} lines, ${chars} chars, disclosed=${disclosed}, gendered=${gendered}${ok ? " ✓" : " ✗"}`)
    for (const t of take.transcript) console.log(`      ${t.speaker.padEnd(5)} ${t.text}`)
    if (ok) accepted = take
  }
  if (!accepted) throw new Error(`No acceptable take for ${call.business}`)

  // Apply the accepted outcome to the real sample data, then voice it.
  if (call.purpose === "reschedule" && call.relatedEventId && accepted.outcome.newTime) {
    await engine.integrations.execute("GOOGLECALENDAR_PATCH_EVENT", {
      calendar_id: "primary",
      event_id: call.relatedEventId,
      start_time: accepted.outcome.newTime,
    })
  }
  const voice = business?.voice ?? "dentist"
  const voices = { bagel: config.voices.bagel, them: config.voices[voice] }
  const need = uncachedChars(
    accepted.transcript.filter((t) => t.speaker !== "tool").map((t) => ({ text: t.text, voiceId: t.speaker === "bagel" ? voices.bagel : voices.them })),
  )
  log(`voicing ${call.business}: ${need} new characters`)
  const file = resolve(config.dirs.runtime, "audio", `${call.id}.mp3`)
  const rendered = await renderCall(accepted.transcript, voices, file)
  engine.store.update(() => {
    Object.assign(call, {
      state: "done",
      transcript: rendered.transcript,
      audioUrl: `/media/runtime/audio/${call.id}.mp3`,
      durationSec: rendered.durationSec,
      outcome: accepted!.outcome,
    })
  })
  log(`${call.business}: ${rendered.durationSec.toFixed(1)}s of audio`)
}

const snap = engine.saveSnapshot()
log(`saved data/demo/snapshot.json (${snap.nightShift.trail.length} trail steps, ${Object.keys(snap.calls).length} calls)`)
engine.clock.stop()
process.exit(0)
