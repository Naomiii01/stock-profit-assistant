"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BROKER_PRESETS, type Broker } from "@/types/database";

export function BrokerFormFields({
  defaultValues,
  fieldErrors,
}: {
  defaultValues?: Partial<Broker>;
  fieldErrors?: Record<string, string[]>;
}) {
  const isCustomDefault =
    !!defaultValues?.broker_name &&
    !BROKER_PRESETS.includes(defaultValues.broker_name as (typeof BROKER_PRESETS)[number]);
  const [isCustom, setIsCustom] = useState(isCustomDefault);
  const [presetValue, setPresetValue] = useState<string>(
    isCustomDefault ? BROKER_PRESETS[0] : (defaultValues?.broker_name ?? BROKER_PRESETS[0])
  );
  const [customValue, setCustomValue] = useState(isCustomDefault ? defaultValues?.broker_name ?? "" : "");

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>券商</Label>
        <Select
          defaultValue={isCustomDefault ? "__custom__" : defaultValues?.broker_name}
          onValueChange={(v) => {
            setIsCustom(v === "__custom__");
            if (v !== "__custom__") setPresetValue(v);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="選擇券商" />
          </SelectTrigger>
          <SelectContent>
            {BROKER_PRESETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">自訂券商…</SelectItem>
          </SelectContent>
        </Select>
        {isCustom ? (
          <Input
            name="broker_name"
            placeholder="輸入券商名稱"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="mt-1.5"
            required
          />
        ) : (
          <input type="hidden" name="broker_name" value={presetValue} />
        )}
        {fieldErrors?.broker_name && (
          <p className="text-xs text-destructive">{fieldErrors.broker_name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account_name">帳戶暱稱（選填）</Label>
        <Input
          id="account_name"
          name="account_name"
          placeholder="例如：主帳戶、退休帳戶"
          defaultValue={defaultValues?.account_name ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fee_discount">手續費折數（0.01–1，例如 6 折請輸入 0.6）</Label>
        <Input
          id="fee_discount"
          name="fee_discount"
          type="number"
          step="0.001"
          min="0.01"
          max="1"
          defaultValue={defaultValues?.fee_discount ?? 1}
        />
        {fieldErrors?.fee_discount && (
          <p className="text-xs text-destructive">{fieldErrors.fee_discount[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">備註（選填）</Label>
        <Input id="note" name="note" defaultValue={defaultValues?.note ?? ""} />
      </div>
    </div>
  );
}
