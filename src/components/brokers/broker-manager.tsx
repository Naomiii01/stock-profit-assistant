"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BrokerFormFields } from "./broker-form-fields";
import {
  createBroker,
  updateBroker,
  deleteBroker,
  archiveBroker,
  type BrokerFormState,
} from "@/lib/actions/brokers";
import type { Broker } from "@/types/database";

const initialState: BrokerFormState = {};

export function BrokerManager({ brokers }: { brokers: Broker[] }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">券商管理</h1>
          <p className="text-sm text-muted-foreground">管理你的證券商帳戶與手續費折數</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> 新增券商
          </Button>
          <DialogContent>
            <CreateBrokerForm onDone={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {brokers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          尚未新增任何券商，點選右上角「新增券商」開始設定。
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>券商</TableHead>
                <TableHead>帳戶暱稱</TableHead>
                <TableHead>手續費折數</TableHead>
                <TableHead>備註</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokers.map((b) => (
                <BrokerRow key={b.id} broker={b} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateBrokerForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createBroker, initialState);

  if (state && !state.error && !state.fieldErrors && state !== initialState) {
    // 建立成功（無錯誤）：關閉對話框
    onDone();
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>新增券商</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <BrokerFormFields fieldErrors={state?.fieldErrors} />
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

function BrokerRow({ broker }: { broker: Broker }) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell className="font-medium">{broker.broker_name}</TableCell>
      <TableCell>{broker.account_name || "—"}</TableCell>
      <TableCell>{broker.fee_discount === 1 ? "全額" : `${(broker.fee_discount * 10).toFixed(1)} 折`}</TableCell>
      <TableCell className="max-w-40 truncate text-muted-foreground">{broker.note || "—"}</TableCell>
      <TableCell>
        <Badge variant={broker.is_archived ? "secondary" : "success"}>
          {broker.is_archived ? "已封存" : "使用中"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
            </Button>
            <DialogContent>
              <EditBrokerForm broker={broker} onDone={() => setEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => startTransition(() => archiveBroker(broker.id, !broker.is_archived))}
          >
            {broker.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => {
              if (confirm(`確定要刪除券商「${broker.broker_name}」嗎？`)) {
                startTransition(() => deleteBroker(broker.id));
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

function EditBrokerForm({ broker, onDone }: { broker: Broker; onDone: () => void }) {
  const updateWithId = updateBroker.bind(null, broker.id);
  const [state, formAction, pending] = useActionState(updateWithId, initialState);

  if (state && !state.error && !state.fieldErrors && state !== initialState) {
    onDone();
  }

  return (
    <form action={formAction}>
      <DialogHeader>
        <DialogTitle>編輯券商</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <BrokerFormFields defaultValues={broker} fieldErrors={state?.fieldErrors} />
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
