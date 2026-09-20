const THAI_RE = /[\u0E00-\u0E7F]/g;
const LATIN_RE = /[A-Za-z]+/g;
const LEAK_WORDS = /\b(wuxia|xianxia|fantasy|romance|nc\s*mode|uncensored|genre|extradite)\b/i;

export function countThaiChars(text: string): number {
  return (text.match(THAI_RE) || []).join('').length;
}

export function countLatinChars(text: string): number {
  return (text.match(LATIN_RE) || []).join('').length;
}

export function assertPolishableThai(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('ยังไม่มีข้อความให้เกลา');

  const thai = countThaiChars(trimmed);
  const latin = countLatinChars(trimmed);

  if (thai < 4) {
    throw new Error('ตรวจภาษาแล้ว: ข้อความยังไม่ใช่ภาษาไทยชัดเจน กรุณาใส่เนื้อหานิยายภาษาไทยก่อนเกลา');
  }
  if (latin > 20 && thai < latin) {
    throw new Error('ตรวจภาษาแล้ว: ข้อความเป็นภาษาอังกฤษ/ปนต่างชาติมากเกินไป NiyayFlow เกลาเฉพาะนิยายภาษาไทย');
  }
  if (/^\s*[\*\-•]?\s*(wuxia|fantasy|romance|xianxia)\s*$/i.test(trimmed)) {
    throw new Error('ตรวจภาษาแล้ว: นี่คือชื่อแนวเรื่องภาษาอังกฤษ ไม่ใช่เนื้อหานิยาย — ใส่ประโยคภาษาไทยแทน');
  }
}

export function assertThaiPolishOutput(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('โมเดลไม่คืนข้อความ');

  if (LEAK_WORDS.test(trimmed) && countThaiChars(trimmed) < 8) {
    throw new Error('ผลลัพธ์ไม่ถูกต้อง: ได้คำแนวเรื่องภาษาอังกฤษแทนเนื้อหาไทย ระบบจะลองใหม่');
  }
  const thai = countThaiChars(trimmed);
  const latin = countLatinChars(trimmed);
  if (thai < 4 || (latin > thai * 2 && latin > 12)) {
    throw new Error('ผลลัพธ์ไม่ใช่ภาษาไทยชัดเจน ระบบจะลองใหม่');
  }
}

export function stripGenreLeakLines(text: string): string {
  return text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !/^[\*\-•]?\s*(wuxia|fantasy|romance|xianxia)\s*$/i.test(l))
    .join('\n\n');
}

/** Remove English words that were not in the original draft (common hallucination). */
export function scrubUnexpectedEnglish(output: string, original: string): string {
  const allowed = new Set((original.match(/[A-Za-z]+/g) || []).map(w => w.toLowerCase()));
  return output
    .replace(/[A-Za-z]+/g, w => (allowed.has(w.toLowerCase()) ? w : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ?([,.!?;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Light deterministic fixes for frequent Thai typos in drafts. */
export function applyCommonThaiFixes(text: string): string {
  const pairs: [RegExp, string][] = [
    [/\bม่าย\b/g, 'ไม่'],
    [/ม่าย/g, 'ไม่'],
    [/แบบี้/g, 'แบบนี้'],
    [/แบบิ/g, 'แบบนี้'],
    [/กระเซาะกระแซะ/g, 'กระแทก'],
    [/กระเซาะกระแชะ/g, 'กระแทก'],
    [/อ้าไม่ให้สิ/g, 'อ้าไม่ให้สิ'],
  ];
  let out = text;
  for (const [re, to] of pairs) out = out.replace(re, to);
  return out;
}

export function cleanPolishText(output: string, original: string): string {
  return applyCommonThaiFixes(scrubUnexpectedEnglish(stripGenreLeakLines(output), original));
}
