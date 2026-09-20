export type GenreType = 'auto' | 'wuxia' | 'fantasy' | 'romance' | 'general';
export type IntensityLevel = 1 | 2 | 3;

export interface NovelProject {
  id?: number;
  title: string;
  genre: GenreType;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chapter {
  id?: number;
  projectId: number;
  title: string;
  order: number;
  currentContent: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NovelVersion {
  id?: number;
  chapterId: number;
  versionName: string;
  originalContent: string;
  polishedContent: string;
  genre: GenreType;
  intensityLevel: IntensityLevel;
  modelUsed: string;
  createdAt: Date;
}

export interface LoreItem {
  id?: number;
  projectId: number;
  category: 'character' | 'cultivation_rank' | 'magic_system' | 'faction' | 'terminology';
  name: string;
  aliases: string[];
  description: string;
  isStrict: boolean;
}

export interface AppSettings {
  id?: number;
  geminiApiKey: string;
  openrouterApiKey: string;
  ollamaBaseUrl: string;
  activeModelNC: string;
  activeModelGeneral: string;
  theme: 'dark' | 'light';
  autoSaveIntervalSec: number;
}

export interface PolishVariant {
  id: string;
  label: string;
  text: string;
}
