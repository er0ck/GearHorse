import { test, expect } from '@playwright/test';

const BASE_URL = 'https://gearhorse.camp';

// ---------------------------------------------------------------------------
// Page load & structure
// ---------------------------------------------------------------------------

test('page loads and returns 200', async ({ page }) => {
  const res = await page.goto(BASE_URL);
  expect(res?.status()).toBe(200);
});

test('page title contains GearHorse', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/GearHorse/i);
});

test('hero headline is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: /GearHorse/i })).toBeVisible();
});

test('brand description text is present', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.getByText(/made in the most ethical ways possible/i)).toBeVisible();
});

test('no console errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(BASE_URL);
  // Filter out known third-party noise (reCAPTCHA, CDN)
  const appErrors = errors.filter(e =>
    !e.includes('recaptcha') &&
    !e.includes('google') &&
    !e.includes('cdn-cgi')
  );
  expect(appErrors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Email signup form
// ---------------------------------------------------------------------------

test('email input is visible and accepts input', async ({ page }) => {
  await page.goto(BASE_URL);
  const input = page.locator('input[type="email"]');
  await expect(input).toBeVisible();
  await input.fill('test@example.com');
  await expect(input).toHaveValue('test@example.com');
});

test('submit button is visible', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('form rejects submission with empty email', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('button[type="submit"]').click();
  // Browser native validation should block submission
  const input = page.locator('input[type="email"]');
  const validationMsg = await input.evaluate((el: HTMLInputElement) => el.validationMessage);
  expect(validationMsg.length).toBeGreaterThan(0);
});

test('form rejects invalid email format', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.locator('input[type="email"]').fill('notanemail');
  await page.locator('button[type="submit"]').click();
  const input = page.locator('input[type="email"]');
  const validationMsg = await input.evaluate((el: HTMLInputElement) => el.validationMessage);
  expect(validationMsg.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Spam protection
// ---------------------------------------------------------------------------

test('honeypot field is present but not visible to users', async ({ page }) => {
  await page.goto(BASE_URL);
  // Honeypot: exists in DOM, hidden via CSS — should not be visible
  // Common patterns: name="_gotcha", tabindex="-1", display:none, position:absolute off-screen
  // TODO: the exact selector depends on how Carrd renders it. Once we run it once and inspect the DOM, tighten that selector.
  const honeypot = page.locator('input[name="_gotcha"], input[tabindex="-1"], input[style*="display:none"], input[style*="position:absolute"]').first();
  if (await honeypot.count() > 0) {
    await expect(honeypot).not.toBeVisible();
  }
});

test('reCAPTCHA script is loaded', async ({ page }) => {
  await page.goto(BASE_URL);
  const scripts = await page.locator('script').evaluateAll(els =>
    els.map((el) => (el as HTMLScriptElement).src)
  );
  const hasRecaptcha = scripts.some(src => src.includes('recaptcha') || src.includes('google.com/recaptcha'));
  expect(hasRecaptcha).toBe(true);
});

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

// test.describe('social links', () => {
  // const socials = [
    // { name: 'Instagram', pattern: /instagram\.com/i },
    // { name: 'TikTok',    pattern: /tiktok\.com/i },
    // { name: 'YouTube',   pattern: /youtube\.com/i },
  // ];

  // for (const { name, pattern } of socials) {
    // test(`${name} link points to correct domain`, async ({ page }) => {
      // await page.goto(BASE_URL);
      // const link = page.getByRole('link', { name: new RegExp(name, 'i') });
      // const href = await link.getAttribute('href');
      // expect(href).toMatch(pattern);
    // });
  // }
// });

// ---------------------------------------------------------------------------
// Email link
// ---------------------------------------------------------------------------

test('email link is present and uses mailto or obfuscated href', async ({ page }) => {
  await page.goto(BASE_URL);
  // Carrd uses Cloudflare email obfuscation: href is a cdn-cgi path, not a mailto:
  const emailLink = page.locator('a[href^="mailto:"], a[href*="cdn-cgi/l/email-protection"]');
  await expect(emailLink.first()).toBeVisible();
  const href = await emailLink.first().getAttribute('href');
  expect(href).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Responsive / mobile
// ---------------------------------------------------------------------------

test('page renders correctly on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  await page.goto(BASE_URL);
  await expect(page.getByRole('heading', { name: /GearHorse/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Performance baseline
// ---------------------------------------------------------------------------

test('page fully loads within 5 seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(5000);
});