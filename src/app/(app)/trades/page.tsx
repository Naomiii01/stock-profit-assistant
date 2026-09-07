import { createClient } from "@/lib/supabase/server";
import { TradeManager } from "@/components/trades/trade-manager";
import type { Broker, Trade } from "@/types/database";

export default async function TradesPage() {
  const supabase = await createClient();
  const [{ data: trades }, { data: brokers }] = await Promise.all([
    supabase.from("trades").select("*").order("trade_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("brokers").select("*").eq("is_archived", false).order("broker_name"),
  ]);

  return <TradeManager trades={(trades as Trade[]) ?? []} brokers={(brokers as Broker[]) ?? []} />;
}
