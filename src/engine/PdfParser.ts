import * as pdfjsLib from 'pdfjs-dist';
import { splitIntoParagraphs } from './ParagraphSplitter';
import type { Paragraph } from '../db/dexie';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export interface ParsedBook {
  title: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
  totalPages: number;
}

export async function parsePdf(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  // Extract metadata
  const meta = await pdf.getMetadata().catch(() => ({ info: {} }));
  const title = (meta.info as any)?.Title || fileName.replace('.pdf', '');

  // Extract all text per page preserving paragraph structure
  const allPageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Reconstruct lines from text items using Y-position grouping
    const items = textContent.items;
    const lines = reconstructLines(items);
    allPageTexts.push(lines.join('\n'));
  }

  const fullText = allPageTexts.join('\n');
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

function reconstructLines(items: any[]): string[] {
  const THRESHOLD = 2;
  const lineMap = new Map<number, string[]>();

  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    // item.transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
    // The Y coordinate is index 5
    const yVal = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform[5] : 0;
    const y = Math.round(yVal / THRESHOLD) * THRESHOLD;
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y)!.push(item.str);
  }

  // Sort lines top-to-bottom (Y decreases going down in PDF space)
  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
  return sortedYs.map(y => lineMap.get(y)!.join(' ').trim()).filter(Boolean);
}
