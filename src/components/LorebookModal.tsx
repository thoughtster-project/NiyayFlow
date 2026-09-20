import React, { useState } from 'react';
import { LoreItem } from '../types';
import { X, Plus, BookOpen, Trash2 } from 'lucide-react';

interface LorebookModalProps {
  items: LoreItem[];
  onAdd: (item: Omit<LoreItem, 'id'>) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export const LorebookModal: React.FC<LorebookModalProps> = ({ items, onAdd, onDelete, onClose }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<LoreItem['category']>('character');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      projectId: 1,
      category,
      name: name.trim(),
      aliases: [],
      description: description.trim(),
      isStrict: true
    });
    setName('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl max-w-xl w-full p-5 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-bold text-lg flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-amber-400" /> คลังศัพท์และปูมตัวละคร (Lorebook)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 my-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="ชื่อตัวละคร / วิชา / ขั้นพลัง"
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value as LoreItem['category'])}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="character">ตัวละคร (Character)</option>
              <option value="cultivation_rank">ขั้นพลังยุทธ์ (Cultivation)</option>
              <option value="magic_system">เวทมนตร์ (Magic)</option>
              <option value="faction">สำนัก/ฝ่าย (Faction)</option>
              <option value="terminology">คำศัพท์เฉพาะ (Term)</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="คำอธิบาย (เช่น ตัวเอกชาย ถือกระบี่มังกรฟ้า)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
          />
          <button
            onClick={handleAdd}
            className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-semibold flex items-center justify-center text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มลงคลังศัพท์
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.length === 0 ? (
            <div className="text-center text-slate-500 py-6 text-xs">ยังไม่มีคำศัพท์ที่บันทึกไว้</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-amber-300">{item.name}</span>
                  <span className="text-slate-400 ml-2">({item.category})</span>
                  <div className="text-slate-300 text-[11px] mt-0.5">{item.description}</div>
                </div>
                {item.id && (
                  <button onClick={() => onDelete(item.id!)} className="text-slate-500 hover:text-rose-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
