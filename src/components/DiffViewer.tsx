import React, { useState } from 'react';
import { SentenceDiff } from '../services/diffEngine';
import { Check, X, CheckCheck } from 'lucide-react';

interface DiffViewerProps {
  diffs: SentenceDiff[];
  onApply: (finalText: string) => void;
  onCancel: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffs: initialDiffs, onApply, onCancel }) => {
  const [diffs, setDiffs] = useState<SentenceDiff[]>(initialDiffs);

  const handleDecision = (id: string, status: 'accepted' | 'rejected') => {
    setDiffs(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  const handleAcceptAll = () => {
    setDiffs(prev => prev.map(d => ({ ...d, status: 'accepted' })));
  };

  const handleFinalize = () => {
    const finalText = diffs
      .map(d => (d.status === 'accepted' ? d.polished : d.original))
      .join('\n\n');
    onApply(finalText);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-100">ตรวจสอบการเกลาสำนวน (Sentence Review)</h3>
            <p className="text-xs text-slate-400">เลือกยอมรับหรือคงร่างเดิมทีละประโยคได้อย่างอิสระ</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleAcceptAll}
              className="flex items-center px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs md:text-sm font-medium transition-colors"
            >
              <CheckCheck className="w-4 h-4 mr-1" /> ยอมรับทั้งหมด
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs md:text-sm transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {diffs.map((d) => (
            <div
              key={d.id}
              className={`p-3 rounded-xl border transition-all ${
                !d.isChanged
                  ? 'border-slate-800/80 bg-slate-800/30'
                  : d.status === 'accepted'
                  ? 'border-emerald-600/70 bg-emerald-950/30'
                  : d.status === 'rejected'
                  ? 'border-rose-600/70 bg-rose-950/30'
                  : 'border-amber-600/80 bg-amber-950/20'
              }`}
            >
              {d.isChanged ? (
                <div className="space-y-2">
                  <div className="text-rose-400/80 text-sm line-through pl-2 border-l-2 border-rose-500/70">
                    {d.original}
                  </div>
                  <div className="text-emerald-300 text-base pl-2 border-l-2 border-emerald-500">
                    {d.polished}
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleDecision(d.id, 'accepted')}
                      className={`px-3 py-1 text-xs rounded-lg flex items-center transition-colors ${
                        d.status === 'accepted' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> ใช้ประโยคนี้
                    </button>
                    <button
                      onClick={() => handleDecision(d.id, 'rejected')}
                      className={`px-3 py-1 text-xs rounded-lg flex items-center transition-colors ${
                        d.status === 'rejected' ? 'bg-rose-600 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-rose-400'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> คงร่างเดิม
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-slate-300 text-sm">{d.original}</div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleFinalize}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all"
          >
            ยืนยันและบันทึกข้อความ
          </button>
        </div>
      </div>
    </div>
  );
};
