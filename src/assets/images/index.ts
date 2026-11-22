import { ImageSourcePropType } from 'react-native';

/**
 * Central registry for bundled images.
 *
 * Screens import from here instead of calling `require()` inline, so the
 * relative paths live in one file and every asset is discoverable in one place.
 * `require` is mandatory for static assets — Metro resolves these at build time,
 * so the path must be a literal and cannot be built from a variable.
 */
export const images = {
  /** "AKIJ MEDIPLEX LIMITED", the web's own logo (akij-mediplex-logo.png, 640×254). */
  logo: require('./logo-akij-mediplex.png'),
  /** Google's "G", taken from the web's sign-in button. */
  google: require('./google.png'),
} satisfies Record<string, ImageSourcePropType>;

export default images;
