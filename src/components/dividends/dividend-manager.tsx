"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { createDividend, deleteDividend, type DividendFormState } from "@/lib/actions/dividends";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Dividend } from "@/types/database";

const initialState: DividendFormState = {};

export function DividendManager({ dividends }: { dividends: Dividend[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const total = dividends.reduce((s, d) => s + d.cash_dividend, 0);
    const thisYear = dividends
      .filter((d) => new Date(d.payment_date).getFullYear() === currentYear)
      .reduce((s, d) => s + d.cash_dividend, 0);
    return { total, thisYear };
  }, [dividends]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">股利管理</h1>
          <p className="text-sm text-muted-foreground">記錄現金股利與股票股利，追蹤被動收入</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> 新增股利
          </Button>
          <DialogContent>
            <CreateDividendForm onDone={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>累積股利</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold num-tabular">{formatCurrency(stats.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>今年股利</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold num-tabular">{formatCurrency(stats.thisYear)}</CardContent>
        </Card>
      </div>

      {dividends.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          尚無股利紀錄，點選「新增股利」開始記錄。
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>發放日期</TableHead>
                <TableHead>股票</TableHead>
                <TableHead className="text-right">現金股利</TableHead>
                <TableHead className="text-right">股票股利（股）</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dividends.map((d) => (
                <DividendRow key={d.id} dividend={d} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateDividendForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createDividend, initialState);

  if (state && !state.error && !state.fieldErrors && state !== initialState) {
    onDone();
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>新增股利紀錄</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stock_id">股票代號</Label>
          <Input id="stock_id" name="stock_id" required placeholder="例如 2330" />
          {state?.fieldErrors?.stock_id && <p className="text-xs text-destructive">{state.fieldErrors.stock_id[0]}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stock_name">股票名稱</Label>
          <Input id="stock_name" name="stock_name" required placeholder="例如 台積電" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payment_date">發放日期</Label>
          <Input id="payment_date" name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cash_dividend">現金股利（總額）</Label>
          <Input id="cash_dividend" name="cash_dividend" type="number" step="0.01" min="0" defaultValue={0} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stock_dividend">股票股利（股數）</Label>
          <Input id="stock_dividend" name="stock_dividend" type="number" step="0.01" min="0" defaultValue={0} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="note">備註（選填）</Label>
          <Input id="note" name="note" />
        </div>
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

function DividendRow({ dividend }: { dividend: Dividend }) {
  const [isPending, startTransition] = useTransition();
  return (
    <TableRow>
      <TableCell>{formatDate(dividend.payment_date)}</TableCell>
      <TableCell>
        <span className="font-medium">{dividend.stock_id}</span>{" "}
        <span className="text-muted-foreground">{dividend.stock_name}</span>
      </TableCell>
      <TableCell className="text-right num-tabular">{formatCurrency(dividend.cash_dividend)}</TableCell>
      <TableCell className="text-right num-tabular">{dividend.stock_dividend || "—"}</TableCell>
      <TableCell className="text-muted-foreground">{dividend.note || "—"}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          onClick={() => {
            if (confirm("確定要刪除這筆股利紀錄嗎？")) {
              startTransition(() => deleteDividend(dividend.id));
            }
          }}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
