// Cloudinary configuration - No external dependencies needed
// Only cloud name is needed for client-side operations
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

if (!cloudName) {
  throw new Error(
    'Missing Cloudinary cloud name. Please set the following environment variable:\n' +
    'VITE_CLOUDINARY_CLOUD_NAME\n\n' +
    'Get this from: https://cloudinary.com/console'
  );
}

// Helper function to get Cloudinary URL from public ID
export const getCloudinaryUrl = (publicId: string, options: {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  crop?: 'fill' | 'fit' | 'scale' | 'crop';
} = {}) => {
  // Build transformation URL manually
  const transformations = [];
  
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);

  const transformString = transformations.length > 0 ? transformations.join(',') + '/' : '';
  
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}${publicId}`;
};

// Helper function to extract public ID from Cloudinary URL
export const extractPublicId = (url: string): string | null => {
  const match = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i);
  return match ? match[1] : null;
};
