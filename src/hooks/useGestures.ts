import { useGesture } from '@use-gesture/react';
import { haptic } from '../engine/HapticEngine';
import { useReaderStore } from '../store/useReaderStore';
import { useAnnotationStore } from '../store/useAnnotationStore';

export function useReaderGestures() {
  const { 
    nextParagraph, prevParagraph, 
    toggleHUD, currentParagraphIndex,
    openChapterSidebar, openBookInfo
  } = useReaderStore();
  
  const { bookmark, highlight } = useAnnotationStore();

  return useGesture({
    // Scroll — primary navigation
    onWheel: ({ delta: [, dy], event }) => {
      if (event) {
        event.preventDefault();
      }
      if (dy > 10) { 
        nextParagraph(); 
        haptic.nextParagraph(); 
      }
      else if (dy < -10) { 
        prevParagraph(); 
        haptic.prevParagraph(); 
      }
    },

    // Touch drag — mobile navigation
    onDrag: ({ last, movement: [mx, my], tap, swipe: [sx, sy] }) => {
      if (tap) {
        toggleHUD();
        haptic.hudToggle();
        return;
      }
      
      if (last) {
        // Vertical scroll/swipe
        if (my < -60 || sy === -1) { 
          nextParagraph(); 
          haptic.nextParagraph(); 
        } else if (my > 60 || sy === 1) { 
          prevParagraph(); 
          haptic.prevParagraph(); 
        }
        
        // Horizontal swipe on paragraph
        else if (mx < -60 || sx === -1) { 
          bookmark(currentParagraphIndex); 
          haptic.bookmark(); 
        } else if (mx > 60 || sx === 1) { 
          highlight(currentParagraphIndex); 
          haptic.highlight(); 
        }
      }
    },

    // Pinch — font size
    onPinch: ({ offset: [scale] }) => {
      const fontSize = Math.min(28, Math.max(14, Math.round(18 * scale)));
      useReaderStore.getState().setFontSize(fontSize);
      haptic.fontSizeChange();
    },

    // Edge swipes or taps
    onPointerDown: ({ event }) => {
      const x = (event as PointerEvent).clientX;
      const y = (event as PointerEvent).clientY;
      const screenH = window.innerHeight;
      
      if (x < 24) { 
        openChapterSidebar(); 
        haptic.drawerOpen(); 
      }
      if (y > screenH - 48) {
        openBookInfo();
      }
    },
  }, {
    drag: {
      swipe: { distance: 30, velocity: 0.15 },
      filterTaps: true,
    },
    pinch: { scaleBounds: { min: 0.7, max: 1.6 } },
    eventOptions: { passive: false },
  });
}
