# Dan — full context brief

*Everything a smart outsider needs to understand this product, so they can hand back good prompts, product vision, and feature ideas. Written plainly and candidly, including the parts that are still rough.*

---

## 1. The sixty-second version

Dan is an internal software tool for a territory sales rep. The rep's job is to sell a product called Pam into franchise car dealerships. Pam is an AI that answers the phone for a business: when a customer calls a dealership's sales floor or service desk and no human picks up, Pam answers, understands what they want, books the appointment or captures the lead, and does it around the clock in more than one language. Dealerships already spend heavily on advertising that turns into inbound phone calls, and a large share of those calls get missed or mishandled. A single missed sales call can be a lost car. So Pam plugs a hole the dealer can already feel.

The problem Pam has is not the product. It is distribution. There are roughly 34,000 franchise new-car rooftops across the US and Canada, and they do not buy software from a website. They buy from a person who shows up, earns a few minutes of a busy manager's attention, and makes the case. So Pam needs an army of field reps, and the reps are the bottleneck. Every hour a rep wastes deciding who to call, hunting for the right name, or fighting a CRM is an hour not spent in a conversation that books a demo.

Dan is the tool that removes that waste. It is three things stacked: a **system of record** (a cleaned, sourced census of every franchise dealership), an **intelligence layer** that tells the rep who to call, why, and what to say, and an **orchestrated outreach motion** (a compliance-first call, then text, then gift sequence) that the rep can run by hand or let Dan run on autopilot. The whole thing is built around one principle that most sales tools ignore: **trust comes from showing your source, not from asking to be trusted.** Every value Dan displays can be traced to where it came from, and the rep can flip the entire app between a polished "enriched" view and the raw scraped data underneath.

That is the product. The rest of this document is the detail.

---

## 2. The cast, and why this exists

There are several parties and they are easy to blur. Getting them straight is the whole game.

**Pam** is the company selling the AI-answers-your-phone product. It is the customer for Dan in the sense that Dan exists to make Pam's field reps effective. Pam's growth is gated by how much ground its reps can cover, so anything that multiplies rep productivity multiplies Pam's entire go-to-market.

**The territory rep** is the daily user of Dan. Picture a road warrior whose office is their car, who owns a geographic patch of dealerships, who is paid on meetings booked and deals closed, and who is not technical. Many came from car sales or field sales. They are excellent at the human part of the job and allergic to the software part. This is the single most important fact about the user, and every design decision bends to it.

**The dealership** is the target the rep is trying to win. A franchise new-car "rooftop." It has a specific org chart that matters a lot: the dealer principal or owner at the top, the general manager (GM) who runs the store and holds the budget, the general sales manager (GSM) who runs the floor, and the people who actually touch the phone all day, the BDC (business development center) manager and the internet/digital manager. Different people feel Pam's pain differently and have different authority, so knowing which door to knock on is a real edge.

**Dan** is the tool itself, personified deliberately. In the app the branding is literal: the sidebar says "Dan" and under it, "Pam's sales guy." Dan is framed as an AI teammate the rep works alongside, not a database. That framing is load-bearing: it lets the product say things like "what Dan's been doing" when the automation runs in the background.

**The person building this** is Faizan. Important meta-context for anyone giving him product advice: Dan is not a funded company with a design team. It is a very high-craft solo build, produced fast, aimed at demonstrating to the people around Pam (and adjacent applied-AI teams) that he can conceive, build, and ship a real product with real data and real judgment. The audience for the demo is senior. So the bar is not "does it work," it is "does this make a sophisticated person trust the builder." That is why honesty, provenance, and refusing to fake things matter more here than they would in a throwaway prototype. A single fabricated number in front of the wrong person undoes the whole impression.

Keep that in mind when suggesting features: the goal is not maximal feature count. It is a product that a skeptical expert opens, pokes at, and comes away thinking "this person understands the customer and does not cut corners."

---

## 3. The problem, in the rep's own terms

To generate good ideas you have to feel the rep's day, so here it is.

The rep wakes up somewhere in their territory. Before they have finished their coffee they need to know who they are calling today and why. Then they spend the day some mix of on the phone and physically driving between dealerships, walking into service drives and showrooms, asking for a manager, getting turned away, occasionally getting five real minutes with a decision-maker. Between stops they are in the car doing follow-up: a text to someone they met last week, a note to themselves, a reminder to send something. In the evening they are supposed to update the CRM, and this is the part they despise.

They despise it for a precise reason. CRMs, as reps experience them, are data-entry machines built for managers to watch reps, not tools built for reps to sell. The rep types in what they already know, into fields that do not match how the work actually happened, for a dashboard they will never look at. It gives them nothing back. So they resist it, do it late and badly, the data rots, the CRM gets less useful, and they resist it more. This is a doom loop, and it is where every rep-facing tool goes to die.

The rep's real mental model is three verbs: **find, work, track.** Find the dealership or person worth talking to today. Work the account: call, text, log what happened, move it forward. Track where everything stands so nothing slips. They do not think in "pipeline stages" or "activity logging." They think, "Who do I call, why, and what do I say." A tool that answers those three questions instantly, and asks for almost nothing back, gets used. A tool that makes them feed it first gets abandoned.

There is one more constraint that shapes everything: **compliance.** Reaching businesses by phone at scale, especially with any automated assistance, runs into real law (in the US, the TCPA and related rules; Canada has analogues). You cannot just cold-blast published lines with a sales pitch. For a company whose product is literally about phone calls, creating that kind of legal and reputational exposure would be self-defeating. So the outreach motion is designed around the compliance line, not in spite of it, and that design turns out to be an advantage rather than a tax.

---

## 4. What Dan actually is: the three pillars

**Pillar one, the system of record.** A rep cannot work an account they cannot see, and they will not trust intelligence sitting on stale data. Dan holds a clean, current picture of every rooftop in the territory: the dealership, its brand, its people, its contact history, and where the account stands right now. Crucially the rep does not build this. Dan builds and maintains it.

**Pillar two, the intelligence.** Given the record, Dan answers the morning question directly instead of dumping a sortable table on the rep. It surfaces the accounts where a touch is due, where a person was just identified, where a prior conversation left an opening. It puts the right name, role, and a real direct dial in front of the rep before the call. This is the difference between storing information and producing a decision.

**Pillar three, the outreach motion.** A specific three-step sequence: a call, then a text, then a gift. The call is an inquiry, not a pitch (details in section 6). It is designed to be lawful, humane, and effective at once, and it runs on rails so the rep does not have to reinvent it every time. The rep can execute each step by hand, or arm Dan to run the whole cadence automatically, paced so no dealership gets blasted.

None of the three works alone. A list without intelligence is a spreadsheet. Intelligence without a motion is a dashboard. A motion without a clean record spams the wrong people. The bet is that the three together, delivered to a non-technical rep in language they already use, is the shape that actually gets adopted.

---

## 5. The product, screen by screen

Dan is a working web app (Next.js). The navigation is deliberately short and named in the rep's language, not the software's. Four primary destinations, then a "Setup" section.

**Today** is the home screen and the thesis in miniature. Its one job is to answer "what do I do right now" before the coffee is finished, without gamifying anything. It leads with a single "Do this next" card: one dealership, a one-line reason it is worth calling *right now*, and a full-width Call button. Below it, "Then these" is a compact queue, each row with its own reason and call button. The reason lines are the important part: they are generated per lead and specific ("replied today, strike while it's warm"), and the queue is ordered most-overdue-first on the theory that a hot lead you have not touched is the one about to cool. Below the queue is a professional month goal card (deals closed against goal, dollars in pipeline, a plain progress bar, no streaks or confetti), and a live "what Dan's been doing" activity feed so the automation is legible rather than spooky. Empty states are honest: when there is nothing to do, it says "You're all caught up" rather than manufacturing urgency.

**Book** (the accounts list) is the full ledger, roughly 34,000 rooftops behind a fast filterable table, with List and Board (kanban) views, search, filters (brand, state, tier, has-phone, etc.), and an Export CSV that respects the current filters. This is also where the global **Enriched vs Raw** toggle is most meaningful (see section 8).

**The rooftop record** is the densest and most important screen, organized as a pre-call briefing. Top third, above a "More on this dealer" divider, is everything you need before you dial: a "Why call" card, a live Google-verified strip (rating, review count, open/closed status, verified phone), a "Who to call and why" card that names the decision-maker with a real direct dial, the outreach motion card, and a "Log a touch" control (one tap to log a call, text, or gift). Below the divider is the reference layer: identity and contact fields, a validation panel, the CRM/deal panel with the activity timeline, an "In HubSpot" overlay when the account is in the rep's connected CRM, a tech-stack card, signals, and an embedded map. Every meaningful value is provenance-wrapped (hover to see the source).

**Territory** is the location-aware screen and, for reasons in section 12, arguably the most strategically important one. Pick the city you are in and Dan clusters the dealers in that area onto a live map as numbered pins in a route order, split between "in your pipeline" and "not yet contacted," with a live "you are here" dot. Under the map, two lists: "in your pipeline, check in while you're here" and "not yet contacted, worth a stop." The pitch is "see everyone in one trip, in an efficient order." The canonical example is Denver: a rep in Denver picks it and gets one map with numbered stops, their three in-pipeline accounts plus the best untouched nearby ones, ordered so the drive makes sense.

**Prospect** is where the rep points Dan at a market. Pick a brand and an area, see a live count of how many dealers match, and launch. Dan then works each one through the call-text-gift motion, paced (one every couple of minutes, never all at once). The screen shows every dealer being worked as a row with a step stepper, a temperature chip, and a next-action line, so the autopilot is watchable at a glance.

**Connections** is where the rep wires up their own provider accounts (bring-your-own-credentials): Vapi or Bland or Twilio for voice, Twilio for text, a gifting provider, and HubSpot. Keys are encrypted at rest, each field has plain-language help, and a Test button does a real live check against the provider's API.

**Integrations** is the data-source catalog (OpenStreetMap, website enrichment, OEM locators, Google Places, HubSpot, ZoomInfo, Clay), each with a status and honest notes about cost and what it unlocks. The header is unusually candid: "Dan works great as-is, nothing else needed. Hook up your CRM or extra data whenever you want."

---

## 6. The sales motion in detail

This is the heart, and it is compliance-first on purpose. Three steps: call, then text, then gift ("treat," usually coffee and doughnuts).

**Step one is a call, and it is an inquiry, not a pitch.** The system treats these as genuinely different things. An inquiry is an AI-disclosed, no-sell informational call whose only job is to find the right person and earn permission to follow up. The opening line is fixed and honest: Dan says he is an AI named Pam, and asks whether the dealership is hiring for sales or BDC roles and who the best person to talk to is. Dealerships are almost always hiring (turnover is famously high), so this is a real question they are happy to answer, and it is not a solicitation. The person who picks up will often point the rep to a specific manager. Now the rep has a name, a role, and a warm reason they were given it.

**Steps two and three are consent-gated.** The follow-up text and the gift are blocked until consent was captured on the inquiry call. So the text (human, specific, referencing the call) cannot fire unless the dealer actually said yes, and the gift waits a couple more days behind the same gate. The whole sequence self-completes and cools off if there is no reply.

**Why this is both legal and better than cold calling.** The opening contact is a legitimate business question, not a pitch, and it produces a person effectively introduced to the rep by the dealership itself. Every later touch is directed at that named individual in that context. That is a completely different legal and human posture than blasting published lines with an automated pitch. The rep never has to hide the ball. And it is more effective, not just safer: it opens with a question the dealer wants to answer, produces a named human instead of a dead-end dial, and gives the rep a reason to follow up that the dealer handed them.

**Automatic or by hand, one timeline.** The motion can run on autopilot (Dan places the calls, sends the texts, triggers the gifts on cadence) or the rep can run each step manually. Either way, and whether the rep logs a touch by hand, everything lands on the same activity timeline on the record. There is one history per dealership, and it does not care whether a human or the AI moved it forward. This single-timeline design is the quiet backbone of the whole product: it is why "what Dan's been doing" can be honest, and why a human and an AI can share an account without stepping on each other.

**The safety rails are real and in the code.** A global kill switch. A human-initiated call lock so an autonomous run never dials a real dealership number unless it is the rep's own test line or an explicit override is set (a human clicking "Call" is what flags a real dial). A consent gate on the follow-up steps. A gift budget cap. Idempotency so a step never double-fires. And a fail-safe: if real sending is not explicitly enabled, or the rep's provider is not configured, everything routes to a simulated adapter that logs what it would do and charges nothing. You can run and demo the entire engine with no provider keys at all.

---

## 7. The data, which is where the credibility lives

The census is built from three independent classes of source, on the principle that no single source is trusted alone and a rooftop's credibility is a function of how many sources agree.

**OpenStreetMap** is the free backbone, queried for branded car dealers only (so independents and used lots without a brand tag are dropped at the source). Getting national coverage out of it is a real engineering problem (the query engine times out on big areas, so there is adaptive tiling and multiple mirrors). OSM rooftops are marked "brand not yet confirmed," because a map tag is a hint, not proof of an active franchise.

**OEM dealer locators** (Ford's official find-a-dealer, Toyota's, etc.) are authoritative when they work: a hit means a confirmed franchise. But here is a real-world wall worth understanding, because it shapes the roadmap. Most OEM locator endpoints sit behind bot protection (Akamai, AWS WAF) and simply refuse automated traffic from a normal server. The adapters are written correctly, but from a datacenter IP they mostly come back blocked. The mitigation is routing them through a residential-unblocking proxy (Bright Data's Web Unlocker), and that works, but it means OEM coverage is operationally gated on a proxy rather than being self-sufficient. This is a known limitation, not a solved problem.

**The Google Places coverage engine** is the reliable path to full coverage, because Google already holds the comprehensive business list. It enumerates rather than crawls: a geographic grid, and for each brand-and-grid-point it runs a Text Search for "{brand} dealer," dedups on Google's stable place ID, filters out service departments and body shops and other non-franchise noise, and either merges onto an existing rooftop or inserts a net-new one. It is paid (billed per request) and reports its estimated cost.

All three feed one normalized schema, then get deduplicated (an OSM record and an OEM record for the same store reconcile into one, preferring the confirmed fields), validated (phone format checked, websites probed), and tiered.

**Enrichment sits on top of coverage,** and its whole philosophy is precision-first: a wrong value is worse than a blank one, because a rep who dials a wrong number loses trust in the entire tool. Concretely:

- **Google Places live verification** gives each rooftop its rating, review count, open/closed status, and a verified phone. Roughly 80% of rooftops arrive with no phone number at all, and this is where they get one. Two correctness details matter: results are cached with a 30-day TTL (so the paid API is hit at most once a month per rooftop), and there is a hard **12-kilometer distance gate**: a location-biased search can happily return a same-brand dealer in the next town, so if the matched place is more than 12km from the rooftop's known coordinates, the match is rejected entirely. A wrong phone is worse than none.
- **ZoomInfo** turns a named decision-maker into their actual direct dial and verified email, so the rep calls the GM's cell instead of the front desk. It is metered and expensive, so it is dry-run by default, scoped, capped, and spent best-fit-first. The essential correctness requirement is domain-verified attribution: ZoomInfo can return a real person at a *different* store in the same group or metro, and stapling that person to the wrong rooftop would hand the rep a confident wrong number. (This exact failure showed up in testing, more in section 11.)
- **HubSpot reconciliation** lets a rep who already runs a HubSpot pipeline see their real deal state overlaid on Dan's rooftops. It is read-only on HubSpot (Dan never writes back) and runs under the rep's own token. The matcher is deliberately conservative: it treats a shared domain as the reliable key, refuses to match on generic words ("Auto Group") or brand words alone, rejects brand conflicts (a "Chrysler Dodge Jeep Ram" store will not match a Toyota rooftop), and excludes the city name from identity so "Jerry's Ford Alexandria" does not match "Ourisman Ford of Alexandria" on the word "Alexandria."

**Provenance and trust tiers** are the output of all this. Each rooftop carries the set of sources that confirmed it, and that becomes a trust tier: three or more independent confirmations is platinum, two is gold, one is silver, none is flagged. The tier is literally a count of how many independent systems agree the store exists as described. That is the credibility model: not "trust our database," but "here is how many independent sources agree, and here is which ones."

---

## 8. The provenance philosophy and the Raw/Enriched toggle

This is the most distinctive thing about the product and the thing to protect in any feature idea.

The principle is: **trust comes from "here's the source," not "trust us."** Sales data is normally sold on authority ("our database says this number is correct"), and reps have learned to distrust that because they have all called a "verified" number that rang a fax machine years ago. Dan does the opposite and shows its work.

Mechanically, almost every meaningful value is wrapped so that hovering it reveals exactly where it came from and when. A phone on file reads "OpenStreetMap / OEM record, as of [date]." A Google-filled phone reads "Google Places, checked live." A brand reads either "confirmed via the OEM's dealer locator" or "OpenStreetMap tag, unconfirmed." Where a source is verifiable, the tag is a clickable link (click the OSM source and it opens the map centered on the building).

The most important discipline is the **inferred-versus-sourced split.** Values Dan fetched from a real source get that source named. Values Dan computed or guessed (dealer group, group size, territory) get an explicit, honest label: "Estimated by Dan, inferred from other fields, not fetched from a source." They are never dressed up to look sourced. A rep who sees Dan admit "I guessed this one" will believe it when it says "this one is confirmed." Tools that never admit a guess get disbelieved on everything.

On top of that sits a product-wide **Enriched vs Raw** toggle in the header. Flip it and the entire app switches between Dan's cleaned, verified layer and the raw scraped source data underneath, and the choice persists. A rooftop whose name Dan normalized shows the clean name in Enriched and the original scraped string in Raw; a Google-filled phone shows in Enriched and vanishes in Raw (because the raw source genuinely did not have it). It is one product carrying both layers, not two pages. The whole point is that a skeptic, a rep or a buyer, can always drop to Raw and audit exactly what was pulled, with nothing polished on top. That is only a defensible offer because the provenance data behind it is real.

If you are generating feature ideas, the litmus test is: does this preserve the ability to answer "where did this come from," and does it keep inferred things labeled as inferred? Anything that quietly fabricates or launders a value violates the core of the product.

---

## 9. The technology, enough to know the constraints

Dan is a Next.js 15 app (App Router) in TypeScript, React server components with server actions, Tailwind and shadcn/Radix for UI. There is no separate backend service. Persistence is a single local SQLite file via better-sqlite3 (synchronous, in-process), with Drizzle layered on for typed reads. The schema is applied idempotently when the database opens rather than through a migration tool.

There is a design pattern worth knowing because it explains how the thing was built so fast without breaking: the app is really **two halves glued at a seam.** A lower "data layer" (the census: build, verify, dedup, score) and an upper "motion layer" (the outreach engine). The motion layer was added later without editing a line the data layer depended on: it created its own tables lazily, defined its own activity vocabulary, and wrote into the shared timeline through append-only writes. This "each capability owns its own tables and bootstraps itself" pattern is why features could be added or removed without a schema migration touching anyone else's data. The cost is that the schema is spread across several files rather than centralized. For a fast solo build that is a reasonable trade.

The pipeline (the thing that builds the census) is a separate command-line program with idempotent, resumable stages (ingest, normalize, dedupe, validate, enrich, discover, tier, export). The web app never runs the pipeline; the pipeline writes rows, the app reads and annotates them. That means **the data is a periodic batch, not a live feed.** The app shows whatever the last pipeline run wrote. Freshness is bounded by how often it runs, and there is no streaming update path yet.

Security and multi-tenancy: provider credentials are per-rep, encrypted at rest with AES-256-GCM, and merged over the environment at call time so "this rep's keys" is the natural unit. The schema is already keyed by rep, but there is no login yet, so today there is effectively a single implicit rep. Real multi-tenant auth is a known follow-up rather than a rewrite.

The Raw/Enriched toggle is pure CSS driven by a data attribute on the document, set before paint from local storage so there is no flash of the wrong layer.

For anyone suggesting features, the practical constraints are: it is a single-machine SQLite app, the data refreshes in batches not in real time, there is no auth yet, external data providers are rate-limited and some (OEM locators) are actively bot-blocked, and paid providers (Google Places, ZoomInfo) are metered so anything that fans out across all 34,000 rooftops has a real dollar cost that has to be scoped.

---

## 10. The design ethos

This matters as much as the features, because ideas that violate the ethos will feel wrong even if they are individually reasonable.

**Warm and calm, on purpose.** The palette is cream and clay (a warm paper ground, warm near-black ink, one terracotta accent used only to mark the single thing worth acting on). Headings are set in a serif, body in a clean sans. Motion is small and respects reduced-motion. The reason the calm is load-bearing: the rep works the app under stress, in a car, half-distracted. An anxious interface compounds an anxious moment; a calm one absorbs it.

**One hook per card, and label everything.** Every card carries exactly one idea and one decision. Nothing assumes the rep remembers what a term means, because functionally they are always a first-time viewer.

**Honesty as a design value,** expressed a few ways. *Blank beats wrong:* when Dan has no contact it says "no names yet, call the main line and ask," it does not fabricate a plausible person. *Validation never alarms without cause:* an unchecked phone shows a neutral "not yet verified," never a red "invalid," so red keeps its meaning. *No gamified cringe and no internal marketing to the rep:* no streaks, no confetti, no "you're crushing it." The tool's job is to be useful, not to convince the rep it is useful. Reps can smell internal marketing and it reads as a substitute for substance.

**Reduce cognitive load structurally.** The rep never holds state in their head. Today gives the single next action. The record answers who to call, why, and what to say. Provenance answers the doubt that would make them hesitate. One accent button per screen answers "what do I press." The measure of success is that a rep can open it in a service lane, know what to do in one glance, do it, and close it, without ever feeling managed.

---

## 11. The honest state: what works, what is rough

**What genuinely works today.** The data is real and substantial: roughly 34,700 franchise rooftops across the US and Canada, the large majority brand-confirmed and phoned (a big chunk of those phones Google-verified and backfilled where the raw sources had none), every geo-located rooftop mappable. Territory is genuinely good and is the clearest expression of "the rep is mobile, meet them where they are." The record is strong, especially the pre-call briefing and the live Google verification. The provenance system is the crown jewel and the thing a competitor cannot cheaply copy, because copying it means rebuilding your whole data stance around defensibility. The motion engine runs end to end (in simulation by default) with real safety rails.

**What is still rough,** stated plainly:

- The **franchise gate and dedup are not fully finished at 34K scale.** A small fraction of rooftops may be independents that slipped the brand filter, or near-duplicates (one physical store split into several franchise rows) that should be merged. This is the highest-leverage correctness item, because everything downstream inherits from the record quality.
- **Contacts are thin.** Only a minority of rooftops carry a named contact today. For most, "who to call" correctly falls back to "call the main line and ask," which is honest but means the who-to-call promise is only partly kept. This is where paid enrichment would move the needle most, and it is deliberately metered because a wrong contact is worse than none.
- The **consent gate is coarser than it should be** (it keys on the shared CRM status reaching "engaged" rather than a per-enrollment consent flag). This is a planned tightening before real autonomous sending at scale.
- **OEM coverage depends on a proxy** (the WAF wall described earlier).
- **No login yet**, so the per-rep isolation is designed but not enforced.

**A concrete example of the kind of bug that matters here,** because it shows the failure mode the whole product is fighting: at one point the ZoomInfo enrichment had attached contacts by loose company-name matching, and about half of the "verified" contacts on a record belonged to a *different* dealership (a Houston store showed a Dallas GM's email). That is the fastest possible trust-killer, an industry person spots it in seconds, and it is exactly the "data that does not add up" that loses the deal. It got caught in a QA pass and fixed by requiring the contact's email domain to match the rooftop. The lesson generalizes: in this product, precision and provenance are not polish, they are the product.

**On fake data specifically:** the builder is militant about it. Demo data that was seeded to populate a screen ("$18,000 in pipeline" derived from a dozen seeded enrollments) gets torn out the moment it is noticed, and empty states are made honest ("no open deals yet") rather than left showing fabricated numbers. If you suggest anything that involves pre-filling the product with plausible-but-fake activity to make it look alive, expect it to be rejected. The honest empty state is preferred to the impressive fake one, every time.

---

## 12. The current live tension, and the direction

This is the most useful section for generating prompts, because it is the active edge of the product.

There is a real strategic problem the builder just named: **the app has two home screens fighting each other.** Today is a ranked list built for a rep at a desk. Territory is a map built for a rep in a car. But the rep is in a car most of the time, so the center of gravity is arguably in the wrong place. The insight was: do not kill Today, but change what "opening the app" means so that **location decides the landing surface.** A rep who parks somewhere lands in Territory, centered on where they are, with the "while you're here" panel expanded. A rep at their desk (or at a stable home base) lands in the ranked Today list. The ranked list does not disappear; it becomes a "Priority" filter of Territory, opposite a "Nearest" filter.

Within that, the highest-value and hardest piece is the **recommended-play line**: the one sentence per nearby account that tells the rep what to do. The rule is that it must be signal-driven, never templated. If there was a reply, quote it. If the store is part of a group and another store in that group is warm, say so. If it is cold and nearby, "never touched, worth a walk-in while you're here." If Google says it is permanently closed, do not show it at all. A generic reason ("engaged, 4 days since last touch") is considered a failure. Every reason line should feel like Dan has actually been paying attention to that specific account. Roughly 80% of the value of the whole field view lives in that one line being genuinely good.

There is also a hard performance constraint baked into the vision: the field view has to render on a phone with two bars of LTE in under two seconds from a cold open, because a rep will not wait. That implies aggressive caching and a stale-then-refresh strategy.

**But here is the most important thing about how this got directed,** and it tells you a lot about how to be useful to this builder. The instruction for that whole location-decides feature ended with: *do not build this yet.* The reasoning was that it is a big enough change that it should be informed by actually watching one rep park at one dealership and open the app. Twenty minutes of real observation beats twenty hours of guessing. So instead of building, the next artifact produced was a one-page printable **ride-along field sheet**: six questions, a prediction column (write your guess before, so the gap between prediction and observation is the measurement), a timestamp rail (because the rhythm between "opens app," "taps call," and "walks in" is the real user model), and a freeform space for the unexpected. The feature gets built *after* the observation, behind a flag, shipped to that one rep first, with before-and-after screenshots on their actual phone. If what is observed contradicts the plan, the plan changes before anything ships.

That discipline (observe the real user before building, never fabricate field research, refuse to ship a confident guess) is central to how this person works and should shape any advice you give.

---

## 13. How the builder works, and what he values

If you want your prompts and ideas to land, calibrate to these.

- **Honesty over impressiveness.** He would rather show an honest empty state than an impressive fake one, and he notices fabricated data instantly and removes it. Provenance is sacred.
- **Observation before building.** He will hold a big feature to go watch a real user first. He values the "twenty minutes of watching beats twenty hours of guessing" principle, and he explicitly appreciates when the builder *refuses* to charge ahead on a guess. The honest refusal is a feature, not a failure.
- **Specific over generic.** Templated reasons, vague copy, and hand-wavy features get rejected. He wants the reason line to quote the actual reply. He wants the source shown, not asserted.
- **The rep is not technical, and is in a car.** Any idea that assumes a desk, a big screen, patience, or software literacy is probably wrong. Mobile, glanceable, one-tap, offline-tolerant is the frame.
- **He ships and iterates fast, in public (a real GitHub repo, real commits, real branches), and behind flags.** Ideas that can be shipped to one rep and measured beat grand rewrites.
- **Craft matters because the audience is senior.** This is being shown to sophisticated people. The bar is "does a skeptic trust the builder," and a single sloppy detail undoes a lot.
- **Plain writing, no em-dashes.** His copy is plain and human; the depth goes into the product and the visuals, not into ornate prose.

Good prompts he has given, as calibration: "where is any piece of data from" (which led to threading provenance through every field and the list view). "The app has two home screens fighting each other, location should decide which one you land on" (the field-view direction). "Remove fake data" (pointed at a specific fabricated number). "Do not build this before the ride-along." Notice the shape: they are specific, they name a real tension, they often carry a principle, and several of them are as much about discipline as about features.

---

## 14. Where fresh eyes actually help (prompt and feature fuel)

These are genuine open problems. Any of them is a good place for your friend to push.

**The field view and the recommended-play line.** This is the live one. What are all the signal patterns a reason line could draw from, and how do you phrase each so it sounds like a rep talking, not a template? What is the right default radius (drive-time, not straight-line)? Nearest versus Priority: is there a third mode? How do you make a phone with two bars of LTE render this in under two seconds?

**Contacts, the biggest data gap.** Most rooftops have no named person. How do you get named decision-makers cheaply and correctly at scale, and how do you present a low-confidence contact honestly (as a pattern, "email is probably first.last@", rather than a false fact)? How do you keep attribution airtight so you never staple the wrong person to a store?

**The action loop beyond intelligence.** Right now Dan tells the rep who to call and tracks what happened. The next frontier is doing things: booking the appointment into a calendar and confirming it over text or WhatsApp, as a *verifiable* action (success is defined and checkable: the event exists, the confirmation was delivered, the slot did not collide). What does trustworthy automation of a booking look like?

**Proactive intelligence.** Territory today clusters and orders. The vision is proactive: "you're in Denver, check in with these three, one just went hot, here's the optimal drive-time route." What signals make an account "worth interrupting the rep about," and how do you avoid crying wolf?

**The autonomous BDR question.** The motion engine can run itself with safety rails. How far should Dan work the top of the funnel on its own, with the rep supervising rather than executing? What controls and what legibility make a human comfortable letting it run? This is as much a governance and trust problem as a technical one.

**The dataset as a product.** The raw-plus-enriched, provenance-carrying census of North American franchise dealers is valuable to anyone selling into this market, not just Pam. Is that a product? How is it packaged, priced, kept fresh, and sold without undermining the internal tool?

**Compliance as a feature.** The inquiry motion is clever, but the full compliance posture (per-contact consent, AI disclosure on every automated touch, A2P messaging registration, honored opt-outs) could be made not just safe but a *selling point*: "the only outreach tool built for a phone company that cannot afford to spam." How would you productize that?

**Onboarding and the "does the rep even open it" question.** The whole field-view thesis assumes the rep opens the app in the parking lot. The ride-along will test that. If they do not, the entire landing-surface idea needs rethinking. What is the fallback if the honest answer is "reps wing it and update later"?

---

## 15. Guardrails: what NOT to suggest

To save your friend from proposing things that will bounce:

- **Nothing that fabricates or launders data.** No fake contacts to fill a screen, no plausible-but-invented numbers, no removing the "inferred" label to make something look sourced. Blank beats wrong.
- **No spray-and-pray.** The whole motion is built to avoid cold-blasting. Volume-over-relevance ideas cut against the core.
- **No gamification cringe.** Streaks, confetti, badges, leaderboards, "you're a rockstar." The rep is a professional here to make money.
- **Nothing that assumes a technical user at a desk with patience.** Mobile, glanceable, one-tap.
- **No grand rewrites presented as the only path.** Prefer things that ship to one rep behind a flag and get measured.
- **Do not skip the observation.** For anything that changes how the rep opens or moves through the app, the honest answer is "watch a rep first," and suggesting otherwise misreads how this person works.

---

## 16. How it actually got built (the messy reality)

It is worth knowing the real story, because it explains why the product is the shape it is and where the seams are.

Dan was built in two layers by two parallel efforts running at the same time. One effort (call it the data shell) built the census: the pipeline that scrapes OpenStreetMap, hits OEM locators, runs the Google Places coverage engine, dedups and validates and tiers, and enriches with Google, ZoomInfo, and HubSpot. The other effort (the motion shell) built everything a rep touches: the screens, the CRM layer, and the call-text-gift engine. They were deliberately architected so the motion layer could bolt onto the data layer without editing shared files, which is why the two could progress independently and merge cleanly. This is the origin of the "each capability owns its own tables" pattern described earlier. It was not academic tidiness; it was what let two workstreams run without stepping on each other.

The data itself went on a journey that is instructive. It started around 15,000 rooftops from the OSM backbone. The push to full coverage (the target was roughly 24,000, the number the industry benchmarks suggest for franchise rooftops) ran into the OEM bot-wall reality: the official locators are the authoritative source, but they are behind Akamai and AWS WAF and refuse automated traffic. A lot of effort went into proving that a residential-unblocking proxy (Bright Data's Web Unlocker) could defeat the wall, and it can, but the more reliable path turned out to be the Google Places coverage engine, which enumerated the market and pushed the census past 34,000. At one point the working database got swapped underneath the app (the fuller 34,000-row set replaced the 15,000-row snapshot the demo had been running on), which is the kind of thing that happens with parallel efforts and is worth flagging so nobody is surprised that "the number of rooftops" has moved over time. The current honest count after cleanup is about 34,748.

There was a serious quality pass late in the build, run as four independent adversarial reviews at once: one on data integrity, one walking every screen as a design lead, one reviewing the motion and integration logic for correctness, and one playing the skeptical buyer and the confused rep. That pass found real, deal-threatening problems, and they got fixed: the wrong-store ZoomInfo contacts described in section 11, a batch of fake placeholder phone numbers (like 555 numbers) that were rendering as if verified, a handful of test and non-dealership records ("Subaru Key Replacement," an emissions test center) that had crept into the sellable list, validation labels that contradicted themselves (a store showing its own brand while a red badge said "brand: invalid"), and a moment where the record page was serving but not becoming interactive because of a stale build. The point of telling you this is not the bug list. It is that the product is treated as something to be adversarially tested and made honest, not demoed on a happy path. The QA was as much about "would a skeptic catch us in a lie" as "does the button work."

The takeaway for anyone giving advice: this is a living, iterated build with real history and real seams, not a static prototype. The rooftop count has moved, the data has been cleaned in passes, and the standard applied to it is "would this survive a hostile expert opening it." Ideas that assume a pristine greenfield miss how it actually evolves, which is in flags, commits, and observed corrections.

## 17. A day in the life (so feature ideas stay grounded)

To keep ideas tethered to the real user, here is a plausible day, the kind the ride-along is meant to verify or correct.

Seven forty in the morning, the rep is at a diner near the first cluster of dealerships in their patch. They open Dan. Today shows the one account most worth a call right now and three more behind it. They tap the first, glance at the "why call" (the store replied to a text last week and went quiet), see the GM's name and direct dial, and make the call from the parking lot before going in. It rings the front desk instead of the GM's cell, so they ask for the GM by name, get told he is on the floor, and decide to just walk in since they are here.

Nine fifteen, between two stores, they are in the car. They pull up Territory because they are now thinking geographically, not by priority. They are in a specific suburb, and Dan shows the four dealers within a short drive, two they are already working and two they have never touched. They decide to hit the two they are working plus one cold one that is "worth a walk-in while you're here." They do not update anything yet; they are driving.

Eleven thirty, after a decent conversation with a GSM at the third store, they log it: one tap, "Log call," type "talked to Mike the GSM, interested but wants to see numbers, follow up Thursday," done. That single line is the entire CRM update, and it took eight seconds in a parking lot. It lands on the account's timeline next to the automated touches Dan made earlier.

Two in the afternoon, they are at lunch and briefly at a desk-like moment. They open Dan and it lands them in Today's ranked list (not Territory), because they are stationary and off their route. They clear a couple of follow-up texts, check what Dan has been doing on autopilot for the market they launched last week, and see that two dealers warmed up.

Five o'clock, done for the day. They do not open the CRM to type up their day, because they already logged as they went, and the record is current.

Every design decision should be checked against a moment in that day. The location-decides landing idea, for instance, lives or dies on whether the nine-fifteen "in the car, thinking geographically" moment and the two o'clock "stationary, thinking by priority" moment are real and distinguishable. The ride-along exists to find out.

## 18. What reps use today, and why Dan wins

To pitch features it helps to know what Dan is displacing.

Most territory reps in this world run on some combination of a spreadsheet, a generic CRM they were handed and resent, their phone's contacts and notes, paper, and memory. The spreadsheet is a static list someone exported once and that is already rotting. The CRM is where they are told to log activity for management's benefit, so they do it late and thinly. The real system of record is the rep's head and their car. Territory planning is "I know my patch," which is genuine expertise but does not scale, does not survive turnover, and does not surface the account they have not thought about in two months.

Dan wins, when it wins, on four things. First, the data is real and current and sourced, so the rep does not have to distrust it or re-verify it. Second, it answers "who and why" instead of making the rep decide from a table, which removes the single most fatiguing part of the day. Third, it takes almost nothing back: logging is a byproduct of the work, not a separate chore, which breaks the CRM doom loop. Fourth, it meets the rep in the car with a map and a route, not at a desk with a grid. The competition is not another sales tool; it is the rep's own memory and a spreadsheet, and the way to beat memory is to be more trustworthy and less effortful than memory, which is a high bar and exactly why provenance and one-tap logging matter so much.

The honest risk on the other side: reps are loyal to their own methods and skeptical of tools that have burned them. Adoption is not won by feature count; it is won by the tool being right, being fast on a bad connection, and never embarrassing them in front of a dealer with a wrong number or a dead account. That is the whole reason the product is built the way it is.

## 19. The motion, deeper

A little more mechanism, because good feature ideas often live in the details.

The canonical sequence is stored as data (a named cadence with three steps), not hard-coded, so different motions are possible later. Step one is the inquiry call with the fixed opening line (AI disclosure, the hiring question, the ask for the right person). Step two is a text a day later, gated on consent. Step three is a gift two days after that, gated on consent, with a real budget cap so autonomous gifting cannot run away with money.

The channels are pluggable and bring-your-own: voice can go through Vapi (conversational AI voice), Bland (also conversational voice), or Twilio (text-to-speech as a fallback); text goes through Twilio; gifts through a gifting platform. If nothing is configured, or if real sending is not explicitly enabled, every channel resolves to a simulated adapter that logs what it would have done and returns a fake reference, so the entire engine runs and demos with zero keys and zero spend. Test overrides are first-class: a rep can set their own number so the first "real" call and text ring their own phone, and their own address so a test gift comes to them, before anything ever touches a dealership. This "send it to yourself first" default is a deliberate safety and trust mechanism.

The scheduler runs as a repeatable tick that is safe to run twice (idempotent), and an autopilot loop that ticks on an interval and records a heartbeat the UI reads (that heartbeat is what powers the "Dan's working / Dan's paused" indicator). Inside a tick, the gates fire in order: kill switch, exit-if-the-deal-is-live, skip-if-already-sent, the human-initiated call lock, the consent gate, the budget check. Only after all of those does anything actually dispatch. Call outcomes (the transcript summary from the voice provider) sync back onto the record separately.

The interesting open questions here: the consent signal is currently coarse (it keys on the CRM status, not a dedicated per-call consent record), and a failed step is currently dropped rather than retried (a deliberate simplicity so one failure never stalls a cadence). Both are reasonable places to propose a tightening.

## 20. The data mechanics, deeper

For anyone whose ideas touch the data, the machinery in a bit more detail.

Deduplication is the quiet hard part. The same physical store can appear as an OSM record, an OEM-locator record, and a Google Places record, and a dealer group can have one website across many rooftops. Dedup uses a precedence ladder of keys (brand plus normalized street address if there is a street, else brand plus rounded coordinates, else brand plus domain, else brand plus normalized name) and runs in two passes, so an address-keyed record and a domain-only record for the same brand and domain fold together. When two records merge, the confirmed OEM fields win over the OSM guesses, "brand confirmed" is sticky, and the source lists union so provenance is preserved. This is exactly the machinery that is not yet fully run at 34,000 scale, which is why a small number of near-duplicates and stragglers remain, and why finishing it is the top correctness item.

Validation checks phone format against the record's country and probes websites for liveness. Tiering sorts rooftops into A and B by whatever signals suggest a better-fit or higher-value target. The franchise gate (keeping the list to real franchise rooftops and out the independents, service departments, body shops, and used lots) is enforced in three places working together: the OSM query only asks for branded dealers, the Google engine filters out non-franchise noise by name pattern, and only recognized OEM brands are admitted. Independents largely never enter, but the cleanup passes still catch stragglers.

The cleanup that happened in the QA pass is a good illustration of the standard. Placeholder phones (555 exchanges, "null" strings, obviously malformed numbers) were nulled rather than shown. Multi-number strings that would produce an un-dialable concatenation were reduced to the first number. Contact entries that were actually scraped button text ("Read More," "Schedule Test Drive") were stripped. A validity flag that had never been populated (making a real coverage number look artificially low) was backfilled. And a self-contradicting tooltip that claimed brand confirmation was at zero percent when the data was actually most-confirmed was corrected. The through-line: every one of those was a place where the product could have shown something that "did not add up," and each was fixed toward honesty. Feature ideas that add data should assume this bar.

## 21. A menu of ideas already on the table

To give your friend a running start, here are directions that have surfaced and are considered live, in no particular priority. They are meant to provoke, not constrain.

- **The field view** (location-decides landing, the "while you're here" primary panel, the signal-driven recommended-play line, drive-time radius, the two-second-on-bad-LTE budget), pending the ride-along.
- **Raw-versus-enriched export.** The app already toggles the whole surface between raw and enriched; extend that to the CSV export so a buyer can take either layer. This starts the dataset down the path to being a product.
- **A unified "best contact and best number" per rooftop,** resolved once and stored, so every surface (Today, Territory, the record) leads with the same person, instead of two ranking systems occasionally disagreeing.
- **Calendar and messaging booking as a verifiable action,** so Dan can actually schedule and confirm a meeting, not just recommend one.
- **Proactive nudges** ("you're near an overdue account that just went hot"), which requires stored freshness signals and a real notion of "worth interrupting the rep."
- **A supervised autonomous mode,** where Dan works the top of the funnel and the rep reviews and steps in, with the controls and legibility that make that comfortable.
- **Compliance productized,** turning the consent, disclosure, registration, and opt-out machinery into a visible selling point rather than back-end plumbing.
- **The dataset as an external product,** the provenance-carrying franchise-dealer census offered raw or enriched to others who sell into this market.
- **Real multi-tenant login,** which the schema is already built for, to turn the per-rep design into an actual multi-rep system.

Every one of these has a "how hard" and a "what it unlocks," and every one should be pressure-tested against the ethos (mobile, honest, sourced, non-gamified) and, where it changes the rep's flow, against real observation.

## 22. The reason line, in depth (the 80% problem)

Because the single sentence that tells the rep what to do with an account is where most of the value lives, and because "make it signal-driven, never templated" is easy to say and hard to do, here is a deeper treatment your friend could push on directly.

The failure mode is generic reasons: "engaged, 4 days since last touch." That is technically true and completely useless, because it describes the data model, not the account. It is the sound of a template. The rep reads it and learns nothing they could not have guessed, and worse, they learn that Dan is not actually paying attention, which quietly poisons trust in every other line. A good reason line should feel like a sharp colleague leaning over and telling you the one thing that matters about this store, in a sentence, in plain speech.

To do that you have to draw from the real signals on the account and phrase each in the rep's voice. Some concrete patterns, as a starting palette (the point is not these exact strings, it is the shape):

- **There was a reply, so quote it.** Not "engaged," but: *"texted back 'send me pricing' on Tuesday, never followed up, they're waiting on you."* The literal words the dealer used are the most valuable signal in the entire system, and they should almost always be surfaced verbatim when they exist.
- **It's group-owned and a sibling store is warm.** *"Part of the Ken Garff group; their Chevy store two towns over is already talking to us, use that as your in."* Group ownership plus another store's state is a genuinely non-obvious insight that a rep would kill for and could never compute in their head across a whole territory.
- **It's cold and you're physically near it.** *"Never touched, and you're four minutes away, worth a walk-in while you're here."* Proximity plus never-contacted is a specific, actionable combination that only makes sense in the field view.
- **A prior touch stalled at a known point.** *"You met the GSM in March, he liked it but wanted numbers, you never sent them."* This turns the timeline into a nudge about the specific unfinished thing.
- **A live signal changed.** *"Their Google rating dropped from 4.5 to 4.1 in the last month, phone handling is exactly the pain you sell against."* Real, checkable, and it hands the rep the opening argument.
- **A hard stop.** If Google says the store is permanently closed, the line is not a line at all: the account simply does not appear in the field view, because sending a rep to a dead store is the worst thing the tool can do.

The engineering underneath this is a ranked set of signal detectors, each of which, if it fires, produces both a priority contribution and a phrasing. The reason line shown is the highest-value detector that fired, rendered in its own words. The discipline is that if no meaningful detector fires, the honest line is something like "nothing specific yet, worth a first call to see what they're running," not a fabricated urgency. Blank-but-honest beats specific-but-invented.

This is a rich place for prompts and product thinking: what is the full catalog of detectors, how do you rank them against each other (recency versus proximity versus group-warmth versus a live rating drop), how do you keep the phrasing from drifting back into template-speak as the catalog grows, and how do you make sure every line is something the rep could verify if they asked "why are you telling me this," which is the same provenance principle applied to intelligence rather than to data. If your friend wants one problem to obsess over, this is the one that most changes whether the field view is a toy or a tool.

## 23. The one-paragraph brief to hand back

If your friend wants the shortest possible version to hold in their head while brainstorming: Dan is a mobile-first tool for a non-technical car-dealership sales rep who lives in their car, selling an AI-answers-your-phone product (Pam) into 34,000 franchise dealerships. It is a clean, fully-sourced census of those dealerships, plus intelligence that says who to call and why, plus a compliance-first call-text-gift outreach motion the rep can run or automate, all built on the principle that every value shows its source and nothing is faked. It works today, the data and provenance are its moat, the rough edges are contact depth and dataset finishing, and the live design question is making the app land the rep in the right screen (map versus list) based on where they physically are, with a recommended-play line good enough to feel like Dan has been paying attention. The builder values honesty, observation before building, specificity, and craft, because the real audience is sophisticated and the goal is to be trusted. Prompt him toward the field view, contacts, the action loop, and productizing compliance and the dataset, and away from anything fake, generic, or desk-bound.
