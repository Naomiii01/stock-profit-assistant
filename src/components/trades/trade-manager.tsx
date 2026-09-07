"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TradeFormFields } from "./trade-form-fields";
import { createTrade, updateTrade, deleteTrade, type TradeFormState } from "@/lib/actions/trades";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Broker, Trade } from "@/types/database";

const initialState: TradeFormState = {};

export function TradeManager({ trades, brokers }: { trades: Trade[]; brokers: Broker[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<string>("__all__");

  const brokerMap = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);
  const stockOptions = useMemo(() => {
    const set = new Map<string, string>();
    trades.forEach((t) => set.set(t.stock_id, t.stock_name));
    return Array.from(set.entries());
  }, [trades]);

  const filtered = stockFilter === "__all__" ? trades : trades.filter((t) => t.stock_id === stockFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">交易紀錄</h1>
          <p className="text-sm text-muted-foreground">記錄每一筆買進與賣出，系統會自動計算損益</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="篩選股票" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部股票</SelectItem>
              {stockOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {id} {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" /> 新增交易
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <CreateTradeForm brokers={brokers} onDone={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          尚無交易紀錄，點選「新增交易」開始記錄，或前往「AI截圖辨識」快速匯入。
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>股票</TableHead>
                <TableHead>券商</TableHead>
                <TableHead>買/賣</TableHead>
                <TableHead className="text-right">價格</TableHead>
                <TableHead className="text-right">股數</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="text-right">手續費/稅</TableHead>
                <TableHead>來源</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TradeRow key={t.id} trade={t} brokerName={t.broker_id ? brokerMap.get(t.broker_id)?.broker_name : undefined} brokers={brokers} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateTradeForm({ brokers, onDone }: { brokers: Broker[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createTrade, initialState);

  if (state && !state.error && !state.fieldErrors && state !== initialState) {
    onDone();
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>新增交易紀錄</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <TradeFormFields brokers={brokers} fieldErrors={state?.fieldErrors} />
      </div>
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TradeRow({
  trade,
  brokerName,
  brokers,
}: {
  trade: Trade;
  brokerName?: string;
  brokers: Broker[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell>{formatDate(trade.trade_date)}</TableCell>
      <TableCell>
        <span className="font-medium">{trade.stock_id}</span>{" "}
        <span className="text-muted-foreground">{trade.stock_name}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">{brokerName || "—"}</TableCell>
      <TableCell>
        <Badge variant={trade.trade_type === "buy" ? "destructive" : "success"}>
          {trade.trade_type === "buy" ? "買進" : "賣出"}
        </Badge>
      </TableCell>
      <TableCell className="text-right num-tabular">{formatNumber(trade.price, 2)}</TableCell>
      <TableCell className="text-right num-tabular">{formatNumber(trade.quantity)}</TableCell>
      <TableCell className="text-right num-tabular">{formatCurrency(trade.amount)}</TableCell>
      <TableCell className="text-right num-tabular text-muted-foreground">
        {formatCurrency(trade.fee + trade.tax)}
      </TableCell>
      <TableCell>
        {trade.source === "ai_ocr" ? (
          <Badge variant="outline" className="gap-1">
            <ImageIcon className="size-3" /> AI辨識
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">手動</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
            </Button>
            <DialogContent className="sm:max-w-2xl">
              <EditTradeForm trade={trade} brokers={brokers} onDone={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => {
              if (confirm("確定要刪除這筆交易嗎？此動作無法復原。")) {
                startTransition(() => deleteTrade(trade.id));
              }
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditTradeForm({
  trade,
  brokers,
  onDone,
}: {
  trade: Trade;
  brokers: Broker[];
  onDone: () => void;
}) {
  const updateWithId = updateTrade.bind(null, trade.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  if (state && !state.error && !state.fieldErrors && state !== initialState) {
    onDone();
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>編輯交易紀錄</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <TradeFormFields brokers={brokers} defaultValues={trade} fieldErrors={state?.fieldErrors} />
      </div>
      {state?.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存變更"}
        </Button>
      </DialogFooter>
    </form>
  );
}
