// Voices for Bagel's calls (ElevenLabs), mixed into one recording with ffmpeg:
// ringback tone, Bagel's clean line, the front desk filtered like a phone line.
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import { config } from "../config.js"
import type { Turn } from "../state.js"

const run = promisify(execFile)
const ttsCache = resolve(config.dirs.runtime, "tts")

export async function tts(text: string, voiceId: string, model = config.ttsModel): Promise<string> {
  mkdirSync(ttsCache, { recursive: true })
  const key = createHash("sha1").update(`${voiceId}|${model}|${text}`).digest("hex").slice(0, 16)
  const file = join(ttsCache, `${key}.mp3`)
  if (existsSync(file)) return file
  if (!config.elevenKey) throw new Error("ELEVENLABS_API_KEY is not set")
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

export function uncachedChars(lines: { text: string; voiceId: string }[], model = config.ttsModel): number {
  return lines
    .filter(({ text, voiceId }) => {
      const key = createHash("sha1").update(`${voiceId}|${model}|${text}`).digest("hex").slice(0, 16)
      return !existsSync(join(ttsCache, `${key}.mp3`))
    })
    .reduce((n, l) => n + l.text.length, 0)
}

const SR = 44100

async function toWav(input: string, output: string, filter: string) {
  await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-af", filter, "-ar", String(SR), "-ac", "1", "-c:a", "pcm_s16le", output])
}

async function lavfi(output: string, graph: string, seconds: number) {
  await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", graph, "-t", String(seconds), "-ar", String(SR), "-ac", "1", "-c:a", "pcm_s16le", output])
}

async function duration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
  return parseFloat(stdout.trim())
}

/**
 * Voice a call transcript and mix it into one MP3. Returns the transcript with
 * start/end times (seconds) so the UI can follow along with the audio.
 */
export async function renderCall(
  transcript: Turn[],
  voices: { bagel: string; them: string },
  outFile: string,
): Promise<{ transcript: Turn[]; durationSec: number }> {
  const work = `${outFile}.parts`
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const parts: string[] = []
  let t = 0
  const add = async (file: string) => {
    parts.push(file)
    t += await duration(file)
  }
  const silence = async (sec: number) => {
    const f = join(work, `sil_${parts.length}.wav`)
    await lavfi(f, `anullsrc=r=${SR}:cl=mono`, sec)
    await add(f)
  }

  // Two rings of US ringback (440 Hz + 480 Hz), then pick-up.
  const ring = join(work, "ring.wav")
  await lavfi(ring, `aevalsrc='0.12*sin(2*PI*440*t)+0.12*sin(2*PI*480*t)':s=${SR}`, 1.4)
  await add(ring)
  await silence(0.8)
  parts.push(ring)
  t += 1.4
  await silence(0.6)

  const out: Turn[] = []
  for (const [i, turn] of transcript.entries()) {
    if (turn.speaker === "tool") {
      out.push({ ...turn, start: t, end: t })
      await silence(0.7)
      continue
    }
    const mp3 = await tts(turn.text, turn.speaker === "bagel" ? voices.bagel : voices.them)
    const wav = join(work, `turn_${i}.wav`)
    const filter =
      turn.speaker === "them"
        ? "highpass=f=300,lowpass=f=3400,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,volume=1.6"
        : "acompressor=threshold=-18dB:ratio=2:attack=5:release=100,volume=1.1"
    await toWav(mp3, wav, filter)
    const start = t
    await add(wav)
    out.push({ ...turn, start, end: t })
    await silence(0.35)
  }

  const list = join(work, "list.txt")
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"))
  mkdirSync(resolve(outFile, ".."), { recursive: true })
  await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-b:a", "128k", outFile])
  rmSync(work, { recursive: true, force: true })
  return { transcript: out, durationSec: await duration(outFile) }
}

export function audioExists(file: string): boolean {
  return existsSync(file) && readFileSync(file).length > 1000
}
