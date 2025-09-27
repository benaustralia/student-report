import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { uploadImageToStorage, deleteImageFromStorage, generateImagePath } from '@/services/storageService';
import { compressImage } from '@/utils/imageUtils';

interface UseImageUploadV2Options {
  userId: string;
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: string) => void;
  onRemove?: () => void;
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

      // Compress the image first
      const compressedFile = await compressImage(file, 800, 0.8);
      
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

  // Initialize with existing image URL - this is the key fix
  const initializeWithUrl = useCallback((imageUrl: string | null) => {
    // Remove debug logs to reduce console noise
    
    // Always prioritize the Firebase URL over any file selection
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setPreview(imageUrl);
      
      // Clear any file selection since we're loading from database
      setFile(null);
    } else {
      setCurrentImageUrl(null);
      setPreview(null);
    }
  }, []); // Remove file dependency to prevent infinite loop

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
