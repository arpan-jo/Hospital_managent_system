import i18n from '../utils/i18n';
import { isRateLimited, isServerUnreachable, serverMessageOf } from './serverMessage';

/**
 * What a failed sign-in, sign-up or password-reset call shows: the server's own
 * words; else, for the auth rate limit's wordless 429, "too many attempts";
 * else, when no answer came at all (offline, unreachable, timed out), that the
 * connection is the trouble; else '' — the screen's own fallback. Without these
 * a rate-limited or offline sign-in read as "Invalid email or password".
 */
export const authErrorMessageOf = (error: any): string =>
  serverMessageOf(error) ||
  (isRateLimited(error) ? i18n.t('common.tooManyAttempts') : '') ||
  (isServerUnreachable(error) ? i18n.t('common.noConnection') : '');
