import { refreshDownloadURL } from '@/services/storageService';

export async function convertUrlToDataUrl(url: string): Promise<string> {
  let effectiveUrl = url;
  const isFirebase = effectiveUrl.includes('firebasestorage.googleapis.com');
  if (isFirebase) {
    try { effectiveUrl = await refreshDownloadURL(effectiveUrl); } catch {}
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!isFirebase) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/jpeg', 0.9)); }
        catch (e) {
          if (isFirebase) { resolve(effectiveUrl); }
          else { reject(e instanceof Error ? e : new Error('Failed to export canvas')); }
        }
      } catch (error) { reject(error instanceof Error ? error : new Error('Canvas conversion failed')); }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${effectiveUrl}`));
    img.src = effectiveUrl;
  });
}
