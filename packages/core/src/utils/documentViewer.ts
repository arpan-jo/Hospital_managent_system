import { viewDocument as nativeViewDocument } from '@react-native-documents/viewer';

export interface ViewDocumentConfig {
  /**
   * The local file path or URI (should start with file://, content://, etc.)
   */
  uri: string;
  /**
   * iOS only: Custom title to display in the document viewer header.
   */
  title?: string;
  /**
   * Optional but strongly recommended: the mime-type of the document.
   * This helps Android find the correct application to view the file.
   */
  mimeType?: string;
}

/**
 * Utility to view a local document using native OS viewers.
 * On iOS, it launches QuickLook. On Android, it uses the ACTION_VIEW intent.
 * Note: For remote URLs (http/https), download the document locally first.
 */
export const viewDocument = async ({ uri, title, mimeType }: ViewDocumentConfig): Promise<null> => {
  let targetUri = uri;
  // Ensure local paths have the file:// prefix if they don't have a scheme already
  if (
    !uri.startsWith('http://') &&
    !uri.startsWith('https://') &&
    !uri.startsWith('file://') &&
    !uri.startsWith('content://')
  ) {
    targetUri = `file://${uri}`;
  }

  return nativeViewDocument({
    uri: targetUri,
    headerTitle: title,
    mimeType,
  });
};
