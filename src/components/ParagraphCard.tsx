import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { db } from '../db/dexie';
import type { Paragraph, Annotation } from '../db/dexie';

interface Props {
  paragraph: Paragraph;
  onCustomSelection: (rect: DOMRect, text: string, paragraphIndex: number) => void;
  clearCustomSelectionTrigger?: number;
}

export default function ParagraphCard({ paragraph, onCustomSelection, clearCustomSelectionTrigger }: Props) {
  const { openDictionary, currentBookId } = useReaderStore();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tempSelection, setTempSelection] = useState<{ start: number; end: number } | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; index: number } | null>(null);
  const isSelectingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear temporary highlights when toolbar action finishes
  useEffect(() => {
    setTempSelection(null);
  }, [clearCustomSelectionTrigger]);

  // Fetch highlights for this paragraph
  useEffect(() => {
    if (!currentBookId) return;
    db.annotations
      .where({ bookId: currentBookId, paragraphIndex: paragraph.index })
      .toArray()
      .then(setAnnotations);
  }, [currentBookId, paragraph.index, paragraph]);

  // Translate coordinates to caret character index inside paragraph text node
  const getCharacterOffsetFromPoint = (x: number, y: number): number | null => {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    return range.startOffset;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLParagraphElement>) => {
    const touch = e.touches[0];
    const offset = getCharacterOffsetFromPoint(touch.clientX, touch.clientY);
    if (offset === null) return;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY, index: offset };

    // Trigger selection mode on a 250ms hold
    longPressTimerRef.current = setTimeout(() => {
      haptic.longPress();
      isSelectingRef.current = true;
      setTempSelection({ start: offset, end: offset });
    }, 250);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLParagraphElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (!isSelectingRef.current) {
      if (dist > 12) {
        // User scrolling: cancel selection triggers
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        touchStartRef.current = null;
      }
      return;
    }

    // In selection mode: prevent viewport scrolling and highlight selected ranges
    e.preventDefault();
    const offset = getCharacterOffsetFromPoint(touch.clientX, touch.clientY);
    if (offset !== null) {
      setTempSelection({
        start: Math.min(touchStartRef.current.index, offset),
        end: Math.max(touchStartRef.current.index, offset),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLParagraphElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isSelectingRef.current && tempSelection) {
      const selected = paragraph.text.slice(tempSelection.start, tempSelection.end);
      if (selected.trim().length > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Position custom toolbar bubble above selection touch area
        const selectionRect = {
          top: rect.top + (rect.height / 2),
          left: rect.left,
          width: rect.width,
          height: 24,
        } as DOMRect;

        onCustomSelection(selectionRect, selected, paragraph.index);
      } else {
        setTempSelection(null);
      }
    } else if (!isSelectingRef.current && touchStartRef.current) {
      // Normal click to open dictionary
      const word = paragraph.text.slice(
        Math.max(0, touchStartRef.current.index - 8),
        Math.min(paragraph.text.length, touchStartRef.current.index + 8)
      );
      const clean = word.replace(/[^a-zA-Z'\u2019-]/g, ' ').split(/\s+/).find(w => w.length > 1);
      if (clean) {
        haptic.wordTap();
        openDictionary(clean);
      }
    }

    isSelectingRef.current = false;
    touchStartRef.current = null;
  };

  // Render static formatting annotations and real-time custom select layouts
  const renderFormattedText = () => {
    let rawText = paragraph.text;

    // Real-time custom touch-drag selection rendering
    if (tempSelection && tempSelection.start !== tempSelection.end) {
      const before = rawText.slice(0, tempSelection.start);
      const selected = rawText.slice(tempSelection.start, tempSelection.end);
      const after = rawText.slice(tempSelection.end);

      return (
        <>
          {before}
          <span style={{ backgroundColor: 'rgba(200, 130, 58, 0.45)', color: 'inherit', borderRadius: 4, padding: '2px 0' }}>
            {selected}
          </span>
          {after}
        </>
      );
    }

    if (annotations.length === 0) return rawText;

    const sorted = [...annotations].sort((a, b) => (b.note?.length || 0) - (a.note?.length || 0));
    let html = rawText;
    for (const ann of sorted) {
      if (!ann.note) continue;
      const esc = ann.note.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

      if (ann.type === 'highlight') {
        const colorVal = ann.color || '#FBBF24';
        html = html.replace(
          new RegExp(`(${esc})`, 'gi'),
          `<mark style="background-color: ${colorVal}; color: inherit; padding: 2px 0; border-radius: 4px;">$1</mark>`
        );
      } else if (ann.type === 'underline') {
        const colorVal = ann.color || 'var(--primary)';
        html = html.replace(
          new RegExp(`(${esc})`, 'gi'),
          `<span style="text-decoration: underline; text-decoration-color: ${colorVal}; text-decoration-thickness: 2.5px; text-underline-offset: 3px;">$1</span>`
        );
      }
    }

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div style={{ padding: '0 4px' }}>
      <p
        className="paragraph-text"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          margin: 0,
          color: 'var(--card-fg)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'pointer',
        }}
      >
        {renderFormattedText()}
      </p>
    </div>
  );
}
