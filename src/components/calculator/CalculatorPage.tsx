import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Upload,
  ClipboardPaste,
  Eraser,
  Info,
  Target,
  Sparkles
} from 'lucide-react';
import {
  WordEngine,
  countText,
  loadCalibration,
  saveCalibration,
  suggestCoinsForChapter
} from '../../services/calculator/wordCount';
import {
  MEB_CHANNELS,
  MEB_RATES,
  MebChannel,
  RoundMode,
  baht,
  calcGoalUnits,
  calcQuantityEconomics,
  calcRawUnitIncome,
  calcUnitEconomics,
  roundPrice
} from '../../services/calculator/pricing';
import { extractTextFromFile } from '../../services/calculator/fileExtract';

type PlatformMode = 'meb' | 'raw';

interface CalculatorPageProps {
  onBack: () => void;
  isLight?: boolean;
}

const SAMPLE = `ในค่ำคืนนั้น ลมปราณของเขาปั่นป่วนราวคลื่นทะเลยามพายุ
เงาดาบตัดผ่านหมอก ทิ้งไว้เพียงเสียงฝีเท้าที่ห่างไกลบนทางหินเย็นเฉียบ
นางยืนนิ่งที่ขอบระเบียง พึมพำเพียงสั้น ๆ ว่า "ยังไม่จบเพียงเท่านี้"
`.repeat(40);

function Bubble({
  label,
  value,
  hint,
  tone = 'indigo'
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const tones = {
    indigo: 'from-indigo-500/20 to-fuchsia-500/10 border-indigo-500/30 text-indigo-200',
    emerald: 'from-emerald-500/15 to-teal-500/10 border-emerald-500/30 text-emerald-300',
    amber: 'from-amber-500/15 to-orange-500/10 border-amber-500/30 text-amber-300',
    rose: 'from-rose-500/15 to-pink-500/10 border-rose-500/30 text-rose-300'
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className="text-[11px] opacity-80 mb-1">{label}</div>
      <div className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {hint ? <div className="text-[11px] opacity-70 mt-1 leading-snug">{hint}</div> : null}
    </div>
  );
}

export function CalculatorPage({ onBack, isLight = false }: CalculatorPageProps) {
  const [mode, setMode] = useState<PlatformMode>('meb');
  const [text, setText] = useState('');
  const [engine, setEngine] = useState<WordEngine>('whitespace_word');
  const [calibrationInput, setCalibrationInput] = useState('');
  const [factor, setFactor] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputTab, setInputTab] = useState<'paste' | 'file'>('paste');

  const [rate, setRate] = useState(0.003);
  const [customRate, setCustomRate] = useState('0.003');
  const [roundMode, setRoundMode] = useState<RoundMode>('nine');
  const [channel, setChannel] = useState<MebChannel>('web');
  const [storeFeePct, setStoreFeePct] = useState(4);
  const [writerSharePct, setWriterSharePct] = useState(70);
  const [transferFee, setTransferFee] = useState(30);
  const [transferRounds, setTransferRounds] = useState(1);
  const [copiesSold, setCopiesSold] = useState(100);
  const [extraCostTotal, setExtraCostTotal] = useState(0);
  const [ebookPriceOverride, setEbookPriceOverride] = useState<string>('');
  const [syncEbookFromMeb, setSyncEbookFromMeb] = useState(true);

  const [chapterWords, setChapterWords] = useState(2500);
  const [coinsPerChapter, setCoinsPerChapter] = useState(4);
  const [isSpecial, setIsSpecial] = useState(false);
  const [paidChapters, setPaidChapters] = useState(50);
  const [buyersPerChapter, setBuyersPerChapter] = useState(100);
  const [paymentFee, setPaymentFee] = useState(0.96);
  const [writerShare, setWriterShare] = useState(0.7);

  const [goalMode, setGoalMode] = useState<'sales' | 'profit'>('profit');
  const [goalTarget, setGoalTarget] = useState(100000);

  useEffect(() => {
    const eng: WordEngine = mode === 'meb' ? 'whitespace_word' : 'thai_segmenter';
    setEngine(eng);
    setFactor(loadCalibration(eng));
  }, [mode]);

  useEffect(() => {
    const preset = MEB_CHANNELS.find(c => c.id === channel);
    if (preset) {
      setStoreFeePct(preset.storeFeePct);
      setWriterSharePct(preset.writerSharePct);
    }
  }, [channel]);

  const counts = useMemo(() => countText(text, engine, factor), [text, engine, factor]);
  const altEngine: WordEngine = engine === 'thai_segmenter' ? 'whitespace_word' : 'thai_segmenter';
  const altCounts = useMemo(() => countText(text, altEngine, 1), [text, altEngine]);
  const words = counts.calibratedWords;

  const mebListPrice = useMemo(() => roundPrice(words * rate, roundMode), [words, rate, roundMode]);
  const ebookComparePrice = useMemo(() => {
    if (!syncEbookFromMeb && ebookPriceOverride !== '') {
      const n = Number(ebookPriceOverride);
      return Number.isFinite(n) && n > 0 ? n : mebListPrice;
    }
    return mebListPrice;
  }, [syncEbookFromMeb, ebookPriceOverride, mebListPrice]);

  const unit = useMemo(
    () =>
      calcUnitEconomics({
        price: mebListPrice,
        storeFeePct,
        writerSharePct,
        extraCostPerUnit: 0,
        transferFeePerUnit: 0
      }),
    [mebListPrice, storeFeePct, writerSharePct]
  );
  const qty = useMemo(
    () => calcQuantityEconomics(unit, copiesSold, transferFee, transferRounds),
    [unit, copiesSold, transferFee, transferRounds]
  );
  const qtyWithExtra = {
    ...qty,
    extraCosts: extraCostTotal,
    profit: qty.writerGross - extraCostTotal - qty.transferTotal
  };

  const goal = useMemo(
    () =>
      calcGoalUnits(
        {
          ...unit,
          extraCostPerUnit: 0,
          profitPerUnit: unit.writerGross
        },
        goalTarget,
        goalMode,
        transferFee,
        transferRounds
      ),
    [unit, goalTarget, goalMode, transferFee, transferRounds]
  );

  const coinSuggest = suggestCoinsForChapter(chapterWords || Math.max(1, Math.round(words / Math.max(1, paidChapters))), isSpecial);
  const reverseCoins = paidChapters > 0 ? ebookComparePrice / paidChapters : 0;
  const rawOneBuy = calcRawUnitIncome(coinsPerChapter, paymentFee, writerShare);
  const rawMany = calcRawUnitIncome(coinsPerChapter * buyersPerChapter * paidChapters, paymentFee, writerShare);

  const card = isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-slate-800';
  const field = isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950/70 border-slate-700 text-slate-100';
  const shell = isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100';

  const channelNote = MEB_CHANNELS.find(c => c.id === channel)?.note || '';

  const applyCalibration = () => {
    const actual = Number(calibrationInput);
    if (!actual || actual <= 0 || counts.words <= 0) {
      setError('กรอกจำนวนคำจริง และต้องมีข้อความก่อน');
      return;
    }
    const f = actual / counts.words;
    setFactor(f);
    saveCalibration(engine, f);
    setError(null);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const chunks: string[] = [];
      for (const file of Array.from(files)) chunks.push(await extractTextFromFile(file));
      setText(prev => (prev ? prev + '\n\n' : '') + chunks.join('\n\n'));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`min-h-screen ${shell}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur px-4 py-3 ${isLight ? 'border-slate-200 bg-white/90' : 'border-slate-800 bg-slate-950/85'}`}>
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button type="button" onClick={onBack} className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Calculator className="w-5 h-5 text-indigo-400" />
          <div className="leading-tight">
            <div className="font-semibold text-sm">Smart Writer Calculator</div>
            <div className="text-[11px] opacity-60">นับคำ · ตั้งราคา · กำไรจริง</div>
          </div>
          <div className={`ml-auto flex p-1 rounded-xl text-xs border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
            <button type="button" onClick={() => setMode('meb')} className={`px-3 py-1.5 rounded-lg ${mode === 'meb' ? 'bg-indigo-600 text-white' : 'opacity-70'}`}>Meb</button>
            <button type="button" onClick={() => setMode('raw')} className={`px-3 py-1.5 rounded-lg ${mode === 'raw' ? 'bg-indigo-600 text-white' : 'opacity-70'}`}>ReadAWrite</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid lg:grid-cols-12 gap-5">
        {error && <div className="lg:col-span-12 p-3 rounded-xl text-sm border border-amber-600/40 bg-amber-950/40 text-amber-100">{error}</div>}

        {/* LEFT */}
        <section className="lg:col-span-7 space-y-5">
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs grid place-items-center font-bold">1</span>
              <h2 className="font-semibold">ใส่ต้นฉบับ</h2>
              <button type="button" className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white" onClick={() => setText(SAMPLE)}>ลองตัวอย่าง</button>
            </div>
            <div className={`flex gap-1 p-1 rounded-xl text-sm mb-3 ${isLight ? 'bg-slate-100' : 'bg-slate-950/60'}`}>
              <button type="button" onClick={() => setInputTab('paste')} className={`flex-1 py-2 rounded-lg ${inputTab === 'paste' ? 'bg-indigo-600 text-white' : 'opacity-70'}`}>วางข้อความ</button>
              <button type="button" onClick={() => setInputTab('file')} className={`flex-1 py-2 rounded-lg ${inputTab === 'file' ? 'bg-indigo-600 text-white' : 'opacity-70'}`}>อัปโหลดไฟล์</button>
            </div>
            {inputTab === 'paste' ? (
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="วางเนื้อเรื่องที่นี่…" className={`w-full min-h-[200px] rounded-xl border p-3 text-sm leading-relaxed focus:outline-none focus:border-indigo-500 ${field}`} />
            ) : (
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 text-sm cursor-pointer ${isLight ? 'border-slate-300' : 'border-slate-700'}`}>
                <Upload className="w-5 h-5 text-indigo-400" />
                <span>{busy ? 'กำลังอ่านไฟล์...' : 'ลากวาง หรือคลิก · .txt .docx .pdf'}</span>
                <input type="file" className="hidden" accept=".txt,.md,.docx,.pdf" multiple disabled={busy} onChange={e => onFiles(e.target.files)} />
              </label>
            )}
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <button type="button" className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} onClick={async () => { try { setText(await navigator.clipboard.readText()); } catch { setError('อ่านคลิปบอร์ดไม่ได้'); } }}>
                <ClipboardPaste className="w-3.5 h-3.5" /> วางจากคลิปบอร์ด
              </button>
              <button type="button" className={`px-3 py-1.5 rounded-lg flex items-center gap-1 ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} onClick={() => setText('')}>
                <Eraser className="w-3.5 h-3.5" /> ล้าง
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs grid place-items-center font-bold">2</span>
              <h2 className="font-semibold">ผลการนับคำ</h2>
              {factor !== 1 && <span className="ml-auto text-[11px] px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">ปรับเทียบ ×{factor.toFixed(3)}</span>}
            </div>
            <div className={`rounded-2xl border p-5 mb-4 ${isLight ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-950/50 border-slate-800'}`}>
              <div className="text-[11px] uppercase tracking-wider opacity-50 mb-1">จำนวนคำโดยประมาณ</div>
              <div className="flex items-end gap-2">
                <div className="text-5xl font-bold tabular-nums bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">{words.toLocaleString('th-TH')}</div>
                <div className="pb-2 text-sm opacity-60">คำ</div>
              </div>
              <div className="text-xs opacity-50 mt-1">≈ {(words * 0.97).toFixed(0)} – {(words * 1.03).toFixed(0)} คำ (±3%)</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs mb-4">
              <div className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}><div className="font-semibold tabular-nums">{counts.charsWithSpace.toLocaleString('th-TH')}</div><div className="opacity-50 mt-0.5">ตัวอักษร</div></div>
              <div className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}><div className="font-semibold tabular-nums">{counts.charsNoSpace.toLocaleString('th-TH')}</div><div className="opacity-50 mt-0.5">ไม่นับเว้นวรรค</div></div>
              <div className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}><div className="font-semibold tabular-nums">{counts.paragraphs}</div><div className="opacity-50 mt-0.5">ย่อหน้า</div></div>
              <div className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}><div className="font-semibold tabular-nums">{Math.max(1, Math.round(words / 200))}</div><div className="opacity-50 mt-0.5">นาทีอ่าน</div></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              <button type="button" onClick={() => setEngine('whitespace_word')} className={`px-3 py-1.5 rounded-lg ${engine === 'whitespace_word' ? 'bg-indigo-600 text-white' : isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>ใกล้ Word (Meb)</button>
              <button type="button" onClick={() => setEngine('thai_segmenter')} className={`px-3 py-1.5 rounded-lg ${engine === 'thai_segmenter' ? 'bg-indigo-600 text-white' : isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>ตัดคำไทย (RAW)</button>
              <span className="opacity-60 self-center">อีกเอนจิน: {altCounts.words.toLocaleString('th-TH')} คำ</span>
            </div>
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <label className="flex flex-col gap-1">คำจริงจาก Word/แพลตฟอร์ม
                <input value={calibrationInput} onChange={e => setCalibrationInput(e.target.value)} className={`rounded-lg border px-3 py-1.5 w-36 ${field}`} />
              </label>
              <button type="button" onClick={applyCalibration} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white">ปรับเทียบ</button>
              {factor !== 1 && <button type="button" onClick={() => { setFactor(1); saveCalibration(engine, 1); }} className={`px-3 py-1.5 rounded-lg ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>รีเซ็ต</button>}
            </div>
            <p className="text-[11px] opacity-50 mt-3 flex gap-2"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Meb มักอ้างอิงตัวเลขแบบ Word · ReadAWrite ใกล้ตัดคำไทย — ตัวเลขเป็นประมาณการ</p>
          </div>
        </section>

        {/* RIGHT sticky */}
        <section className="lg:col-span-5 space-y-5 lg:sticky lg:top-24 self-start">
          {mode === 'meb' ? (
            <div className={`rounded-2xl border p-5 space-y-4 ${card}`}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-fuchsia-500/20 text-fuchsia-300 text-xs grid place-items-center font-bold">3</span>
                <h2 className="font-semibold">ตั้งราคา E-book (Meb)</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MEB_RATES.map(r => (
                  <button key={r.id} type="button" onClick={() => { setRate(r.rate); setCustomRate(String(r.rate)); }}
                    className={`rounded-xl p-3 border text-left ${Math.abs(rate - r.rate) < 1e-9 ? 'border-indigo-500 bg-indigo-500/15' : isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                    <div className="font-semibold text-sm">×{r.rate}</div>
                    <div className="text-[10px] opacity-60">{r.label}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">เรทกรอกเอง
                  <input value={customRate} onChange={e => { setCustomRate(e.target.value); const n = Number(e.target.value); if (n > 0) setRate(n); }} className={`rounded-lg border px-3 py-2 ${field}`} />
                </label>
                <label className="flex flex-col gap-1">ปัดเศษ
                  <select value={roundMode} onChange={e => setRoundMode(e.target.value as RoundMode)} className={`rounded-lg border px-3 py-2 ${field}`}>
                    <option value="nine">ลงท้าย 9</option>
                    <option value="ten">ขึ้นหลักสิบ</option>
                    <option value="none">ไม่ปัด</option>
                  </select>
                </label>
              </div>

              <Bubble label="ราคาขายแนะนำ / เล่ม" value={`${baht(mebListPrice)} บาท`} hint={`${words.toLocaleString('th-TH')} คำ × ${rate}`} tone="indigo" />

              <div>
                <div className="text-xs font-semibold opacity-70 mb-2">ช่องทางชำระ (ค่าตัวกลางต่างกัน)</div>
                <div className="grid gap-2">
                  {MEB_CHANNELS.map(c => (
                    <button key={c.id} type="button" onClick={() => setChannel(c.id)}
                      className={`text-left rounded-xl border p-3 text-xs ${channel === c.id ? 'border-indigo-500 bg-indigo-500/10' : isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <div className="font-semibold">{c.label}</div>
                      <div className="opacity-60 mt-0.5">ตัวกลาง ~{c.storeFeePct}% · ส่วนแบ่งนักเขียน {c.writerSharePct}% ของส่วนที่เหลือ</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] opacity-50 mt-2 leading-relaxed">{channelNote}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <label className="flex flex-col gap-1">ค่าตัวกลาง %
                    <input type="number" value={storeFeePct} onChange={e => setStoreFeePct(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                  </label>
                  <label className="flex flex-col gap-1">ส่วนแบ่งนักเขียน %
                    <input type="number" value={writerSharePct} onChange={e => setWriterSharePct(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                  </label>
                </div>
              </div>

              {/* Unit vs Qty */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className={`rounded-2xl border p-4 space-y-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
                  <div className="text-xs font-bold text-indigo-300">ต่อ 1 เล่ม</div>
                  <div className="text-[11px] space-y-1 font-mono">
                    <div className="flex justify-between"><span className="opacity-60">ราคาขาย</span><span>{baht(unit.price)}</span></div>
                    <div className="flex justify-between text-rose-300"><span>− ค่าตัวกลาง</span><span>−{baht(unit.storeFee)}</span></div>
                    <div className="flex justify-between"><span className="opacity-60">เหลือหลังตัวกลาง</span><span>{baht(unit.afterStore)}</span></div>
                    <div className="flex justify-between"><span className="opacity-60">นักเขียนได้ ({writerSharePct}%)</span><span>{baht(unit.writerGross)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-300 border-t border-dashed pt-1"><span>เข้ากระเป๋า / เล่ม</span><span>{baht(unit.writerGross)}</span></div>
                  </div>
                  <div className="text-[10px] opacity-50">อัตราได้จริง ≈ {unit.effectivePct.toFixed(1)}% ของราคาปก</div>
                </div>
                <div className={`rounded-2xl border p-4 space-y-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
                  <div className="text-xs font-bold text-fuchsia-300">× จำนวนเล่ม</div>
                  <label className="text-[11px] flex flex-col gap-1">ขายได้กี่เล่ม
                    <input type="range" min={0} max={1000} step={10} value={copiesSold} onChange={e => setCopiesSold(Number(e.target.value))} className="w-full" />
                    <input type="number" value={copiesSold} onChange={e => setCopiesSold(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex flex-col gap-1">ค่าโอน/รอบ
                      <input type="number" value={transferFee} onChange={e => setTransferFee(Number(e.target.value))} className={`rounded-lg border px-2 py-1 ${field}`} />
                    </label>
                    <label className="flex flex-col gap-1">รอบโอน
                      <input type="number" value={transferRounds} onChange={e => setTransferRounds(Number(e.target.value))} className={`rounded-lg border px-2 py-1 ${field}`} />
                    </label>
                  </div>
                  <label className="text-[11px] flex flex-col gap-1">ต้นทุนเพิ่มทั้งก้อน (ปก/พิสูจน์ฯ)
                    <input type="number" value={extraCostTotal} onChange={e => setExtraCostTotal(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                  </label>
                  <div className="text-[11px] space-y-1 font-mono">
                    <div className="flex justify-between"><span className="opacity-60">ยอดขาย</span><span>{baht(qtyWithExtra.sales)}</span></div>
                    <div className="flex justify-between text-rose-300"><span>− ค่าตัวกลางรวม</span><span>−{baht(qtyWithExtra.storeFees)}</span></div>
                    <div className="flex justify-between"><span className="opacity-60">รายได้นักเขียน</span><span>{baht(qtyWithExtra.writerGross)}</span></div>
                    <div className="flex justify-between text-rose-300"><span>− ค่าโอน/ต้นทุน</span><span>−{baht(qtyWithExtra.transferTotal + qtyWithExtra.extraCosts)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-300 border-t border-dashed pt-1"><span>กำไรสุทธิ</span><span>{baht(qtyWithExtra.profit)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl border p-5 space-y-4 ${card}`}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 text-xs grid place-items-center font-bold">3</span>
                <h2 className="font-semibold">ติดเหรียญ ReadAWrite</h2>
              </div>
              <p className="text-[11px] opacity-60">ไม่มีเกณฑ์บังคับตายตัว — ใช้แนวทางนิยมในกลุ่มนักเขียน (1 คอยน์ ≈ 1 บาท)</p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">คำต่อตอน
                  <input type="number" value={chapterWords} onChange={e => setChapterWords(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                </label>
                <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={isSpecial} onChange={e => setIsSpecial(e.target.checked)} /> ตอนพิเศษ/NC</label>
              </div>
              <div className={`rounded-xl p-3 text-sm border ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
                แนะนำ {coinSuggest.label}: <b>{coinSuggest.min}–{coinSuggest.max} เหรียญ</b>
                <div className="mt-1 flex gap-2 text-xs">
                  <button type="button" className="underline" onClick={() => setCoinsPerChapter(coinSuggest.min)}>ใช้ต่ำ</button>
                  <button type="button" className="underline" onClick={() => setCoinsPerChapter(Math.round((coinSuggest.min + coinSuggest.max) / 2))}>ใช้กลาง</button>
                  <button type="button" className="underline" onClick={() => setCoinsPerChapter(coinSuggest.max)}>ใช้สูง</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">เหรียญ/ตอน
                  <input type="number" value={coinsPerChapter} onChange={e => setCoinsPerChapter(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                </label>
                <label className="flex flex-col gap-1">ตอนที่ติดเหรียญ
                  <input type="number" value={paidChapters} onChange={e => setPaidChapters(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                </label>
              </div>

              <div className={`rounded-xl border p-3 text-xs space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={syncEbookFromMeb} onChange={e => setSyncEbookFromMeb(e.target.checked)} />
                  ดึงราคา E-book จากผลคำนวณ Meb อัตโนมัติ
                </label>
                <label className="flex flex-col gap-1">ราคา E-book เทียบ (บาท)
                  <input type="number" disabled={syncEbookFromMeb} value={syncEbookFromMeb ? mebListPrice : ebookPriceOverride} onChange={e => setEbookPriceOverride(e.target.value)} className={`rounded-lg border px-3 py-1.5 ${field} disabled:opacity-60`} />
                </label>
                <div>เฉลี่ยไม่ให้แพงกว่า E-book: <b className="text-amber-300">{baht(reverseCoins)} เหรียญ/ตอน</b></div>
                {coinsPerChapter * paidChapters > ebookComparePrice && (
                  <div className="text-orange-300">รวมเหรียญทั้งเรื่องสูงกว่าราคา E-book — นักอ่านอาจรู้สึกไม่คุ้ม</div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
                  <div className="text-xs font-bold text-amber-300 mb-2">ซื้อ 1 คน / 1 ตอน</div>
                  <div className="text-[11px] font-mono space-y-1">
                    <div className="flex justify-between"><span className="opacity-60">เหรียญ</span><span>{coinsPerChapter}</span></div>
                    <div className="flex justify-between"><span className="opacity-60">× {paymentFee} × {writerShare}</span><span>×{rawOneBuy.factor.toFixed(3)}</span></div>
                    <div className="flex justify-between font-bold text-emerald-300"><span>เข้ากระเป๋า</span><span>{baht(rawOneBuy.income)} บาท</span></div>
                  </div>
                </div>
                <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/50'}`}>
                  <div className="text-xs font-bold text-fuchsia-300 mb-2">เฉลี่ย × คนซื้อ × ตอน</div>
                  <label className="text-[11px] flex flex-col gap-1 mb-2">คนซื้อเฉลี่ย/ตอน
                    <input type="number" value={buyersPerChapter} onChange={e => setBuyersPerChapter(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                  </label>
                  <div className="text-[11px] font-mono space-y-1">
                    <div className="flex justify-between"><span className="opacity-60">เหรียญหมุนในระบบ</span><span>{(coinsPerChapter * buyersPerChapter * paidChapters).toLocaleString('th-TH')}</span></div>
                    <div className="flex justify-between font-bold text-emerald-300"><span>รายได้ประมาณ</span><span>{baht(rawMany.income)}</span></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">ค่าตัวกลางชำระเงิน
                  <input type="number" step="0.01" value={paymentFee} onChange={e => setPaymentFee(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                </label>
                <label className="flex flex-col gap-1">ส่วนแบ่งนักเขียน
                  <input type="number" step="0.01" value={writerShare} onChange={e => setWriterShare(Number(e.target.value))} className={`rounded-lg border px-3 py-1.5 ${field}`} />
                </label>
              </div>
            </div>
          )}

          {/* SMART SUMMARY */}
          <div className={`rounded-2xl border p-5 space-y-3 ${card}`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="font-semibold text-sm">สรุปอัจฉริยะ / Note</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Bubble
                label="Meb · ควรขาย / เล่ม"
                value={`${baht(mebListPrice)} บาท`}
                hint={`ต้นทุนตัวกลาง ${baht(unit.storeFee)} · เหลือให้แบ่ง ${baht(unit.afterStore)} · คุณได้ ${baht(unit.writerGross)} (${unit.effectivePct.toFixed(1)}%)`}
                tone="indigo"
              />
              <Bubble
                label="Meb · กำไรถ้าขายตามจำนวน"
                value={`${baht(qtyWithExtra.profit)} บาท`}
                hint={`${copiesSold} เล่ม · ยอดขาย ${baht(qtyWithExtra.sales)} · หักตัวกลาง ${baht(qtyWithExtra.storeFees)} · โอน/ต้นทุน ${baht(qtyWithExtra.transferTotal + qtyWithExtra.extraCosts)}`}
                tone="emerald"
              />
              <Bubble
                label="RAW · ได้จริง / ครั้งซื้อ 1 ตอน"
                value={`${baht(rawOneBuy.income)} บาท`}
                hint={`${coinsPerChapter} เหรียญ × ${rawOneBuy.factor.toFixed(3)}`}
                tone="amber"
              />
              <Bubble
                label="RAW · รวมตามสมมติผู้ซื้อ"
                value={`${baht(rawMany.income)} บาท`}
                hint={`${buyersPerChapter} คน × ${paidChapters} ตอน`}
                tone="rose"
              />
            </div>
            <div className={`rounded-xl p-3 text-xs leading-relaxed ${isLight ? 'bg-slate-100' : 'bg-slate-950/60'}`}>
              <b>โน้ตแนะนำ:</b> จาก {words.toLocaleString('th-TH')} คำ เรท ×{rate} ควรตั้งราคาประมาณ <b className="text-indigo-300">{baht(mebListPrice)} บาท/เล่ม</b>.
              ผ่านช่องทาง <b>{MEB_CHANNELS.find(c => c.id === channel)?.label}</b> คุณได้จริงราว <b className="text-emerald-300">{baht(unit.writerGross)} บาท/เล่ม</b> หลังหักค่าตัวกลาง.
              {mode === 'raw' ? ` ฝั่ง RAW ถ้าติด ${coinsPerChapter} เหรียญ/ตอน และอยากไม่แพงกว่า E-book ควรไม่เกิน ~${baht(reverseCoins)} เหรียญ/ตอน.` : ''}
            </div>
          </div>

          {/* GOAL */}
          <div className={`rounded-2xl border p-5 space-y-3 ${card}`}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-fuchsia-400" />
              <h2 className="font-semibold text-sm">เป้าหมายรายได้ (Meb)</h2>
            </div>
            <div className={`flex p-1 rounded-xl text-xs w-fit ${isLight ? 'bg-slate-100' : 'bg-slate-950'}`}>
              <button type="button" onClick={() => setGoalMode('sales')} className={`px-3 py-1.5 rounded-lg ${goalMode === 'sales' ? 'bg-indigo-600 text-white' : ''}`}>อยากมียอดขาย</button>
              <button type="button" onClick={() => setGoalMode('profit')} className={`px-3 py-1.5 rounded-lg ${goalMode === 'profit' ? 'bg-indigo-600 text-white' : ''}`}>อยากได้กำไรสุทธิ</button>
            </div>
            <label className="text-xs flex flex-col gap-1">เป้าหมาย (บาท)
              <input type="number" value={goalTarget} onChange={e => setGoalTarget(Number(e.target.value))} className={`rounded-lg border px-3 py-2 ${field}`} />
            </label>
            <Bubble
              label={goalMode === 'sales' ? 'ต้องขายอย่างน้อย' : 'ต้องขายเพื่อได้กำไรเป้าหมาย'}
              value={`${goal.unitsNeeded.toLocaleString('th-TH')} เล่ม`}
              hint={`ยอดขาย ${baht(goal.projectedSales)} · หักตัวกลาง ${baht(goal.projectedStoreFees)} · รายได้คุณ ${baht(goal.projectedWriterGross)} · ค่าโอน ${baht(goal.projectedTransfer)} · กำไรสุทธิ ${baht(goal.projectedProfit)}`}
              tone="emerald"
            />
            <div className="text-[11px] font-mono space-y-1 opacity-80">
              <div className="flex justify-between"><span>ยอดขายรวม</span><span>{baht(goal.projectedSales)}</span></div>
              <div className="flex justify-between text-rose-300"><span>ค่าตัวกลาง (หมวดช่องทาง)</span><span>−{baht(goal.projectedStoreFees)}</span></div>
              <div className="flex justify-between"><span>ส่วนคุณได้ก่อนต้นทุนอื่น</span><span>{baht(goal.projectedWriterGross)}</span></div>
              <div className="flex justify-between text-rose-300"><span>ค่าโอน</span><span>−{baht(goal.projectedTransfer)}</span></div>
              <div className="flex justify-between font-bold"><span>กำไรสุทธิประมาณ</span><span className="text-emerald-300">{baht(goal.projectedProfit)}</span></div>
            </div>
          </div>

          <p className="text-[10px] opacity-50 leading-relaxed pb-6">
            ประมาณการเพื่อวางแผนเท่านั้น — อัตรา iOS ~หัก Apple แล้วนักเขียน 80% ของส่วนเหลือ / Web·บัตร·meb+ ~หักค่าชำระ 4% แล้วนักเขียน 70% ตามตัวอย่างในข้อตกลง Meb ตรวจสอบประกาศล่าสุดก่อนตัดสินใจ
          </p>
        </section>
      </main>
    </div>
  );
}
