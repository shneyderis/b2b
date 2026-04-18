const TOKEN_KEY = 'winery_token';
const ROLE_KEY = 'winery_role';

function clearSessionCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('winery_cache:')) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, role: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  clearSessionCache();
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  clearSessionCache();
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
};

const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? (opts.body as any)
          : JSON.stringify(opts.body),
  });

  if (res.status === 401) {
    clearAuth();
    if (!location.pathname.startsWith('/login')) {
      location.assign('/login');
    }
    throw new ApiError(401, 'unauthorized');
  }

  if (opts.raw) return res as unknown as T;

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg = (isJson && data && (data as any).error) || res.statusText || 'request failed';
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    clearAuth();
    location.assign('/login');
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return await res.blob();
}
