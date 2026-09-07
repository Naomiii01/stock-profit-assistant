"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpWithPassword, signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUpWithPassword, {});

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">暱稱</Label>
            <Input id="display_name" name="display_name" required placeholder="你的名字" />
          </div>
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
            {pending ? "註冊中…" : "建立帳號"}
          </Button>
        </form>

        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">或</span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        </div>

        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            使用 Google 帳號註冊
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          已經有帳號了？{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            前往登入
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
