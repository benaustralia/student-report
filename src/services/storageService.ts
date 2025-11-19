// Firebase Storage is lazy-loaded - only import when needed
// Don't import getStorageInstance here - import dynamically in functions

/**
 * Simple Firebase Storage service for images
 */
export const uploadImageToStorage = async (
  file: File, 
  path: string
): Promise<string> => {
  try {
    // Lazy load Firebase Storage only when needed
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { getStorageInstance } = await import('../config/firebaseStorage');
    const storage = await getStorageInstance();
    
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
    // Lazy load Firebase Storage only when needed
    const { ref, deleteObject } = await import('firebase/storage');
    const { getStorageInstance } = await import('../config/firebaseStorage');
    const storage = await getStorageInstance();
    
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
  // studentId should already be normalized (from buildStudentFolderName via StudentCard)
  // Just sanitize the filename to ensure no invalid characters
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  // Ensure studentId doesn't have leading/trailing slashes
  const cleanPath = studentId.replace(/^\/+|\/+$/g, '');
  return `student-reports/${cleanPath}/profile_${sanitizedFilename}`;
};

// Shared folder naming to keep artwork and PDFs in the same place
export const buildStudentFolderName = (
  firstName: string,
  lastName: string | undefined,
  classDay: string | undefined
): string => {
  const base = `${firstName || ''} ${lastName || ''}`.trim();
  const day = (classDay || 'Unknown').trim();
  const combined = `${base}-${day}`;
  return combined
    .replace(/[()]/g, '') // drop parentheses to avoid duplicate variants
    .replace(/[\n\r\t\/]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Get a fresh download URL from a Firebase Storage URL
 * Useful when the old download token has expired
 */
export const refreshDownloadURL = async (urlOrPath: string): Promise<string> => {
  try {
    // Lazy load Firebase Storage only when needed
    const { ref, getDownloadURL } = await import('firebase/storage');
    const { getStorageInstance } = await import('../config/firebaseStorage');
    const storage = await getStorageInstance();
    
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
  // Use hardcoded bucket name to avoid loading Storage module
  const bucket = 'student-reports-final.firebasestorage.app';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};
