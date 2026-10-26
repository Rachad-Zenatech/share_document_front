import { isGuestSession } from './guestInvite';

export class ApiError extends Error {
  status: number;
  /** The response's raw `detail`, which may be an object (e.g. a 409 carrying the current record). */
  detail?: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function getApiErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

export const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect';
export const SESSION_EXPIRED_REASON = 'session_expired';

let sessionExpiryHandled = false;

export function handleUnauthorized(res: Response): void {
  if (res.status !== 401 || sessionExpiryHandled) return;
  if (/\/api\/auth\//.test(res.url)) return;
  if (window.location.pathname.startsWith('/login')) return;
  // Guest contributors have no session to expire; app-wide calls (permissions...) 401 for them.
  if (isGuestSession()) return;

  sessionExpiryHandled = true;
  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, window.location.pathname + window.location.search);
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('ms_id_token');
  window.location.assign(`/login?reason=${SESSION_EXPIRED_REASON}`);
}

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    handleUnauthorized(res);
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = (err as { detail?: unknown }).detail;
    const message =
      typeof detail === 'string'
        ? detail
        : (detail as { message?: string } | undefined)?.message || 'Request failed';
    throw new ApiError(message, res.status, detail);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json() as Promise<T>;
}
