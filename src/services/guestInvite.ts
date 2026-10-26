/**
 * Guest invite tokens for external contributors who open a proposal link without an
 * account. The token travels in the link's URL fragment (`#invite=...`), which browsers
 * never send to a server, so it stays out of CloudFront/access logs and Referer headers.
 *
 * Kept free of imports so the low-level API helpers can check for a guest session.
 */

const GUEST_TOKEN_RE = /^g1_[A-Za-z0-9_-]{43,128}$/;
const CONTRIBUTE_PATH = '/sec-filings/contribute';

/** 32 random bytes, base64url, with the version prefix the server requires. */
export function createGuestInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `g1_${b64}`;
}

export function isGuestInviteToken(token: unknown): token is string {
  return typeof token === 'string' && GUEST_TOKEN_RE.test(token);
}

/** The guest token of the current page, if it is a contributor link opened as a guest. */
export function getGuestInviteToken(): string | null {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith(CONTRIBUTE_PATH)) return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('invite');
  return isGuestInviteToken(token) ? token : null;
}

export function isGuestSession(): boolean {
  return getGuestInviteToken() !== null;
}
