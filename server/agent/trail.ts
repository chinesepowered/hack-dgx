// Turns the agent's tool calls into Bagel's paw-print trail.
import { newId, type Store, type TrailKind } from "../state.js"

export class Trail {
  private byCall = new Map<string, string>()
  private doneText = new Map<string, { text: string; detail?: string }>()

  constructor(
    private store: Store,
    private now: () => number,
  ) {}

  add(
    kind: TrailKind,
    text: string,
    detail?: string,
    status: "active" | "done" | "error" = "done",
    tool?: { name: string; args: string },
  ): string {
    const id = newId("step")
    this.store.update((s) => s.trail.push({ id, at: this.now(), kind, text, detail, status, tool: tool?.name, args: tool?.args }))
    return id
  }

  start(callId: string, kind: TrailKind, text: string, tool?: { name: string; args: string }) {
    this.byCall.set(callId, this.add(kind, text, undefined, "active", tool))
  }

  /** Called from inside a tool once it knows how things went. */
  result(callId: string | undefined, text: string, detail?: string) {
    if (callId) this.doneText.set(callId, { text, detail })
  }

  finish(callId: string, fallback: string, isError = false) {
    const stepId = this.byCall.get(callId)
    if (!stepId) return
    const done = this.doneText.get(callId)
    this.store.update((s) => {
      const step = s.trail.find((t) => t.id === stepId)
      if (!step) return
      step.text = done?.text ?? fallback
      step.detail = done?.detail
      step.status = isError ? "error" : "done"
      step.at = this.now()
    })
  }
}
