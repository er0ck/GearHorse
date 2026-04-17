/**
 * Minimal Brevo contacts API client for E2E test use.
 *
 * Auth: lowercase `api-key` header (not `Authorization: Bearer`).
 * Rate limit: 10 req/s, 36 000/hr on free tier.
 *
 * IMPORTANT: Brevo has no contacts sandbox. Every call writes to the live CRM.
 * Always delete test contacts in a `finally` block. Use IS_TEST_CONTACT=true
 * as a fallback so a weekly cleanup script can find stragglers if `finally`
 * is skipped due to CI cancellation.
 *
 * Required env vars:
 *   BREVO_API_KEY     – v3 API key from Brevo dashboard
 *   BREVO_LIST_ID     – numeric ID of the signup list (defaults to 2)
 *   TEST_EMAIL_PREFIX – local part before the `+` (defaults to "test")
 *   TEST_EMAIL_DOMAIN – domain after `@` (defaults to "gearhorse.camp")
 */

const BASE = 'https://api.brevo.com/v3';

function headers() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY env var is not set');
  return {
    'api-key': key,
    'Content-Type': 'application/json',
    accept: 'application/json',
  };
}

export interface BrevoContact {
  email: string;
  id: number;
  listIds: number[];
  attributes: Record<string, unknown>;
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
}

/** Returns the contact or null if not found. Throws on any other error. */
export async function getContact(email: string): Promise<BrevoContact | null> {
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(email)}`, {
    headers: headers(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getContact ${res.status}: ${await res.text()}`);
  return res.json() as Promise<BrevoContact>;
}

/** Deletes the contact. Silently ignores 404 (already gone). */
export async function deleteContact(email: string): Promise<void> {
  const res = await fetch(`${BASE}/contacts/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteContact ${res.status}: ${await res.text()}`);
  }
}

/**
 * Generates a unique plus-addressed test email on every call.
 * Format: {prefix}+{tag}-{timestamp}-{hex}@{domain}
 * The random hex prevents collisions between parallel workers.
 */
/** Returns the configured list ID, defaulting to 1. */
export function listId(): number {
  return Number(process.env.BREVO_LIST_ID ?? '2');
}

export function testEmail(tag = 'e2e'): string {
  const prefix = process.env.TEST_EMAIL_PREFIX ?? 'test';
  const domain = process.env.TEST_EMAIL_DOMAIN ?? 'gearhorse.camp';
  const hex = Math.random().toString(36).slice(2, 8);
  return `${prefix}+${tag}-${Date.now()}-${hex}@${domain}`;
}
