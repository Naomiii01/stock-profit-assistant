"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { updateProfile, type SettingsFormState } from "@/lib/actions/settings";
import type { Profile } from "@/types/database";

const initialState: SettingsFormState = {};

export function SettingsForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const [costMethod, setCostMethod] = useState(profile.cost_method);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>個人資料</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">暱稱</Label>
            <Input id="display_name" name="display_name" defaultValue={profile.display_name ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="base_currency">基準幣別</Label>
            <Input id="base_currency" name="base_currency" defaultValue={profile.base_currency} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成本計算方式</CardTitle>
          <CardDescription>切換後，持股管理與 Dashboard 的已實現/未實現損益會立即重新計算</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={costMethod} onValueChange={(v) => setCostMethod(v as typeof costMethod)}>
            <TabsList className="grid w-full grid-cols-2 sm:w-96">
              <TabsTrigger value="FIFO">先進先出（FIFO）</TabsTrigger>
              <TabsTrigger value="WEIGHTED_AVERAGE">加權平均成本</TabsTrigger>
            </TabsList>
          </Tabs>
          <input type="hidden" name="cost_method" value={costMethod} />
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">已儲存設定</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存設定"}
        </Button>
      </div>
    </form>
  );
}
