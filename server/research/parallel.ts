// Meeting research with Parallel's Task API: a structured brief plus the
// sources behind every field.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { config } from "../config.js"

const API = "https://api.parallel.ai/v1"

export interface Brief {
  oneLiner: string
  recentNews: string[]
  keyPeople: string[]
  talkingPoints: string[]
  sources: { url: string; title?: string }[]
  runId: string
  processor: string
}

const schema = {
  type: "object",
  properties: {
    one_liner: { type: "string", description: "What the company does, in one plain sentence." },
    recent_news: {
      type: "array",
      items: { type: "string" },
      description: "Up to 3 notable developments from the last 12 months, each one short sentence starting with the month and year.",
    },
    key_people: { type: "array", items: { type: "string" }, description: "Up to 3 leaders, formatted 'Name — role'." },
    talking_points: {
      type: "array",
      items: { type: "string" },
      description: "3 short, specific questions or talking points for the meeting, tailored to the context given.",
    },
  },
  required: ["one_liner", "recent_news", "key_people", "talking_points"],
  additionalProperties: false,
}

const cacheFile = resolve(config.dirs.runtime, "parallel-cache.json")

function readCache(): Record<string, Brief> {
  try {
    return existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {}
  } catch {
    return {}
  }
}

export async function researchMeeting(
  args: { company: string; website?: string; context: string },
  opts: { processor?: string; signal?: AbortSignal; useCache?: boolean } = {},
): Promise<Brief> {
  const processor = opts.processor ?? "base"
  const key = `${args.company.toLowerCase()}|${processor}`
  if (opts.useCache !== false) {
    const hit = readCache()[key]
    if (hit) return hit
  }
  if (!config.parallelKey) throw new Error("PARALLEL_API_KEY is not set")
  const headers = { "x-api-key": config.parallelKey, "Content-Type": "application/json" }
  const input =
    `Prepare a short brief for a meeting with ${args.company}` +
    (args.website ? ` (${args.website})` : "") +
    `. Context from the attendee's calendar and inbox: ${args.context}`

  const created = await fetch(`${API}/tasks/runs`, {
    method: "POST",
    headers,
    signal: opts.signal,
    body: JSON.stringify({ input, processor, task_spec: { output_schema: { type: "json", json_schema: schema } } }),
  })
  if (!created.ok) throw new Error(`Parallel create ${created.status}: ${(await created.text()).slice(0, 200)}`)
  const run = (await created.json()) as { run_id: string }

  // The result endpoint blocks until the run finishes (or the timeout passes).
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}/tasks/runs/${run.run_id}/result?timeout=300`, { headers, signal: opts.signal })
    if (res.status === 408 || res.status === 202) continue
    if (!res.ok) throw new Error(`Parallel result ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = (await res.json()) as {
      output: { content: Record<string, unknown>; basis?: { citations?: { url: string; title?: string }[] }[] }
    }
    const c = body.output.content as {
      one_liner: string
      recent_news: string[]
      key_people: string[]
      talking_points: string[]
    }
    const seen = new Set<string>()
    const sources: Brief["sources"] = []
    for (const b of body.output.basis ?? []) {
      for (const cite of b.citations ?? []) {
        const url = cite.url.replace(/^http:\/\//, "https://")
        if (seen.has(url)) continue
        seen.add(url)
        sources.push({ url, title: cite.title })
      }
    }
    const brief: Brief = {
      oneLiner: c.one_liner,
      recentNews: c.recent_news ?? [],
      keyPeople: c.key_people ?? [],
      talkingPoints: c.talking_points ?? [],
      sources,
      runId: run.run_id,
      processor,
    }
    mkdirSync(config.dirs.runtime, { recursive: true })
    writeFileSync(cacheFile, JSON.stringify({ ...readCache(), [key]: brief }, null, 2))
    return brief
  }
  throw new Error("Parallel research timed out")
}
