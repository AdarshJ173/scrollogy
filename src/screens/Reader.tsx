import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReaderStore } from '../store/useReaderStore';
import { useReaderGestures } from '../hooks/useGestures';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { db, sessionManager } from '../db/dexie';
import type { Paragraph } from '../db/dexie';
import ParagraphCard from '../components/ParagraphCard';
import ProgressBar from '../components/ProgressBar';
import HUD from '../components/HUD';
import DictionaryPopup from '../components/DictionaryPopup';
import ChapterSidebar from '../components/ChapterSidebar';
import BookInfoSheet from './BookInfo';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

const CARD_VARIANTS = {
  enter: {
    opacity: 0,
    scale: 0.99,
  },
  center: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    transition: {
      duration: 0.12,
      ease: 'easeIn',
    },
  },
};

const GHOST_OFFSET = 48;
const GHOST_MAX_H = 130;

export default function Reader() {
  const prevIndexRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    currentBookId,
    currentParagraphIndex,
    totalParagraphs,
    isDictionaryOpen,
    isChapterSidebarOpen,
    isBookInfoOpen,
    goToParagraph,
  } = useReaderStore();

  const { loadAnnotations } = useAnnotationStore();

  const [currentParagraph, setCurrentParagraph]   = useState<Paragraph | null>(null);
  const [prevParagraph, setPrevParagraph]          = useState<Paragraph | null>(null);
  const [nextParagraph, setNextParagraph]          = useState<Paragraph | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIdx, setCurrentResultIdx] = useState(0);

  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // Track active window text selection bounds
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionRect(rect);
        setSelectedText(sel.toString());
      } else {
        setSelectionRect(null);
        setSelectedText('');
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const applyAnnotation = useCallback(async (type: 'highlight' | 'underline', color: string) => {
    if (!currentBookId || !selectedText) return;
    haptic.highlight();
    
    await db.annotations.add({
      bookId: currentBookId,
      paragraphIndex: currentParagraphIndex,
      type,
      note: selectedText,
      color,
      createdAt: new Date(),
    });

    window.getSelection()?.removeAllRanges();
    
    const cur = await db.paragraphs.where({ bookId: currentBookId, index: currentParagraphIndex }).first();
    setCurrentParagraph(cur ? { ...cur } : null);
  }, [currentBookId, currentParagraphIndex, selectedText]);

  const clearAnnotations = useCallback(async () => {
    if (!currentBookId || !selectedText) return;
    haptic.error();

    const matches = await db.annotations
      .where({ bookId: currentBookId, paragraphIndex: currentParagraphIndex })
      .toArray();

    for (const ann of matches) {
      if (ann.id && ann.note && selectedText.toLowerCase().includes(ann.note.toLowerCase())) {
        await db.annotations.delete(ann.id);
      }
    }

    window.getSelection()?.removeAllRanges();

    const cur = await db.paragraphs.where({ bookId: currentBookId, index: currentParagraphIndex }).first();
    setCurrentParagraph(cur ? { ...cur } : null);
  }, [currentBookId, currentParagraphIndex, selectedText]);

  useEffect(() => {
    if (!currentBookId) return;
    db.progress
      .where('bookId').equals(currentBookId)
      .first()
      .then(progress => {
        goToParagraph(progress?.currentParagraphIndex ?? 0);
        setIsLoaded(true);
      });
    loadAnnotations(currentBookId);
  }, [currentBookId]);

  useEffect(() => {
    if (!currentBookId || !isLoaded) return;

    const load = async () => {
      const [cur, prv, nxt] = await Promise.all([
        db.paragraphs.where({ bookId: currentBookId, index: currentParagraphIndex }).first(),
        currentParagraphIndex > 0
          ? db.paragraphs.where({ bookId: currentBookId, index: currentParagraphIndex - 1 }).first()
          : Promise.resolve(null),
        currentParagraphIndex < totalParagraphs - 1
          ? db.paragraphs.where({ bookId: currentBookId, index: currentParagraphIndex + 1 }).first()
          : Promise.resolve(null),
      ]);
      setCurrentParagraph(cur ?? null);
      setPrevParagraph(prv ?? null);
      setNextParagraph(nxt ?? null);
    };

    load();
  }, [currentBookId, currentParagraphIndex, totalParagraphs, isLoaded]);

  useEffect(() => {
    if (!currentBookId || !isLoaded) return;
    db.progress.where('bookId').equals(currentBookId).first().then(existing => {
      if (existing?.id) {
        db.progress.update(existing.id, { currentParagraphIndex, lastReadAt: new Date() });
      } else {
        db.progress.add({
          bookId: currentBookId,
          currentParagraphIndex,
          lastReadAt: new Date(),
          totalReadingTimeMs: 0,
          paragraphsRead: currentParagraphIndex,
        });
      }
    });
  }, [currentBookId, currentParagraphIndex, isLoaded]);

  // ── Session tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBookId || !isLoaded) return;
    sessionManager.start(currentBookId);
    return () => { sessionManager.end(); };
  }, [currentBookId, isLoaded]);

  // ── Advance session on paragraph change ──────────────────────────────────
  useEffect(() => {
    if (!currentParagraph) return;
    sessionManager.advance(currentParagraph.wordCount);
  }, [currentParagraphIndex]);

  useEffect(() => {
    if (!cardRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCardHeight(entry.contentRect.height);
      }
    });
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [currentParagraph]);

  const direction    = currentParagraphIndex > prevIndexRef.current ? 1 : -1;
  prevIndexRef.current = currentParagraphIndex;

  const progress = totalParagraphs > 0
    ? (currentParagraphIndex / totalParagraphs) * 100
    : 0;

  const { bind, springY } = useReaderGestures();

  const ghostOffsetPx = cardHeight > 0 ? cardHeight / 2 + GHOST_OFFSET : 220;

  return (
    <div
      {...bind()}
      className="reader-root select-none"
      onContextMenu={(e) => {
        e.preventDefault();
        haptic.hudToggle();
        setShowSearchModal(true);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <ProgressBar progress={progress} />

      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 18px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--muted-fg)',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {currentParagraph?.chapterTitle ?? 'FOLIO'}
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 18px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.12em',
          color: 'var(--muted-fg)',
          opacity: 0.5,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {currentParagraphIndex + 1} / {totalParagraphs}
      </div>

      <motion.div
        style={{
          y: springY,
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {prevParagraph && (
          <div
            style={{
              position: 'absolute',
              top: `calc(50vh - ${ghostOffsetPx}px - ${GHOST_MAX_H}px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 640,
              padding: '0 28px',
              maxHeight: GHOST_MAX_H,
              overflow: 'hidden',
              opacity: 0.28,
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)',
            }}
          >
            <p
              className="paragraph-text"
              style={{
                margin: 0,
                fontSize: 'calc(var(--reader-font-size, 18px) - 2px)',
                lineHeight: 'var(--reader-line-height, 1.85)',
                color: 'var(--card-fg)',
                transform: 'scale(0.96)',
                transformOrigin: 'bottom center',
              }}
            >
              {prevParagraph.text}
            </p>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: '50vh',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: 640,
            padding: '0 28px',
            pointerEvents: 'auto',
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            {currentParagraph && (
              <motion.div
                key={currentParagraphIndex}
                custom={direction}
                variants={CARD_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                ref={cardRef}
              >
                <ParagraphCard paragraph={currentParagraph} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {nextParagraph && (
          <div
            style={{
              position: 'absolute',
              top: `calc(50vh + ${ghostOffsetPx}px + 12px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 640,
              padding: '0 28px',
              maxHeight: GHOST_MAX_H,
              overflow: 'hidden',
              opacity: 0.28,
              maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 100%)',
            }}
          >
            <p
              className="paragraph-text"
              style={{
                margin: 0,
                fontSize: 'calc(var(--reader-font-size, 18px) - 2px)',
                lineHeight: 'var(--reader-line-height, 1.85)',
                color: 'var(--card-fg)',
                transform: 'scale(0.96)',
                transformOrigin: 'top center',
              }}
            >
              {nextParagraph.text}
            </p>
          </div>
        )}
      </motion.div>

      {searchResults.length === 0 ? (
        <HUD progress={progress} />
      ) : (
        <div style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(90vw, 340px)',
          height: 54,
          background: 'var(--card)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          borderRadius: 27,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}>
          <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--primary)' }}>🔍</span> "{searchQuery.slice(0, 10)}{searchQuery.length > 10 ? '...' : ''}"
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: 'var(--card-fg)' }}>
              {currentResultIdx + 1} of {searchResults.length}
            </span>
            
            <button
              onClick={() => {
                haptic.wordTap();
                const nextIdx = (currentResultIdx - 1 + searchResults.length) % searchResults.length;
                setCurrentResultIdx(nextIdx);
                goToParagraph(searchResults[nextIdx]);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <ChevronUp size={18} color="var(--primary)" />
            </button>

            <button
              onClick={() => {
                haptic.wordTap();
                const nextIdx = (currentResultIdx + 1) % searchResults.length;
                setCurrentResultIdx(nextIdx);
                goToParagraph(searchResults[nextIdx]);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <ChevronDown size={18} color="var(--primary)" />
            </button>

            <button
              onClick={() => {
                haptic.drawerClose();
                setSearchResults([]);
                setSearchQuery('');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} color="var(--muted-fg)" />
            </button>
          </div>
        </div>
      )}

      {/* Center Search Input Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.18)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: 20,
                width: 'min(90vw, 340px)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.15)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontFamily: 'Merriweather', fontSize: 16, fontWeight: 700, color: 'var(--card-fg)' }}>
                  Search in Book
                </span>
                <button
                  onClick={() => setShowSearchModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <X size={16} color="var(--muted-fg)" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!searchQuery.trim()) return;
                const paras = await db.paragraphs.where('bookId').equals(currentBookId!).toArray();
                const matches = paras
                  .filter(p => p.text.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(p => p.index);
                
                if (matches.length > 0) {
                  setSearchResults(matches);
                  setCurrentResultIdx(0);
                  goToParagraph(matches[0]);
                  setShowSearchModal(false);
                  haptic.importSuccess();
                } else {
                  alert('No matches found for "' + searchQuery + '"');
                  haptic.error();
                }
              }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Type word or phrase..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--secondary)',
                    color: 'var(--card-fg)',
                    fontFamily: 'Inter',
                    fontSize: 14,
                    outline: 'none',
                    marginBottom: 16
                  }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(false)}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      background: 'none',
                      color: 'var(--muted-fg)',
                      fontFamily: 'Inter',
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 8,
                      background: 'var(--primary)',
                      color: '#fff',
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Search
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Selection Toolbar */}
      {selectionRect && selectedText && (
        <div style={{
          position: 'fixed',
          top: selectionRect.top - 52,
          left: Math.max(16, Math.min(window.innerWidth - 230, selectionRect.left + (selectionRect.width / 2) - 100)),
          height: 38,
          background: 'rgba(30, 27, 22, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 19,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          zIndex: 300,
        }}>
          <button onClick={() => applyAnnotation('highlight', '#FBBF24')} style={{ width: 16, height: 16, borderRadius: '50%', background: '#FBBF24', border: 'none', cursor: 'pointer' }} title="Yellow Highlight" />
          <button onClick={() => applyAnnotation('highlight', '#34D399')} style={{ width: 16, height: 16, borderRadius: '50%', background: '#34D399', border: 'none', cursor: 'pointer' }} title="Green Highlight" />
          <button onClick={() => applyAnnotation('highlight', '#60A5FA')} style={{ width: 16, height: 16, borderRadius: '50%', background: '#60A5FA', border: 'none', cursor: 'pointer' }} title="Blue Highlight" />
          <button onClick={() => applyAnnotation('highlight', '#C084FC')} style={{ width: 16, height: 16, borderRadius: '50%', background: '#C084FC', border: 'none', cursor: 'pointer' }} title="Purple Highlight" />
          
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />

          <button
            onClick={() => applyAnnotation('underline', 'var(--primary)')}
            style={{
              background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
              fontFamily: 'Inter', fontSize: 11, fontWeight: 700, textDecoration: 'underline',
              padding: '2px 4px'
            }}
            title="Underline"
          >
            U
          </button>

          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />

          <button
            onClick={clearAnnotations}
            style={{
              background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer',
              fontFamily: 'Inter', fontSize: 9, fontWeight: 700,
              padding: '2px 4px'
            }}
            title="Clear Highlight"
          >
            CLEAR
          </button>
        </div>
      )}

      <AnimatePresence>
        {isDictionaryOpen && <DictionaryPopup />}
      </AnimatePresence>
      <AnimatePresence>
        {isChapterSidebarOpen && <ChapterSidebar />}
      </AnimatePresence>
      <AnimatePresence>
        {isBookInfoOpen && <BookInfoSheet />}
      </AnimatePresence>
    </div>
  );
}
