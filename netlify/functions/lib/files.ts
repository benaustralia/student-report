// Artwork and PDFs live in Netlify Blobs under the same keys the old Firebase bucket used
// (student-reports/students/<folder>/...). URLs handed to the client are /api/files/<key>,
// which never expire — the session cookie is the only access control.
//
//   PUT|POST /api/files/<key>   raw body, Content-Type header   → { url }
//   GET      /api/files/<key>                                   → the bytes
//   HEAD     /api/files/<key>                                   → 200 / 404
//   DELETE   /api/files/<key>                                   → 204
import { getStore } from '@netlify/blobs';
import { HttpError, json } from './http.ts';

export interface FileStore {
  set(key: string, data: ArrayBuffer, opts: { metadata: Record<string, string> }): Promise<void>;
  getWithMetadata(key: string, opts: { type: 'arrayBuffer' }): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown>; etag?: string } | null>;
  getMetadata(key: string): Promise<{ metadata: Record<string, unknown>; etag?: string } | null>;
  delete(key: string): Promise<void>;
}

export const defaultStore = (): FileStore => getStore({ name: 'files', consistency: 'strong' }) as unknown as FileStore;

const KEY_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/()]*$/u;
export const validKey = (key: string) => KEY_RE.test(key) && !key.includes('..') && !key.endsWith('/') && key.length <= 512;

export const fileUrl = (key: string) => `/api/files/${key.split('/').map(encodeURIComponent).join('/')}`;

export const handleFiles = async (req: Request, rawKey: string, store: FileStore = defaultStore()): Promise<Response> => {
  const key = rawKey.split('/').map(s => { try { return decodeURIComponent(s); } catch { return s; } }).join('/');
  if (!validKey(key)) throw new HttpError(400, 'Invalid file key');
  const method = req.method.toUpperCase();

  if (method === 'PUT' || method === 'POST') {
    const contentType = req.headers.get('content-type') || 'application/octet-stream';
    const data = await req.arrayBuffer();
    if (data.byteLength === 0) throw new HttpError(400, 'Empty body');
    await store.set(key, data, { metadata: { contentType, size: String(data.byteLength), uploadedAt: new Date().toISOString() } });
    return json({ url: fileUrl(key), key }, 201);
  }
  if (method === 'HEAD') {
    const meta = await store.getMetadata(key);
    return new Response(null, { status: meta ? 200 : 404, headers: meta ? { 'content-type': String(meta.metadata.contentType ?? 'application/octet-stream') } : {} });
  }
  if (method === 'GET') {
    const blob = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!blob) throw new HttpError(404, 'File not found');
    return new Response(blob.data, {
      status: 200,
      headers: {
        'content-type': String(blob.metadata.contentType ?? 'application/octet-stream'),
        'content-length': String(blob.data.byteLength),
        'cache-control': 'private, no-cache',
        ...(blob.etag ? { etag: blob.etag } : {}),
      },
    });
  }
  if (method === 'DELETE') {
    await store.delete(key);
    return new Response(null, { status: 204 });
  }
  throw new HttpError(405, 'Unsupported method');
};
