import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReaderStore } from '../store/useReaderStore';
import { useReaderGestures } from '../hooks/useGestures';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { db } from '../db/dexie';
import type { Paragraph } from '../db/dexie';
import ParagraphCard from '../components/ParagraphCard';
import ProgressBar from '../components/ProgressBar';
import HUD from '../components/HUD';
import DictionaryPopup from '../components/DictionaryPopup';
import ChapterSidebar from '../components/ChapterSidebar';
import BookInfoSheet from './BookInfo';

const PARAGRAPH_VARIANTS = {
  enter: (direction: number) => ({
    y: direction > 0 ? '50%' : '-50%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 26,
      mass: 0.8,
    },
  },
  exit: (direction: number) => ({
    y: direction > 0 ? '-50%' : '50%',
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15, ease: 'easeIn' },
  }),
};

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
  
  const [currentParagraph, setCurrentParagraph] = useState<Paragraph | null>(null);
  const [prevParagraph, setPrevParagraph] = useState<Paragraph | null>(null);
  const [nextParagraph, setNextParagraph] = useState<Paragraph | null>(null);

  useEffect(() => {
    if (!currentBookId) return;
    
    db.progress
      .where('bookId').equals(currentBookId)
      .first()
      .then(progress => {
        if (progress) {
          goToParagraph(progress.currentParagraphIndex);
        } else {
          goToParagraph(0);
        }
        setIsLoaded(true);
      });

    loadAnnotations(currentBookId);
  }, [currentBookId, loadAnnotations, goToParagraph]);

  useEffect(() => {
    if (!currentBookId || !isLoaded) return;

    db.paragraphs
      .where('bookId').equals(currentBookId)
      .and(p => p.index === currentParagraphIndex)
      .first()
      .then(p => setCurrentParagraph(p || null));

    if (currentParagraphIndex > 0) {
      db.paragraphs
        .where('bookId').equals(currentBookId)
        .and(p => p.index === currentParagraphIndex - 1)
        .first()
        .then(p => setPrevParagraph(p || null));
    } else {
      setPrevParagraph(null);
    }

    if (currentParagraphIndex < totalParagraphs - 1) {
      db.paragraphs
        .where('bookId').equals(currentBookId)
        .and(p => p.index === currentParagraphIndex + 1)
        .first()
        .then(p => setNextParagraph(p || null));
    } else {
      setNextParagraph(null);
    }
  }, [currentBookId, currentParagraphIndex, totalParagraphs, isLoaded]);

  useEffect(() => {
    if (!currentBookId || !isLoaded) return;
    
    db.progress
      .where('bookId').equals(currentBookId)
      .first()
      .then(existing => {
        if (existing?.id) {
          db.progress.update(existing.id, {
            currentParagraphIndex,
            lastReadAt: new Date(),
          });
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

  const direction = currentParagraphIndex > prevIndexRef.current ? 1 : -1;
  prevIndexRef.current = currentParagraphIndex;

  const progress = totalParagraphs > 0 
    ? (currentParagraphIndex / totalParagraphs) * 100 
    : 0;

  const { bind, springY } = useReaderGestures();

  return (
    <div
      {...bind()}
      className="reader-root select-none"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        overflow: 'hidden',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
      }}
    >
      <ProgressBar progress={progress} />

      <div style={{
        position: 'absolute',
        top: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--muted-fg)',
        opacity: 0.8,
        pointerEvents: 'none',
      }}>
        {currentParagraph?.chapterTitle || 'FOLIO'}
      </div>

      <div style={{
        width: '100%',
        maxWidth: 680,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}>
        <AnimatePresence mode="wait" custom={direction}>
          {currentParagraph && (
            <motion.div
              key={currentParagraphIndex}
              custom={direction}
              variants={PARAGRAPH_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              style={{
                y: springY,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {/* Previous paragraph snippet - positioned above */}
              {prevParagraph && (
                <div 
                  className="paragraph-text"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    marginBottom: 36,
                    opacity: 0.35,
                    transform: 'scale(0.96)',
                    textAlign: 'left',
                    lineHeight: 'var(--reader-line-height, 1.85)',
                    fontSize: 'calc(var(--reader-font-size, 18px) - 2px)',
                    maxHeight: '140px',
                    overflow: 'hidden',
                    maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                  }}
                >
                  {prevParagraph.text}
                </div>
              )}

              {/* Active centered paragraph card */}
              <div style={{ width: '100%' }}>
                <ParagraphCard paragraph={currentParagraph} />
              </div>

              {/* Next paragraph snippet - positioned below */}
              {nextParagraph && (
                <div 
                  className="paragraph-text"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 36,
                    opacity: 0.35,
                    transform: 'scale(0.96)',
                    textAlign: 'left',
                    lineHeight: 'var(--reader-line-height, 1.85)',
                    fontSize: 'calc(var(--reader-font-size, 18px) - 2px)',
                    maxHeight: '140px',
                    overflow: 'hidden',
                    maskImage: 'linear-gradient(to top, black 50%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to top, black 50%, transparent 100%)',
                  }}
                >
                  {nextParagraph.text}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HUD progress={progress} />
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
