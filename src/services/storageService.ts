import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { getStorageInstance } from '../config/firebase';

// Lazy-loaded Storage instance
const storage = getStorageInstance();

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
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `student-reports/${studentId}/profile_${sanitizedFilename}`;
};

/**
 * Get a fresh download URL from a Firebase Storage URL
 * Useful when the old download token has expired
 */
export const refreshDownloadURL = async (urlOrPath: string): Promise<string> => {
  try {
    // Accept either a full download URL or a storage path
    let path = '';
    if (/^https?:\/\//i.test(urlOrPath)) {
      const urlObj = new URL(urlOrPath);
      path = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
    } else {
      path = urlOrPath.replace(/^\/+/, '');
    }
    
    if (!path) {
      throw new Error('Invalid storage URL');
    }
    
    // Create reference and get fresh download URL
    const storageRef = ref(storage, path);
    const freshURL = await getDownloadURL(storageRef);
    
    return freshURL;
  } catch (error) {
    console.error('Error refreshing download URL:', error);
    throw new Error(`Failed to refresh download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/** Build a public, tokenless download URL (works when rules allow public read). */
export const toPublicURL = (urlOrPath: string): string => {
  let path = '';
  if (/^https?:\/\//i.test(urlOrPath)) {
    const urlObj = new URL(urlOrPath);
    const maybe = urlObj.pathname.split('/o/')[1]?.split('?')[0] || '';
    path = decodeURIComponent(maybe);
  } else {
    path = urlOrPath.replace(/^\/+/, '');
  }
  if (!path) throw new Error('Invalid storage URL or path');
  const bucket = 'student-reports-final.appspot.com';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};
