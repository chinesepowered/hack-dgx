import "dotenv/config"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

export const config = {
  root,
  port: Number(process.env.PORT ?? 8787),
  llm: {
    // Qwen 3.8 on W&B Inference (OpenAI-compatible). Any OpenAI-compatible endpoint works.
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.inference.wandb.ai/v1",
    apiKey: process.env.WANDB_API_KEY ?? process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "Qwen/Qwen3.8-27B",
  },
  parallelKey: process.env.PARALLEL_API_KEY ?? "",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  voices: {
    bagel: process.env.VOICE_BAGEL ?? "bIHbv24MWmeRgasZH58o", // Will: relaxed, optimistic
    dentist: process.env.VOICE_DENTIST ?? "XrExE9yKIg1WjnnlVkGX", // Matilda: upbeat, professional
    gym: process.env.VOICE_GYM ?? "TX3LPaxmHKxFdv7VOQHJ", // Liam: energetic
    narrator: process.env.VOICE_NARRATOR ?? "cgSgspJ2msm6clMCkdW9", // Jessica: young, bright, warm
  },
  ttsModel: process.env.TTS_MODEL ?? "eleven_multilingual_v2",
  dirs: {
    runtime: resolve(root, "data/runtime"),
    demo: resolve(root, "data/demo"),
    web: resolve(root, "web/dist"),
  },
}

export function missingKeys(): string[] {
  const missing: string[] = []
  if (!config.llm.apiKey) missing.push("WANDB_API_KEY")
  if (!config.parallelKey) missing.push("PARALLEL_API_KEY")
  if (!config.elevenKey) missing.push("ELEVENLABS_API_KEY")
  return missing
}
