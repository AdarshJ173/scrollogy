import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, X } from 'lucide-react';
import { useFileImport } from '../hooks/useFileImport';
import { useLibraryStore } from '../store/useLibraryStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: Props) {
  const { isDragging, dragProps } = useFileImport();
  const { isImporting, importProgress } = useLibraryStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: '#000',
            }}
          />

          {/* Modal box */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              position: 'relative',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 10,
              fontFamily: 'Inter',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--card-fg)' }}>Import Book</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="var(--muted-fg)" />
              </button>
            </div>

            <div
              {...dragProps}
              style={{
                border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                borderRadius: 12,
                padding: '40px 20px',
                textAlign: 'center',
                background: isDragging ? 'var(--secondary)' : 'transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              {isImporting ? (
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--fg)', fontWeight: 500 }}>Parsing Book...</p>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted-fg)' }}>{importProgress}% complete</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <UploadCloud size={32} color="var(--primary)" />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--fg)' }}>
                    Drag & drop PDF or EPUB here
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
