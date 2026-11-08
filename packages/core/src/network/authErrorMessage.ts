import i18n from '../utils/i18n';
import { isRateLimited, serverMessageOf } from './serverMessage';

/**
 * What a failed sign-in, sign-up or password-reset call shows: the server's own
 * words; else, for the auth rate limit's wordless 429, "too many attempts";
 * else '' — the screen's own fallback. Without it a rate-limited sign-in read as
 * "Invalid email or password".
 */
export const authErrorMessageOf = (error: any): string =>
  serverMessageOf(error) || (isRateLimited(error) ? i18n.t('common.tooManyAttempts') : '');
