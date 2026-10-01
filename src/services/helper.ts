export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError((err as { detail: string }).detail || "Request failed", res.status);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json() as Promise<T>;
}