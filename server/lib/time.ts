// Small timezone helpers. Bagel's world runs on Jordan's local time.
export const TZ = "America/Los_Angeles"

export function tzOffset(date: Date, tz = TZ): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")!.value // e.g. "GMT-07:00"
  return part === "GMT" ? "+00:00" : part.replace("GMT", "")
}

/** "2026-10-20" + "14:00" -> "2026-10-20T14:00:00-07:00" */
export function localISO(ymd: string, hhmm: string, tz = TZ): string {
  const off = tzOffset(new Date(`${ymd}T12:00:00Z`), tz)
  return `${ymd}T${hhmm}:00${off}`
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function ymdOf(ms: number, tz = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
}

export function hhmmOf(ms: number, tz = TZ): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms))
}

export function todayYMD(tz = TZ): string {
  return ymdOf(Date.now(), tz)
}

export function weekdayOf(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${ymd}T12:00:00Z`))
}

/** Human label like "Tue, Oct 20" */
export function prettyDay(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${ymd}T12:00:00Z`))
}

/** Human label like "2:00 PM" for an ISO timestamp, in Jordan's timezone */
export function prettyTime(iso: string | number, tz = TZ): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso))
}

/** Parse an RFC3339 timestamp; timestamps without Z or an offset are read in `tz` (like Composio does). */
export function parseTime(value: string, tz = TZ): number {
  const v = value.trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) return Date.parse(v)
  const m = v.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return Date.parse(v)
  return Date.parse(localISO(m[1], `${m[2] ?? "00"}:${m[3] ?? "00"}`, tz))
}
