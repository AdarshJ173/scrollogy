const HARD_CAP = 520;

export function splitIntoParagraphs(rawText: string): string[] {
  // 1. Normalize
  let text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // 2. Remove noise lines
  text = text.replace(/^\s*\d+\s*$/gm, '');
  text = text.replace(/^\s*(Page|PAGE)\s+\d+(\s+of\s+\d+)?\s*$/gim, '');
  text = text.replace(/^\s*[IVXLCDM]+\s*$/gm, ''); // standalone Roman numerals

  // 3. Force paragraph break before speaker labels (e.g. YOUTH:, PHILOSOPHER:)
  // Matches: start-of-line, 2+ uppercase letters (with spaces), colon
  text = text.replace(/(^|\n)([A-Z][A-Z\s]{1,}:)/g, '\n\n$2');

  // 4. Force paragraph break before dialogue openers at line start
  text = text.replace(/\n([""\u201C])/g, '\n\n$1');

  // 5. Force paragraph break before standalone lines (scene breaks, chapter titles)
  // Line < 60 chars, ends with sentence terminal or is ALL CAPS
  text = text.replace(/\n(.{1,60}[.!?])\n(?!\n)/g, (match, line) => {
    const trimmed = line.trim();
    if (trimmed.length < 60 && (trimmed.match(/[.!?]$/) || /^[A-Z\s]+$/.test(trimmed))) {
      return `\n\n${trimmed}\n\n`;
    }
    return match;
  });

  // 6. Split on double newlines
  const chunks = text.split(/\n{2,}/);

  // 7. Clean each chunk
  const cleaned = chunks
    .map(chunk => chunk.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(chunk => {
      if (!chunk) return false;
      if (/^\d+$/.test(chunk)) return false;
      if (chunk.length < 15) return false;
      if (chunk.split(/\s+/).length < 4) return false;
      return true;
    });

  // 8. Hard cap: split any paragraph > HARD_CAP chars
  const result: string[] = [];
  for (const para of cleaned) {
    result.push(...enforceHardCap(para));
  }

  return result;
}

function enforceHardCap(text: string): string[] {
  if (text.length <= HARD_CAP) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > HARD_CAP) {
    // Find the last sentence terminal within HARD_CAP chars
    const slice = remaining.slice(0, HARD_CAP);
    
    // Search backwards for `. `, `? `, `! ` (sentence boundaries)
    const sentenceEnd = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('." '),
      slice.lastIndexOf('?" '),
      slice.lastIndexOf('!\u201D'), // curly quote variants
      slice.lastIndexOf('.\u201D'),
    );

    if (sentenceEnd > HARD_CAP - 220) {
      // Good split point found
      const splitAt = sentenceEnd + 2; // include the period + space
      parts.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    } else {
      // No sentence boundary — split at last word boundary before cap
      const wordEnd = slice.lastIndexOf(' ');
      if (wordEnd > 50) {
        parts.push(remaining.slice(0, wordEnd).trim());
        remaining = remaining.slice(wordEnd).trim();
      } else {
        // Force split — pathological case (no spaces)
        parts.push(remaining.slice(0, HARD_CAP).trim());
        remaining = remaining.slice(HARD_CAP).trim();
      }
    }
  }

  if (remaining.length >= 15) parts.push(remaining);
  return parts;
}
