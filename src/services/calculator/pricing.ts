export function baht(n: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0
  );
}

export type RoundMode = 'none' | 'nine' | 'ten';

export function roundPrice(raw: number, mode: RoundMode): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (mode === 'none') return Math.round(raw * 100) / 100;
  if (mode === 'ten') return Math.ceil(raw / 10) * 10;
  const floor = Math.floor(raw);
  const base = Math.floor(floor / 10) * 10 + 9;
  return base > 0 ? base : 9;
}

/**
 * Meb channel models (from meb service agreement examples / public docs):
 * - iOS IAP: store takes ~30% first → writer share 80% of remaining ≈ 56% of list price
 * - Web / card / meb+ (non-Google Play): payment fee ~4% → writer 70% of remaining ≈ 67.2%
 * - Android Google Play: historically restricted; meb+ uses alternate rails → treat like Web default
 * All editable in UI; labeled as estimates.
 */
export type MebChannel = 'ios' | 'android_web' | 'web';

export interface MebChannelPreset {
  id: MebChannel;
  label: string;
  storeFeePct: number;
  writerSharePct: number;
  note: string;
}

export const MEB_CHANNELS: MebChannelPreset[] = [
  {
    id: 'ios',
    label: 'iOS (In-App Purchase)',
    storeFeePct: 30,
    writerSharePct: 80,
    note: 'หักค่าบริการ Apple ~30% ก่อน แล้วนักเขียนได้ ~80% ของส่วนที่เหลือ ≈ 56% ของราคาขาย'
  },
  {
    id: 'android_web',
    label: 'Android (meb+ / นอก Play)',
    storeFeePct: 4,
    writerSharePct: 70,
    note: 'ใกล้เคียงช่องทางอื่น: ค่าชำระเงิน ~4% แล้วนักเขียน ~70% ของส่วนที่เหลือ ≈ 67.2% (meb+ ไม่ผ่าน Google Play)'
  },
  {
    id: 'web',
    label: 'Web / บัตรเครดิต',
    storeFeePct: 4,
    writerSharePct: 70,
    note: 'ตัวอย่างในข้อตกลง: ราคา 100 − ค่าชำระ 4% แล้ว ×70% = 67.2 บาท'
  }
];

export function effectiveWriterRate(storeFeePct: number, writerSharePct: number): number {
  const remain = 1 - Math.max(0, storeFeePct) / 100;
  return remain * (Math.max(0, writerSharePct) / 100);
}

export interface UnitEconomicsInput {
  price: number;
  storeFeePct: number;
  writerSharePct: number;
  extraCostPerUnit: number;
  transferFeePerUnit: number; // usually 0; transfer is often per payout round
}

export interface UnitEconomics {
  price: number;
  storeFee: number;
  afterStore: number;
  writerGross: number;
  extraCostPerUnit: number;
  transferFeePerUnit: number;
  profitPerUnit: number;
  effectivePct: number;
}

export function calcUnitEconomics(input: UnitEconomicsInput): UnitEconomics {
  const storeFee = input.price * (Math.max(0, input.storeFeePct) / 100);
  const afterStore = input.price - storeFee;
  const writerGross = afterStore * (Math.max(0, input.writerSharePct) / 100);
  const profitPerUnit =
    writerGross - Math.max(0, input.extraCostPerUnit) - Math.max(0, input.transferFeePerUnit);
  return {
    price: input.price,
    storeFee,
    afterStore,
    writerGross,
    extraCostPerUnit: Math.max(0, input.extraCostPerUnit),
    transferFeePerUnit: Math.max(0, input.transferFeePerUnit),
    profitPerUnit,
    effectivePct: effectiveWriterRate(input.storeFeePct, input.writerSharePct) * 100
  };
}

export interface QuantityEconomics {
  units: number;
  sales: number;
  storeFees: number;
  writerGross: number;
  extraCosts: number;
  transferTotal: number;
  profit: number;
}

export function calcQuantityEconomics(
  unit: UnitEconomics,
  units: number,
  transferFeePerRound: number,
  transferRounds: number
): QuantityEconomics {
  const n = Math.max(0, units);
  const transferTotal = Math.max(0, transferFeePerRound) * Math.max(0, transferRounds);
  const sales = unit.price * n;
  const storeFees = unit.storeFee * n;
  const writerGross = unit.writerGross * n;
  const extraCosts = unit.extraCostPerUnit * n;
  const profit = writerGross - extraCosts - transferTotal;
  return { units: n, sales, storeFees, writerGross, extraCosts, transferTotal, profit };
}

export interface GoalResult {
  mode: 'sales' | 'profit';
  target: number;
  unitsNeeded: number;
  projectedSales: number;
  projectedStoreFees: number;
  projectedWriterGross: number;
  projectedExtra: number;
  projectedTransfer: number;
  projectedProfit: number;
}

/** Solve units for target sales or target profit (transfer treated as fixed rounds). */
export function calcGoalUnits(
  unit: UnitEconomics,
  target: number,
  mode: 'sales' | 'profit',
  transferFeePerRound: number,
  transferRounds: number
): GoalResult {
  const transfer = Math.max(0, transferFeePerRound) * Math.max(0, transferRounds);
  let unitsNeeded = 0;
  if (mode === 'sales') {
    unitsNeeded = unit.price > 0 ? Math.ceil(target / unit.price) : 0;
  } else {
    const per = unit.writerGross - unit.extraCostPerUnit;
    unitsNeeded = per > 0 ? Math.ceil((target + transfer) / per) : 0;
  }
  const q = calcQuantityEconomics(unit, unitsNeeded, transferFeePerRound, transferRounds);
  return {
    mode,
    target,
    unitsNeeded,
    projectedSales: q.sales,
    projectedStoreFees: q.storeFees,
    projectedWriterGross: q.writerGross,
    projectedExtra: q.extraCosts,
    projectedTransfer: q.transferTotal,
    projectedProfit: q.profit
  };
}

export interface RawUnitIncome {
  coins: number;
  paymentFeeFactor: number;
  writerShare: number;
  income: number;
  factor: number;
}

export function calcRawUnitIncome(
  coins: number,
  paymentFeeFactor: number,
  writerShare: number
): RawUnitIncome {
  const factor = paymentFeeFactor * writerShare;
  return { coins, paymentFeeFactor, writerShare, factor, income: coins * factor };
}

export const MEB_RATES = [
  { id: 'low', label: 'ประหยัด / มือใหม่', rate: 0.002 },
  { id: 'mid', label: 'มาตรฐาน', rate: 0.003 },
  { id: 'high', label: 'พรีเมียม', rate: 0.004 }
] as const;

/** Keep legacy helpers used elsewhere */
export function calcMebProfit(input: {
  price: number;
  platformFeePct: number;
  vatMode: 'none' | 'inclusive' | 'on_fee';
  withholdingPct: number;
  transferFee: number;
  transferRounds: number;
  copiesSold: number;
  extraCost: number;
}) {
  const unit = calcUnitEconomics({
    price: input.price,
    storeFeePct: input.platformFeePct,
    writerSharePct: 100,
    extraCostPerUnit: input.copiesSold > 0 ? input.extraCost / Math.max(1, input.copiesSold) : 0,
    transferFeePerUnit: 0
  });
  // Approximate old model: platform fee only (writer keeps rest)
  const platformFee = input.price * (input.platformFeePct / 100);
  const revenuePerCopy = input.price - platformFee;
  const gross = revenuePerCopy * input.copiesSold;
  const transferTotal = input.transferFee * input.transferRounds;
  return {
    price: input.price,
    afterPlatform: revenuePerCopy,
    platformFee,
    vatNote: input.vatMode,
    withholding: 0,
    revenuePerCopy,
    grossRevenue: gross,
    transferTotal,
    extraCost: input.extraCost,
    netProfit: gross - transferTotal - input.extraCost,
    breakEvenCopies: unit.profitPerUnit
  };
}

export function calcRawWriterIncome(input: {
  coinsSold: number;
  paymentFeeFactor: number;
  writerShare: number;
}) {
  return calcRawUnitIncome(input.coinsSold, input.paymentFeeFactor, input.writerShare);
}
