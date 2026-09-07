import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-secondary/60 to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">
            股
          </div>
          <h1 className="text-lg font-semibold">股票收益小幫手</h1>
          <p className="text-sm text-muted-foreground">Stock Profit Assistant</p>
        </div>
        {children}
      </div>
    </div>
  );
}
