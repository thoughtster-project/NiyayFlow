import { AppSettings, GenreType } from '../../types';
import { AiAdapter } from './adapter';
import { GeminiAdapter } from './gemini';
import { OllamaAdapter, DEFAULT_OLLAMA_NC_MODEL } from './ollama';
import { OpenRouterAdapter } from './openrouter';
import { DEFAULT_GEMINI_MODEL, normalizeGeminiModel } from './modelIds';

export class AiRouter {
  static getAdapter(_genre: GenreType, settings: AppSettings, isNcMode: boolean): AiAdapter {
    // NC path only when the user explicitly enables NC Mode (romance alone is not enough).
    if (isNcMode) {
      if (settings.ollamaBaseUrl && settings.ollamaBaseUrl.trim().length > 0) {
        return new OllamaAdapter(settings.ollamaBaseUrl, settings.activeModelNC || DEFAULT_OLLAMA_NC_MODEL);
      }
      if (settings.openrouterApiKey) {
        return new OpenRouterAdapter(
          settings.openrouterApiKey,
          settings.activeModelNC || 'mistralai/mistral-7b-instruct:free'
        );
      }
      // Fall back to Gemini with NC prompt rules if no local/uncensored key.
      const model = normalizeGeminiModel(settings.activeModelGeneral || DEFAULT_GEMINI_MODEL);
      return new GeminiAdapter(settings.geminiApiKey, model);
    }
    const model = normalizeGeminiModel(settings.activeModelGeneral || DEFAULT_GEMINI_MODEL);
    return new GeminiAdapter(settings.geminiApiKey, model);
  }
}
