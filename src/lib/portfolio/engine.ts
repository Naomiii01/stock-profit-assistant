import type { CostMethod, Trade } from "@/types/database";

/**
 * Portfolio Engine
 * ------------------------------------------------------------------
 * 核心投資組合計算引擎：把某一檔股票的所有交易紀錄（依日期排序）
 * 轉換成「已實現損益」逐筆明細 + 目前剩餘庫存（可用來算未實現損益）。
 *
 * 支援兩種成本計算法：
 *   - FIFO（先進先出）：賣出時，優先消耗最早買進、尚未賣出的批次成本。
 *   - WEIGHTED_AVERAGE（加權平均成本）：每次買進後重新計算整體平均成本，
 *     賣出時一律用當下的加權平均成本認列已實現損益。
 *
 * 範例（FIFO）：
 *   買 100 股 @100 -> 買 100 股 @120 -> 賣 100 股 @150
 *   已實現損益 = (150 - 100) * 100 = 5000
 *   剩餘庫存：100 股，成本 120
 */

export interface Lot {
  tradeId: string;
  date: string;
  quantity: number; // 剩餘未賣出的股數
  unitCost: number; // 每股成本（含買進手續費攤提）
}

export interface RealizedEntry {
  sellTradeId: string;
  sellDate: string;
  quantity: number;
  sellUnitPrice: number;
  costBasis: number; // 這筆賣出對應消耗掉的總成本
  proceeds: number; // 賣出淨收入（扣手續費與交易稅後）
  realizedPnl: number;
  realizedPnlPct: number;
}

export interface EngineResult {
  stockId: string;
  stockName: string;
  method: CostMethod;
  realized: RealizedEntry[];
  totalRealizedPnl: number;
  remainingLots: Lot[];
  remainingQuantity: number;
  averageCost: number; // 剩餘庫存的平均成本（兩種模式最後都會化成單一均價方便顯示）
  totalCostRemaining: number;
  holdingDays: number | null; // 以最早一筆尚未出清的批次日期估算
}

function daysBetween(a: string, b: string) {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export function calculatePortfolio(
  trades: Trade[],
  method: CostMethod = "FIFO",
  asOfDate: string = new Date().toISOString().slice(0, 10)
): EngineResult {
  if (trades.length === 0) {
    throw new Error("calculatePortfolio: trades 不可為空陣列");
  }

  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime() ||
      a.created_at.localeCompare(b.created_at)
  );

  const realized: RealizedEntry[] = [];

  if (method === "FIFO") {
    const lots: Lot[] = [];

    for (const t of sorted) {
      if (t.trade_type === "buy") {
        const totalCost = t.amount + t.fee; // 買進成本含手續費
        lots.push({
          tradeId: t.id,
          date: t.trade_date,
          quantity: t.quantity,
          unitCost: totalCost / t.quantity,
        });
      } else {
        let remainingToSell = t.quantity;
        const proceeds = t.amount - t.fee - t.tax;
        const sellUnitPrice = t.amount / t.quantity;
        let costBasisTotal = 0;

        while (remainingToSell > 1e-9 && lots.length > 0) {
          const lot = lots[0];
          const consumed = Math.min(lot.quantity, remainingToSell);
          costBasisTotal += consumed * lot.unitCost;
          lot.quantity -= consumed;
          remainingToSell -= consumed;
          if (lot.quantity <= 1e-9) lots.shift();
        }

        const proceedsForSold =
          t.quantity > 0 ? (proceeds * (t.quantity - remainingToSell)) / t.quantity : 0;
        const realizedPnl = proceedsForSold - costBasisTotal;

        realized.push({
          sellTradeId: t.id,
          sellDate: t.trade_date,
          quantity: t.quantity - remainingToSell,
          sellUnitPrice,
          costBasis: costBasisTotal,
          proceeds: proceedsForSold,
          realizedPnl,
          realizedPnlPct: costBasisTotal > 0 ? (realizedPnl / costBasisTotal) * 100 : 0,
        });
      }
    }

    const remainingQuantity = lots.reduce((s, l) => s + l.quantity, 0);
    const totalCostRemaining = lots.reduce((s, l) => s + l.quantity * l.unitCost, 0);

    return {
      stockId: sorted[0].stock_id,
      stockName: sorted[0].stock_name,
      method,
      realized,
      totalRealizedPnl: realized.reduce((s, r) => s + r.realizedPnl, 0),
      remainingLots: lots,
      remainingQuantity,
      averageCost: remainingQuantity > 0 ? totalCostRemaining / remainingQuantity : 0,
      totalCostRemaining,
      holdingDays: lots.length > 0 ? daysBetween(lots[0].date, asOfDate) : null,
    };
  }

  // ---- WEIGHTED_AVERAGE ----
  let quantity = 0;
  let totalCost = 0;
  let earliestOpenDate: string | null = null;

  for (const t of sorted) {
    if (t.trade_type === "buy") {
      const cost = t.amount + t.fee;
      if (quantity <= 1e-9) earliestOpenDate = t.trade_date;
      quantity += t.quantity;
      totalCost += cost;
    } else {
      const avgUnitCost = quantity > 0 ? totalCost / quantity : 0;
      const soldQty = Math.min(t.quantity, quantity);
      const costBasis = soldQty * avgUnitCost;
      const proceeds = t.amount - t.fee - t.tax;
      const realizedPnl = proceeds - costBasis;

      realized.push({
        sellTradeId: t.id,
        sellDate: t.trade_date,
        quantity: soldQty,
        sellUnitPrice: t.amount / t.quantity,
        costBasis,
        proceeds,
        realizedPnl,
        realizedPnlPct: costBasis > 0 ? (realizedPnl / costBasis) * 100 : 0,
      });

      quantity -= soldQty;
      totalCost -= costBasis;
      if (quantity <= 1e-9) {
        quantity = 0;
        totalCost = 0;
        earliestOpenDate = null;
      }
    }
  }

  return {
    stockId: sorted[0].stock_id,
    stockName: sorted[0].stock_name,
    method,
    realized,
    totalRealizedPnl: realized.reduce((s, r) => s + r.realizedPnl, 0),
    remainingLots:
      quantity > 0
        ? [{ tradeId: "avg", date: earliestOpenDate ?? asOfDate, quantity, unitCost: totalCost / quantity }]
        : [],
    remainingQuantity: quantity,
    averageCost: quantity > 0 ? totalCost / quantity : 0,
    totalCostRemaining: totalCost,
    holdingDays: earliestOpenDate ? daysBetween(earliestOpenDate, asOfDate) : null,
  };
}

/** 把同一使用者「所有股票」的交易一次分組並套用計算引擎 */
export function calculateAllHoldings(
  trades: Trade[],
  method: CostMethod = "FIFO",
  asOfDate?: string
): EngineResult[] {
  const byStock = new Map<string, Trade[]>();
  for (const t of trades) {
    const arr = byStock.get(t.stock_id) ?? [];
    arr.push(t);
    byStock.set(t.stock_id, arr);
  }
  return Array.from(byStock.values()).map((group) =>
    calculatePortfolio(group, method, asOfDate)
  );
}

export interface PortfolioSummary {
  totalInvested: number; // 目前庫存的總成本（尚未出場的錢）
  totalMarketValue: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalDividend: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  profitLossRatio: number; // 平均獲利 / 平均虧損
  maxGain: number;
  maxLoss: number;
  totalReturnPct: number;
}

/**
 * 彙總整個帳戶的績效指標，需要搭配即時股價（priceMap: stock_id -> 現價）。
 * 沒有現價時該檔股票的未實現損益以 0 計算（並在 UI 提示尚未取得報價）。
 */
export function summarizePortfolio(
  results: EngineResult[],
  priceMap: Record<string, number>,
  totalDividend: number
): PortfolioSummary {
  let totalInvested = 0;
  let totalMarketValue = 0;
  let totalRealizedPnl = 0;
  let totalUnrealizedPnl = 0;
  const allRealizedPnls: number[] = [];

  for (const r of results) {
    totalRealizedPnl += r.totalRealizedPnl;
    allRealizedPnls.push(...r.realized.map((e) => e.realizedPnl));

    if (r.remainingQuantity > 0) {
      totalInvested += r.totalCostRemaining;
      const price = priceMap[r.stockId];
      if (price != null) {
        const marketValue = price * r.remainingQuantity;
        totalMarketValue += marketValue;
        totalUnrealizedPnl += marketValue - r.totalCostRemaining;
      } else {
        totalMarketValue += r.totalCostRemaining;
      }
    }
  }

  const wins = allRealizedPnls.filter((p) => p > 0);
  const losses = allRealizedPnls.filter((p) => p < 0);
  const winRate = allRealizedPnls.length > 0 ? (wins.length / allRealizedPnls.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0;

  return {
    totalInvested,
    totalMarketValue,
    totalRealizedPnl,
    totalUnrealizedPnl,
    totalDividend,
    winCount: wins.length,
    lossCount: losses.length,
    winRate,
    profitLossRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    maxGain: allRealizedPnls.length > 0 ? Math.max(...allRealizedPnls) : 0,
    maxLoss: allRealizedPnls.length > 0 ? Math.min(...allRealizedPnls) : 0,
    totalReturnPct:
      totalInvested > 0
        ? ((totalRealizedPnl + totalUnrealizedPnl + totalDividend) / totalInvested) * 100
        : 0,
  };
}
