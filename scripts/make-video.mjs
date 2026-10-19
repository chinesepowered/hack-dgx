// Assemble the demo video from scripts/record-video.mjs output:
// frames -> 30 fps H.264, narration + call audio mixed at their logged times.
// Usage: node scripts/make-video.mjs [out.mp4]
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const work = resolve(root, "data/runtime/video")
const outFile = resolve(root, process.argv[2] ?? "demo/bagel-demo.mp4")
const tl = JSON.parse(readFileSync(resolve(work, "timeline.json"), "utf8"))
const frames = [...tl.frames].sort((a, b) => a.ts - b.ts)
const T0 = frames[0].ts
// Hold the last frame briefly, but keep the cut within three minutes.
const total = Math.min(frames.at(-1).ts - T0 + 0.6, Number(process.env.MAX_SECONDS ?? 179.9))

// --- picture ------------------------------------------------------------------
const list = []
frames.forEach((f, i) => {
  const next = frames[i + 1]?.ts ?? f.ts + 0.6
  list.push(`file '${f.file}'`, `duration ${Math.max(next - f.ts, 0.001).toFixed(4)}`)
})
list.push(`file '${frames.at(-1).file}'`)
writeFileSync(resolve(work, "frames.txt"), list.join("\n"))
const silentVideo = resolve(work, "picture.mp4")
execFileSync(
  "ffmpeg",
  ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", resolve(work, "frames.txt"), "-t", total.toFixed(3), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", silentVideo],
  { stdio: "inherit" },
)

// --- sound ------------------------------------------------------------------
const inputs = []
const chains = []
const add = (file, filters) => {
  inputs.push("-i", file)
  const idx = inputs.length / 2 // input 0 is the picture
  chains.push(`[${idx}:a]${filters}[a${idx}]`)
}
for (const e of tl.events) {
  const at = Math.max(0, e.at - T0)
  const delay = Math.round(at * 1000)
  if (e.type === "narration") {
    add(resolve(root, `demo/narration/${e.id}.mp3`), `aresample=44100,aformat=channel_layouts=stereo,adelay=${delay}|${delay},volume=1.0`)
  } else if (e.type === "call") {
    const file = resolve(root, "data", e.audio.replace(/^\/media\//, ""))
    const len = e.to - e.from
    add(
      file,
      `atrim=start=${e.from.toFixed(3)}:end=${e.to.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,` +
        `afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, len - 0.08).toFixed(3)}:d=0.08,adelay=${delay}|${delay},volume=0.95`,
    )
  }
}
const n = chains.length
const mix =
  `${chains.join(";")};` +
  `${Array.from({ length: n }, (_, i) => `[a${i + 1}]`).join("")}amix=inputs=${n}:normalize=0:dropout_transition=0,` +
  `loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=end=${total.toFixed(3)}[aout]`

execFileSync(
  "ffmpeg",
  ["-y", "-v", "error", "-i", silentVideo, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outFile],
  { stdio: "inherit" },
)
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", outFile]).toString().trim()
console.log(`wrote ${outFile} (${probe}) from ${frames.length} frames, ${tl.events.filter((e) => e.type === "narration").length} narration lines, ${tl.events.filter((e) => e.type === "call").length} call clips`)
