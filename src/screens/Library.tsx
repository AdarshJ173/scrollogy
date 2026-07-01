import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, BookOpen, BarChart2, Award, Zap, Clock, Flame } from 'lucide-react';
import { useLibraryStore } from '../store/useLibraryStore';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexie';

export default function Library() {
  const { books, loadLibrary, importFile, isImporting, importProgress, deleteBook } = useLibraryStore();
  const { setBook, goToParagraph } = useReaderStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'library' | 'stats'>('library');
  const [progresses, setProgresses] = useState<Record<number, number>>({});
  const [stats, setStats] = useState({
    totalBooks: 0,
    completedBooks: 0,
    totalWords: 0,
    totalMinutes: 0,
    streak: 0,
    activeDays: 0,
  });

  // Load books on mount
  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Load progress and compile statistics
  useEffect(() => {
    const fetchProgress = async () => {
      const recs = await db.progress.toArray();
      const map: Record<number, number> = {};
      
      let totalWords = 0;
      let completedBooks = 0;
      let lastReadDates: Date[] = [];

      for (const r of recs) {
        map[r.bookId] = r.currentParagraphIndex;
        // Estimate: 85 words per paragraph
        totalWords += r.currentParagraphIndex * 85;
        
        const matchingBook = books.find(b => b.id === r.bookId);
        if (matchingBook && r.currentParagraphIndex >= matchingBook.totalParagraphs - 2) {
          completedBooks++;
        }
        if (r.lastReadAt) {
          lastReadDates.push(new Date(r.lastReadAt));
        }
      }

      // Calculate streak based on read dates
      let streak = 0;
      if (lastReadDates.length > 0) {
        // Sort dates descending
        const uniqueDates = Array.from(new Set(
          lastReadDates.map(d => d.toDateString())
        )).map(str => new Date(str)).sort((a, b) => b.getTime() - a.getTime());

        const today = new Date();
        today.setHours(0,0,0,0);
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0,0,0,0);

        if (uniqueDates[0].getTime() === today.getTime() || uniqueDates[0].getTime() === yesterday.getTime()) {
          streak = 1;
          for (let i = 0; i < uniqueDates.length - 1; i++) {
            const diffTime = uniqueDates[i].getTime() - uniqueDates[i + 1].getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              streak++;
            } else {
              break;
            }
          }
        }
      }

      setProgresses(map);
      setStats({
        totalBooks: books.length,
        completedBooks,
        totalWords,
        // Estimate: average WPM is 220
        totalMinutes: Math.round(totalWords / 220),
        streak,
        activeDays: new Set(lastReadDates.map(d => d.toDateString())).size,
      });
    };

    fetchProgress();
  }, [books, loadLibrary]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptic.importSuccess();
    await importFile(file);
  };

  const handleOpenBook = async (bookId: number, totalParagraphs: number) => {
    const progress = await db.progress.where('bookId').equals(bookId).first();
    setBook(bookId, totalParagraphs);
    if (progress) {
      goToParagraph(progress.currentParagraphIndex);
    }
    await db.books.update(bookId, { lastOpenedAt: new Date() });
    haptic.nextParagraph();
    navigate('/reader');
  };

  const handleDelete = async (e: React.MouseEvent, bookId: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this book?')) {
      haptic.error();
      await deleteBook(bookId);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      padding: '40px 20px 100px', // Space for floating bottom nav
      overflowY: 'auto'
    }}>
      
      {/* ── Tab Switcher ── */}
      {activeTab === 'library' && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{
                fontFamily: 'Merriweather',
                fontSize: 28,
                color: 'var(--card-fg)',
                margin: '0 0 4px',
                fontWeight: 700
              }}>
                Library
              </h1>
              <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted-fg)', margin: 0 }}>
                {books.length} {books.length === 1 ? 'book' : 'books'} in database
              </p>
            </div>
          </div>

          {/* Book grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {books.map((book, i) => {
              const currentPara = progresses[book.id!] || 0;
              const progressPct = book.totalParagraphs > 0
                ? Math.min(100, Math.round((currentPara / book.totalParagraphs) * 100))
                : 0;

              return (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleOpenBook(book.id!, book.totalParagraphs)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
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
                        borderRadius: 16,
                      }}
                    />
                  ) : (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(135deg, var(--secondary), var(--muted))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 48, opacity: 0.3, color: 'var(--fg)' }}>¶</span>
                    </div>
                  )}
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, book.id!)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(255, 255, 255, 0.85)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </button>

                  {/* Title overlay */}
                  <div style={{
                    position: 'relative',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
                    padding: '24px 10px 10px',
                    margin: '-16px',
                    borderRadius: '0 0 16px 16px',
                    zIndex: 5
                  }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontFamily: 'Merriweather',
                      color: '#fff', fontWeight: 700,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {book.title}
                    </p>
                    <p style={{ margin: '2px 0 6px', fontSize: 10, fontFamily: 'Inter', color: 'rgba(255,255,255,0.7)' }}>
                      {book.author}
                    </p>

                    {/* Progress indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }}>
                        <div style={{ width: `${progressPct}%`, height: '100%', background: '#10B981', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: 'Inter', color: '#fff', fontWeight: 600 }}>
                        {progressPct}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {books.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 100 }}>
              <p style={{ fontSize: 48, margin: 0 }}>¶</p>
              <p style={{ fontFamily: 'Merriweather', color: 'var(--muted-fg)', fontSize: 16, marginTop: 12 }}>
                Your library is empty
              </p>
              <p style={{ fontFamily: 'Inter', color: 'var(--muted-fg)', fontSize: 13, margin: '4px 0 0' }}>
                Tap the + button below to load a book
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ width: '100%' }}
        >
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: 'Merriweather',
              fontSize: 28,
              color: 'var(--card-fg)',
              margin: '0 0 4px',
              fontWeight: 700
            }}>
              Insights
            </h1>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: 'var(--muted-fg)', margin: 0 }}>
              Your reading telemetry
            </p>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
            {/* Streak card */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <Flame size={20} color="#F59E0B" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Merriweather', color: 'var(--card-fg)' }}>
                {stats.streak} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-fg)' }}>days</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)', marginTop: 4 }}>
                Current reading streak
              </div>
            </div>

            {/* Total Minutes card */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <Clock size={20} color="#3B82F6" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Merriweather', color: 'var(--card-fg)' }}>
                {stats.totalMinutes} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted-fg)' }}>mins</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)', marginTop: 4 }}>
                Total reading time
              </div>
            </div>

            {/* Total Words card */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <Zap size={20} color="#10B981" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Merriweather', color: 'var(--card-fg)' }}>
                {stats.totalWords.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)', marginTop: 4 }}>
                Total words digested
              </div>
            </div>

            {/* Completed Books card */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <Award size={20} color="#8B5CF6" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Merriweather', color: 'var(--card-fg)' }}>
                {stats.completedBooks} / {stats.totalBooks}
              </div>
              <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)', marginTop: 4 }}>
                Books finished
              </div>
            </div>
          </div>

          {/* Reading Achievements */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontFamily: 'Merriweather', fontSize: 16, margin: '0 0 16px', color: 'var(--card-fg)' }}>
              Bibliophile Achievements
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Achievement 1 */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: stats.totalBooks > 0 ? '#EEF2F6' : '#F1F3F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <BookOpen size={16} color={stats.totalBooks > 0 ? '#3B82F6' : '#9CA3AF'} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Inter', color: 'var(--card-fg)' }}>
                    First Thought
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)' }}>
                    Uploaded your first book
                  </div>
                </div>
              </div>

              {/* Achievement 2 */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: stats.completedBooks > 0 ? '#ECFDF5' : '#F1F3F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Award size={16} color={stats.completedBooks > 0 ? '#10B981' : '#9CA3AF'} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Inter', color: 'var(--card-fg)' }}>
                    Complete Devotion
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)' }}>
                    Completed at least one entire book
                  </div>
                </div>
              </div>

              {/* Achievement 3 */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: stats.streak >= 3 ? '#FFFBEB' : '#F1F3F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Flame size={16} color={stats.streak >= 3 ? '#F59E0B' : '#9CA3AF'} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Inter', color: 'var(--card-fg)' }}>
                    Habitual Reader
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'Inter', color: 'var(--muted-fg)' }}>
                    Read for 3 consecutive days
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.epub"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* ── Floating Bottom Navigation Bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(90vw, 360px)',
        height: 64,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        borderRadius: 32,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
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
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: activeTab === 'library' ? 'var(--primary)' : 'var(--muted-fg)',
            transition: 'color 0.2s',
            padding: 8
          }}
        >
          <BookOpen size={20} />
          <span style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: 600 }}>Library</span>
        </button>

        {/* Plus / Add Action */}
        <button
          onClick={() => { haptic.wordTap(); fileInputRef.current?.click(); }}
          disabled={isImporting}
          style={{
            background: 'var(--primary)',
            border: 'none',
            cursor: 'pointer',
            width: 46,
            height: 46,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(-14px)',
            transition: 'transform 0.2s'
          }}
          title="Import Book"
        >
          {isImporting ? (
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
              {importProgress}%
            </span>
          ) : (
            <Plus size={24} color="#fff" />
          )}
        </button>

        {/* Stats Tab */}
        <button
          onClick={() => { haptic.wordTap(); setActiveTab('stats'); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: activeTab === 'stats' ? 'var(--primary)' : 'var(--muted-fg)',
            transition: 'color 0.2s',
            padding: 8
          }}
        >
          <BarChart2 size={20} />
          <span style={{ fontSize: 10, fontFamily: 'Inter', fontWeight: 600 }}>Insights</span>
        </button>
      </div>

    </div>
  );
}
