import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Save, X } from 'lucide-react';

interface CollapsibleItemProps {
  title: string;
  subtitle?: string;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const CollapsibleItem: React.FC<CollapsibleItemProps> = ({
  title,
  subtitle,
  isEditing,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  children,
  className = ""
}) => {
  return (
    <div className={`p-4 border rounded-lg ${className}`}>
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <span className="font-medium truncate">Editing {title}</span>
            <div className="flex gap-2 flex-shrink-0">
              {onSave && (
                <Button size="sm" onClick={onSave}>
                  <Save className="h-4 w-4" />
                </Button>
              )}
              {onCancel && (
                <Button size="sm" variant="outline" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {children}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{title}</div>
            {subtitle && (
              <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
