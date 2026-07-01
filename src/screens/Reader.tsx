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

const CARD_VARIANTS = {
  enter: (dir: number) => ({
    y: dir > 0 ? 60 : -60,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 28,
      mass: 0.7,
    },
  },
  exit: (dir: number) => ({
    y: dir > 0 ? -60 : 60,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.14, ease: 'easeIn' },
  }),
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

        {prevParagraph && (
          <div style={{
            position: 'absolute',
            top: `calc(50vh - ${ghostOffsetPx}px - 4px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--primary)',
            opacity: 0.3,
            fontSize: 18,
            fontFamily: 'Merriweather, serif',
            lineHeight: 1,
          }}>
            ¶
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
          <div style={{
            position: 'absolute',
            top: `calc(50vh + ${ghostOffsetPx}px - 4px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--primary)',
            opacity: 0.3,
            fontSize: 18,
            fontFamily: 'Merriweather, serif',
            lineHeight: 1,
          }}>
            ¶
          </div>
        )}

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
