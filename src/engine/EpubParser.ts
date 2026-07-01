import ePub from 'epubjs';
import { splitIntoParagraphs } from './ParagraphSplitter';
import type { Paragraph } from '../db/dexie';

export interface ParsedBook {
  title: string;
  author: string;
  coverUrl?: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
}

const MIN_CHARS = 20;
const MIN_WORDS = 4;

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function extractTextBlocks(doc: Document): string[] {
  const blocks: string[] = [];
  const body = doc.body;
  if (!body) return blocks;

  // Walk all elements. For each, only take text if it is a "leaf-level" block
  // (i.e. does not contain other block-level children that we'd separately capture)
  const BLOCK_TAGS = new Set(['P', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'DT', 'DD']);
  const DIV_TAG = 'DIV';

  function walk(node: Element) {
    const tag = node.tagName?.toUpperCase();

    if (BLOCK_TAGS.has(tag)) {
      // Take this node's full text — don't recurse into children separately
      const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (text.length >= MIN_CHARS && text.split(/\s+/).length >= MIN_WORDS) {
        // Run hard cap on individual elements too
        const capped = splitIntoParagraphs(text); // reuse splitter on element text
        blocks.push(...capped);
      }
      return; // do NOT recurse
    }

    if (tag === DIV_TAG) {
      // Check if this div has direct text content (not just inside child elements)
      let directText = '';
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          directText += child.textContent || '';
        }
      }
      directText = directText.replace(/\s+/g, ' ').trim();
      if (directText.length >= MIN_CHARS && directText.split(/\s+/).length >= MIN_WORDS) {
        blocks.push(...splitIntoParagraphs(directText));
      }
      // Recurse into div children
      for (const child of node.children) {
        walk(child);
      }
      return;
    }

    // For all other elements (section, article, aside, etc.) — recurse
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(body);
  return blocks;
}

function loadDocument(htmlOrDoc: string | Document): Document {
  if (typeof htmlOrDoc === 'string') {
    return new DOMParser().parseFromString(htmlOrDoc, 'text/html');
  }
  return htmlOrDoc as Document;
}

export async function parseEpub(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const book = ePub(arrayBuffer);
  await book.ready;

  const meta = book.packaging.metadata;
  const title = meta.title || fileName.replace(/\.epub$/i, '');
  const author = meta.creator || 'Unknown Author';

  let coverUrl: string | undefined;
  try {
    const rawCover = await book.coverUrl();
    if (rawCover) coverUrl = await blobUrlToBase64(rawCover);
  } catch {}

  const spine = book.spine as any;
  const paragraphs: Omit<Paragraph, 'id' | 'bookId'>[] = [];
  let globalIndex = 0;

  for (let ci = 0; ci < spine.items.length; ci++) {
    const spineItem = spine.items[ci];
    try {
      const raw = await book.load(spineItem.href);
      const doc = loadDocument(raw as string | Document);
      const chapterTitle =
        doc.querySelector('h1, h2, h3')?.textContent?.trim() ||
        `Chapter ${ci + 1}`;

      const blocks = extractTextBlocks(doc);

      for (const text of blocks) {
        paragraphs.push({
          index: globalIndex++,
          chapterIndex: ci,
          chapterTitle,
          text,
          wordCount: text.split(/\s+/).length,
        });
      }
    } catch (e) {
      console.warn(`[FOLIO] Failed to parse spine item ${ci}:`, e);
    }
  }

  // Fallback: raw text extraction if DOM walk yielded nothing
  if (paragraphs.length === 0) {
    let fi = 0;
    for (let ci = 0; ci < spine.items.length; ci++) {
      try {
        const raw = await book.load(spine.items[ci].href);
        const doc = loadDocument(raw as string | Document);
        const rawText = doc.body?.textContent || '';
        const splits = splitIntoParagraphs(rawText);
        for (const text of splits) {
          paragraphs.push({
            index: fi++,
            chapterIndex: ci,
            chapterTitle: `Chapter ${ci + 1}`,
            text,
            wordCount: text.split(/\s+/).length,
          });
        }
      } catch {}
    }
  }

  return { title, author, coverUrl, paragraphs };
}
