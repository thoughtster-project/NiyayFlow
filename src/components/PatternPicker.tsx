import { PolishVariant } from '../types';
import { Loader2, Plus } from 'lucide-react';

interface PatternPickerProps {
  variants: PolishVariant[];
  tip?: string;
  detectedTone?: string;
  detectedGenre?: string;
  generatingMore?: boolean;
  onPick: (variant: PolishVariant) => void;
  onAddMore: () => void;
  onCancel: () => void;
}

const genreLabel: Record<string, string> = {
  wuxia: 'กำลังภายใน',
  fantasy: 'แฟนตาซี',
  romance: 'โรมานซ์',
  general: 'ทั่วไป'
};

export function PatternPicker({
  variants,
  tip,
  detectedTone,
  detectedGenre,
  generatingMore,
  onPick,
  onAddMore,
  onCancel
}: PatternPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-start gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold">เลือกแพทเทิร์นการเกลา</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              เรียงแนวตั้งให้อ่านเทียบกันง่าย — เลือกฉบับที่ชอบ แล้วเข้าตรวจทีละประโยค
              {detectedGenre ? ` · ตรวจแนว: ${genreLabel[detectedGenre] || detectedGenre}` : ''}
              {detectedTone ? ` · โทน: ${detectedTone}` : ''}
            </p>
            {tip ? <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-2">คำแนะนำ: {tip}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs shrink-0"
          >
            ยกเลิก
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {variants.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(v)}
              className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-300">แพทเทิร์น {v.id}</span>
                <span className="text-xs text-slate-500">{v.label}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{v.text}</p>
              <span className="inline-block mt-3 text-xs font-semibold text-indigo-500">ใช้ฉบับนี้ →</span>
            </button>
          ))}

          <button
            type="button"
            onClick={onAddMore}
            disabled={generatingMore}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-indigo-400/70 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-60"
          >
            {generatingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังสร้างแพทเทิร์น {variants.length + 1}...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> สร้างแพทเทิร์น {variants.length + 1} เพิ่ม
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
