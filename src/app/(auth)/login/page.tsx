"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInWithPassword, signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInWithPassword, {});

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <RegisteredNotice />
        </Suspense>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">密碼</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "登入中…" : "登入"}
          </Button>
        </form>

        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">或</span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        </div>

        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            使用 Google 帳號登入
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          還沒有帳號？{" "}
          <Link href="/signup" className="text-primary underline underline-offset-4">
            立即註冊
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function RegisteredNotice() {
  const params = useSearchParams();
  if (params.get("registered") !== "1") return null;
  return (
    <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
      註冊成功！請確認信箱後登入（若未啟用信箱驗證可直接登入）。
    </p>
  );
}
