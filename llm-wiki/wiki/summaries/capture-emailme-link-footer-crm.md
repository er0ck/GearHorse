---
title: "Summary: capture emailMe link in footer to CRM"
type: source
tags: [make, gmail, brevo, improvmx, email-capture, crm, gearhorse]
created: 2026-04-16
updated: 2026-04-16
sources: 1
---

# Summary: capture emailMe link in footer to CRM

Source: `sources/capture-emailme-link-footer-crm.md`

Conversation-format source describing how to capture contacts who email `hello@gearhorse.camp` directly (via the footer email link) into Brevo, without touching Carrd.

---

## Core insight

The footer `mailto:` link is a second acquisition channel alongside the signup form. Visitors who email directly are often higher-intent leads. The existing ImprovMX → Gmail forwarding chain already puts every inbound email in Gmail, so Make can watch Gmail as a trigger point and push senders to Brevo automatically. No code, no Carrd changes needed.

---

## Recommended setup

**Step 1: Gmail label + filter**
Create a Gmail filter:
- To: `hello@gearhorse.camp`
- Action: apply label `gear-horse-inbound`

This gives Make a clean, isolated trigger. Gotcha: ImprovMX may rewrite the To field to the personal forwarding address. If so, use the label filter approach rather than filtering on To.

**Step 2: Make scenario**
- Trigger: Gmail Watch Emails → filter by label `gear-horse-inbound`
- Router/Filter: sender is not owner's email (prevents self-loops); sender domain not `mailer-daemon`, `noreply`, etc.
- Action 1: Brevo Add or Update Contact — email from sender, attempt first/last name parse from display name, tag `direct-email`
- Action 2 (optional): Notion create CRM record

**Deduplication:** Brevo's "Add or Update" is idempotent — if the sender already exists from a form signup, it updates rather than duplicates.

---

## Alternatives considered

ImprovMX supports webhooks on their paid plan (~$9/mo), which would let a Make webhook receive the email directly, bypassing Gmail. Rejected for current setup: already on ImprovMX free tier, Gmail forwarding already works, and the Make + Gmail trigger approach is simpler to maintain.

---

## Fit within existing stack

This is an additive flow, not a replacement. The signup form captures visitors who opt in via the landing page. This flow captures visitors who go further and reach out directly. Both funnel into the same Brevo contact list with different source tags.

See [[Inbound Email Capture]] for the pattern in full.

---

## Sources

- [[summary: gearhorse-tech-stack-setup]]
- [[summary: domain-email-infrastructure]]