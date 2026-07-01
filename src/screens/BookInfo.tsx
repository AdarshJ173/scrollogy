import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useReaderStore } from '../store/useReaderStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { haptic } from '../engine/HapticEngine';

export default function BookInfo() {
  const { closeBookInfo, currentBookId, goToParagraph } = useReaderStore();
  const { annotations, loadAnnotations } = useAnnotationStore();
  const { books } = useLibraryStore();

  const currentBook = books.find(b => b.id === currentBookId);

  useEffect(() => {
    if (currentBookId) {
      loadAnnotations(currentBookId);
    }
  }, [currentBookId, loadAnnotations]);

  const handleAnnotationClick = (paraIndex: number) => {
    haptic.bookmark();
    goToParagraph(paraIndex);
    closeBookInfo();
  };

  const bookmarks = annotations.filter(a => a.type === 'bookmark');
  const highlights = annotations.filter(a => a.type === 'highlight');
  const likes = annotations.filter(a => a.type === 'like');

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          haptic.drawerClose();
          closeBookInfo();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          zIndex: 80,
        }}
      />

      {/* Book Details & Annotations Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '80dvh',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          borderRadius: '24px 24px 0 0',
          zIndex: 90,
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Merriweather', color: 'var(--card-fg)', fontSize: 20 }}>
              Book Info & Annotations
            </h2>
            {currentBook && (
              <p style={{ margin: '2px 0 0', color: 'var(--muted-fg)', fontSize: 13, fontFamily: 'Inter' }}>
                {currentBook.title} by {currentBook.author}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              haptic.drawerClose();
              closeBookInfo();
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="var(--muted-fg)" />
          </button>
        </div>

        {/* Contents */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            background: 'var(--secondary)',
            padding: 16,
            borderRadius: 16,
            textAlign: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{bookmarks.length}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bookmarks</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{highlights.length}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Highlights</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{likes.length}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Likes</p>
            </div>
          </div>

          {/* Highlights section */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontFamily: 'Inter', textTransform: 'uppercase', color: 'var(--muted-fg)', letterSpacing: '0.05em' }}>
              Highlights
            </h4>
            {highlights.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>No highlights yet. Swipe right on a paragraph to highlight.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {highlights.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleAnnotationClick(h.paragraphIndex)}
                    style={{
                      padding: 12,
                      background: 'var(--bg)',
                      borderLeft: `4px solid ${h.color || 'var(--primary)'}`,
                      borderRadius: '0 8px 8px 0',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--card-fg)',
                      lineHeight: 1.4
                    }}
                  >
                    Paragraph {h.paragraphIndex + 1}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bookmarks section */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontFamily: 'Inter', textTransform: 'uppercase', color: 'var(--muted-fg)', letterSpacing: '0.05em' }}>
              Bookmarks
            </h4>
            {bookmarks.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}>No bookmarks yet. Swipe left on a paragraph to bookmark.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bookmarks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleAnnotationClick(b.paragraphIndex)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--fg)',
                      fontFamily: 'Inter'
                    }}
                  >
                    Para {b.paragraphIndex + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
