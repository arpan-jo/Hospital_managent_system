import axios, { AxiosInstance } from 'axios';

/**
 * What a request carries, in a form JSON can show. A recording goes up as
 * FormData, which stringifies to `{}`, so its parts are listed instead — the
 * file as the uri, name and type it was appended with.
 */
const describeAiBody = (data: unknown): unknown => {
  if (!(data instanceof FormData)) return data;

  const parts: Array<[string, unknown]> = (data as any)?._parts ?? [];
  return { formData: parts.map(([field, value]) => ({ field, value })) };
};

/**
 * What came back, in a form a log line can hold. pepobot's spoken answer
 * (`audio_base64`) runs to hundreds of KB and would push everything else past
 * the log's line limit, so only its size is shown.
 */
const describeAiAnswer = (data: unknown): unknown => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

  const audio = (data as Record<string, unknown>)?.audio_base64;
  if (typeof audio !== 'string') return data;
  return { ...data, audio_base64: `<${audio.length} chars>` };
};

/*
 * The same opt-in logging the HMS client gives its calls, in dev builds only:
 * `isConsoleParams` prints what is sent, `isConsole` what comes back (or the
 * error). The AI clients have none of `apiClient`'s interceptors, so without
 * these the flags would do nothing there. Headers are never printed — the
 * speech-to-text key travels in one.
 */
export const attachAiLogging = (client: AxiosInstance): void => {
  client.interceptors.request.use(config => {
    if (__DEV__ && config?.isConsoleParams) {
      console.log(
        'ai_params/payload ==>',
        JSON.stringify(
          {
            method: config?.method?.toUpperCase(),
            url: `${config?.baseURL ?? ''}${config?.url ?? ''}`,
            data: describeAiBody(config?.data),
          },
          null,
          2,
        ),
      );
    }
    return config;
  });

  client.interceptors.response.use(
    response => {
      if (__DEV__ && response?.config?.isConsole) {
        // Unindented: Android's log cuts a line at about 4 KB, and an answer
        // printed with indentation runs past it.
        console.log(
          `ai_response for==> ${response?.config?.url} ==>`,
          JSON.stringify(describeAiAnswer(response?.data)),
        );
      }
      return response;
    },
    error => {
      // A cancelled ask is the user closing or cancelling, not something to read.
      if (__DEV__ && error?.config?.isConsole && !axios.isCancel(error)) {
        console.log(
          `ai_error for==> ${error?.config?.url} ==>`,
          JSON.stringify(
            {
              status: error?.response?.status ?? null,
              // e.g. ECONNABORTED for a timeout, ERR_NETWORK when unreachable.
              code: error?.code ?? null,
              message: error?.message ?? null,
              timeoutMs: error?.config?.timeout ?? null,
              data: error?.response?.data ?? null,
            },
            null,
            2,
          ),
        );
      }
      return Promise.reject(error);
    },
  );
};
