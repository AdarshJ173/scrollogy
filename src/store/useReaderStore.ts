import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'sepia' | 'true-black';

interface ReaderState {
  currentBookId: number | null;
  currentParagraphIndex: number;
  totalParagraphs: number;
  theme: Theme;
  fontSize: number;
  lineHeight: number;
  isHUDVisible: boolean;
  isChapterSidebarOpen: boolean;
  isBookInfoOpen: boolean;
  isDictionaryOpen: boolean;
  selectedWord: string;

  // Actions
  setBook: (bookId: number, totalParagraphs: number) => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  goToParagraph: (index: number) => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  toggleHUD: () => void;
  openChapterSidebar: () => void;
  closeChapterSidebar: () => void;
  openBookInfo: () => void;
  closeBookInfo: () => void;
  openDictionary: (word: string) => void;
  closeDictionary: () => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      currentBookId: null,
      currentParagraphIndex: 0,
      totalParagraphs: 0,
      theme: 'light',
      fontSize: 18,
      lineHeight: 1.85,
      isHUDVisible: false,
      isChapterSidebarOpen: false,
      isBookInfoOpen: false,
      isDictionaryOpen: false,
      selectedWord: '',

      setBook: (bookId, totalParagraphs) => set({ 
        currentBookId: bookId, 
        currentParagraphIndex: 0, 
        totalParagraphs 
      }),

      nextParagraph: () => set(s => ({
        currentParagraphIndex: Math.min(s.currentParagraphIndex + 1, s.totalParagraphs - 1)
      })),

      prevParagraph: () => set(s => ({
        currentParagraphIndex: Math.max(s.currentParagraphIndex - 1, 0)
      })),

      goToParagraph: (index) => set({ currentParagraphIndex: index }),

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },

      setFontSize: (fontSize) => {
        document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`);
        set({ fontSize });
      },

      toggleHUD: () => set(s => ({ isHUDVisible: !s.isHUDVisible })),
      openChapterSidebar: () => set({ isChapterSidebarOpen: true }),
      closeChapterSidebar: () => set({ isChapterSidebarOpen: false }),
      openBookInfo: () => set({ isBookInfoOpen: true }),
      closeBookInfo: () => set({ isBookInfoOpen: false }),
      openDictionary: (word) => set({ isDictionaryOpen: true, selectedWord: word }),
      closeDictionary: () => set({ isDictionaryOpen: false, selectedWord: '' }),
    }),
    { 
      name: 'folio-reader-state', 
      partialize: (s) => ({ 
        theme: s.theme, 
        fontSize: s.fontSize, 
        lineHeight: s.lineHeight 
      })
    }
  )
);
