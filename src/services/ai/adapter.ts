import { GenreType, IntensityLevel, PolishVariant } from '../../types';

export interface PolishRequest {
  text: string;
  genre: GenreType;
  intensity: IntensityLevel;
  loreContext?: string;
  isNcMode: boolean;
}

export interface PolishResponse {
  polishedText: string;
  modelUsed: string;
  variants: PolishVariant[];
  tip?: string;
  detectedGenre?: string;
  detectedTone?: string;
  /** Corrected base draft used to spawn more patterns. */
  baseText?: string;
}

export interface ExtraVariantRequest {
  originalText: string;
  baseText: string;
  existingTexts: string[];
  nextIndex: number;
  genre: GenreType;
  intensity: IntensityLevel;
  loreContext?: string;
  isNcMode: boolean;
}

export interface AiAdapter {
  name: string;
  polish(request: PolishRequest): Promise<PolishResponse>;
  generateExtraVariant?(request: ExtraVariantRequest): Promise<PolishVariant>;
}
