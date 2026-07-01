import { useCallback, useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { useMotionValue, useSpring } from 'framer-motion';
import { haptic } from '../engine/HapticEngine';
import { useReaderStore } from '../store/useReaderStore';
import { useAnnotationStore } from '../store/useAnnotationStore';

const VERTICAL_TRIGGER_PX = 55;
const VERTICAL_TRIGGER_VELOCITY = 0.35;
const HORIZONTAL_TRIGGER_PX = 60;
const HORIZONTAL_TRIGGER_VELOCITY = 0.4;

export function useReaderGestures() {
  // Motion values for drag — these update without React re-renders
  const rawDragY = useMotionValue(0);
  const springY = useSpring(rawDragY, {
    stiffness: 320,
    damping: 28,
    mass: 0.6,
  });

  // Consumed ref prevents multiple triggers per gesture
  const consumed = useRef(false);

  const {
    nextParagraph,
    prevParagraph,
    toggleHUD,
    isDictionaryOpen,
    closeDictionary,
    openChapterSidebar,
  } = useReaderStore();

  const { bookmark, highlight } = useAnnotationStore();

  const bind = useDrag(
    ({ 
      movement: [mx, my], 
      velocity: [vx, vy],
      tap, 
      last,
      first,
      cancel,
      event,
    }) => {
      // Reset consumed flag on new gesture
      if (first) {
        consumed.current = false;
        rawDragY.set(0);
      }

      // TAP: single tap on background (not on a word span)
      if (tap) {
        const target = event?.target as HTMLElement;
        const isWordSpan = target?.tagName === 'SPAN';
        if (!isWordSpan) {
          if (isDictionaryOpen) {
            closeDictionary();
          } else {
            toggleHUD();
            haptic.hudToggle();
          }
        }
        return;
      }

      // HORIZONTAL swipe detection (bookmark / highlight)
      if (!consumed.current && Math.abs(mx) > Math.abs(my) * 1.5) {
        if (
          last &&
          Math.abs(mx) >= HORIZONTAL_TRIGGER_PX &&
          Math.abs(vx) >= HORIZONTAL_TRIGGER_VELOCITY
        ) {
          consumed.current = true;
          rawDragY.set(0);
          if (mx < 0) {
            // Swipe left = bookmark
            const idx = useReaderStore.getState().currentParagraphIndex;
            bookmark(idx);
            haptic.bookmark();
          } else {
            // Swipe right = highlight
            const idx = useReaderStore.getState().currentParagraphIndex;
            highlight(idx);
            haptic.highlight();
          }
          cancel();
          return;
        }
        rawDragY.set(0);
        return;
      }

      // VERTICAL drag — translate the paragraph with spring
      if (!consumed.current && Math.abs(my) > Math.abs(mx) * 0.8) {
        if (!last) {
          rawDragY.set(my * 0.45); // 0.45 resistance factor
          return;
        }

        const absDisp = Math.abs(my);
        const absVel = Math.abs(vy);

        if (absDisp >= VERTICAL_TRIGGER_PX || absVel >= VERTICAL_TRIGGER_VELOCITY) {
          consumed.current = true;
          rawDragY.set(0); // snap back before paragraph change

          if (my < 0 || vy < -VERTICAL_TRIGGER_VELOCITY) {
            nextParagraph();
            haptic.nextParagraph();
          } else {
            prevParagraph();
            haptic.prevParagraph();
          }
        } else {
          rawDragY.set(0);
        }
      }

      if (last && !consumed.current) {
        rawDragY.set(0);
      }
    },
    {
      filterTaps: true,
      threshold: 6,
      pointer: { touch: true, mouse: true },
      eventOptions: { passive: false },
    }
  );

  return { bind, springY };
}
