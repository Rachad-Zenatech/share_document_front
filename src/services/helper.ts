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

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
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
