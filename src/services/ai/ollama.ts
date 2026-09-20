import { AiAdapter, ExtraVariantRequest, PolishRequest, PolishResponse } from './adapter';
import { buildSystemPrompt, parsePolishJson } from '../../prompts';
import {
  assertPolishableThai,
  assertThaiPolishOutput,
  cleanPolishText,
  stripGenreLeakLines
} from '../languageCheck';
import { PolishVariant } from '../../types';

const DEFAULT_NC_MODEL = 'qwen2.5:7b';

type GenOpts = {
  temperature: number;
  top_p?: number;
  num_predict?: number;
};

const EXTRA_STYLES = [
  { label: 'กระชับคม', focus: 'สั้น คม ตัดคำฟุ่มเฟือย แต่ความหมายครบและสะกดถูก' },
  { label: 'ละเอียดอารมณ์', focus: 'เติมความรู้สึกและการรับรู้ของตัวละครให้หนาขึ้น โดยสะกดถูกทั้งหมด' },
  { label: 'บทสนทนาธรรมชาติ', focus: 'เน้นบทพูดให้เหมือนคนพูดจริง สำนวนธรรมชาติ สะกดถูก' },
  { label: 'จังหวะฉากหนัง', focus: 'ตัดเป็นจังหวะฉากภาพชัด เหมือนตัดต่อฉาก โดยสะกดถูก' },
  { label: 'โทนดิบ NC', focus: 'โทนดิบและตรง เหมาะ NC แต่ภาษาถูกต้อง ไม่มีคำอังกฤษปน' }
];

export class OllamaAdapter implements AiAdapter {
  name = 'Ollama Local';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = DEFAULT_NC_MODEL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model || DEFAULT_NC_MODEL;
  }

  async polish(request: PolishRequest): Promise<PolishResponse> {
    assertPolishableThai(request.text);
    await this.ensureReachable();

    const corrected = await this.generateCorrectedDraft(request);
    const variants = await this.generateDistinctVariants(request, corrected, 3);

    return {
      polishedText: variants[0].text,
      variants,
      baseText: corrected,
      tip: 'แก้สะกด/คำผิดก่อน แล้วแยกแพทเทิร์นให้ต่างกัน — กดสร้างเพิ่มได้ด้านล่าง',
      detectedGenre: request.genre === 'auto' ? 'romance' : request.genre,
      detectedTone: request.isNcMode ? 'NC' : 'ตามต้นฉบับ',
      modelUsed: `ollama:${this.model}`
    };
  }

  async generateExtraVariant(req: ExtraVariantRequest): Promise<PolishVariant> {
    await this.ensureReachable();
    const style = EXTRA_STYLES[(req.nextIndex - 1) % EXTRA_STYLES.length];
    const id = String(req.nextIndex);
    const system = this.buildEditorSystem({
      text: req.originalText,
      genre: req.genre,
      intensity: req.intensity,
      loreContext: req.loreContext,
      isNcMode: req.isNcMode
    });

    const existingBlock = req.existingTexts.map((t, i) => `--- ฉบับ ${i + 1} ---\n${t}`).join('\n\n');
    const prompt = `สร้างแพทเทิร์นใหม่หมายเลข ${id} สไตล์: ${style.label}
โฟกัส: ${style.focus}
ต้องต่างจากฉบับที่มีอยู่แล้วอย่างชัดเจน
ห้ามมีคำภาษาอังกฤษปน ห้ามสะกดผิด
ส่ง JSON เท่านั้น: {"id":"${id}","label":"${style.label}","text":"..."}

ฉบับฐานที่แก้คำผิดแล้ว:
${req.baseText}

ต้นฉบับดิบ:
${req.originalText}

ฉบับที่มีอยู่แล้ว (ห้ามซ้ำ):
${existingBlock}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.generateRaw(system, prompt, {
        temperature: 0.75 + attempt * 0.1,
        top_p: 0.92,
        num_predict: 2048
      });
      let text =
        this.extractVariantText(raw, id) ||
        this.extractTextField(raw) ||
        stripGenreLeakLines(raw);
      text = cleanPolishText(text, req.originalText);
      assertThaiPolishOutput(text);
      const dup = req.existingTexts.some(t => this.normalize(t) === this.normalize(text));
      if (!dup) return { id, label: style.label, text };
    }
    throw new Error('สร้างแพทเทิร์นเพิ่มไม่สำเร็จ ลองอีกครั้ง');
  }

  private async ensureReachable(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error('bad status');
    } catch {
      throw new Error(
        `ไม่สามารถเชื่อมต่อ Ollama ได้ที่ ${this.baseUrl} — เปิดแอป Ollama หรือรัน ollama serve ก่อน`
      );
    }
  }

  private buildEditorSystem(request: PolishRequest): string {
    const base = buildSystemPrompt(request.genre, request.intensity, request.loreContext, request.isNcMode);
    return `${base}

กฎเพิ่มสำหรับโมเดลท้องถิ่น (บังคับ):
1) ต้องแก้คำสะกดผิดและคำใช้ผิดความหมาย เช่น ม่าย→ไม่, แบบี้→แบบนี้, กระเซาะกระแซะ→กระแทก (ถ้าบริบทรุนแรง)
2) ห้ามคัดลอกต้นฉบับมายังไม่แก้
3) ห้ามให้หลายฉบับข้อความเหมือนกัน
4) ห้ามมีคำภาษาอังกฤษปนในเนื้อหาไทย (เช่น extradite)
5) ตรวจอีกรอบก่อนส่งว่าสะกดถูกและอ่านรู้เรื่อง`;
  }

  private async generateCorrectedDraft(request: PolishRequest): Promise<string> {
    const system = `คุณเป็นบรรณาธิการนิยายภาษาไทยที่เข้มงวดเรื่องสะกดและความหมาย
งานเดียว: แก้คำผิด คำสแลงสะกดเพี้ยน คำใช้ผิดบริบท ให้ถูกต้อง แล้วเขียนใหม่ทั้งก้อนให้อ่านรู้เรื่อง
ตัวอย่างการแก้: ม่าย→ไม่, แบบี้→แบบนี้, กระเซาะกระแซะ→กระแทก
ห้ามมีคำอังกฤษปน
${request.isNcMode ? 'โหมด NC เปิด: เก็บความเข้มของฉากได้ แต่ภาษาต้องชัดและถูกต้อง' : 'โหมด NC ปิด: สุภาพ ไม่เพิ่มเนื้อหาทางเพศ'}
ส่ง JSON เท่านั้น: {"text":"..."}
ห้ามคำนำ ห้ามทับต้นฉบับโดยไม่แก้`;

    const prompt = `แก้และเกลาข้อความนี้ให้ถูกต้อง (สะกด + ความหมาย) แล้วคืนใน JSON {"text":"..."} :

${request.text}`;

    let text = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.generateRaw(system, prompt, {
        temperature: 0.15 + attempt * 0.15,
        top_p: 0.8,
        num_predict: 2048
      });
      text = cleanPolishText(this.extractTextField(raw) || stripGenreLeakLines(raw), request.text);
      assertThaiPolishOutput(text);
      if (this.normalize(text) !== this.normalize(request.text)) break;
    }
    return text;
  }

  private async generateDistinctVariants(
    request: PolishRequest,
    corrected: string,
    count: number
  ): Promise<PolishVariant[]> {
    const specs = [
      { label: 'ใกล้ต้นฉบับ+แก้ถูก', focus: 'ใกล้ต้นฉบับที่สุด แต่ต้องแก้สะกด/คำผิดครบ และประโยคสมบูรณ์', temperature: 0.3 },
      { label: 'ลื่นไหล', focus: 'ทำให้ลื่นไหล อ่านง่าย เติมจังหวะและภาพเล็กน้อย แต่ความหมายเดิม สะกดถูก', temperature: 0.7 },
      { label: 'โวหารเข้ม', focus: 'ยกระดับโวหารและอารมณ์ให้เข้มขึ้น เปลี่ยนโครงประโยคได้ สะกดถูก ห้ามคำอังกฤษ', temperature: 0.9 }
    ].slice(0, count);

    const system = this.buildEditorSystem(request);
    const out: PolishVariant[] = [];

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const id = String(i + 1);
      const prompt = `จากฉบับที่แก้คำผิดแล้วด้านล่าง สร้างแพทเทิร์น ${id} เพียงฉบับเดียว
สไตล์: ${spec.focus}
ส่ง JSON เท่านั้น: {"id":"${id}","label":"${spec.label}","text":"..."}
ห้ามคัดลอกต้นฉบับดิบ ห้ามคำนำ ห้ามคำอังกฤษปน

ฉบับแก้คำผิดแล้ว:
${corrected}

ต้นฉบับดิบ (อ้างอิงเจตนา):
${request.text}`;

      let text = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        const raw = await this.generateRaw(system, prompt, {
          temperature: spec.temperature + attempt * 0.12,
          top_p: 0.92,
          num_predict: 2048
        });
        text = cleanPolishText(
          this.extractVariantText(raw, id) || this.extractTextField(raw) || stripGenreLeakLines(raw),
          request.text
        );
        assertThaiPolishOutput(text);
        const dup = out.some(v => this.normalize(v.text) === this.normalize(text));
        if (!dup) break;
      }
      out.push({ id, label: spec.label, text });
    }

    if (this.allSame(out)) {
      for (let i = 1; i < out.length; i++) {
        const raw = await this.generateRaw(
          system,
          `เขียนใหม่ให้ต่างจากข้อความนี้อย่างชัดเจน ความหมายเดิม สะกดถูก ห้ามคำอังกฤษ JSON {"text":"..."}:\n\n${out[0].text}`,
          { temperature: 1.0, num_predict: 2048 }
        );
        const text = cleanPolishText(this.extractTextField(raw) || out[i].text, request.text);
        assertThaiPolishOutput(text);
        out[i] = { ...out[i], text };
      }
    }

    return out;
  }

  private async generateRaw(system: string, prompt: string, opts: GenOpts): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: this.model,
        system,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: opts.temperature,
          top_p: opts.top_p ?? 0.9,
          num_predict: opts.num_predict ?? 2048,
          repeat_penalty: 1.18
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ไม่สามารถเชื่อมต่อ Ollama ได้ที่ ${this.baseUrl}`);
    }
    const data = await response.json();
    return String(data.response || '').trim();
  }

  private extractTextField(raw: string): string | null {
    try {
      const parsed = parsePolishJson(raw);
      if (parsed.variants[0]?.text) return stripGenreLeakLines(parsed.variants[0].text);
    } catch {
      /* fall through */
    }
    try {
      const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const data = JSON.parse(cleaned.slice(start, end + 1));
      if (typeof data.text === 'string' && data.text.trim()) return stripGenreLeakLines(data.text.trim());
      if (typeof data.polishedText === 'string' && data.polishedText.trim()) {
        return stripGenreLeakLines(data.polishedText.trim());
      }
    } catch {
      return null;
    }
    return null;
  }

  private extractVariantText(raw: string, id: string): string | null {
    try {
      const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const data = JSON.parse(cleaned.slice(start, end + 1));
      if (typeof data.text === 'string' && data.text.trim()) return stripGenreLeakLines(data.text.trim());
      if (Array.isArray(data.variants)) {
        const hit = data.variants.find((v: any) => String(v.id) === id) || data.variants[0];
        if (hit?.text) return stripGenreLeakLines(String(hit.text).trim());
      }
    } catch {
      return null;
    }
    return null;
  }

  private normalize(s: string): string {
    return s.replace(/\s+/g, '').trim();
  }

  private allSame(variants: PolishVariant[]): boolean {
    if (variants.length < 2) return false;
    const first = this.normalize(variants[0].text);
    return variants.every(v => this.normalize(v.text) === first);
  }
}

export const DEFAULT_OLLAMA_NC_MODEL = DEFAULT_NC_MODEL;
