import React, { useEffect, useState, useCallback } from 'react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { db } from '../db/dexie';
import type { Paragraph, Annotation } from '../db/dexie';

interface Props {
  paragraph: Paragraph;
}

export default function ParagraphCard({ paragraph }: Props) {
  const { openDictionary, currentBookId } = useReaderStore();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Fetch highlights for this paragraph
  useEffect(() => {
    if (!currentBookId) return;
    db.annotations
      .where({ bookId: currentBookId, paragraphIndex: paragraph.index })
      .toArray()
      .then(setAnnotations);
  }, [currentBookId, paragraph.index, paragraph]);

  // Unified caret click selection resolver
  const handleTextClick = useCallback((e: React.MouseEvent<HTMLParagraphElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      // Selection active: let user use the floating highlight bar
      return;
    }

    // Determine caretaker click target word
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const offset = range.startOffset;

    let start = offset;
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    let end = offset;
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    const word = text.slice(start, end).replace(/[^a-zA-Z'\u2019-]/g, '');
    if (word.length > 1) {
      haptic.wordTap();
      openDictionary(word);
    }
  }, [openDictionary]);

  // Apply formatted markup wrapper for custom annotations
  const renderFormattedText = () => {
    let rawText = paragraph.text;
    if (annotations.length === 0) return rawText;

    // Replace substrings by sorting annotations longest-first to prevent substring offsets
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
        onClick={handleTextClick}
        style={{
          margin: 0,
          color: 'var(--card-fg)',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          cursor: 'pointer',
        }}
      >
        {renderFormattedText()}
      </p>
    </div>
  );
}
