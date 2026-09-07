"use client";

import { useActionState, useState } from "react";
import { UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TradeFormFields } from "@/components/trades/trade-form-fields";
import { createTrade, type TradeFormState } from "@/lib/actions/trades";
import type { Broker, Trade } from "@/types/database";

interface OcrResult {
  stock_id: string;
  stock_name: string;
  trade_date: string;
  trade_type: "buy" | "sell";
  price: number;
  quantity: number;
  fee: number;
  tax: number;
  confidence: number;
}

const initialState: TradeFormState = {};

export function OcrUploader({ brokers }: { brokers: Broker[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/ai/ocr", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "辨識失敗");
        return;
      }
      if (data.mock) setNotice(data.message);
      setResult(data.result);
    } catch {
      setError("辨識過程發生錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <label
            htmlFor="screenshot"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center text-sm text-muted-foreground hover:bg-accent/40 cursor-pointer"
          >
            <UploadCloud className="size-6" />
            {file ? file.name : "點選或拖曳上傳交易截圖（支援 PNG / JPG / PDF）"}
            <input
              id="screenshot"
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </label>
          {previewUrl && file?.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="截圖預覽" className="mt-4 max-h-64 rounded-lg border object-contain" />
          )}
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">AI 辨識中，請稍候…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {notice && (
        <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {notice}
        </div>
      )}

      {result && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              {result.confidence >= 95 ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <AlertTriangle className="size-4 text-yellow-500" />
              )}
              <span className="text-sm font-medium">
                辨識信心分數：{result.confidence}%{" "}
                {result.confidence < 95 && (
                  <span className="text-yellow-600">— 信心較低，請仔細核對以下欄位</span>
                )}
              </span>
            </div>
            <ConfirmForm result={result} brokers={brokers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfirmForm({ result, brokers }: { result: OcrResult; brokers: Broker[] }) {
  const [state, formAction, pending] = useActionState(createTrade, initialState);

  const defaultValues: Partial<Trade> = {
    trade_date: result.trade_date,
    stock_id: result.stock_id,
    stock_name: result.stock_name,
    trade_type: result.trade_type,
    price: result.price,
    quantity: result.quantity,
    amount: result.price * result.quantity,
    fee: result.fee,
    tax: result.tax,
    source: "ai_ocr",
    ocr_confidence: result.confidence,
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TradeFormFields brokers={brokers} defaultValues={defaultValues} fieldErrors={state?.fieldErrors} />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state && !state.error && !state.fieldErrors && state !== initialState && (
        <p className="text-sm text-success">已匯入交易紀錄！</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "匯入中…" : "確認並匯入交易紀錄"}
        </Button>
      </div>
    </form>
  );
}
