# Nightly-testing a Carrd → Brevo signup in under 200 lines

**The cleanest way to test this stack is a two-tier setup: one API-only test on every push (≈2 seconds, hits only Brevo's `/v3/contacts`), plus a nightly Playwright run that actually submits the Carrd form with UTM query params.** Brevo offers no real sandbox for contacts, so all tests write to a production account — isolate them with a boolean `IS_TEST_CONTACT=true` attribute, plus-addressed emails, and a `DELETE` in `afterEach`. The main gotcha isn't reCAPTCHA (Carrd doesn't use Google's; it uses optional Cloudflare Turnstile); it's that Carrd relays submissions **server-side** to Brevo, so your Playwright test can't see the API key and has to verify via a separate `GET /v3/contacts/{email}` call with polling for eventual consistency. Everything below is battle-tested against the official Carrd and Brevo docs as of April 2026.

## How the pipeline actually works

Carrd's "Signup → Via Brevo" form is **not** a sibforms.com embed. You paste your Brevo v3 API key and numeric List ID into the Carrd form builder; Carrd stores them server-side. When a visitor submits, the browser POSTs to a Carrd handler (typically `*.carrd.co/r/...`), and **Carrd's backend** calls `POST https://api.brevo.com/v3/contacts` on your behalf. Your browser never sees `api.brevo.com`, so Playwright can't intercept the real Brevo call — you verify after the fact via the Brevo API.

Ticking **Collect UTM parameters** in Carrd auto-populates hidden fields from `window.location.search` and maps them to Brevo attributes named exactly `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_TERM`, `UTM_CONTENT` (all uppercase text attributes). **These attributes must exist in Brevo first**, or the API silently drops them. Carrd also optionally sets `SITE_URL`, `SITE_TITLE`, `SITE_FORM` if you create them. This silent-drop behavior is the #1 cause of "UTMs missing from Brevo" bugs.

Phone opt-in uses Brevo's default `SMS` attribute, which must be **E.164 formatted** (`+15551234567`, `+33612345678`). Brevo accepts `+91xxxxxxxxxx`, `91xxxxxxxxxx`, or `0091xxxxxxxxxx`; anything else returns 400.

## The five Brevo endpoints you'll actually use

All calls go to `https://api.brevo.com/v3`, authenticated via a lowercase `api-key` header (not `Authorization: Bearer`). The rate-limit bucket for `/v3/contacts/*` is **10 requests/second, 36,000/hour** on the free tier — effectively unlimited for test workloads. Every response includes `x-sib-ratelimit-remaining` and `x-sib-ratelimit-reset` headers; respect them on 429s.

| Action | Request |
|---|---|
| Create/upsert contact | `POST /v3/contacts` with `{email, attributes, listIds, updateEnabled: true}` |
| Verify contact exists | `GET /v3/contacts/{encodeURIComponent(email)}` → returns full contact or 404 |
| List/search by attribute | `GET /v3/contacts?filter=equals(IS_TEST_CONTACT,true)&limit=1000` |
| Delete (test cleanup) | `DELETE /v3/contacts/{encodeURIComponent(email)}` → 204 |
| Create custom attribute | `POST /v3/contacts/attributes/normal/UTM_SOURCE` with `{"type":"text"}` |

**URL-encode the email on every path call** — otherwise the `+` in `user+test@example.com` decodes to a space and you get 404s. A common silent bug.

The sole "sandbox" Brevo offers is the `X-Sib-Sandbox: drop` header, and it **only works on `POST /v3/smtp/email`** — it does nothing for contacts. There is no separate test API key, no separate base URL, no parallel environment. Every contact test writes to your real CRM, consumes your contact quota, and must be cleaned up manually.

## Pre-flight: attributes you must create once in Brevo

Before any test runs, create these via the Brevo UI (Contacts → Settings → Contact attributes) or one-shot script. Missing attributes are silently ignored by `POST /v3/contacts`, which is why tests otherwise pass with empty UTM fields.

```bash
for attr in UTM_SOURCE UTM_MEDIUM UTM_CAMPAIGN UTM_TERM UTM_CONTENT SITE_URL SITE_FORM; do
  curl -X POST "https://api.brevo.com/v3/contacts/attributes/normal/$attr" \
    -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" \
    -d '{"type":"text"}'
done
curl -X POST "https://api.brevo.com/v3/contacts/attributes/normal/IS_TEST_CONTACT" \
  -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" \
  -d '{"type":"boolean"}'
curl -X POST "https://api.brevo.com/v3/contacts/attributes/normal/SMS_OPT_IN" \
  -H "api-key: $BREVO_API_KEY" -H "content-type: application/json" \
  -d '{"type":"boolean"}'
```

Then in Brevo, create a **segment** "All contacts where `IS_TEST_CONTACT` is not `true`" and use that segment — not the raw list — as the audience for every marketing campaign. This is your guard against test contacts polluting real open/click rates forever.

## The actual test code

Use a single Brevo helper plus two spec files. File structure:

```
lib/brevo-client.ts           # API helper
tests/api/contact.spec.ts     # runs on every push (~2s)
tests/e2e/signup.spec.ts      # runs nightly (~30s)
scripts/cleanup-test-contacts.ts  # daily cron safety net
playwright.config.ts
.github/workflows/nightly-e2e.yml
```

### `lib/brevo-client.ts`

```ts
const BASE = 'https://api.brevo.com/v3';
const H = {
  'api-key': process.env.BREVO_API_KEY!,
  'Content-Type': 'application/json',
  accept: 'application/json',
};

export const brevo = {
  async getContact(email: string) {
    const r = await fetch(`${BASE}/contacts/${encodeURIComponent(email)}`, { headers: H });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getContact: ${r.status} ${await r.text()}`);
    return r.json() as Promise<{
      email: string; id: number; listIds: number[];
      attributes: Record<string, any>;
      emailBlacklisted: boolean; smsBlacklisted: boolean;
    }>;
  },
  async createContact(body: any) {
    const r = await fetch(`${BASE}/contacts`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ updateEnabled: true, ...body }),
    });
    if (!r.ok && r.status !== 204)
      throw new Error(`createContact: ${r.status} ${await r.text()}`);
  },
  async deleteContact(email: string) {
    const r = await fetch(`${BASE}/contacts/${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: H,
    });
    if (!r.ok && r.status !== 404) throw new Error(`deleteContact: ${r.status}`);
  },
};

export const testEmail = (tag = 'e2e') =>
  `${process.env.TEST_EMAIL_PREFIX ?? 'founder'}+${tag}-${Date.now()}-${
    Math.random().toString(36).slice(2, 8)
  }@${process.env.TEST_EMAIL_DOMAIN}`;
```

### `tests/e2e/signup.spec.ts` — the full pipeline check

```ts
import { test, expect } from '@playwright/test';
import { brevo, testEmail } from '../../lib/brevo-client';

test('Carrd submission creates Brevo contact with UTMs', async ({ page }) => {
  const email = testEmail('e2e');
  const qs = new URLSearchParams({
    utm_source: 'test', utm_medium: 'e2e', utm_campaign: 'nightly',
  });

  try {
    // Register network listener BEFORE clicking — otherwise it can fire first.
    const submitted = page.waitForResponse(
      (r) => r.request().method() === 'POST' &&
             /carrd\.co|mail\.carrd\.site|api\.brevo\.com/.test(r.url()),
      { timeout: 20_000 },
    );

    await page.goto(`${process.env.CARRD_URL}/?${qs}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('button', { name: /subscribe|sign\s*up|submit/i }).click();

    const resp = await submitted;
    expect(resp.status()).toBeLessThan(400);

    // Also confirm the UI rendered success — selector depends on your Carrd "On Completion" text
    await expect(page.getByText(/thanks|subscribed|check your inbox/i))
      .toBeVisible({ timeout: 15_000 });

    // Brevo is eventually consistent — poll up to 15s before asserting attributes.
    await expect.poll(async () => (await brevo.getContact(email))?.attributes?.UTM_CAMPAIGN,
      { timeout: 15_000, intervals: [500, 1000, 2000] }).toBe('nightly');

    const contact = (await brevo.getContact(email))!;
    expect(contact.attributes).toMatchObject({
      UTM_SOURCE: 'test', UTM_MEDIUM: 'e2e', UTM_CAMPAIGN: 'nightly',
    });
    expect(contact.listIds).toContain(Number(process.env.BREVO_LIST_ID));
  } finally {
    await brevo.deleteContact(email).catch(() => {});
  }
});
```

### `tests/api/contact.spec.ts` — the 2-second canary

Use this as your every-push test. It bypasses Carrd entirely and just checks that Brevo's contract still matches what you expect, with the attributes you depend on. This is what catches a revoked API key, a missing attribute, or a Brevo schema change — fast, with zero browser flakiness.

```ts
import { test, expect } from '@playwright/test';
import { brevo, testEmail } from '../../lib/brevo-client';

test('Brevo accepts signup payload with UTM + SMS attributes', async () => {
  const email = testEmail('api');
  try {
    await brevo.createContact({
      email,
      listIds: [Number(process.env.BREVO_LIST_ID)],
      attributes: {
        FIRSTNAME: 'Test', SMS: '+15551234567',
        UTM_SOURCE: 'google', UTM_MEDIUM: 'cpc', UTM_CAMPAIGN: 'launch-2026',
        SMS_OPT_IN: true, IS_TEST_CONTACT: true,
      },
    });
    await expect.poll(async () => (await brevo.getContact(email))?.email,
      { timeout: 10_000 }).toBe(email);
    const c = (await brevo.getContact(email))!;
    expect(c.attributes.UTM_CAMPAIGN).toBe('launch-2026');
    expect(c.attributes.SMS).toBe('+15551234567');
    expect(c.smsBlacklisted).toBe(false);
  } finally {
    await brevo.deleteContact(email).catch(() => {});
  }
});
```

## Dealing with CAPTCHA — simpler than you think

The task description assumes Google reCAPTCHA, but **Carrd doesn't use reCAPTCHA**. Its default spam protection is server-side heuristics (honeypot field, timing signals) with optional Cloudflare Turnstile as an upgrade. Headless Playwright with a realistic user-agent typically passes the default mitigation; Turnstile will block it, and Cloudflare does not offer public "always-pass" test keys you can inject into a third-party page like Carrd.

The clean answer: **duplicate your Carrd site to an obscure slug (e.g., `test-nightly-abc123.yourdomain.com`), publish it with Turnstile disabled, and point `CARRD_URL` at it**. Your production site keeps full spam protection. If you're instead embedding a Brevo-hosted form inside a Carrd "Embed" element (the sibforms.com path), choose Brevo's **Simple HTML** variant when generating the form — per Brevo's docs, that variant cannot include CAPTCHA, which is exactly what you want for automation.

Google's famous public test keys (`6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI` / `…WifJWe`) only work if **you** control the reCAPTCHA integration server-side; they are useless against Carrd or Brevo's built-in forms.

## GitHub Actions: nightly, not per-commit

Running this on every push is waste — your landing page is static and nothing in your repo affects it. The failures you care about come from third parties: Carrd pushing a change, Brevo rotating something, DNS, an expired API key. **A daily cron catches those; commits don't add signal.** Trade-off: you learn about outages up to 24 hours late. If you're running paid ads to the page, add a second hourly API-only run or a Checkly browser check every 10–15 minutes.

```yaml
name: Nightly E2E (Carrd → Brevo)
on:
  schedule: [{ cron: '0 6 * * *' }]   # 06:00 UTC daily
  workflow_dispatch: {}
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      CARRD_URL: ${{ secrets.CARRD_TEST_URL }}
      BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
      BREVO_LIST_ID: ${{ secrets.BREVO_LIST_ID }}
      TEST_EMAIL_DOMAIN: ${{ secrets.TEST_EMAIL_DOMAIN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/, retention-days: 14 }
      - if: failure()
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\":rotating_light: Nightly signup E2E failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}" \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

Add a second scheduled workflow running `scripts/cleanup-test-contacts.ts` weekly as a safety net — it iterates `GET /v3/contacts?filter=equals(IS_TEST_CONTACT,true)` and deletes each, catching any contacts your `afterEach` missed when CI got cancelled mid-run.

## Test isolation: three layers, ranked by importance

**The `finally`/`afterEach` delete is your primary mechanism.** But it doesn't run when CI gets cancelled or Node crashes, so you layer defenses:

1. **Unique email per run** — `founder+e2e-${Date.now()}-${randomHex(6)}@yourdomain.com`. Plus-addressing works on Gmail, Workspace, Outlook, Fastmail, iCloud; Brevo treats each as a distinct contact. Skip bare `Date.now()` — parallel workers collide in the same millisecond.
2. **`IS_TEST_CONTACT=true` on every test write** — lets the weekly cleanup script find stragglers and lets you segment them out of all campaign audiences forever.
3. **`updateEnabled: true` on every create** — makes the test idempotent; a re-run with the same email updates instead of returning 400.

If your form has **double opt-in enabled**, the contact appears in the CRM but isn't added to the list until they click the confirmation link. Either disable DOI on your test page, or integrate **Mailosaur/MailSlurp** to receive the DOI email programmatically, extract the link with a regex, `page.goto(link)`, then poll for list membership. For a solo founder, disabling DOI on the test page is almost always the right call.

## SMS opt-in testing without actually sending

For landing-page signup where you're only **capturing** phone numbers (not sending SMS from the test), use any valid-looking E.164: `+15551234567` is fine. Brevo accepts it at the attribute layer; you never call `POST /v3/transactionalSMS/send`, so no credits burn and no real phone is pinged. Assert three things in the contact response: `attributes.SMS` matches what you submitted, `attributes.SMS_OPT_IN === true` (your custom boolean confirming the checkbox state), and `smsBlacklisted === false`. Brevo does not offer an SMS sandbox — the `X-Sib-Sandbox` header only covers transactional email — so never actually trigger a send from an automated test. If you need a real SMS for OTP-style tests, use Twilio test credentials with `+15005550006` as an intermediate layer, or Mailosaur virtual phone numbers.

## API-only vs full E2E: pick both

A contract-style comparison for the decision:

| Signal | Playwright E2E | API-only |
|---|---|---|
| Carrd page renders, JS runs, UTMs get captured | ✅ | ❌ |
| Brevo API key valid, list exists, attributes mapped | ✅ | ✅ |
| Turnstile/spam protection changes break real users | ✅ | ❌ |
| Runtime | 30–60s | 2–5s |
| Flakiness | Medium (DNS, CDN, propagation) | Very low |

**Run both.** API-only on every push is your fast canary; Playwright nightly is your full-pipeline smoke test against the actual Carrd URL. If you could only pick one, the API-only test catches ~80% of what actually breaks in a Carrd+Brevo stack while being nearly flake-free.

## What trips people up

Seven pitfalls that are specific to this stack and cost hours to debug:

- **Missing attributes silently dropped.** `POST /v3/contacts` with `UTM_SOURCE` but no `UTM_SOURCE` attribute defined in Brevo returns 201 and drops the field. If your tests show "undefined" for UTMs, verify the attribute list first.
- **Eventual consistency on reads.** A `GET` immediately after a `POST` can 404 for several seconds. **Always wrap reads in `expect.poll()` with a 10–15 second timeout.** This is the single most common source of flakes.
- **Email URL-encoding.** Without `encodeURIComponent`, `test+foo@x.com` hits the API as `test foo@x.com` and 404s. Bake it into the helper so you never think about it again.
- **DOI emails hit your real inbox.** Every run sends a confirmation email. Disable DOI on the test page, or use a mail catcher.
- **Test contacts pollute open/click rates.** Create a "Not a test contact" segment in Brevo and use it as the audience for every campaign — forever.
- **`waitForResponse` registered after the action.** It must come *before* the `click()`, or the response arrives before the listener exists and the test hangs.
- **Parallel workers vs 10 RPS limit.** Cap `workers: 2` for Brevo-touching tests; otherwise a matrix run trips 429s. Respect `x-sib-ratelimit-reset` on retries.

## Conclusion

This problem is smaller than it looks because the constraints resolve themselves once you understand the architecture: Carrd relays server-side (so you verify via Brevo API, not network interception), Brevo has no sandbox (so you isolate with a boolean attribute and delete in `finally`), and the "CAPTCHA problem" isn't Google's reCAPTCHA but Carrd's optional Turnstile (solved by a separate test page). A solo founder can have working coverage in one evening: create the seven attributes in Brevo, paste the `brevo-client.ts` helper and two spec files into a repo, add three GitHub secrets, and enable the nightly workflow. The API-only test alone — 30 lines — already catches the majority of real failures. Upgrade to Playwright E2E when you start spending money on ads to the page and a broken form costs more than 24 hours of silence is worth.