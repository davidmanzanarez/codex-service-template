const API_BASE = '/api';
const isProd = import.meta.env.PROD;
const HUB_URL = import.meta.env.VITE_HUB_URL || (isProd ? '' : 'http://localhost:4000');
const SELF_URL = import.meta.env.VITE_SELF_URL || (isProd ? '' : 'http://localhost:3000');

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return { error: errorData.error || 'Unauthorized' };
      }
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    return { data: await response.json() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
  loginUrl?: string;
}

export type ItemStatus = 'todo' | 'doing' | 'done';

export interface Item {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: ItemStatus;
  createdAt: number;
  updatedAt: number;
}

// API
export const api = {
  auth: {
    me: () => fetchApi<AuthStatus>('/auth/me'),
    logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    loginUrl: () => `${HUB_URL}/api/auth/google?returnTo=${encodeURIComponent(`${SELF_URL}/api/auth/callback`)}`,
  },

  items: {
    list: (params?: { status?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return fetchApi<{ items: Item[] }>(`/items${qs ? `?${qs}` : ''}`);
    },
    create: (data: { title: string; description?: string; status?: ItemStatus }) =>
      fetchApi<{ item: Item }>('/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pick<Item, 'title' | 'description' | 'status'>>) =>
      fetchApi<{ item: Item }>(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ deleted: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  },
};
