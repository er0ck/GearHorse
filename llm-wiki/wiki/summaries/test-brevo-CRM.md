---
title: "Summary: Nightly-testing a Carrd → Brevo signup"
type: source
tags: [testing, brevo, carrd, playwright, github-actions, api-testing, ci-cd, gearhorse]
created: 2026-04-16
updated: 2026-04-16
sources: 1
---

# Summary: Nightly-testing a Carrd → Brevo signup

Source: `sources/test-brevo-CRM.md`

Technical guide (April 2026) for testing the full Carrd → Brevo signup pipeline. Covers architecture, Brevo API contract, test isolation strategy, CAPTCHA reality, and GitHub Actions scheduling. The approach described supersedes the Notion-centric CI pattern from [[summary: testing-carrd-make-notion-github-actions]] for stacks where Brevo is the CRM target.

---

## How the Carrd → Brevo pipeline actually works

Carrd's "Signup via Brevo" form is **not** a Brevo embed. The Brevo API key and list ID are stored server-side in Carrd's form builder. When a visitor submits, the browser POSTs to a Carrd handler (e.g. `*.carrd.co/r/...`); Carrd's backend calls `POST https://api.brevo.com/v3/contacts`. The browser never touches `api.brevo.com` directly.

Consequence for testing: Playwright cannot intercept the Brevo API call. Verification must happen after the fact via a separate `GET /v3/contacts/{email}` call with polling for eventual consistency.

---

## Brevo API fundamentals

- Base URL: `https://api.brevo.com/v3`
- Auth: lowercase `api-key` header (not `Authorization: Bearer`)
- Rate limit: 10 req/s, 36,000/hr on free tier
- Email must be `encodeURIComponent`-encoded on every path call — `+` decodes to a space without it, producing silent 404s
- All reads must be wrapped in a poll loop; `GET` immediately after `POST` can 404 for several seconds (eventual consistency)
- No true sandbox for contacts. `X-Sib-Sandbox: drop` only affects `POST /v3/smtp/email`

Key endpoints:

| Action | Request |
|---|---|
| Create/upsert | `POST /v3/contacts` with `updateEnabled: true` |
| Verify | `GET /v3/contacts/{encodeURIComponent(email)}` |
| List test contacts | `GET /v3/contacts?filter=equals(IS_TEST_CONTACT,true)` |
| Delete | `DELETE /v3/contacts/{encodeURIComponent(email)}` → 204 |
| Create attribute | `POST /v3/contacts/attributes/normal/{NAME}` |

---

## Pre-flight: create Brevo attributes once

Missing attributes are silently dropped by `POST /v3/contacts` — this is the #1 cause of "UTMs missing from Brevo" bugs. Must be created once in Brevo UI or via curl before any test or production form submission:

`UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_TERM`, `UTM_CONTENT`, `SITE_URL`, `SITE_FORM` (all `type: text`) and `IS_TEST_CONTACT`, `SMS_OPT_IN` (`type: boolean`).

---

## Test isolation strategy (three layers)

1. **Unique email per run** using plus-addressing and random hex suffix: `founder+e2e-${Date.now()}-${randomHex}@domain.com`. Parallel workers in the same millisecond need the random suffix.
2. **`IS_TEST_CONTACT: true` attribute on every test write** — enables a Brevo segment to permanently exclude test contacts from all campaign audiences, and lets a weekly cleanup script find stragglers.
3. **`updateEnabled: true` on every create** — makes tests idempotent; a re-run with the same email updates instead of returning 400.
4. **`finally` block delete** — primary cleanup. Does not run on CI cancellation, so layers 1–2 act as fallback.

---

## Two-tier test architecture

**API-only test (runs every push, ~2s):** Bypasses Carrd entirely. Uses a `brevo-client.ts` helper to create a contact directly via the Brevo API with the full attribute set, verify it exists, assert attribute values, then delete. Catches: revoked API key, missing attribute, Brevo schema change, list ID drift.

**Playwright E2E (runs nightly, ~30–60s):** Navigates to the Carrd test URL with UTM query params, fills email, submits, waits for the success UI, then polls `GET /v3/contacts/{email}` until the contact appears with correct UTM attributes. Catches: Carrd form regression, UTM capture breakage, submission flow changes.

The source's guidance: run both. The API-only test catches ~80% of real failures with near-zero flakiness. Add E2E when paid ad spend means a broken form has immediate financial cost.

---

## CAPTCHA: reCAPTCHA claim is incorrect

Carrd does NOT use Google reCAPTCHA. Its default spam protection is server-side heuristics (honeypot field, timing signals). Cloudflare Turnstile is an optional upgrade. Headless Playwright typically passes the default protection; Turnstile will block it.

**Note:** This contradicts existing wiki pages. See [[Honeypot Spam Protection]] for the corrected page.

**Clean solution for E2E testing against Carrd with spam protection:** Duplicate the Carrd site to an obscure test slug, publish it with Turnstile disabled, and set `CARRD_URL` in CI to the test slug. Production keeps full protection.

Google's public test reCAPTCHA keys (`6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`) are useless here — they only work if you control the reCAPTCHA server-side integration.

---

## Nightly CI, not per-commit

Running E2E on every push has no signal value for a static Carrd landing page. The failures that matter come from third parties: Carrd updates, Brevo API changes, DNS issues, expired keys. A nightly cron catches these. A second hourly API-only run is worth adding when paid ads are live.

Failure notification: POST to a Slack webhook on job failure.

---

## Key gotchas

- `waitForResponse` must be registered before `click()`, or the response arrives before the listener and the test hangs
- Parallel workers with high concurrency trip Brevo's 10 RPS limit; cap `workers: 2` for Brevo-touching tests
- Double opt-in: if DOI is enabled, contacts appear in the CRM but aren't added to the list until they confirm. Disable DOI on the test Carrd page.
- DOI confirmation emails hit the real inbox on every test run unless DOI is disabled

---

## Sources

- [[summary: testing-carrd-make-notion-github-actions]]
- [[Brevo API Testing]]
- [[CI for No-Code Stack]]
