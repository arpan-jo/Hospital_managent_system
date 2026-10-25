/**
 * Bangladesh mobile numbers, the way the backend accepts them: `01[3-9]` and
 * eleven digits in all (`AuthService` checks `^01[3-9]\d{8}$`). People type
 * them with a country code (`+88`, `88`, or `0088` as dialled from abroad),
 * spaces or dashes, so the number is brought to that local form first — the
 * `0` belongs to the local number (`+880 1XXX…` is `01XXX…`). The web's `lib/validation.ts` strips
 * `+880` instead, and so rejects the `+8801XXXXXXXXX` form its own message suggests.
 */

const BD_MOBILE_PATTERN = /^01[3-9]\d{8}$/;

/** '+880 1XXX-XXXXXX' or '00880 1XXX…' → '01XXXXXXXXX': formatting and the country code dropped. */
export const toLocalBdMobile = (value?: string | null): string =>
  String(value ?? '')
    .trim()
    .replace(/[\s\-().]/g, '')
    .replace(/^(?:\+|00)?88(?=01)/, '');

/** True for a Bangladesh mobile number in any of the usual ways of writing one. */
export const isBdMobile = (value?: string | null): boolean =>
  BD_MOBILE_PATTERN.test(toLocalBdMobile(value));
