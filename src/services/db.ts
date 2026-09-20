import Dexie, { Table } from 'dexie';
import { NovelProject, Chapter, NovelVersion, LoreItem, AppSettings } from '../types';
import { DEFAULT_GEMINI_MODEL, isDeprecatedGeminiModel, normalizeGeminiModel } from './ai/modelIds';
import { DEFAULT_OLLAMA_NC_MODEL } from './ai/ollama';

export class NiyayFlowDatabase extends Dexie {
  projects!: Table<NovelProject, number>;
  chapters!: Table<Chapter, number>;
  versions!: Table<NovelVersion, number>;
  lorebook!: Table<LoreItem, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('NiyayFlowDB');
    this.version(1).stores({
      projects: '++id, title, genre, updatedAt',
      chapters: '++id, projectId, order, updatedAt',
      versions: '++id, chapterId, genre, createdAt',
      lorebook: '++id, projectId, category, name',
      settings: '++id'
    });
  }
}

export const db = new NiyayFlowDatabase();

function defaultSettings(): AppSettings {
  return {
    geminiApiKey: '',
    openrouterApiKey: '',
    ollamaBaseUrl: 'http://localhost:11434',
    activeModelNC: DEFAULT_OLLAMA_NC_MODEL,
    activeModelGeneral: DEFAULT_GEMINI_MODEL,
    theme: 'dark',
    autoSaveIntervalSec: 30
  };
}

function migrateNcModel(model?: string): string {
  const m = (model || '').trim();
  if (!m || m.startsWith('llama3')) return DEFAULT_OLLAMA_NC_MODEL;
  return m;
}

/** Upgrade retired Gemini model ids / NC model defaults stored in IndexedDB. */
export async function getOrInitSettings(): Promise<AppSettings> {
  const existing = await db.settings.toCollection().first();
  if (!existing) {
    const defaults = defaultSettings();
    const id = await db.settings.add(defaults);
    return { ...defaults, id };
  }

  let updated: AppSettings = { ...existing };
  let dirty = false;

  const normalized = normalizeGeminiModel(existing.activeModelGeneral);
  if (normalized !== existing.activeModelGeneral || isDeprecatedGeminiModel(existing.activeModelGeneral)) {
    updated = { ...updated, activeModelGeneral: normalized };
    dirty = true;
  }
  if (!updated.activeModelGeneral) {
    updated = { ...updated, activeModelGeneral: DEFAULT_GEMINI_MODEL };
    dirty = true;
  }

  const nc = migrateNcModel(updated.activeModelNC);
  if (nc !== updated.activeModelNC) {
    updated = { ...updated, activeModelNC: nc };
    dirty = true;
  }

  if (dirty) {
    await db.settings.put(updated);
    return updated;
  }
  return existing;
}
