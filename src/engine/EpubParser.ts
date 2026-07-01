import ePub from 'epubjs';
import type { Paragraph } from '../db/dexie';

export interface ParsedBook {
  title: string;
  author: string;
  coverUrl?: string;
  paragraphs: Omit<Paragraph, 'id' | 'bookId'>[];
}

export async function parseEpub(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedBook> {
  const book = ePub(arrayBuffer);
  await book.ready;

  const meta = book.packaging.metadata;
  const title = meta.title || fileName.replace('.epub', '');
  const author = meta.creator || 'Unknown Author';

  // Extract cover
  let coverUrl: string | undefined;
  try {
    coverUrl = await book.coverUrl() ?? undefined;
  } catch {}

  // Extract all chapters
  const spine = book.spine as any;
  const paragraphs: Omit<Paragraph, 'id' | 'bookId'>[] = [];
  let globalIndex = 0;

  for (let ci = 0; ci < spine.items.length; ci++) {
    const spineItem = spine.items[ci];
    
    try {
      const htmlOrDoc = await book.load(spineItem.href);
      let doc: Document;
      if (typeof htmlOrDoc === 'string') {
        const parser = new DOMParser();
        doc = parser.parseFromString(htmlOrDoc, 'text/html');
      } else {
        doc = htmlOrDoc as Document;
      }
      
      // Extract text from <p>, <li>, <blockquote > elements
      const elements = doc.querySelectorAll('p, li, blockquote');
      const chapterTitle = doc.querySelector('h1, h2, h3')?.textContent?.trim() 
        || `Chapter ${ci + 1}`;

      for (const el of elements) {
        const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (text.length < 30) continue; // skip tiny fragments
        if (text.split(' ').length < 6) continue;

        paragraphs.push({
          index: globalIndex++,
          chapterIndex: ci,
          chapterTitle,
          text,
          wordCount: text.split(/\s+/).length,
        });
      }
    } catch (e) {
      console.warn(`Failed to parse spine item ${ci}`, e);
      continue;
    }
  }

  // Fallback: If no paragraph elements were found (e.g. structured differently), grab body text and split
  if (paragraphs.length === 0) {
    let fallbackIndex = 0;
    for (let ci = 0; ci < spine.items.length; ci++) {
      const spineItem = spine.items[ci];
      try {
        const htmlOrDoc = await book.load(spineItem.href);
        let doc: Document;
        if (typeof htmlOrDoc === 'string') {
          const parser = new DOMParser();
          doc = parser.parseFromString(htmlOrDoc, 'text/html');
        } else {
          doc = htmlOrDoc as Document;
        }
        const textContent = doc.body?.textContent || '';
        const lines = textContent.split('\n');
        for (const line of lines) {
          const cleaned = line.replace(/\s+/g, ' ').trim();
          if (cleaned.length > 40) {
            paragraphs.push({
              index: fallbackIndex++,
              chapterIndex: ci,
              chapterTitle: `Chapter ${ci + 1}`,
              text: cleaned,
              wordCount: cleaned.split(/\s+/).length,
            });
          }
        }
      } catch {}
    }
  }

  return { title, author, coverUrl, paragraphs };
}
