import { create } from 'zustand';
import { db, type Annotation } from '../db/dexie';
import { useReaderStore } from './useReaderStore';

interface AnnotationState {
  annotations: Annotation[];
  loadAnnotations: (bookId: number) => Promise<void>;
  bookmark: (paragraphIndex: number) => Promise<void>;
  highlight: (paragraphIndex: number, color?: string) => Promise<void>;
  like: (paragraphIndex: number) => Promise<void>;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  loadAnnotations: async (bookId: number) => {
    const list = await db.annotations.where('bookId').equals(bookId).toArray();
    set({ annotations: list });
  },
  bookmark: async (paragraphIndex: number) => {
    const bookId = useReaderStore.getState().currentBookId;
    if (!bookId) return;

    const existing = await db.annotations
      .where('bookId').equals(bookId)
      .and(a => a.paragraphIndex === paragraphIndex && a.type === 'bookmark')
      .first();

    if (existing?.id) {
      await db.annotations.delete(existing.id);
    } else {
      await db.annotations.add({
        bookId,
        paragraphIndex,
        type: 'bookmark',
        createdAt: new Date(),
      });
    }
    await get().loadAnnotations(bookId);
  },
  highlight: async (paragraphIndex: number, color = '#FCD34D') => {
    const bookId = useReaderStore.getState().currentBookId;
    if (!bookId) return;

    const existing = await db.annotations
      .where('bookId').equals(bookId)
      .and(a => a.paragraphIndex === paragraphIndex && a.type === 'highlight')
      .first();

    if (existing?.id) {
      await db.annotations.delete(existing.id);
    } else {
      await db.annotations.add({
        bookId,
        paragraphIndex,
        type: 'highlight',
        color,
        createdAt: new Date(),
      });
    }
    await get().loadAnnotations(bookId);
  },
  like: async (paragraphIndex: number) => {
    const bookId = useReaderStore.getState().currentBookId;
    if (!bookId) return;

    const existing = await db.annotations
      .where('bookId').equals(bookId)
      .and(a => a.paragraphIndex === paragraphIndex && a.type === 'like')
      .first();

    if (existing?.id) {
      await db.annotations.delete(existing.id);
    } else {
      await db.annotations.add({
        bookId,
        paragraphIndex,
        type: 'like',
        createdAt: new Date(),
      });
    }
    await get().loadAnnotations(bookId);
  },
}));
