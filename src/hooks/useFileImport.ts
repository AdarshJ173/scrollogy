import { useState, useCallback } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';

export function useFileImport() {
  const [isDragging, setIsDragging] = useState(false);
  const { importFile } = useLibraryStore();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.pdf') || file.name.endsWith('.epub')) {
        await importFile(file);
      }
    }
  }, [importFile]);

  return {
    isDragging,
    dragProps: {
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}
