import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { uploadImageToStorage, deleteImageFromStorage, generateImagePath, refreshDownloadURL } from '@/services/storageService';
import { compressImage } from '@/utils/imageUtils';

interface UseImageUploadV2Options {
  userId: string;
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
  onInvalidUrl?: (reportId: string) => void | Promise<void>;
}

interface UseImageUploadV2Return {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  error: string | null;
  currentImageUrl: string | null;
  setFile: (file: File | null) => void;
  setPreview: (preview: string | null) => void;
  upload: () => Promise<string | null>;
  remove: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  initializeWithUrl: (imageUrl: string | null) => void;
}

export const useImageUploadV2 = ({
  userId,
  onSuccess,
  onError,
  onRemove,
  onInvalidUrl,
}: UseImageUploadV2Options): UseImageUploadV2Return => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const currentImageUrlRef = useRef<string | null>(null);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Keep ref in sync with state
  useEffect(() => {
    currentImageUrlRef.current = currentImageUrl;
  }, [currentImageUrl]);

  const upload = useCallback(async (): Promise<string | null> => {
    if (!file) {
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      // Delete old image from Firebase Storage if there's one
      const currentUrl = currentImageUrlRef.current;
      if (currentUrl) {
        await deleteImageFromStorage(currentUrl);
        // Note: deleteImageFromStorage handles errors internally and doesn't throw
      }

      // Compress the image first - higher quality for 300dpi printing
      const compressedFile = await compressImage(file, 1200, 0.9);
      
      // Generate storage path
      const storagePath = generateImagePath(userId, file.name);
      
      // Upload to Firebase Storage
      const downloadURL = await uploadImageToStorage(compressedFile, storagePath);
      
      // Update state with the Firebase URL
      setCurrentImageUrl(downloadURL);
      setPreview(downloadURL);
      
      // Clean up blob URL
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
      
      onSuccess?.(downloadURL);
      return downloadURL;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  }, [file, userId, onSuccess, onError]);

  const remove = useCallback(async () => {
    setUploading(true);
    setError(null);

    try {
      // Delete from Firebase Storage if there's a current image
      const currentUrl = currentImageUrlRef.current;
      if (currentUrl) {
        await deleteImageFromStorage(currentUrl);
        // Note: deleteImageFromStorage handles errors internally and doesn't throw
      }
      
      // Cleanup blob URL
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
      
      // Reset state
      setFile(null);
      setPreview(null);
      setCurrentImageUrl(null);
      
      onRemove?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Remove failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [preview, onRemove, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    // Cleanup blob URL
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    
    setFile(null);
    setPreview(null);
    setCurrentImageUrl(null);
    setError(null);
    setUploading(false);
  }, [preview]);

  // Initialize with existing image URL - validate that the file actually exists
  const initializeWithUrl = useCallback((imageUrl: string | null, reportId?: string) => {
    const resolve = async (raw: string) => {
      try {
        // Always try to refresh the URL to validate the file exists
        const refreshedUrl = await refreshDownloadURL(raw);
        
        if (!refreshedUrl) {
          // File doesn't exist (object-not-found) - clear the preview and URL
          console.warn('Image file not found in storage, clearing preview:', raw.substring(0, 100));
          setCurrentImageUrl(null);
          setPreview(null);
          // Notify parent to clear invalid URL from database
          if (reportId && onInvalidUrl) {
            await onInvalidUrl(reportId);
          }
          return;
        }
        
        // File exists - use the refreshed URL
        setCurrentImageUrl(refreshedUrl);
        setPreview(refreshedUrl);
      } catch (error: any) {
        // Only clear if it's an object-not-found error (file doesn't exist)
        // Don't clear for network errors, timeouts, or other temporary issues
        const isNotFound = error?.code === 'storage/object-not-found' || 
                          error?.message?.includes('object-not-found') ||
                          error?.message?.includes('404');
        
        if (isNotFound) {
          console.warn('Image file not found in storage, clearing preview:', raw.substring(0, 100));
          setCurrentImageUrl(null);
          setPreview(null);
          // Notify parent to clear invalid URL from database
          if (reportId && onInvalidUrl) {
            await onInvalidUrl(reportId);
          }
        } else {
          // Network error or other temporary issue - keep the URL but log the error
          console.warn('Temporary error validating image URL (keeping URL):', error);
          // Still try to use the original URL - it might work despite the validation error
          setCurrentImageUrl(raw);
          setPreview(raw);
        }
      }
    };

    if (imageUrl) {
      resolve(imageUrl);
      setFile(null);
    } else {
      setCurrentImageUrl(null);
      setPreview(null);
    }
  }, [onInvalidUrl]); // Include onInvalidUrl in dependencies

  return useMemo(() => ({
    file,
    preview,
    uploading,
    error,
    currentImageUrl,
    setFile,
    setPreview,
    upload,
    remove,
    clearError,
    reset,
    initializeWithUrl,
  }), [
    file,
    preview,
    uploading,
    error,
    currentImageUrl,
    upload,
    remove,
    clearError,
    reset,
    initializeWithUrl,
  ]);
};
