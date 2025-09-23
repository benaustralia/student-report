import { useState, useCallback, useEffect, useMemo } from 'react';
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

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const upload = useCallback(async (): Promise<string | null> => {
    if (!file) {
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      // Delete old image from Firebase Storage if there's one
      if (currentImageUrl) {
        try {
          await deleteImageFromStorage(currentImageUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old image:', deleteError);
          // Continue with upload even if deletion fails
        }
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
  }, [file, userId, preview, currentImageUrl, onSuccess, onError]);

  const remove = useCallback(async () => {
    setUploading(true);
    setError(null);

    try {
      // Delete from Firebase Storage if there's a current image
      if (currentImageUrl) {
        await deleteImageFromStorage(currentImageUrl);
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
  }, [currentImageUrl, preview, onRemove, onError]);

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
    console.log('useImageUploadV2: initializeWithUrl called with:', imageUrl);
    
    // Always prioritize the Firebase URL over any file selection
    if (imageUrl) {
      console.log('useImageUploadV2: Setting Firebase image URL:', imageUrl);
      setCurrentImageUrl(imageUrl);
      setPreview(imageUrl);
      
      // Clear any file selection since we're loading from database
      setFile(null);
    } else {
      console.log('useImageUploadV2: Clearing image');
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
