import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { db } from '../db/dexie';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import type { ChapterEntry } from '../db/dexie';

export default function ChapterSidebar() {
  const { currentBookId, closeChapterSidebar, goToParagraph, currentParagraphIndex, totalParagraphs } = useReaderStore();
  const [chapters, setChapters] = useState<ChapterEntry[]>([]);

  useEffect(() => {
    if (!currentBookId) return;
    db.chapters
      .where('bookId').equals(currentBookId)
      .sortBy('chapterIndex')
      .then(list => {
        if (list.length > 0) {
          setChapters(list);
        } else if (totalParagraphs > 0) {
          // Fallback: Auto-generate virtual sections every 40 paragraphs for legacy or unstructured files
          const virtualList: ChapterEntry[] = [];
          const SECTION_SIZE = 40;
          const totalSections = Math.ceil(totalParagraphs / SECTION_SIZE);
          for (let i = 0; i < totalSections; i++) {
            const firstParaIdx = i * SECTION_SIZE;
            virtualList.push({
              id: -(i + 1),
              bookId: currentBookId,
              chapterIndex: i,
              chapterTitle: `Section ${i + 1} (Para ${firstParaIdx + 1})`,
              firstParagraphIndex: firstParaIdx,
            });
          }
          setChapters(virtualList);
        }
      });
  }, [currentBookId, totalParagraphs]);

  // Determine active chapter
  const activeChapterIndex = chapters.reduce((acc, ch) => {
    if (ch.firstParagraphIndex <= currentParagraphIndex) return ch.chapterIndex;
    return acc;
  }, 0);

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'min(80vw, 320px)',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 20px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: 'Merriweather, serif', fontSize: 16, color: 'var(--card-fg)', fontWeight: 700 }}>
          Contents
        </span>
        <button
          onClick={() => { closeChapterSidebar(); haptic.drawerClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
        >
          <X size={18} color="var(--muted-fg)" />
        </button>
      </div>

      {/* Chapter list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {chapters.length === 0 && (
          <p style={{ padding: '20px', color: 'var(--muted-fg)', fontFamily: 'Inter', fontSize: 14 }}>
            No chapters detected
          </p>
        )}
        {chapters.map(ch => {
          const isActive = ch.chapterIndex === activeChapterIndex;
          return (
            <button
              key={ch.id}
              onClick={() => {
                goToParagraph(ch.firstParagraphIndex);
                haptic.nextParagraph();
                closeChapterSidebar();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '14px 20px',
                background: isActive ? 'var(--secondary)' : 'none',
                border: 'none',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer',
                fontFamily: 'Merriweather, serif',
                fontSize: 14,
                color: isActive ? 'var(--primary)' : 'var(--card-fg)',
                lineHeight: 1.5,
                transition: 'background 0.15s',
              }}
            >
              {ch.chapterTitle}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
