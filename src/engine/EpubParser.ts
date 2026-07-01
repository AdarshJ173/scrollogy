import ePub from 'epubjs';
import { splitIntoParagraphs } from './ParagraphSplitter';
import type { Paragraph } from '../db/dexie';

export interface ChapterBoundary {
  chapterIndex: number;
  chapterTitle: string;
  firstParagraphIndex: number;
}

export interface ParsedBook {
  title: string;
  author: string;
  coverUrl?: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
  chapters: ChapterBoundary[];
}

const JUNK_SPINE_HREF_PATTERNS = [
  'cover', 'titlepage', 'title-page', 'title_page',
  'copyright', 'copyrights', 'rights',
  'toc', 'table-of-contents', 'contents',
  'dedication', 'epigraph', 'colophon',
  'about', 'halftitle', 'half-title', 'frontmatter',
  'backmatter', 'acknowledgment', 'acknowledgement',
  'license', 'licence', 'legalnotice', 'legal-notice',
  'nav', 'ncx',
];

const JUNK_TEXT_PHRASES = [
  'project gutenberg', 'gutenberg license', 'gutenberg-tm',
  'terms of use', 'electronic works', 'electronic work',
  'copyright (c)', 'copyright ©', 'all rights reserved',
  'isbn', 'library of congress', 'cataloging-in-publication',
  'printed in', 'first published', 'first edition',
  'no part of this', 'reproduction prohibited',
  'permission of the publisher', 'prior written permission',
  'trademark', 'registered trademark',
  'visit our website', 'www.', 'http://', 'https://',
  'ebook edition', 'digital edition', 'kindle edition',
  'mobi edition', 'epub edition',
  'for more information', 'for permissions',
  'distribution of this', 'public domain',
  'this book may not be', 'may not be reproduced',
];

function isJunkSpineHref(href: string): boolean {
  const lower = href.toLowerCase().replace(/[\\/._-]/g, '');
  return JUNK_SPINE_HREF_PATTERNS.some(pat => lower.includes(pat.replace(/-/g, '')));
}

function isJunkParagraph(text: string): boolean {
  const lower = text.toLowerCase();
  
  if (JUNK_TEXT_PHRASES.some(phrase => lower.includes(phrase))) return true;
  if (text.length < 20) return true;
  
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  if (/^\d+$/.test(text.trim())) return true;
  if (/^[IVXLCDM]+\.?$/i.test(text.trim())) return true;
  
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 0 && upperCount / letterCount > 0.55 && words.length < 15) return true;
  
  if (/^(chapter|part|section|book)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\.?$/i.test(text.trim())) return true;
  if (/^[\d\-X]{10,17}$/.test(text.replace(/\s/g, ''))) return true;
  
  return false;
}

function isJunkSpineByContent(bodyText: string): boolean {
  const stripped = bodyText.replace(/\s+/g, ' ').trim();
  if (stripped.length < 150) return true;
  
  const lower = stripped.toLowerCase();
  const junkHits = JUNK_TEXT_PHRASES.filter(p => lower.includes(p)).length;
  if (junkHits >= 2 && stripped.length < 500) return true;
  
  return false;
}

const BLOCK_TAGS = new Set([
  'P', 'LI', 'BLOCKQUOTE', 'TD', 'TH',
  'FIGCAPTION', 'DT', 'DD', 'SECTION',
]);

function extractTextBlocks(doc: Document): string[] {
  const blocks: string[] = [];
  const body = doc.body;
  if (!body) return blocks;

  function walk(node: Element) {
    const tag = node.tagName?.toUpperCase();

    if (BLOCK_TAGS.has(tag)) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!isJunkParagraph(text)) {
        const capped = splitIntoParagraphs(text);
        for (const p of capped) {
          if (!isJunkParagraph(p)) blocks.push(p);
        }
      }
      return;
    }

    if (tag === 'DIV') {
      let directText = '';
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          directText += child.textContent ?? '';
        }
      }
      directText = directText.replace(/\s+/g, ' ').trim();
      if (directText.length >= 20 && !isJunkParagraph(directText)) {
        const capped = splitIntoParagraphs(directText);
        for (const p of capped) {
          if (!isJunkParagraph(p)) blocks.push(p);
        }
      }
      for (const child of node.children) walk(child);
      return;
    }

    for (const child of node.children) walk(child);
  }

  walk(body);
  return blocks;
}

function loadDocument(raw: string | Document): Document {
  if (typeof raw === 'string') {
    return new DOMParser().parseFromString(raw, 'text/html');
  }
  return raw as Document;
}

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const res  = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}

export async function parseEpub(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const book  = ePub(arrayBuffer);
  await book.ready;

  const meta   = book.packaging.metadata;
  const title  = meta.title  || fileName.replace(/\.epub$/i, '');
  const author = meta.creator || 'Unknown Author';

  let coverUrl: string | undefined;
  try {
    const raw = await book.coverUrl();
    if (raw) coverUrl = await blobUrlToBase64(raw);
  } catch {}

  const spine    = book.spine as any;
  const paragraphs: Omit<Paragraph, 'id' | 'bookId'>[] = [];
  const chapters: ChapterBoundary[] = [];
  let globalIndex = 0;

  for (let ci = 0; ci < spine.items.length; ci++) {
    const spineItem = spine.items[ci];

    if (isJunkSpineHref(spineItem.href ?? '')) continue;

    let raw: string | Document;
    try {
      raw = await book.load(spineItem.href) as string | Document;
    } catch (e) {
      console.warn(`[FOLIO] Cannot load spine item ${ci}:`, e);
      continue;
    }

    const doc = loadDocument(raw);
    const bodyText = doc.body?.textContent ?? '';

    if (isJunkSpineByContent(bodyText)) continue;

    const chapterTitle =
      doc.querySelector('h1, h2, h3')?.textContent?.trim() ||
      `Chapter ${chapters.length + 1}`;

    const blocks = extractTextBlocks(doc);
    if (blocks.length === 0) continue;

    chapters.push({
      chapterIndex: ci,
      chapterTitle,
      firstParagraphIndex: globalIndex,
    });

    for (const text of blocks) {
      paragraphs.push({
        index: globalIndex++,
        chapterIndex: ci,
        chapterTitle,
        text,
        wordCount: text.split(/\s+/).length,
      });
    }
  }

  if (paragraphs.length === 0) {
    let fi = 0;
    for (let ci = 0; ci < spine.items.length; ci++) {
      if (isJunkSpineHref(spine.items[ci].href ?? '')) continue;
      try {
        const raw = await book.load(spine.items[ci].href) as string | Document;
        const doc = loadDocument(raw);
        const raw_text = doc.body?.textContent ?? '';
        if (isJunkSpineByContent(raw_text)) continue;
        const splits = splitIntoParagraphs(raw_text);
        for (const text of splits) {
          if (!isJunkParagraph(text)) {
            paragraphs.push({
              index: fi++,
              chapterIndex: ci,
              chapterTitle: `Chapter ${ci + 1}`,
              text,
              wordCount: text.split(/\s+/).length,
            });
          }
        }
      } catch {}
    }
  }

  return { title, author, coverUrl, paragraphs, chapters };
}
