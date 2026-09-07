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
  // 尚未串接即時股價 API，未實現損益以「無報價」狀態呈現（priceMap 為空）
  const summary = summarizePortfolio(holdings, {}, totalDividend);

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
        <StatCard label="總市值" value={formatCurrency(summary.totalMarketValue)} hint="未輸入現價時以成本估算" />
        <StatCard
          label="已實現損益"
          value={formatCurrency(summary.totalRealizedPnl)}
          tone={summary.totalRealizedPnl >= 0 ? "up" : "down"}
        />
        <StatCard
          label="未實現損益"
          value={formatCurrency(summary.totalUnrealizedPnl)}
          hint="請至持股管理輸入現價"
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
