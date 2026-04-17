/**
 * E2E tests: Carrd signup form → Brevo CRM
 *
 * Each test submits through the real Carrd form at gearhorse.camp and then
 * verifies the contact in Brevo via the API. All contacts are deleted in a
 * `finally` block regardless of pass/fail.
 *
 * Architecture note: Carrd submits server-side to Brevo — the browser never
 * touches api.brevo.com. Playwright cannot intercept that call directly.
 * Verification is done by polling GET /v3/contacts/{email} after the Carrd
 * handler responds and the success UI appears.
 *
 * Required env vars (see .env.example or CI secrets):
 *   BREVO_API_KEY, BREVO_LIST_ID,
 *   TEST_EMAIL_PREFIX, TEST_EMAIL_DOMAIN
 *
 * Pre-flight (one-time, per Brevo account):
 *   Create custom attributes UTM_SOURCE, UTM_MEDIUM, UTM_CAMPAIGN, UTM_TERM,
 *   UTM_CONTENT, SITE_URL, SITE_FORM (type: text) and IS_TEST_CONTACT
 *   (type: boolean) via the Brevo UI or the curl script in the wiki.
 *   Missing attributes are silently dropped by POST /v3/contacts.
 */

import { test, expect, Page } from '@playwright/test';
import { getContact, deleteContact, testEmail, listId } from './lib/brevo-client';

const CARRD_URL = 'https://gearhorse.camp';

// Brevo propagates new contacts within a few seconds but is eventually
// consistent. Poll for up to 20 s with escalating intervals.
const BREVO_POLL_TIMEOUT = 20_000;
const BREVO_POLL_INTERVALS = [1_000, 2_000, 3_000];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fill and submit the signup form.
 * Returns a promise that resolves to the alert message text shown on success.
 * The dialog listener must be registered before click() — if it's set up after,
 * the alert can fire and auto-dismiss before Playwright catches it.
 */
async function submitForm(page: Page, email: string): Promise<string> {
  let alertText = '';
  const dialogPromise = new Promise<void>(resolve => {
    page.once('dialog', async dialog => {
      alertText = dialog.message();
      await dialog.accept();
      resolve();
    });
  });

  await page.locator('input[type="email"]').fill(email);
  await page.locator('button[type="submit"]').click();

  await dialogPromise;
  return alertText;
}

/** Poll until the contact appears in Brevo (eventual consistency). */
async function pollUntilContactExists(email: string) {
  await expect
    .poll(() => getContact(email), {
      timeout: BREVO_POLL_TIMEOUT,
      intervals: BREVO_POLL_INTERVALS,
      message: `Contact ${email} did not appear in Brevo within ${BREVO_POLL_TIMEOUT}ms`,
    })
    .not.toBeNull();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('basic signup creates contact on Brevo list', async ({ page }) => {
  const email = testEmail('basic');
  const lid = listId();

  try {
    await page.goto(CARRD_URL);
    const alert = await submitForm(page, email);
    expect(alert, 'expected success alert after submission').toMatch(/thank|Ride/i);

    // Poll Brevo until the contact appears
    await pollUntilContactExists(email);

    const contact = (await getContact(email))!;
    expect(contact.email).toBe(email);
    expect(contact.listIds).toContain(lid);
    expect(contact.emailBlacklisted).toBe(false);
  } finally {
    await deleteContact(email).catch(() => {});
  }
});

test('signup with UTM parameters stores UTMs on Brevo contact', async ({ page }) => {
  const email = testEmail('utm');
  const lid = listId();

  const utms = {
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'launch-2026',
    utm_term: 'camping-gear',
    utm_content: 'bio-link',
  };
  const qs = new URLSearchParams(utms).toString();

  try {
    await page.goto(`${CARRD_URL}/?${qs}`);
    const alert = await submitForm(page, email);
    expect(alert, 'expected success alert after submission').toMatch(/thank|Ride/i);

    await pollUntilContactExists(email);

    const contact = (await getContact(email))!;
    expect(contact.listIds).toContain(lid);

    // Carrd maps lowercase utm_* query params to uppercase Brevo attributes.
    // If any of these fail, the most likely cause is that the attribute was
    // never created in Brevo (silently dropped). Run the pre-flight curl
    // script from the wiki before debugging further.
    expect(contact.attributes['UTM_SOURCE']).toBe(utms.utm_source);
    expect(contact.attributes['UTM_MEDIUM']).toBe(utms.utm_medium);
    expect(contact.attributes['UTM_CAMPAIGN']).toBe(utms.utm_campaign);
    expect(contact.attributes['UTM_TERM']).toBe(utms.utm_term);
    expect(contact.attributes['UTM_CONTENT']).toBe(utms.utm_content);
  } finally {
    await deleteContact(email).catch(() => {});
  }
});

test('signup stores site parameters on Brevo contact', async ({ page }) => {
  // SITE_URL and SITE_FORM are set by Carrd server-side automatically when
  // those attributes exist in Brevo. They are not query params — Carrd reads
  // the current page URL and form ID and sends them along with the submission.
  const email = testEmail('site');
  const lid = listId();

  try {
    await page.goto(CARRD_URL);
    const alert = await submitForm(page, email);
    expect(alert, 'expected success alert after submission').toMatch(/thank|Ride/i);

    await pollUntilContactExists(email);

    const contact = (await getContact(email))!;
    expect(contact.listIds).toContain(lid);

    // SITE_URL should contain the Carrd domain.
    // If this is undefined, create the SITE_URL attribute in Brevo first.
    const siteUrl = contact.attributes['SITE_URL'] as string | undefined;
    expect(siteUrl).toBeTruthy();
    expect(siteUrl).toMatch(/gearhorse\.camp/i);

    // SITE_FORM is the internal Carrd form ID — we just assert it is non-empty.
    const siteForm = contact.attributes['SITE_FORM'] as string | undefined;
    expect(siteForm).toBeTruthy();
  } finally {
    await deleteContact(email).catch(() => {});
  }
});
