import { useState } from 'react';
import { AppSettings } from '../types';
import { X, Save, Key, Server } from 'lucide-react';
import { DEFAULT_GEMINI_MODEL } from '../services/ai/modelIds';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (updated: AppSettings) => void;
  onClose: () => void;
}

const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (เร็ว / Free tier แนะนำ)' },
  { value: 'gemini-flash-lite-latest', label: 'gemini-flash-lite-latest' },
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (คุณภาพ)' },
  { value: 'gemini-3.5-flash', label: 'gemini-3.5-flash' },
  { value: 'gemini-flash-latest', label: 'gemini-flash-latest' }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [form, setForm] = useState<AppSettings>({
    ...settings,
    activeModelGeneral: settings.activeModelGeneral || DEFAULT_GEMINI_MODEL
  });

  const handleSave = () => {
    onSave({
      ...form,
      activeModelGeneral: form.activeModelGeneral?.trim() || DEFAULT_GEMINI_MODEL
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold flex items-center">
            <Key className="w-5 h-5 mr-2 text-indigo-400" /> ตั้งค่าระบบและโมเดล AI
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Gemini API Key (สำหรับบททั่วไป/แฟนตาซี/กำลังภายใน)</label>
            <input
              type="password"
              value={form.geminiApiKey}
              onChange={e => setForm({ ...form, geminiApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">โมเดล Gemini (บททั่วไป)</label>
            <select
              value={form.activeModelGeneral || DEFAULT_GEMINI_MODEL}
              onChange={e => setForm({ ...form, activeModelGeneral: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {GEMINI_MODEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              {!GEMINI_MODEL_OPTIONS.some(o => o.value === form.activeModelGeneral) && form.activeModelGeneral ? (
                <option value={form.activeModelGeneral}>{form.activeModelGeneral} (ค่าเดิม)</option>
              ) : null}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              ถ้าโมเดลหลักหนาแน่น ระบบจะ retry + สลับไป lite/โมเดลสำรองอัตโนมัติแบบ lalla-lingo
            </p>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center text-rose-400 font-semibold">
              <Server className="w-4 h-4 mr-1.5" /> ตั้งค่าฉากอีโรติก / NC Mode (Uncensored)
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Ollama Base URL (Local PC หรือ Tailscale IP)</label>
              <input
                type="text"
                value={form.ollamaBaseUrl}
                onChange={e => setForm({ ...form, ollamaBaseUrl: e.target.value })}
                placeholder="http://localhost:11434 หรือ http://100.x.y.z:11434"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Ollama Model</label>
              <input
                type="text"
                value={form.activeModelNC}
                onChange={e => setForm({ ...form, activeModelNC: e.target.value })}
                placeholder="qwen2.5:7b (โมเดลที่มีในเครื่อง)"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">OpenRouter API Key (ทางเลือก Cloud สำหรับฉาก NC)</label>
              <input
                type="password"
                value={form.openrouterApiKey}
                onChange={e => setForm({ ...form, openrouterApiKey: e.target.value })}
                placeholder="sk-or-v1-..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs">
            ยกเลิก
          </button>
          <button onClick={handleSave} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold flex items-center">
            <Save className="w-4 h-4 mr-1.5" /> บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
};


