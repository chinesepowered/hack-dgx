// Minimal OpenAI-compatible chat call, used for the simulated front desk on
// Bagel's phone calls. Bagel himself always runs on the Cline SDK.
import { config } from "../config.js"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; reasoning?: "none" | "low" | "medium" } = {},
): Promise<string> {
  const body = JSON.stringify({
    model: config.llm.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 400,
    reasoning_effort: opts.reasoning ?? "none",
  })
  let lastError = ""
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.llm.apiKey}`, "Content-Type": "application/json" },
      body,
    })
    if (res.ok) {
      const data = (await res.json()) as { choices: { message: { content: string | null } }[] }
      const text = (data.choices[0]?.message?.content ?? "").trim()
      if (text) return text
      lastError = "empty completion"
      continue
    }
    lastError = `LLM ${res.status}: ${(await res.text()).slice(0, 300)}`
    if (res.status < 500 && res.status !== 429) break
  }
  throw new Error(lastError)
}
