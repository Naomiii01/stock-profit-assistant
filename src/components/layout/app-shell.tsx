"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/lib/actions/auth";
import type { ReactNode } from "react";

export function AppShell({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarHeader />
        <SidebarNav />
        <SidebarFooter displayName={displayName} />
      </aside>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col">
          <SidebarHeader />
          <SidebarNav onNavigate={() => setOpen(false)} />
          <SidebarFooter displayName={displayName} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 md:justify-end">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        股
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">股票收益小幫手</p>
        <p className="truncate text-[11px] text-muted-foreground leading-tight">
          Stock Profit Assistant
        </p>
      </div>
    </div>
  );
}

function SidebarFooter({ displayName }: { displayName: string }) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-medium">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <p className="truncate text-sm font-medium">{displayName}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
          <LogOut className="size-4" />
          登出
        </Button>
      </form>
    </div>
  );
}
