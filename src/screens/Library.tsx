import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpen, BarChart2, Trash2, Flame, Zap, Clock, Award } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexie';
import type { Book, ReadingLog, Achievement } from '../db/dexie';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayCell {
  date: string;
  intensity: number;
  minutesRead: number;
}

interface StatsData {
  streak: number;
  todayMinutes: number;
  totalMinutes: number;
  totalWords: number;
  completedBooks: number;
  avgWpm: number;
  activeDays: number;
  heatmapCells: DayCell[];
  achievements: Achievement[];
  dailyGoalMinutes: number;
  todayGoalPct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Radial Progress Ring ─────────────────────────────────────────────────────

function RadialRing({
  pct,
  size = 110,
  stroke = 9,
  label,
  sublabel,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
}) {
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 20, fontWeight: 700,
          color: 'var(--card-fg)', lineHeight: 1,
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10, color: 'var(--muted-fg)',
          marginTop: 2, textAlign: 'center', lineHeight: 1.2,
          maxWidth: size * 0.55,
        }}>
          {sublabel}
        </span>
      </div>
    </div>
  );
}

// ─── Heatmap Grid ──────────────────────────────────────────────

const INTENSITY_COLORS = [
  'var(--border)',
  'rgba(200,130,58,0.25)',
  'rgba(200,130,58,0.50)',
  'rgba(200,130,58,0.75)',
  'var(--primary)',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function HeatmapGrid({ cells }: { cells: DayCell[] }) {
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 2 }}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} style={{
              width: 10, height: 10,
              fontFamily: 'Inter', fontSize: 8,
              color: 'var(--muted-fg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {week.map((cell, di) => (
              <motion.div
                key={`${wi}-${di}`}
                title={cell.minutesRead > 0 ? `${cell.date}: ${cell.minutesRead}m` : cell.date}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (wi * 7 + di) * 0.002, duration: 0.2 }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: INTENSITY_COLORS[cell.intensity],
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 8, justifyContent: 'flex-end',
      }}>
        <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--muted-fg)' }}>Less</span>
        {INTENSITY_COLORS.map((c, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontFamily: 'Inter', fontSize: 9, color: 'var(--muted-fg)' }}>More</span>
      </div>
    </div>
  );
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
  icon, value, label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ color: 'var(--primary)' }}>{icon}</div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 22, fontWeight: 700,
        color: 'var(--card-fg)', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11, color: 'var(--muted-fg)',
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Achievement Badge ─────────────────────────────────────────────────────────

const ALL_ACHIEVEMENTS = [
  { id: 'night_owl',    icon: '🦉', label: 'Night Owl',    description: 'Read after 11 PM' },
  { id: 'speed_demon',  icon: '⚡', label: 'Speed Demon',  description: 'Exceeded 300 WPM' },
  { id: 'deep_diver',   icon: '🤿', label: 'Deep Diver',   description: '45+ mins in one session' },
  { id: 'marathoner',   icon: '🏃', label: 'Marathoner',   description: '5,000+ words in a day' },
  { id: 'bibliophile',  icon: '📚', label: 'Bibliophile',  description: 'Added 5+ books to library' },
  { id: 'finisher',     icon: '🏆', label: 'Finisher',     description: 'Completed your first book' },
];

function AchievementBadge({
  icon, label, unlocked,
}: {
  id: string; icon: string; label: string;
  description: string; unlocked: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6,
        opacity: unlocked ? 1 : 0.3,
        filter: unlocked ? 'none' : 'grayscale(1)',
      }}
    >
      <div style={{
        width: 52, height: 52,
        background: unlocked ? 'var(--secondary)' : 'var(--muted)',
        border: unlocked ? '2px solid var(--primary)' : '2px solid var(--border)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
        boxShadow: unlocked ? '0 4px 12px rgba(200,130,58,0.2)' : 'none',
        transition: 'all 0.3s',
      }}>
        {icon}
      </div>
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 10, fontWeight: 600,
        color: unlocked ? 'var(--card-fg)' : 'var(--muted-fg)',
        textAlign: 'center', maxWidth: 70,
        lineHeight: 1.2,
      }}>
        {label}
      </span>
    </motion.div>
  );
}

// ─── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({
  book, progressPct, onOpen, onDelete,
}: {
  book: Book;
  progressPct: number;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        cursor: 'pointer',
        aspectRatio: '3/4.2',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, var(--secondary), var(--muted))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 52, opacity: 0.2, fontFamily: 'Merriweather, serif' }}>¶</span>
        </div>
      )}

      <button
        onClick={onDelete}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.45)',
          border: 'none', borderRadius: '50%',
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 2,
        }}
      >
        <Trash2 size={13} color="#fff" />
      </button>

      <div style={{
        position: 'relative', zIndex: 1,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '24px 12px 12px',
      }}>
        <div style={{
          height: 3, background: 'rgba(255,255,255,0.2)',
          borderRadius: 2, marginBottom: 8, overflow: 'hidden',
        }}>
          <motion.div
            style={{ height: '100%', background: 'var(--primary)', borderRadius: 2 }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p style={{
          margin: 0, fontSize: 12, fontFamily: 'Merriweather, serif',
          color: '#fff', fontWeight: 700, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {book.title}
        </p>
        <p style={{
          margin: '3px 0 0', fontSize: 10,
          fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.6)',
        }}>
          {progressPct}% · {book.author}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Library() {
  const { books, loadLibrary, importFile, isImporting, importProgress, deleteBook } = useLibraryStore();
  const { setBook, goToParagraph } = useReaderStore();
  const navigate    = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab]   = useState<'library' | 'stats'>('library');
  const [progresses, setProgresses] = useState<Record<number, number>>({});
  const [stats, setStats]           = useState<StatsData | null>(null);
  const DAILY_GOAL_MINUTES          = 20;

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  useEffect(() => {
    db.progress.toArray().then(recs => {
      const map: Record<number, number> = {};
      for (const r of recs) map[r.bookId] = r.currentParagraphIndex;
      setProgresses(map);
    });
  }, [books]);

  useEffect(() => {
    if (activeTab !== 'stats') return;

    const compute = async () => {
      const today     = new Date();
      const todayStr  = isoDate(today);

      const cutoff    = isoDate(addDays(today, -83));
      const logs      = await db.readingLogs
        .where('date').between(cutoff, todayStr, true, true)
        .toArray();

      const dayMap = new Map<string, number>();
      for (const log of logs) {
        const mins = (log.durationMs / 60_000);
        dayMap.set(log.date, (dayMap.get(log.date) ?? 0) + mins);
      }

      const allMins  = Array.from(dayMap.values());
      const maxMins  = allMins.length ? Math.max(...allMins) : 1;

      const heatmapCells: DayCell[] = [];
      for (let i = 83; i >= 0; i--) {
        const d    = addDays(today, -i);
        const ds   = isoDate(d);
        const mins = dayMap.get(ds) ?? 0;
        const intensity = mins === 0 ? 0 : Math.min(4, Math.ceil((mins / maxMins) * 4));
        heatmapCells.push({ date: ds, intensity, minutesRead: Math.round(mins) });
      }

      let streak    = 0;
      let checkDate = new Date(today);
      checkDate.setHours(0, 0, 0, 0);

      if (!dayMap.has(isoDate(checkDate))) {
        checkDate = addDays(checkDate, -1);
      }
      while (dayMap.has(isoDate(checkDate))) {
        streak++;
        checkDate = addDays(checkDate, -1);
      }

      const todayLogs    = logs.filter(l => l.date === todayStr);
      const todayMinutes = todayLogs.reduce((s, l) => s + l.durationMs / 60_000, 0);
      const todayGoalPct = Math.min(100, (todayMinutes / DAILY_GOAL_MINUTES) * 100);

      const totalMinutes = logs.reduce((s, l) => s + l.durationMs / 60_000, 0);
      const totalWords   = logs.reduce((s, l) => s + l.paragraphsRead * 75, 0);

      const wpmLogs  = logs.filter(l => l.wpmEstimate > 0);
      const avgWpm   = wpmLogs.length
        ? Math.round(wpmLogs.reduce((s, l) => s + l.wpmEstimate, 0) / wpmLogs.length)
        : 0;

      const progressRecs = await db.progress.toArray();
      let completedBooks = 0;
      for (const p of progressRecs) {
        const book = books.find(b => b.id === p.bookId);
        if (book && p.currentParagraphIndex >= book.totalParagraphs - 2) completedBooks++;
      }

      const activeDays = dayMap.size;

      if (books.length >= 5) {
        const exists = await db.achievements.get('bibliophile');
        if (!exists) {
          await db.achievements.put({
            id: 'bibliophile',
            label: 'Bibliophile',
            description: 'Added 5+ books',
            icon: '📚',
            unlockedAt: new Date(),
          });
        }
      }
      if (completedBooks >= 1) {
        const exists = await db.achievements.get('finisher');
        if (!exists) {
          await db.achievements.put({
            id: 'finisher',
            label: 'Finisher',
            description: 'Completed your first book',
            icon: '🏆',
            unlockedAt: new Date(),
          });
        }
      }

      const achievements = await db.achievements.toArray();

      setStats({
        streak,
        todayMinutes:    Math.round(todayMinutes),
        totalMinutes:    Math.round(totalMinutes),
        totalWords,
        completedBooks,
        avgWpm,
        activeDays,
        heatmapCells,
        achievements,
        dailyGoalMinutes: DAILY_GOAL_MINUTES,
        todayGoalPct,
      });
    };

    compute();
  }, [activeTab, books]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptic.importSuccess();
    await importFile(file);
  };

  const handleOpenBook = async (bookId: number, totalParagraphs: number) => {
    const progress = await db.progress.where('bookId').equals(bookId).first();
    setBook(bookId, totalParagraphs);
    if (progress) goToParagraph(progress.currentParagraphIndex);
    await db.books.update(bookId, { lastOpenedAt: new Date() });
    haptic.nextParagraph();
    navigate('/reader');
  };

  const handleDelete = async (e: React.MouseEvent, bookId: number) => {
    e.stopPropagation();
    if (confirm('Remove this book?')) {
      haptic.error();
      await deleteBook(bookId);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      overflowY: 'auto',
      paddingBottom: 100,
    }}>
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 40px)' }} />

      <AnimatePresence mode="wait">
        {activeTab === 'library' && (
          <motion.div
            key="library"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            style={{ padding: '0 20px' }}
          >
            <div style={{ marginBottom: 24 }}>
              <h1 style={{
                fontFamily: 'Merriweather, serif',
                fontSize: 26, fontWeight: 700,
                color: 'var(--card-fg)', margin: '0 0 4px',
              }}>
                Library
              </h1>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13, color: 'var(--muted-fg)', margin: 0,
              }}>
                {books.length} {books.length === 1 ? 'book' : 'books'}
                {isImporting && ` · Importing ${importProgress}%`}
              </p>
            </div>

            {isImporting && (
              <div style={{
                height: 3, background: 'var(--border)',
                borderRadius: 2, marginBottom: 20, overflow: 'hidden',
              }}>
                <motion.div
                  style={{ height: '100%', background: 'var(--primary)', borderRadius: 2 }}
                  animate={{ width: `${importProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {books.length === 0 && !isImporting ? (
              <div style={{ textAlign: 'center', marginTop: 80 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>¶</div>
                <p style={{
                  fontFamily: 'Merriweather, serif',
                  fontSize: 16, color: 'var(--muted-fg)',
                }}>
                  Your library is empty
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14, color: 'var(--muted-fg)', marginTop: 8,
                }}>
                  Tap + to add a PDF or EPUB
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 14,
              }}>
                {books.map((book) => {
                  const cur  = progresses[book.id!] ?? 0;
                  const pct  = book.totalParagraphs > 0
                    ? Math.min(100, Math.round((cur / book.totalParagraphs) * 100))
                    : 0;
                  return (
                    <BookCard
                      key={book.id}
                      book={book}
                      progressPct={pct}
                      onOpen={() => handleOpenBook(book.id!, book.totalParagraphs)}
                      onDelete={e => handleDelete(e, book.id!)}
                    />
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
            style={{ padding: '0 20px' }}
          >
            <div style={{ marginBottom: 24 }}>
              <h1 style={{
                fontFamily: 'Merriweather, serif',
                fontSize: 26, fontWeight: 700,
                color: 'var(--card-fg)', margin: '0 0 4px',
              }}>
                Insights
              </h1>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13, color: 'var(--muted-fg)', margin: 0,
              }}>
                Your reading analytics
              </p>
            </div>

            {!stats ? (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--muted-fg)', fontFamily: 'Inter' }}>
                Loading...
              </div>
            ) : (
              <>
                <div style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <RadialRing
                    pct={stats.todayGoalPct}
                    size={110}
                    stroke={9}
                    label={`${stats.todayMinutes}m`}
                    sublabel={`of ${stats.dailyGoalMinutes}m goal`}
                  />
                  <div style={{
                    flex: 1, paddingLeft: 20,
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    <div>
                      <div style={{
                        fontFamily: 'Inter', fontSize: 11,
                        color: 'var(--muted-fg)', textTransform: 'uppercase',
                        letterSpacing: '0.1em', marginBottom: 2,
                      }}>
                        Current Streak
                      </div>
                      <div style={{
                        fontFamily: 'Inter', fontSize: 28, fontWeight: 800,
                        color: 'var(--primary)', lineHeight: 1,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {stats.streak}
                        <Flame size={18} color="var(--primary)" />
                      </div>
                      <div style={{
                        fontFamily: 'Inter', fontSize: 11, color: 'var(--muted-fg)',
                      }}>
                        days
                      </div>
                    </div>
                    <div>
                      <div style={{
                        fontFamily: 'Inter', fontSize: 11,
                        color: 'var(--muted-fg)', textTransform: 'uppercase',
                        letterSpacing: '0.1em', marginBottom: 2,
                      }}>
                        Avg Speed
                      </div>
                      <div style={{
                        fontFamily: 'Inter', fontSize: 22, fontWeight: 700,
                        color: 'var(--card-fg)', lineHeight: 1,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {stats.avgWpm || '—'}
                        {stats.avgWpm > 0 && <Zap size={14} color="var(--primary)" />}
                      </div>
                      {stats.avgWpm > 0 && (
                        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--muted-fg)' }}>
                          WPM
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12, marginBottom: 16,
                }}>
                  <StatTile
                    icon={<Clock size={18} />}
                    value={stats.totalMinutes >= 60
                      ? `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`
                      : `${stats.totalMinutes}m`
                    }
                    label="Total read"
                  />
                  <StatTile
                    icon={<BookOpen size={18} />}
                    value={`${stats.completedBooks} / ${books.length}`}
                    label="Books finished"
                  />
                  <StatTile
                    icon={<Zap size={18} />}
                    value={stats.totalWords >= 1000
                      ? `${(stats.totalWords / 1000).toFixed(1)}k`
                      : `${stats.totalWords}`
                    }
                    label="Words read"
                  />
                  <StatTile
                    icon={<Award size={18} />}
                    value={`${stats.activeDays}`}
                    label="Active days"
                  />
                </div>

                <div style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '18px 16px',
                  marginBottom: 16,
                  overflowX: 'auto',
                }}>
                  <div style={{
                    fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
                    color: 'var(--card-fg)', marginBottom: 12,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    Reading Activity
                  </div>
                  <HeatmapGrid cells={stats.heatmapCells} />
                </div>

                <div style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '18px 16px',
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
                    color: 'var(--card-fg)', marginBottom: 16,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    Achievements
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 16,
                  }}>
                    {ALL_ACHIEVEMENTS.map(a => (
                      <AchievementBadge
                        key={a.id}
                        {...a}
                        unlocked={stats.achievements.some(u => u.id === a.id)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* ── Floating Capsule Bottom Navigation Bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(90vw, 340px)',
        height: 60,
        background: 'var(--card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 30,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 12px'
      }}>
        {/* Library Tab */}
        <button
          onClick={() => { haptic.wordTap(); setActiveTab('library'); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: activeTab === 'library' ? 'var(--primary)' : 'var(--muted-fg)',
            transition: 'color 0.2s',
            padding: '4px 16px',
            position: 'relative',
            flex: 1
          }}
        >
          <BookOpen size={20} style={{ transform: activeTab === 'library' ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.2s' }} />
          <span style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600 }}>Library</span>
          {activeTab === 'library' && (
            <motion.div
              layoutId="tab-dot"
              style={{
                position: 'absolute',
                bottom: -4,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--primary)'
              }}
            />
          )}
        </button>

        {/* Plus / Add Action (Centered in-flow) */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => { fileInputRef.current?.click(); haptic.importSuccess(); }}
          disabled={isImporting}
          style={{
            background: 'linear-gradient(135deg, var(--primary), #9B6032)',
            border: 'none',
            cursor: 'pointer',
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(200,130,58,0.4)',
            transition: 'transform 0.2s',
            flexShrink: 0
          }}
          title="Import Book"
        >
          {isImporting ? (
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
              {importProgress}%
            </span>
          ) : (
            <Plus size={22} color="#fff" />
          )}
        </motion.button>

        {/* Stats Tab */}
        <button
          onClick={() => { haptic.wordTap(); setActiveTab('stats'); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: activeTab === 'stats' ? 'var(--primary)' : 'var(--muted-fg)',
            transition: 'color 0.2s',
            padding: '4px 16px',
            position: 'relative',
            flex: 1
          }}
        >
          <BarChart2 size={20} style={{ transform: activeTab === 'stats' ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.2s' }} />
          <span style={{ fontSize: 9, fontFamily: 'Inter', fontWeight: 600 }}>Insights</span>
          {activeTab === 'stats' && (
            <motion.div
              layoutId="tab-dot"
              style={{
                position: 'absolute',
                bottom: -4,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--primary)'
              }}
            />
          )}
        </button>
      </div>

    </div>
  );
}
