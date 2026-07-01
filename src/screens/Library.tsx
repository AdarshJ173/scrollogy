import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexie';

export default function Library() {
  const { books, loadLibrary, importFile, isImporting, importProgress, deleteBook } = useLibraryStore();
  const { setBook, goToParagraph } = useReaderStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptic.importSuccess();
    await importFile(file);
  };

  const handleOpenBook = async (bookId: number, totalParagraphs: number) => {
    // Restore progress
    const progress = await db.progress.where('bookId').equals(bookId).first();
    setBook(bookId, totalParagraphs);
    if (progress) {
      goToParagraph(progress.currentParagraphIndex);
    }
    
    // Update lastOpenedAt
    await db.books.update(bookId, { lastOpenedAt: new Date() });
    haptic.nextParagraph();
    navigate('/reader');
  };

  const handleDelete = async (e: React.MouseEvent, bookId: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this book?')) {
      haptic.error();
      await deleteBook(bookId);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      padding: '40px 20px',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{
            fontFamily: 'Merriweather',
            fontSize: 28,
            color: 'var(--card-fg)',
            margin: '0 0 4px',
            fontWeight: 700
          }}>
            FOLIO
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--muted-fg)', margin: 0 }}>
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </p>
        </div>
      </div>

      {/* Import button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        style={{
          width: '100%',
          padding: '18px',
          background: 'var(--secondary)',
          border: '2px dashed var(--border)',
          borderRadius: 16,
          cursor: 'pointer',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontFamily: 'Inter',
          fontSize: 15,
          color: 'var(--fg)',
          fontWeight: 500
        }}
      >
        <Plus size={20} color="var(--primary)" />
        {isImporting ? `Importing... ${importProgress}%` : 'Add PDF or EPUB'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Book grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handleOpenBook(book.id!, book.totalParagraphs)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              cursor: 'pointer',
              aspectRatio: '3/4',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  borderRadius: 16,
                }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, var(--secondary), var(--muted))`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 48, opacity: 0.3, color: 'var(--fg)' }}>¶</span>
              </div>
            )}
            
            {/* Delete button */}
            <button
              onClick={(e) => handleDelete(e, book.id!)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(255, 255, 255, 0.85)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <Trash2 size={16} color="#EF4444" />
            </button>

            <div style={{
              position: 'relative',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
              padding: '24px 8px 8px',
              margin: '-16px',
              borderRadius: '0 0 16px 16px',
              zIndex: 5
            }}>
              <p style={{
                margin: 0, fontSize: 13, fontFamily: 'Merriweather',
                color: '#fff', fontWeight: 700,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {book.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'Inter', color: 'rgba(255,255,255,0.7)' }}>
                {book.author}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {books.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <p style={{ fontSize: 48, margin: 0 }}>¶</p>
          <p style={{ fontFamily: 'Merriweather', color: 'var(--muted-fg)', fontSize: 16, marginTop: 12 }}>
            Your library is empty
          </p>
          <p style={{ fontFamily: 'Inter', color: 'var(--muted-fg)', fontSize: 13, margin: '4px 0 0' }}>
            Add a PDF or EPUB to begin reading
          </p>
        </div>
      )}
    </div>
  );
}
