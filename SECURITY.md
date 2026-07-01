# Security & Compliance — Dan

Dan holds **personal contact data (PII)** and **licensed third-party data**. This documents how it's protected and the obligations that come with the data.

## 1. Access control (auth gate)
- The entire app is behind a **login gate** (`middleware.ts` + `/login`). No page renders without a valid session cookie.
- Active whenever `APP_PASSWORD` is set in `.env`. **Set it before deploying anywhere.**
- **Internal-tool grade today** (single shared team password, httpOnly session cookie, 12h expiry). **Production TODO:** per-user SSO (Google Workspace / Okta), real session management, audit logging of who viewed/exported what.

## 2. DNC enforcement (TCPA) — ENFORCED
- ZoomInfo flags numbers on the **federal Do-Not-Call registry**. Dialing one is real liability (**$500–$1,500 per call** under the TCPA).
- In the current CA/TX/FL data: **2,899 mobiles + 547 direct dials are DNC-flagged.**
- The tool **does not offer one-tap dialing for a DNC number.** Flagged numbers render as a red **"DO NOT CALL"** control (`components/dnc-call.tsx`) that requires explicit confirmation before it will dial.
- **TODO:** extend the guard to the Call list + any automated sequence/dialer (a sequence engine must hard-block DNC numbers, not just warn).

## 3. Data licensing — OBLIGATION, READ BEFORE DISTRIBUTING
- **ZoomInfo** and **HubSpot** data is licensed under contractual terms tied to the seat/account it came from. It generally **may not be redistributed, resold, or used outside the licensed organization.**
- **Do not** export this data to third parties, ship it in a product to other companies, or use it beyond the licensed GTM purpose without confirming the contract allows it.
- Google Places & OpenStreetMap data have their own attribution/usage terms (OSM = ODbL).
- **Action:** confirm the ZoomInfo/HubSpot license scope before this data leaves the team that owns those seats.

## 4. PII & secrets handling
- Personal data (names, direct dials, emails) lives in `data/dealerships.sqlite` (gitignored). **Not committed.**
- API keys/tokens live in `.env` (gitignored, verified). **Never commit `.env`.** Rotate any key/token that was ever pasted into chat or shared.
- **Production TODO:** encryption at rest for the DB, restricted file permissions, and a deletion/retention policy for contact data (people change jobs; stale PII is a liability).

## 5. Outreach compliance (when sequencing is enabled)
- Calls/texts must honor DNC + TCPA (consent, calling hours, opt-out).
- Email outreach must honor CAN-SPAM (unsubscribe, sender identity).
- The autonomous sequence engine must enforce these as hard gates, not advisories.
