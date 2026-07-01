import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { db } from '../db/dexie';
import { useReaderStore } from '../store/useReaderStore';
import { haptic } from '../engine/HapticEngine';
import * as pdfjsLib from 'pdfjs-dist';

// ─── PDF Page Preview Component ────────────────────────────────────────────────

function PdfPagePreview({ pdfDoc, pageNum }: { pdfDoc: any; pageNum: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;

    pdfDoc.getPage(pageNum).then((page: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Render at a low resolution matching the card size
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvasContext: context, viewport });
      renderTask.promise.catch(() => {});
    }).catch(() => {});

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        borderRadius: 4,
      }}
    />
  );
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

interface BookPageInfo {
  pageNum: number;
  firstParagraphIndex: number;
  previewText: string;
}

export default function ChapterSidebar() {
  const { currentBookId, closeChapterSidebar, goToParagraph, currentParagraphIndex } = useReaderStore();
  const [pages, setPages] = useState<BookPageInfo[]>([]);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileType, setFileType] = useState<'pdf' | 'epub'>('epub');

  // Load book file data for PDF rendering
  useEffect(() => {
    if (!currentBookId) return;

    db.books.get(currentBookId).then(book => {
      if (book) {
        setFileType(book.fileType);
        if (book.fileType === 'pdf') {
          pdfjsLib.getDocument({ data: book.fileData }).promise.then(doc => {
            setPdfDoc(doc);
          }).catch(() => {});
        }
      }
    });
  }, [currentBookId]);

  // Retrieve paragraph mapping to construct page boundaries
  useEffect(() => {
    if (!currentBookId) return;

    db.paragraphs
      .where('bookId')
      .equals(currentBookId)
      .toArray()
      .then(paras => {
        const pageList: BookPageInfo[] = [];
        const seenPages = new Set<number>();

        for (const p of paras) {
          const pNum = p.pageNum || Math.floor(p.index / 6) + 1; // 6 paras per virtual page for EPUB
          if (!seenPages.has(pNum)) {
            seenPages.add(pNum);
            pageList.push({
              pageNum: pNum,
              firstParagraphIndex: p.index,
              previewText: p.text.slice(0, 150),
            });
          }
        }
        setPages(pageList);
      });
  }, [currentBookId]);

  // Determine which page contains the active paragraph
  const activePageNum = pages.reduce((acc, p) => {
    if (p.firstParagraphIndex <= currentParagraphIndex) return p.pageNum;
    return acc;
  }, 1);

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'min(85vw, 320px)',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 20px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontFamily: 'Merriweather, serif', fontSize: 16, color: 'var(--card-fg)', fontWeight: 700 }}>
          Pages
        </span>
        <button
          onClick={() => { closeChapterSidebar(); haptic.drawerClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
        >
          <X size={18} color="var(--muted-fg)" />
        </button>
      </div>

      {/* Pages Grid Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {pages.length === 0 && (
          <p style={{ padding: '12px', color: 'var(--muted-fg)', fontFamily: 'Inter', fontSize: 14 }}>
            Generating page grid...
          </p>
        )}
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {pages.map(page => {
            const isActive = page.pageNum === activePageNum;

            return (
              <motion.div
                key={page.pageNum}
                onClick={() => {
                  goToParagraph(page.firstParagraphIndex);
                  haptic.wordTap();
                  closeChapterSidebar();
                }}
                whileTap={{ scale: 0.96 }}
                style={{
                  aspectRatio: '1/1.32',
                  background: 'var(--secondary)',
                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isActive ? '0 4px 12px rgba(200, 130, 58, 0.15)' : 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                {fileType === 'pdf' && pdfDoc ? (
                  <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PdfPagePreview pdfDoc={pdfDoc} pageNum={page.pageNum} />
                  </div>
                ) : (
                  // EPUB Preview Layout
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 8,
                      fontWeight: 600,
                      color: 'var(--muted-fg)',
                      marginBottom: 4,
                    }}>
                      PAGE {page.pageNum}
                    </span>
                    <p style={{
                      fontFamily: 'Merriweather, serif',
                      fontSize: 7,
                      lineHeight: 1.3,
                      color: 'var(--card-fg)',
                      margin: 0,
                      opacity: 0.85,
                      textAlign: 'left',
                    }}>
                      {page.previewText}...
                    </p>
                    {/* Bottom gradient fade */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0, height: 16,
                      background: 'linear-gradient(transparent, var(--secondary))',
                    }} />
                  </div>
                )}

                {/* Page number badge inside card */}
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontSize: 8,
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 4,
                  zIndex: 2,
                }}>
                  {page.pageNum}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
