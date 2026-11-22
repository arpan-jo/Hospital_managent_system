import { AxiosRequestConfig, Method } from 'axios';
import { apiClient } from './apiClient';

/**
 * A write (POST, PUT, PATCH, DELETE) waits this long unless the call sets its
 * own time. The portal sets no limit at all. The client's 10 s default made a
 * slow save look like a failure even when the server had in fact taken it, and
 * a retry then made it twice (a home-collection order, a document). Reads keep
 * the client's default.
 */
export const WRITE_TIMEOUT_MS = 30_000;

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

const isWrite = (method?: Method | string) =>
  WRITE_METHODS.includes(String(method ?? 'GET')?.toLowerCase?.() ?? '');

export interface ApiRequestOptions<TData = any> {
  url: string;
  method?: Method;
  data?: TData;
  params?: any;
  baseUrl?: string;
  headers?: any;
  encrypt?: boolean;
  decrypt?: boolean;
  /** Overrides the client's default timeout — for uploads and other slow calls. */
  timeout?: number;
  /** For endpoints that answer with a file rather than JSON — e.g. a PDF. */
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';
  /** Log the response / error for this call (dev only) */
  isConsole?: boolean;
  /** Log the url and the plain payload for this call (dev only) */
  isConsoleParams?: boolean;
  /** Log the encrypted payload / params for this call (dev only) */
  isConsoleEncrypted?: boolean;
}

export async function apiRequest<TResponse = any, TData = any>({
  url,
  method = 'GET',
  data,
  params,
  baseUrl,
  headers,
  encrypt,
  decrypt,
  timeout,
  responseType,
  isConsole,
  isConsoleParams,
  isConsoleEncrypted,
}: ApiRequestOptions<TData>): Promise<TResponse> {
  const config: AxiosRequestConfig = {
    url,
    method,
    data,
    params,
    headers,
    encrypt,
    decrypt,
    isConsole,
    isConsoleParams,
    isConsoleEncrypted,
  };

  // The call's own time first; a write without one gets the longer write time.
  const wait = timeout || (isWrite(method) ? WRITE_TIMEOUT_MS : undefined);
  if (wait) {
    config.timeout = wait;
  }

  if (responseType) {
    config.responseType = responseType;
  }

  if (baseUrl) {
    config.baseURL = baseUrl;
  }

  const response = await apiClient.request<TResponse>(config);
  return response?.data;
}

export default apiRequest;
