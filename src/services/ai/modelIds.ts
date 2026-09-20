/** Map retired / blocked-for-new-users Gemini model ids to a working default. */
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  'gemini-pro': 'gemini-3.5-flash-lite',
  'gemini-1.0-pro': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash-latest': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash-001': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash-8b': 'gemini-3.5-flash-lite',
  'gemini-1.5-pro': 'gemini-3.5-flash',
  'gemini-1.5-pro-latest': 'gemini-3.5-flash',
  'gemini-2.0-flash': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash-001': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash-lite-001': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.6-flash',
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.5-flash'
};

/**
 * Default for Free tier: lite is usually less congested and faster.
 * Quality models stay in the fallback chain.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Capacity-first order after the preferred model. */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest'
] as const;

export function normalizeGeminiModel(raw?: string | null): string {
  if (!raw || !raw.trim()) return DEFAULT_GEMINI_MODEL;
  let id = raw.trim();
  if (id.startsWith('models/')) id = id.slice('models/'.length);
  return GEMINI_MODEL_ALIASES[id] || id;
}

export function isDeprecatedGeminiModel(raw?: string | null): boolean {
  if (!raw) return false;
  let id = raw.trim();
  if (id.startsWith('models/')) id = id.slice('models/'.length);
  return Object.prototype.hasOwnProperty.call(GEMINI_MODEL_ALIASES, id);
}

export function buildGeminiModelCandidates(preferred?: string | null): string[] {
  const primary = normalizeGeminiModel(preferred);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primary, ...GEMINI_FALLBACK_MODELS]) {
    const n = normalizeGeminiModel(id);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function isModelUnavailableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('no longer available') ||
    m.includes('is not found') ||
    m.includes('not supported for generatecontent') ||
    m.includes('not found for api version') ||
    (m.includes('models/') && m.includes('not found'))
  );
}

export function isBillingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('prepayment credits are depleted') ||
    m.includes('prepay required') ||
    m.includes('buy credits') ||
    m.includes('billing')
  );
}

/** Transient Free-tier congestion / rate spikes — safe to retry or switch model. */
export function isCapacityError(message: string, status?: number): boolean {
  if (status === 429 || status === 503 || status === 502) return true;
  const m = message.toLowerCase();
  return (
    m.includes('high demand') ||
    m.includes('try again later') ||
    m.includes('temporarily') ||
    m.includes('overloaded') ||
    m.includes('resource_exhausted') ||
    m.includes('rate limit') ||
    m.includes('quota exceeded') ||
    m.includes('too many requests')
  );
}
