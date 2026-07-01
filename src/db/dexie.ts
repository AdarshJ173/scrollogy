import Dexie, { type Table } from 'dexie';

// ─── Table interfaces ──────────────────────────────────────────────────────────

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

export interface ReadingLog {
  id?: number;
  bookId: number;
  date: string;
  startedAt: number;
  durationMs: number;
  paragraphsRead: number;
  wpmEstimate: number;
  hourOfDay: number;
}

export interface Achievement {
  id: string;
  unlockedAt: Date;
  label: string;
  description: string;
  icon: string;
}

// ─── Dexie class ──────────────────────────────────────────────────────────────

export class FolioDB extends Dexie {
  books!:       Table<Book>;
  paragraphs!:  Table<Paragraph>;
  progress!:    Table<ReadingProgress>;
  annotations!: Table<Annotation>;
  dictionary!:  Table<DictionaryCache>;
  chapters!:    Table<ChapterEntry>;
  readingLogs!: Table<ReadingLog>;
  achievements!:Table<Achievement>;

  constructor() {
    super('FolioDB');

    // Version 3: intermediate schema
    this.version(3).stores({
      books:        '++id, title, author, fileType, addedAt',
      paragraphs:   '++id, bookId, index, chapterIndex',
      progress:     '++id, bookId',
      annotations:  '++id, bookId, paragraphIndex, type',
      dictionary:   'word',
      chapters:     '++id, bookId, chapterIndex',
    });

    // Version 4: Introduce readingLogs and achievements stores
    this.version(4).stores({
      books:        '++id, title, author, fileType, addedAt',
      paragraphs:   '++id, bookId, index, chapterIndex',
      progress:     '++id, bookId',
      annotations:  '++id, bookId, paragraphIndex, type',
      dictionary:   'word',
      chapters:     '++id, bookId, chapterIndex',
      readingLogs:  '++id, bookId, date, startedAt',
      achievements: 'id, unlockedAt',
    });
  }
}

export const db = new FolioDB();

// ─── Reading Session Manager ───────────────────────────────────────────────────

export class ReadingSessionManager {
  private bookId: number | null = null;
  private startedAt  = 0;
  private paragraphs = 0;
  private totalWords = 0;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly INACTIVITY_MS = 60_000;

  start(bookId: number) {
    this.end(); // close any previous session
    this.bookId     = bookId;
    this.startedAt  = Date.now();
    this.paragraphs = 0;
    this.totalWords = 0;
    this.resetInactivity();
  }

  advance(wordCount: number) {
    if (!this.bookId) return;
    this.paragraphs++;
    this.totalWords += wordCount;
    this.resetInactivity();
  }

  async end() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (!this.bookId || this.paragraphs === 0) {
      this.bookId = null;
      return;
    }

    const durationMs    = Date.now() - this.startedAt;
    const durationMins  = durationMs / 60_000;
    const wpmEstimate   = durationMins > 0 ? Math.round(this.totalWords / durationMins) : 0;
    const hourOfDay     = new Date(this.startedAt).getHours();
    const date          = new Date(this.startedAt).toISOString().slice(0, 10);

    await db.readingLogs.add({
      bookId:        this.bookId,
      date,
      startedAt:     this.startedAt,
      durationMs,
      paragraphsRead: this.paragraphs,
      wpmEstimate:   Math.min(wpmEstimate, 1200),
      hourOfDay,
    });

    // Check and unlock achievements
    await checkAchievements(this.bookId, {
      durationMs,
      wpmEstimate,
      hourOfDay,
      totalWords: this.totalWords,
    });

    this.bookId     = null;
    this.paragraphs = 0;
    this.totalWords = 0;
  }

  private resetInactivity() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => this.end(), this.INACTIVITY_MS);
  }
}

export const sessionManager = new ReadingSessionManager();

// ─── Achievement checker ───────────────────────────────────────────────────────

interface SessionSummary {
  durationMs:  number;
  wpmEstimate: number;
  hourOfDay:   number;
  totalWords:  number;
}

async function checkAchievements(bookId: number, session: SessionSummary) {
  const unlock = async (id: string, label: string, description: string, icon: string) => {
    const exists = await db.achievements.get(id);
    if (!exists) {
      await db.achievements.put({ id, label, description, icon, unlockedAt: new Date() });
    }
  };

  // Night Owl: read after 11 PM
  if (session.hourOfDay >= 23 || session.hourOfDay === 0) {
    await unlock('night_owl', 'Night Owl', 'Read after 11 PM', '🦉');
  }

  // Speed Demon: WPM > 300
  if (session.wpmEstimate > 300) {
    await unlock('speed_demon', 'Speed Demon', 'Exceeded 300 WPM', '⚡');
  }

  // Deep Diver: 45+ continuous minutes
  if (session.durationMs >= 45 * 60_000) {
    await unlock('deep_diver', 'Deep Diver', '45+ minutes in one session', '🤿');
  }

  // Marathoner: 5000+ words in a day
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = await db.readingLogs.where('date').equals(today).toArray();
  const todayWords = todayLogs.reduce((sum, l) => sum + l.paragraphsRead * 75, 0);
  if (todayWords >= 5000) {
    await unlock('marathoner', 'Marathoner', '5,000+ words in a day', '🏃');
  }
}
