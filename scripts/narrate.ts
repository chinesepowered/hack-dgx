// Voice the demo narration (demo/script.json) with ElevenLabs.
// Clips are saved to demo/narration/<id>.mp3 with a manifest; unchanged lines
// are never re-generated, so re-running costs nothing.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { config } from "../server/config.js"

interface Segment {
  id: string
  text: string
}
const root = resolve(import.meta.dirname, "..")
const script = JSON.parse(readFileSync(resolve(root, "demo/script.json"), "utf8")) as { voice: string; model: string; segments: Segment[] }
const manifestFile = resolve(root, "demo/narration/manifest.json")
const manifest: Record<string, { hash: string; duration: number }> = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : {}

let spent = 0
for (const [i, seg] of script.segments.entries()) {
  const hash = createHash("sha1").update(`${script.voice}|${script.model}|${seg.text}`).digest("hex").slice(0, 12)
  const file = resolve(root, `demo/narration/${seg.id}.mp3`)
  if (manifest[seg.id]?.hash === hash && existsSync(file)) continue
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${script.voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: seg.text,
      model_id: script.model,
      previous_text: script.segments[i - 1]?.text,
      next_text: script.segments[i + 1]?.text,
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.32, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  spent += seg.text.length
  const duration = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim(),
  )
  manifest[seg.id] = { hash, duration }
  console.log(`${seg.id}: ${duration.toFixed(2)}s`)
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
const total = script.segments.reduce((n, s) => n + (manifest[s.id]?.duration ?? 0), 0)
console.log(`narration total ${total.toFixed(1)}s · ${spent} characters voiced this run`)
