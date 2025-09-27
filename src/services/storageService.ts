import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Simple Firebase Storage service for images
 */
export const uploadImageToStorage = async (
  file: File, 
  path: string
): Promise<string> => {
  try {
    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the file
    await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading to Firebase Storage:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const deleteImageFromStorage = async (url: string): Promise<void> => {
  try {
    // Extract the path from the URL
    const urlObj = new URL(url);
    const path = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
    
    if (!path) {
      throw new Error('Invalid storage URL');
    }
    
    // Create reference and delete
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    // Handle specific Firebase Storage errors
    if (error?.code === 'storage/object-not-found') {
      // File doesn't exist - this is fine, just return silently
      return;
    }
    
    // For other errors, log them but don't throw
    console.error('Error deleting from Firebase Storage:', error);
    // Don't throw - deletion failures shouldn't break the app
  }
};

export const generateImagePath = (studentId: string, filename: string): string => {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `student-reports/${studentId}/${timestamp}_${sanitizedFilename}`;
};
