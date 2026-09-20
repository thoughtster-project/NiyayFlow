import { AiAdapter, ExtraVariantRequest, PolishRequest, PolishResponse } from './adapter';
import { buildSystemPrompt, parsePolishJson } from '../../prompts';
import {
  assertPolishableThai,
  assertThaiPolishOutput,
  cleanPolishText
} from '../languageCheck';
// cleanPolishText imported below if needed
import {
  DEFAULT_GEMINI_MODEL,
  buildGeminiModelCandidates,
  isBillingError,
  isCapacityError,
  isModelUnavailableError,
  normalizeGeminiModel
} from './modelIds';
import { PolishVariant } from '../../types';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function hashKey(parts: unknown[]): string {
  const raw = JSON.stringify(parts);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

type Cached = { answer: PolishResponse; expires: number };
const responseCache = new Map<string, Cached>();
const pending = new Map<string, Promise<PolishResponse>>();
let blockedUntil = 0;

const POLISH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    detectedGenre: { type: 'string' },
    detectedTone: { type: 'string' },
    tip: { type: 'string' },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['label', 'text']
      }
    }
  },
  required: ['variants']
};

function sanitizeVariants(variants: PolishVariant[], original: string): PolishVariant[] {
  return variants.map(v => {
    const text = cleanPolishText(v.text, original);
    assertThaiPolishOutput(text);
    return { ...v, text };
  });
}

export class GeminiAdapter implements AiAdapter {
  name = 'Gemini API';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_GEMINI_MODEL) {
    this.apiKey = apiKey;
    this.model = normalizeGeminiModel(model);
  }

  async polish(request: PolishRequest): Promise<PolishResponse> {
    if (!this.apiKey) throw new Error('กรุณาระบุ Gemini API Key ในหน้าตั้งค่า');
    assertPolishableThai(request.text);

    const systemInstruction = buildSystemPrompt(
      request.genre,
      request.intensity,
      request.loreContext,
      request.isNcMode
    );
    const cacheId = hashKey([this.model, systemInstruction, request.text, request.isNcMode]);
    const cached = responseCache.get(cacheId);
    if (cached && cached.expires > Date.now()) return { ...cached.answer, variants: [...cached.answer.variants] };
    if (pending.has(cacheId)) return pending.get(cacheId)!;

    const waitMs = blockedUntil - Date.now();
    if (waitMs > 0) {
      throw new Error(`Gemini ขอพักชั่วคราว อีกประมาณ ${Math.ceil(waitMs / 1000)} วินาทีแล้วลองใหม่`);
    }

    const task = this.polishWithResilience(systemInstruction, request.text, cacheId);
    pending.set(cacheId, task);
    try {
      return await task;
    } finally {
      pending.delete(cacheId);
    }
  }


  async generateExtraVariant(req: ExtraVariantRequest): Promise<PolishVariant> {
    const systemInstruction = buildSystemPrompt(req.genre, req.intensity, req.loreContext, req.isNcMode) +
      `\nสร้างแพทเทิร์นใหม่หมายเลข ${req.nextIndex} ให้ต่างจากฉบับเดิม ห้ามคำอังกฤษปน สะกดภาษาไทยให้ถูกต้อง`;
    const prompt = `สร้างฉบับใหม่จากฐานนี้ ให้ต่างจากที่มีอยู่แล้ว:\nฐาน:\n${req.baseText}\n\nต้นฉบับ:\n${req.originalText}`;
    // Reuse primary model path with single-variant JSON via polishWithModel-like call
    const answer = await this.polishWithModel(this.model, systemInstruction, prompt);
    const text = cleanPolishText(answer.variants[0]?.text || answer.polishedText, req.originalText);
    assertThaiPolishOutput(text);
    return { id: String(req.nextIndex), label: `ทางเลือก ${req.nextIndex}`, text };
  }
  private async polishWithResilience(
    systemInstruction: string,
    text: string,
    cacheId: string
  ): Promise<PolishResponse> {
    const candidates = buildGeminiModelCandidates(this.model);
    let lastError = '';

    for (const model of candidates) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const answer = await this.polishWithModel(model, systemInstruction, text);
          if (responseCache.size >= 40) {
            const first = responseCache.keys().next().value;
            if (first) responseCache.delete(first);
          }
          responseCache.set(cacheId, { answer, expires: Date.now() + 30 * 60 * 1000 });
          return answer;
        } catch (err: any) {
          const status = typeof err?.status === 'number' ? err.status : undefined;
          const message = String(err?.message || err);
          lastError = message;

          if (isBillingError(message)) {
            throw new Error(
              'เครดิต Gemini (prepay) หมดหรือโปรเจกต์ยังติด Prepay — ปิด billing ให้เป็น Free tier หรือใช้ API key จากโปรเจกต์ Free tier'
            );
          }

          // Bad language / empty / JSON: retry same model once, then next model
          if (
            message.includes('จะลองใหม่') ||
            message.includes('ไม่ใช่ JSON') ||
            message.includes('ไม่ส่งแพทเทิร์น') ||
            message.includes('MAX_TOKENS') ||
            message.includes('ไม่คืนข้อความ')
          ) {
            if (attempt < 2) {
              await sleep(400 + Math.random() * 400);
              continue;
            }
            break;
          }

          if (isModelUnavailableError(message)) break;

          if (isCapacityError(message, status)) {
            const retryAfter = typeof err?.retryAfterSeconds === 'number' ? err.retryAfterSeconds : 0;
            if (attempt < 2 && retryAfter < 15) {
              const delay = retryAfter > 0
                ? retryAfter * 1000
                : Math.min(8000, 700 * Math.pow(2, attempt) + Math.random() * 400);
              await sleep(delay);
              continue;
            }
            if (retryAfter >= 15) blockedUntil = Date.now() + retryAfter * 1000;
            break;
          }

          throw new Error(message);
        }
      }
    }

    if (lastError.includes('MAX_TOKENS')) {
      throw new Error('ข้อความยาวหรือโควตาตอบสั้นเกินไป (MAX_TOKENS) — ลองแบ่งย่อหน้าสั้นลง แล้วกดเกลาอีกครั้ง');
    }
    if (isCapacityError(lastError)) {
      blockedUntil = Math.max(blockedUntil, Date.now() + 8000);
      throw new Error('Gemini กำลังหนาแน่น (Free tier) ระบบลองหลายโมเดลแล้ว — รอสักครู่แล้วกดเกลาอีกครั้ง');
    }
    throw new Error(lastError || 'Gemini ไม่สามารถเรียกโมเดลใดได้');
  }

  private async polishWithModel(
    model: string,
    systemInstruction: string,
    text: string
  ): Promise<PolishResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    // Large budget: multi-variant JSON + avoid MAX_TOKENS on short inputs
    const maxOutputTokens = Math.min(16384, Math.max(4096, Math.ceil(text.length * 6) + 2048));

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: `เกลาและเสริมข้อความนิยายต่อไปนี้ให้สมบูรณ์:\n\n${text}` }] }],
          generationConfig: {
            temperature: 0.75,
            topP: 0.95,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: POLISH_JSON_SCHEMA
          }
        })
      });
    } catch {
      const e: any = new Error('เชื่อมต่อ Gemini ไม่สำเร็จหรือใช้เวลานานเกินไป');
      e.status = 504;
      throw e;
    }

    const body = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      const message = body.error?.message || `Gemini Error: ${response.statusText}`;
      const details = body.error?.details as { retryDelay?: string }[] | undefined;
      const delay = Number.parseFloat(details?.find(d => d.retryDelay)?.retryDelay || '');
      const e: any = new Error(message);
      e.status = response.status;
      e.retryAfterSeconds = Number.isFinite(delay) ? Math.max(1, Math.ceil(delay)) : undefined;
      throw e;
    }

    const finish = body.candidates?.[0]?.finishReason;
    const parts = (body.candidates?.[0]?.content?.parts || []) as { text?: string; thought?: boolean }[];
    const rawText = parts.filter(p => p.text && !p.thought).map(p => p.text!).join('').trim();

    if (!rawText) {
      throw new Error(finish === 'MAX_TOKENS'
        ? 'Gemini ไม่คืนข้อความ (เหตุผล: MAX_TOKENS)'
        : `Gemini ไม่คืนข้อความ${finish ? ` (เหตุผล: ${finish})` : ''}`);
    }

    const parsed = parsePolishJson(rawText);
    const variants = sanitizeVariants(parsed.variants, text);
    return {
      polishedText: variants[0].text,
      variants,
      baseText: variants[0].text,
      tip: parsed.tip,
      detectedGenre: parsed.detectedGenre,
      detectedTone: parsed.detectedTone,
      modelUsed: model
    };
  }
}
