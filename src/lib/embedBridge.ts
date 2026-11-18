import type { EmbedInbound, EmbedOutbound } from '../types/scriptReview';

/**
 * The script embed talks to the Social Media portal page that hosts it (an iframe in a dialog) with window.postMessage.
 * Both directions are limited to the portal origins in VITE_EMBED_PARENT_ORIGINS (comma separated; default the local
 * Social Media portal): we only send to, and only listen to, the parent when its origin is on that list.
 */
const DEFAULT_PARENT_ORIGINS = 'http://localhost:5179';

export const isEmbedRoute = (): boolean => typeof window !== 'undefined' && window.location.pathname.startsWith('/embed/');

/** `?mode=editor`: only the script editor, the hosting portal runs the review around it. */
export const isEditorOnly = (): boolean => new URLSearchParams(window.location.search).get('mode') === 'editor';

/** `?readonly=1`: read-only view of the shared document where reviewers/creators highlight and comment. */
export const isReadOnlyEmbed = (): boolean => new URLSearchParams(window.location.search).get('readonly') === '1';

/** The hosting portal signs this person in by putting a short-lived token in the URL's #token=; it is kept for this tab and the URL cleaned. */
export function adoptEmbedToken(): void {
  if (!isEmbedRoute()) return;
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
  if (!token) return;
  sessionStorage.setItem('token', token);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export const isEmbedded = (): boolean => typeof window !== 'undefined' && window.parent !== window;

export function allowedParentOrigins(): string[] {
  const raw = (import.meta.env.VITE_EMBED_PARENT_ORIGINS as string | undefined) || DEFAULT_PARENT_ORIGINS;
  return raw.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
}

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/** The hosting page's origin when it is on the allow-list, else null (from ?parent=, else the referrer). */
export function parentOrigin(): string | null {
  if (!isEmbedded()) return null;
  const asked = new URLSearchParams(window.location.search).get('parent');
  const candidate = (asked && originOf(asked)) || (document.referrer && originOf(document.referrer)) || null;
  return candidate && allowedParentOrigins().includes(candidate) ? candidate : null;
}

export function postToParent(message: EmbedOutbound): void {
  const origin = parentOrigin();
  if (origin) window.parent.postMessage(message, origin);
}

/** Calls `handler` for each valid message from the hosting page. Returns the unsubscribe function. */
export function listenToParent(handler: (message: EmbedInbound) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    const origin = parentOrigin();
    if (!origin || event.origin !== origin || event.source !== window.parent) return;
    const data = event.data as Record<string, unknown> | null;
    const type = data?.type;
    if (type === 'script-embed:close-request' || type === 'script-embed:refresh') handler(data as EmbedInbound);
    if (type === 'script-embed:token' && typeof data?.token === 'string') handler({ type, token: data.token });
    if (type === 'script-embed:notes' && Array.isArray(data?.notes)) {
      handler({
        type,
        notes: data.notes as EmbedInbound extends { type: 'script-embed:notes'; notes: infer N } ? N : never,
        activeNoteId: typeof data.activeNoteId === 'string' ? data.activeNoteId : null,
      });
    }
    if (type === 'script-embed:go-to-note' && typeof data?.id === 'string') handler({ type, id: data.id });
    if (type === 'script-embed:set-readonly' && typeof data?.readOnly === 'boolean') handler({ type, readOnly: data.readOnly });
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
