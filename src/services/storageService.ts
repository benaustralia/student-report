// Artwork and PDFs are stored in Netlify Blobs behind /api/files/<key>. URLs never expire,
// so "refreshing" a URL is now just an existence check (HEAD).
import { api } from './http';

const API_PREFIX = '/api/files/';
export const isApiFileUrl = (url: string) => url.startsWith(API_PREFIX) || url.includes(`${window.location.origin}${API_PREFIX}`);

const encodeKey = (key: string) => key.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');

/** Turns a storage key (student-reports/students/…/file.jpg) into its /api/files URL. */
export const urlForKey = (key: string) => `${API_PREFIX}${encodeKey(key)}`;

export const uploadImageToStorage = async (file: File, path: string): Promise<string> => {
  const { url } = await api<{ url: string }>(urlForKey(path), { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
  return url;
};

export const uploadFileToStorage = async (blob: Blob, path: string, contentType: string): Promise<string> => {
  const { url } = await api<{ url: string }>(urlForKey(path), { method: 'PUT', body: blob, headers: { 'content-type': contentType } });
  return url;
};

export const deleteImageFromStorage = async (url: string): Promise<void> => {
  if (!isApiFileUrl(url)) return; // not ours (e.g. a leftover Firebase URL) — nothing to delete
  try { await api(toPath(url), { method: 'DELETE' }); }
  catch (error) { console.error('Error deleting file:', error); }
};

export const deleteFileFromStorage = deleteImageFromStorage;

export const generateImagePath = (studentId: string, filename: string): string => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const cleanPath = studentId.replace(/^\/+|\/+$/g, '');
  return `student-reports/students/${cleanPath}/profile_${sanitizedFilename}`;
};

// Shared folder naming to keep artwork and PDFs in the same place
export const buildStudentFolderName = (firstName: string, lastName: string | undefined, classDay: string | undefined): string => {
  const base = `${firstName || ''} ${lastName || ''}`.trim();
  const day = (classDay || 'Unknown').trim();
  return `${base}-${day}`
    .replace(/[()]/g, '')
    .replace(/[\n\r\t/]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const toPath = (urlOrPath: string): string => {
  if (/^https?:\/\//i.test(urlOrPath)) return new URL(urlOrPath).pathname;
  return urlOrPath.startsWith('/') ? urlOrPath : urlForKey(urlOrPath);
};

/**
 * Returns a usable URL for the file, or null if it no longer exists.
 * Anything that is not one of our /api/files URLs is returned untouched — the app must not
 * clear a report's artwork just because a legacy URL could not be checked.
 */
export const refreshDownloadURL = async (urlOrPath: string): Promise<string | null> => {
  const path = toPath(urlOrPath);
  if (!path.startsWith(API_PREFIX)) return urlOrPath;
  try {
    const res = await fetch(path, { method: 'HEAD', credentials: 'same-origin' });
    if (res.status === 404) return null;
    return path;
  } catch (error) {
    console.error('Error checking file:', error);
    return path; // network blip: keep the URL rather than wiping it
  }
};

/** Same-origin URLs are already public to a signed-in user; nothing to rewrite. */
export const toPublicURL = (urlOrPath: string): string => toPath(urlOrPath);
