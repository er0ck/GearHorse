---
title: CI for No-Code Stack
type: concept
tags: [testing, ci-cd, github-actions, playwright, notion-api, brevo, lychee, carrd, make, gearhorse]
created: 2026-04-14
updated: 2026-04-16
sources: 2
---

# CI for No-Code Stack

Pattern for testing a no-code marketing stack (Carrd forms, Make automations, Notion CRM) using free GitHub Actions workflows.

---

## Why test a no-code stack

Even though none of the tools require code to configure, they can break silently:
- Carrd form submissions fail if the Make webhook URL changes
- Make scenarios stop if the Notion integration token expires
- Notion field mappings break if a database property is renamed
- Links on the Carrd site can go stale

---

## Test layer map

| Concern | Tool | Frequency |
|---|---|---|
| Links resolve correctly | `lychee` via `lycheeverse/lychee-action` | Per push |
| Brevo API contract valid | Brevo API-only spec (`brevo-client.ts`) | Per push (~2s) |
| Forms submit correctly | Playwright E2E | Nightly |
| Make automation fires | Playwright + `waitForResponse` | Nightly |
| Brevo contact created with UTMs | Brevo API poll after E2E submit | Nightly |
| Notion CRM populates | Notion JS client + assertions | On-demand |

The Brevo API-only test is now the primary fast canary. See [[Brevo API Testing]] for full details on the two-tier (API-only + E2E) approach.

---

## End-to-end test flow

```
GitHub Actions
    │
    ├── 1. Run link checker against Carrd site
    │
    ├── 2. Playwright: fill out lead/contact form
    │       └── submits → triggers Make webhook
    │
    ├── 3. Wait ~10–15s for Make scenario to run
    │
    └── 4. Query Notion API: assert new row exists
            └── check name, email, source field, timestamp, etc.
```

---

## Critical pattern: timestamped unique email

Use `test+${Date.now()}@yourdomain.com` as the test email on every run. This:
- Prevents false positives from old Notion records
- Makes each run fully isolated and auditable
- Allows safe repeated execution without manual database cleanup

This is the most important design decision in the test setup.

---

## GitHub Actions cost

Well within free tier (2,000 min/month). Weekly runs use approximately 15 minutes/month total.

---

## Required secrets

| Secret | Value |
|---|---|
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_DB_ID` | Database ID from Notion URL |

---

## Scheduling: nightly, not per-commit

Running the E2E test on every push has no signal value for a static Carrd landing page. The failures that matter come from third parties: Carrd pushing an update, Brevo rotating something, DNS issues, an expired API key. A nightly cron catches these. Commit-triggered runs don't add signal because no code change in the repo affects the Carrd or Brevo production environments.

Add an hourly API-only run when paid ads are live and a broken form has immediate financial cost.

---

## Future enhancements

- Screenshot on failure: `use: { screenshot: 'only-on-failure' }` in `playwright.config.ts`
- Failure alerts: Slack webhook notification on job failure
- Smoke test on deploy: trigger `workflow_dispatch` manually after any Carrd update
- Weekly cleanup cron: delete contacts where `IS_TEST_CONTACT=true` as a safety net for `finally`-block misses

---

## Connection to Gear Horse

[[Gear Horse]] uses this pattern. The `gearhorse` GitHub repo contains the workflow files. See [[summary: testing-carrd-make-notion-github-actions]] for the original Notion-centric workflow and [[summary: test-brevo-CRM]] for the Brevo-centric two-tier approach.

---

## Sources

- [[summary: testing-carrd-make-notion-github-actions]]
- [[summary: test-brevo-CRM]]
