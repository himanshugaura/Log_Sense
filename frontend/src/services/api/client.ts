/**
 * Unified Backend REST API Client for LogSense
 * Handles authentication header injection (Clerk session token),
 * CORS credentials, file uploads, and standard JSON requests.
 */

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (options?: { template?: string }) => Promise<string | null>;
      };
      user?: any;
    };
  }
}

export type TokenGetter = () => Promise<string | null>;

let globalTokenGetter: TokenGetter | null = null;

export const setAuthTokenGetter = (getter: TokenGetter | null) => {
  globalTokenGetter = getter;
};

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    // Strip trailing slash if present
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  get isBackendConnected(): boolean {
    return Boolean(this.baseUrl && this.baseUrl.trim().length > 0);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      if (globalTokenGetter) {
        const token = await globalTokenGetter();
        if (token) return token;
      }
      if (typeof window !== 'undefined' && window.Clerk?.session?.getToken) {
        return await window.Clerk.session.getToken();
      }
    } catch (err) {
      console.warn('Failed to resolve Clerk auth token:', err);
    }
    return null;
  }

  async fetchEndpoint<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers = new Headers(options.headers || {});

    // Set JSON content-type if not FormData and not already specified
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      let errorMessage = `API request to ${endpoint} failed with HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Fallback to HTTP status text
      }
      const error = new Error(errorMessage) as Error & { status: number };
      error.status = res.status;
      throw error;
    }

    return (await res.json()) as T;
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.fetchEndpoint<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
}

export const apiClient = new ApiClient();
