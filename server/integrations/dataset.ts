// Sample data for Bagel's demo world. Every record is shaped like the payloads
// Composio returns for Gmail, Google Calendar and Google Drive, so swapping this
// file for a live Composio session is a data-source change, not a rewrite.
import { addDays, localISO, prettyDay, weekdayOf, TZ } from "../lib/time.js"

export const persona = {
  name: "Jordan Lee",
  firstName: "Jordan",
  email: "jordan@larkspur.example",
  company: "Larkspur Labs",
  role: "founder & CEO of a 6-person startup building AI scheduling for clinics",
  city: "San Francisco",
  phoneOnFile: "(415) 555-0123",
  zip: "94110",
  timezone: TZ,
}

export interface GmailMessage {
  messageId: string
  threadId: string
  labelIds: string[]
  sender: string
  to: string
  cc?: string
  subject: string
  messageText: string
  messageTimestamp: string
  preview: { subject: string; body: string }
  attachmentList: { filename: string; mimeType: string }[]
}

export interface CalendarEvent {
  kind: "calendar#event"
  id: string
  status: "confirmed" | "cancelled"
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  attendees?: { email: string; displayName?: string; self?: boolean; responseStatus: string }[]
  organizer: { email: string; self?: boolean }
  htmlLink: string
}

export interface DriveFile {
  kind: "drive#file"
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  webViewLink: string
  owners: { displayName: string; emailAddress: string }[]
}

export interface Business {
  id: string
  name: string
  phone: string
  opens: string
  closes: string
  voice: "dentist" | "gym"
  staffer: { name: string; style: string }
  policy: string
}

export interface Dataset {
  today: string // the evening Bagel starts the night shift (YYYY-MM-DD)
  tomorrow: string
  messages: GmailMessage[]
  events: CalendarEvent[]
  files: DriveFile[]
  businesses: Business[]
}

const me = `${persona.name} <${persona.email}>`

function mail(
  id: string,
  at: string,
  from: string,
  to: string,
  subject: string,
  body: string,
  labels: string[],
  opts: { thread?: string; cc?: string; attachments?: { filename: string; mimeType: string }[] } = {},
): GmailMessage {
  return {
    messageId: id,
    threadId: opts.thread ?? `thr_${id}`,
    labelIds: labels,
    sender: from,
    to,
    cc: opts.cc,
    subject,
    messageText: body.trim(),
    messageTimestamp: at,
    preview: { subject, body: body.trim().replace(/\s+/g, " ").slice(0, 120) },
    attachmentList: opts.attachments ?? [],
  }
}

function event(
  id: string,
  day: string,
  start: string,
  end: string,
  summary: string,
  extra: Partial<Pick<CalendarEvent, "description" | "location" | "attendees">> = {},
): CalendarEvent {
  return {
    kind: "calendar#event",
    id,
    status: "confirmed",
    summary,
    description: extra.description,
    location: extra.location,
    start: { dateTime: localISO(day, start), timeZone: TZ },
    end: { dateTime: localISO(day, end), timeZone: TZ },
    attendees: [
      { email: persona.email, displayName: persona.name, self: true, responseStatus: "accepted" },
      ...(extra.attendees ?? []),
    ],
    organizer: { email: persona.email, self: true },
    htmlLink: `https://calendar.google.com/calendar/event?eid=${id}`,
  }
}

export function buildDataset(today: string): Dataset {
  const d = (n: number) => addDays(today, n)
  const at = (n: number, hhmm: string) => localISO(d(n), hhmm)
  const tomorrow = d(1)
  const wd = (n: number) => weekdayOf(d(n))

  const messages: GmailMessage[] = [
    // --- Sent mail: promises Jordan made -----------------------------------
    mail(
      "msg_s1",
      at(-3, "16:42"),
      me,
      "Maya Chen <maya@northwindhealth.example>",
      "Re: Northwind pilot — next steps",
      `Hi Maya,

Great call today — really glad the pilot numbers are landing with your team.

I'll send over the Q3 pilot metrics deck by ${wd(1)} so you have it before ${wd(2)}'s renewal review.

Best,
Jordan`,
      ["SENT"],
      { thread: "thr_northwind" },
    ),
    mail(
      "msg_s2",
      at(-5, "11:20"),
      me,
      "Alex Rivera <alex@bluebirdlegal.example>",
      "MSA redlines",
      `Hi Alex,

Attaching the latest MSA draft (v3). Could you send your redlines when you get a chance? We're hoping to sign with Northwind next week.

Thanks!
Jordan`,
      ["SENT"],
      { thread: "thr_msa", attachments: [{ filename: "Larkspur MSA v3.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }] },
    ),
    mail(
      "msg_s3",
      at(-2, "21:10"),
      me,
      "Priya Lee <priya.lee@family.example>",
      "Re: Mom's 60th 🎉",
      `Hey Priya — leave it to me, I'll book dinner for Mom's birthday on Saturday. Thinking Italian? I'll confirm the place by ${wd(2)}.

J`,
      ["SENT"],
      { thread: "thr_mom" },
    ),

    // --- Inbox ---------------------------------------------------------------
    mail(
      "msg_r1",
      at(-4, "09:15"),
      "Alex Rivera <alex@bluebirdlegal.example>",
      me,
      "Re: MSA redlines",
      `Hi Jordan,

Thanks for sending this over. I'll get the redlines back to you by ${wd(0)} EOD.

Best,
Alex Rivera
Bluebird Legal`,
      ["INBOX"],
      { thread: "thr_msa" },
    ),
    mail(
      "msg_r2",
      at(-4, "14:02"),
      "Dana Wu <dana@larchvc.example>",
      `${me}, Parallel partnerships <partnerships@parallel.example>`,
      "Intro: Jordan (Larkspur) <> Parallel",
      `Hi both — making the intro I promised.

Jordan is building Larkspur's scheduling agent and already leans on Parallel's search API. Parallel folks: Jordan is one of the sharpest founders in my portfolio. I'll let you take it from here — coffee seems right!

Dana`,
      ["INBOX"],
      { thread: "thr_intro" },
    ),
    mail(
      "msg_r3",
      at(-3, "09:05"),
      "Bright Smile Dental <frontdesk@brightsmile.example>",
      me,
      `Appointment reminder — ${wd(1)} at 2:00 PM`,
      `Hi Jordan,

This is a reminder of your cleaning with Dr. Patel on ${prettyDay(d(1))} at 2:00 PM.

Need to reschedule? Please call us at (415) 555-0199 — our front desk opens at 9:00 AM. Changes with less than 24 hours' notice may incur a $50 late-change fee.

Bright Smile Dental · 2140 Mission St`,
      ["INBOX", "CATEGORY_UPDATES"],
    ),
    mail(
      "msg_r4",
      at(-2, "08:00"),
      "FlexFit Mission <billing@flexfit.example>",
      me,
      `Your FlexFit membership renews ${wd(4)}`,
      `Hi Jordan,

Your FlexFit Mission membership (Member ID FF-20931, $89/month) renews on ${prettyDay(d(4))}.

We noticed you haven't checked in since August 14 — we miss you! 💪

Need to make changes? Memberships can be cancelled by phone only, during staffed hours (9am–8pm): (415) 555-0142.

See you soon,
The FlexFit Team`,
      ["INBOX", "CATEGORY_UPDATES"],
    ),
    mail(
      "msg_r5",
      at(-2, "10:30"),
      "Dana Wu <dana@larchvc.example>",
      me,
      "Board deck template",
      `Jordan — I'll send you our board deck template by ${wd(3)}. For tomorrow's update the usual metrics are perfect.

D`,
      ["INBOX"],
    ),
    mail(
      "msg_r6",
      at(-1, "17:20"),
      "Maya Chen <maya@northwindhealth.example>",
      me,
      "Re: Northwind pilot — next steps",
      `Thanks Jordan! Looking forward to the deck ${wd(1)} — our VP of Ops wants to go through it before ${wd(2)}'s renewal meeting.

Maya`,
      ["INBOX", "UNREAD"],
      { thread: "thr_northwind" },
    ),
    mail(
      "msg_r7",
      at(-1, "20:45"),
      "Priya Lee <priya.lee@family.example>",
      me,
      "Re: Mom's 60th 🎉",
      `You're the best sibling. Mom says she'd love Italian 🍝 Let me know once it's booked!

— Priya (your sister)`,
      ["INBOX", "UNREAD"],
      { thread: "thr_mom" },
    ),
    mail(
      "msg_r8",
      at(0, "06:00"),
      "The Pragmatic Founder <newsletter@pragmaticfounder.example>",
      me,
      "#214: Pricing your first enterprise deal",
      `This week: why your first enterprise contract should be priced like your tenth, plus three negotiation scripts.`,
      ["INBOX", "CATEGORY_PROMOTIONS"],
    ),
    mail(
      "msg_r9",
      at(0, "07:12"),
      "LinkedIn <notifications@linkedin.example>",
      me,
      "You appeared in 9 searches this week",
      `See who's looking at your profile.`,
      ["INBOX", "CATEGORY_SOCIAL"],
    ),
  ]

  const team = [
    { email: "sam@larkspur.example", displayName: "Sam Ortiz", responseStatus: "accepted" },
    { email: "ines@larkspur.example", displayName: "Inés Garza", responseStatus: "accepted" },
  ]

  const events: CalendarEvent[] = [
    // Tomorrow — the day Bagel preps for
    event("evt_standup", d(1), "09:30", "09:45", "Team standup", { attendees: team }),
    event("evt_parallel", d(1), "10:30", "11:15", "Coffee: Parallel × Larkspur", {
      location: "Sightglass Coffee, 270 7th St",
      description: "Intro via Dana Wu (Larch Ventures). First meeting with the Parallel Web Systems team (parallel.ai).",
      attendees: [{ email: "partnerships@parallel.example", displayName: "Parallel Web Systems", responseStatus: "accepted" }],
    }),
    event("evt_investor", d(1), "14:00", "15:00", "Monthly investor update — Larch Ventures", {
      description: "Video call with Dana. Metrics + Q4 hiring plan.",
      attendees: [{ email: "dana@larchvc.example", displayName: "Dana Wu", responseStatus: "accepted" }],
    }),
    event("evt_dentist", d(1), "14:00", "14:45", "Dentist — cleaning (Bright Smile)", {
      location: "Bright Smile Dental, 2140 Mission St",
      description: "Front desk: (415) 555-0199",
    }),
    event("evt_1on1", d(1), "16:30", "17:00", "1:1 with Sam", { attendees: [team[0]] }),
    // Rest of the week (used when Bagel checks free slots mid-call)
    event("evt_design", d(2), "10:00", "12:00", "Design review", { attendees: team }),
    event("evt_interview", d(2), "15:00", "16:00", "Final interview — founding engineer", { attendees: team }),
    event("evt_offsite", d(3), "09:00", "12:00", "Planning offsite", { attendees: team }),
    event("evt_onsite", d(3), "13:00", "15:30", "Customer onsite — Northwind Health", {
      attendees: [{ email: "maya@northwindhealth.example", displayName: "Maya Chen", responseStatus: "accepted" }],
    }),
    event("evt_boardprep", d(4), "09:30", "10:30", "Board prep with Dana", {
      attendees: [{ email: "dana@larchvc.example", displayName: "Dana Wu", responseStatus: "accepted" }],
    }),
    event("evt_lunch", d(4), "12:00", "13:00", "Lunch with Sam", { attendees: [team[0]] }),
  ]

  const files: DriveFile[] = [
    {
      kind: "drive#file",
      id: "file_q3deck",
      name: "Northwind — Q3 pilot metrics.pdf",
      mimeType: "application/pdf",
      modifiedTime: at(-1, "15:10"),
      webViewLink: "https://drive.google.com/file/d/file_q3deck/view",
      owners: [{ displayName: persona.name, emailAddress: persona.email }],
    },
    {
      kind: "drive#file",
      id: "file_msa",
      name: "Larkspur MSA v3.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      modifiedTime: at(-5, "11:02"),
      webViewLink: "https://drive.google.com/file/d/file_msa/view",
      owners: [{ displayName: persona.name, emailAddress: persona.email }],
    },
    {
      kind: "drive#file",
      id: "file_hiring",
      name: "Q4 hiring plan",
      mimeType: "application/vnd.google-apps.spreadsheet",
      modifiedTime: at(-2, "18:30"),
      webViewLink: "https://docs.google.com/spreadsheets/d/file_hiring",
      owners: [{ displayName: persona.name, emailAddress: persona.email }],
    },
  ]

  const businesses: Business[] = [
    {
      id: "biz_dental",
      name: "Bright Smile Dental",
      phone: "(415) 555-0199",
      opens: "09:00",
      closes: "17:00",
      voice: "dentist",
      staffer: { name: "Karen", style: "warm, efficient front-desk coordinator; friendly but it's a busy morning" },
      policy: `- AI assistants calling on behalf of a patient are fine.
- Verify the patient with full name and the phone number on file, ${persona.phoneOnFile}.
- Jordan Lee has a cleaning with Dr. Patel on ${prettyDay(d(1))} at 2:00 PM. Jordan has been a patient since 2019.
- Changes with less than 24 hours' notice normally cost a $50 late-change fee. Mention the fee once. If the caller politely asks for a one-time courtesy waiver, waive it ("just this once").
- Open cleaning slots with Dr. Patel: ${prettyDay(d(2))} at 11:00 AM, ${prettyDay(d(3))} at 4:00 PM, ${prettyDay(d(4))} at 8:30 AM. Offer two at a time.
- Once a new time is agreed, confirm it and say a confirmation text will go to the number on file.`,
    },
    {
      id: "biz_gym",
      name: "FlexFit Mission",
      phone: "(415) 555-0142",
      opens: "09:00",
      closes: "20:00",
      voice: "gym",
      staffer: { name: "Tyler", style: "upbeat membership advisor; genuinely nice but trained to save every membership" },
      policy: `- AI assistants calling on behalf of a member are fine as long as you can verify the account.
- Verify with the member's name plus either Member ID FF-20931 or the ZIP code on file, ${persona.zip}.
- The membership is $89/month and renews ${prettyDay(d(4))}. Last check-in: August 14.
- Before cancelling you must try to save the membership: first offer 50% off for the next 3 months. If declined, offer a freeze at $10/month.
- If both offers are declined, process the cancellation effective before the renewal, with no cancellation fee. Give confirmation number CX-4471 and say a confirmation email is on its way.`,
    },
  ]

  return { today, tomorrow, messages, events, files, businesses }
}
