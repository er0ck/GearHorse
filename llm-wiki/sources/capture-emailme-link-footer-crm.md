---
title: capture emailMe link in footer to CRM
type: source
tags: [infrastructure, domain, email, carrd, google-workspace, improvmx, porkbun, namecheap, cloudflare]
created: 2026-04-16
source_type: conversation
---

Good problem to solve — and your existing stack (Make + Gmail + Brevo) is actually perfect for this. No code needed on the Carrd side at all.

## The Core Idea

Since ImprovMX already forwards `hello@gearhorse.camp` → Gmail, you can have **Make watch Gmail for new inbound emails** and automatically push the sender to Brevo. The trick is filtering so you're only catching real inbound contacts, not your own replies or newsletters.

---

## Recommended Setup

### Step 1 — Gmail: Create a label + filter

In Gmail, create a filter:
- **To:** `hello@gearhorse.camp`
- **Action:** Apply label → `gear-horse-inbound` (or whatever)

This gives Make a clean, isolated trigger point.

### Step 2 — Make: Build the scenario

**Trigger:** Gmail → *Watch Emails* → filter by label `gear-horse-inbound`

**Router / Filter (important):** Add a filter condition so it only continues if:
- The sender is NOT your own email (avoids self-loops)
- Optionally: sender domain doesn't contain `mailer-daemon`, `noreply`, etc.

**Action 1:** Brevo → *Add or Update a Contact*
- Email: `{{sender email}}`
- You can attempt to parse first/last name from the "From" display name field (Make can split on space)
- Add to your list, tag them something like `direct-email` so you know how they came in

**Action 2 (optional):** Notion → create a new CRM record, same data

---

## A Few Gotchas

- **ImprovMX rewriting:** Depending on your ImprovMX setup, the forwarded email's "To" field in Gmail might show your personal address, not `hello@gearhorse.camp`. If that's the case, filter on a Gmail label instead of the To field — just manually label rules based on ImprovMX forwarding behavior.
- **Name parsing is fuzzy:** Some senders have "First Last" as their display name, others have company names or nothing. Parse best-effort; you can always clean up in Brevo/Notion later.
- **Deduplication:** Brevo's "Add or Update" handles this natively — if they're already on the list from the signup form, it just updates, no duplicate.

---

## Alternative: ImprovMX Webhooks

ImprovMX does support webhooks on their paid plan (~$9/mo) — you could have it POST directly to a Make webhook when an email is received, skipping Gmail as the middleman. But since you're already on the free tier and Gmail forwarding already works, the Make + Gmail trigger route is cleaner for your setup.

---

The Make scenario is probably 4–5 modules total and fits comfortably in the free tier. Want me to sketch out the exact Make module config?