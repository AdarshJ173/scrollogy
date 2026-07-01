import * as pdfjsLib from 'pdfjs-dist';
import { splitIntoParagraphs } from './ParagraphSplitter';
import type { Paragraph } from '../db/dexie';
import type { ChapterBoundary } from './EpubParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export interface ParsedBook {
  title: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
  chapters: ChapterBoundary[];
  coverUrl?: string;
  totalPages: number;
}

interface TextLine {
  y: number;
  x: number;
  height: number;
  text: string;
  pageNum: number;
  isBold?: boolean;
}

const JUNK_TEXT_PHRASES = [
  'project gutenberg', 'gutenberg license', 'gutenberg-tm',
  'terms of use', 'electronic works',
  'copyright (c)', 'copyright ©', 'all rights reserved',
  'isbn', 'library of congress', 'cataloging-in-publication',
  'printed in', 'first published', 'first edition',
  'no part of this', 'reproduction prohibited',
  'permission of the publisher', 'prior written permission',
  'trademark', 'registered trademark',
  'visit our website', 'www.', 'http://', 'https://',
  'ebook edition', 'digital edition', 'kindle edition',
];

function isJunkLine(text: string, modalHeight: number, lineHeight: number): boolean {
  const t = text.trim();
  if (!t || t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[IVXLCDM]+\.?$/.test(t)) return true;
  if (lineHeight < modalHeight * 0.55) return true;
  const lower = t.toLowerCase();
  if (JUNK_TEXT_PHRASES.some(p => lower.includes(p))) return true;
  return false;
}

function isJunkParagraph(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  if (/^\d+$/.test(t)) return true;
  const lower = t.toLowerCase();
  if (JUNK_TEXT_PHRASES.some(p => lower.includes(p))) return true;
  
  const upperCount = (t.match(/[A-Z]/g) || []).length;
  const letterCount = (t.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 0 && upperCount / letterCount > 0.55 && words.length < 15) return true;
  return false;
}

function mode(arr: number[]): number {
  if (!arr.length) return 0;
  const freq = new Map<number, number>();
  for (const v of arr) {
    const r = Math.round(v * 10) / 10;
    freq.set(r, (freq.get(r) || 0) + 1);
  }
  let max = 0, modeVal = 0;
  for (const [val, count] of freq) {
    if (count > max) { max = count; modeVal = val; }
  }
  return modeVal;
}

function buildRunningHeaderSet(
  pageLines: TextLine[][],
  pageHeight: number,
  samplePages = 6,
): Set<string> {
  const sample = pageLines.slice(0, Math.min(samplePages, pageLines.length));
  const yBucketMap = new Map<string, number>();

  for (const lines of sample) {
    for (const line of lines) {
      const yBucket = Math.round(line.y / (pageHeight * 0.05));
      const key = `${line.text.trim().toLowerCase()}|${yBucket}`;
      yBucketMap.set(key, (yBucketMap.get(key) || 0) + 1);
    }
  }

  const runningHeaders = new Set<string>();
  for (const [key, count] of yBucketMap) {
    if (count >= 3) {
      runningHeaders.add(key.split('|')[0]);
    }
  }
  return runningHeaders;
}

function buildPageLines(
  items: pdfjsLib.TextItem[],
  pageHeight: number,
  pageNum: number,
): TextLine[] {
  const Y_THRESHOLD = 1;
  const lineMap = new Map<number, { texts: string[]; heights: number[]; xs: number[] }>();

  for (const item of items) {
    if (!item.str?.trim()) continue;
    const rawY = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[5] : 0;
    const y    = Math.round((pageHeight - rawY) / Y_THRESHOLD) * Y_THRESHOLD;
    const x    = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[4] : 0;
    if (!lineMap.has(y)) lineMap.set(y, { texts: [], heights: [], xs: [] });
    const entry = lineMap.get(y)!;
    entry.texts.push(item.str);
    entry.heights.push(item.height || 0);
    entry.xs.push(x);
  }

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => a - b);
  return sortedYs.map(y => {
    const { texts, heights, xs } = lineMap.get(y)!;
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const minX = Math.min(...xs);
    return {
      y,
      x: minX,
      height: avgHeight,
      text: texts.join(' ').trim(),
      pageNum,
    };
  }).filter(l => l.text.length > 0);
}

function assembleText(lines: TextLine[]): string {
  if (!lines.length) return '';
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].y - lines[i - 1].y;
    if (gap > 0) gaps.push(gap);
  }
  const modalGap = mode(gaps) || 14;
  const PARA_BREAK_MULT = 1.45;

  let result = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].y - lines[i - 1].y;
    if (gap > modalGap * PARA_BREAK_MULT) {
      result += '\n\n' + lines[i].text;
    } else {
      const prev = lines[i - 1].text;
      if (prev.endsWith('-')) {
        result = result.slice(0, -1) + lines[i].text;
      } else {
        result += ' ' + lines[i].text;
      }
    }
  }
  return result;
}

export async function parsePdf(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const pdf        = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const meta       = await pdf.getMetadata().catch(() => ({ info: {} }));
  const title      = (meta.info as any)?.Title || fileName.replace(/\.pdf$/i, '');

  const allPageLines: TextLine[][] = [];
  let pageHeight = 792;

  for (let p = 1; p <= totalPages; p++) {
    const page        = await pdf.getPage(p);
    const viewport    = page.getViewport({ scale: 1 });
    pageHeight        = viewport.height;
    const textContent = await page.getTextContent();
    allPageLines.push(
      buildPageLines(textContent.items as pdfjsLib.TextItem[], pageHeight, p)
    );
  }

  const allHeights = allPageLines.flat().map(l => l.height);
  const modalHeight = mode(allHeights) || 12;

  const runningHeaders = buildRunningHeaderSet(allPageLines, pageHeight);

  const allXs    = allPageLines.flat().map(l => l.x).sort((a, b) => a - b);
  const p10      = allXs[Math.floor(allXs.length * 0.10)] ?? 0;
  const p90      = allXs[Math.floor(allXs.length * 0.90)] ?? 9999;
  const X_MARGIN = (p90 - p10) * 0.15;

  const cleanedLines: TextLine[] = [];

  for (let pi = 0; pi < allPageLines.length; pi++) {
    const lines    = allPageLines[pi];
    const pageNum  = pi + 1;

    if (pageNum <= 2) {
      const total = lines.map(l => l.text).join(' ').length;
      if (total < 200) continue;
    }

    for (const line of lines) {
      if (runningHeaders.has(line.text.trim().toLowerCase())) continue;
      if (isJunkLine(line.text, modalHeight, line.height)) continue;
      if (line.x < p10 - X_MARGIN || line.x > p90 + X_MARGIN) continue;

      cleanedLines.push(line);
    }
  }

  const fullText    = assembleText(cleanedLines);
  const rawParas    = splitIntoParagraphs(fullText);
  const paragraphs: Omit<Paragraph, 'id' | 'bookId'>[] = [];
  const chapters:   ChapterBoundary[] = [];
  let   globalIndex = 0;
  let   chapterIdx  = 0;
  let   pendingChapterTitle: string | null = null;

  for (const text of rawParas) {
    if (isJunkParagraph(text)) continue;

    const words = text.split(/\s+/);
    const isTitle = words.length <= 8
      && (/^(chapter|part|section)\s+/i.test(text) || /^[A-Z\s\d.]+$/.test(text));

    if (isTitle) {
      pendingChapterTitle = text;
      chapterIdx++;
      continue;
    }

    if (pendingChapterTitle !== null) {
      chapters.push({
        chapterIndex: chapterIdx,
        chapterTitle: pendingChapterTitle,
        firstParagraphIndex: globalIndex,
      });
      pendingChapterTitle = null;
    }

    paragraphs.push({
      index: globalIndex++,
      chapterIndex: chapterIdx,
      chapterTitle: chapters[chapters.length - 1]?.chapterTitle ?? 'Chapter 1',
      text: text.trim(),
      wordCount: text.trim().split(/\s+/).length,
    });
  }
  // Extract cover
  let coverUrl: string | undefined;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const desiredWidth = 320;
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const context = canvas.getContext('2d');

    if (context) {
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };
      await page.render(renderContext).promise;
      coverUrl = canvas.toDataURL('image/jpeg', 0.85);
    }
  } catch (e) {
    console.warn('[FOLIO] Failed to render PDF cover:', e);
  }

  return { title, paragraphs, chapters, coverUrl, totalPages };
}
