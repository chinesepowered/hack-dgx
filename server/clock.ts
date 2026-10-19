// A demo clock: real time by default, but it can jump to 2:00 AM or 9:00 AM so a
// whole night shift fits in a three-minute demo. Jobs fire when the clock
// passes their due time, whether it got there by waiting or by jumping.
export interface Job {
  id: string
  dueAt: number
  label: string
  run: () => Promise<void> | void
  status: "pending" | "running" | "done" | "failed"
}

export class DemoClock {
  private baseReal = Date.now()
  private baseDemo = Date.now()
  private jobs: Job[] = []
  private timer: NodeJS.Timeout

  constructor(private onTick: () => void = () => {}) {
    this.timer = setInterval(() => this.tick(), 250)
  }

  now(): number {
    return this.baseDemo + (Date.now() - this.baseReal)
  }

  set(ms: number) {
    this.baseReal = Date.now()
    this.baseDemo = ms
    this.tick()
  }

  schedule(job: Omit<Job, "status">): Job {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    const full: Job = { ...job, status: "pending" }
    this.jobs.push(full)
    return full
  }

  cancel(id: string) {
    this.jobs = this.jobs.filter((j) => j.id !== id)
  }

  pending(): Job[] {
    return this.jobs.filter((j) => j.status === "pending").sort((a, b) => a.dueAt - b.dueAt)
  }

  clear() {
    this.jobs = []
  }

  private tick() {
    const now = this.now()
    for (const job of this.jobs) {
      if (job.status !== "pending" || job.dueAt > now) continue
      job.status = "running"
      Promise.resolve()
        .then(() => job.run())
        .then(() => (job.status = "done"))
        .catch((err) => {
          job.status = "failed"
          console.error(`[clock] job ${job.label} failed:`, err)
        })
    }
    this.onTick()
  }

  stop() {
    clearInterval(this.timer)
  }
}
