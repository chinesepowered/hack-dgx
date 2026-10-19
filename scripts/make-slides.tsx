/** @jsxRuntime automatic */
// Build the pitch deck: slides.html (self-contained: fonts, screenshots and
// Bagel inlined, so it works offline) and slides.pdf (one 1920x1080 page per slide).
// Usage: npm run slides   (screenshots come from scripts/capture-slide-shots.mjs)
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { chromium } from "playwright"
import { Bagel, Paw } from "../web/src/components/Bagel"

const root = resolve(import.meta.dirname, "..")
const b64 = (file: string) => readFileSync(resolve(root, file)).toString("base64")
const font = (family: string, weight: number, file: string, style = "normal") =>
  `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64(file)}) format("woff2")}`
const img = (name: string) => `data:image/jpeg;base64,${b64(`docs/slides/${name}.jpg`)}`
const svg = (el: React.ReactElement) => renderToStaticMarkup(el)

// Real numbers from the recorded run that replay mode (and the demo video) uses.
const snap = JSON.parse(readFileSync(resolve(root, "data/demo/snapshot.json"), "utf8"))
const stats = snap.nightShift.stats as { iterations: number; inputTokens: number; outputTokens: number; seconds: number }
const items = snap.nightShift.paper.items as { kind: string; sources?: unknown[]; recentNews?: string[]; talkingPoints?: string[] }[]
const brief = items.find((i) => i.kind === "brief")!
const count = (kind: string) => items.filter((i) => i.kind === kind).length
const facts = (brief.recentNews?.length ?? 0) + (brief.talkingPoints?.length ?? 0)

const fonts = [
  font("Nunito", 600, "node_modules/@fontsource/nunito/files/nunito-latin-600-normal.woff2"),
  font("Nunito", 700, "node_modules/@fontsource/nunito/files/nunito-latin-700-normal.woff2"),
  font("Nunito", 800, "node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2"),
  font("Fraunces", 600, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2"),
  font("Fraunces", 700, "node_modules/@fontsource/fraunces/files/fraunces-latin-700-normal.woff2"),
  font("Fraunces", 600, "node_modules/@fontsource/fraunces/files/fraunces-latin-600-italic.woff2", "italic"),
  font("UnifrakturMaguntia", 400, "node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2"),
].join("\n")

const paw = (color: string, size = 30) => svg(<Paw size={size} color={color} />)
const phone = (shot: string, alt: string) =>
  `<figure class="device"><img src="${img(shot)}" alt="${alt}"></figure>`

const css = /* css */ `
${fonts}
:root{--ink:#2b211b;--muted:#7a6a5c;--paper:#fbf6ec;--card:#fffdf8;--rule:#e2d6c1;--brand:#e8743b;--brand-dark:#c95d27;
--gold:#ffd166;--night-1:#12143a;--night-2:#262063;--night-3:#46378a;--green:#2f9e6e;--blue:#4f6bed;
--serif:"Fraunces",Georgia,serif;--ui:"Nunito",system-ui,sans-serif;--bl:"UnifrakturMaguntia","Fraunces",serif}
*{box-sizing:border-box}
html,body{margin:0;background:#0d0c14;font-family:var(--ui);color:var(--ink);-webkit-font-smoothing:antialiased}
.deck{position:fixed;inset:0;display:grid;place-items:center;overflow:hidden}
.slide{position:absolute;width:1920px;height:1080px;overflow:hidden;background:var(--paper);transform-origin:center;display:none}
.slide.on{display:block}
.counter{position:fixed;right:22px;bottom:16px;color:#8d89a8;font:700 14px var(--ui);letter-spacing:1px;z-index:5}
.hint{position:fixed;left:22px;bottom:16px;color:#5b5873;font:700 13px var(--ui);z-index:5;transition:opacity .6s}
.hint.gone{opacity:0}
p{text-wrap:pretty}
.kicker{font:800 26px var(--ui);letter-spacing:5px;text-transform:uppercase;color:var(--brand)}
h1,h2{font-family:var(--serif);font-weight:700;margin:0;text-wrap:balance;letter-spacing:-.5px}
h2{font-size:84px;line-height:1.02}
em{font-family:var(--serif);font-style:italic;font-weight:600}
.chip{display:inline-flex;align-items:center;gap:10px;border-radius:999px;padding:10px 22px;font:800 24px var(--ui);white-space:nowrap}

/* Bagel's little animations (paused for print) */
.bagel{overflow:visible;display:block}
.bagel__bob{animation:bob 2.6s ease-in-out infinite;transform-origin:120px 230px}
.bagel__tail{transform-origin:152px 204px;animation:wag .5s ease-in-out infinite alternate}
.bagel__ear--l{transform-origin:72px 76px;animation:earL 2.8s ease-in-out infinite}
.bagel__ear--r{transform-origin:168px 76px;animation:earR 2.8s ease-in-out infinite}
.bagel__eyes{transform-origin:120px 99px;animation:blink 4.6s infinite}
.bagel--proud .bagel__eyes{animation:none}
.bagel--sniff .bagel__head{transform-origin:120px 150px;animation:sniff .9s ease-in-out infinite}
.bagel__beam{animation:beam 2.2s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-3px)}}
@keyframes wag{from{transform:rotate(-10deg)}to{transform:rotate(14deg)}}
@keyframes earL{50%{transform:rotate(4deg)}}
@keyframes earR{50%{transform:rotate(-4deg)}}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes sniff{0%,100%{transform:rotate(0)}30%{transform:rotate(-3deg) translateY(3px)}60%{transform:rotate(2deg) translateY(2px)}}
@keyframes beam{50%{opacity:.35}}

/* phone mockup */
.device{margin:0;padding:11px;border-radius:52px;background:linear-gradient(145deg,#2d2b33,#0d0c10);
box-shadow:0 0 0 2px #45424d inset,0 40px 70px -24px rgba(30,20,60,.55),0 16px 30px -16px rgba(0,0,0,.45)}
.device img{display:block;width:100%;border-radius:42px}

/* 1 — title */
.s-title{background:radial-gradient(circle at 22% 46%,rgba(124,108,255,.38),transparent 34%),linear-gradient(160deg,var(--night-1),var(--night-2) 58%,var(--night-3));color:#fff}
.stars{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;
box-shadow:120px 120px #fff,340px 80px #ffe7a3,620px 200px #fff,880px 110px #cfd5ff,1180px 70px #fff,1460px 150px #fff,1700px 90px #ffe7a3,1840px 300px #fff,
90px 420px #fff,260px 690px #cfd5ff,520px 930px #fff,760px 820px #fff,1040px 980px #ffe7a3,1320px 900px #fff,1600px 1000px #cfd5ff,1860px 760px #fff,
1500px 560px #fff,1250px 400px #cfd5ff,980px 330px #fff,40px 980px #fff}
.moon{position:absolute;right:150px;top:110px;width:120px;height:120px;border-radius:50%;background:#fff3c4;box-shadow:0 0 70px 20px rgba(255,236,170,.32),inset -22px -12px 0 0 #f0dc9a}
.s-title .hero{position:absolute;left:120px;top:150px;width:700px;height:760px;display:grid;place-items:center}
.s-title .hero::before{content:"";position:absolute;inset:60px 40px 10px;border-radius:50%;background:radial-gradient(circle,rgba(255,209,102,.22),transparent 62%)}
.s-title .copy{position:absolute;left:860px;right:100px;top:236px}
.s-title .kicker{color:var(--gold)}
.s-title h1{font-size:128px;line-height:.98;margin:22px 0 30px}
.s-title .lede{font:600 40px/1.38 var(--ui);color:#d9dcff;margin:0 0 44px;max-width:900px}
.rituals{display:flex;gap:14px}
.rituals .chip{border:2.5px solid rgba(255,209,102,.55);color:var(--gold);background:rgba(255,209,102,.07);font-size:23px;padding:10px 20px}
.rituals .chip b{color:#fff}
.s-title .open{margin-top:30px;font:700 24px var(--ui);color:#c9cdf5;letter-spacing:.2px;white-space:nowrap}
.s-title .foot{position:absolute;left:130px;bottom:58px;font:700 24px var(--ui);color:#a9add9;letter-spacing:.4px}
.s-title .foot b{color:#fff}

/* 2 — the gap */
.s-gap{background:radial-gradient(circle at 92% 8%,rgba(255,209,102,.25),transparent 30%),var(--paper)}
.s-gap .left{position:absolute;left:120px;top:120px;width:820px}
.s-gap h2{margin:22px 0 34px}
.s-gap h2 em{color:var(--brand)}
.s-gap .body{font:600 38px/1.45 var(--ui);color:#4b3d33;margin:0}
.notes{position:absolute;left:1010px;right:110px;top:110px;display:flex;flex-direction:column;gap:20px}
.note{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:6px 18px;background:var(--card);border:2px solid var(--rule);border-radius:22px;padding:20px 26px;
box-shadow:0 3px 0 rgba(43,33,27,.07)}
.note:nth-child(odd){transform:rotate(-.7deg)}.note:nth-child(even){transform:rotate(.6deg) translateX(18px)}
.note .ico{grid-row:span 2;font-size:46px;text-align:center}
.note q{font:700 34px/1.2 var(--serif);quotes:"“" "”"}
.note span{font:700 23px var(--ui);color:var(--muted)}
.punch{position:absolute;left:120px;bottom:90px;width:820px;background:var(--ink);color:#fff;border-radius:28px;padding:34px 40px;font:700 36px/1.4 var(--ui)}
.punch b{color:var(--gold)}
.s-gap .dog{position:absolute;left:770px;bottom:40px}

/* 3 — a day with Bagel */
.s-day{background:var(--paper)}
.s-day .top{position:absolute;left:100px;top:64px;right:100px;display:flex;align-items:baseline;gap:34px}
.s-day h2{font-size:76px}
.cols{position:absolute;left:90px;right:90px;top:192px;bottom:40px;display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
.col{position:relative;border-radius:40px;padding:26px 28px 0;display:flex;flex-direction:column;align-items:center}
.col--night{background:linear-gradient(170deg,var(--night-1),var(--night-3));color:#fff}
.col--morning{background:linear-gradient(170deg,#ffd6a6,#fff1dd 70%)}
.col--call{background:linear-gradient(170deg,#dfe3ff,#f4efff 70%)}
.col .time{align-self:flex-start;display:flex;align-items:center;gap:14px;font:800 30px var(--ui)}
.col .time small{font:800 20px var(--ui);letter-spacing:3px;text-transform:uppercase;opacity:.75}
.col--night .time small{color:var(--gold);opacity:1}
.col h3{align-self:flex-start;font:700 38px/46px var(--serif);margin:6px 0 16px;white-space:nowrap}
.col .device{width:276px}
.col ul{align-self:stretch;list-style:none;margin:16px 0 0;padding:0;font:700 21px/1.3 var(--ui)}
.col li{display:flex;gap:10px;margin:6px 0}
.col li::before{content:"🐾";font-size:15px;line-height:27px}
.col--night ul{color:#dcdfff}
.bark{font-family:var(--bl);font-weight:400;font-size:46px;line-height:46px}

/* 4 — under the hood */
.s-hood{background:linear-gradient(180deg,#fff7ec,var(--paper))}
.s-hood .top{position:absolute;left:120px;top:84px}
.s-hood h2{margin-top:16px;font-size:76px}
.mid{position:absolute;left:120px;right:120px;top:290px;display:grid;grid-template-columns:1030px 1fr;gap:56px}
.flow{display:flex;flex-direction:column;gap:22px}
.stage{display:grid;grid-template-columns:150px 1fr;gap:22px;align-items:stretch}
.stage .when{border-radius:22px;display:grid;place-content:center;text-align:center;font:800 30px/1.1 var(--ui);color:#fff}
.stage .when small{display:block;font:800 16px var(--ui);letter-spacing:2px;opacity:.8;margin-top:6px;text-transform:uppercase}
.w1{background:linear-gradient(160deg,var(--night-1),var(--night-3))}.w2{background:linear-gradient(160deg,#ff9f68,#ffc46b);color:#3d1d0c!important}.w3{background:linear-gradient(160deg,#5c6ef8,#8d7bff)}
.box{background:var(--card);border:2px solid var(--rule);border-radius:22px;padding:20px 26px}
.box h4{margin:0 0 12px;font:800 28px var(--ui)}
.box h4 span{font:700 21px var(--ui);color:var(--muted);margin-left:8px}
.tools{display:flex;flex-wrap:wrap;gap:8px}
.tool{display:inline-flex;align-items:center;gap:8px;border-radius:10px;padding:5px 11px;font:700 18px ui-monospace,SFMono-Regular,Menlo,monospace;background:#f3eee5;color:var(--ink)}
.tool i{font:800 13px var(--ui);font-style:normal;border-radius:6px;padding:2px 7px;letter-spacing:.3px}
.p-composio{background:#2d2a5e;color:#c9c4ff}.p-parallel{background:#111;color:#fff}.p-cline{background:#3a2a1f;color:#ffc59b}.p-eleven{background:#23423a;color:#9ff0cf}
.nums{display:flex;flex-direction:column;justify-content:space-between;gap:14px}
.num{background:var(--ink);color:#fff;border-radius:24px;padding:16px 26px}
.num b{display:block;font:700 46px/1.05 var(--serif);color:var(--gold)}
.num span{font:700 20px/1.35 var(--ui);color:#e8e2d8}
.trust{position:absolute;left:120px;right:120px;bottom:50px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.trust .chip{background:#e7f6ee;color:#22603f;border:2px solid #bfe5d1}
.trust small{font:700 19px var(--ui);color:var(--muted);margin-left:auto}

/* 5 — why every day */
.s-why{background:radial-gradient(circle at 85% 70%,rgba(255,209,102,.35),transparent 32%),var(--paper)}
.s-why .top{position:absolute;left:120px;top:96px;width:1150px}
.s-why h2{margin-top:18px}
.pillars{position:absolute;left:120px;top:372px;width:1150px;display:grid;grid-template-columns:1fr 1fr;gap:18px 20px}
.pillar{display:grid;grid-template-columns:56px 1fr;gap:4px 18px;align-items:start;align-content:start;background:var(--card);border:2px solid var(--rule);border-radius:24px;padding:22px 26px;box-shadow:0 3px 0 rgba(43,33,27,.07)}
.pillar .ico{grid-row:span 2;font-size:44px;line-height:1.1}
.pillar h3{font:700 32px/1.1 var(--serif);margin:0 0 6px}
.pillar p{font:700 21px/1.4 var(--ui);color:#5e4f43;margin:0}
.next{position:absolute;left:120px;top:772px;width:1150px}
.shift{display:grid;grid-template-columns:64px 1fr;gap:4px 18px;align-items:center;background:var(--ink);color:#fff;border-radius:24px;padding:20px 28px}
.shift .ico{grid-row:span 2;font-size:48px}
.shift b{font:700 30px var(--serif);color:var(--gold)}
.shift b small{font:800 16px var(--ui);letter-spacing:3px;color:#ffb68a;margin-left:14px;vertical-align:5px}
.shift span{font:700 21px/1.4 var(--ui);color:#e8e2d8}
.shift code{font:700 19px ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff}
.next .row{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
.next .chip{background:#fff;border:2px dashed #c9b9a2;color:var(--ink);font-size:21px;padding:8px 16px}
.s-why .dog{position:absolute;right:140px;top:190px}
.s-why .sign{position:absolute;right:100px;top:640px;width:560px;text-align:center;font:700 40px/1.2 var(--serif);text-wrap:balance}
.s-why .sign small{display:block;margin-top:14px;font:800 24px var(--ui);color:var(--brand);letter-spacing:1px}

@media print{
  @page{size:1920px 1080px;margin:0}
  html,body{background:none}
  .deck{position:static;display:block}
  .slide{display:block!important;position:relative;transform:none!important;page-break-after:always;break-after:page}
  .counter,.hint{display:none}
  *{animation:none!important}
}
`

const slides = [
  // 1 — Title
  `<section class="slide s-title" data-title="Bagel works the night shift">
    <div class="stars"></div><div class="moon"></div>
    <div class="hero">${svg(<Bagel pose="happy" headlamp size={560} />)}</div>
    <div class="copy">
      <div class="kicker">An agent you'll use every day</div>
      <h1>Bagel works the night shift.</h1>
      <p class="lede">A beagle who preps tomorrow while you sleep, and makes the calls you dread.</p>
      <div class="rituals">
        <span class="chip">🌙 <b>2 AM</b> night shift</span>
        <span class="chip">🗞️ <b>7 AM</b> The Morning Bark</span>
        <span class="chip">📞 <b>9 AM</b> awkward calls</span>
      </div>
      <div class="open">🔓 Open source, open weights · 💻 Runs on your machine · 🧠 Your choice of model</div>
    </div>
    <div class="foot">Built with <b>Cline SDK</b> · <b>Qwen 3.8</b> on W&amp;B Inference · <b>Parallel</b> · <b>ElevenLabs</b> · <b>Composio</b>-ready</div>
  </section>`,

  // 2 — The gap
  `<section class="slide s-gap" data-title="The gap">
    <div class="left">
      <div class="kicker">The gap</div>
      <h2>Personal agents wait to be asked. <em>Your day doesn't.</em></h2>
      <p class="body">Muse and Instinct are great at errands, when you remember to ask. What drains a day is everything nobody thinks to ask for.</p>
    </div>
    <div class="notes">
      <div class="note"><span class="ico">🦴</span><q>I'll send the deck by Tuesday.</q><span>a promise you made</span></div>
      <div class="note"><span class="ico">⏳</span><q>Redlines by Monday EOD.</q><span>a promise you're owed, now overdue</span></div>
      <div class="note"><span class="ico">☕</span><q>Coffee: Parallel × Larkspur</q><span>a first meeting, zero prep</span></div>
      <div class="note"><span class="ico">⚠️</span><q>2:00 PM investor update. 2:00 PM dentist.</q><span>double-booked</span></div>
      <div class="note"><span class="ico">📞</span><q>Cancellations by phone only.</q><span>the gym you haven't visited since August</span></div>
    </div>
    <div class="punch">An agent you use <b>every day</b> can't wait to be asked. It has to show up on its own, with the work already done.</div>
  </section>`,

  // 3 — A day with Bagel
  `<section class="slide s-day" data-title="One day with Bagel">
    <div class="top"><div class="kicker">The product</div><h2>One day with Bagel</h2></div>
    <div class="cols">
      <div class="col col--night">
        <div class="time">🌙 2:00 AM <small>The night shift</small></div>
        <h3>Clocks in while you sleep</h3>
        ${phone("night", "Bagel's night shift trail")}
        <ul><li>Reads tomorrow's calendar and inbox</li><li>Tracks every promise, both ways</li><li>Researches first meetings, lines up calls</li></ul>
      </div>
      <div class="col col--morning">
        <div class="time">☀️ 7:00 AM <small>Delivered</small></div>
        <h3><span class="bark">The Morning Bark</span></h3>
        ${phone("paper", "The Morning Bark")}
        <ul><li>Drafts with the right file attached</li><li>Nudges, a cited brief, a conflict fix</li><li>One tap each. Nothing sent without you</li></ul>
      </div>
      <div class="col col--call">
        <div class="time">📞 9:00 AM <small>When they open</small></div>
        <h3>Makes the awkward calls</h3>
        ${phone("call", "Bagel on the phone")}
        <ul><li>Says he's an AI, checks your calendar</li><li>Dentist moved to Thu 4 PM, $50 fee waived</li><li>Gym cancelled, retention offers declined</li></ul>
      </div>
    </div>
  </section>`,

  // 4 — Under the hood
  `<section class="slide s-hood" data-title="Under the hood">
    <div class="top"><div class="kicker">How it works</div><h2>A Cline SDK agent with a night job</h2></div>
    <div class="mid">
    <div class="flow">
      <div class="stage"><div class="when w1">2:00<small>AM</small></div>
        <div class="box"><h4>Night-shift agent <span>Cline SDK · Qwen 3.8 on W&amp;B, or any model you choose</span></h4>
          <div class="tools">
            <span class="tool"><i class="p-composio">Composio</i>GMAIL_FETCH_EMAILS</span>
            <span class="tool"><i class="p-composio">Composio</i>GOOGLECALENDAR_EVENTS_LIST</span>
            <span class="tool"><i class="p-composio">Composio</i>GOOGLEDRIVE_FIND_FILE</span>
            <span class="tool"><i class="p-parallel">Parallel</i>research_meeting · Task API</span>
            <span class="tool"><i class="p-cline">Cline tool</i>record_promise · record_conflict · propose_call</span>
          </div></div></div>
      <div class="stage"><div class="when w2">7:00<small>AM</small></div>
        <div class="box"><h4>You, one tap each <span>The Morning Bark</span></h4>
          <div class="tools">
            <span class="tool"><i class="p-composio">Composio</i>GMAIL_SEND_EMAIL</span>
            <span class="tool"><i class="p-cline">Bagel</i>schedule calls for opening time</span>
          </div></div></div>
      <div class="stage"><div class="when w3">9:00<small>AM</small></div>
        <div class="box"><h4>Bagel on the phone <span>Cline SDK agent · ElevenLabs voices</span></h4>
          <div class="tools">
            <span class="tool"><i class="p-composio">Composio</i>GOOGLECALENDAR_FIND_FREE_SLOTS</span>
            <span class="tool"><i class="p-composio">Composio</i>GOOGLECALENDAR_PATCH_EVENT</span>
            <span class="tool"><i class="p-eleven">ElevenLabs</i>Bagel + front desk voices</span>
          </div></div></div>
    </div>
    <div class="nums">
      <div class="num"><b>${stats.seconds} s</b><span>overnight run · ${stats.iterations} agent turns · ${(stats.inputTokens / 1000).toFixed(1)}k tokens in</span></div>
      <div class="num"><b>${facts} facts · ${brief.sources?.length ?? 0} sources</b><span>one Parallel Task run for the 10:30 coffee</span></div>
      <div class="num"><b>${count("promise")} promises · ${count("call")} calls</b><span>and ${count("conflict")} double-booking, found while you slept</span></div>
      <div class="num"><b>$50 → $0</b><span>late fee waived on the call · gym cancelled, no fees</span></div>
    </div>
    </div>
    <div class="trust">
      <span class="chip">✓ Draft-first: nothing sent without a tap</span>
      <span class="chip">✓ Open source, runs on your machine</span>
      <span class="chip">✓ Composio tool shapes: one swap to real accounts</span>
      <small>Demo: sample inbox &amp; calendar · the phone's front desk is a simulated voice</small>
    </div>
  </section>`,

  // 5 — Why every day + next
  `<section class="slide s-why" data-title="Why every day">
    <div class="top"><div class="kicker">Why you'd use it every day</div><h2>It shows up. It does the work. <em>It asks first.</em></h2></div>
    <div class="pillars">
      <div class="pillar"><div class="ico">🔁</div><h3>A ritual, not a prompt</h3><p>2 AM, 7 AM, 9 AM. Bagel comes to you, so there's nothing to remember to ask.</p></div>
      <div class="pillar"><div class="ico">🦴</div><h3>Done, not summarized</h3><p>Drafts with attachments, cited briefs, appointments actually moved.</p></div>
      <div class="pillar"><div class="ico">🛡️</div><h3>Safe by default</h3><p>One tap to send, AI disclosure on every call, read-only overnight.</p></div>
      <div class="pillar"><div class="ico">🔓</div><h3>Yours, not theirs</h3><p>Open source, runs on open-weights models (Qwen 3.8 today), lives on your machine. Swap in any model, even one you run locally. Muse and Instinct are closed.</p></div>
    </div>
    <div class="next">
      <div class="shift"><span class="ico">🛠️</span><b>Your backlog<small>NEXT SHIFT</small></b>
        <span>Overnight, Bagel hands the GitHub issues you've labeled to Cline (or <code>claude -p</code>) on your machine, each in its own branch. By 7 AM there's a draft PR with the tests run. You still tap to merge.</span></div>
      <div class="row">
        <span class="chip">📞 Real phone lines</span>
        <span class="chip">🔌 Real Gmail &amp; Calendar via Composio</span>
        <span class="chip">💬 The Morning Bark in Telegram</span>
      </div>
    </div>
    <div class="dog">${svg(<Bagel pose="proud" frisbee size={400} />)}</div>
    <div class="sign">Bagel does the work, so you can go play frisbee with your dog.<small>${paw("#e8743b", 22)} GOOD BOY</small></div>
  </section>`,
]

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bagel · Pitch</title>
<style>${css}</style>
</head>
<body>
<main class="deck">
${slides.join("\n")}
</main>
<div class="counter"></div>
<div class="hint">← → to move · F for full screen</div>
<script>
const slides=[...document.querySelectorAll(".slide")];
const counter=document.querySelector(".counter");
const hint=document.querySelector(".hint");
setTimeout(()=>hint.classList.add("gone"),5000);
let i=Math.min(Math.max(parseInt(location.hash.slice(1)||"1",10)-1,0),slides.length-1);
function fit(){const s=Math.min(innerWidth/1920,innerHeight/1080);slides.forEach(el=>el.style.transform="scale("+s+")")}
function show(n){if(n!==i)hint.classList.add("gone");i=Math.min(Math.max(n,0),slides.length-1);slides.forEach((el,k)=>el.classList.toggle("on",k===i));counter.textContent=(i+1)+" / "+slides.length;history.replaceState(null,"","#"+(i+1))}
addEventListener("resize",fit);
addEventListener("keydown",e=>{
  if(["ArrowRight","PageDown"," ","Enter"].includes(e.key)){e.preventDefault();show(i+1)}
  else if(["ArrowLeft","PageUp","Backspace"].includes(e.key)){e.preventDefault();show(i-1)}
  else if(e.key==="Home")show(0);else if(e.key==="End")show(slides.length-1);
  else if(e.key==="f"||e.key==="F"){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
});
addEventListener("click",e=>{if(e.target.closest("a"))return;show(i+(e.clientX>innerWidth/2?1:-1))});
fit();show(i);
</script>
</body>
</html>
`

writeFileSync(resolve(root, "slides.html"), html)
console.log(`slides.html: ${(html.length / 1024).toFixed(0)} KB, ${slides.length} slides`)

// PDF: one 1920x1080 page per slide, plus PNG previews for review.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(`file://${resolve(root, "slides.html")}`)
await page.evaluate(() => document.fonts.ready)
if (process.argv.includes("--previews")) {
  await page.addStyleTag({ content: ".hint{display:none}" })
  for (let n = 1; n <= slides.length; n++) {
    await page.evaluate((k) => {
      location.hash = String(k)
      dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }))
      for (let j = 1; j < k; j++) dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    }, n)
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(root, `data/runtime/slide-${n}.png`) })
  }
}
await page.emulateMedia({ media: "print" })
await page.pdf({ path: resolve(root, "slides.pdf"), width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log("slides.pdf written")
