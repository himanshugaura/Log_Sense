import axios, { type InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/**
 * Attaches a dynamic getter function for the Clerk JWT session token.
 */
let tokenProvider: (() => Promise<string | null>) | null = null;

export const setTokenProvider = (provider: () => Promise<string | null>) => {
  tokenProvider = provider;
};

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (tokenProvider) {
      try {
        const token = await tokenProvider();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Continue unauthenticated if token resolution fails
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  [key: string]: unknown;
}
