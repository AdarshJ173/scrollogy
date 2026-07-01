import * as pdfjsLib from 'pdfjs-dist';
import { splitIntoParagraphs } from './ParagraphSplitter';
import type { Paragraph } from '../db/dexie';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export interface ParsedBook {
  title: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
  totalPages: number;
}

interface LineGroup {
  y: number;
  height: number;
  text: string;
}

export async function parsePdf(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const meta = await pdf.getMetadata().catch(() => ({ info: {} }));
  const title = (meta.info as any)?.Title || fileName.replace(/\.pdf$/i, '');

  const allLines: LineGroup[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageLines = buildPageLines(textContent.items as pdfjsLib.TextItem[], viewport.height);
    allLines.push(...pageLines);
  }

  // Build full text with intelligent paragraph break insertion
  const fullText = assembleText(allLines);
  const rawParagraphs = splitIntoParagraphs(fullText);

  const paragraphs = rawParagraphs.map((text, index) => ({
    index,
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
    text: text.trim(),
    wordCount: text.trim().split(/\s+/).length,
  }));

  return { title, paragraphs, totalPages };
}

function buildPageLines(items: pdfjsLib.TextItem[], pageHeight: number): LineGroup[] {
  if (!items.length) return [];

  // Group items by Y coordinate (threshold = 1px)
  const Y_THRESHOLD = 1;
  const lineMap = new Map<number, { texts: string[]; heights: number[] }>();

  for (const item of items) {
    if (!item.str?.trim()) continue;
    const rawY = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[5] : 0;
    // Flip Y: PDF Y grows upward, we want top-to-bottom
    const y = Math.round((pageHeight - rawY) / Y_THRESHOLD) * Y_THRESHOLD;
    if (!lineMap.has(y)) lineMap.set(y, { texts: [], heights: [] });
    lineMap.get(y)!.texts.push(item.str);
    lineMap.get(y)!.heights.push(item.height || 0);
  }

  // Sort top-to-bottom
  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => a - b);

  // Detect modal line height (most common height = body text size)
  const allHeights = sortedYs.flatMap(y => lineMap.get(y)!.heights);
  const modalHeight = mode(allHeights) || 12;

  // Filter out very small text (footnotes, captions) — height < 0.6 × modal
  const MIN_HEIGHT = modalHeight * 0.6;

  return sortedYs
    .map(y => {
      const { texts, heights } = lineMap.get(y)!;
      const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
      return {
        y,
        height: avgHeight,
        text: texts.join(' ').trim(),
      };
    })
    .filter(line => line.text.length > 0 && line.height >= MIN_HEIGHT);
}

function assembleText(lines: LineGroup[]): string {
  if (!lines.length) return '';

  // Calculate modal line spacing
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(lines[i].y - lines[i - 1].y);
  }
  const modalGap = mode(gaps) || 14;
  const PARA_BREAK_MULTIPLIER = 1.45; // gap > 1.45× modal = paragraph break

  let result = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].y - lines[i - 1].y;
    if (gap > modalGap * PARA_BREAK_MULTIPLIER) {
      // Paragraph break
      result += '\n\n' + lines[i].text;
    } else {
      // Soft wrap — join with space unless previous line ends mid-word (hyphen)
      const prev = lines[i - 1].text;
      if (prev.endsWith('-')) {
        result = result.slice(0, -1) + lines[i].text; // dehyphenate
      } else {
        result += ' ' + lines[i].text;
      }
    }
  }

  return result;
}

function mode(arr: number[]): number {
  if (!arr.length) return 0;
  const freq = new Map<number, number>();
  for (const v of arr) {
    const rounded = Math.round(v);
    freq.set(rounded, (freq.get(rounded) || 0) + 1);
  }
  let maxCount = 0;
  let modeVal = 0;
  for (const [val, count] of freq) {
    if (count > maxCount) { maxCount = count; modeVal = val; }
  }
  return modeVal;
}
