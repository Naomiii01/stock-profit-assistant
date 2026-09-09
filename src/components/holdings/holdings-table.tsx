"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { EngineResult } from "@/lib/portfolio/engine";
import { createClient } from "@/lib/supabase/client";

export function HoldingsTable({ holdings }: { holdings: EngineResult[] }) {
  // prices：現價輸入框即時對應的值，每打一個字都會更新，用來即時算市值/損益顯示。
  // sortBasisPrices：只有在「離開輸入框」時才更新，排序只依這個為準，
  // 這樣打字的時候表格才不會因為市值一直變動而一直跳來跳去、造成打不進去的錯覺。
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [sortBasisPrices, setSortBasisPrices] = useState<Record<string, number>>({});
  // 記錄哪些代號的現價是「自動帶入」的（來自每日收盤價同步），
  // 使用者手動改過的就不再被自動更新覆蓋掉。
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [priceFetchedAt, setPriceFetchedAt] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"pnlPct" | "marketValue" | "cost">("marketValue");

  useEffect(() => {
    const stockIds = Array.from(new Set(holdings.filter((h) => h.remainingQuantity > 1e-6).map((h) => h.stockId)));
    if (stockIds.length === 0) return;
    const supabase = createClient();
    supabase
      .from("price_cache")
      .select("stock_id, last_price, fetched_at")
      .in("stock_id", stockIds)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const autoNext: Record<string, boolean> = {};
        let latest: string | null = null;
        setPrices((prev) => {
          const next = { ...prev };
          for (const row of data as { stock_id: string; last_price: number | null; fetched_at: string | null }[]) {
            if (row.last_price == null) continue;
            // 只在使用者還沒手動填過這檔的現價時才自動帶入
            if (next[row.stock_id] == null) {
              next[row.stock_id] = row.last_price;
              autoNext[row.stock_id] = true;
            }
            if (row.fetched_at && (!latest || row.fetched_at > latest)) latest = row.fetched_at;
          }
          return next;
        });
        setSortBasisPrices((prev) => {
          const next = { ...prev };
          for (const row of data as { stock_id: string; last_price: number | null }[]) {
            if (row.last_price == null) continue;
            if (next[row.stock_id] == null) next[row.stock_id] = row.last_price;
          }
          return next;
        });
        setAutoFilled((prevAuto) => ({ ...prevAuto, ...autoNext }));
        if (latest) setPriceFetchedAt(latest);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length]);

  function commitPrice(stockId: string) {
    setSortBasisPrices((s) => ({ ...s, [stockId]: prices[stockId] }));
  }

  const rows = useMemo(() => {
    const open = holdings.filter((h) => h.remainingQuantity > 1e-6);
    const withPrice = open.map((h) => {
      const price = prices[h.stockId];
      const marketValue = price != null ? price * h.remainingQuantity : h.totalCostRemaining;
      const unrealizedPnl = price != null ? marketValue - h.totalCostRemaining : 0;
      const unrealizedPnlPct = h.totalCostRemaining > 0 ? (unrealizedPnl / h.totalCostRemaining) * 100 : 0;

      // 排序專用的市值/獲利率，只跟著「已離開輸入框」的價格走，不會在打字時亂跳
      const sortPrice = sortBasisPrices[h.stockId];
      const sortMarketValue = sortPrice != null ? sortPrice * h.remainingQuantity : h.totalCostRemaining;
      const sortUnrealizedPnlPct =
        sortPrice != null && h.totalCostRemaining > 0
          ? ((sortMarketValue - h.totalCostRemaining) / h.totalCostRemaining) * 100
          : 0;

      return { ...h, price, marketValue, unrealizedPnl, unrealizedPnlPct, sortMarketValue, sortUnrealizedPnlPct };
    });

    return withPrice.sort((a, b) => {
      if (sortKey === "pnlPct") return b.sortUnrealizedPnlPct - a.sortUnrealizedPnlPct;
      if (sortKey === "cost") return b.totalCostRemaining - a.totalCostRemaining;
      return b.sortMarketValue - a.sortMarketValue;
    });
  }, [holdings, prices, sortBasisPrices, sortKey]);

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
        {priceFetchedAt
          ? `「現價」已自動帶入最近一次同步的收盤價（${new Date(priceFetchedAt).toLocaleString("zh-TW", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}），可直接手動修改覆蓋。`
          : "尚未同步過收盤價，請到「設定」頁按「更新今日收盤價」，或直接在「現價」欄位手動輸入。"}
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
              <TableHead className="sticky left-0 z-10 bg-background">股票</TableHead>
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
                <TableCell className="sticky left-0 z-10 bg-background">
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setPrices((p) => ({ ...p, [r.stockId]: value === "" ? 0 : Number(value) }));
                      setAutoFilled((a) => ({ ...a, [r.stockId]: false }));
                    }}
                    onBlur={() => commitPrice(r.stockId)}
                  />
                  {autoFilled[r.stockId] && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">自動帶入</p>
                  )}
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
