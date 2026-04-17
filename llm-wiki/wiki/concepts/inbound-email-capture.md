---
title: Inbound Email Capture
type: concept
tags: [make, gmail, brevo, improvmx, email-capture, crm, gearhorse]
created: 2026-04-16
updated: 2026-04-16
sources: 1
---

# Inbound Email Capture

A secondary acquisition flow that converts visitors who email `hello@gearhorse.camp` directly (via the footer link) into Brevo contacts, using Make + Gmail as the automation layer. No Carrd changes, no code.

---

## Why it exists

The Carrd signup form captures email addresses from visitors who opt into a mailing list. But some visitors skip the form and email directly. These are often higher-intent leads. Without this flow, they enter Gmail but never reach the CRM.

---

## Prerequisites

The flow depends on [[Domain and Email Infrastructure]] being in place:
- `hello@gearhorse.camp` exists as an ImprovMX alias forwarding to the founder's Gmail
- Make has a Gmail connection with the founder's account authorized

---

## Flow

```
Visitor clicks mailto: in footer
        ↓
Email arrives at hello@gearhorse.camp
        ↓
ImprovMX forwards to Gmail
        ↓
Gmail filter applies label: gear-horse-inbound
        ↓
Make: Watch Emails (trigger on label)
        ↓
Filter: sender is not owner / not automated
        ↓
Brevo: Add or Update Contact
  - email: sender address
  - name: parsed from display name (best-effort)
  - tag: direct-email
        ↓
(optional) Notion: create CRM record
```

---

## Gmail setup

Create a Gmail filter:
- **To:** `hello@gearhorse.camp`
- **Action:** Apply label → `gear-horse-inbound`

**Gotcha:** ImprovMX may rewrite the To field to the personal forwarding address, not the alias. If filtering on To doesn't work, switch to a label applied by a filter on a header or subject pattern that ImprovMX injects.

---

## Make scenario

**Trigger:** Gmail Watch Emails, filtered to label `gear-horse-inbound`

**Router/Filter conditions:**
- Sender email does not equal owner's email (prevents self-loop when owner replies)
- Sender domain does not contain `mailer-daemon`, `noreply`, `no-reply`

**Action: Brevo Add or Update Contact**
- Email: `{{sender email}}`
- Name: split `{{from display name}}` on space for first/last (best-effort; clean up in Brevo later)
- List: same list as form signups
- Tag: `direct-email` (distinguishes this channel from form signups)

**Deduplication:** Brevo's Add or Update is idempotent. If the sender already exists from a form signup, the record is updated, not duplicated.

---

## Relationship to the signup form flow

Both flows funnel into the same Brevo contact list. The `direct-email` tag on inbound contacts allows segmenting by acquisition channel. The signup form flow produces contacts tagged with UTM source/medium from [[UTM Tracking]].

---

## Alternative: ImprovMX webhooks

ImprovMX supports webhooks on their paid plan (~$9/mo), allowing a Make webhook to receive emails directly without Gmail as an intermediary. Not used: ImprovMX free tier is sufficient for current volume, and Gmail forwarding is already configured and working.

---

## Sources

- [[summary: capture-emailme-link-footer-crm]]
