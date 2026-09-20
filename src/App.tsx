import { useState, useEffect } from 'react';
import { db, getOrInitSettings } from './services/db';
import { AppSettings, GenreType, IntensityLevel, NovelVersion, LoreItem, PolishVariant } from './types';
import { AiRouter } from './services/ai/router';
import { diffEngine, SentenceDiff } from './services/diffEngine';
import { buildLoreContext } from './prompts';
import { assertPolishableThai } from './services/languageCheck';
import { DiffViewer } from './components/DiffViewer';
import { PatternPicker } from './components/PatternPicker';
import { SettingsModal } from './components/SettingsModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LorebookModal } from './components/LorebookModal';
import { CalculatorPage } from './components/calculator/CalculatorPage';
import {
  Feather,
  Sparkles,
  Settings,
  History,
  BookOpen,
  Maximize2,
  Minimize2,
  Flame,
  Loader2,
  Sun,
  Moon,
  Calculator
} from 'lucide-react';

export default function App() {
  const [content, setContent] = useState('');
  const [genre, setGenre] = useState<GenreType>('auto');
  const [intensity, setIntensity] = useState<IntensityLevel>(1);
  const [isNcMode, setIsNcMode] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [versions, setVersions] = useState<NovelVersion[]>([]);
  const [loreItems, setLoreItems] = useState<LoreItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<SentenceDiff[] | null>(null);
  const [patternBundle, setPatternBundle] = useState<{
    variants: PolishVariant[];
    tip?: string;
    detectedGenre?: string;
    detectedTone?: string;
    modelUsed: string;
    baseText: string;
  } | null>(null);
  const [generatingMore, setGeneratingMore] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLorebook, setShowLorebook] = useState(false);
  const [view, setView] = useState<'polish' | 'calculator'>('polish');

  const theme = settings?.theme || 'dark';
  const isLight = theme === 'light';

  useEffect(() => {
    const initData = async () => {
      const s = await getOrInitSettings();
      setSettings(s);
      document.documentElement.classList.toggle('dark', s.theme !== 'light');
      document.documentElement.classList.toggle('light', s.theme === 'light');
      const v = await db.versions.orderBy('createdAt').reverse().toArray();
      setVersions(v);
      const l = await db.lorebook.toArray();
      setLoreItems(l);
    };
    initData();
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle('dark', settings.theme !== 'light');
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings?.theme]);

  const wordCount = content.replace(/\s+/g, '').length;

  const toggleTheme = async () => {
    if (!settings) return;
    const next: AppSettings = { ...settings, theme: settings.theme === 'light' ? 'dark' : 'light' };
    await db.settings.put(next);
    setSettings(next);
  };

  const handlePolish = async () => {
    if (!content.trim() || !settings) return;
    setErrorBanner(null);
    setIsLoading(true);
    setPatternBundle(null);
    setDiffs(null);
    try {
      assertPolishableThai(content);
      const adapter = AiRouter.getAdapter(genre, settings, isNcMode);
      const loreContext = buildLoreContext(content, loreItems);
      const res = await adapter.polish({
        text: content,
        genre,
        intensity,
        loreContext,
        isNcMode
      });
      setPatternBundle({
        variants: res.variants,
        tip: res.tip,
        detectedGenre: res.detectedGenre,
        detectedTone: res.detectedTone,
        modelUsed: res.modelUsed,
        baseText: res.baseText || res.variants[0]?.text || content
      });
    } catch (err: any) {
      setErrorBanner(String(err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };


  const handleAddPattern = async () => {
    if (!patternBundle || !settings || generatingMore) return;
    setErrorBanner(null);
    setGeneratingMore(true);
    try {
      const adapter = AiRouter.getAdapter(genre, settings, isNcMode);
      if (!adapter.generateExtraVariant) {
        throw new Error('ตัวเกลาปัจจุบันยังไม่รองรับการสร้างแพทเทิร์นเพิ่ม');
      }
      const nextIndex = patternBundle.variants.length + 1;
      const extra = await adapter.generateExtraVariant({
        originalText: content,
        baseText: patternBundle.baseText,
        existingTexts: patternBundle.variants.map(v => v.text),
        nextIndex,
        genre,
        intensity,
        loreContext: buildLoreContext(content, loreItems),
        isNcMode
      });
      setPatternBundle(prev => prev ? { ...prev, variants: [...prev.variants, extra] } : prev);
    } catch (err: any) {
      setErrorBanner(String(err?.message || err));
    } finally {
      setGeneratingMore(false);
    }
  };
  const handlePickVariant = async (variant: PolishVariant) => {
    if (!patternBundle) return;
    const generatedDiffs = diffEngine.generateSentenceDiffs(content, variant.text);
    setDiffs(generatedDiffs);
    const genreForSave = (patternBundle.detectedGenre as GenreType) || genre;
    const newVersion: NovelVersion = {
      chapterId: 1,
      versionName: `เกลา ${variant.id} (${genreForSave}) ระดับ ${intensity}`,
      originalContent: content,
      polishedContent: variant.text,
      genre: genre === 'auto' ? (['wuxia', 'fantasy', 'romance', 'general'].includes(String(genreForSave)) ? genreForSave : 'general') : genre,
      intensityLevel: intensity,
      modelUsed: patternBundle.modelUsed,
      createdAt: new Date()
    };
    const id = await db.versions.add(newVersion);
    setVersions(prev => [{ ...newVersion, id }, ...prev]);
    setPatternBundle(null);
  };

  const handleApplyDiff = (finalText: string) => {
    setContent(finalText);
    setDiffs(null);
  };

  const shell = isLight
    ? 'min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans'
    : 'min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans';

  if (view === 'calculator') {
    return <CalculatorPage onBack={() => setView('polish')} isLight={isLight} />;
  }

  return (
    <div className={shell}>
      {!zenMode && (
        <header className={`border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30 backdrop-blur ${isLight ? 'border-slate-200 bg-white/80' : 'border-slate-800/80 bg-slate-900/60'}`}>
          <div className="flex items-center space-x-2">
            <Feather className="w-5 h-5 text-indigo-500" />
            <h1 className="font-bold text-base md:text-lg tracking-wide">
              NiyayFlow <span className="text-xs text-indigo-500 font-normal">นิยายโฟลว์</span>
            </h1>
          </div>
          <div className="flex items-center space-x-1 md:space-x-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-amber-200 hover:bg-slate-800'}`}
              title={isLight ? 'สลับโหมดมืด' : 'สลับโหมดสว่าง'}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
                        <button
              type="button"
              onClick={() => setView('calculator')}
              className={`p-2 rounded-lg ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800'}`}
              title="Smart Writer Calculator"
            >
              <Calculator className="w-4 h-4" />
            </button>
<button type="button" onClick={() => setShowLorebook(true)} className={`p-2 rounded-lg ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'}`} title="คลังศัพท์">
              <BookOpen className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setShowHistory(true)} className={`p-2 rounded-lg ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800'}`} title="ประวัติเวอร์ชัน">
              <History className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setShowSettings(true)} className={`p-2 rounded-lg ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} title="ตั้งค่า">
              <Settings className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setZenMode(true)} className={`p-2 rounded-lg ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} title="Zen Mode">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {errorBanner && (
        <div className={`mx-3 md:mx-auto md:max-w-5xl mt-3 p-3 rounded-xl border text-sm flex items-start justify-between gap-3 ${isLight ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-amber-700/60 bg-amber-950/50 text-amber-100'}`}>
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="shrink-0 text-xs opacity-80 hover:opacity-100">ปิด</button>
        </div>
      )}

      <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-3 md:p-6 space-y-3">
        {!zenMode && (
          <div className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800/80'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={genre}
                onChange={e => setGenre(e.target.value as GenreType)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800 border-slate-700 text-slate-200'}`}
              >
                <option value="auto">🤖 ทั่วไป (Auto Detect)</option>
                <option value="wuxia">⚔️ กำลังภายใน / เทพเซียน</option>
                <option value="fantasy">✨ แฟนตาซี / มนต์ตรา</option>
                <option value="romance">🌹 โรมานซ์ / สัมผัสอารมณ์</option>
                <option value="general">📖 วรรณกรรมทั่วไป</option>
              </select>

              <div className={`flex items-center space-x-1 p-1 rounded-xl text-xs ${isLight ? 'bg-slate-100' : 'bg-slate-800/80'}`}>
                <span className={isLight ? 'text-slate-500 px-1' : 'text-slate-400 px-1'}>ความลึก:</span>
                {[1, 2, 3].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setIntensity(lvl as IntensityLevel)}
                    className={`px-2 py-0.5 rounded-lg transition-colors ${
                      intensity === lvl ? 'bg-indigo-600 text-white font-bold' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsNcMode(!isNcMode)}
                className={`flex items-center px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isNcMode
                    ? 'bg-rose-950/80 border border-rose-600 text-rose-300'
                    : isLight
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 mr-1" />
                NC Mode (Uncensored)
              </button>
            </div>

            <button
              type="button"
              onClick={handlePolish}
              disabled={isLoading || !content.trim()}
              className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center shadow-lg shadow-indigo-600/20"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> กำลังขัดเกลา...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1.5" /> สั่งเกลาสำนวน</>
              )}
            </button>
          </div>
        )}

        <div className={`flex-1 flex flex-col relative rounded-2xl overflow-hidden border focus-within:border-indigo-500/50 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/20 border-slate-800/60'}`}>
          {zenMode && (
            <button type="button" onClick={() => setZenMode(false)} className={`absolute top-3 right-3 p-2 rounded-lg z-10 ${isLight ? 'bg-white/90 hover:bg-slate-100' : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400'}`} title="ออกจาก Zen Mode">
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="วางเนื้อหานิยายภาษาไทยที่ต้องการเกลาที่นี่..."
            className={`w-full flex-1 min-h-[60vh] bg-transparent p-4 md:p-6 text-base md:text-lg leading-relaxed focus:outline-none resize-none ${isLight ? 'text-slate-800 placeholder:text-slate-400' : 'text-slate-200 placeholder:text-slate-600'}`}
          />
          <div className={`px-4 py-2 border-t text-xs flex justify-between items-center ${isLight ? 'border-slate-200 text-slate-500 bg-slate-50' : 'border-slate-800/60 text-slate-500 bg-slate-950/30'}`}>
            <span>{wordCount.toLocaleString()} ตัวอักษร</span>
            <span>{isNcMode ? '🔥 NC / Uncensored' : '⚡ Gemini · ตรวจภาษาไทยก่อนเกลา'}</span>
          </div>
        </div>
      </main>

      {patternBundle && (
        <PatternPicker
          variants={patternBundle.variants}
          tip={patternBundle.tip}
          detectedGenre={patternBundle.detectedGenre}
          detectedTone={patternBundle.detectedTone}
          generatingMore={generatingMore}
          onPick={handlePickVariant}
          onAddMore={handleAddPattern}
          onCancel={() => setPatternBundle(null)}
        />
      )}

      {diffs && (
        <DiffViewer diffs={diffs} onApply={handleApplyDiff} onCancel={() => setDiffs(null)} />
      )}

      {showSettings && settings && (
        <SettingsModal settings={settings} onSave={async (u) => { await db.settings.put(u); setSettings(u); }} onClose={() => setShowSettings(false)} />
      )}

      {showHistory && (
        <HistoryDrawer
          versions={versions}
          onRevert={v => { setContent(v.polishedContent || v.originalContent); setShowHistory(false); }}
          onDelete={async id => { await db.versions.delete(id); setVersions(prev => prev.filter(x => x.id !== id)); }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showLorebook && (
        <LorebookModal
          items={loreItems}
          onAdd={async item => { const id = await db.lorebook.add(item as LoreItem); setLoreItems(prev => [...prev, { ...item, id }]); }}
          onDelete={async id => { await db.lorebook.delete(id); setLoreItems(prev => prev.filter(l => l.id !== id)); }}
          onClose={() => setShowLorebook(false)}
        />
      )}
    </div>
  );
}
