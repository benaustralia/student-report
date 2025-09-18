import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null, preview: string | null) => void;
  onRemove?: () => void;
  disabled?: boolean;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  maxSize = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  className,
}) => {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploading(true);
      
      // Validate file
      if (!acceptedTypes.includes(file.type)) {
        alert(`File type not supported. Please use: ${acceptedTypes.join(', ')}`);
        setUploading(false);
        return;
      }
      
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File size must be less than ${maxSize}MB`);
        setUploading(false);
        return;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      onChange(file, preview);
      setUploading(false);
    }
  }, [acceptedTypes, maxSize, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxFiles: 1,
    disabled: disabled || uploading,
  });

  const handleRemove = () => {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
    onChange(null, null);
    onRemove?.();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isDragActive && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          value && 'border-green-500 bg-green-50'
        )}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : value ? (
          <div className="space-y-2">
            <img
              src={value}
              alt="Preview"
              className="mx-auto h-20 w-20 object-cover rounded"
            />
            <p className="text-sm text-muted-foreground">Click to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragActive ? 'Drop image here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground">
                Images up to {maxSize}MB
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Delete button - only show when there's an image */}
      {value && !uploading && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <X className="h-4 w-4 mr-2" />
            Delete Image
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
