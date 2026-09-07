"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Broker, Trade } from "@/types/database";

const MARKET_LABELS: Record<string, string> = {
  TW_LISTED: "上市",
  TW_OTC: "上櫃",
  TW_ETF: "ETF",
  TW_ACTIVE_ETF: "主動式ETF",
  OVERSEAS: "海外股票",
};

export function TradeFormFields({
  brokers,
  defaultValues,
  fieldErrors,
}: {
  brokers: Broker[];
  defaultValues?: Partial<Trade>;
  fieldErrors?: Record<string, string[]>;
}) {
  const [tradeType, setTradeType] = useState<"buy" | "sell">(defaultValues?.trade_type ?? "buy");
  const [price, setPrice] = useState(defaultValues?.price ?? 0);
  const [quantity, setQuantity] = useState(defaultValues?.quantity ?? 0);
  const [amount, setAmount] = useState(defaultValues?.amount ?? 0);
  const [amountTouched, setAmountTouched] = useState(false);

  const computedAmount = amountTouched ? amount : Math.round(price * quantity);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="source" value={defaultValues?.source ?? "manual"} />
      {defaultValues?.ocr_confidence != null && (
        <input type="hidden" name="ocr_confidence" value={defaultValues.ocr_confidence} />
      )}
      <div className="sm:col-span-2">
        <Tabs value={tradeType} onValueChange={(v) => setTradeType(v as "buy" | "sell")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">買進</TabsTrigger>
            <TabsTrigger value="sell">賣出</TabsTrigger>
          </TabsList>
        </Tabs>
        <input type="hidden" name="trade_type" value={tradeType} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trade_date">交易日期</Label>
        <Input
          id="trade_date"
          name="trade_date"
          type="date"
          required
          defaultValue={defaultValues?.trade_date ?? new Date().toISOString().slice(0, 10)}
        />
        {fieldErrors?.trade_date && <p className="text-xs text-destructive">{fieldErrors.trade_date[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>券商</Label>
        <Select name="broker_id" defaultValue={defaultValues?.broker_id ?? undefined}>
          <SelectTrigger>
            <SelectValue placeholder="選擇券商（選填）" />
          </SelectTrigger>
          <SelectContent>
            {brokers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.broker_name}
                {b.account_name ? `（${b.account_name}）` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stock_id">股票代號</Label>
        <Input id="stock_id" name="stock_id" required placeholder="例如 2330" defaultValue={defaultValues?.stock_id ?? ""} />
        {fieldErrors?.stock_id && <p className="text-xs text-destructive">{fieldErrors.stock_id[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stock_name">股票名稱</Label>
        <Input id="stock_name" name="stock_name" required placeholder="例如 台積電" defaultValue={defaultValues?.stock_name ?? ""} />
        {fieldErrors?.stock_name && <p className="text-xs text-destructive">{fieldErrors.stock_name[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>市場別</Label>
        <Select name="market" defaultValue={defaultValues?.market ?? "TW_LISTED"}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MARKET_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>單位</Label>
        <Select name="lot_type" defaultValue={defaultValues?.lot_type ?? "whole"}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whole">整股</SelectItem>
            <SelectItem value="odd">零股</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="price">成交價格</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        {fieldErrors?.price && <p className="text-xs text-destructive">{fieldErrors.price[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">股數</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          step="1"
          min="0"
          required
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        {fieldErrors?.quantity && <p className="text-xs text-destructive">{fieldErrors.quantity[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">成交金額（可手動調整以對帳）</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          value={computedAmount}
          onChange={(e) => {
            setAmountTouched(true);
            setAmount(Number(e.target.value));
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fee">手續費</Label>
        <Input id="fee" name="fee" type="number" step="0.01" min="0" defaultValue={defaultValues?.fee ?? 0} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tax">交易稅（賣出才需填）</Label>
        <Input id="tax" name="tax" type="number" step="0.01" min="0" defaultValue={defaultValues?.tax ?? 0} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="note">備註（選填）</Label>
        <Input id="note" name="note" defaultValue={defaultValues?.note ?? ""} />
      </div>
    </div>
  );
}
