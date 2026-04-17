---
title: Honeypot Spam Protection
type: concept
tags: [spam, security, forms, carrd, make, honeypot, turnstile, gearhorse]
created: 2026-04-14
updated: 2026-04-16
sources: 2
---

# Honeypot Spam Protection

A free, no-friction spam protection technique used in the [[Carrd Make Notion Stack]].

**Correction (2026-04-16):** Earlier notes described a "reCAPTCHA v3 + honeypot" two-layer setup. This was incorrect. Carrd does NOT use Google reCAPTCHA. Carrd's default spam protection is server-side heuristics including a honeypot field and timing signals. Cloudflare Turnstile is an optional add-on upgrade. Google reCAPTCHA is not involved at any layer.

---

## How it works

A hidden field is added to the Carrd form. Real users never see it, so they never fill it. Bots read raw HTML and fill every field they find. Make checks the field on receipt: if it's populated, the submission is discarded. If it's empty, the submission is a real human and proceeds to Notion.

---

## Setup: Carrd

1. Add a Text field to the form
2. Set the name to something bot-tempting: `website`, `url`, or `phone`
3. Add a Custom Attribute: `style` → `display:none`
4. Mark as not required

---

## Setup: Make filter

Between the Webhook trigger and the Notion module:
1. Click the dotted line between modules → Add a Filter
2. Configure:
   - Label: `Honeypot check`
   - Condition: `{{1.website}}` is empty

Only proceeds to create the Notion row if the honeypot field is empty.

---

## Flow

```
Carrd form submitted
        ↓
Make Webhook receives it
        ↓
   Filter: is {{1.website}} empty?
        ↓              ↓
       YES             NO
        ↓              ↓
  Create Notion     Stop. Discard.
  CRM row           Bot detected.
```

---

## Important note

The field name in Carrd must exactly match the variable reference in Make. Verify by checking the Make execution log after the first test submission.

---

## Actual spam protection layers (as of 2026-04-16)

```
Carrd server-side heuristics    ← timing, honeypot, bot fingerprinting
       +
Honeypot field in Make          ← secondary filter on the automation side
       +
Cloudflare Turnstile (optional) ← add-on; blocks headless browsers but
                                   also blocks Playwright-based E2E tests
```

If Turnstile is enabled on the production Carrd site, Playwright E2E tests will be blocked. The clean solution: maintain a duplicate test Carrd page at an obscure slug with Turnstile disabled. See [[Brevo API Testing]] for the full E2E testing strategy.

---

## Sources

- [[summary: gearhorse-tech-stack-setup]]
- [[summary: test-brevo-CRM]]
