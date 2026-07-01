import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { db } from '../db/dexie';

export default function ChapterSidebar() {
  const { closeChapterSidebar, goToParagraph, currentParagraphIndex, currentBookId } = useReaderStore();
  const [chapters, setChapters] = useState<{ chapterIndex: number; title: string; startIndex: number }[]>([]);

  // Load unique chapters on mount
  useEffect(() => {
    if (!currentBookId) return;

    db.paragraphs
      .where('bookId').equals(currentBookId)
      .toArray()
      .then(paras => {
        const list: { chapterIndex: number; title: string; startIndex: number }[] = [];
        const seen = new Set<number>();
        
        for (const p of paras) {
          if (!seen.has(p.chapterIndex)) {
            seen.add(p.chapterIndex);
            list.push({
              chapterIndex: p.chapterIndex,
              title: p.chapterTitle || `Chapter ${p.chapterIndex + 1}`,
              startIndex: p.index,
            });
          }
        }
        setChapters(list);
      });
  }, [currentBookId]);

  // Find which chapter is currently active
  const activeChapterIndex = useMemo(() => {
    let activeIdx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (currentParagraphIndex >= chapters[i].startIndex) {
        activeIdx = chapters[i].chapterIndex;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [chapters, currentParagraphIndex]);

  const handleChapterClick = (startIndex: number) => {
    haptic.drawerClose();
    goToParagraph(startIndex);
    closeChapterSidebar();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          haptic.drawerClose();
          closeChapterSidebar();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          zIndex: 80,
        }}
      />

      {/* Sidebar Panel */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '80%',
          maxWidth: '320px',
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          zIndex: 90,
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: 'Merriweather', color: 'var(--card-fg)', fontSize: 18 }}>
            Chapters
          </h3>
          <button
            onClick={() => {
              haptic.drawerClose();
              closeChapterSidebar();
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="var(--muted-fg)" />
          </button>
        </div>

        {/* Chapters List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chapters.map((ch) => {
            const isActive = ch.chapterIndex === activeChapterIndex;
            return (
              <button
                key={ch.chapterIndex}
                onClick={() => handleChapterClick(ch.startIndex)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: isActive ? 'var(--secondary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isActive ? 'var(--primary)' : 'var(--fg)',
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.2s',
                }}
              >
                {ch.title}
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
