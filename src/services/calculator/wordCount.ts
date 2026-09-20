export type WordEngine = 'thai_segmenter' | 'whitespace_word';

export interface WordCountResult {
  engine: WordEngine;
  words: number;
  thaiWords: number;
  otherTokens: number;
  charsWithSpace: number;
  charsNoSpace: number;
  paragraphs: number;
  calibratedWords: number;
  calibrationFactor: number;
}

function graphemeLength(text: string): number {
  try {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(text)].length;
  } catch {
    return [...text].length;
  }
}

/** Thai word segmentation via Intl.Segmenter — closer to modern web counters / RAW editor tools. */
export function countThaiSegmenter(text: string): { words: number; thaiWords: number; otherTokens: number } {
  const cleaned = text.replace(/\u00a0/g, ' ').trim();
  if (!cleaned) return { words: 0, thaiWords: 0, otherTokens: 0 };
  try {
    const seg = new (Intl as any).Segmenter('th', { granularity: 'word' });
    let thaiWords = 0;
    let otherTokens = 0;
    for (const { segment, isWordLike } of seg.segment(cleaned)) {
      if (!isWordLike) continue;
      if (/[\u0E00-\u0E7F]/.test(segment)) thaiWords += 1;
      else otherTokens += 1;
    }
    return { words: thaiWords + otherTokens, thaiWords, otherTokens };
  } catch {
    return countWhitespaceWord(cleaned);
  }
}

/**
 * Whitespace / MS Word-like count: split on whitespace.
 * Pure Thai with no spaces undercounts (same issue writers see in Word) —
 * recommended for Meb pricing discussions that cite Word numbers.
 */
export function countWhitespaceWord(text: string): { words: number; thaiWords: number; otherTokens: number } {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  let thaiWords = 0;
  let otherTokens = 0;
  for (const p of parts) {
    if (/[\u0E00-\u0E7F]/.test(p)) thaiWords += 1;
    else otherTokens += 1;
  }
  return { words: parts.length, thaiWords, otherTokens };
}

export function countText(text: string, engine: WordEngine, calibrationFactor = 1): WordCountResult {
  const base = engine === 'thai_segmenter' ? countThaiSegmenter(text) : countWhitespaceWord(text);
  const charsNoSpace = text.replace(/\s+/g, '').length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const factor = Number.isFinite(calibrationFactor) && calibrationFactor > 0 ? calibrationFactor : 1;
  const calibratedWords = Math.round(base.words * factor);
  return {
    engine,
    words: base.words,
    thaiWords: base.thaiWords,
    otherTokens: base.otherTokens,
    charsWithSpace: graphemeLength(text),
    charsNoSpace,
    paragraphs,
    calibratedWords,
    calibrationFactor: factor
  };
}

export function suggestCoinsForChapter(words: number, isSpecial = false): { min: number; max: number; label: string } {
  if (isSpecial) return { min: 5, max: 10, label: 'ตอนพิเศษ / NC' };
  if (words < 1000) return { min: 1, max: 2, label: 'สั้นกว่ามาตรฐาน' };
  if (words <= 1500) return { min: 1, max: 2, label: '1,000–1,500 คำ' };
  if (words <= 3000) return { min: 3, max: 4, label: '1,500–3,000 คำ' };
  if (words <= 5000) return { min: 5, max: 8, label: '3,000–5,000 คำ' };
  return { min: 8, max: 12, label: 'ยาวมาก' };
}

export const CALIBRATION_KEY = 'niyayflow_word_calibration_v1';

export function loadCalibration(engine: WordEngine): number {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) return 1;
    const data = JSON.parse(raw) as Record<string, number>;
    return data[engine] || 1;
  } catch {
    return 1;
  }
}

export function saveCalibration(engine: WordEngine, factor: number): void {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[engine] = factor;
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
