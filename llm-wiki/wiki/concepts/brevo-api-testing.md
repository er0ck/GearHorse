---
title: Brevo API Testing
type: concept
tags: [testing, brevo, api, playwright, test-isolation, ci-cd, gearhorse]
created: 2026-04-16
updated: 2026-04-16
sources: 1
---

# Brevo API Testing

Patterns for testing the Brevo contacts API in the [[Carrd Make Notion Stack]] context. Covers the API contract, test isolation strategy, and the two-tier (API-only + E2E) approach. Complements [[CI for No-Code Stack]].

---

## Why Brevo has no real sandbox

Brevo's `X-Sib-Sandbox: drop` header only suppresses transactional email delivery (`POST /v3/smtp/email`). It does nothing for contacts. There is no separate test API key, no parallel environment, no contact-tier sandbox. Every test writes to the live CRM and must be cleaned up.

---

## API fundamentals

- Base URL: `https://api.brevo.com/v3`
- Auth header: `api-key: YOUR_KEY` (lowercase, not `Authorization: Bearer`)
- Rate limit: 10 req/s, 36,000/hr (free tier) — check `x-sib-ratelimit-remaining` on responses
- **Always `encodeURIComponent` the email on path segments.** Without it, `user+tag@domain.com` becomes `user tag@domain.com` and returns a silent 404.
- **Reads are eventually consistent.** A `GET` immediately after a `POST` can 404 for several seconds. Always use `expect.poll()` with a 10–15 second timeout.

---

## Pre-flight: attribute setup

Missing attributes in `POST /v3/contacts` are silently dropped with a 201 response. This is the #1 cause of "UTMs not appearing in Brevo" bugs. Create all custom attributes before running tests or going live:

```bash
for attr in UTM_SOURCE UTM_MEDIUM UTM_CAMPAIGN UTM_TERM UTM_CONTENT SITE_URL SITE_FORM; do
  curl -X POST "https://api.brevo.com/v3/contacts/attributes/normal/$attr" \
    -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" \
    -d '{"type":"text"}'
done
curl -X POST "https://api.brevo.com/v3/contacts/attributes/normal/IS_TEST_CONTACT" \
  -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" \
  -d '{"type":"boolean"}'
```

---

## Three-layer test isolation

**Layer 1: Unique email per run**
`founder+e2e-${Date.now()}-${randomHex(6)}@domain.com`

Plus-addressing works on Gmail, Workspace, Outlook, Fastmail, iCloud. Brevo treats each variant as a distinct contact. Include random hex, not just `Date.now()` — parallel workers can collide in the same millisecond.

**Layer 2: `IS_TEST_CONTACT: true` on every test write**
- Lets a Brevo segment permanently exclude test contacts from all campaign audiences
- Lets a weekly cleanup script (`GET /v3/contacts?filter=equals(IS_TEST_CONTACT,true)`) find and delete stragglers that `finally` blocks missed during CI cancellation

**Layer 3: `updateEnabled: true` on every create**
Makes the create call idempotent. A re-run with the same email updates instead of returning 400.

---

## Two-tier test architecture

### API-only (run every push, ~2s)

Bypasses Carrd entirely. Creates a contact directly via the Brevo API with the full attribute payload, polls to verify, asserts attributes, deletes in `finally`. Use this as the fast canary:

```
what it catches: revoked API key, missing attribute, Brevo schema change,
                 wrong list ID, SMS attribute format issues
what it misses:  Carrd form regression, UTM capture in the browser, UI flow
flakiness:       near-zero
```

### Playwright E2E (run nightly, ~30–60s)

Navigates to a test Carrd URL with UTM query params, fills the form, submits, waits for the success UI, then polls `GET /v3/contacts/{email}` until the contact appears with correct attributes.

```
what it catches: everything the API test catches plus Carrd-side regressions
what it misses:  nothing significant
flakiness:       medium (DNS, CDN, Carrd propagation)
```

A common pattern: run API-only on every push; add E2E nightly once paid ads make a broken form immediately costly.

---

## Carrd → Brevo architecture note

Carrd stores the Brevo API key and list ID server-side. The browser POSTs to a Carrd handler; Carrd's backend calls Brevo on your behalf. Playwright cannot intercept the Brevo call — verification must happen via a separate `GET` with polling.

---

## Key gotchas

| Gotcha | Fix |
|---|---|
| Missing attributes silently dropped | Create all attributes in Brevo before any run |
| `GET` after `POST` returns 404 | Wrap in `expect.poll()` with 10–15s timeout |
| `+` in email decodes to space | `encodeURIComponent(email)` on every path call |
| `waitForResponse` misses the event | Register listener *before* `click()` |
| Parallel workers trip 10 RPS | Set `workers: 2` for Brevo-touching tests |
| DOI emails hit real inbox | Disable double opt-in on test Carrd page |
| Test contacts in campaign audiences | Create a "not IS_TEST_CONTACT" Brevo segment and use it for every campaign |

---

## CAPTCHA note

Carrd does NOT use Google reCAPTCHA. Default spam protection is server-side heuristics (honeypot field, timing). Optional upgrade is Cloudflare Turnstile (blocks headless browsers). Clean E2E solution: publish a duplicate Carrd site at an obscure slug with Turnstile disabled; point `CARRD_URL` at that slug in CI. See [[Honeypot Spam Protection]].

---

## Sources

- [[summary: test-brevo-CRM]]
