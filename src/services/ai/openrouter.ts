import { AiAdapter, PolishRequest, PolishResponse } from './adapter';
import { buildSystemPrompt, parsePolishJson } from '../../prompts';
import { assertPolishableThai, assertThaiPolishOutput, stripGenreLeakLines } from '../languageCheck';

export class OpenRouterAdapter implements AiAdapter {
  name = 'OpenRouter API';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'mistralai/mistral-7b-instruct:free') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async polish(request: PolishRequest): Promise<PolishResponse> {
    if (!this.apiKey) throw new Error('กรุณาระบุ OpenRouter API Key ในหน้าตั้งค่า');
    assertPolishableThai(request.text);
    const systemPrompt = buildSystemPrompt(request.genre, request.intensity, request.loreContext, request.isNcMode);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `เกลาและเสริมข้อความนิยายต่อไปนี้ให้สมบูรณ์:\n\n${request.text}` }
        ],
        temperature: 0.75,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenRouter Error: ${response.statusText}`);
    }

    const data = await response.json();
    const raw = String(data.choices?.[0]?.message?.content || '').trim();
    try {
      const parsed = parsePolishJson(raw);
      const variants = parsed.variants.map(v => {
        const text = stripGenreLeakLines(v.text);
        assertThaiPolishOutput(text);
        return { ...v, text };
      });
      return {
        polishedText: variants[0].text,
        variants,
        tip: parsed.tip,
        detectedGenre: parsed.detectedGenre,
        detectedTone: parsed.detectedTone,
        modelUsed: `openrouter:${this.model}`
      };
    } catch {
      const text = stripGenreLeakLines(raw);
      assertThaiPolishOutput(text);
      return {
        polishedText: text,
        variants: [{ id: 'A', label: 'ฉบับเกลา', text }],
        modelUsed: `openrouter:${this.model}`
      };
    }
  }
}
