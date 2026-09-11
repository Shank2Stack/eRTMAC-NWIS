/**
 * frontend/src/api/client.ts
 * Base HTTP client for eRTMAC-NWIS FastAPI backend.
 */

const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8765';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

const TOKEN_KEY = 'ertmac_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Safely encode well IDs that may contain forward slashes, e.g. "NO 15/9-F-1 C"
 */
export function encodeWellId(wellId: string): string {
  return encodeURIComponent(wellId);
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to the backend server. Please verify the backend is running.',
      0
    );
  }

  if (response.status === 401) {
    removeToken();
    window.dispatchEvent(new CustomEvent('ertmac-auth-expired'));
    let detail = 'Authentication required or session expired.';
    try {
      const errData = await response.json();
      if (errData?.detail) detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
    } catch {
      // ignore JSON parse error
    }
    throw new ApiError(detail, 401);
  }

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    let errData: any = null;
    try {
      errData = await response.json();
      if (errData?.detail) {
        errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // fallback to status text
      errorDetail = response.statusText || errorDetail;
    }
    throw new ApiError(errorDetail, response.status, errData);
  }

  // If 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json();
  } catch {
    return {} as T;
  }
}
