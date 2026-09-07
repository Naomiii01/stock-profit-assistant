import { createClient } from "@/lib/supabase/server";
import { calculateAllHoldings } from "@/lib/portfolio/engine";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import type { CostMethod, Trade } from "@/types/database";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trades }, { data: profile }] = await Promise.all([
    supabase.from("trades").select("*").order("trade_date"),
    supabase.from("profiles").select("cost_method").eq("id", user!.id).maybeSingle(),
  ]);

  const method: CostMethod = (profile?.cost_method as CostMethod) ?? "FIFO";
  const holdings = calculateAllHoldings((trades as Trade[]) ?? [], method);

  const allRealized = holdings
    .flatMap((h) => h.realized.map((r) => ({ ...r, stockId: h.stockId, stockName: h.stockName })))
    .sort((a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime());

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const r of allRealized) {
    if (r.realizedPnl >= 0) {
      curWin += 1;
      curLoss = 0;
    } else {
      curLoss += 1;
      curWin = 0;
    }
    maxWinStreak = Math.max(maxWinStreak, curWin);
    maxLossStreak = Math.max(maxLossStreak, curLoss);
  }

  const best = [...allRealized].sort((a, b) => b.realizedPnl - a.realizedPnl).slice(0, 5);
  const worst = [...allRealized].sort((a, b) => a.realizedPnl - b.realizedPnl).slice(0, 5);

  const avgHoldingDays =
    holdings.filter((h) => h.holdingDays != null).length > 0
      ? Math.round(
          holdings
            .filter((h) => h.holdingDays != null)
            .reduce((s, h) => s + (h.holdingDays ?? 0), 0) /
            holdings.filter((h) => h.holdingDays != null).length
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">績效分析中心</h1>
        <p className="text-sm text-muted-foreground">
          已完成交易勝率、連勝連敗與最佳/最差交易分析；最大回撤與 Sharpe Ratio 需要每日淨值序列，將在串接即時股價後推出。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="已實現交易筆數" value={allRealized.length} />
        <StatCard label="最大連勝" value={`${maxWinStreak} 筆`} tone="up" />
        <StatCard label="最大連敗" value={`${maxLossStreak} 筆`} tone="down" />
        <StatCard label="平均持有天數（未平倉）" value={avgHoldingDays != null ? `${avgHoldingDays} 天` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RealizedTable title="最佳交易 Top 5" rows={best} tone="up" />
        <RealizedTable title="最差交易 Top 5" rows={worst} tone="down" />
      </div>
    </div>
  );
}

function RealizedTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { stockId: string; stockName: string; sellDate: string; realizedPnl: number; realizedPnlPct: number }[];
  tone: "up" | "down";
}) {
  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">尚無資料</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>股票</TableHead>
              <TableHead>賣出日期</TableHead>
              <TableHead className="text-right">損益</TableHead>
              <TableHead className="text-right">報酬率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <span className="font-medium">{r.stockId}</span>{" "}
                  <span className="text-muted-foreground">{r.stockName}</span>
                </TableCell>
                <TableCell>{formatDate(r.sellDate)}</TableCell>
                <TableCell className={`text-right num-tabular ${tone === "up" ? "text-destructive" : "text-success"}`}>
                  {formatCurrency(r.realizedPnl)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={tone === "up" ? "destructive" : "success"}>{formatPercent(r.realizedPnlPct)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
