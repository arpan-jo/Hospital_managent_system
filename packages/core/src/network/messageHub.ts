/**
 * The real-time channel the portal listens on — SignalR at `/hms/hubs/messages`.
 * The backend pushes `MessageReceived` to the patient's own group
 * (`portal-user-{id}`) when a doctor replies; a client only listens. The hub is
 * outside the API's encryption, and the login goes up as `access_token` on
 * the socket, which the backend reads for `/hms/hubs`.
 */
import { API_URL } from '@env';
import { HttpTransportType, HubConnection, HubConnectionBuilder, ILogger, LogLevel } from '@microsoft/signalr';

export const MESSAGE_HUB_PATH = '/hms/hubs/messages';

/** What the backend sends when a doctor replies — the listeners read again. */
export const MESSAGE_RECEIVED = 'MessageReceived';

/**
 * The hub's own notes, only in a debug build — connecting, the transport,
 * drops — as plain logs: a `console.warn`/`error` would put a red box over the
 * app for what is only a dropped socket, and polling covers for it anyway.
 */
const hubLogger: ILogger = {
  log: (level: LogLevel, message: string) => {
    if (__DEV__ && level >= LogLevel.Information) console.log('message hub ==>', message);
  },
};

/**
 * A connection to the message hub, not yet started — null when the app has no
 * API host. `getToken` is asked on every (re)connect, so a refreshed login is
 * used without building a new connection.
 *
 * It goes straight to a WebSocket, without the negotiate step the portal makes:
 * the negotiate URL is built by setting `URL.pathname`, which React Native's
 * `URL` cannot do (the start fails with "Cannot assign to property 'pathname'");
 * and a socket that skips it needs no sticky session behind the gateway. The
 * login goes up as a Bearer header — the client sends one on React Native.
 */
export const createMessageHub = (getToken: () => string | null | undefined): HubConnection | null => {
  if (!API_URL) return null;
  return new HubConnectionBuilder()
    .withUrl(`${API_URL}${MESSAGE_HUB_PATH}`, {
      accessTokenFactory: () => getToken?.() ?? '',
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect()
    .configureLogging(hubLogger)
    .build();
};
