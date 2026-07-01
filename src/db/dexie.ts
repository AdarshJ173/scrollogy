import Dexie, { type Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  author: string;
  fileName: string;
  fileType: 'pdf' | 'epub';
  fileData: ArrayBuffer;
  coverUrl?: string;
  totalParagraphs: number;
  addedAt: Date;
  lastOpenedAt?: Date;
}

export interface Paragraph {
  id?: number;
  bookId: number;
  index: number;
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
  paragraphsRead: number;
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

export interface ChapterEntry {
  id?: number;
  bookId: number;
  chapterIndex: number;
  chapterTitle: string;
  firstParagraphIndex: number;
}

export class FolioDB extends Dexie {
  books!: Table<Book>;
  paragraphs!: Table<Paragraph>;
  progress!: Table<ReadingProgress>;
  annotations!: Table<Annotation>;
  dictionary!: Table<DictionaryCache>;
  chapters!: Table<ChapterEntry>;

  constructor() {
    super('FolioDB');
    this.version(3).stores({
      books:       '++id, title, author, fileType, addedAt, lastOpenedAt',
      paragraphs:  '++id, bookId, index, chapterIndex',
      progress:    '++id, bookId',
      annotations: '++id, bookId, paragraphIndex, type',
      dictionary:  'word',
      chapters:    '++id, bookId, chapterIndex',
    });
  }
}

export const db = new FolioDB();
