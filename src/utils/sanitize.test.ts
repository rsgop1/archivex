import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename, detectCategoryFromMimeOrExt, formatBytes } from './sanitize.ts';

test('sanitizeFilename removes path traversal attempts', () => {
  assert.equal(sanitizeFilename('../../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('..\\..\\windows\\system32.dll'), 'system32.dll');
  assert.equal(sanitizeFilename('folder/subfolder/document.pdf'), 'document.pdf');
});

test('sanitizeFilename preserves unicode and common symbols', () => {
  assert.equal(sanitizeFilename('Physics_Lecture_1_हिन्दी.mp4'), 'Physics_Lecture_1_हिन्दी.mp4');
  assert.equal(sanitizeFilename('Calculus Notes 2026.pdf'), 'Calculus Notes 2026.pdf');
  assert.equal(sanitizeFilename('document with:bad*chars?.pdf'), 'document with_bad_chars_.pdf');
});

test('detectCategoryFromMimeOrExt categorizes media correctly', () => {
  assert.equal(detectCategoryFromMimeOrExt('video/mp4', 'lecture.mp4'), 'videos');
  assert.equal(detectCategoryFromMimeOrExt('application/pdf', 'notes.pdf'), 'documents');
  assert.equal(detectCategoryFromMimeOrExt('image/png', 'diagram.png'), 'images');
  assert.equal(detectCategoryFromMimeOrExt('audio/mpeg', 'podcast.mp3'), 'audio');
  assert.equal(detectCategoryFromMimeOrExt('application/octet-stream', 'archive.zip'), 'other');
});

test('formatBytes formats file sizes correctly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(1073741824), '1 GB');
});
