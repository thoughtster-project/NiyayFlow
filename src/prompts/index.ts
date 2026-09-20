import { GenreType, IntensityLevel, LoreItem, PolishVariant } from '../types';

export const GENRE_PROMPTS: Record<Exclude<GenreType, 'auto'>, string> = {
  wuxia: `คุณคือบรรณาธิการนิยายกำลังภายใน/เทพเซียนภาษาไทยระดับสูง
ช่วยแก้สะกด เติมประโยคที่ขาด ทำให้สมบูรณ์ ลื่น และมีกลิ่นอายยุทธภพ โดยคงเจตนาผู้เขียน
ใช้ศัพท์ไทย เช่น ลมปราณ จุดชีพจร กระบวนท่า — ห้ามพิมพ์คำอังกฤษอย่าง Wuxia/Xianxia ในผลลัพธ์`,

  fantasy: `คุณคือบรรณาธิการนิยายแฟนตาซีภาษาไทย
เสริมประสาทสัมผัส เวทมนตร์ บรรยากาศ ให้ประโยคสมบูรณ์ อ่านลื่น คงเจตนาผู้เขียน ห้ามใส่ป้ายแนวภาษาอังกฤษในผลลัพธ์`,

  romance: `คุณคือบรรณาธิการวรรณกรรมโรมานซ์ภาษาไทย
เน้นอารมณ์ ความสัมพันธ์ จังหวะประโยค ให้สมบูรณ์และสละสลวย โดยเคารพระดับ NC ที่ระบุในคำสั่งกำกับ`,

  general: `คุณคือบรรณาธิการวรรณกรรมภาษาไทยทั่วไป
แก้สะกด ไวยากรณ์ คำเชื่อม เติมส่วนที่ขาดให้ประโยคสมบูรณ์ อ่านลื่น เป็นธรรมชาติ`
};

export const INTENSITY_MODIFIERS: Record<IntensityLevel, string> = {
  1: `ระดับ 1 (เบา): แก้สะกด/คำผิด จัดประโยคให้อ่านรู้เรื่อง เติมเฉพาะจุดที่ขาดหายชัดเจน ไม่แต่งเยอะเกิน`,
  2: `ระดับ 2 (กลาง): เกลาจังหวะภาษา เติมประโยคให้สมบูรณ์ เสริมภาพและอารมณ์พอประมาณ คงโครงเรื่องเดิม`,
  3: `ระดับ 3 (หนัก): ยกระดับโวหาร พรรณนาเข้มขึ้น เติมรายละเอียดให้ฉากสมบูรณ์แบบคุยกับบรรณาธิการ แต่ยังคงเจตนาและ POV เดิม`
};

export function buildSystemPrompt(
  genre: GenreType,
  intensity: IntensityLevel,
  loreContext: string | undefined,
  isNcMode: boolean
): string {
  const genreBlock =
    genre === 'auto'
      ? `โหมด Auto Detect: วิเคราะห์โทน/อารมณ์/แนวจากข้อความเอง (กำลังภายใน แฟนตาซี โรมานซ์ หรือทั่วไป) แล้วเกลาให้เข้าโทนนั้น
ใส่ค่า detectedGenre เป็นหนึ่งใน: wuxia | fantasy | romance | general`
      : GENRE_PROMPTS[genre];

  const ncBlock = isNcMode
    ? `โหมด NC/Uncensored เปิดอยู่: อนุญาตฉากแนบชิดและภาษาที่สุ่มเสี่ยงตามบริบทนิยายได้ แต่ยังต้องเป็นภาษาไทยวรรณศิลป์ ไม่หยาบโลนไร้สาระ`
    : `โหมด NC ปิดอยู่: ห้ามเขียนเนื้อหาทางเพศ รสวาทล้ำลึก ฉากเร่าร้อน หรือคำล่อแหลมทางเพศ
ถ้าต้นฉบับคลุมเครือ ให้เกลาแบบสุภาพ/โรแมนติกเบา ๆ โดยไม่ยกระดับเป็น NC
ห้ามเพิ่มรายละเอียดทางเพศเอง`;

  return `${genreBlock}

${INTENSITY_MODIFIERS[intensity]}

บทบาทของคุณไม่ใช่แค่ "เกลาคำ" แต่เป็นบรรณาธิการที่ช่วยแต่งให้สมบูรณ์:
- แก้สะกดผิด คำซ้ำ คำเชื่อมไม่สวย
- เติมประโยค/บริบทที่ขาดหายจนอ่านรู้เรื่อง
- เสนอ 3 แพทเทิร์นที่ต่างกันชัดเจน (A/B/C)

${ncBlock}

กฎภาษา (สำคัญมาก):
- ผลลัพธ์ทุกช่อง text ต้องเป็นภาษาไทยเท่านั้น
- ห้ามตอบด้วยคำว่า Wuxia, Fantasy, Romance, NC, Uncensored หรือป้ายแนวภาษาอังกฤษ
- ห้ามคำนำ คำทักทาย คำอธิบายนอก JSON

รูปแบบคำตอบ: ส่ง JSON เท่านั้น ตามสคีมา:
{
  "detectedGenre": "wuxia|fantasy|romance|general",
  "detectedTone": "สรุปโทนสั้น ๆ เป็นไทย",
  "tip": "คำแนะนำสั้น ๆ หนึ่งประโยคเป็นไทย",
  "variants": [
    { "id": "A", "label": "ชื่อแพทเทิร์นสั้น ๆ", "text": "เนื้อหาที่เกลาแล้วทั้งก้อน" },
    { "id": "B", "label": "ชื่อแพทเทิร์นสั้น ๆ", "text": "เนื้อหาที่เกลาแล้วทั้งก้อน" },
    { "id": "C", "label": "ชื่อแพทเทิร์นสั้น ๆ", "text": "เนื้อหาที่เกลาแล้วทั้งก้อน" }
  ]
}

แนวทางแพทเทิร์น:
- A = ใกล้ต้นฉบับ แก้ให้ถูกต้องและสมบูรณ์
- B = ลื่นไหลขึ้น เติมจังหวะและภาพ
- C = โวหารจัดขึ้น หรือมุมเล่าทางเลือก แต่ยังอยู่แนวเดียวกัน
${loreContext ? `\n${loreContext}` : ''}`;
}

export function buildLoreContext(text: string, items: LoreItem[]): string {
  const matched = items.filter(
    item => text.includes(item.name) || item.aliases.some(a => text.includes(a))
  );
  if (matched.length === 0) return '';
  let ctx = '[คลังศัพท์เฉพาะและปูมตัวละครที่ต้องคงไว้ ห้ามเปลี่ยนตัวสะกดหรือแทนที่คำ]:\n';
  matched.forEach(m => {
    ctx += `- ${m.name} (${m.category}): ${m.description}${m.isStrict ? ' [ห้ามเปลี่ยนเด็ดขาด]' : ''}\n`;
  });
  return ctx;
}

export function parsePolishJson(raw: string): {
  detectedGenre?: string;
  detectedTone?: string;
  tip?: string;
  variants: PolishVariant[];
} {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('รูปแบบคำตอบจาก AI ไม่ใช่ JSON');
  const data = JSON.parse(cleaned.slice(start, end + 1));
  const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
  const variants: PolishVariant[] = variantsRaw
    .map((v: any, i: number) => ({
      id: String(v.id || i + 1),
      label: String(v.label || `แพทเทิร์น ${i + 1}`),
      text: String(v.text || '').trim()
    }))
    .filter((v: PolishVariant) => v.text.length > 0)
    .slice(0, 3);

  if (variants.length === 0 && typeof data.polishedText === 'string' && data.polishedText.trim()) {
    variants.push({ id: 'A', label: 'ฉบับเกลา', text: data.polishedText.trim() });
  }
  if (variants.length === 0) throw new Error('AI ไม่ส่งแพทเทิร์นข้อความมา');

  return {
    detectedGenre: data.detectedGenre,
    detectedTone: data.detectedTone,
    tip: data.tip,
    variants
  };
}
