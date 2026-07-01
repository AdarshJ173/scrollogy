import React, { useRef, useCallback } from 'react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import type { Paragraph } from '../db/dexie';

interface Props {
  paragraph: Paragraph;
}

export default function ParagraphCard({ paragraph }: Props) {
  const { openDictionary } = useReaderStore();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render paragraph as span elements to support word-level interactions
  const words = paragraph.text.split(/\s+/);

  const coordsRef = useRef({ x: 0, y: 0 });

  const handleWordPointerDown = useCallback((word: string, e: React.PointerEvent) => {
    e.stopPropagation();
    coordsRef.current = { x: e.clientX, y: e.clientY };
    longPressRef.current = setTimeout(() => {
      haptic.longPress();
      openDictionary(word.replace(/[^a-zA-Z'-]/g, ''));
      longPressRef.current = null;
    }, 450);
  }, [openDictionary]);

  const handleWordPointerUp = useCallback((word: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const dragDistance = Math.hypot(
      e.clientX - coordsRef.current.x,
      e.clientY - coordsRef.current.y
    );
    
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
      
      // Only open if the user didn't drag/scroll (threshold = 6px)
      if (dragDistance < 6) {
        haptic.wordTap();
        openDictionary(word.replace(/[^a-zA-Z'-]/g, ''));
      }
    }
  }, [openDictionary]);

  const handleWordPointerLeave = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
    <div
      style={{
        maxWidth: 680,
        width: '100%',
        padding: '32px 0',
      }}
    >
      <p
        className="paragraph-text"
        style={{
          margin: 0,
          padding: 0,
          lineHeight: 'var(--reader-line-height, 1.85)',
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            onPointerDown={(e) => handleWordPointerDown(word, e)}
            onPointerUp={(e) => handleWordPointerUp(word, e)}
            onPointerLeave={handleWordPointerLeave}
            style={{
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              borderRadius: 3,
              padding: '1px 0',
              transition: 'background 0.1s',
            }}
            className="hover:bg-secondary/40"
          >
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    </div>
  );
}
