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
 * Returns null if the file doesn't exist (object-not-found)
 */
export const refreshDownloadURL = async (urlOrPath: string): Promise<string | null> => {
  try {
    // Lazy load Firebase Storage only when needed
    const { ref, getDownloadURL } = await import('firebase/storage');
    const { getStorageInstance } = await import('../config/firebaseStorage');
    const storage = await getStorageInstance();
    
    // Accept either a full download URL or a storage path
    let path = '';
    if (/^https?:\/\//i.test(urlOrPath)) {
      const urlObj = new URL(urlOrPath);
      // Extract path from Firebase Storage URL format:
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
      if (pathMatch) {
        path = decodeURIComponent(pathMatch[1]);
      } else {
        // Fallback: try the old method
        path = decodeURIComponent(urlObj.pathname.split('/o/')[1]?.split('?')[0] || '');
      }
    } else {
      path = urlOrPath.replace(/^\/+/, '');
    }
    
    if (!path) {
      console.error('Invalid storage URL - could not extract path:', urlOrPath);
      throw new Error('Invalid storage URL');
    }
    
    // Log the extracted path for debugging
    console.log('Refreshing download URL - extracted path:', path, 'from URL:', urlOrPath.substring(0, 100));
    
    // Create reference and get fresh download URL
    const storageRef = ref(storage, path);
    const freshURL = await getDownloadURL(storageRef);
    
    return freshURL;
  } catch (error: any) {
    // Handle object-not-found gracefully - file doesn't exist
    if (error?.code === 'storage/object-not-found' || error?.message?.includes('object-not-found')) {
      console.warn(`Storage object not found. Original URL: ${urlOrPath.substring(0, 100)}... Error:`, error);
      // Try to find the file with alternative path formats
      // Sometimes the path might be stored differently (e.g., with/without 'students/' prefix)
      if (/^https?:\/\//i.test(urlOrPath)) {
        const urlObj = new URL(urlOrPath);
        let extractedPath = '';
        const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(?:\?|$)/);
        if (pathMatch) {
          extractedPath = decodeURIComponent(pathMatch[1]);
        }
        
        // Try alternative paths if the original doesn't work
        if (extractedPath) {
          // If path starts with 'student-reports/students/', try without 'students/'
          if (extractedPath.startsWith('student-reports/students/')) {
            const altPath = extractedPath.replace('student-reports/students/', 'student-reports/');
            console.log('Trying alternative path (without students/):', altPath);
            try {
              const { ref, getDownloadURL } = await import('firebase/storage');
              const { getStorageInstance } = await import('../config/firebaseStorage');
              const storage = await getStorageInstance();
              const altRef = ref(storage, altPath);
              const altURL = await getDownloadURL(altRef);
              console.log('Found file with alternative path!');
              return altURL;
            } catch (altError) {
              console.warn('Alternative path also failed:', altError);
            }
          }
          // If path doesn't start with 'student-reports/students/', try adding it
          else if (extractedPath.startsWith('student-reports/') && !extractedPath.startsWith('student-reports/students/')) {
            const altPath = extractedPath.replace('student-reports/', 'student-reports/students/');
            console.log('Trying alternative path (with students/):', altPath);
            try {
              const { ref, getDownloadURL } = await import('firebase/storage');
              const { getStorageInstance } = await import('../config/firebaseStorage');
              const storage = await getStorageInstance();
              const altRef = ref(storage, altPath);
              const altURL = await getDownloadURL(altRef);
              console.log('Found file with alternative path!');
              return altURL;
            } catch (altError) {
              console.warn('Alternative path also failed:', altError);
            }
          }
        }
      }
      return null;
    }
    
    // For other errors, log and return null (don't break the app)
    console.error('Error refreshing download URL:', error);
    return null;
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
