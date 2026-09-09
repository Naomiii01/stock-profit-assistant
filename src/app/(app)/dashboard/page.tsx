import { createClient } from "@/lib/supabase/server";
import { calculateAllHoldings, summarizePortfolio } from "@/lib/portfolio/engine";
import { StatCard } from "@/components/dashboard/stat-card";
import { TopHoldingsChart, MonthlyPnlChart, AllocationChart } from "@/components/dashboard/dashboard-charts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { Broker, CostMethod, Dividend, Trade } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trades }, { data: dividends }, { data: brokers }, { data: profile }] = await Promise.all([
    supabase.from("trades").select("*").order("trade_date"),
    supabase.from("dividends").select("*"),
    supabase.from("brokers").select("*"),
    supabase.from("profiles").select("cost_method").eq("id", user!.id).maybeSingle(),
  ]);

  const allTrades = (trades as Trade[]) ?? [];
  const allDividends = (dividends as Dividend[]) ?? [];
  const allBrokers = (brokers as Broker[]) ?? [];
  const method: CostMethod = (profile?.cost_method as CostMethod) ?? "FIFO";

  const holdings = calculateAllHoldings(allTrades, method);
  const totalDividend = allDividends.reduce((s, d) => s + d.cash_dividend, 0);

  // 從 price_cache 讀取每日收盤價（在「設定」頁同步過，或每日自動排程更新過的話就會有資料），
  // 沒有對應資料的股票，未實現損益維持用成本估算，不會噴錯。
  const openStockIds = Array.from(
    new Set(holdings.filter((h) => h.remainingQuantity > 1e-6).map((h) => h.stockId))
  );
  let priceMap: Record<string, number> = {};
  if (openStockIds.length > 0) {
    const { data: priceRows } = await supabase
      .from("price_cache")
      .select("stock_id, last_price")
      .in("stock_id", openStockIds);
    priceMap = Object.fromEntries(
      ((priceRows as { stock_id: string; last_price: number | null }[]) ?? [])
        .filter((p) => p.last_price != null)
        .map((p) => [p.stock_id, p.last_price as number])
    );
  }

  const summary = summarizePortfolio(holdings, priceMap, totalDividend);
  const hasAnyPrice = Object.keys(priceMap).length > 0;

  const firstTradeDate = allTrades[0]?.trade_date;
  const daysSinceStart = firstTradeDate
    ? Math.max(1, Math.round((Date.now() - new Date(firstTradeDate).getTime()) / 86_400_000))
    : null;
  const annualizedReturnPct =
    daysSinceStart && summary.totalInvested > 0
      ? summary.totalReturnPct * (365 / daysSinceStart)
      : 0;

  const topHoldings = [...holdings]
    .filter((h) => h.remainingQuantity > 1e-6)
    .sort((a, b) => b.totalCostRemaining - a.totalCostRemaining)
    .slice(0, 10)
    .map((h) => ({ name: `${h.stockId} ${h.stockName}`, value: h.totalCostRemaining }));

  const monthlyPnlMap = new Map<string, number>();
  for (const h of holdings) {
    for (const r of h.realized) {
      const key = r.sellDate.slice(0, 7);
      monthlyPnlMap.set(key, (monthlyPnlMap.get(key) ?? 0) + r.realizedPnl);
    }
  }
  const monthlyPnl = Array.from(monthlyPnlMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, realizedPnl]) => ({ month, realizedPnl }));

  const brokerMap = new Map(allBrokers.map((b) => [b.id, b.broker_name]));
  const brokerShareMap = new Map<string, number>();
  for (const t of allTrades) {
    const name = t.broker_id ? brokerMap.get(t.broker_id) ?? "未分類" : "未分類";
    brokerShareMap.set(name, (brokerShareMap.get(name) ?? 0) + t.amount);
  }
  const brokerShare = Array.from(brokerShareMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">你的投資績效總覽</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="總投入資金" value={formatCurrency(summary.totalInvested)} />
        <StatCard
          label="總市值"
          value={formatCurrency(summary.totalMarketValue)}
          hint={hasAnyPrice ? "依最近一次同步的收盤價估算" : "未同步過收盤價，暫以成本估算"}
        />
        <StatCard
          label="已實現損益"
          value={formatCurrency(summary.totalRealizedPnl)}
          tone={summary.totalRealizedPnl >= 0 ? "up" : "down"}
        />
        <StatCard
          label="未實現損益"
          value={formatCurrency(summary.totalUnrealizedPnl)}
          hint={hasAnyPrice ? undefined : "請至「設定」頁同步收盤價"}
          tone={hasAnyPrice ? (summary.totalUnrealizedPnl >= 0 ? "up" : "down") : undefined}
        />
        <StatCard label="股利收入" value={formatCurrency(summary.totalDividend)} />
        <StatCard
          label="總報酬率"
          value={formatPercent(summary.totalReturnPct)}
          tone={summary.totalReturnPct >= 0 ? "up" : "down"}
        />
        <StatCard
          label="年化報酬率"
          value={formatPercent(annualizedReturnPct)}
          hint={daysSinceStart ? `依 ${daysSinceStart} 天估算` : undefined}
          tone={annualizedReturnPct >= 0 ? "up" : "down"}
        />
        <StatCard label="勝率" value={formatPercent(summary.winRate, 1).replace("+", "")} />
        <StatCard
          label="賺賠比"
          value={Number.isFinite(summary.profitLossRatio) ? formatNumber(summary.profitLossRatio, 2) : "∞"}
        />
        <StatCard label="最大獲利" value={formatCurrency(summary.maxGain)} tone="up" />
        <StatCard label="最大虧損" value={formatCurrency(summary.maxLoss)} tone="down" />
        <StatCard label="交易次數" value={formatNumber(allTrades.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyPnlChart data={monthlyPnl} />
        <TopHoldingsChart data={topHoldings} />
        <AllocationChart data={topHoldings} title="資產配置圖（依成本）" />
        <AllocationChart data={brokerShare} title="券商分布（依成交金額）" />
      </div>
    </div>
  );
}
