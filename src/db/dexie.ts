import Dexie, { type Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  author: string;
  fileName: string;
  fileType: 'pdf' | 'epub';
  fileData: ArrayBuffer;       // store raw file in IndexedDB
  coverUrl?: string;
  totalParagraphs: number;
  addedAt: Date;
  lastOpenedAt?: Date;
}

export interface Paragraph {
  id?: number;
  bookId: number;
  index: number;               // paragraph position in book (0-based)
  chapterIndex: number;
  chapterTitle: string;
  text: string;
  wordCount: number;
}

export interface ReadingProgress {
  id?: number;
  bookId: number;
  currentParagraphIndex: number;
  lastReadAt: Date;
  totalReadingTimeMs: number;
  paragraphsRead: number;      // for streak/gamification
}

export interface Annotation {
  id?: number;
  bookId: number;
  paragraphIndex: number;
  type: 'highlight' | 'bookmark' | 'like';
  note?: string;
  color?: string;
  createdAt: Date;
}

export interface DictionaryCache {
  word: string;
  data: any;
  cachedAt: Date;
}

export class FolioDB extends Dexie {
  books!: Table<Book>;
  paragraphs!: Table<Paragraph>;
  progress!: Table<ReadingProgress>;
  annotations!: Table<Annotation>;
  dictionary!: Table<DictionaryCache>;

  constructor() {
    super('FolioDB');
    this.version(2).stores({
      books:       '++id, title, author, fileType, addedAt, lastOpenedAt',
      paragraphs:  '++id, bookId, index, chapterIndex',
      progress:    '++id, bookId',
      annotations: '++id, bookId, paragraphIndex, type',
      dictionary:  'word',
    });
  }
}

export const db = new FolioDB();
