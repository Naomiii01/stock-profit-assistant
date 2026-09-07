"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { EngineResult } from "@/lib/portfolio/engine";

export function HoldingsTable({ holdings }: { holdings: EngineResult[] }) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [sortKey, setSortKey] = useState<"pnlPct" | "marketValue" | "cost">("marketValue");

  const rows = useMemo(() => {
    const open = holdings.filter((h) => h.remainingQuantity > 1e-6);
    const withPrice = open.map((h) => {
      const price = prices[h.stockId];
      const marketValue = price != null ? price * h.remainingQuantity : h.totalCostRemaining;
      const unrealizedPnl = price != null ? marketValue - h.totalCostRemaining : 0;
      const unrealizedPnlPct = h.totalCostRemaining > 0 ? (unrealizedPnl / h.totalCostRemaining) * 100 : 0;
      return { ...h, price, marketValue, unrealizedPnl, unrealizedPnlPct };
    });

    return withPrice.sort((a, b) => {
      if (sortKey === "pnlPct") return b.unrealizedPnlPct - a.unrealizedPnlPct;
      if (sortKey === "cost") return b.totalCostRemaining - a.totalCostRemaining;
      return b.marketValue - a.marketValue;
    });
  }, [holdings, prices, sortKey]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        目前沒有持股中的股票。新增買進交易後會自動顯示在這裡。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        目前尚未串接即時股價 API，請在「現價」欄位手動輸入以計算未實現損益（之後會自動帶入）。
      </div>
      <div className="flex justify-end gap-2 text-xs">
        <SortButton active={sortKey === "marketValue"} onClick={() => setSortKey("marketValue")} label="依市值排序" />
        <SortButton active={sortKey === "cost"} onClick={() => setSortKey("cost")} label="依成本排序" />
        <SortButton active={sortKey === "pnlPct"} onClick={() => setSortKey("pnlPct")} label="依獲利率排序" />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>股票</TableHead>
              <TableHead className="text-right">股數</TableHead>
              <TableHead className="text-right">平均成本</TableHead>
              <TableHead className="text-right">現價</TableHead>
              <TableHead className="text-right">市值</TableHead>
              <TableHead className="text-right">未實現損益</TableHead>
              <TableHead className="text-right">報酬率</TableHead>
              <TableHead className="text-right">持有天數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.stockId}>
                <TableCell>
                  <span className="font-medium">{r.stockId}</span>{" "}
                  <span className="text-muted-foreground">{r.stockName}</span>
                </TableCell>
                <TableCell className="text-right num-tabular">{formatNumber(r.remainingQuantity)}</TableCell>
                <TableCell className="text-right num-tabular">{formatNumber(r.averageCost, 2)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="輸入現價"
                    className="h-8 w-24 text-right"
                    value={prices[r.stockId] ?? ""}
                    onChange={(e) =>
                      setPrices((p) => ({ ...p, [r.stockId]: Number(e.target.value) || 0 }))
                    }
                  />
                </TableCell>
                <TableCell className="text-right num-tabular">{formatCurrency(r.marketValue)}</TableCell>
                <TableCell
                  className={`text-right num-tabular ${
                    r.price == null ? "text-muted-foreground" : r.unrealizedPnl >= 0 ? "text-destructive" : "text-success"
                  }`}
                >
                  {r.price == null ? "—" : formatCurrency(r.unrealizedPnl)}
                </TableCell>
                <TableCell className="text-right">
                  {r.price == null ? (
                    "—"
                  ) : (
                    <Badge variant={r.unrealizedPnlPct >= 0 ? "destructive" : "success"}>
                      {formatPercent(r.unrealizedPnlPct)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {r.holdingDays != null ? `${r.holdingDays} 天` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
