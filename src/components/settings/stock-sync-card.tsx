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

  return (
    <Card>
      <CardHeader>
        <CardTitle>台股代號資料庫</CardTitle>
        <CardDescription>
          從證交所（TWSE）與櫃買中心（TPEx）同步全市場股票代號與名稱，讓交易紀錄輸入代號時能自動帶出更完整的股票名稱。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Button type="button" onClick={handleSync} disabled={pending}>
            {pending ? "同步中…" : "立即同步"}
          </Button>
        </div>
        {result?.success && (
          <p className="text-sm text-muted-foreground">
            同步完成，共寫入 {result.upserted} 檔（上市 {result.twse_count} 檔／上櫃 {result.tpex_count} 檔／內建常用清單{" "}
            {result.curated_count} 檔）。
          </p>
        )}
        {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
      </CardContent>
    </Card>
  );
}
