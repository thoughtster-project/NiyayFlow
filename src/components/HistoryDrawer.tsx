import React from 'react';
import { NovelVersion } from '../types';
import { X, RotateCcw, Trash2, Clock, Sparkles } from 'lucide-react';

interface HistoryDrawerProps {
  versions: NovelVersion[];
  onRevert: (version: NovelVersion) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ versions, onRevert, onDelete, onClose }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 z-50 p-4 shadow-2xl flex flex-col">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h3 className="font-bold flex items-center text-slate-100">
          <Clock className="w-4 h-4 mr-2 text-indigo-400" /> ประวัติเวอร์ชัน (History)
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {versions.length === 0 ? (
          <div className="text-center text-slate-500 py-10 text-sm">ยังไม่มีประวัติการเกลาในตอนนี้</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-medium text-slate-200 text-sm">{v.versionName}</span>
                <span className="text-[10px] text-slate-400">
                  {new Date(v.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-400" />
                {v.genre} (ระดับ {v.intensityLevel}) • {v.modelUsed}
              </div>
              <div className="flex justify-end space-x-2 pt-1 border-t border-slate-800/60">
                <button
                  onClick={() => onRevert(v)}
                  className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded text-xs flex items-center"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> คืนค่า
                </button>
                {v.id && (
                  <button
                    onClick={() => onDelete(v.id!)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
