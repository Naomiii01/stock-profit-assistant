import { createClient } from "@/lib/supabase/server";
import { calculateAllHoldings } from "@/lib/portfolio/engine";
import { HoldingsTable } from "@/components/holdings/holdings-table";
import type { CostMethod, Trade } from "@/types/database";

export default async function HoldingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trades }, { data: profile }] = await Promise.all([
    supabase.from("trades").select("*").order("trade_date"),
    supabase.from("profiles").select("cost_method").eq("id", user!.id).maybeSingle(),
  ]);

  const method: CostMethod = (profile?.cost_method as CostMethod) ?? "FIFO";
  const holdings = calculateAllHoldings((trades as Trade[]) ?? [], method);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">持股管理</h1>
        <p className="text-sm text-muted-foreground">
          目前使用「{method === "FIFO" ? "先進先出（FIFO）" : "加權平均成本"}」計算成本，可至設定頁切換。
        </p>
      </div>
      <HoldingsTable holdings={holdings} />
    </div>
  );
}
