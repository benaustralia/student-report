import { useEffect } from 'react';

interface Params {
  reportText: string;
  uploading: boolean;
  currentImageUrl: string | null | undefined;
  lastSavedTextRef: React.MutableRefObject<string>;
  setHasUnsaved: (value: boolean) => void;
  hasUnsavedChanges: boolean;
  saveReport: (imageUrl?: string | null, isAutoSave?: boolean) => void | Promise<void>;
}

export function useAutoSaveReport({ reportText, uploading, currentImageUrl, lastSavedTextRef, setHasUnsaved, hasUnsavedChanges, saveReport }: Params) {
  useEffect(() => {
    if (!reportText.trim()) {
      if (hasUnsavedChanges) setHasUnsaved(false);
      return;
    }
    const hasChanges = reportText.trim() !== lastSavedTextRef.current;
    if (hasChanges !== hasUnsavedChanges) setHasUnsaved(hasChanges);
    if (!hasChanges) return;
    const timeoutId = setTimeout(() => {
      if (!uploading) void saveReport(currentImageUrl, true);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [reportText, hasUnsavedChanges, uploading, currentImageUrl, saveReport, setHasUnsaved, lastSavedTextRef]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
