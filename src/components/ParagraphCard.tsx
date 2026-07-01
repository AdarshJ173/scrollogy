import React, { useRef, useCallback } from 'react';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import type { Paragraph } from '../db/dexie';

interface Props {
  paragraph: Paragraph;
}

// Threshold: pointer must move less than this to count as a tap (not a scroll)
const TAP_MOVE_THRESHOLD = 12;
// Long press duration
const LONG_PRESS_MS = 480;

export default function ParagraphCard({ paragraph }: Props) {
  const { openDictionary } = useReaderStore();

  // Per-word interaction state — stored as refs to avoid re-renders
  const pressState = useRef<{
    word: string;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
    didLongPress: boolean;
    pointerId: number;
  } | null>(null);

  const words = paragraph.text.split(/\s+/);

  const handlePointerDown = useCallback((word: string, e: React.PointerEvent<HTMLSpanElement>) => {
    // Only capture if it's a primary pointer
    if (!e.isPrimary) return;

    // Cancel any previous press state
    if (pressState.current?.timer) clearTimeout(pressState.current.timer);

    const timer = setTimeout(() => {
      if (!pressState.current) return;
      pressState.current.didLongPress = true;
      haptic.longPress();
      const clean = pressState.current.word.replace(/[^a-zA-Z'\u2019-]/g, '');
      if (clean.length > 1) openDictionary(clean);
    }, LONG_PRESS_MS);

    pressState.current = {
      word,
      startX: e.clientX,
      startY: e.clientY,
      timer,
      didLongPress: false,
      pointerId: e.pointerId,
    };

    // Capture pointer to track moves even outside this element
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }, [openDictionary]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!pressState.current || e.pointerId !== pressState.current.pointerId) return;
    
    const dx = e.clientX - pressState.current.startX;
    const dy = e.clientY - pressState.current.startY;
    const dist = Math.hypot(dx, dy);

    // Cancel long press if user started moving (they're scrolling)
    if (dist > TAP_MOVE_THRESHOLD && pressState.current.timer) {
      clearTimeout(pressState.current.timer);
      pressState.current.timer = null;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!pressState.current || e.pointerId !== pressState.current.pointerId) return;

    const { word, startX, startY, timer, didLongPress } = pressState.current;

    // Clear timer
    if (timer) clearTimeout(timer);
    pressState.current = null;

    // Release capture
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}

    // If it was already handled as a long press, do nothing
    if (didLongPress) return;

    // Check movement — only open dictionary if it was truly a tap
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);

    if (dist < TAP_MOVE_THRESHOLD) {
      haptic.wordTap();
      const clean = word.replace(/[^a-zA-Z'\u2019-]/g, '');
      if (clean.length > 1) openDictionary(clean);
    }
    // else: it was a scroll — do nothing
  }, [openDictionary]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!pressState.current || e.pointerId !== pressState.current.pointerId) return;
    if (pressState.current.timer) clearTimeout(pressState.current.timer);
    pressState.current = null;
  }, []);

  return (
    <div style={{ maxWidth: 680, width: '100%', padding: '32px 0' }}>
      <p
        className="paragraph-text"
        style={{ margin: 0, padding: 0, lineHeight: 'var(--reader-line-height, 1.85)' }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            onPointerDown={(e) => handlePointerDown(word, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{
              cursor: 'text',
              WebkitTapHighlightColor: 'transparent',
              borderRadius: 3,
              padding: '2px 0',
              touchAction: 'inherit', // inherit from parent
            }}
          >
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    </div>
  );
}
