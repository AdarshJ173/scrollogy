import { create } from 'zustand';
import { db } from '../db/dexie';
import { parsePdf } from '../engine/PdfParser';
import { parseEpub } from '../engine/EpubParser';
import type { Book } from '../db/dexie';

interface LibraryState {
  books: Book[];
  isImporting: boolean;
  importProgress: number;
  
  loadLibrary: () => Promise<void>;
  importFile: (file: File) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  isImporting: false,
  importProgress: 0,

  loadLibrary: async () => {
    const books = await db.books.orderBy('lastOpenedAt').reverse().toArray();
    set({ books });
  },

  importFile: async (file: File) => {
    set({ isImporting: true, importProgress: 0 });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const arrayBufferForDb = arrayBuffer.slice(0);
      const fileType = file.name.endsWith('.epub') ? 'epub' : 'pdf';
      
      let parsed;
      if (fileType === 'pdf') {
        parsed = await parsePdf(arrayBuffer, file.name);
      } else {
        parsed = await parseEpub(arrayBuffer, file.name);
      }

      set({ importProgress: 50 });

      const bookId = await db.books.add({
        title: parsed.title,
        author: (parsed as any).author || 'Unknown',
        fileName: file.name,
        fileType,
        fileData: arrayBufferForDb,
        coverUrl: (parsed as any).coverUrl,
        totalParagraphs: parsed.paragraphs.length,
        addedAt: new Date(),
        lastOpenedAt: new Date()
      }) as number;

      // Bulk insert paragraphs
      const paragraphsWithBookId = parsed.paragraphs.map(p => ({ ...p, bookId }));
      await db.paragraphs.bulkAdd(paragraphsWithBookId);

      // Bulk insert chapters
      if (parsed.chapters && parsed.chapters.length > 0) {
        const chaptersWithBookId = parsed.chapters.map(c => ({ ...c, bookId }));
        await db.chapters.bulkAdd(chaptersWithBookId);
      }

      set({ importProgress: 100 });
      await get().loadLibrary();
    } finally {
      set({ isImporting: false, importProgress: 0 });
    }
  },

  deleteBook: async (id: number) => {
    await db.books.delete(id);
    await db.paragraphs.where('bookId').equals(id).delete();
    await db.annotations.where('bookId').equals(id).delete();
    await db.progress.where('bookId').equals(id).delete();
    await db.chapters.where('bookId').equals(id).delete();
    await get().loadLibrary();
  },
}));
