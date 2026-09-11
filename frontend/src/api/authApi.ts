/**
 * frontend/src/api/authApi.ts
 * Real authentication endpoints for eRTMAC-NWIS FastAPI backend.
 */

import { apiFetch, setToken, removeToken } from './client';
import type { LoginRequest, LoginResponse, CurrentUser } from '../types/api';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (data.access_token) {
    setToken(data.access_token);
  }

  return data;
}

export async function getMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/api/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  } finally {
    removeToken();
  }
}
