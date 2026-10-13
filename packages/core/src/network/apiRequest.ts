import { AxiosRequestConfig, Method } from 'axios';
import { apiClient } from './apiClient';

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

  if (timeout) {
    config.timeout = timeout;
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
