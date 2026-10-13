import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { API_URL } from '@env';
import { rootStore } from '../store';
import { encryptData, decryptData } from '../utils/crypto';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Encrypt the request (on by default) */
    encrypt?: boolean;
    /** Decrypt the response (on by default) */
    decrypt?: boolean;
    /** Log the response / error */
    isConsole?: boolean;
    /** Log the url and the plain payload */
    isConsoleParams?: boolean;
    /** Log the encrypted payload / params */
    isConsoleEncrypted?: boolean;
  }
}

const API_TIMEOUT = 10000;

export const IS_API_ENCRYPTION_ENABLED = true;
export const IS_API_DECRYPTION_ENABLED = true;

/**
 * Defaults for the per-request logging flags. Logging is opt-in: pass
 * `isConsole` / `isConsoleParams` / `isConsoleEncrypted` on the calls being
 * debugged. Flip these to `true` to turn a category on for every call at once.
 * All logging is additionally gated behind `__DEV__`.
 */
export const IS_API_CONSOLE_ENABLED = false;
export const IS_API_CONSOLE_PARAMS_ENABLED = false;
export const IS_API_CONSOLE_ENCRYPTED_ENABLED = false;

export const apiClient = axios.create({
  baseURL: API_URL || '',
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
  },
});

/**
 * Serialises params into the query string that goes on to be encrypted.
 *
 * The values must be percent-encoded here: the backend decrypts the blob and
 * feeds it straight back through ASP.NET's own query parser, so a raw `&` in a
 * value would split it into a second parameter, and a raw space or Bengali text
 * would not survive the round trip. `URLSearchParams` matches the web client's
 * serialisation exactly, including repeating the key for an array value.
 */
const buildQueryString = (params: Record<string, any>): string => {
  const search = new URLSearchParams();

  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value?.forEach(item => search.append(key, String(item ?? '')));
        return;
      }
      search.append(key, String(value));
    });

  return search.toString();
};

/**
 * REQUEST INTERCEPTOR
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add authorization token
    const token = rootStore.authStore.authToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check whether encryption is enabled
    const shouldEncrypt = config.encrypt ?? IS_API_ENCRYPTION_ENABLED;

    // Url + plain payload
    const shouldLogParams =
      __DEV__ && (config.isConsoleParams ?? IS_API_CONSOLE_PARAMS_ENABLED);

    // Ciphertext actually put on the wire
    const shouldLogEncrypted =
      __DEV__ && (config.isConsoleEncrypted ?? IS_API_CONSOLE_ENCRYPTED_ENABLED);

    // Kept for logging, since these are replaced by the ciphertext below
    const plainPayload = config.data;
    const plainParams = config.params;
    const plainUrl = `${config.baseURL || ''}${config.url || ''}`;

    if (shouldEncrypt) {
      /**
       * QUERY STRING
       *
       * The backend expects everything after `?` to be a single encrypted
       * blob, so params must be serialised here instead of letting axios
       * append them after this interceptor has run.
       *
       * The blob is URL-encoded on the way out: Base64 contains `+`, `/` and
       * `=`, which a query string reads as separators — a `+` alone would
       * arrive as a space and break the decrypt. The backend runs
       * `Uri.UnescapeDataString` before decrypting, so it expects this.
       */
      const url = config.url || '';
      const inlineQuery = url.includes('?')
        ? url.slice(url.indexOf('?') + 1)
        : '';
      const paramQuery = config.params ? buildQueryString(config.params) : '';
      const query = [inlineQuery, paramQuery].filter(Boolean).join('&');

      if (query) {
        const encryptedQuery = encryptData(query);

        config.url = `${url.split('?')[0]}?${encodeURIComponent(
          encryptedQuery,
        )}`;
        delete config.params;

        if (shouldLogEncrypted) {
          console.log(
            `Encrypted_Params for==> ${config.baseURL || ''}${config.url}`,
          );
        }
      }

      /**
       * BODY
       *
       * The backend expects the raw ciphertext as the body:
       *
       * Correct:
       * U2FsdGVkX1...
       *
       * NOT:
       * "U2FsdGVkX1..."   <- quoted JSON string
       */
      if (config.data !== undefined && config.data !== null) {
        const encryptedData = encryptData(config.data);

        config.data = encryptedData;

        /**
         * axios >= 1 runs the default transformRequest on string bodies when
         * Content-Type is application/json, which JSON-stringifies the
         * ciphertext and wraps it in quotes. Send it through untouched.
         */
        config.transformRequest = [(data: any) => data];

        if (shouldLogEncrypted) {
          console.log(`Encrypted_Payload for==> ${plainUrl} ==>`, encryptedData);
        }
      }

      if (config.headers) {
        config.headers['Content-Type'] = 'application/json';
      }
    }

    if (shouldLogParams) {
      console.log(
        'api_params/payload ==>',
        JSON.stringify(
          {
            method: config.method?.toUpperCase(),
            url: plainUrl,
            params: plainParams,
            data: plainPayload,
            headers: config.headers,
          },
          null,
          2,
        ),
      );
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

/**
 * RESPONSE INTERCEPTOR
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const shouldDecrypt = response.config.decrypt ?? IS_API_DECRYPTION_ENABLED;

    // Response-side logging
    const shouldLog =
      __DEV__ && (response.config.isConsole ?? IS_API_CONSOLE_ENABLED);

    if (shouldDecrypt && typeof response.data === 'string' && response.data) {
      try {
        /**
         * Backend returns encrypted response directly,
         * not inside { payload: ... }.
         */
        const decryptedData = decryptData(response.data);

        response.data = decryptedData;
      } catch (error) {
        if (shouldLog) {
          console.warn('decryption_failed ==>', error);
        }
      }
    }

    if (shouldLog) {
      console.log(
        `api_response for==> ${response.config.url} ==>`,
        JSON.stringify(response.data, null, 2),
      );
    }

    return response;
  },

  (error: AxiosError) => {
    // Error logging follows the same flag as successful responses
    const shouldLog =
      __DEV__ && (error.config?.isConsole ?? IS_API_CONSOLE_ENABLED);

    let errorMessage = 'Something went wrong';
    let responseData: any = error.response?.data;

    /**
     * SERVER ERROR
     */
    if (error.response) {
      /**
       * Backend error response is also encrypted.
       *
       * Example:
       * Mk5NcHznIxbu7ofX/...
       *
       * Decrypt it before handling the error.
       */
      if (typeof responseData === 'string' && responseData) {
        try {
          responseData = decryptData(responseData);
        } catch (decryptError) {
          if (shouldLog) {
            console.warn('error_decryption_failed ==>', decryptError);
          }
        }
      }

      /**
       * Extract useful error message
       */
      if (typeof responseData === 'object' && responseData !== null) {
        errorMessage =
          responseData?.message ||
          responseData?.Message ||
          responseData?.detail ||
          responseData?.title ||
          responseData?.errors?.['']?.[0] ||
          `Error: ${error.response.status}`;
      } else if (typeof responseData === 'string') {
        errorMessage = responseData || `Error: ${error.response.status}`;
      } else {
        errorMessage = `Error: ${error.response.status}`;
      }

      /**
       * Auto logout when token is invalid/expired
       */
      if (error.response.status === 401) {
        rootStore.authStore.logout();
        rootStore.profileStore.clear();
      }
    } else if (error.request) {

    /**
     * NO RESPONSE FROM SERVER
     */
      errorMessage =
        'Network error: No response from server. Please check your internet connection.';
    } else {

    /**
     * REQUEST CONFIGURATION ERROR
     */
      errorMessage = error.message;
    }

    if (shouldLog) {
      console.warn(
        `error_response for==> ${error.config?.baseURL || ''}${
          error.config?.url || ''
        } ==>`,
        JSON.stringify(
          {
            method: error.config?.method?.toUpperCase(),
            status: error.response?.status,
            message: errorMessage,
            data: responseData,
          },
          null,
          2,
        ),
      );
    }

    /**
     * Create clean application-level error
     */
    const customError = new Error(errorMessage);

    (customError as any).status = error.response?.status;

    (customError as any).data = responseData;

    (customError as any).originalError = error;

    return Promise.reject(customError);
  },
);

export default apiClient;
