"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SyncResult = {
  success?: boolean;
  upserted?: number;
  twse_count?: number;
  tpex_count?: number;
  curated_count?: number;
  error?: string;
};

export function StockSyncCard() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const [pricePending, setPricePending] = useState(false);
  const [priceResult, setPriceResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/stocks/sync", { method: "POST" });
      const data = (await res.json()) as SyncResult;
      setResult(data);
    } catch {
      setResult({ error: "同步失敗，請確認網路連線後再試一次。" });
    } finally {
      setPending(false);
    }
  }

  async function handlePriceSync() {
    setPricePending(true);
    setPriceResult(null);
    try {
      const res = await fetch("/api/stocks/sync-prices", { method: "POST" });
      const data = (await res.json()) as SyncResult;
      setPriceResult(data);
    } catch {
      setPriceResult({ error: "同步失敗，請確認網路連線後再試一次。" });
    } finally {
      setPricePending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>台股代號與收盤價資料庫</CardTitle>
        <CardDescription>
          從證交所（TWSE）與櫃買中心（TPEx）同步全市場股票代號、名稱與每日收盤價，讓交易紀錄可以自動帶出股票名稱、持股管理可以自動帶出現價。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div>
            <Button type="button" onClick={handleSync} disabled={pending}>
              {pending ? "同步中…" : "同步股票代號 / 名稱"}
            </Button>
          </div>
          {result?.success && (
            <p className="text-sm text-muted-foreground">
              同步完成，共寫入 {result.upserted} 檔（上市 {result.twse_count} 檔／上櫃 {result.tpex_count} 檔／內建常用清單{" "}
              {result.curated_count} 檔）。
            </p>
          )}
          {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div>
            <Button type="button" variant="outline" onClick={handlePriceSync} disabled={pricePending}>
              {pricePending ? "同步中…" : "更新今日收盤價"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            已設定每個交易日自動更新一次（收盤後），這顆按鈕可以隨時手動立即更新一次。
          </p>
          {priceResult?.success && (
            <p className="text-sm text-muted-foreground">
              收盤價更新完成，共 {priceResult.upserted} 檔（上市 {priceResult.twse_count} 檔／上櫃 {priceResult.tpex_count} 檔）。
            </p>
          )}
          {priceResult?.error && <p className="text-sm text-destructive">{priceResult.error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
