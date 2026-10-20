/**
 * Filename and Path Sanitization Utility
 * Protects against path traversal, control characters, null bytes,
 * while preserving valid Unicode filenames.
 */

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  // Remove null bytes and control characters
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, '');

  // Normalize Unicode
  clean = clean.normalize('NFC');

  // Replace directory separators and path traversal sequences
  clean = clean.replace(/\\/g, '/');
  clean = clean.replace(/\.\.+/g, ''); // replace multiple dots like ..
  clean = clean.replace(/^[\/\\]+/, ''); // remove leading slashes

  // Extract base filename if path was provided
  const parts = clean.split('/');
  clean = parts[parts.length - 1] || 'unnamed_file';

  // Strip dangerous characters while preserving letters, numbers, unicode, dots, underscores, dashes
  clean = clean.replace(/[<>:"|?*]/g, '_').trim();

  // Ensure file is not just dots or empty
  if (!clean || clean === '.' || clean === '..') {
    return 'unnamed_file';
  }

  // Limit filename length to 255 chars
  if (clean.length > 255) {
    const extIndex = clean.lastIndexOf('.');
    if (extIndex > 0 && clean.length - extIndex < 10) {
      const ext = clean.substring(extIndex);
      clean = clean.substring(0, 255 - ext.length) + ext;
    } else {
      clean = clean.substring(0, 255);
    }
  }

  return clean;
}

export function detectCategoryFromMimeOrExt(mimeType: string, filename: string): 'videos' | 'documents' | 'images' | 'audio' | 'other' {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerExt = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';

  if (lowerMime.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'm4v', 'ts'].includes(lowerExt)) {
    return 'videos';
  }
  if (
    lowerMime.includes('pdf') ||
    lowerMime.includes('document') ||
    lowerMime.includes('text/') ||
    ['pdf', 'doc', 'docx', 'txt', 'epub', 'xlsx', 'csv', 'ppt', 'pptx'].includes(lowerExt)
  ) {
    return 'documents';
  }
  if (lowerMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(lowerExt)) {
    return 'images';
  }
  if (lowerMime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'opus'].includes(lowerExt)) {
    return 'audio';
  }
  return 'other';
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
