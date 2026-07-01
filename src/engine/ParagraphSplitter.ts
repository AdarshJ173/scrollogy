export function splitIntoParagraphs(rawText: string): string[] {
  // Step 1: Normalize line endings
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Remove page numbers
  text = text.replace(/^\s*\d+\s*$/gm, '');
  text = text.replace(/^\s*Page \d+( of \d+)?\s*$/gim, '');

  // Step 3: Split on double newlines
  const chunks = text.split(/\n{2,}/);

  const paragraphs: string[] = [];
  
  for (const chunk of chunks) {
    const cleaned = chunk.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (!cleaned) continue;
    
    if (/^\d+$/.test(cleaned)) continue;

    paragraphs.push(cleaned);
  }

  return paragraphs;
}
